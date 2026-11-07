import fs from 'fs';
import path from 'path';
import { MOCK_TRACKS, MOCK_ALBUMS } from '../src/lib/mockData';
import { MusicCatalogService } from '../src/lib/music/MusicCatalogService';
import { MusicCatalogHealingAgent } from '../src/lib/ai/MusicCatalogHealingAgent';
import {
  normalizeTrackTitle,
  normalizeArtistName,
  normalizeAlbumTitle,
  resolveSafeAudioUrl,
  isMissingOrGenericCover,
} from '../src/lib/music/musicMetadataNormalizer';
import { getAuthenticAudioUrl } from '../src/lib/music/authenticAudioMap';

async function main() {
  console.log('====================================================');
  console.log('ChanceTEK One — MUSIC CATALOG & COVER ART AUDIT');
  console.log('====================================================\n');

  const publicDir = path.join(process.cwd(), 'public');

  // 1. Verify Fallback Audio Files Exist on Disk
  console.log('1. Checking Core Audio Assets on Disk...');
  const fortApacheSpace = path.join(publicDir, 'audio', 'Fort Apache.mp3');
  const fortApacheUnderscore = path.join(publicDir, 'audio', 'Fort_Apache.mp3');
  
  if (!fs.existsSync(fortApacheUnderscore)) {
    console.error('❌ Missing /audio/Fort_Apache.mp3 space-safe audio file!');
    process.exit(1);
  } else {
    console.log('  ✅ /audio/Fort_Apache.mp3 exists (' + fs.statSync(fortApacheUnderscore).size + ' bytes)');
  }

  // 2. Run Autonomous Healing Agent Diagnostics
  console.log('\n2. Running MusicCatalogHealingAgent.diagnoseCatalog()...');
  const diagnostic = MusicCatalogHealingAgent.diagnoseCatalog();
  console.log(`  Total Tracks Analyzed: ${diagnostic.totalTracks}`);
  console.log(`  Audio Playback Issues Detected: ${diagnostic.unplayableAudioCount}`);
  console.log(`  Cover Art Issues Detected: ${diagnostic.missingCoverCount}`);
  console.log(`  Naming Issues Detected: ${diagnostic.nameIssuesCount}`);

  // 3. Run Autonomous Healing Agent
  console.log('\n3. Running MusicCatalogHealingAgent.healCatalog()...');
  const healing = await MusicCatalogHealingAgent.healCatalog({ dryRun: false, actorEmail: 'verification-agent@chancetekone.com' });
  console.log(`  Tracks Processed: ${healing.totalTracksProcessed}`);
  console.log(`  Audio Streams Repaired: ${healing.audioRepairedCount}`);
  console.log(`  Cover Art Files Repaired: ${healing.coversRepairedCount}`);
  console.log(`  Artist/Album Full Names Repaired: ${healing.namesRepairedCount}`);

  // 4. Verify All Catalog Tracks
  console.log('\n4. Verifying All Tracks in Catalog via MusicCatalogService.getAllTracks()...');
  const allTracks = MusicCatalogService.getAllTracks();
  let failedAudio = 0;
  let failedCover = 0;
  let failedNames = 0;

  for (const track of allTracks) {
    // Check audio stream
    const audioUrl = resolveSafeAudioUrl(track);
    if (!audioUrl) {
      console.error(`  ❌ Track ${track.id} has no audioUrl!`);
      failedAudio++;
    } else if (audioUrl.startsWith('/')) {
      const decoded = decodeURI(audioUrl);
      const filePath = path.join(publicDir, decoded.slice(1));
      if (!fs.existsSync(filePath)) {
        console.error(`  ❌ Track ${track.id} audio file not found on disk: ${filePath}`);
        failedAudio++;
      }
    }

    // Check cover art
    if (isMissingOrGenericCover(track.coverUrl)) {
      console.error(`  ❌ Track ${track.id} has missing or generic cover: ${track.coverUrl}`);
      failedCover++;
    } else if (track.coverUrl?.startsWith('/')) {
      const decodedCover = decodeURI(track.coverUrl);
      const coverPath = path.join(publicDir, decodedCover.slice(1));
      if (!fs.existsSync(coverPath)) {
        console.error(`  ❌ Track ${track.id} cover file not found on disk: ${coverPath}`);
        failedCover++;
      }
    }

    // Check title naming
    if (/^\d{1,3}$/.test(track.title) || track.title.toLowerCase().endsWith('.mp3')) {
      console.error(`  ❌ Track ${track.id} title has track number or filename: "${track.title}"`);
      failedNames++;
    }

    // Check artist name
    if (!track.artistName || track.artistName === 'Unknown Artist') {
      console.error(`  ❌ Track ${track.id} has invalid artist: "${track.artistName}"`);
      failedNames++;
    }

    // Check album name
    if (!track.albumTitle || track.albumTitle === 'Single Release' || track.albumTitle === 'Vault Cuts') {
      // If authentic album is known
      const normAlb = normalizeAlbumTitle(track.artistName, track.title, track.albumTitle);
      if (normAlb !== track.albumTitle) {
        console.error(`  ❌ Track ${track.id} has generic album "${track.albumTitle}" when authentic is "${normAlb}"`);
        failedNames++;
      }
    }
  }

  console.log(`\nResults across ${allTracks.length} tracks:`);
  console.log(`  Audio Failures: ${failedAudio}`);
  console.log(`  Cover Art Failures: ${failedCover}`);
  console.log(`  Naming Failures: ${failedNames}`);

  // Sample Output of 5 Diverse Tracks
  console.log('\nSample Verified Tracks:');
  const samples = allTracks.slice(0, 8);
  for (const s of samples) {
    console.log(`  • [${s.id}] "${s.title}"`);
    console.log(`    Artist: ${s.artistName}`);
    console.log(`    Album:  ${s.albumTitle}`);
    console.log(`    Audio:  ${s.audioUrl}`);
    console.log(`    Cover:  ${s.coverUrl}\n`);
  }

  if (failedAudio > 0 || failedCover > 0 || failedNames > 0) {
    console.error('❌ Validation FAILED with errors.');
    process.exit(1);
  }

  console.log('🎉 ALL AUDITS PASSED WITH 100% HEALTH!');
}

main().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
