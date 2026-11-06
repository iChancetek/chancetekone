import fs from 'fs';
import path from 'path';

// 1. Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

import { TavilyCoverArtService } from '../src/lib/ai/tavilyCoverArt';
import { writeID3v2TagToMP3 } from '../src/lib/audio/id3Writer';
import { extractCoverArtFromBuffer } from '../src/lib/audio/id3Parser';

interface TrackDef {
  fileName: string;
  artist: string;
  title: string;
  album: string;
  genre: string;
  year?: number;
  existingLocalCover?: string; // e.g. /audio/uploads/Off_The_Wall_cover.jpg
  slug: string;
}

const CATALOG_TRACKS: TrackDef[] = [
  // Michael Jackson - Off The Wall (Already has local cover)
  { fileName: 'Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3', artist: 'Michael Jackson', title: "Don't Stop 'Til You Get Enough", album: 'Off The Wall', genre: 'Disco / Funk', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_02_-_Rock_With_You.mp3', artist: 'Michael Jackson', title: 'Rock With You', album: 'Off The Wall', genre: 'R&B / Soul / Disco', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_03_-_Workin__Day_And_Night.mp3', artist: 'Michael Jackson', title: "Workin' Day And Night", album: 'Off The Wall', genre: 'Funk / Disco', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_04_-_Get_On_The_Floor.mp3', artist: 'Michael Jackson', title: 'Get On The Floor', album: 'Off The Wall', genre: 'Disco / Funk Bass', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_05_-_Off_The_Wall.mp3', artist: 'Michael Jackson', title: 'Off The Wall', album: 'Off The Wall', genre: 'Disco / Funk', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_06_-_Girlfriend.mp3', artist: 'Michael Jackson', title: 'Girlfriend', album: 'Off The Wall', genre: 'Pop / Soul', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_07_-_She_s_Out_Of_My_Life.mp3', artist: 'Michael Jackson', title: "She's Out Of My Life", album: 'Off The Wall', genre: 'Slow Jams / Soul Ballad', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_08_-_I_Can_t_Help_It.mp3', artist: 'Michael Jackson', title: "I Can't Help It", album: 'Off The Wall', genre: 'Quiet Storm / Jazz-Soul', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_09_-_It_s_The_Falling_In_Love.mp3', artist: 'Michael Jackson', title: "It's The Falling In Love", album: 'Off The Wall', genre: 'Disco / Pop-Soul', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },
  { fileName: 'Michael_Jackson_-_10_-_Burn_This_Disco_Out.mp3', artist: 'Michael Jackson', title: 'Burn This Disco Out', album: 'Off The Wall', genre: 'Disco / High-Energy Funk', year: 1979, existingLocalCover: '/audio/uploads/Off_The_Wall_cover.jpg', slug: 'mj_off_the_wall' },

  // Aaliyah (Already has local covers)
  { fileName: 'Aaliyah_At_Your_Best_Remix.mp3', artist: 'Aaliyah', title: 'At Your Best (You Are Love)', album: "Age Ain't Nothing But A Number", genre: 'R&B / Neo-Soul', year: 1994, existingLocalCover: '/images/albums/aaliyah_age_aint_nothing.jpg', slug: 'aaliyah_age_aint_nothing' },
  { fileName: 'Aaliyah_One_In_A_Million_Mashup.mp3', artist: 'Aaliyah', title: 'One In A Million', album: 'One In A Million', genre: 'R&B / Neo-Soul', year: 1996, existingLocalCover: '/images/albums/aaliyah_one_in_a_million.png', slug: 'aaliyah_one_in_a_million' },

  // Lauryn Hill (Already has APIC tag and album cover)
  { fileName: 'Lauryn_Hill_Ex_Factor_Remix.mp3', artist: 'Lauryn Hill', title: 'Ex-Factor', album: 'The Miseducation of Lauryn Hill', genre: 'R&B / Neo-Soul', year: 1998, slug: 'lauryn_hill_miseducation' },

  // Classic Soul / Funk / R&B Uploads (Tavily search & download)
  { fileName: 'Amerie_1_Thing.mp3', artist: 'Amerie', title: '1 Thing', album: 'Touch', genre: 'R&B / Go-Go', year: 2005, slug: 'amerie_touch' },
  { fileName: 'Amerie_Why_Dont_We_Fall_In_Love.mp3', artist: 'Amerie', title: "Why Don't We Fall In Love", album: 'All I Have', genre: 'R&B / Neo-Soul', year: 2002, slug: 'amerie_all_i_have' },
  { fileName: 'Biz_Markie_Just_A_Friend.mp3', artist: 'Biz Markie', title: 'Just A Friend', album: 'The Biz Never Sleeps', genre: 'Golden Era Hip Hop', year: 1989, slug: 'biz_markie_just_a_friend' },
  { fileName: 'Blackstreet_Joy_12_Remix.mp3', artist: 'Blackstreet', title: 'Joy', album: 'Blackstreet', genre: 'R&B / New Jack Swing', year: 1994, slug: 'blackstreet_joy' },
  { fileName: 'Bobby_Brown_Every_Little_Step.mp3', artist: 'Bobby Brown', title: 'Every Little Step', album: "Don't Be Cruel", genre: 'New Jack Swing / R&B', year: 1988, slug: 'bobby_brown_dont_be_cruel' },
  { fileName: 'Bobby_Brown_My_Prerogative.mp3', artist: 'Bobby Brown', title: 'My Prerogative', album: "Don't Be Cruel", genre: 'New Jack Swing', year: 1988, slug: 'bobby_brown_dont_be_cruel' },
  { fileName: 'Carl_Thomas_I_Wish.mp3', artist: 'Carl Thomas', title: 'I Wish', album: 'Emotional', genre: 'R&B / Soul', year: 2000, slug: 'carl_thomas_emotional' },
  { fileName: 'Carl_Thomas_Summer_Rain.mp3', artist: 'Carl Thomas', title: 'Summer Rain', album: 'Emotional', genre: 'R&B / Soul', year: 2000, slug: 'carl_thomas_emotional' },
  { fileName: 'Change_The_Glow_Of_Love.mp3', artist: 'Change', title: 'The Glow Of Love', album: 'The Glow Of Love', genre: 'Disco / Post-Disco', year: 1980, slug: 'change_glow_of_love' },
  { fileName: 'Dennis_Edwards_Dont_Look_Any_Further.mp3', artist: 'Dennis Edwards', title: "Don't Look Any Further", album: "Don't Look Any Further", genre: 'R&B / Post-Disco', year: 1984, slug: 'dennis_edwards_dont_look' },
  { fileName: 'Fatback_Band_I_Found_Lovin.mp3', artist: 'Fatback Band', title: 'I Found Lovin', album: 'With Love', genre: 'Disco / Funk', year: 1983, slug: 'fatback_band_with_love' },
  { fileName: 'Fonda_Rae_Over_Like_A_Fat_Rat.mp3', artist: 'Fonda Rae', title: 'Over Like A Fat Rat', album: 'Over Like A Fat Rat', genre: 'Disco / Club', year: 1982, slug: 'fonda_rae_fat_rat' },
  { fileName: 'Gap_Band_Outstanding.mp3', artist: 'The Gap Band', title: 'Outstanding', album: 'Gap Band IV', genre: 'R&B / Funk', year: 1982, slug: 'gap_band_iv' },
  { fileName: 'Grandmaster_Flash_Freedom.mp3', artist: 'Grandmaster Flash & The Furious Five', title: 'Freedom', album: 'The Message', genre: 'Golden Era Hip Hop / Old School', year: 1980, slug: 'grandmaster_flash_freedom' },
  { fileName: 'Janet_Jackson_Got_Til_Its_Gone.mp3', artist: 'Janet Jackson', title: "Got 'Til It's Gone", album: 'The Velvet Rope', genre: 'R&B / Neo-Soul', year: 1997, slug: 'janet_jackson_velvet_rope' },
  { fileName: 'Mary_J_Blige_I_Can_Love_You.mp3', artist: 'Mary J. Blige', title: 'I Can Love You', album: 'Share My World', genre: 'R&B / Hip Hop Soul', year: 1997, slug: 'mary_j_blige_share_my_world' },
  { fileName: 'Maze_Frankie_Beverly_Before_I_Let_Go.mp3', artist: 'Maze feat. Frankie Beverly', title: 'Before I Let Go', album: 'Live in New Orleans', genre: 'R&B / Soul', year: 1981, slug: 'maze_live_in_new_orleans' },
  { fileName: 'Parliament_Flashlight.mp3', artist: 'Parliament', title: 'Flashlight', album: 'Funkentelechy Vs. the Placebo Syndrome', genre: 'Funk / P-Funk', year: 1977, slug: 'parliament_funkentelechy' },
  { fileName: 'Sade_By_Your_Side_Neptunes_Remix.mp3', artist: 'Sade', title: 'By Your Side', album: 'Lovers Rock', genre: 'R&B / Soul', year: 2000, slug: 'sade_lovers_rock' },
  { fileName: 'SWV_Right_Here_Human_Nature.mp3', artist: 'SWV', title: 'Right Here (Human Nature)', album: "It's About Time", genre: 'R&B / New Jack Swing', year: 1992, slug: 'swv_its_about_time' },
  { fileName: 'SWV_Youre_The_One.mp3', artist: 'SWV', title: "You're The One", album: 'New Beginning', genre: 'R&B / Neo-Soul', year: 1996, slug: 'swv_new_beginning' },
  { fileName: 'Taana_Gardner_Heartbeat.mp3', artist: 'Taana Gardner', title: 'Heartbeat', album: 'West End Records Vault', genre: 'Disco / Garage House', year: 1981, slug: 'taana_gardner_heartbeat' },
  { fileName: 'Teedra_Moses_Be_Your_Girl.mp3', artist: 'Teedra Moses', title: 'Be Your Girl', album: 'Complex Simplicity', genre: 'R&B / Neo-Soul', year: 2004, slug: 'teedra_moses_complex_simplicity' },
  { fileName: 'Tevin_Campbell_Can_We_Talk.mp3', artist: 'Tevin Campbell', title: 'Can We Talk', album: "I'm Ready", genre: 'R&B / Soul', year: 1993, slug: 'tevin_campbell_im_ready' },
  { fileName: 'The_Isley_Brothers_For_The_Love_Of_You.mp3', artist: 'The Isley Brothers', title: 'For The Love Of You', album: 'The Heat Is On', genre: 'Slow Jams / Soul', year: 1975, slug: 'isley_brothers_heat_is_on' },
  { fileName: 'The_Spinners_Could_It_Be_Im_Falling_In_Love.mp3', artist: 'The Spinners', title: "Could It Be I'm Falling In Love", album: 'Spinners', genre: 'Philly Soul / R&B', year: 1973, slug: 'spinners_spinners' },
  { fileName: 'The_Spinners_Ill_Be_Around.mp3', artist: 'The Spinners', title: "I'll Be Around", album: 'Spinners', genre: 'Philly Soul / R&B', year: 1972, slug: 'spinners_spinners' },
];

async function applyAllArtwork() {
  const uploadsDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
  const albumsDir = path.join(process.cwd(), 'public', 'images', 'albums');
  if (!fs.existsSync(albumsDir)) fs.mkdirSync(albumsDir, { recursive: true });

  const coverUrlRegistry: Record<string, string> = {};
  const processedSlugs = new Map<string, string>(); // slug -> local relative image URL

  console.log(`Starting autonomous cover art processing for ${CATALOG_TRACKS.length} platform catalog tracks...`);

  for (let i = 0; i < CATALOG_TRACKS.length; i++) {
    const trk = CATALOG_TRACKS[i];
    console.log(`\n[${i + 1}/${CATALOG_TRACKS.length}] Processing: "${trk.title}" by ${trk.artist}`);

    let relativeCoverPath: string | undefined;
    let imageBytes: Uint8Array | undefined;
    let mimeType = 'image/jpeg';

    // A. Check if already processed for this album slug
    if (processedSlugs.has(trk.slug)) {
      relativeCoverPath = processedSlugs.get(trk.slug)!;
      const absPath = path.join(process.cwd(), 'public', relativeCoverPath);
      imageBytes = new Uint8Array(fs.readFileSync(absPath));
      mimeType = relativeCoverPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      console.log(`  -> Reusing album artwork: ${relativeCoverPath}`);
    } else if (trk.existingLocalCover) {
      // B. Track already has a verified local file
      const absPath = path.join(process.cwd(), 'public', trk.existingLocalCover);
      if (fs.existsSync(absPath)) {
        relativeCoverPath = trk.existingLocalCover;
        imageBytes = new Uint8Array(fs.readFileSync(absPath));
        mimeType = trk.existingLocalCover.endsWith('.png') ? 'image/png' : 'image/jpeg';
        processedSlugs.set(trk.slug, relativeCoverPath);
        console.log(`  -> Using verified existing local artwork: ${relativeCoverPath}`);
      }
    }

    // C. Search Tavily for artwork if not yet available
    if (!relativeCoverPath || !imageBytes) {
      try {
        console.log(`  -> Searching internet via Tavily for "${trk.title}" - "${trk.album}"...`);
        const candidates = await TavilyCoverArtService.searchCoverArt({
          artist: trk.artist,
          album: trk.album,
          title: trk.title,
          genre: trk.genre,
        });

        if (candidates.length > 0) {
          const best = candidates[0];
          console.log(`  -> Discovered candidate from ${best.domain} (confidence ${best.confidenceScore}%): ${best.url.substring(0, 75)}...`);
          const verified = await TavilyCoverArtService.fetchAndVerifyImage(best.url);
          const ext = verified.mimeType.includes('png') ? 'png' : 'jpg';
          const fileName = `${trk.slug}.${ext}`;
          const savePath = path.join(albumsDir, fileName);
          fs.writeFileSync(savePath, Buffer.from(verified.bytes));
          relativeCoverPath = `/images/albums/${fileName}`;
          imageBytes = verified.bytes;
          mimeType = verified.mimeType;
          processedSlugs.set(trk.slug, relativeCoverPath);
          console.log(`  -> Saved high-res cover to ${relativeCoverPath} (${verified.bytes.length} bytes)`);
        } else {
          console.warn(`  -> No candidate found via Tavily for ${trk.title}`);
        }
      } catch (err: any) {
        console.warn(`  -> Tavily search/download error: ${err.message}`);
      }
    }

    if (relativeCoverPath) {
      coverUrlRegistry[trk.fileName] = relativeCoverPath;
    }

    // D. Embed ID3 APIC frame into physical MP3 file
    const mp3Path = path.join(uploadsDir, trk.fileName);
    if (fs.existsSync(mp3Path) && imageBytes) {
      try {
        const mp3Buf = fs.readFileSync(mp3Path);
        const taggedBuffer = writeID3v2TagToMP3(mp3Buf.buffer, {
          title: trk.title,
          artist: trk.artist,
          album: trk.album,
          genre: trk.genre,
          year: trk.year,
          coverImageBytes: imageBytes,
          coverMimeType: mimeType,
        });
        fs.writeFileSync(mp3Path, Buffer.from(taggedBuffer));
        console.log(`  ✓ Successfully embedded ID3v2.3 APIC cover art tag into ${trk.fileName}`);
      } catch (embedErr: any) {
        console.warn(`  ✗ Failed to embed ID3 into ${trk.fileName}:`, embedErr.message);
      }
    }
  }

  // E. Save registry mapping to .data/catalog-covers.json for instant reference
  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'catalog-covers.json'), JSON.stringify(coverUrlRegistry, null, 2));

  console.log('\n--- Final Summary ---');
  console.log(`Total tracks processed: ${CATALOG_TRACKS.length}`);
  console.log(`Total unique covers mapped: ${Object.keys(coverUrlRegistry).length}`);
  console.log('Saved catalog cover mapping to .data/catalog-covers.json');
}

applyAllArtwork().catch(console.error);
