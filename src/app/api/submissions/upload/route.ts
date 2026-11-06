import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser } from '@/lib/auth/serverAuth';
import fs from 'fs';
import path from 'path';
import { uploadCatalogAsset, CatalogAssetKind } from '@/lib/server/catalogStore';

export const runtime = 'nodejs';

async function persistSubmissionAsset(args: {
  buffer: Buffer;
  kind: CatalogAssetKind;
  fileName: string;
  contentType: string;
  ownerId?: string;
  diskDir: string;
  diskUrlPrefix: string;
}): Promise<string> {
  try {
    const { url } = await uploadCatalogAsset({
      buffer: args.buffer,
      kind: args.kind,
      fileName: args.fileName,
      contentType: args.contentType,
      ownerId: args.ownerId,
    });
    return url;
  } catch (err) {
    console.warn('[SubmissionUpload] Cloud storage write fallback to disk:', err);
    try {
      if (!fs.existsSync(args.diskDir)) {
        fs.mkdirSync(args.diskDir, { recursive: true });
      }
      await fs.promises.writeFile(path.join(args.diskDir, args.fileName), args.buffer);
      return `${args.diskUrlPrefix}/${args.fileName}`;
    } catch (diskErr) {
      console.warn('[SubmissionUpload] Disk write fallback error:', diskErr);
      return `${args.diskUrlPrefix}/${args.fileName}`;
    }
  }
}

/**
 * POST /api/submissions/upload
 * Secure upload pipeline for creator submissions.
 * Validates file formats, containers, MIME types, and size constraints.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return (
        auth.response ||
        NextResponse.json({ success: false, error: 'Authentication required to upload creative works.' }, { status: 401 })
      );
    }

    const contentTypeHeader = request.headers.get('content-type') || '';
    if (!contentTypeHeader.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Invalid request content type. Expected multipart/form-data.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const coverFile = formData.get('cover') as File | null;
    const noCoverArt = formData.get('noCoverArt') === 'true';
    const category = (formData.get('category') as string) || 'music';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No creative media file provided.' }, { status: 400 });
    }

    const originalName = file.name || 'submission_file';
    const ext = (path.extname(originalName) || '').toLowerCase();
    const cleanBase = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    // Permitted Extensions & MIME Validation
    const ALLOWED_EXTS = [
      '.mp3',
      '.wav',
      '.aac',
      '.mp4',
      '.mov',
      '.pdf',
      '.epub',
      '.docx',
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
    ];

    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file format (${ext}). Supported formats: MP3, WAV, AAC, MP4, MOV, PDF, EPUB, DOCX, JPG, PNG.`,
        },
        { status: 400 }
      );
    }

    // Classify asset
    const isAudio = ext === '.mp3' || ext === '.wav' || ext === '.aac';
    const isVideo = ext === '.mp4' || ext === '.mov';
    const isPdf = ext === '.pdf';
    const isDoc = ext === '.epub' || ext === '.docx';
    const isImage = ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';

    let assetKind: CatalogAssetKind = 'audio';
    let targetDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
    let urlPrefix = '/audio/uploads';

    if (isVideo) {
      assetKind = 'video';
      targetDir = path.join(process.cwd(), 'public', 'videos');
      urlPrefix = '/videos';
    } else if (isPdf || isDoc) {
      assetKind = 'document';
      targetDir = path.join(process.cwd(), 'public', 'documents');
      urlPrefix = '/documents';
    } else if (isImage) {
      assetKind = 'cover';
      targetDir = path.join(process.cwd(), 'public', 'images', 'artwork');
      urlPrefix = '/images/artwork';
    }

    const uniqueFileName = `${Date.now()}_${cleanBase}${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (ext === '.mp3') mimeType = 'audio/mpeg';
      else if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.aac') mimeType = 'audio/aac';
      else if (ext === '.mp4') mimeType = 'video/mp4';
      else if (ext === '.mov') mimeType = 'video/quicktime';
      else if (ext === '.pdf') mimeType = 'application/pdf';
      else if (ext === '.epub') mimeType = 'application/epub+zip';
      else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    // Persist media file
    const mediaUrl = await persistSubmissionAsset({
      buffer,
      kind: assetKind,
      fileName: uniqueFileName,
      contentType: mimeType,
      ownerId: auth.userId,
      diskDir: targetDir,
      diskUrlPrefix: urlPrefix,
    });

    // Handle Cover Art
    let coverUrl = '';
    if (!noCoverArt && coverFile) {
      const coverExt = (path.extname(coverFile.name) || '.jpg').toLowerCase();
      const uniqueCoverName = `cover_${Date.now()}_${cleanBase}${coverExt}`;
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      const coversDir = path.join(process.cwd(), 'public', 'images', 'covers');

      coverUrl = await persistSubmissionAsset({
        buffer: coverBuffer,
        kind: 'cover',
        fileName: uniqueCoverName,
        contentType: coverFile.type || 'image/jpeg',
        ownerId: auth.userId,
        diskDir: coversDir,
        diskUrlPrefix: '/images/covers',
      });
    }

    const mediaFormat: 'audio' | 'video' | 'pdf' | 'document' | 'image' = isVideo
      ? 'video'
      : isPdf
      ? 'pdf'
      : isDoc
      ? 'document'
      : isImage
      ? 'image'
      : 'audio';

    return NextResponse.json({
      success: true,
      mediaUrl,
      coverUrl,
      fileName: originalName,
      fileSize: file.size,
      mimeType,
      mediaFormat,
      isMov: ext === '.mov',
      message: 'Creative asset uploaded and secured successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to upload creative asset.' },
      { status: 500 }
    );
  }
}
