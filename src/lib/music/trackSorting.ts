import { Track, Album, Artist } from '@/types/media';

export type MusicSortOption =
  | 'newest'
  | 'title-asc'
  | 'title-desc'
  | 'artist-asc'
  | 'artist-desc';

export type SimpleSortOption = 'newest' | 'alpha-asc' | 'alpha-desc';

export const MUSIC_SORT_OPTIONS: { value: MusicSortOption; label: string }[] = [
  { value: 'newest', label: 'Newest Uploaded (Default)' },
  { value: 'title-asc', label: 'Title: A → Z' },
  { value: 'title-desc', label: 'Title: Z → A' },
  { value: 'artist-asc', label: 'Artist: A → Z' },
  { value: 'artist-desc', label: 'Artist: Z → A' },
];

export const ALBUM_SORT_OPTIONS: { value: MusicSortOption; label: string }[] = [
  { value: 'newest', label: 'Newest Uploaded (Default)' },
  { value: 'title-asc', label: 'Album: A → Z' },
  { value: 'title-desc', label: 'Album: Z → A' },
  { value: 'artist-asc', label: 'Artist: A → Z' },
  { value: 'artist-desc', label: 'Artist: Z → A' },
];

export const ARTIST_SORT_OPTIONS: { value: SimpleSortOption; label: string }[] = [
  { value: 'newest', label: 'Newest Uploaded (Default)' },
  { value: 'alpha-asc', label: 'Name: A → Z' },
  { value: 'alpha-desc', label: 'Name: Z → A' },
];

/**
 * Extracts a comparable upload/publication timestamp (ms) for a track so that
 * newly uploaded music consistently appears at the top of the catalog by default.
 */
export function getTrackUploadedTimestamp(track?: Track | null): number {
  if (!track) return 0;

  // 1. Explicit uploadedAt / publishedAt / createdAt timestamps
  const candidates = [
    track.uploadedAt,
    (track as any).publishedAt,
    (track as any).createdAt,
    (track as any).updatedAt,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw < 10_000_000_000 ? raw * 1000 : raw;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
      const num = Number(raw);
      if (Number.isFinite(num) && num > 1_000_000_000) {
        return num < 10_000_000_000 ? num * 1000 : num;
      }
    }
  }

  // 2. Embedded epoch timestamp inside track ID (e.g., trk-pub-1793247158957-... or upload-179...)
  const idStr = String(track.id || '');
  const idMatch = idStr.match(/(\d{10,13})/);
  if (idMatch) {
    const ts = parseInt(idMatch[1], 10);
    const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
    const yr = new Date(ms).getUTCFullYear();
    if (yr >= 2020 && yr <= 2035) {
      return ms;
    }
  }

  // 3. Embedded epoch timestamp inside audioUrl (e.g., /audio/uploads/1792551233672_...)
  const audioStr = String(track.audioUrl || '');
  const audioMatch = audioStr.match(/(\d{10,13})/);
  if (audioMatch) {
    const ts = parseInt(audioMatch[1], 10);
    const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
    const yr = new Date(ms).getUTCFullYear();
    if (yr >= 2020 && yr <= 2035) {
      return ms;
    }
  }

  // 4. Fallback for older catalog / baseline items based on releaseYear (guaranteed below recent uploads)
  const releaseYear = Number(track.releaseYear);
  if (Number.isFinite(releaseYear) && releaseYear >= 1950 && releaseYear <= 2030) {
    return Date.UTC(releaseYear, 0, 1);
  }

  return 0;
}

