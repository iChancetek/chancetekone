/**
 * ChanceTEK One — Authentic artwork verification & album/track association.
 *
 * Priority order (spec §4):
 *   1. Verified embedded artwork from the MP3 (APIC) — validated as a decodable image and
 *      cross-checked against the other tracks of the same verified album.
 *   2. A verified artwork asset that already belongs to the matching catalog album.
 *   3. An authorized metadata/artwork provider (NOT integrated in this codebase — reported as such).
 *   4. Human review.
 *
 * Fixes the previous "batchCover" behaviour that gave ANY artwork-less track the first cover found in
 * the whole batch (e.g. Thriller's cover on Off the Wall tracks), keyed albums by title only, and
 * wrote one image file per track.
 */

import { stableHash } from './hash';
import type { GroupStatus } from './albumGrouping';

export type ArtworkSource =
  | 'embedded_track'
  | 'embedded_album'
  | 'existing_catalog'
  | 'companion_folder'
  | 'manual'
  | 'provider'
  | 'none';

export type ArtworkVerificationStatus = 'verified' | 'needs_review' | 'missing';

export interface ArtworkVerification {
  status: ArtworkVerificationStatus;
  source: ArtworkSource;
  assetHash?: string;
  reason: string;
  recommendation: string;
  /** True when the track keeps its own, different artwork instead of the album cover. */
  distinctFromAlbum?: boolean;
}

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'url';

export function isGenericArtworkUrl(url: string | undefined | null): boolean {
  return !url || url.includes('images.unsplash.com');
}

/** Detects the image format from the data-URL magic bytes. Returns null when it is not a decodable image. */
export function detectImageFormat(url: string | undefined | null): ImageFormat | null {
  if (!url || isGenericArtworkUrl(url)) return null;
  if (!url.startsWith('data:')) {
    // Stored asset (IndexedDB reference / server path / web URL)
    if (url.startsWith('idb-asset:') || url.startsWith('indexeddb:') || url.startsWith('blob:')) return 'url';
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return 'url';
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ? 'url' : null;
  }
  const marker = 'base64,';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const b64 = url.slice(idx + marker.length);
  if (b64.length < 100) return null; // Real embedded covers are never tiny stubs
  let bytes: string;
  try {
    bytes = atob(b64.slice(0, 32));
  } catch {
    return null;
  }
  const b = (i: number) => bytes.charCodeAt(i);

  // JPEG: Starts with standard SOI marker (0xFF 0xD8)
  if (b(0) === 0xff && b(1) === 0xd8) {
    return 'jpeg';
  }

  // PNG: Starts with standard 4-byte signature (0x89 0x50 0x4E 0x47)
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) {
    return 'png';
  }

  if (bytes.startsWith('GIF8')) return 'gif';
  if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Content hash of an artwork payload. Identical images always collapse to a single asset. */
export function hashArtwork(url: string | undefined | null): string | undefined {
  if (!url || isGenericArtworkUrl(url)) return undefined;
  if (url.startsWith('idb-asset:')) return url.slice('idb-asset:'.length);
  const marker = 'base64,';
  const idx = url.indexOf(marker);
  const payload = idx === -1 ? url : url.slice(idx + marker.length);
  return `art-${stableHash(payload)}-${stableHash(payload, 7)}-${payload.length.toString(36)}`;
}

// ---------------------------------------------------------------------------------------------------------

export type TrackArtworkOrigin = 'embedded' | 'companion' | 'manual' | 'unknown';

export interface ArtworkTrackInput {
  id: string;
  groupId: string | null;
  /** True if the track was placed in its group by inference rather than its own album tag. */
  inferred?: boolean;
  coverUrl?: string;
  /** Precomputed content hash; falls back to hashing `coverUrl`. */
  coverHash?: string;
  coverOrigin?: TrackArtworkOrigin;
  sourceFolderPath?: string;
}

export interface ArtworkGroupInput {
  id: string;
  status: GroupStatus;
  sourceFolders: string[];
  /** Verified artwork already attached to the matching catalog album (if any). */
  existingArtworkUrl?: string;
  existingArtworkHash?: string;
}

export interface CompanionImage {
  folderPath: string;
  url: string;
}

export interface TrackArtworkPlan {
  coverUrl?: string;
  verification: ArtworkVerification;
}

export interface AlbumArtworkPlan {
  coverUrl?: string;
  verification: ArtworkVerification;
}

export interface ArtworkPlan {
  tracks: Record<string, TrackArtworkPlan>;
  albums: Record<string, AlbumArtworkPlan>;
  /** hash -> url. One entry per UNIQUE image, however many tracks share it. */
  assets: Record<string, string>;
}

const NO_PROVIDER_NOTE = 'No authorized artwork provider is integrated, so a human must confirm or upload the cover.';

function missingVerification(reason: string): ArtworkVerification {
  return {
    status: 'missing',
    source: 'none',
    reason,
    recommendation: `Upload the authentic cover art, or approve publication with the missing-artwork status. ${NO_PROVIDER_NOTE}`,
  };
}

