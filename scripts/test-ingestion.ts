/* eslint-disable */
import assert from 'node:assert/strict';
import { captureDrop, scanDrop, scanFileList, mergeScans, retryFailedFolders, summarizeScan, type FsEntryLike, type FileLike } from '../src/lib/ingestion/folderScanner';
import { groupTracksIntoAlbums, type GroupingTrack } from '../src/lib/ingestion/albumGrouping';
import { planArtwork } from '../src/lib/ingestion/artworkVerification';
import { planBulkDeletion, executeBulkPlan, type CatalogSnapshot } from '../src/lib/admin/bulkDeletion';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(name); console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

// ---------- fake FS ----------
type Tree = { [name: string]: Tree | number | 'FAIL' };
function file(name: string, size: number): FsEntryLike<FileLike> {
  return { isFile: true, isDirectory: false, name, file: (ok: (f: FileLike) => void) => setTimeout(() => ok({ name, size, type: '' , lastModified: 1 }), 0) } as any;
}
function dir(name: string, tree: Tree | 'FAIL', failTimes = { n: tree === 'FAIL' ? 1 : 0 }, real?: Tree): FsEntryLike<FileLike> {
  return {
    isFile: false, isDirectory: true, name,
    createReader() {
      // Return entries in pages of 100 to exercise pagination.
      let served = false;
      const children = Object.entries(real ?? (tree === 'FAIL' ? {} : tree)).map(([n, v]) =>
        typeof v === 'number' ? file(n, v) : dir(n, v as any));
      let offset = 0;
      return {
        readEntries(ok: any, err: any) {
          setTimeout(() => {
            if (failTimes.n > 0 && !served) { failTimes.n--; served = true; return err(new Error('NotReadableError')); }
            served = true;
            const page = children.slice(offset, offset + 100); offset += page.length; ok(page);
          }, 0);
        },
      };
    },
  } as any;
}

const mjTree: Tree = {
  'Michael Jackson': {
    Thriller: { '01 Wanna Be Startin.mp3': 100, '04 Thriller.mp3': 200, 'cover.jpg': 5 },
    'Off the Wall': { '01 Dont Stop.mp3': 110, '02 Rock With You.mp3': 120 },
  },
  'Diana Ross': { Diana: { '01 Upside Down.mp3': 90, 'notes.txt': 1 } },
  Empty: {},
};

