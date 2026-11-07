/**
 * ChanceTEKone — Bulk content deletion planner & executor.
 *
 * Pure planning logic (dependency resolution, overlap detection, shared-asset protection) is
 * separated from execution so it can be unit-tested and so the confirmation dialog can show the
 * exact scope BEFORE anything is deleted.
 *
 * All catalog deletions are recoverable: songs/albums go to the existing 45-day Recovery Vault,
 * other entities use their services' soft-remove lists. Media files are never purged here; an asset
 * is only eligible for cleanup when NO remaining record references it.
 */

export type BulkContentType = 'song' | 'album' | 'audiobook' | 'podcast' | 'video' | 'producer' | 'merch';

export interface BulkSelectionItem {
  id: string;
  type: BulkContentType;
  title: string;
}

export type AlbumTrackPolicy = 'delete_tracks' | 'detach_tracks';
export type ProducerTrackPolicy = 'delete_tracks' | 'keep_tracks';

export interface BulkDeleteOptions {
  albumTrackPolicy: AlbumTrackPolicy;
  producerTrackPolicy: ProducerTrackPolicy;
}

export interface CatalogSnapshot {
  tracks: { id: string; title: string; albumId?: string; albumTitle?: string; artistId?: string; artistName?: string; coverUrl?: string; audioUrl?: string }[];
  albums: { id: string; title: string; trackIds: string[]; coverUrl?: string }[];
  producers: { id: string; name: string }[];
  /** Asset references from content types outside music (videos, audiobooks, merch, ...). */
  otherAssetRefs?: { recordKey: string; url: string }[];
}

export interface PlannedOperation {
  key: string; // `${type}:${id}`
  type: BulkContentType;
  id: string;
  title: string;
  /** Tracks that will be deleted because of this operation (album/producer cascades). */
  cascadeTrackIds: string[];
  /** Tracks whose album link will be cleared but which stay live. */
  detachTrackIds: string[];
}

export interface BulkDeletePlan {
  operations: PlannedOperation[];
  /** Selected items skipped because a selected parent already covers them. */
  overlaps: { key: string; title: string; coveredBy: string }[];
  /** Selected items that no longer exist. */
  missing: BulkSelectionItem[];
  breakdown: Record<BulkContentType, number>;
  totalTracksAffected: number;
  dependencyWarnings: string[];
  /** Assets that would become unreferenced (eligible for later cleanup). */
  orphanedAssets: string[];
  /** Assets still used by records that are NOT being deleted — always retained. */
  sharedAssetsRetained: string[];
  reversible: true;
  fileHandling: string;
}

const key = (type: BulkContentType, id: string) => `${type}:${id}`;

function producerTrackIds(snapshot: CatalogSnapshot, producerId: string, name: string): string[] {
  const n = name.toLowerCase().trim();
  return snapshot.tracks
    .filter((t) => t.artistId === producerId || (t.artistName || '').toLowerCase().trim() === n)
    .map((t) => t.id);
}

function albumTrackIds(snapshot: CatalogSnapshot, album: CatalogSnapshot['albums'][number]): string[] {
  // By id only — the previous title-based removal could delete a different artist's album with the same name.
  const ids = new Set(album.trackIds);
  snapshot.tracks.forEach((t) => t.albumId === album.id && ids.add(t.id));
  return [...ids].filter((id) => snapshot.tracks.some((t) => t.id === id));
}