export function planArtwork(
  tracks: ArtworkTrackInput[],
  groups: ArtworkGroupInput[],
  companions: CompanionImage[] = []
): ArtworkPlan {
  const plan: ArtworkPlan = { tracks: {}, albums: {}, assets: {} };
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const tracksByGroup = new Map<string, ArtworkTrackInput[]>();
  for (const t of tracks) {
    if (!t.groupId) continue;
    const l = tracksByGroup.get(t.groupId) ?? [];
    l.push(t);
    tracksByGroup.set(t.groupId, l);
  }

  // How many groups use each source folder — a companion image is only trusted when it is unambiguous.
  const folderUse = new Map<string, number>();
  for (const g of groups) for (const f of g.sourceFolders) folderUse.set(f, (folderUse.get(f) ?? 0) + 1);
  const companionByFolder = new Map(companions.map((c) => [c.folderPath, c.url]));

  const register = (url: string, knownHash?: string): string => {
    const hash = knownHash ?? hashArtwork(url)!;
    if (!plan.assets[hash]) plan.assets[hash] = url;
    return hash;
  };

  // ---- Album-level artwork ------------------------------------------------------------------------------
  for (const group of groups) {
    const members = tracksByGroup.get(group.id) ?? [];
    const embedded = members.filter(
      (m) => m.coverOrigin !== 'manual' && m.coverOrigin !== 'companion' && detectImageFormat(m.coverUrl) !== null
    );

    const counts = new Map<string, { n: number; url: string }>();
    for (const m of embedded) {
      const h = m.coverHash ?? hashArtwork(m.coverUrl)!;
      const cur = counts.get(h);
      if (cur) cur.n++;
      else counts.set(h, { n: 1, url: m.coverUrl! });
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
    const top = ranked[0];
    const second = ranked[1];
    const dominant = top && (!second || top[1].n > second[1].n) && top[1].n / embedded.length >= 0.5 ? top : undefined;

    const existingHash = group.existingArtworkHash;
    const hasExisting = Boolean(group.existingArtworkUrl && !isGenericArtworkUrl(group.existingArtworkUrl));

    let album: AlbumArtworkPlan;

    if (hasExisting) {
      // Never silently replace verified catalog artwork with a different image.
      const url = group.existingArtworkUrl!;
      const hash = existingHash ?? register(url);
      plan.assets[hash] = plan.assets[hash] ?? url;
      // Hash unknown (legacy catalog art) => the two images cannot be compared automatically.
      const conflict = Boolean(dominant && (!existingHash || dominant[0] !== existingHash));
      album = {
        coverUrl: url,
        verification: {
          status: conflict ? 'needs_review' : 'verified',
          source: 'existing_catalog',
          assetHash: hash,
          reason: conflict
            ? existingHash
              ? 'Embedded artwork differs from the verified artwork already on this catalog album.'
              : 'The catalog album already has artwork that cannot be compared automatically with the embedded cover.'
            : 'Existing verified catalog artwork retained.',
          recommendation: conflict
            ? 'Compare both covers and keep the authentic one; the existing artwork was NOT overwritten.'
            : 'No action required.',
        },
      };
    } else if (dominant) {
      const hash = register(dominant[1].url);
      const share = Math.round((dominant[1].n / embedded.length) * 100);
      album = {
        coverUrl: dominant[1].url,
        verification: {
          status: 'verified',
          source: 'embedded_album',
          assetHash: hash,
          reason: `Valid embedded cover shared by ${dominant[1].n} of ${embedded.length} track(s) (${share}%).`,
          recommendation: 'No action required.',
        },
      };
    } else if (ranked.length > 1) {
      album = {
        verification: {
          status: 'needs_review',
          source: 'none',
          reason: `Tracks embed ${ranked.length} different covers and none is a clear majority.`,
          recommendation: 'Choose the authentic album cover; no cover was applied automatically.',
        },
      };
    } else {
      // Companion folder image (Folder.jpg / cover.jpg) — trusted only if the folder maps to exactly one album.
      const companionFolder = group.sourceFolders.find(
        (f) => companionByFolder.has(f) && (folderUse.get(f) ?? 0) === 1
      );
      if (companionFolder) {
        const url = companionByFolder.get(companionFolder)!;
        const fmt = detectImageFormat(url);
        if (fmt) {
          const hash = register(url);
          album = {
            coverUrl: url,
            verification: {
              status: group.status === 'confirmed' ? 'verified' : 'needs_review',
              source: 'companion_folder',
              assetHash: hash,
              reason:
                group.status === 'confirmed'
                  ? 'Cover image found next to the tracks of this single album folder (not embedded).'
                  : 'Cover image found in the folder, but the album grouping itself is uncertain.',
              recommendation:
                group.status === 'confirmed' ? 'Confirm the image is the authentic cover.' : 'Resolve the album grouping, then confirm the cover.',
            },
          };
        } else {
          album = { verification: missingVerification('Companion image in the folder could not be decoded.') };
        }
      } else {
        const invalid = embedded.length === 0 && members.some((m) => m.coverUrl && !isGenericArtworkUrl(m.coverUrl) && m.coverOrigin !== 'manual' && detectImageFormat(m.coverUrl) === null);
        album = {
          verification: missingVerification(
            invalid ? 'Embedded artwork exists but could not be decoded as an image.' : 'No embedded, existing, or companion artwork was found for this album.'
          ),
        };
        if (invalid) album.verification.status = 'needs_review';
      }
    }
    plan.albums[group.id] = album;
  }

  // ---- Track-level artwork --------------------------------------------------------------------------------
  for (const t of tracks) {
    const group = t.groupId ? groupMap.get(t.groupId) : undefined;
    const album = t.groupId ? plan.albums[t.groupId] : undefined;
    const albumHash = album?.verification.assetHash;
    const format = detectImageFormat(t.coverUrl);

    // Manual corrections are authoritative and are never overwritten.
    if (t.coverOrigin === 'manual' && t.coverUrl && !isGenericArtworkUrl(t.coverUrl)) {
      const hash = register(t.coverUrl, t.coverHash);
      plan.tracks[t.id] = {
        coverUrl: t.coverUrl,
        verification: {
          status: 'verified',
          source: 'manual',
          assetHash: hash,
          reason: 'Artwork set manually by an administrator.',
          recommendation: 'No action required.',
          distinctFromAlbum: Boolean(albumHash && albumHash !== hash),
        },
      };
      continue;
    }

    if (format && t.coverOrigin !== 'companion') {
      const hash = register(t.coverUrl!, t.coverHash);
      if (!group || !album) {
        plan.tracks[t.id] = {
          coverUrl: t.coverUrl,
          verification: {
            status: 'verified',
            source: 'embedded_track',
            assetHash: hash,
            reason: 'Valid embedded artwork; the album could not be identified.',
            recommendation: 'Resolve the album, then confirm the cover belongs to it.',
          },
        };
      } else if (albumHash === hash) {
        plan.tracks[t.id] = {
          coverUrl: t.coverUrl,
          verification: {
            status: album.verification.status === 'verified' ? 'verified' : 'needs_review',
            source: 'embedded_track',
            assetHash: hash,
            reason: 'Embedded artwork matches the album cover.',
            recommendation: album.verification.status === 'verified' ? 'No action required.' : album.verification.recommendation,
          },
        };
      } else if (albumHash) {
        plan.tracks[t.id] = {
          coverUrl: t.coverUrl,
          verification: {
            status: 'needs_review',
            source: 'embedded_track',
            assetHash: hash,
            reason: 'Embedded artwork differs from the album cover used by the other tracks. It was preserved, not overwritten.',
            recommendation: 'Confirm this is genuine distinct track artwork, or apply the album cover.',
            distinctFromAlbum: true,
          },
        };
      } else {
        plan.tracks[t.id] = {
          coverUrl: t.coverUrl,
          verification: {
            status: 'needs_review',
            source: 'embedded_track',
            assetHash: hash,
            reason: album.verification.reason,
            recommendation: album.verification.recommendation,
          },
        };
      }
      continue;
    }

    // Track has no usable embedded artwork of its own.
    const hadInvalid = Boolean(t.coverUrl && !isGenericArtworkUrl(t.coverUrl) && !format);
    if (album?.coverUrl) {
      const verifiedAlbum = album.verification.status === 'verified';
      const certainMembership = group?.status === 'confirmed' && !t.inferred;
      const verified = verifiedAlbum && certainMembership && !hadInvalid;
      plan.tracks[t.id] = {
        coverUrl: album.coverUrl,
        verification: {
          status: verified ? 'verified' : 'needs_review',
          source: album.verification.source,
          assetHash: album.verification.assetHash,
          reason: hadInvalid
            ? 'Track artwork could not be decoded; album artwork suggested instead.'
            : verified
              ? 'Inherited from the verified album artwork.'
              : t.inferred
                ? 'Album membership was inferred, so the inherited cover is only a suggestion.'
                : !certainMembership
                  ? 'Album grouping is uncertain, so the inherited cover is only a suggestion.'
                  : album.verification.reason,
          recommendation: verified ? 'No action required.' : 'Confirm album membership and cover.',
        },
      };
    } else {
      const v = hadInvalid
        ? ({ ...missingVerification('Embedded artwork could not be decoded as an image.'), status: 'needs_review' } as ArtworkVerification)
        : missingVerification(album?.verification.reason ?? 'No artwork found and the album could not be identified.');
      plan.tracks[t.id] = { verification: v };
    }
  }

  return plan;
}

export interface ArtworkSummary {
  verified: number;
  needsReview: number;
  missing: number;
  uniqueAssets: number;
  totalTracks: number;
}

export function summarizeArtwork(plan: ArtworkPlan): ArtworkSummary {
  const all = Object.values(plan.tracks);
  return {
    verified: all.filter((t) => t.verification.status === 'verified').length,
    needsReview: all.filter((t) => t.verification.status === 'needs_review').length,
    missing: all.filter((t) => t.verification.status === 'missing').length,
    uniqueAssets: Object.keys(plan.assets).length,
    totalTracks: all.length,
  };
}