function compareText(a?: string, b?: string): number {
  return String(a || '').trim().localeCompare(String(b || '').trim(), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

/**
 * Sorts an array of tracks without mutating the input array.
 * Default is 'newest' (newly uploaded tracks at the top).
 */
export function sortTracks(tracks: Track[], sortBy: MusicSortOption = 'newest'): Track[] {
  if (!Array.isArray(tracks)) return [];
  const copy = [...tracks];

  switch (sortBy) {
    case 'title-asc':
      return copy.sort((a, b) => compareText(a.title, b.title) || compareText(a.artistName, b.artistName));
    case 'title-desc':
      return copy.sort((a, b) => compareText(b.title, a.title) || compareText(b.artistName, a.artistName));
    case 'artist-asc':
      return copy.sort((a, b) => compareText(a.artistName, b.artistName) || compareText(a.title, b.title));
    case 'artist-desc':
      return copy.sort((a, b) => compareText(b.artistName, a.artistName) || compareText(a.title, b.title));
    case 'newest':
    default:
      return copy.sort((a, b) => {
        const diff = getTrackUploadedTimestamp(b) - getTrackUploadedTimestamp(a);
        if (diff !== 0) return diff;
        return compareText(a.title, b.title);
      });
  }
}

/**
 * Computes the newest upload timestamp associated with an album across its tracks.
 */
export function getAlbumNewestTimestamp(album: Album, allTracks: Track[]): number {
  let maxTs = 0;
  const albumTitleNorm = String(album.title || '').trim().toLowerCase();
  const artistNorm = String(album.artistName || '').trim().toLowerCase();
  const trackIdSet = new Set(album.trackIds || []);

  for (const t of allTracks) {
    const matches =
      trackIdSet.has(t.id) ||
      t.albumId === album.id ||
      (String(t.albumTitle || '').trim().toLowerCase() === albumTitleNorm &&
        String(t.artistName || '').trim().toLowerCase() === artistNorm);
    if (matches) {
      const ts = getTrackUploadedTimestamp(t);
      if (ts > maxTs) maxTs = ts;
    }
  }

  if (maxTs === 0 && album.releaseYear) {
    return Date.UTC(Number(album.releaseYear) || 2020, 0, 1);
  }
  return maxTs;
}

export function sortAlbums(
  albums: Album[],
  allTracks: Track[],
  sortBy: MusicSortOption = 'newest'
): Album[] {
  if (!Array.isArray(albums)) return [];
  const copy = [...albums];

  switch (sortBy) {
    case 'title-asc':
      return copy.sort((a, b) => compareText(a.title, b.title) || compareText(a.artistName, b.artistName));
    case 'title-desc':
      return copy.sort((a, b) => compareText(b.title, a.title) || compareText(b.artistName, a.artistName));
    case 'artist-asc':
      return copy.sort((a, b) => compareText(a.artistName, b.artistName) || compareText(a.title, b.title));
    case 'artist-desc':
      return copy.sort((a, b) => compareText(b.artistName, a.artistName) || compareText(a.title, b.title));
    case 'newest':
    default: {
      const tsMap = new Map<string, number>();
      copy.forEach((alb) => tsMap.set(alb.id, getAlbumNewestTimestamp(alb, allTracks)));
      return copy.sort((a, b) => {
        const diff = (tsMap.get(b.id) || 0) - (tsMap.get(a.id) || 0);
        if (diff !== 0) return diff;
        return compareText(a.title, b.title);
      });
    }
  }
}

export function sortArtists(
  artists: Artist[],
  allTracks: Track[],
  sortBy: SimpleSortOption = 'newest'
): Artist[] {
  if (!Array.isArray(artists)) return [];
  const copy = [...artists];

  switch (sortBy) {
    case 'alpha-asc':
      return copy.sort((a, b) => compareText(a.name, b.name));
    case 'alpha-desc':
      return copy.sort((a, b) => compareText(b.name, a.name));
    case 'newest':
    default: {
      const tsMap = new Map<string, number>();
      for (const artist of copy) {
        let maxTs = 0;
        const nameNorm = String(artist.name || '').trim().toLowerCase();
        for (const t of allTracks) {
          if (
            t.artistId === artist.id ||
            String(t.artistName || '').trim().toLowerCase() === nameNorm
          ) {
            const ts = getTrackUploadedTimestamp(t);
            if (ts > maxTs) maxTs = ts;
          }
        }
        tsMap.set(artist.id, maxTs);
      }
      return copy.sort((a, b) => {
        const diff = (tsMap.get(b.id) || 0) - (tsMap.get(a.id) || 0);
        if (diff !== 0) return diff;
        return compareText(a.name, b.name);
      });
    }
  }
}

