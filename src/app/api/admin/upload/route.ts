import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadCatalogAsset, CatalogAssetKind, invalidateCatalogSnapshotCache } from '@/lib/server/catalogStore';
import { sha256Hex, validateUploadBytes, writeAssetExclusive } from '@/lib/server/audioAssetStore';
import { buildUniqueAudioFileName, logAudioDiag } from '@/lib/music/audioAssetIntegrity';

interface PersistedAsset {
  url: string;
  path: string;
  sha256: string;
  sizeBytes: number;
  backend: 'firebase' | 'disk';
  deduplicated: boolean;
}

/**
 * Persists an uploaded asset. Production: Firebase Storage only (durable + shared across
 * instances/users). Development: falls back to public/ on local disk if Storage is unreachable.
 *
 * The returned reference is only ever a location that was written AND read back successfully.
 * If neither backend can durably store the bytes this THROWS — it never hands back a URL for a file
 * that does not exist (a dangling URL on a song record is how the wrong audio ended up being served).
 */
async function persistAsset(args: {
  buffer: Buffer;
  kind: CatalogAssetKind;
  fileName: string;
  contentType: string;
  ownerId?: string;
  diskDir: string;
  diskUrlPrefix: string;
}): Promise<PersistedAsset> {
  try {
    const res = await uploadCatalogAsset({
      buffer: args.buffer,
      kind: args.kind,
      fileName: args.fileName,
      contentType: args.contentType,
      ownerId: args.ownerId,
    });
    return { ...res, backend: 'firebase', deduplicated: false };
  } catch (err) {
    if (
      Boolean(process.env.K_SERVICE) &&
      (args.kind === 'audio' || args.kind === 'video' || args.kind === 'document')
    ) {
      console.error(`[Upload API] Firebase Storage ${args.kind} write failed in production:`, err);
      throw err;
    }
    console.warn('[Upload API] Firebase Storage asset write fallback to disk:', err);
  }

  try {
    const written = await writeAssetExclusive({
      dir: args.diskDir,
      fileName: args.fileName,
      urlPrefix: args.diskUrlPrefix,
      buffer: args.buffer,
    });
    return { ...written, backend: 'disk' };
  } catch (diskErr: any) {
    // Audio names are content-addressed: a collision with different bytes is a real conflict → fail.
    // Non-audio assets (artwork) only need *a* unique name, so retry once with a random suffix.
    if (args.kind !== 'audio' && /collision/i.test(String(diskErr?.message))) {
      const ext = path.extname(args.fileName);
      const retryName = `${path.basename(args.fileName, ext)}_${randomUUID().slice(0, 6)}${ext}`;
      const written = await writeAssetExclusive({
        dir: args.diskDir,
        fileName: retryName,
        urlPrefix: args.diskUrlPrefix,
        buffer: args.buffer,
      });
      return { ...written, backend: 'disk' };
    }
    console.error('[Upload API] Disk write failed — nothing was stored:', diskErr);
    throw diskErr;
  }
}


