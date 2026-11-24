/**
 * ChanceTEK One — Server-Side Shared Song Metadata & Exact Cover Art Resolver
 *
 * Used by /share/track/[id], /music/[id]/layout.tsx, and /api/share/cover/[id]
 * so SMS/iMessage, WhatsApp, Facebook, X/Twitter, LinkedIn, and Telegram crawlers
 * ALWAYS receive the exact cover art of the shared song (never generic artwork).
 */

import fs from 'fs';
import path from 'path';
import { readCatalogSnapshot } from '@/lib/server/catalogStore';
import { MOCK_ALBUMS, MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Track } from '@/types/media';

const PRODUCTION_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://chancetekone.us').replace(/\/+$/, '');

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
  /** Crawlable absolute HTTPS URL guaranteed to return image bytes for social/SMS bots */
  ogImageUrl: string;
  /** Relative or absolute image URL suitable for client <Image> rendering */
  clientCoverUrl: string;
  origin: string;
}

export function isGenericOrInvalidTrackCover(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  if (
    !lower ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.startsWith('blob:') ||
    lower.includes('chancetekone_banner.png') ||
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

function publicFileExists(relUrl: string): boolean {
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

function normalizeLookupKey(s?: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Finds the authoritative track document from server Firestore/local snapshot + canonical/mock catalog.
 */
async function findAuthoritativeTrack(rawId: string): Promise<{
  track: Partial<Track> | null;
  albumCover?: string;
}> {
  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {}

  let serverTrack: Partial<Track> | null = null;
  let albumCover: string | undefined;

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
        albumCover = matchingAlbum.coverUrl;
      }
    }
  } catch {
    // Continue gracefully to canonical/mock fallback
  }

  // Fallback to canonical & mock catalogs (safe on SSR)
  const localTrack =
    MusicCatalogService.getTrackById(decodedId) ||
    MusicCatalogService.getTrackById(rawId) ||
    MOCK_TRACKS.find((t) => t.id === decodedId || t.id === rawId) ||
    null;

  const merged: Partial<Track> | null =
    serverTrack || localTrack
      ? {
          ...(localTrack || {}),
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

/**
 * Picks the exact best cover source for a track, preferring song-specific art over generic art.
 */
function pickExactRawCover(
  track: Partial<Track> | null,
  albumCover: string | undefined,
  hintCover?: string
): string {
  const candidates: (string | undefined)[] = [];

  // 1. Track's own uploaded/custom cover (if not generic and not genre fallback)
  if (track?.coverUrl && !isGenericOrInvalidTrackCover(track.coverUrl) && !isGenreFallbackCover(track.coverUrl)) {
    candidates.push(track.coverUrl);
  }

  // 2. Explicit share query param cover (validated safe, non-generic, non-genre)
  if (hintCover && isSafeCoverParam(hintCover) && !isGenericOrInvalidTrackCover(hintCover) && !isGenreFallbackCover(hintCover)) {
    candidates.push(hintCover);
  }

  // 3. Album cover from server/mock catalog
  if (albumCover && !isGenericOrInvalidTrackCover(albumCover) && !isGenreFallbackCover(albumCover)) {
    candidates.push(albumCover);
  }

  // 4. MusicCatalogService authentic cover registry (matches exact artist/album artwork)
  if (track && (track.title || track.artistName)) {
    try {
      const resolved = MusicCatalogService.resolveTrackCover(track as Track);
      if (resolved && !isGenericOrInvalidTrackCover(resolved) && !isGenreFallbackCover(resolved)) {
        candidates.push(resolved);
      }
    } catch {}
  }

  // Validate candidates: verify local /images/ paths exist on disk when possible
  for (const c of candidates) {
    if (!c) continue;
    if (c.startsWith('data:image/') || c.startsWith('https://')) {
      return c;
    }
    if (c.startsWith('/') && publicFileExists(c)) {
      return c;
    }
  }

  // Secondary pass: accept explicit hintCover or track cover even if it's a genre artwork
  if (hintCover && isSafeCoverParam(hintCover) && !isGenericOrInvalidTrackCover(hintCover)) {
    return hintCover;
  }
  if (track?.coverUrl && !isGenericOrInvalidTrackCover(track.coverUrl)) {
    return track.coverUrl;
  }
  if (track && (track.title || track.artistName)) {
    try {
      const fallbackResolved = MusicCatalogService.resolveTrackCover(track as Track);
      if (fallbackResolved && !isGenericOrInvalidTrackCover(fallbackResolved)) {
        return fallbackResolved;
      }
    } catch {}
  }

  return '/images/genres/rnb-neo-soul.jpg';
}

/**
 * Resolves full server-side share metadata for a track ID (with optional query hints).
 */
export async function lookupTrackForShareMetadata(
  id: string,
  hints: ShareTrackHints = {}
): Promise<ServerResolvedTrackShare> {
  const safeOrigin =
    hints.origin && /^https?:\/\/[^/\s]+$/i.test(hints.origin.trim())
      ? hints.origin.trim().replace(/\/+$/, '')
      : PRODUCTION_ORIGIN;

  const { track, albumCover } = await findAuthoritativeTrack(id);

  const title = (track?.title || hints.title || 'Featured Track').trim();
  const artist = (track?.artistName || hints.artist || 'ChanceTEK One').trim();
  const albumTitle = track?.albumTitle?.trim() || undefined;

  const description =
    (track?.lyrics && track.lyrics.replace(/\s+/g, ' ').trim().slice(0, 180)) ||
    `Listen to "${title}" by ${artist} on ChanceTEK One. High-fidelity streaming & authentic studio masters.`;

  // Synthesize partial track with hint title/artist so authentic cover lookup works even for newly uploaded IDs
  const trackForArt: Partial<Track> = {
    ...(track || {}),
    id,
    title,
    artistName: artist,
    albumTitle,
  };

  const rawCover = pickExactRawCover(trackForArt, albumCover, hints.cover);

  // Build crawlable OG/Twitter image URL:
  // - data:image/... MUST be served via /api/share/cover/[id] so bots get real JPEG/PNG bytes
  // - https://... is already an absolute image URL (use directly)
  // - /images/... becomes https://chancetekone.us/images/... (properly URI-encoded for spaces/parens)
  let ogImageUrl: string;
  let clientCoverUrl: string;

  if (rawCover.startsWith('data:image/')) {
    const apiPath = `/api/share/cover/${encodeURIComponent(id)}`;
    ogImageUrl = `${safeOrigin}${apiPath}`;
    clientCoverUrl = apiPath;
  } else if (rawCover.startsWith('https://') || rawCover.startsWith('http://')) {
    ogImageUrl = rawCover;
    clientCoverUrl = rawCover;
  } else {
    const normalizedPath = rawCover.startsWith('/') ? rawCover : `/${rawCover}`;
    ogImageUrl = `${safeOrigin}${encodeURI(normalizedPath)}`;
    clientCoverUrl = normalizedPath;
  }

  return {
    id,
    title,
    artist,
    albumTitle,
    description,
    rawCover,
    ogImageUrl,
    clientCoverUrl,
    origin: safeOrigin,
  };
}

