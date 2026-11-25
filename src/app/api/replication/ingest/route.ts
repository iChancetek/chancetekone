import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../../firebaseAdmin.js';
import {
  applyCatalogOps,
  canUseFirebaseAdmin,
  readCatalogSnapshot,
} from '@/lib/server/catalogStore';
import {
  CatalogCollection,
  CatalogOp,
  encodeDocId,
  firestoreCollectionName,
} from '@/lib/catalog/cloudShared';
import { normalizeAlbumKey } from '@/lib/music/canonicalCatalogData';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
};

/**
 * Supports a single key or comma-separated keys for zero-downtime rotation:
 *   EIGHT_OF_SPADES_API_KEY=<replication-api-key>
 *   8ofspadesworks_API_KEYS=<key1>,<key2>
 */
function getAllowedApiKeys(): string[] {
  const raw =
    process.env.EIGHT_OF_SPADES_API_KEY ||
    process.env['8ofspadesworks_API_KEYS'] ||
    '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function safeKeyEquals(candidate: string, allowed: string): boolean {
  if (!candidate || !allowed) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(allowed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: NextRequest): boolean {
  const allowedKeys = getAllowedApiKeys();
  if (allowedKeys.length === 0) return false;
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerKey = (req.headers.get('x-api-key') || '').trim();

  return allowedKeys.some(
    (allowed) => safeKeyEquals(bearer, allowed) || safeKeyEquals(headerKey, allowed)
  );
}

type ReplicationArea = 'music' | 'audiobooks' | 'podcasts' | 'videos';

interface TargetMapping {
  catalogCollection: CatalogCollection;
  targetArea: ReplicationArea;
  tombstonePrefix: 'track' | 'audiobook' | 'podcast' | 'video';
}

function resolveTargetMapping(mediaType?: unknown, targetArea?: unknown): TargetMapping {
  const raw = String(mediaType || targetArea || 'music').trim().toLowerCase();
  if (raw === 'audiobook' || raw === 'audiobooks') {
    return {
      catalogCollection: 'audiobooks',
      targetArea: 'audiobooks',
      tombstonePrefix: 'audiobook',
    };
  }
  if (raw === 'podcast' || raw === 'podcasts') {
    return {
      catalogCollection: 'podcasts',
      targetArea: 'podcasts',
      tombstonePrefix: 'podcast',
    };
  }
  if (raw === 'video' || raw === 'videos') {
    return {
      catalogCollection: 'videos',
      targetArea: 'videos',
      tombstonePrefix: 'video',
    };
  }
  return {
    catalogCollection: 'tracks',
    targetArea: 'music',
    tombstonePrefix: 'track',
  };
}

function parseDurationSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((p) => Number(p));
      if (parts.every((n) => Number.isFinite(n) && n >= 0)) {
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return 0;
}

function slugifyId(prefix: string, raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${prefix}-${slug || 'chancetek'}`;
}

function inferReleaseYear(uploadedAt: string, explicitYear?: unknown): number {
  const parsedExplicit = Number(explicitYear);
  if (Number.isFinite(parsedExplicit) && parsedExplicit >= 1900 && parsedExplicit <= 2100) {
    return Math.round(parsedExplicit);
  }
  const ts = Date.parse(uploadedAt);
  if (!Number.isNaN(ts)) {
    return new Date(ts).getUTCFullYear();
  }
  return new Date().getUTCFullYear();
}

function buildCatalogRecord(params: {
  item: Record<string, any>;
  mapping: TargetMapping;
  replicatedAt?: string;
  runId?: string;
  now: string;
}): Record<string, any> {
  const { item, mapping, replicatedAt, runId, now } = params;
  const id = String(item.id).trim();
  const title = String(item.title).trim();
  const uploadedAt = String(item.uploadedAt || item.createdAt || replicatedAt || now);
  const duration = parseDurationSeconds(item.duration);
  const artistName = String(
    item.artistName || item.author || item.host || item.creator || 'ChanceTEK One'
  ).trim();
  const albumTitle = String(item.albumTitle || item.album || '').trim();
  const description = String(item.description || '').trim();
  const releaseYear = inferReleaseYear(uploadedAt, item.releaseYear);

  const replicationMeta = {
    sourcePlatform: '8ofspadesworks',
    targetArea: mapping.targetArea,
    replicationRunId: runId ? String(runId) : null,
    replicatedAt: replicatedAt ? String(replicatedAt) : now,
    uploadedAt,
    updatedAt: now,
  };

  if (mapping.catalogCollection === 'audiobooks') {
    const audioUrl = item.audioUrl || item.streamUrl || '';
    const rawChapters = Array.isArray(item.chapters) ? item.chapters : [];
    const normalizedChapters =
      rawChapters.length > 0
        ? rawChapters.map((ch: any, idx: number) => ({
          id: String(ch?.id || `${id}-ch-${idx + 1}`),
          chapterIndex: Number(ch?.chapterIndex || idx + 1),
          title: String(ch?.title || `Chapter ${idx + 1}`),
          duration: parseDurationSeconds(ch?.duration),
          audioUrl: String(ch?.audioUrl || ch?.streamUrl || audioUrl || ''),
          ...(ch?.pdfUrl ? { pdfUrl: String(ch.pdfUrl) } : {}),
        }))
        : audioUrl
          ? [
            {
              id: `${id}-ch-1`,
              chapterIndex: 1,
              title,
              duration,
              audioUrl: String(audioUrl),
              ...(item.pdfUrl ? { pdfUrl: String(item.pdfUrl) } : {}),
            },
          ]
          : [];

    const coverUrl = String(
      item.coverUrl || item.thumbnailUrl || '/images/genres/literature.jpg'
    );

    return {
      id,
      title,
      author: String(item.author || artistName),
      narrator: String(item.narrator || item.author || artistName),
      coverUrl,
      thumbnailUrl: String(item.thumbnailUrl || coverUrl),
      duration,
      genre: String(item.genre || 'Audiobook'),
      description,
      chapters: normalizedChapters,
      audioUrl: audioUrl || null,
      videoUrl: item.videoUrl || null,
      streamUrl: item.streamUrl || audioUrl || item.videoUrl || null,
      ...(item.pdfUrl ? { pdfUrl: String(item.pdfUrl) } : {}),
      mediaFormat:
        item.mediaFormat || (item.videoUrl ? 'video' : item.pdfUrl ? 'pdf' : 'audio'),
      likeCount: Number(item.likeCount || 0),
      rating: Number(item.rating || 5.0),
      releaseYear,
      ...replicationMeta,
    };
  }

  if (mapping.catalogCollection === 'podcasts') {
    const mediaUrl = String(
      item.mediaUrl || item.streamUrl || item.audioUrl || item.videoUrl || ''
    );
    const isVideo =
      item.mediaType === 'video' ||
      Boolean(item.videoUrl) ||
      /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);
    const coverUrl = String(
      item.coverUrl || item.thumbnailUrl || '/images/genres/podcast.jpg'
    );

    return {
      id,
      title,
      showTitle: String(item.showTitle || albumTitle || 'Featured Podcast'),
      host: String(item.host || artistName),
      description,
      mediaUrl,
      mediaType: isVideo ? 'video' : 'audio',
      audioUrl: item.audioUrl || (!isVideo ? mediaUrl || null : null),
      videoUrl: item.videoUrl || (isVideo ? mediaUrl || null : null),
      streamUrl: mediaUrl || null,
      coverUrl,
      thumbnailUrl: String(item.thumbnailUrl || coverUrl),
      duration,
      releaseDate: String(item.releaseDate || uploadedAt.slice(0, 10)),
      category: String(item.category || item.genre || 'Culture & Tech'),
      playCount: Number(item.playCount || 0),
      likeCount: Number(item.likeCount || 0),
      ...replicationMeta,
    };
  }

  if (mapping.catalogCollection === 'videos') {
    const videoUrl = String(item.videoUrl || item.streamUrl || '');
    const thumbnailUrl = String(
      item.thumbnailUrl || item.coverUrl || '/images/genres/cinema.jpg'
    );

    return {
      id,
      title,
      artistId: String(item.artistId || slugifyId('artist', artistName)),
      artistName,
      videoUrl,
      streamUrl: videoUrl || null,
      thumbnailUrl,
      coverUrl: String(item.coverUrl || thumbnailUrl),
      duration,
      views: Number(item.views || item.playCount || 0),
      likeCount: Number(item.likeCount || 0),
      dislikeCount: Number(item.dislikeCount || 0),
      commentCount: Number(item.commentCount || 0),
      description,
      category: String(item.category || item.genre || 'Visual Production'),
      releaseDate: String(item.releaseDate || uploadedAt.slice(0, 10)),
      ...replicationMeta,
    };
  }

  // Default: Music Track → ChanceTEKOne Music Area (`catalog_tracks`)
  const audioUrl = String(item.audioUrl || item.streamUrl || '');
  const coverUrl = String(
    item.coverUrl || item.thumbnailUrl || '/images/genres/rnb-neo-soul.jpg'
  );
  const hasExplicitCover = Boolean(item.coverUrl || item.thumbnailUrl);

  return {
    id,
    title,
    artistId: String(item.artistId || slugifyId('artist', artistName)),
    artistName,
    ...(albumTitle
      ? {
        albumId: String(item.albumId || slugifyId('album', `${artistName}-${albumTitle}`)),
        albumTitle,
      }
      : { albumTitle: 'Singles' }),
    genre: String(item.genre || 'R&B / Neo-Soul'),
    duration,
    audioUrl,
    streamUrl: audioUrl || null,
    coverUrl,
    thumbnailUrl: String(item.thumbnailUrl || coverUrl),
    description,
    releaseYear,
    playCount: Number(item.playCount || 0),
    likeCount: Number(item.likeCount || 0),
    dislikeCount: Number(item.dislikeCount || 0),
    commentCount: Number(item.commentCount || 0),
    ...(item.bpm ? { bpm: Number(item.bpm) } : {}),
    ...(item.producer ? { producer: String(item.producer) } : {}),
    ...(item.crateId ? { crateId: String(item.crateId) } : {}),
    ...(item.crateName ? { crateName: String(item.crateName) } : {}),
    ...(item.trackNumber ? { trackNumber: Number(item.trackNumber) } : {}),
    ...(hasExplicitCover ? { customCover: true, coverVerification: 'verified' } : {}),
    audioStatus: 'verified',
    ...replicationMeta,
  };
}

async function checkExistingItem(
  catalogCollection: CatalogCollection,
  itemId: string
): Promise<boolean> {
  // 1. Direct strongly-consistent Firestore check when Firebase Admin is available
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const snap = await adminDb
        .collection(firestoreCollectionName(catalogCollection))
        .doc(encodeDocId(itemId))
        .get();
      if (snap.exists) return true;
    } catch {
      // Fall through to catalog snapshot check
    }
  }

  // 2. Check unified catalog snapshot (covers local snapshot and cloud cache)
  try {
    const snapshot = await readCatalogSnapshot();
    const list = snapshot.collections[catalogCollection] || [];
    if (list.some((d) => String(d.id) === itemId)) {
      return true;
    }
  } catch {
    // Ignore read errors and allow write attempt
  }

  return false;
}

// 1. Health check used by "Test Connection" on 8 Of Spades Works
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized API key' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      platform: 'ChanceTEKOne.us',
      areas: ['music', 'audiobooks', 'podcasts', 'videos'],
      ready: true,
      timestamp: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS }
  );
}

// 2. Receive replicated Music, Audiobooks, Podcasts & Videos (Recent -> Oldest)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized API key' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = await req.json();
    const {
      mediaType,
      targetArea,
      overrideDuplicates,
      item,
      replicatedAt,
      runId,
    } = body || {};

    if (!item?.id || !item?.title) {
      return NextResponse.json(
        { ok: false, error: 'Missing item id or title' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const itemId = String(item.id).trim();
    const mapping = resolveTargetMapping(mediaType, targetArea);
    const displayArea = String(targetArea || mapping.targetArea);

    const exists = await checkExistingItem(mapping.catalogCollection, itemId);

    // Duplicate check — respects the "Override Duplicate Music" toggle
    if (exists && !overrideDuplicates) {
      return NextResponse.json(
        {
          ok: true,
          status: 'skipped_duplicate',
          skipped: true,
          id: itemId,
          targetArea: displayArea,
          message: `Skipped duplicate "${item.title}" in ChanceTEKOne ${displayArea}`,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const now = new Date().toISOString();
    const record = buildCatalogRecord({
      item,
      mapping,
      replicatedAt,
      runId,
      now,
    });

    const ops: CatalogOp[] = [
      {
        collection: mapping.catalogCollection,
        op: 'set',
        id: itemId,
        data: record,
      },
      // Lift any prior deletion tombstone so re-replicated items appear immediately
      {
        collection: 'removed',
        op: 'delete',
        id: `${mapping.tombstonePrefix}:${itemId}`,
      },
    ];

    if (mapping.catalogCollection === 'tracks') {
      const titleKey = normalizeAlbumKey(record.title);
      const artistKey = normalizeAlbumKey(record.artistName);
      if (titleKey) {
        ops.push(
          { collection: 'removed', op: 'delete', id: `track:${titleKey}` },
          { collection: 'removed', op: 'delete', id: `track:title:${titleKey}` }
        );
        if (artistKey) {
          ops.push({
            collection: 'removed',
            op: 'delete',
            id: `track:key:${titleKey}:::${artistKey}`,
          });
        }
      }
    } else {
      const rawTitleKey = `title:${String(record.title || '').toLowerCase().trim()}`;
      ops.push({
        collection: 'removed',
        op: 'delete',
        id: `${mapping.tombstonePrefix}:${rawTitleKey}`,
      });
    }

    const result = await applyCatalogOps(ops, 'replication:8ofspadesworks');

    return NextResponse.json(
      {
        ok: true,
        status: exists ? 'overwritten' : 'replicated',
        overwritten: exists,
        id: itemId,
        targetArea: displayArea,
        collection: firestoreCollectionName(mapping.catalogCollection),
        revision: result.revision,
        message: exists
          ? `Overwrote "${item.title}" in ChanceTEKOne ${displayArea}`
          : `Replicated "${item.title}" to ChanceTEKOne ${displayArea}`,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to ingest replicated content' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

