/**
 * ChanceTEK One — Pure Server-Side Shared Media Metadata & Exact Cover Art Resolver
 *
 * 100% server-safe (ZERO browser/client-only service imports like MusicCatalogService).
 * Uses ultra-fast single-document Firestore reads (`readCatalogDocById`) with snapshot
 * fallback so SMS/iMessage, WhatsApp, Facebook, Messenger, X/Twitter, LinkedIn,
 * Telegram, and Famio.us crawlers ALWAYS receive the exact cover art of the shared
 * song, audiobook, podcast, or video.
 */

import fs from 'fs';
import path from 'path';
import { readCatalogDocById, readCatalogSnapshot } from '@/lib/server/catalogStore';
import { MOCK_ALBUMS, MOCK_AUDIOBOOKS, MOCK_TRACKS, MOCK_VIDEOS } from '@/lib/mockData';
import { SEED_PODCASTS } from '@/lib/media/seedMediaData';
import {
  PLATFORM_CANONICAL_TRACKS,
  getAuthenticCoverForTrack,
  getDefaultCoverForTrack,
  knownAlbumCover,
} from '@/lib/music/canonicalCatalogData';
import { Audiobook, PodcastEpisode, Track, Video } from '@/types/media';
import { resolveAuthenticVideoThumbnail } from '@/lib/media/videoThumbnailMap';

const PRODUCTION_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://chancetekone.us'
).replace(/\/+$/, '');

const SOURCE_PUBLIC_ORIGIN = (
  process.env.EIGHT_OF_SPADES_PUBLIC_URL || 'https://8ofspadesworks.us'
).replace(/\/+$/, '');

export interface ShareTrackHints {
  title?: string;
  artist?: string;
  cover?: string;
  origin?: string;
}

export interface ServerResolvedTrackShare {
  id: string;
  title: string;
  artist: string;
  albumTitle?: string;
  description: string;
  /** Raw cover source (could be /images/..., https://..., or data:image/...) */
  rawCover: string;
  /** Crawlable absolute HTTPS URL guaranteed to return image bytes for social/SMS bots (no query params!) */
  ogImageUrl: string;
  /** MIME type hint for og:image:type */
  ogImageType: string;
  /** Relative or absolute image URL suitable for client rendering */
  clientCoverUrl: string;
  /** Optional direct video URL for YouTube-style og:video tags on shared videos */
  videoUrl?: string;
  origin: string;
}