export function planBulkDeletion(
  selection: BulkSelectionItem[],
  snapshot: CatalogSnapshot,
  options: BulkDeleteOptions
): BulkDeletePlan {
  const unique = new Map<string, BulkSelectionItem>();
  selection.forEach((s) => unique.set(key(s.type, s.id), s));

  const trackIds = new Set(snapshot.tracks.map((t) => t.id));
  const albumMap = new Map(snapshot.albums.map((a) => [a.id, a]));
  const producerMap = new Map(snapshot.producers.map((p) => [p.id, p]));

  const missing: BulkSelectionItem[] = [];
  const operations: PlannedOperation[] = [];
  const warnings: string[] = [];

  for (const item of unique.values()) {
    const exists =
      item.type === 'song' ? trackIds.has(item.id)
      : item.type === 'album' ? albumMap.has(item.id)
      : item.type === 'producer' ? producerMap.has(item.id)
      : true; // other types validated by their services at execution time
    if (!exists) {
      missing.push(item);
      continue;
    }
    const op: PlannedOperation = { key: key(item.type, item.id), type: item.type, id: item.id, title: item.title, cascadeTrackIds: [], detachTrackIds: [] };
    if (item.type === 'album') {
      const ids = albumTrackIds(snapshot, albumMap.get(item.id)!);
      if (options.albumTrackPolicy === 'delete_tracks') op.cascadeTrackIds = ids;
      else op.detachTrackIds = ids;
    }
    if (item.type === 'producer') {
      const p = producerMap.get(item.id)!;
      const ids = producerTrackIds(snapshot, p.id, p.name);
      if (options.producerTrackPolicy === 'delete_tracks') op.cascadeTrackIds = ids;
      else if (ids.length) warnings.push(`Producer "${p.name}" has ${ids.length} track(s) that will stay live.`);
    }
    operations.push(op);
  }

  // Overlap detection: a selected song already deleted by a selected album/producer cascade.
  const cascadeOwner = new Map<string, string>();
  operations.forEach((op) => op.cascadeTrackIds.forEach((t) => !cascadeOwner.has(t) && cascadeOwner.set(t, op.title)));
  const overlaps: BulkDeletePlan['overlaps'] = [];
  const finalOps = operations.filter((op) => {
    if (op.type === 'song' && cascadeOwner.has(op.id)) {
      overlaps.push({ key: op.key, title: op.title, coveredBy: cascadeOwner.get(op.id)! });
      return false;
    }
    return true;
  });
  // A track cascaded by two parents is processed once.
  const seen = new Set<string>();
  finalOps.forEach((op) => {
    op.cascadeTrackIds = op.cascadeTrackIds.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  });
  // Detaching a track that another op deletes is pointless.
  finalOps.forEach((op) => (op.detachTrackIds = op.detachTrackIds.filter((t) => !seen.has(t))));

  const deletedTrackIds = new Set<string>([...seen, ...finalOps.filter((o) => o.type === 'song').map((o) => o.id)]);
  const deletedAlbumIds = new Set(finalOps.filter((o) => o.type === 'album').map((o) => o.id));

  // Reference-aware asset accounting.
  const refs = new Map<string, Set<string>>();
  const addRef = (url: string | undefined, recordKey: string) => {
    if (!url || url.includes('images.unsplash.com')) return;
    if (!refs.has(url)) refs.set(url, new Set());
    refs.get(url)!.add(recordKey);
  };
  snapshot.tracks.forEach((t) => { addRef(t.coverUrl, `song:${t.id}`); addRef(t.audioUrl, `song:${t.id}`); });
  snapshot.albums.forEach((a) => addRef(a.coverUrl, `album:${a.id}`));
  snapshot.otherAssetRefs?.forEach((r) => addRef(r.url, r.recordKey));

  const deletedKeys = new Set<string>([...[...deletedTrackIds].map((id) => `song:${id}`), ...[...deletedAlbumIds].map((id) => `album:${id}`)]);
  finalOps.forEach((o) => deletedKeys.add(o.key));
  const orphaned: string[] = [];
  const retained: string[] = [];
  for (const [url, holders] of refs) {
    const touched = [...holders].some((h) => deletedKeys.has(h));
    if (!touched) continue;
    if ([...holders].every((h) => deletedKeys.has(h))) orphaned.push(url);
    else retained.push(url);
  }

  const breakdown = { song: 0, album: 0, audiobook: 0, podcast: 0, video: 0, producer: 0, merch: 0 } as Record<BulkContentType, number>;
  finalOps.forEach((o) => breakdown[o.type]++);

  return {
    operations: finalOps,
    overlaps,
    missing,
    breakdown,
    totalTracksAffected: deletedTrackIds.size,
    dependencyWarnings: warnings,
    orphanedAssets: orphaned,
    sharedAssetsRetained: retained,
    reversible: true,
    fileHandling:
      'Records are moved to the recovery vault / soft-removed. Media files are retained; shared artwork and audio still referenced elsewhere are never removed.',
  };
}

// ---------------------------------------------------------------------------------------------------

export type BulkItemOutcome = 'deleted' | 'skipped' | 'failed';

export interface BulkJobItemResult {
  key: string;
  title: string;
  outcome: BulkItemOutcome;
  message?: string;
}

export interface BulkJobProgress {
  jobId: string;
  total: number;
  processed: number;
  deleted: number;
  skipped: number;
  failed: number;
  percent: number;
  status: 'running' | 'completed' | 'completed_with_errors';
  results: BulkJobItemResult[];
}

export type OperationExecutor = (op: PlannedOperation) => Promise<void> | void;

/**
 * Executes a plan sequentially, yielding between items so large jobs don't freeze the UI.
 * One failure never stops the rest; failed operations are returned for a safe retry
 * (every executor is idempotent: deleting an already-removed record is a no-op skip).
 */
export async function executeBulkPlan(
  plan: BulkDeletePlan,
  executor: OperationExecutor,
  onProgress?: (p: BulkJobProgress) => void,
  jobId = `del-${Date.now().toString(36)}`
): Promise<BulkJobProgress & { failedOperations: PlannedOperation[] }> {
  const progress: BulkJobProgress = {
    jobId,
    total: plan.operations.length + plan.overlaps.length + plan.missing.length,
    processed: 0, deleted: 0, skipped: 0, failed: 0, percent: 0,
    status: 'running',
    results: [],
  };
  const failedOperations: PlannedOperation[] = [];
  const push = (r: BulkJobItemResult) => {
    progress.results.push(r);
    progress.processed++;
    progress[r.outcome === 'deleted' ? 'deleted' : r.outcome === 'skipped' ? 'skipped' : 'failed']++;
    progress.percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 100;
    onProgress?.({ ...progress, results: [...progress.results] });
  };

  plan.overlaps.forEach((o) => push({ key: o.key, title: o.title, outcome: 'skipped', message: `Already included via "${o.coveredBy}".` }));
  plan.missing.forEach((m) => push({ key: key(m.type, m.id), title: m.title, outcome: 'skipped', message: 'Record no longer exists.' }));

  for (const op of plan.operations) {
    try {
      await executor(op);
      push({ key: op.key, title: op.title, outcome: 'deleted' });
    } catch (e) {
      failedOperations.push(op);
      push({ key: op.key, title: op.title, outcome: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  progress.status = progress.failed > 0 ? 'completed_with_errors' : 'completed';
  onProgress?.({ ...progress, results: [...progress.results] });
  return { ...progress, failedOperations };
}