/** Artwork is secondary to audio: a failed cover write must not fail (or orphan) the audio upload. */
async function persistCover(args: Parameters<typeof persistAsset>[0]): Promise<string | undefined> {
  try {
    return (await persistAsset(args)).url;
  } catch (err) {
    console.warn('[Upload API] Cover art could not be stored; continuing without it:', err);
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    message: 'Mass upload service ready. Max batch limit: 1,000 MP3 files.',
    serverTimestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  const contentType = request.headers.get('content-type') || '';

  // 1. Handle Multipart File Upload (Audio MP3 or Companion Cover Art)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const companionCover = formData.get('cover') as File | null;
      const base64Cover = formData.get('coverData') as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No audio or image file provided in request.' },
          { status: 400 }
        );
      }

      const originalName = file.name || 'uploaded_track.mp3';
      const cleanBase = originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const ext = (path.extname(originalName) || '.mp3').toLowerCase();
      const isImage = ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || file.type.startsWith('image/');

      const coversDir = path.join(process.cwd(), 'public', 'images', 'covers');

      // Handle direct Cover Art Image upload
      if (isImage) {
        const uniqueImageName = `cover_${Date.now()}_${cleanBase}${ext}`;
        const arrayBuffer = await file.arrayBuffer();

        const coverUrl = await persistCover({
          buffer: Buffer.from(arrayBuffer),
          kind: 'cover',
          fileName: uniqueImageName,
          contentType: file.type || 'image/jpeg',
          ownerId: cleanBase,
          diskDir: coversDir,
          diskUrlPrefix: '/images/covers',
        });
        if (!coverUrl) {
          return NextResponse.json({ success: false, error: 'Cover art could not be stored.' }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          coverUrl,
          fileName: uniqueImageName,
          originalName,
          sizeBytes: file.size,
          mimeType: file.type || 'image/jpeg',
          uploadedBy: auth.email,
          serverTimestamp: new Date().toISOString(),
        });
      }

      // Determine destination directory: document (.pdf), video (.mp4, .mov), or audio (.mp3)
      const mediaType = (formData.get('mediaType') as string) || (formData.get('type') as string) || '';
      const isPdf = ext === '.pdf' || file.type === 'application/pdf';
      const isVideoFile = ext === '.mov' || ext === '.mp4' || file.type.startsWith('video/');
      const isVideoEntity = mediaType === 'video';
      const isVideo = !isPdf && (isVideoEntity || isVideoFile);

      let targetDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
      let mediaUrlPrefix = '/audio/uploads';
      let assetKind: CatalogAssetKind = 'audio';

      if (isPdf) {
        targetDir = path.join(process.cwd(), 'public', 'documents');
        mediaUrlPrefix = '/documents';
        assetKind = 'document';
      } else if (isVideo) {
        targetDir = path.join(process.cwd(), 'public', 'videos');
        mediaUrlPrefix = '/videos';
        assetKind = 'video';
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate the REAL bytes (signature, non-empty) — never the filename / declared MIME.
      let validated = validateUploadBytes(buffer, assetKind === 'document' ? 'document' : assetKind === 'video' ? 'video' : 'audio');
      if (!validated.ok && assetKind === 'video') {
        // Audio-only entries can arrive through the video catalog (e.g. an MP3 attached to a video record).
        const asAudio = validateUploadBytes(buffer, 'audio');
        if (asAudio.ok) validated = asAudio;
      }
      if (!validated.ok) {
        logAudioDiag({ stage: 'upload_failed', status: 'rejected', detail: validated.reason });
        return NextResponse.json({ success: false, error: validated.reason }, { status: 415 });
      }

      // Idempotency / identity: the caller-supplied uploadId (the stable id of the upload item) binds this
      // object to exactly one submission. Without one we mint a random id.
      const rawUploadId = ((formData.get('uploadId') as string) || '').trim();
      const uploadId = /^[A-Za-z0-9\-]{1,64}$/.test(rawUploadId) ? rawUploadId : `u-${randomUUID()}`;
      const sha256 = sha256Hex(buffer);

      // The stored extension follows the detected container, not the (possibly wrong) declared one.
      const storedExt = validated.kind === 'audio' || assetKind === 'document' ? validated.ext : ext;
      const uniqueFileName = buildUniqueAudioFileName({ uploadId, sha256, originalName: cleanBase || 'track', ext: storedExt });
      const contentType = validated.mime;
      logAudioDiag({ stage: 'upload_start', uploadId, status: assetKind, sha256, detail: `${buffer.length} bytes` });

      let persisted: PersistedAsset;
      try {
        persisted = await persistAsset({
          buffer,
          kind: assetKind,
          fileName: uniqueFileName,
          contentType,
          ownerId: uploadId,
          diskDir: targetDir,
          diskUrlPrefix: mediaUrlPrefix,
        });
      } catch (storeErr: any) {
        logAudioDiag({ stage: 'upload_failed', uploadId, sha256, status: 'storage_error', detail: String(storeErr?.message || storeErr) });
        return NextResponse.json(
          { success: false, error: `The file could not be stored durably: ${storeErr?.message || 'storage error'}` },
          { status: 500 }
        );
      }
      const mediaUrl = persisted.url;
      logAudioDiag({ stage: 'upload_complete', uploadId, sha256, assetKey: persisted.url, source: persisted.backend, status: persisted.deduplicated ? 'deduplicated' : 'verified' });

      let coverUrl: string | undefined;

      // Check for companion cover in form data
      if (companionCover) {
        const coverExt = path.extname(companionCover.name) || '.jpg';
        const coverFileName = `cover_${Date.now()}_${cleanBase}${coverExt}`;
        const coverBuf = Buffer.from(await companionCover.arrayBuffer());
        coverUrl = await persistCover({
          buffer: coverBuf,
          kind: 'cover',
          fileName: coverFileName,
          contentType: companionCover.type || 'image/jpeg',
          ownerId: cleanBase,
          diskDir: coversDir,
          diskUrlPrefix: '/images/covers',
        });
      } else if (base64Cover && base64Cover.includes('base64,')) {
        const dataPart = base64Cover.split('base64,')[1];
        const coverBuf = Buffer.from(dataPart, 'base64');
        const isJpeg = coverBuf.length >= 100 && coverBuf[0] === 0xff && coverBuf[1] === 0xd8;
        const isPng = coverBuf.length >= 100 && coverBuf[0] === 0x89 && coverBuf[1] === 0x50 && coverBuf[2] === 0x4e && coverBuf[3] === 0x47;
        const isWebp = coverBuf.length >= 100 && coverBuf.subarray(0, 4).toString() === 'RIFF' && coverBuf.subarray(8, 12).toString() === 'WEBP';
        const isGif = coverBuf.length >= 100 && coverBuf.subarray(0, 4).toString().startsWith('GIF8');
        const isValid = isJpeg || isPng || isWebp || isGif;

        if (isValid) {
          const isImagePng = isPng;
          const isImageWebp = isWebp;
          const isImageGif = isGif;
          const extName = isImagePng ? '.png' : isImageWebp ? '.webp' : isImageGif ? '.gif' : '.jpg';
          const mime = isImagePng ? 'image/png' : isImageWebp ? 'image/webp' : isImageGif ? 'image/gif' : 'image/jpeg';
          const coverFileName = `cover_${Date.now()}_${cleanBase}${extName}`;
          coverUrl = await persistCover({
            buffer: coverBuf,
            kind: 'cover',
            fileName: coverFileName,
            contentType: mime,
            ownerId: cleanBase,
            diskDir: coversDir,
            diskUrlPrefix: '/images/covers',
          });
        }
      }

      if (!coverUrl && ext === '.mp3') {
        // Server-side embedded APIC extraction fallback from MP3 buffer (cleanly bounded)
        try {
          const searchSlice = buffer.subarray(0, Math.min(buffer.length, 4 * 1024 * 1024));
          const apicIdx = searchSlice.indexOf('APIC');
          const picIdx = searchSlice.indexOf('PIC');
          const targetStart = apicIdx !== -1 ? apicIdx : picIdx;

          if (targetStart !== -1) {
            const apicSlice = searchSlice.subarray(targetStart);
            let imgOffset = -1;
            let imgExt = '.jpg';

            const jpegMarker = Buffer.from([0xff, 0xd8]);
            const pngMarker = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

            const jIdx = apicSlice.indexOf(jpegMarker);
            const pIdx = apicSlice.indexOf(pngMarker);

            if (jIdx !== -1 && jIdx < 4096) {
              imgOffset = jIdx;
              imgExt = '.jpg';
            } else if (pIdx !== -1 && pIdx < 4096) {
              imgOffset = pIdx;
              imgExt = '.png';
            }

            if (imgOffset !== -1) {
              let cleanImgData: Buffer | null = null;
              if (imgExt === '.jpg') {
                for (let k = apicSlice.length - 2; k >= imgOffset + 100; k--) {
                  if (apicSlice[k] === 0xff && apicSlice[k + 1] === 0xd9) {
                    cleanImgData = apicSlice.subarray(imgOffset, k + 2);
                    break;
                  }
                }
                if (!cleanImgData) {
                  cleanImgData = apicSlice.subarray(imgOffset, Math.min(apicSlice.length, imgOffset + 2 * 1024 * 1024));
                }
              } else if (imgExt === '.png') {
                const iendIdx = apicSlice.indexOf(Buffer.from('IEND'), imgOffset);
                if (iendIdx !== -1 && iendIdx + 8 <= apicSlice.length) {
                  cleanImgData = apicSlice.subarray(imgOffset, iendIdx + 8);
                }
              }

              if (cleanImgData && cleanImgData.length >= 100) {
                const coverFileName = `cover_${Date.now()}_${cleanBase}${imgExt}`;
                coverUrl = await persistCover({
                  buffer: cleanImgData,
                  kind: 'cover',
                  fileName: coverFileName,
                  contentType: imgExt === '.png' ? 'image/png' : 'image/jpeg',
                  ownerId: cleanBase,
                  diskDir: coversDir,
                  diskUrlPrefix: '/images/covers',
                });
              }
            }
          }
        } catch (apicErr) {
          console.warn('[Upload API APIC extraction notice]', apicErr);
        }
      }

      invalidateCatalogSnapshotCache();

      return NextResponse.json({
        success: true,
        mediaUrl,
        audioUrl: mediaUrl,
        videoUrl: mediaUrl,
        pdfUrl: isPdf ? mediaUrl : undefined,
        coverUrl,
        fileName: uniqueFileName,
        originalName,
        sizeBytes: buffer.length,
        mimeType: contentType,
        uploadedBy: auth.email,
        serverTimestamp: new Date().toISOString(),
        // Authoritative, verified description of the stored object. The song record keeps this so its
        // audio can always be traced to (and proven identical to) the exact bytes that were uploaded.
        audioAsset: {
          assetId: `${persisted.backend}:${persisted.path}`,
          storagePath: persisted.path,
          storageBackend: persisted.backend,
          sha256: persisted.sha256,
          sizeBytes: persisted.sizeBytes,
          mimeType: contentType,
          uploadId,
          version: 1,
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('[Upload API Multipart Error]', err);
      return NextResponse.json(
        { success: false, error: err.message || 'File processing failed' },
        { status: 500 }
      );
    }
  }

  // 2. Handle JSON metadata or batch action requests
  try {
    const body = await request.json();
    const { action, batchId, data } = body;

    return NextResponse.json({
      success: true,
      action: action || 'status_check',
      batchId,
      processedBy: auth.email,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Upload API error' },
      { status: 500 }
    );
  }
}