console.log('\nFolder scanner');
await test('captureDrop grabs every item synchronously', () => {
  let calls = 0;
  const items = Array.from({ length: 5 }, (_, i) => ({ kind: 'file', webkitGetAsEntry: () => { calls++; return dir(`F${i}`, {}); } }));
  const cap = captureDrop({ items });
  assert.equal(cap.roots.length, 5); assert.equal(calls, 5);
});
await test('recursive multi-root scan keeps relative paths and counts', async () => {
  const roots = Object.entries(mjTree).map(([n, t]) => dir(n, t as Tree));
  const r = await scanDrop({ roots, looseFiles: [] });
  assert.equal(r.selectedFolderCount, 3);
  assert.equal(r.audioFileCount, 5);
  assert.equal(r.imageFileCount, 1);
  assert.equal(r.unsupportedFileCount, 1);
  assert.equal(r.nestedFolderCount, 3);
  assert.ok(r.files.some((f) => f.relativePath === 'Michael Jackson/Thriller/04 Thriller.mp3'));
  assert.equal(r.folders.find((f) => f.path === 'Empty')!.status, 'empty');
  assert.equal(r.folders.find((f) => f.path === 'Michael Jackson')!.totalAudioCount, 4);
});
await test('identically named tracks in different folders do not collide', async () => {
  const r = await scanDrop({ roots: [dir('A', { 'Track 01.mp3': 10 }), dir('B', { 'Track 01.mp3': 10 })], looseFiles: [] });
  assert.equal(new Set(r.files.map((f) => f.id)).size, 2);
});
await test('300-folder limit reports overflow instead of dropping silently', async () => {
  const roots = Array.from({ length: 305 }, (_, i) => dir(`Album ${i}`, { 'a.mp3': i + 1 }));
  const r = await scanDrop({ roots, looseFiles: [] });
  assert.equal(r.selectedFolderCount, 300);
  assert.equal(r.overflowFolders.length, 5);
  assert.equal(r.audioFileCount, 300);
});
await test('readEntries pagination (>100 entries)', async () => {
  const t: Tree = {}; for (let i = 0; i < 250; i++) t[`${i}.mp3`] = 1 + i;
  const r = await scanDrop({ roots: [dir('Big', t)], looseFiles: [] });
  assert.equal(r.audioFileCount, 250);
});
await test('unreadable folder is isolated and retryable', async () => {
  const failing = dir('Broken', 'FAIL', { n: 1 }, { 'x.mp3': 5 });
  const r = await scanDrop({ roots: [failing, dir('Ok', { 'y.mp3': 6 })], looseFiles: [] });
  assert.equal(r.failedFolderCount, 1); assert.equal(r.audioFileCount, 1);
  const r2 = await retryFailedFolders(r);
  assert.equal(r2.failedFolderCount, 0); assert.equal(r2.audioFileCount, 2);
});
await test('scanFileList + mergeScans dedupe', () => {
  const mk = (p: string, size: number) => ({ name: p.split('/').pop()!, size, type: '', lastModified: 1, webkitRelativePath: p });
  const a = scanFileList([mk('MJ/Thriller/a.mp3', 1), mk('MJ/Thriller/b.mp3', 2)]);
  const b = scanFileList([mk('MJ/Thriller/a.mp3', 1), mk('DR/Diana/c.mp3', 3)]);
  const m = mergeScans(a, b);
  assert.equal(m.audioFileCount, 3); assert.equal(m.selectedFolderCount, 2);
  assert.equal(summarizeScan(m).filesReadyForUpload, 3);
});

console.log('\nAlbum grouping');
const T = (id: string, o: Partial<GroupingTrack>): GroupingTrack => ({ id, title: id, artist: 'Michael Jackson', ...o });
const mjTracks = [
  T('t1', { album: 'Thriller', trackNumber: 1, year: 1982, artworkHash: 'H_THR', sourceFolderPath: 'MJ/Thriller' }),
  T('t2', { album: 'Thriller', trackNumber: 4, year: 1982, artworkHash: 'H_THR', sourceFolderPath: 'MJ/Thriller' }),
  T('o1', { album: 'Off the Wall', trackNumber: 1, year: 1979, artworkHash: 'H_OTW', sourceFolderPath: 'MJ/Off the Wall' }),
  T('o2', { album: 'Off the Wall', trackNumber: 2, year: 1979, artworkHash: 'H_OTW', sourceFolderPath: 'MJ/Off the Wall' }),
];
await test('Thriller and Off the Wall stay separate', () => {
  const r = groupTracksIntoAlbums(mjTracks);
  assert.equal(r.groups.length, 2);
  assert.notEqual(r.assignments.t1.groupId, r.assignments.o1.groupId);
  r.groups.forEach((g) => assert.equal(g.status, 'confirmed'));
});
await test('group ids are stable across reruns and existing albums are reused', () => {
  const a = groupTracksIntoAlbums(mjTracks); const b = groupTracksIntoAlbums([...mjTracks].reverse());
  assert.deepEqual(a.groups.map((g) => g.id).sort(), b.groups.map((g) => g.id).sort());
  const c = groupTracksIntoAlbums(mjTracks, [{ id: 'album-thriller', title: 'Thriller', artistName: 'Michael Jackson' }]);
  assert.equal(c.assignments.t1.groupId, 'album-thriller');
});
await test('multi-disc ordering', () => {
  const r = groupTracksIntoAlbums([
    T('d2t1', { album: 'HIStory', discNumber: 2, trackNumber: 1 }),
    T('d1t2', { album: 'HIStory', discNumber: 1, trackNumber: 2 }),
    T('d1t1', { album: 'HIStory', discNumber: 1, trackNumber: 1 }),
  ]);
  assert.deepEqual(r.groups[0].trackIds, ['d1t1', 'd1t2', 'd2t1']); assert.equal(r.groups[0].discCount, 2);
});
await test('missing album is never invented from folder name', () => {
  const r = groupTracksIntoAlbums([T('x', { sourceFolderPath: 'Music Collection/Random' })]);
  assert.equal(r.assignments.x.groupId, null);
  assert.equal(r.assignments.x.suggestedAlbum, 'Random');
  assert.ok(r.assignments.x.needsReview);
});
await test('untagged sibling with matching artwork is inferred but flagged', () => {
  const r = groupTracksIntoAlbums([...mjTracks, T('u', { artworkHash: 'H_THR', sourceFolderPath: 'MJ/Thriller' })]);
  assert.equal(r.assignments.u.groupId, r.assignments.t1.groupId); assert.ok(r.assignments.u.needsReview);
});
await test('duplicate track numbers lower confidence', () => {
  const r = groupTracksIntoAlbums([T('a', { album: 'Bad', trackNumber: 1 }), T('b', { album: 'Bad', trackNumber: 1 })]);
  assert.ok(r.groups[0].needsReview);
});

