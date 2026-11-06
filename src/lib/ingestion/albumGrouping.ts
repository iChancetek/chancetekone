/**
 * 8 Of Spades Works — Agentic album identification.
 *
 * Metadata-first album grouping. Folder names are only SUPPLEMENTARY evidence and are never
 * used to invent an album title: an unresolved track keeps an empty album and receives a
 * `suggestedAlbum` that a human must accept in the Approval Review Center.
 *
 * Fixes the previous behaviour where every track silently inherited the TOP-LEVEL dropped
 * folder name as its album ("Music Collection"), which merged unrelated albums together and
 * caused one album's cover to be applied to all of them.
 */

import { stableHash, normalizeKey } from './hash';

export interface GroupingTrack {
  id: string;
  title: string;
  artist: string;
  albumArtist?: string;
  album?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  isrc?: string;
  /** Content hash of the embedded artwork (see artworkVerification.hashArtwork). */
  artworkHash?: string;
  sourceFolderPath?: string;
  fileName?: string;
}

export interface ExistingAlbumRef {
  id: string;
  title: string;
  artistName: string;
}

export type GroupStatus = 'confirmed' | 'probable' | 'needs_review';
export type AssignmentMethod = 'metadata' | 'folder_sibling' | 'artwork_match' | 'unresolved';

export interface AlbumGroup {
  id: string;
  title: string;
  albumArtist: string;
  isCompilation: boolean;
  /** Ordered by disc, then track number, then title. */
  trackIds: string[];
  /** Tracks placed here by inference rather than by their own album tag. */
  inferredTrackIds: string[];
  discCount: number;
  years: number[];
  confidence: number;
  status: GroupStatus;
  needsReview: boolean;
  flags: string[];
  sourceFolders: string[];
  artworkHashes: string[];
  /** Set when the group matches a catalog album, so the existing record is reused. */
  existingAlbumId?: string;
}

export interface TrackAssignment {
  trackId: string;
  groupId: string | null;
  confidence: number;
  method: AssignmentMethod;
  needsReview: boolean;
  flags: string[];
  /** Folder-derived hint. NEVER applied automatically. */
  suggestedAlbum?: string;
}

export interface GroupingResult {
  groups: AlbumGroup[];
  assignments: Record<string, TrackAssignment>;
  unresolvedTrackIds: string[];
}

const GENERIC_ALBUMS = new Set([
  '',
  'master crate vault',
  'master crate collection',
  'vault cuts',
  'unknown album',
  'unknown',
  'untitled',
  'single release',
  'single release vault cuts',
  'no album',
]);

const VARIOUS_ARTISTS = new Set(['various artists', 'various', 'va', 'v a', 'compilation', 'varios artistas']);

export function isMeaningfulAlbum(album: string | undefined | null): boolean {
  return !GENERIC_ALBUMS.has(normalizeKey(album));
}

export function isVariousArtists(name: string | undefined | null): boolean {
  return VARIOUS_ARTISTS.has(normalizeKey(name));
}

