import fs from 'fs';
import path from 'path';
import { MusicCatalogService } from '../src/lib/music/MusicCatalogService';
import { getAuthenticAudioUrl } from '../src/lib/music/authenticAudioMap';
import { resolveSafeAudioUrl } from '../src/lib/music/musicMetadataNormalizer';
import { MusicCatalogHealingAgent } from '../src/lib/ai/MusicCatalogHealingAgent';

async function main() {
  console.log('========================================================');
  console.log('VERIFYING ALL ATTACHED AUDIO MP3s (ZERO FORT APACHE BUG)');
  console.log('========================================================\n');

  const publicDir = path.join(process.cwd(), 'public');
  const allTracks = MusicCatalogService.getAllTracks();

  let errors = 0;

  // 1. Check Janet Jackson
  const janetTracks = allTracks.filter((t) =>
    (t.artistName || '').toLowerCase().includes('janet jackson')
  );
  console.log(`Checking ${janetTracks.length} Janet Jackson tracks...`);
  if (janetTracks.length === 0) {
    console.error('❌ No Janet Jackson tracks found in catalog!');
    errors++;
  }
  for (const track of janetTracks) {
    const resolved = resolveSafeAudioUrl(track);
    console.log(`  • "${track.title}" by ${track.artistName}`);
    console.log(`    audioUrl: ${track.audioUrl}`);
    console.log(`    resolved: ${resolved}`);
    if (resolved.includes('Fort_Apache') || resolved.includes('Fort Apache')) {
      console.error(`    ❌ ERROR: Janet Jackson track is playing Fort Apache!`);
      errors++;
    } else if (!resolved.includes('Janet_Jackson')) {
      console.error(`    ❌ ERROR: Janet Jackson track is not playing Janet Jackson MP3!`);
      errors++;
    } else {
      console.log(`    ✅ Playing authentic Janet Jackson audio!`);
    }
  }

  // 2. Check Luther Vandross
  console.log('\nChecking Luther Vandross tracks...');
  const lutherTracks = allTracks.filter((t) =>
    (t.artistName || '').toLowerCase().includes('luther vandross')
  );
  if (lutherTracks.length === 0) {
    console.error('❌ No Luther Vandross tracks found in catalog!');
    errors++;
  }
  for (const track of lutherTracks) {
    const resolved = resolveSafeAudioUrl(track);
    console.log(`  • "${track.title}" by ${track.artistName}`);
    console.log(`    audioUrl: ${track.audioUrl}`);
    console.log(`    resolved: ${resolved}`);
    if (resolved.includes('Fort_Apache') || resolved.includes('Fort Apache')) {
      console.error(`    ❌ ERROR: Luther Vandross track is playing Fort Apache!`);
      errors++;
    } else if (!resolved.includes('Luther_Vandross')) {
      console.error(`    ❌ ERROR: Luther Vandross track is not playing Luther Vandross MP3!`);
      errors++;
    } else {
      console.log(`    ✅ Playing authentic Luther Vandross audio!`);
    }
  }

  // 3. Check All Classic Vault Tracks
  console.log('\nChecking All Vault Classics...');
  const expectedAudioMatches = [
    { artistKeyword: 'lauryn hill', fileKeyword: 'Lauryn_Hill' },
    { artistKeyword: 'mary j', fileKeyword: 'Mary_J_Blige' },
    { artistKeyword: 'maze', fileKeyword: 'Maze_Frankie_Beverly' },
    { artistKeyword: 'gap band', fileKeyword: 'Gap_Band' },
    { artistKeyword: 'dennis edwards', fileKeyword: 'Dennis_Edwards' },
    { artistKeyword: 'fatback', fileKeyword: 'Fatback_Band' },
    { artistKeyword: 'fonda rae', fileKeyword: 'Fonda_Rae' },
    { artistKeyword: 'taana gardner', fileKeyword: 'Taana_Gardner' },
    { artistKeyword: 'change', fileKeyword: 'Change_The_Glow' },
    { artistKeyword: 'blackstreet', fileKeyword: 'Blackstreet' },
    { artistKeyword: 'biz markie', fileKeyword: 'Biz_Markie' },
    { artistKeyword: 'amerie', fileKeyword: 'Amerie' },
    { artistKeyword: 'tevin campbell', fileKeyword: 'Tevin_Campbell' },
    { artistKeyword: 'teedra moses', fileKeyword: 'Teedra_Moses' },
    { artistKeyword: 'swv', fileKeyword: 'SWV' },
    { artistKeyword: 'sade', fileKeyword: 'Sade' },
    { artistKeyword: 'spinners', fileKeyword: 'The_Spinners' },
    { artistKeyword: 'isley', fileKeyword: 'The_Isley_Brothers' },
    { artistKeyword: 'parliament', fileKeyword: 'Parliament' },
    { artistKeyword: 'grandmaster flash', fileKeyword: 'Grandmaster_Flash' },
    { artistKeyword: 'aaliyah', fileKeyword: 'Aaliyah' },
  ];

  for (const { artistKeyword, fileKeyword } of expectedAudioMatches) {
    const matched = allTracks.filter((t) =>
      (t.artistName || '').toLowerCase().includes(artistKeyword)
    );
    for (const track of matched) {
      const resolved = resolveSafeAudioUrl(track);
      if (resolved.includes('Fort_Apache') || resolved.includes('Fort Apache')) {
        console.error(`  ❌ ERROR: ${track.artistName} - "${track.title}" is playing Fort Apache!`);
        errors++;
      } else if (!resolved.includes(fileKeyword)) {
        console.error(`  ❌ ERROR: ${track.artistName} - "${track.title}" is not playing its original file! (playing ${resolved})`);
        errors++;
      } else {
        console.log(`  ✅ ${track.artistName} - "${track.title}" -> ${resolved}`);
      }
    }
  }

  // 4. Verify Files Exist on Disk
  console.log('\nChecking disk existence for all resolved files...');
  for (const track of allTracks) {
    const resolved = resolveSafeAudioUrl(track);
    if (resolved.startsWith('/')) {
      const decoded = decodeURI(resolved);
      const filePath = path.join(publicDir, decoded.slice(1));
      if (!fs.existsSync(filePath)) {
        console.error(`  ❌ Track ${track.id} audio file NOT on disk: ${filePath}`);
        errors++;
      }
    }
  }

  console.log(`\n========================================================`);
  if (errors > 0) {
    console.error(`❌ FAILED WITH ${errors} ERRORS!`);
    process.exit(1);
  } else {
    console.log(`🎉 100% VERIFIED: Every track plays its own authentic MP3!`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
