/**
 * 8 Of Spades Works — Catalog merge & change-tracking helpers.
 *
 * Rules:
 *  - Members (non-writers): the cloud is authoritative. Local state is replaced.
 *  - Admins (writers): the cloud wins for items it knows about. Items that exist
 *    only locally AND were never seen in the cloud are brand-new uploads and are
 *    returned in `toUpload` (this migrates content that previously lived only in
 *    one admin's browser). Items the cloud used to have but no longer has were
 *    deleted by another admin and are dropped locally.
 */

const SEEN_PREFIX = 'spades_cloud_seen_v1_';

/** Deterministic stringify (sorted keys) with large strings collapsed for speed. */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: any): any => {
    if (typeof v === 'string') {
      if (v.length > 1000) return `${v.slice(0, 256)}…[${v.length}]…${v.slice(-64)}`;
      return v;
    }
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return undefined;
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) {
      const child = v[k];
      if (child === undefined || typeof child === 'function') continue;
      out[k] = walk(child);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

export function loadSeenIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

export function saveSeenIds(key: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEEN_PREFIX + key, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore quota issues — worst case an item is re-checked next load */
  }
}

export interface MergeResult<T> {
  merged: T[];
  toUpload: T[];
}

export function mergeWithRemote<T extends { id: string }>(args: {
  seenKey: string;
  local: T[];
  remote: T[];
  writer: boolean;
}): MergeResult<T> {
  const { seenKey, local, remote, writer } = args;
  const remoteIds = new Set(remote.map((r) => r.id));
  const localMap = new Map(local.map((item) => [item.id, item]));
  const seen = loadSeenIds(seenKey);

  const isLocalUploadItem = (item: T) =>
    String(item.id).startsWith('trk-pub-') ||
    Boolean((item as any).uploadBatchId) ||
    Boolean((item as any).uploadedByAdminName) ||
    Boolean((item as any).uploadedByAdminId) ||
    Boolean((item as any).audioUrl?.startsWith('indexeddb://')) ||
    Boolean((item as any).audioUrl?.startsWith('blob:'));

  if (!writer) {
    saveSeenIds(seenKey, remoteIds);
    // Never drop locally uploaded tracks that haven't synced to remote yet
    const localUploads = local.filter((item) => !remoteIds.has(item.id) && isLocalUploadItem(item));
    return { merged: [...remote, ...localUploads], toUpload: [] };
  }

  const toUpload: T[] = [];
  const merged: T[] = remote.map((r) => {
    const loc = localMap.get(r.id) as any;
    const rem = r as any;
    if (loc) {
      const locHasCloudAudio =
        typeof loc.audioUrl === 'string' && loc.audioUrl.startsWith('https://firebasestorage.googleapis.com/');
      const remHasCloudAudio =
        typeof rem.audioUrl === 'string' && rem.audioUrl.startsWith('https://firebasestorage.googleapis.com/');
      const locHasCloudCover =
        typeof loc.coverUrl === 'string' && loc.coverUrl.startsWith('https://firebasestorage.googleapis.com/');
      const remHasCloudCover =
        typeof rem.coverUrl === 'string' && rem.coverUrl.startsWith('https://firebasestorage.googleapis.com/');
      if ((locHasCloudAudio && !remHasCloudAudio) || (locHasCloudCover && !remHasCloudCover)) {
        const upgraded = {
          ...r,
          ...(locHasCloudAudio && !remHasCloudAudio
            ? { audioUrl: loc.audioUrl, audioStatus: loc.audioStatus || 'verified' }
            : {}),
          ...(locHasCloudCover && !remHasCloudCover
            ? { coverUrl: loc.coverUrl, albumCoverUrl: loc.albumCoverUrl || rem.albumCoverUrl }
            : {}),
        } as T;
        toUpload.push(upgraded);
        return upgraded;
      }
    }
    return r;
  });

  for (const item of local) {
    if (remoteIds.has(item.id)) continue;
    if (seen.has(item.id) && !isLocalUploadItem(item)) continue; // deleted by another admin
    merged.push(item);
    toUpload.push(item);
  }

  remoteIds.forEach((id) => seen.add(id));
  saveSeenIds(seenKey, seen);
  return { merged, toUpload };
}

/** Marks ids as known-to-cloud (call after a successful push). */
export function markSeen(seenKey: string, ids: string[]): void {
  if (!ids.length) return;
  const seen = loadSeenIds(seenKey);
  ids.forEach((id) => seen.add(id));
  saveSeenIds(seenKey, seen);
}

/** Tracks local mutations between persist calls so only real changes are pushed. */
export class ChangeTracker<T extends { id: string }> {
  private baseline = new Map<string, string>();

  reset(items: T[]): void {
    this.baseline = new Map(items.map((i) => [i.id, stableStringify(i)]));
  }

  /** Replace baseline for a single item (e.g. after its URLs were swapped to cloud URLs). */
  accept(item: T): void {
    this.baseline.set(item.id, stableStringify(item));
  }

  diff(items: T[]): { upserts: T[]; deletes: string[] } {
    const next = new Map<string, string>();
    const upserts: T[] = [];
    for (const item of items) {
      const h = stableStringify(item);
      next.set(item.id, h);
      if (this.baseline.get(item.id) !== h) upserts.push(item);
    }
    const deletes: string[] = [];
    this.baseline.forEach((_h, id) => {
      if (!next.has(id)) deletes.push(id);
    });
    this.baseline = next;
    return { upserts, deletes };
  }
}