export function publicFileExists(relUrl: string): boolean {
  try {
    const cleanRel = decodeURIComponent(relUrl.split('?')[0].split('#')[0]).replace(/^\/+/, '');
    const publicRoot = path.resolve(process.cwd(), 'public');
    const fullPath = path.resolve(publicRoot, cleanRel);
    if (!fullPath.startsWith(publicRoot + path.sep) && fullPath !== publicRoot) return false;
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

export function inferImageMimeType(urlOrPath: string): string {
  const lower = String(urlOrPath || '').toLowerCase();
  if (lower.startsWith('data:image/png') || /\.png(\?|$)/i.test(lower)) return 'image/png';
  if (lower.startsWith('data:image/webp') || /\.webp(\?|$)/i.test(lower)) return 'image/webp';
  if (lower.startsWith('data:image/gif') || /\.gif(\?|$)/i.test(lower)) return 'image/gif';
  return 'image/jpeg';
}

export function normalizeExternalCoverOrigin(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // If a replicated/local URL points to an /images/... asset that physically exists in our own /public folder,
  // serve it directly from chancetekone.us (zero external hop, guaranteed 200 OK!).
  const originMatch = trimmed.match(
    /^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost|8ofspadesworks\.us|www\.8ofspadesworks\.us|chancetekone\.us|www\.chancetekone\.us)(:\d+)?(\/images\/[^?#]+.*)$/i
  );
  if (originMatch) {
    const relPath = originMatch[3];
    if (publicFileExists(relPath)) {
      return relPath;
    }
  }

  // Rewrite any internal Cloud Run / localhost origin to public source domain
  if (/^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(trimmed)) {
    return trimmed.replace(
      /^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?/i,
      SOURCE_PUBLIC_ORIGIN
    );
  }
  return trimmed;
}

export function isGenericOrInvalidTrackCover(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  if (
    !lower ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.startsWith('blob:') ||
    lower.startsWith('indexeddb:') ||
    lower.includes('chancetekone_banner.png') ||
    lower.includes('chancetek_banner.png') ||
    lower.includes('the_lounge_ambient.jpg') ||
    lower.includes('/images/logo') ||
    lower.endsWith('/logo.png') ||
    lower.includes('/images/studio_cover.jpg') ||
    lower.includes('/images/default-cover.jpg') ||
    lower.includes('cover_1792')
  ) {
    return true;
  }
  return false;
}

export function isGenreFallbackCover(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().toLowerCase().includes('/images/genres/');
}

function isSafeCoverParam(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/images/') && !trimmed.includes('..')) return true;
  if (trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeLookupKey(s?: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function safeResolveAuthenticCover(track: Partial<Track>): string {
  try {
    const fromAuthentic = getAuthenticCoverForTrack(
      track.artistName || '',
      track.albumTitle || '',
      track.title || ''
    );
    if (fromAuthentic && !isGenericOrInvalidTrackCover(fromAuthentic)) {
      return fromAuthentic;
    }
  } catch {}

  try {
    if (track.albumTitle || track.artistName) {
      const fromKnownAlbum = knownAlbumCover(
        track.artistName || '',
        track.albumTitle || '',
        track.title || ''
      );
      if (fromKnownAlbum && !isGenericOrInvalidTrackCover(fromKnownAlbum)) {
        return fromKnownAlbum;
      }
    }
  } catch {}

  try {
    return getDefaultCoverForTrack({
      genre: track.genre,
      crateId: track.crateId,
      artistName: track.artistName,
    });
  } catch {
    return '/images/genres/rnb-neo-soul.jpg';
  }
}

export async function findAuthoritativeTrack(rawId: string): Promise<{
  track: Partial<Track> | null;
  albumCover?: string;
}> {
  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {}

  let serverTrack: Partial<Track> | null = null;
  let albumCover: string | undefined;

  // 1. Fast O(1) direct Firestore document lookup (~40ms)
  try {
    const directDoc = (await readCatalogDocById('tracks', decodedId)) as Partial<Track> | null;
    if (directDoc) {
      serverTrack = directDoc;
      if (directDoc.albumId) {
        const directAlbum = (await readCatalogDocById('albums', directDoc.albumId)) as any;
        if (directAlbum?.coverUrl && !isGenericOrInvalidTrackCover(directAlbum.coverUrl)) {
          albumCover = normalizeExternalCoverOrigin(directAlbum.coverUrl);
        }
      }
    }
  } catch {}

  // 2. Snapshot fallback if direct ID didn't hit (e.g. case-insensitive / normalized ID lookup)
  if (!serverTrack) {
    try {
      const snapshot = await readCatalogSnapshot();
      const serverTracks = (snapshot.collections.tracks || []) as Partial<Track>[];
      const serverAlbums = (snapshot.collections.albums || []) as any[];

      serverTrack =
        serverTracks.find((t) => t.id === rawId || t.id === decodedId) ||
        serverTracks.find((t) => normalizeLookupKey(t.id) === normalizeLookupKey(decodedId)) ||
        null;

      if (serverTrack) {
        const matchingAlbum = serverAlbums.find(
          (a) =>
            (serverTrack?.albumId && a.id === serverTrack.albumId) ||
            (serverTrack?.albumTitle &&
              normalizeLookupKey(a.title) === normalizeLookupKey(serverTrack.albumTitle) &&
              normalizeLookupKey(a.artistName) === normalizeLookupKey(serverTrack.artistName))
        );
        if (matchingAlbum?.coverUrl && !isGenericOrInvalidTrackCover(matchingAlbum.coverUrl)) {
          albumCover = normalizeExternalCoverOrigin(matchingAlbum.coverUrl);
        }
      }
    } catch {
      // Continue gracefully to canonical/mock catalogs
    }
  }

  const canonicalTrack =
    PLATFORM_CANONICAL_TRACKS.find((t) => t.id === decodedId || t.id === rawId) ||
    MOCK_TRACKS.find((t) => t.id === decodedId || t.id === rawId) ||
    null;

  const merged: Partial<Track> | null =
    serverTrack || canonicalTrack
      ? {
          ...(canonicalTrack || {}),
          ...(serverTrack || {}),
        }
      : null;

  if (merged && !albumCover) {
    const mockAlb = MOCK_ALBUMS.find(
      (a) =>
        (merged.albumId && a.id === merged.albumId) ||
        (merged.albumTitle &&
          normalizeLookupKey(a.title) === normalizeLookupKey(merged.albumTitle) &&
          normalizeLookupKey(a.artistName) === normalizeLookupKey(merged.artistName))
    );
    if (mockAlb?.coverUrl && !isGenericOrInvalidTrackCover(mockAlb.coverUrl)) {
      albumCover = mockAlb.coverUrl;
    }
  }

  return { track: merged, albumCover };
}

function pickExactRawCover(
  track: Partial<Track> | null,
  albumCover: string | undefined,
  hintCover?: string
): string {
  const candidates: (string | undefined)[] = [];

  const trackCover = normalizeExternalCoverOrigin(track?.coverUrl || (track as any)?.thumbnailUrl);
  if (trackCover && !isGenericOrInvalidTrackCover(trackCover) && !isGenreFallbackCover(trackCover)) {
    candidates.push(trackCover);
  }

  const normHint = normalizeExternalCoverOrigin(hintCover);
  if (normHint && isSafeCoverParam(normHint) && !isGenericOrInvalidTrackCover(normHint) && !isGenreFallbackCover(normHint)) {
    candidates.push(normHint);
  }

  const normAlbumCover = normalizeExternalCoverOrigin(albumCover);
  if (normAlbumCover && !isGenericOrInvalidTrackCover(normAlbumCover) && !isGenreFallbackCover(normAlbumCover)) {
    candidates.push(normAlbumCover);
  }

  if (track && (track.title || track.artistName)) {
    const resolved = safeResolveAuthenticCover(track);
    if (resolved && !isGenericOrInvalidTrackCover(resolved) && !isGenreFallbackCover(resolved)) {
      candidates.push(resolved);
    }
  }

  for (const c of candidates) {
    if (!c) continue;
    if (c.startsWith('data:image/') || c.startsWith('https://')) {
      return c;
    }
    if (c.startsWith('/') && publicFileExists(c)) {
      return c;
    }
  }

  if (normHint && isSafeCoverParam(normHint) && !isGenericOrInvalidTrackCover(normHint)) {
    return normHint;
  }
  if (trackCover && !isGenericOrInvalidTrackCover(trackCover)) {
    return trackCover;
  }
  if (track && (track.title || track.artistName)) {
    const fallbackResolved = safeResolveAuthenticCover(track);
    if (fallbackResolved && !isGenericOrInvalidTrackCover(fallbackResolved)) {
      return fallbackResolved;
    }
  }

  return '/images/genres/rnb-neo-soul.jpg';
}

function buildOgImageResult(
  safeOrigin: string,
  rawCover: string,
  decodedId: string,
  kind: 'song' | 'audiobook' | 'podcast' | 'video'
): { ogImageUrl: string; ogImageType: string; clientCoverUrl: string } {
  const ogImageType = inferImageMimeType(rawCover);
  const ext = ogImageType === 'image/png' ? '.png' : ogImageType === 'image/webp' ? '.webp' : '.jpg';
  const prefix = kind === 'song' ? '' : `${kind}--`;

  // Clean static local image in /public -> serve directly from chancetekone.us/images/...
  if (rawCover.startsWith('/') && publicFileExists(rawCover)) {
    return {
      ogImageUrl: `${safeOrigin}${encodeURI(rawCover)}`,
      ogImageType,
      clientCoverUrl: rawCover,
    };
  }

  // Embedded base64 data URI OR remote HTTPS image (Firebase Storage, 8ofspadesworks.us, etc.)
  // -> serve via clean, query-less, extensioned /api/share/cover/<id>.jpg so EVERY crawler
  // (Facebook, Messenger, iMessage, WhatsApp, Famio.us, X, LinkedIn, Telegram) accepts it!
  if (rawCover.startsWith('data:image/') || rawCover.startsWith('https://') || rawCover.startsWith('http://')) {
    const apiPath = `/api/share/cover/${prefix}${encodeURIComponent(decodedId)}${ext}`;
    return {
      ogImageUrl: `${safeOrigin}${apiPath}`,
      ogImageType,
      clientCoverUrl: rawCover.startsWith('data:') ? apiPath : rawCover,
    };
  }

  const normalizedPath = rawCover.startsWith('/') ? rawCover : `/${rawCover}`;
  return {
    ogImageUrl: `${safeOrigin}${encodeURI(normalizedPath)}`,
    ogImageType,
    clientCoverUrl: normalizedPath,
  };
}

export async function lookupTrackForShareMetadata(
  id: string,
  hints: ShareTrackHints = {}
): Promise<ServerResolvedTrackShare> {
  const safeOrigin =
    hints.origin && /^https?:\/\/[^/\s]+$/i.test(hints.origin.trim())
      ? hints.origin.trim().replace(/\/+$/, '')
      : PRODUCTION_ORIGIN;

  let decodedId = id;
  try {
    decodedId = decodeURIComponent(id);
  } catch {}

  const { track, albumCover } = await findAuthoritativeTrack(decodedId);

  const title = (track?.title || hints.title || 'Featured Track').trim();
  const artist = (track?.artistName || hints.artist || 'ChanceTEK One').trim();
  const albumTitle = track?.albumTitle?.trim() || undefined;

  const description =
    (track?.lyrics && track.lyrics.replace(/\s+/g, ' ').trim().slice(0, 180)) ||
    `Listen to "${title}" by ${artist} on ChanceTEK One. High-fidelity streaming & authentic studio masters.`;

  const trackForArt: Partial<Track> = {
    ...(track || {}),
    id: decodedId,
    title,
    artistName: artist,
    albumTitle,
  };

  const rawCover = normalizeExternalCoverOrigin(
    pickExactRawCover(trackForArt, albumCover, hints.cover)
  );

  const { ogImageUrl, ogImageType, clientCoverUrl } = buildOgImageResult(
    safeOrigin,
    rawCover,
    decodedId,
    'song'
  );

  return {
    id: decodedId,
    title,
    artist,
    albumTitle,
    description,
    rawCover,
    ogImageUrl,
    ogImageType,
    clientCoverUrl,
    origin: safeOrigin,
  };
}

export async function lookupAudiobookForShareMetadata(
  rawId: string,
  hints: ShareTrackHints = {}
): Promise<ServerResolvedTrackShare> {
  const safeOrigin =
    hints.origin && /^https?:\/\/[^/\s]+$/i.test(hints.origin.trim())
      ? hints.origin.trim().replace(/\/+$/, '')
      : PRODUCTION_ORIGIN;

  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {}

  let serverAb: Partial<Audiobook> | null = null;
  try {
    serverAb = (await readCatalogDocById('audiobooks', decodedId)) as Partial<Audiobook> | null;
    if (!serverAb) {
      const snapshot = await readCatalogSnapshot();
      const list = (snapshot.collections.audiobooks || []) as Partial<Audiobook>[];
      serverAb =
        list.find((a) => a.id === rawId || a.id === decodedId) ||
        list.find((a) => normalizeLookupKey(a.id) === normalizeLookupKey(decodedId)) ||
        null;
    }
  } catch {}

  const mockAb =
    MOCK_AUDIOBOOKS.find((a) => a.id === rawId || a.id === decodedId) || null;
  const merged = serverAb || mockAb ? { ...(mockAb || {}), ...(serverAb || {}) } : null;

  const title = (merged?.title || hints.title || 'Featured Audiobook').trim();
  const artist = (merged?.author || merged?.narrator || hints.artist || 'ChanceTEK One').trim();
  const description =
    (merged?.description && merged.description.replace(/\s+/g, ' ').trim().slice(0, 180)) ||
    `Listen to "${title}" by ${artist} on ChanceTEK One — Spoken Literature & Audiobooks.`;

  const candidateCover = normalizeExternalCoverOrigin(
    (!isGenericOrInvalidTrackCover(merged?.coverUrl) ? merged?.coverUrl : '') ||
      (!isGenericOrInvalidTrackCover(hints.cover) ? hints.cover : '') ||
      '/images/audiobooks/famio.jpg'
  );

  const rawCover =
    candidateCover.startsWith('data:image/') ||
    candidateCover.startsWith('https://') ||
    (candidateCover.startsWith('/') && publicFileExists(candidateCover))
      ? candidateCover
      : '/images/audiobooks/famio.jpg';

  const { ogImageUrl, ogImageType, clientCoverUrl } = buildOgImageResult(
    safeOrigin,
    rawCover,
    decodedId,
    'audiobook'
  );

  return {
    id: decodedId,
    title,
    artist,
    description,
    rawCover,
    ogImageUrl,
    ogImageType,
    clientCoverUrl,
    origin: safeOrigin,
  };
}

export async function lookupPodcastForShareMetadata(
  rawId: string,
  hints: ShareTrackHints = {}
): Promise<ServerResolvedTrackShare> {
  const safeOrigin =
    hints.origin && /^https?:\/\/[^/\s]+$/i.test(hints.origin.trim())
      ? hints.origin.trim().replace(/\/+$/, '')
      : PRODUCTION_ORIGIN;

  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {}

  let serverPod: Partial<PodcastEpisode> | null = null;
  try {
    serverPod = (await readCatalogDocById('podcasts', decodedId)) as Partial<PodcastEpisode> | null;
    if (!serverPod) {
      const snapshot = await readCatalogSnapshot();
      const list = (snapshot.collections.podcasts || []) as Partial<PodcastEpisode>[];
      serverPod =
        list.find((p) => p.id === rawId || p.id === decodedId) ||
        list.find((p) => normalizeLookupKey(p.id) === normalizeLookupKey(decodedId)) ||
        null;
    }
  } catch {}

  const seedPod =
    SEED_PODCASTS.find((p) => p.id === rawId || p.id === decodedId) || null;
  const merged = serverPod || seedPod ? { ...(seedPod || {}), ...(serverPod || {}) } : null;

  const title = (merged?.title || hints.title || 'Featured Podcast').trim();
  const artist = (merged?.host || merged?.showTitle || hints.artist || 'ChanceTEK One').trim();
  const description =
    (merged?.description && merged.description.replace(/\s+/g, ' ').trim().slice(0, 180)) ||
    `Listen to "${title}" hosted by ${artist} on ChanceTEK One Podcasts.`;

  const candidateCover = normalizeExternalCoverOrigin(
    (!isGenericOrInvalidTrackCover(merged?.coverUrl) ? merged?.coverUrl : '') ||
      (!isGenericOrInvalidTrackCover(hints.cover) ? hints.cover : '') ||
      '/images/genres/hip-hop.jpg'
  );

  const rawCover =
    candidateCover.startsWith('data:image/') ||
    candidateCover.startsWith('https://') ||
    (candidateCover.startsWith('/') && publicFileExists(candidateCover))
      ? candidateCover
      : '/images/genres/hip-hop.jpg';

  const { ogImageUrl, ogImageType, clientCoverUrl } = buildOgImageResult(
    safeOrigin,
    rawCover,
    decodedId,
    'podcast'
  );

  return {
    id: decodedId,
    title,
    artist,
    description,
    rawCover,
    ogImageUrl,
    ogImageType,
    clientCoverUrl,
    origin: safeOrigin,
  };
}

export async function lookupVideoForShareMetadata(
  rawId: string,
  hints: ShareTrackHints = {}
): Promise<ServerResolvedTrackShare> {
  const safeOrigin =
    hints.origin && /^https?:\/\/[^/\s]+$/i.test(hints.origin.trim())
      ? hints.origin.trim().replace(/\/+$/, '')
      : PRODUCTION_ORIGIN;

  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {}

  let serverVid: Partial<Video> | null = null;
  try {
    serverVid = (await readCatalogDocById('videos', decodedId)) as Partial<Video> | null;
    if (!serverVid) {
      const snapshot = await readCatalogSnapshot();
      const list = (snapshot.collections.videos || []) as Partial<Video>[];
      serverVid =
        list.find((v) => v.id === rawId || v.id === decodedId) ||
        list.find((v) => normalizeLookupKey(v.id) === normalizeLookupKey(decodedId)) ||
        null;
    }
  } catch {}

  const mockVid = MOCK_VIDEOS.find((v) => v.id === rawId || v.id === decodedId) || null;
  const merged = serverVid || mockVid ? { ...(mockVid || {}), ...(serverVid || {}) } : null;

  const title = (merged?.title || hints.title || 'Featured 4K Video').trim();
  const artist = (merged?.artistName || hints.artist || 'ChanceTEK One').trim();
  const description =
    (merged?.description && merged.description.replace(/\s+/g, ' ').trim().slice(0, 180)) ||
    `Watch "${title}" by ${artist} in 4K Ultra HD on ChanceTEK One.`;

  // Always prioritize the REAL extracted frame thumbnail from the video itself (YouTube-style)
  // — NEVER use generic cover art like studio_cover.jpg or genre art when sharing a video.
  const extractedVideoThumb = resolveAuthenticVideoThumbnail(
    decodedId,
    merged?.videoUrl,
    merged?.thumbnailUrl
  );

  const candidateCover = normalizeExternalCoverOrigin(
    extractedVideoThumb ||
      (!isGenericOrInvalidTrackCover(merged?.thumbnailUrl) ? merged?.thumbnailUrl : '') ||
      (!isGenericOrInvalidTrackCover(hints.cover) ? hints.cover : '') ||
      '/images/video-thumbs/video-1.jpg'
  );

  const rawCover =
    candidateCover.startsWith('data:image/') ||
    candidateCover.startsWith('https://') ||
    (candidateCover.startsWith('/') && publicFileExists(candidateCover))
      ? candidateCover
      : '/images/video-thumbs/video-1.jpg';

  const { ogImageUrl, ogImageType, clientCoverUrl } = buildOgImageResult(
    safeOrigin,
    rawCover,
    decodedId,
    'video'
  );

  const normalizedVideoUrl = merged?.videoUrl
    ? merged.videoUrl.startsWith('http://') || merged.videoUrl.startsWith('https://')
      ? merged.videoUrl
      : `${safeOrigin}${encodeURI(merged.videoUrl.startsWith('/') ? merged.videoUrl : `/${merged.videoUrl}`)}`
    : undefined;

  return {
    id: decodedId,
    title,
    artist,
    description,
    rawCover,
    ogImageUrl,
    ogImageType,
    clientCoverUrl,
    videoUrl: normalizedVideoUrl,
    origin: safeOrigin,
  };
}