/** "Michael Jackson feat. Siedah Garrett" -> "Michael Jackson". Intentionally does NOT split on "&". */
export function primaryArtist(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/\s*[([]?\s*(feat\.?|ft\.?|featuring)\s+.*$/i, '').trim();
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = '';
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function leafFolder(path: string | undefined): string {
  if (!path) return '';
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

interface Bucket {
  key: string;
  artistKey: string;
  albumKey: string;
  compilation: boolean;
  hadAlbumArtistTag: boolean;
  tracks: GroupingTrack[];
}

function trackSortValue(t: GroupingTrack): [number, number, string] {
  return [t.discNumber ?? 1, t.trackNumber ?? Number.MAX_SAFE_INTEGER, normalizeKey(t.title)];
}

function sortTracks(tracks: GroupingTrack[]): GroupingTrack[] {
  return [...tracks].sort((a, b) => {
    const [da, na, ta] = trackSortValue(a);
    const [db, nb, tb] = trackSortValue(b);
    return da - db || na - nb || ta.localeCompare(tb);
  });
}

export function groupTracksIntoAlbums(
  tracks: GroupingTrack[],
  existingAlbums: ExistingAlbumRef[] = []
): GroupingResult {
  const assignments: Record<string, TrackAssignment> = {};
  const buckets = new Map<string, Bucket>();
  const untagged: GroupingTrack[] = [];

  // ---- Tier 1: reliable album metadata ------------------------------------------------------
  for (const t of tracks) {
    if (!isMeaningfulAlbum(t.album)) {
      untagged.push(t);
      continue;
    }
    const compilation = isVariousArtists(t.albumArtist);
    const hasAlbumArtist = Boolean(t.albumArtist && normalizeKey(t.albumArtist));
    const artistKey = compilation
      ? 'various artists'
      : normalizeKey(hasAlbumArtist ? t.albumArtist : primaryArtist(t.artist)) || 'unknown artist';
    const albumKey = normalizeKey(t.album);
    const key = `${artistKey}::${albumKey}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, artistKey, albumKey, compilation, hadAlbumArtistTag: false, tracks: [] };
      buckets.set(key, bucket);
    }
    if (hasAlbumArtist) bucket.hadAlbumArtistTag = true;
    bucket.tracks.push(t);
  }

  // ---- Collaboration / compilation reconciliation (same album tag + same source folder, artists differ) ---
  const mergeNotes = new Map<string, string[]>();
  const inferredCompilation = new Set<string>();
  const byAlbumKey = new Map<string, Bucket[]>();
  for (const b of buckets.values()) {
    if (b.compilation || b.hadAlbumArtistTag) continue;
    const list = byAlbumKey.get(b.albumKey) ?? [];
    list.push(b);
    byAlbumKey.set(b.albumKey, list);
  }
  for (const [albumKey, list] of byAlbumKey) {
    if (list.length < 2) continue;
    // Union-find over buckets that share a source folder.
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const folderOwner = new Map<string, number>();
    list.forEach((b, i) => {
      for (const t of b.tracks) {
        const folder = t.sourceFolderPath ?? '';
        if (!folder) continue;
        const owner = folderOwner.get(folder);
        if (owner === undefined) folderOwner.set(folder, i);
        else parent[find(i)] = find(owner);
      }
    });
    const clusters = new Map<number, Bucket[]>();
    list.forEach((b, i) => {
      const root = find(i);
      const c = clusters.get(root) ?? [];
      c.push(b);
      clusters.set(root, c);
    });
    for (const cluster of clusters.values()) {
      if (cluster.length < 2) continue;
      const primary = [...cluster].sort((a, b) => b.tracks.length - a.tracks.length)[0];
      const artistNames = new Set<string>();
      cluster.forEach((b) => b.tracks.forEach((t) => artistNames.add(primaryArtist(t.artist))));
      for (const other of cluster) {
        if (other === primary) continue;
        primary.tracks.push(...other.tracks);
        buckets.delete(other.key);
      }
      const notes = mergeNotes.get(primary.key) ?? [];
      if (artistNames.size >= 3) {
        primary.compilation = true;
        inferredCompilation.add(primary.key);
        notes.push(`Inferred compilation: ${artistNames.size} track artists share this album tag in one folder but there is no album-artist tag.`);
      } else {
        notes.push(
          `Track artists differ (${[...artistNames].map((a) => `"${a}"`).join(', ')}) and no album-artist tag is set — confirm the album artist.`
        );
      }
      mergeNotes.set(primary.key, notes);
      void albumKey;
    }
  }

  // ---- Build groups ---------------------------------------------------------------------------
  const existingIndex = new Map<string, ExistingAlbumRef>();
  for (const a of existingAlbums) {
    existingIndex.set(`${normalizeKey(a.artistName)}::${normalizeKey(a.title)}`, a);
    existingIndex.set(`*::${normalizeKey(a.title)}`, a); // used only for compilations
  }

  const groups: AlbumGroup[] = [];
  const groupByBucketKey = new Map<string, AlbumGroup>();

  for (const bucket of buckets.values()) {
    const ordered = sortTracks(bucket.tracks);
    const flags: string[] = [...(mergeNotes.get(bucket.key) ?? [])];
    let confidence = 92;

    const title = mostCommon(ordered.map((t) => (t.album ?? '').trim()));
    const albumArtistRaw = bucket.compilation
      ? 'Various Artists'
      : mostCommon(
          ordered.map((t) => (t.albumArtist && t.albumArtist.trim()) || primaryArtist(t.artist)).filter(Boolean)
        );

    if ((mergeNotes.get(bucket.key) ?? []).length > 0) confidence -= inferredCompilation.has(bucket.key) ? 10 : 25;

    if (!albumArtistRaw || normalizeKey(albumArtistRaw) === 'unknown artist') {
      confidence -= 20;
      flags.push('Artist missing or unknown.');
    }

    const years = [...new Set(ordered.map((t) => t.year).filter((y): y is number => typeof y === 'number' && y > 0))].sort();
    if (years.length > 1) {
      confidence -= 15;
      flags.push(`Inconsistent release years across tracks (${years.join(', ')}).`);
    }

    const seenNumbers = new Set<string>();
    let duplicateNumbers = false;
    for (const t of ordered) {
      if (t.trackNumber === undefined) continue;
      const k = `${t.discNumber ?? 1}-${t.trackNumber}`;
      if (seenNumbers.has(k)) duplicateNumbers = true;
      seenNumbers.add(k);
    }
    if (duplicateNumbers) {
      confidence -= 25;
      flags.push('Duplicate disc/track numbers — this group may combine tracks from different releases.');
    }

    const hashCounts = new Map<string, number>();
    ordered.forEach((t) => t.artworkHash && hashCounts.set(t.artworkHash, (hashCounts.get(t.artworkHash) ?? 0) + 1));
    const withArt = [...hashCounts.values()].reduce((a, b) => a + b, 0);
    const dominantShare = withArt > 0 ? Math.max(...hashCounts.values()) / withArt : 1;
    if (hashCounts.size > 1 && dominantShare < 0.7) {
      confidence -= 15;
      flags.push('Embedded artwork differs between tracks and no single cover dominates.');
    }

    const discs = new Set(ordered.map((t) => t.discNumber ?? 1));
    let existing = bucket.compilation
      ? existingIndex.get(`*::${bucket.albumKey}`)
      : existingIndex.get(`${normalizeKey(albumArtistRaw)}::${bucket.albumKey}`);

    if (!existing) {
      const aKey = normalizeKey(albumArtistRaw);
      const albKey = bucket.albumKey;
      existing = existingAlbums.find((ea) => {
        const eaArtist = normalizeKey(ea.artistName);
        const eaAlb = normalizeKey(ea.title);
        const artistMatches = eaArtist === aKey || eaArtist.includes(aKey) || aKey.includes(eaArtist);
        const albumMatches = eaAlb === albKey || eaAlb.startsWith(albKey) || albKey.startsWith(eaAlb) || eaAlb.includes(albKey);
        return artistMatches && albumMatches;
      });
    }

    confidence = Math.max(0, Math.min(100, confidence));
    const status: GroupStatus = confidence >= 85 ? 'confirmed' : confidence >= 60 ? 'probable' : 'needs_review';

    const group: AlbumGroup = {
      id: existing?.id ?? `alb-${stableHash(bucket.key)}`,
      title,
      albumArtist: albumArtistRaw || 'Unknown Artist',
      isCompilation: bucket.compilation,
      trackIds: ordered.map((t) => t.id),
      inferredTrackIds: [],
      discCount: discs.size,
      years,
      confidence,
      status,
      needsReview: status !== 'confirmed',
      flags,
      sourceFolders: [...new Set(ordered.map((t) => t.sourceFolderPath).filter((p): p is string => Boolean(p)))],
      artworkHashes: [...hashCounts.keys()],
      existingAlbumId: existing?.id,
    };
    groups.push(group);
    groupByBucketKey.set(bucket.key, group);

    for (const t of ordered) {
      const tFlags: string[] = [];
      if (t.trackNumber === undefined) tFlags.push('Missing track number.');
      assignments[t.id] = {
        trackId: t.id,
        groupId: group.id,
        confidence: group.confidence,
        method: 'metadata',
        needsReview: group.needsReview,
        flags: tFlags,
      };
    }
  }

  // ---- Tier 2: tracks with missing / generic album metadata -----------------------------------------
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const groupsByFolder = new Map<string, AlbumGroup[]>();
  for (const g of groups) {
    for (const f of g.sourceFolders) {
      const l = groupsByFolder.get(f) ?? [];
      l.push(g);
      groupsByFolder.set(f, l);
    }
  }
  const groupsByArtworkHash = new Map<string, AlbumGroup[]>();
  for (const g of groups) {
    for (const h of g.artworkHashes) {
      const l = groupsByArtworkHash.get(h) ?? [];
      l.push(g);
      groupsByArtworkHash.set(h, l);
    }
  }

  const unresolvedTrackIds: string[] = [];
  for (const t of untagged) {
    const artistKey = normalizeKey(t.albumArtist) || normalizeKey(primaryArtist(t.artist));
    const sameArtist = (g: AlbumGroup) =>
      g.isCompilation || normalizeKey(g.albumArtist) === artistKey || normalizeKey(primaryArtist(g.albumArtist)) === artistKey;

    const folderCandidates = (t.sourceFolderPath ? groupsByFolder.get(t.sourceFolderPath) ?? [] : []).filter(sameArtist);
    const artCandidates = (t.artworkHash ? groupsByArtworkHash.get(t.artworkHash) ?? [] : []).filter(sameArtist);

    let chosen: AlbumGroup | undefined;
    let method: AssignmentMethod = 'unresolved';
    let confidence = 0;
    const flags: string[] = [];

    if (folderCandidates.length === 1 && artCandidates.some((g) => g.id === folderCandidates[0].id)) {
      chosen = folderCandidates[0];
      method = 'artwork_match';
      confidence = 80;
      flags.push('Album inferred: same folder and identical embedded artwork as sibling tracks.');
    } else if (folderCandidates.length === 1) {
      chosen = folderCandidates[0];
      method = 'folder_sibling';
      confidence = 62;
      flags.push('Album inferred only from sibling tracks in the same folder — confirm.');
    } else if (folderCandidates.length > 1 && artCandidates.length >= 1) {
      const overlap = folderCandidates.filter((g) => artCandidates.some((a) => a.id === g.id));
      if (overlap.length === 1) {
        chosen = overlap[0];
        method = 'artwork_match';
        confidence = 72;
        flags.push('Folder contains several albums; chosen by matching embedded artwork — confirm.');
      }
    } else if (folderCandidates.length === 0 && artCandidates.length === 1) {
      chosen = artCandidates[0];
      method = 'artwork_match';
      confidence = 65;
      flags.push('Album inferred only from identical embedded artwork — confirm.');
    }

    if (chosen) {
      chosen.trackIds = sortTracks(
        [...chosen.trackIds.map((id) => trackById.get(id)!), t]
      ).map((x) => x.id);
      chosen.inferredTrackIds.push(t.id);
      const note = 'Includes tracks assigned by inference (no album tag) — review.';
      if (!chosen.flags.includes(note)) chosen.flags.push(note);
      assignments[t.id] = {
        trackId: t.id,
        groupId: chosen.id,
        confidence,
        method,
        needsReview: true,
        flags,
      };
    } else {
      const leaf = leafFolder(t.sourceFolderPath);
      const flagsU = ['Missing album metadata — album was NOT invented.'];
      if (folderCandidates.length > 1) flagsU.push('Folder contains several candidate albums; cannot choose.');
      assignments[t.id] = {
        trackId: t.id,
        groupId: null,
        confidence: 0,
        method: 'unresolved',
        needsReview: true,
        flags: flagsU,
        suggestedAlbum: leaf || undefined,
      };
      unresolvedTrackIds.push(t.id);
    }
  }

  // ---- Edition-variant hint (informational, never merges) -----------------------------------------------
  const byArtist = new Map<string, AlbumGroup[]>();
  for (const g of groups) {
    const k = normalizeKey(g.albumArtist);
    const l = byArtist.get(k) ?? [];
    l.push(g);
    byArtist.set(k, l);
  }
  for (const list of byArtist.values()) {
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        const ka = normalizeKey(a.title);
        const kb = normalizeKey(b.title);
        if (kb.length > ka.length && kb.startsWith(`${ka} `)) {
          const note = `Possible edition variant of "${a.title}" — kept as a separate album.`;
          if (!b.flags.includes(note)) b.flags.push(note);
        }
      }
    }
  }

  groups.sort((a, b) => a.albumArtist.localeCompare(b.albumArtist) || a.title.localeCompare(b.title));
  return { groups, assignments, unresolvedTrackIds };
}
