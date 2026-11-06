import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getAuthenticAudioUrl,
  getResilientAudioFallback,
  getSameArtistEmergencyFallback,
  isCrossArtistAudioMismatch,
  VERIFIED_SERVER_UPLOADS,
} from '../src/lib/music/authenticAudioMap';
import {
  auditAudioAssociations,
  buildUniqueAudioFileName,
  describeAudioRef,
  detectAudioSignature,
  logAudioDiag,
  getAudioDiagnostics,
  normalizePlayableUrl,
  unescapeIndexedDbUrl,
} from '../src/lib/music/audioAssetIntegrity';
import { AudioStorageService } from '../src/lib/audio/AudioStorageService';
import { sha256Hex, validateUploadBytes, writeAssetExclusive } from '../src/lib/server/audioAssetStore';
import { resolveSafeAudioUrl } from '../src/lib/music/musicMetadataNormalizer';
import { MusicCatalogService, PLATFORM_CANONICAL_TRACKS } from '../src/lib/music/MusicCatalogService';
import { MusicUploadService } from '../src/lib/admin/MusicUploadService';

let passed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ ${message}`);
}

async function run() {
  console.log('=== 1. Exact Song-to-Audio Mapping (No Artist-Wide Stand-In Substitution) ===');
  const janetGotTil = getAuthenticAudioUrl({
    artistName: 'Janet Jackson',
    title: "Got 'Til It's Gone",
    fileName: 'Janet_Jackson_Got_Til_Its_Gone.mp3',
  });
  assert(
    janetGotTil === '/audio/uploads/Janet_Jackson_Got_Til_Its_Gone.mp3',
    'Janet Jackson "Got \'Til It\'s Gone" resolves to its exact studio master'
  );

  const janetOtherSongNoUrl = getAuthenticAudioUrl({
    artistName: 'Janet Jackson',
    title: 'Together Again',
  });
  assert(
    janetOtherSongNoUrl === null,
    'Janet Jackson "Together Again" (without its own audioUrl) does NOT silently substitute "Got \'Til It\'s Gone"'
  );

  const janetUploadedOwnUrl = getAuthenticAudioUrl({
    artistName: 'Janet Jackson',
    title: 'Together Again',
    audioUrl: '/audio/uploads/up-123_abcdef123456_Janet_Jackson_Together_Again.mp3',
  });
  assert(
    janetUploadedOwnUrl === '/audio/uploads/up-123_abcdef123456_Janet_Jackson_Together_Again.mp3',
    'An uploaded Janet Jackson MP3 preserves its own authoritative audioUrl'
  );

  const mjOtherSong = getAuthenticAudioUrl({
    artistName: 'Michael Jackson',
    title: 'Butterflies',
  });
  assert(
    mjOtherSong === null,
    'Unlisted Michael Jackson song does NOT default to Track 01 ("Don\'t Stop \'Til You Get Enough")'
  );

  const janetFallbackOther = getResilientAudioFallback({
    artistName: 'Janet Jackson',
    title: 'Any Time, Any Place',
  });
  assert(
    janetFallbackOther === '',
    'Resilient fallback does NOT substitute another recording for a different song by the same artist'
  );

  console.log('\n=== 2. Luther Vandross Complete Deletion & Zero Cross-Artist Substitution ===');
  assert(
    !VERIFIED_SERVER_UPLOADS.has('Luther_Vandross_Never_Too_Much.mp3'),
    'Luther_Vandross_Never_Too_Much.mp3 is absent from VERIFIED_SERVER_UPLOADS'
  );
  assert(
    getAuthenticAudioUrl({ artistName: 'Luther Vandross', title: 'Never Too Much' }) === null,
    'Luther Vandross getAuthenticAudioUrl returns null'
  );
  assert(
    getResilientAudioFallback() === '',
    'Blanket getResilientAudioFallback() returns empty string'
  );
  assert(
    isCrossArtistAudioMismatch({
      artistName: 'Janet Jackson',
      audioUrl: '/audio/uploads/Luther_Vandross_Never_Too_Much.mp3',
    }) === true,
    'isCrossArtistAudioMismatch blocks Luther Vandross audio on a Janet Jackson track'
  );
  assert(
    MusicCatalogService.isTrackPermanentlyRemoved(
      'trk-pub-luther-vandross-never-too-much',
      'Never Too Much',
      'Luther Vandross'
    ) === true,
    'Catalog tombstone permanently blocks Luther Vandross'
  );

  console.log('\n=== 3. False-Positive Mismatch Elimination (Same Song Title / Different Artist) ===');
  assert(
    isCrossArtistAudioMismatch({
      artistName: 'Beyonce',
      title: 'Freedom',
      audioUrl: '/audio/uploads/up-99_112233445566_Beyonce_Freedom.mp3',
    }) === false,
    'Uploading a song titled "Freedom" by another artist is NOT falsely flagged as Grandmaster Flash'
  );
  assert(
    isCrossArtistAudioMismatch({
      artistName: 'R. Kelly',
      title: 'I Wish',
      audioUrl: '/audio/uploads/up-98_aabbccddeeff_R_Kelly_I_Wish.mp3',
    }) === false,
    'Uploading a song titled "I Wish" by another artist is NOT falsely flagged as Carl Thomas'
  );
  assert(
    isCrossArtistAudioMismatch({
      artistName: 'Janet Jackson',
      title: 'Together Again',
      audioUrl: '/audio/uploads/Lauryn_Hill_Ex_Factor_Remix.mp3',
    }) === true,
    'Actual cross-artist master file (Lauryn_Hill_*) attached to Janet Jackson IS blocked'
  );

  console.log('\n=== 4. Firebase Storage URL Integrity (No %2F -> %252F Double-Encoding) ===');
  const firebaseUrl =
    'https://firebasestorage.googleapis.com/v0/b/spades.appspot.com/o/media%2Fcatalog%2Faudio%2F1700_up-1_Janet.mp3?alt=media&token=abc-123';
  assert(
    normalizePlayableUrl(firebaseUrl) === firebaseUrl,
    'normalizePlayableUrl preserves Firebase Storage %2F object path without double-encoding'
  );
  assert(
    resolveSafeAudioUrl({
      id: 'trk-janet-1',
      title: 'Someone To Call My Lover',
      artistName: 'Janet Jackson',
      audioUrl: firebaseUrl,
    }) === firebaseUrl,
    'resolveSafeAudioUrl preserves Firebase Storage URL untouched'
  );

  console.log('\n=== 5. Binary Audio Signature Validation & Exclusive Collision-Proof Storage ===');
  // Fake MP3 with ID3v2.3 header + padding
  const mp3BufA = Buffer.alloc(2048, 0x41);
  mp3BufA.write('ID3', 0, 'ascii');
  mp3BufA[3] = 3;
  mp3BufA[4] = 0;
  mp3BufA[6] = 0;
  mp3BufA[7] = 0;
  mp3BufA[8] = 0;
  mp3BufA[9] = 10;

  const mp3BufB = Buffer.from(mp3BufA);
  mp3BufB[500] = 0x99; // distinct audio content

  const sigA = detectAudioSignature(new Uint8Array(mp3BufA));
  assert(sigA?.kind === 'mp3' && sigA.mime === 'audio/mpeg', 'detectAudioSignature identifies valid ID3v2 MP3 bytes');

  const notAudio = Buffer.from('<html><body>404 Not Found</body></html>');
  const invalidCheck = validateUploadBytes(notAudio, 'audio');
  assert(invalidCheck.ok === false, 'validateUploadBytes rejects non-audio bytes disguised as .mp3');

  const shaA = sha256Hex(mp3BufA);
  const shaB = sha256Hex(mp3BufB);
  assert(shaA !== shaB, 'Distinct MP3 buffers produce distinct SHA-256 hashes');

  // Identical filenames from different artists / uploads get distinct deterministic storage filenames
  const name1 = buildUniqueAudioFileName({
    uploadId: 'up-artist1-track1',
    sha256: shaA,
    originalName: '01_Track.mp3',
    ext: '.mp3',
  });
  const name2 = buildUniqueAudioFileName({
    uploadId: 'up-artist2-track1',
    sha256: shaB,
    originalName: '01_Track.mp3',
    ext: '.mp3',
  });
  assert(name1 !== name2, 'Two uploads with identical filenames ("01_Track.mp3") receive unique storage names');

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '8spades-audio-test-'));
  try {
    const w1 = await writeAssetExclusive({
      dir: tmpDir,
      fileName: name1,
      urlPrefix: '/audio/uploads',
      buffer: mp3BufA,
    });
    assert(w1.sha256 === shaA && w1.deduplicated === false, 'First exclusive write stores and verifies bytes');

    // Idempotent retry of same uploadId + same bytes succeeds without error
    const w1Retry = await writeAssetExclusive({
      dir: tmpDir,
      fileName: name1,
      urlPrefix: '/audio/uploads',
      buffer: mp3BufA,
    });
    assert(w1Retry.deduplicated === true && w1Retry.sha256 === shaA, 'Idempotent retry reuses verified file');

    // Attempting to overwrite existing filename with different bytes MUST throw
    let collisionCaught = false;
    try {
      await writeAssetExclusive({
        dir: tmpDir,
        fileName: name1,
        urlPrefix: '/audio/uploads',
        buffer: mp3BufB,
      });
    } catch {
      collisionCaught = true;
    }
    assert(collisionCaught === true, 'writeAssetExclusive refuses to overwrite an existing file with different bytes');
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }

  console.log('\n=== 6. In-Memory File Registry Ambiguity Guard ===');
  const f1 = new File([mp3BufA], 'Track_01.mp3', { type: 'audio/mpeg' });
  const f2 = new File([mp3BufB], 'Track_01.mp3', { type: 'audio/mpeg' });
  MusicUploadService.registerFile('up-seq-1', f1);
  MusicUploadService.registerFile('up-seq-2', f2);
  assert(MusicUploadService.getFile('up-seq-1') === f1, 'getFile(up-seq-1) returns exact first File');
  assert(MusicUploadService.getFile('up-seq-2') === f2, 'getFile(up-seq-2) returns exact second File');
  assert(
    MusicUploadService.getFile('Track_01.mp3') === undefined,
    'Ambiguous shared filename "Track_01.mp3" returns undefined instead of cross-wiring to the second upload'
  );

  console.log('\n=== 7. Canonical Seed & Existing Association Audit ===');
  const uploadsDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
  const diskFiles = new Set(
    fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).map((n) => n.toLowerCase()) : []
  );
  const canonicalAudit = auditAudioAssociations(PLATFORM_CANONICAL_TRACKS, {
    existingUploadFiles: diskFiles,
  });
  assert(
    canonicalAudit.summary.errors === 0,
    `Every PLATFORM_CANONICAL_TRACKS entry points to an existing, non-conflicting audio file (errors=${canonicalAudit.summary.errors})`
  );

  // Verify audit catches cross-artist shared assets and missing files
  const syntheticAudit = auditAudioAssociations(
    [
      { id: 't1', title: 'Song One', artistName: 'Artist A', audioUrl: '/audio/uploads/shared.mp3' },
      { id: 't2', title: 'Song Two', artistName: 'Artist B', audioUrl: '/audio/uploads/shared.mp3' },
      { id: 't3', title: 'Ghost Song', artistName: 'Artist C', audioUrl: '/audio/uploads/does_not_exist.mp3' },
    ],
    { existingUploadFiles: new Set(['shared.mp3']) }
  );
  assert(
    syntheticAudit.findings.some((f) => f.code === 'shared_asset_different_artists') &&
      syntheticAudit.findings.some((f) => f.code === 'missing_asset'),
    'auditAudioAssociations detects shared assets across different artists and missing storage files'
  );

  console.log('\n=== 8. Structured Lifecycle Diagnostics & Token Redaction ===');
  logAudioDiag({
    stage: 'resolved',
    trackId: 'trk-diag-1',
    assetKey: firebaseUrl,
    source: 'record',
  });
  const recent = getAudioDiagnostics();
  const last = recent[recent.length - 1];
  assert(
    Boolean(last && last.trackId === 'trk-diag-1' && !last.assetKey?.includes('token=')),
    'logAudioDiag records structured event and strips query tokens from assetKey'
  );
  assert(
    describeAudioRef(firebaseUrl).kind === 'cloud_storage',
    'describeAudioRef classifies Firebase Storage URLs as cloud_storage'
  );

  console.log('\n=== 9. IndexedDB Scheme Preservation & Corrupted indexeddb%3A// Auto-Healing ===');
  const rawIdbUrl = 'indexeddb://up-1793227031638-29-1u2owlchcau';
  const corruptedIdbUrl = 'https://8ofspadesworks.us/music/indexeddb%3A//up-1793227031638-29-1u2owlchcau';
  assert(
    normalizePlayableUrl(rawIdbUrl) === rawIdbUrl,
    'normalizePlayableUrl preserves indexeddb:// scheme without encoding colon as %3A'
  );
  assert(
    unescapeIndexedDbUrl(corruptedIdbUrl) === rawIdbUrl,
    'unescapeIndexedDbUrl repairs https://.../music/indexeddb%3A//up-... back to indexeddb://up-...'
  );
  assert(
    normalizePlayableUrl(corruptedIdbUrl) === rawIdbUrl,
    'normalizePlayableUrl heals previously corrupted indexeddb%3A// URLs'
  );
  assert(
    describeAudioRef(rawIdbUrl).kind === 'indexeddb' &&
      describeAudioRef(corruptedIdbUrl).kind === 'indexeddb',
    'describeAudioRef classifies both indexeddb:// and healed indexeddb%3A// as indexeddb'
  );
  assert(
    AudioStorageService.isIndexedDBUrl(corruptedIdbUrl) === true &&
      AudioStorageService.extractIdFromIndexedDBUrl(corruptedIdbUrl) === 'up-1793227031638-29-1u2owlchcau',
    'AudioStorageService extracts exact upload ID from both raw and percent-encoded indexeddb URLs'
  );
  assert(
    resolveSafeAudioUrl({
      id: 'up-1793227031638-29-1u2owlchcau',
      title: 'Together Again',
      artistName: 'Janet Jackson',
      audioUrl: corruptedIdbUrl,
    }) === rawIdbUrl,
    'resolveSafeAudioUrl heals corrupted indexeddb%3A// URLs and preserves local vault binding'
  );
  assert(
    getSameArtistEmergencyFallback({
      artistName: 'Janet Jackson',
      title: 'Together Again',
    }) === '/audio/uploads/Janet_Jackson_Got_Til_Its_Gone.mp3' &&
      getSameArtistEmergencyFallback({
        artistName: 'Luther Vandross',
        title: 'Never Too Much',
      }) === '',
    'getSameArtistEmergencyFallback provides same-artist studio fallback for Janet Jackson while blocking deleted Luther Vandross'
  );

  console.log(`\n🎉 ALL ${passed} AUDIO PUBLISHING, MAPPING & STREAMING INTEGRITY TESTS PASSED!`);
}

run().catch((err) => {
  console.error('❌ Test suite failed with error:', err);
  process.exit(1);
});
