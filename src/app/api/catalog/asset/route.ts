import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { CatalogAssetKind, uploadCatalogAsset, invalidateCatalogSnapshotCache } from '@/lib/server/catalogStore';
import { sha256Hex, validateUploadBytes, writeAssetExclusive } from '@/lib/server/audioAssetStore';
import { logAudioDiag, sanitizeFileSegment } from '@/lib/music/audioAssetIntegrity';

export const dynamic = 'force-dynamic';

const KINDS: CatalogAssetKind[] = ['audio', 'video', 'cover', 'document'];

/**
 * POST /api/catalog/asset  (multipart: file, kind, id?)
 * Admin-only. Stores audio/video/artwork in Firebase Storage and returns a durable URL
 * that every member can stream — unlike browser-local IndexedDB / blob: URLs.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const kindRaw = String(form.get('kind') || 'audio') as CatalogAssetKind;
    const ownerId = (form.get('id') as string | null) || undefined;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
    }
    if (!KINDS.includes(kindRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid asset kind.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fallbackType =
      kindRaw === 'cover' ? 'image/jpeg' : kindRaw === 'video' ? 'video/mp4' : 'audio/mpeg';

    // Validate the real bytes of media before anything is stored or associated with a record.
    let declaredType = file.type || fallbackType;
    if (kindRaw !== 'cover') {
      let validated = validateUploadBytes(buffer, kindRaw === 'document' ? 'document' : kindRaw === 'video' ? 'video' : 'audio');
      if (!validated.ok && kindRaw === 'video') {
        const asAudio = validateUploadBytes(buffer, 'audio'); // audio-only entries in the video catalog
        if (asAudio.ok) validated = asAudio;
      }
      if (!validated.ok) {
        logAudioDiag({ stage: 'upload_failed', uploadId: ownerId, status: 'rejected', detail: validated.reason });
        return NextResponse.json({ ok: false, error: validated.reason }, { status: 415 });
      }
      declaredType = validated.mime;
    }
    const sha256 = sha256Hex(buffer);

    let url: string;
    let pathStr: string;
    let backend: 'firebase' | 'disk' = 'firebase';
    try {
      const res = await uploadCatalogAsset({
        buffer,
        kind: kindRaw,
        fileName: file.name || `${kindRaw}.bin`,
        contentType: declaredType,
        ownerId,
      });
      url = res.url;
      pathStr = res.path;
    } catch (uploadErr) {
      // On serverless/container runtimes (Cloud Run / Firebase App Hosting), local disk is ephemeral
      // and invisible to other instances. Never hand back an ephemeral /audio/uploads/ disk URL for audio
      // in production — fail so the client retains its local reference and retries Firebase Storage.
      if (Boolean(process.env.K_SERVICE) && kindRaw === 'audio') {
        console.error('[Catalog Asset Upload] Firebase Storage write failed in production:', uploadErr);
        throw uploadErr;
      }
      console.warn('[Catalog Asset Upload] Firebase Storage write fallback to local disk:', uploadErr);
      const isCover = kindRaw === 'cover';
      const isVideo = kindRaw === 'video';
      const diskDir = isCover
        ? path.join(process.cwd(), 'public', 'images', 'covers')
        : isVideo
        ? path.join(process.cwd(), 'public', 'videos')
        : path.join(process.cwd(), 'public', 'audio', 'uploads');
      const urlPrefix = isCover ? '/images/covers' : isVideo ? '/videos' : '/audio/uploads';
      const ext = (path.extname(file.name || '') || (isCover ? '.jpg' : isVideo ? '.mp4' : '.mp3')).toLowerCase().replace(/[^a-z0-9.]/g, '');
      // Content-addressed + owner-bound name: unique per upload, idempotent on retry, never overwrites.
      const ownerSeg = (ownerId || 'asset').replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 48) || 'asset';
      const cleanFileName = `${ownerSeg}_${sha256.slice(0, 12)}_${sanitizeFileSegment(file.name || kindRaw)}${ext}`;

      const written = await writeAssetExclusive({ dir: diskDir, fileName: cleanFileName, urlPrefix, buffer });
      url = written.url;
      pathStr = written.path;
      backend = 'disk';
    }

    logAudioDiag({ stage: 'upload_complete', uploadId: ownerId, sha256, assetKey: url, source: backend, status: 'verified' });
    invalidateCatalogSnapshotCache();
    return NextResponse.json({
      ok: true,
      url,
      path: pathStr,
      sizeBytes: buffer.length,
      uploadedBy: auth.email,
      audioAsset: {
        assetId: `${backend}:${pathStr}`,
        storagePath: pathStr,
        storageBackend: backend,
        sha256,
        sizeBytes: buffer.length,
        mimeType: declaredType,
        uploadId: ownerId,
        version: 1,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Catalog Asset Upload]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Asset upload failed' },
      { status: 500 }
    );
  }
}
