import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { auditAudioAssociations, getAudioDiagnostics, logAudioDiag } from '@/lib/music/audioAssetIntegrity';
import { hashFileCached, resolveFileInside } from '@/lib/server/audioAssetStore';
import { readCatalogSnapshot, applyCatalogOps } from '@/lib/server/catalogStore';
import { PLATFORM_CANONICAL_TRACKS } from '@/lib/music/MusicCatalogService';

export const dynamic = 'force-dynamic';

const UPLOADS_DIR = () => path.join(process.cwd(), 'public', 'audio', 'uploads');

async function scanPhysicalUploads(): Promise<{
  files: Set<string>;
  hashes: Record<string, string>;
  inventory: Array<{ fileName: string; sizeBytes: number; sha256: string }>;
}> {
  const dir = UPLOADS_DIR();
  const files = new Set<string>();
  const hashes: Record<string, string> = {};
  const inventory: Array<{ fileName: string; sizeBytes: number; sha256: string }> = [];

  if (!fs.existsSync(dir)) return { files, hashes, inventory };

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const lower = ent.name.toLowerCase();
    if (!/\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i.test(lower)) continue;
    files.add(lower);
    try {
      const fullPath = path.join(dir, ent.name);
      const { sha256, size } = await hashFileCached(fullPath);
      hashes[lower] = sha256;
      inventory.push({ fileName: ent.name, sizeBytes: size, sha256 });
    } catch {
      /* unreadable file */
    }
  }
  return { files, hashes, inventory };
}

/**
 * GET /api/admin/audio-integrity
 * Admin-only diagnostic endpoint that audits the catalog against physical storage and returns:
 *   - findings (missing assets, cross-artist filenames, shared assets across different songs/artists)
 *   - physical upload inventory with SHA-256 checksums
 *   - structured audio diagnostic ring buffer
 */
export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { files, hashes, inventory } = await scanPhysicalUploads();

    let cloudTracks: any[] = [];
    try {
      const snap = await readCatalogSnapshot();
      cloudTracks = snap.collections.tracks || [];
    } catch {
      /* Firestore unavailable in offline dev — fall back to canonical tracks */
    }

    const trackMap = new Map<string, any>();
    for (const c of PLATFORM_CANONICAL_TRACKS) trackMap.set(c.id, c);
    for (const t of cloudTracks) if (t?.id) trackMap.set(t.id, t);

    const report = auditAudioAssociations(Array.from(trackMap.values()), {
      existingUploadFiles: files,
      uploadFileHashes: hashes,
    });

    return NextResponse.json({
      success: true,
      auditedBy: auth.email,
      timestamp: new Date().toISOString(),
      summary: report.summary,
      findings: report.findings,
      storageInventoryCount: inventory.length,
      storageInventory: inventory,
      recentDiagnostics: getAudioDiagnostics().slice(-50),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Audio integrity audit failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/audio-integrity
 * Controlled administrative repair workflow:
 *   - action: 'flag_for_review' | 'relink_asset'
 *   - Preserves original record metadata, verifies target storage existence before relinking,
 *     and records an audit event. Never guesses a replacement by artist or title.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { action, trackId, newAudioUrl, note } = body || {};

    if (!trackId || typeof trackId !== 'string') {
      return NextResponse.json({ success: false, error: 'trackId is required.' }, { status: 400 });
    }

    if (action === 'relink_asset') {
      if (!newAudioUrl || typeof newAudioUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'newAudioUrl is required for relink_asset.' }, { status: 400 });
      }
      // If pointing to /audio/uploads/<file>, verify the physical file exists and compute its SHA-256.
      let verifiedAsset: any = undefined;
      if (newAudioUrl.startsWith('/audio/uploads/')) {
        const fileName = newAudioUrl.slice('/audio/uploads/'.length).split('?')[0];
        const resolved = resolveFileInside(UPLOADS_DIR(), fileName);
        if (!resolved) {
          return NextResponse.json(
            { success: false, error: `Target audio file "${fileName}" does not exist in storage.` },
            { status: 404 }
          );
        }
        const { sha256, size } = await hashFileCached(resolved);
        verifiedAsset = {
          assetId: `disk:${fileName}`,
          storagePath: fileName,
          storageBackend: 'disk',
          sha256,
          sizeBytes: size,
          mimeType: 'audio/mpeg',
          version: 1,
          verifiedAt: new Date().toISOString(),
        };
      }

      logAudioDiag({
        stage: 'repair',
        trackId,
        assetKey: newAudioUrl,
        sha256: verifiedAsset?.sha256,
        status: 'relinked',
        detail: `by ${auth.email}`,
      });

      try {
        const snap = await readCatalogSnapshot();
        const existing = (snap.collections.tracks || []).find((t: any) => t.id === trackId);
        if (existing) {
          await applyCatalogOps(
            [
              {
                collection: 'tracks',
                op: 'set',
                id: trackId,
                data: {
                  ...existing,
                  audioUrl: newAudioUrl,
                  audioAsset: verifiedAsset || existing.audioAsset,
                  audioStatus: verifiedAsset ? 'verified' : 'legacy',
                  audioReviewNote: undefined,
                },
              },
            ],
            auth.email || 'admin'
          );
        }
      } catch {
        /* local/offline mode — client catalog applies update */
      }

      return NextResponse.json({
        success: true,
        action: 'relink_asset',
        trackId,
        audioUrl: newAudioUrl,
        audioAsset: verifiedAsset,
        repairedBy: auth.email,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'flag_for_review') {
      const reviewNote = typeof note === 'string' && note.trim() ? note.trim() : 'Flagged for administrator audio review';
      logAudioDiag({ stage: 'repair', trackId, status: 'flagged_for_review', detail: reviewNote });
      return NextResponse.json({
        success: true,
        action: 'flag_for_review',
        trackId,
        audioStatus: 'needs_review',
        audioReviewNote: reviewNote,
        flaggedBy: auth.email,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Repair action failed' }, { status: 500 });
  }
}