console.log('\nArtwork verification');
const jpeg = (tag: string) => `data:image/jpeg;base64,/9j/4AAQ${Buffer.from(tag.padEnd(200, '.')).toString('base64')}`;
await test('each album keeps its own cover (no Thriller cover on Off the Wall)', () => {
  const g = groupTracksIntoAlbums(mjTracks);
  const thrId = g.assignments.t1.groupId!, otwId = g.assignments.o1.groupId!;
  const covers: Record<string, string> = { t1: jpeg('THR'), t2: jpeg('THR'), o1: jpeg('OTW'), o2: jpeg('OTW') };
  const plan = planArtwork(
    mjTracks.map((t) => ({ id: t.id, groupId: g.assignments[t.id].groupId, coverUrl: covers[t.id], coverOrigin: 'embedded' })),
    g.groups.map((x) => ({ id: x.id, status: x.status, sourceFolders: x.sourceFolders })),
  );
  assert.equal(plan.albums[thrId].coverUrl, jpeg('THR'));
  assert.equal(plan.albums[otwId].coverUrl, jpeg('OTW'));
  assert.equal(plan.tracks.o1.coverUrl, jpeg('OTW'));
  assert.equal(Object.keys(plan.assets).length, 2, 'assets deduped');
  assert.equal(plan.albums[thrId].verification.status, 'verified');
});
await test('artwork-less track does NOT borrow another album cover', () => {
  const plan = planArtwork(
    [{ id: 'a', groupId: 'G1', coverUrl: jpeg('THR'), coverOrigin: 'embedded' }, { id: 'b', groupId: 'G2' }],
    [{ id: 'G1', status: 'confirmed', sourceFolders: [] }, { id: 'G2', status: 'confirmed', sourceFolders: [] }],
  );
  assert.equal(plan.tracks.b.coverUrl, undefined);
  assert.equal(plan.tracks.b.verification.status, 'missing');
});
await test('distinct track artwork preserved and flagged', () => {
  const plan = planArtwork(
    [{ id: 'a', groupId: 'G', coverUrl: jpeg('A'), coverOrigin: 'embedded' }, { id: 'b', groupId: 'G', coverUrl: jpeg('A'), coverOrigin: 'embedded' }, { id: 'c', groupId: 'G', coverUrl: jpeg('C'), coverOrigin: 'embedded' }],
    [{ id: 'G', status: 'confirmed', sourceFolders: [] }],
  );
  assert.equal(plan.tracks.c.coverUrl, jpeg('C')); assert.ok(plan.tracks.c.verification.distinctFromAlbum);
  assert.equal(plan.tracks.c.verification.status, 'needs_review');
});
await test('existing catalog cover is never overwritten', () => {
  const plan = planArtwork(
    [{ id: 'a', groupId: 'G', coverUrl: jpeg('NEW'), coverOrigin: 'embedded' }],
    [{ id: 'G', status: 'confirmed', sourceFolders: [], existingArtworkUrl: '/audio/uploads/Thriller_cover.jpg' }],
  );
  assert.equal(plan.albums.G.coverUrl, '/audio/uploads/Thriller_cover.jpg');
  assert.equal(plan.albums.G.verification.status, 'needs_review');
});
await test('undecodable artwork goes to review', () => {
  const plan = planArtwork([{ id: 'a', groupId: 'G', coverUrl: 'data:image/jpeg;base64,AAAA', coverOrigin: 'embedded' }], [{ id: 'G', status: 'confirmed', sourceFolders: [] }]);
  assert.notEqual(plan.tracks.a.verification.status, 'verified');
});

console.log('\nBulk deletion');
const snap: CatalogSnapshot = {
  tracks: [
    { id: 's1', title: 'Thriller', albumId: 'A1', coverUrl: '/c/thr.jpg' },
    { id: 's2', title: 'Beat It', albumId: 'A1', coverUrl: '/c/thr.jpg' },
    { id: 's3', title: 'Rock With You', albumId: 'A2', coverUrl: '/c/otw.jpg' },
    { id: 's4', title: 'Other Thriller', albumId: 'A3', coverUrl: '/c/thr.jpg' },
  ],
  albums: [
    { id: 'A1', title: 'Thriller', trackIds: ['s1', 's2'], coverUrl: '/c/thr.jpg' },
    { id: 'A2', title: 'Off the Wall', trackIds: ['s3'], coverUrl: '/c/otw.jpg' },
    { id: 'A3', title: 'Thriller', trackIds: ['s4'], coverUrl: '/c/thr.jpg' },
  ],
  producers: [],
};
await test('album deletion is by id, overlaps detected, shared assets retained', () => {
  const p = planBulkDeletion(
    [{ id: 'A1', type: 'album', title: 'Thriller' }, { id: 's1', type: 'song', title: 'Thriller' }, { id: 'zz', type: 'song', title: 'Gone' }],
    snap, { albumTrackPolicy: 'delete_tracks', producerTrackPolicy: 'keep_tracks' });
  assert.equal(p.operations.length, 1);
  assert.deepEqual(p.operations[0].cascadeTrackIds.sort(), ['s1', 's2']);
  assert.equal(p.overlaps.length, 1); assert.equal(p.missing.length, 1);
  assert.ok(p.sharedAssetsRetained.includes('/c/thr.jpg'), 'cover still used by A3');
  assert.ok(!p.operations.some((o) => o.cascadeTrackIds.includes('s4')));
});
await test('detach policy keeps tracks', () => {
  const p = planBulkDeletion([{ id: 'A2', type: 'album', title: 'Off the Wall' }], snap, { albumTrackPolicy: 'detach_tracks', producerTrackPolicy: 'keep_tracks' });
  assert.deepEqual(p.operations[0].detachTrackIds, ['s3']); assert.equal(p.operations[0].cascadeTrackIds.length, 0);
});
await test('failures are isolated and retryable', async () => {
  const p = planBulkDeletion([{ id: 'A1', type: 'album', title: 'T' }, { id: 'A2', type: 'album', title: 'O' }], snap, { albumTrackPolicy: 'delete_tracks', producerTrackPolicy: 'keep_tracks' });
  let fail = true;
  const res = await executeBulkPlan(p, (op) => { if (op.id === 'A2' && fail) throw new Error('boom'); });
  assert.equal(res.deleted, 1); assert.equal(res.failed, 1); assert.equal(res.status, 'completed_with_errors');
  fail = false;
  const retry = await executeBulkPlan({ ...p, operations: res.failedOperations, overlaps: [], missing: [] }, () => {});
  assert.equal(retry.deleted, 1); assert.equal(retry.status, 'completed');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
