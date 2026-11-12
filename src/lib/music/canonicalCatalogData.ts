/**
 * ChanceTEK One — Pure Canonical Track & Cover Catalog Data
 * Safe to import in both server route handlers and client services.
 */

import { Track } from '@/types/media';

/**
 * Authentic artwork that ships with the platform, keyed by (artist, album).
 * Used ONLY when a track's own cover is missing/generic or is a KNOWN mismatch
 * (e.g. the Thriller cover wrongly attached to an Off The Wall track). It never
 * overwrites any other verified artwork and is never applied by artist name alone.
 */
export const KNOWN_ALBUM_COVERS: { artist: string; album: string; cover: string }[] = [
  // Michael Jackson
  { artist: 'michael jackson', album: 'thriller', cover: '/audio/uploads/Thriller_cover.jpg' },
  { artist: 'michael jackson', album: 'off the wall', cover: '/audio/uploads/Off_The_Wall_cover.jpg' },

  // Aaliyah authentic album covers
  { artist: 'aaliyah', album: 'age aint nothing but a number', cover: '/images/albums/aaliyah_age_aint_nothing.jpg' },
  { artist: 'aaliyah', album: 'one in a million', cover: '/images/albums/aaliyah_one_in_a_million.png' },
  { artist: 'aaliyah', album: 'aaliyah', cover: '/images/albums/aaliyah_2001.png' },
  { artist: 'aaliyah', album: 'i care 4 u', cover: '/images/albums/aaliyah_i_care_4_u.png' },
  { artist: 'aaliyah', album: 'ultimate', cover: '/images/albums/aaliyah_ultimate.jpg' },
  { artist: 'aaliyah', album: 'ultimate aaliyah', cover: '/images/albums/aaliyah_ultimate.jpg' },
  { artist: 'aaliyah', album: 'romeo must die', cover: '/images/albums/aaliyah_ultimate.jpg' },
  { artist: 'aaliyah', album: 'master archive', cover: '/images/albums/aaliyah_2001.png' },
  { artist: 'aaliyah', album: 'aaliyah master archive', cover: '/images/albums/aaliyah_2001.png' },

  // Alicia Keys authentic album covers
  { artist: 'alicia keys', album: 'songs in a minor', cover: '/images/albums/alicia_keys_songs_in_a_minor.png' },
  { artist: 'alicia keys', album: 'remixed unplugged in a minor', cover: '/images/albums/alicia_keys_songs_in_a_minor.png' },
  { artist: 'alicia keys', album: 'remixed in a minor', cover: '/images/albums/alicia_keys_songs_in_a_minor.png' },
  { artist: 'alicia keys', album: 'the diary of alicia keys', cover: '/images/albums/alicia_keys_diary.png' },
  { artist: 'alicia keys', album: 'diary of alicia keys', cover: '/images/albums/alicia_keys_diary.png' },
  { artist: 'alicia keys', album: 'as i am', cover: '/images/albums/alicia_keys_as_i_am.png' },
  { artist: 'alicia keys', album: 'alicia keys remixed unreleased', cover: '/images/albums/alicia_keys_brotha.jpg' },
  { artist: 'alicia keys', album: 'remixed unreleased', cover: '/images/albums/alicia_keys_brotha.jpg' },
  { artist: 'alicia keys', album: 'single release vault cuts', cover: '/images/albums/alicia_keys_diary.png' },
  { artist: 'alicia keys', album: 'single release', cover: '/images/albums/alicia_keys_diary.png' },
  { artist: 'alicia keys', album: 'vault cuts', cover: '/images/albums/alicia_keys_diary.png' },
  { artist: 'alicia keys', album: 'anthology', cover: '/images/albums/alicia_keys_diary.png' },

  // Luther Vandross authentic album covers
  { artist: 'luther vandross', album: 'never too much', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'forever for always for love', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'give me a reason', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'give me the reason', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'the night i fell in love', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'busy body', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'any love', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'single release', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'vault cuts', cover: '/images/albums/luther_vandross_never_too_much.jpg' },
  { artist: 'luther vandross', album: 'collection', cover: '/images/albums/luther_vandross_never_too_much.jpg' },

  // Amerie
  { artist: 'amerie', album: 'touch', cover: '/images/albums/amerie_touch.png' },
  { artist: 'amerie', album: 'all i have', cover: '/images/albums/amerie_all_i_have.jpg' },

  // Biz Markie
  { artist: 'biz markie', album: 'the biz never sleeps', cover: '/images/albums/biz_markie_just_a_friend.jpg' },
  { artist: 'biz markie', album: 'just a friend', cover: '/images/albums/biz_markie_just_a_friend.jpg' },

  // Blackstreet
  { artist: 'blackstreet', album: 'blackstreet', cover: '/images/albums/blackstreet_joy.jpg' },
  { artist: 'blackstreet', album: 'joy', cover: '/images/albums/blackstreet_joy.jpg' },

  // Bobby Brown
  { artist: 'bobby brown', album: 'dont be cruel', cover: '/images/albums/bobby_brown_dont_be_cruel.jpg' },

  // Carl Thomas
  { artist: 'carl thomas', album: 'emotional', cover: '/images/albums/carl_thomas_emotional.jpg' },

  // Change
  { artist: 'change', album: 'the glow of love', cover: '/images/albums/change_glow_of_love.jpg' },
  { artist: 'change', album: 'glow of love', cover: '/images/albums/change_glow_of_love.jpg' },

  // Dennis Edwards
  { artist: 'dennis edwards', album: 'dont look any further', cover: '/images/albums/dennis_edwards_dont_look.jpg' },

  // Fatback Band
  { artist: 'fatback band', album: 'with love', cover: '/images/albums/fatback_band_with_love.jpg' },
  { artist: 'the fatback band', album: 'with love', cover: '/images/albums/fatback_band_with_love.jpg' },

  // Fonda Rae
  { artist: 'fonda rae', album: 'over like a fat rat', cover: '/images/albums/fonda_rae_fat_rat.jpg' },
  { artist: 'fonda rae', album: 'fat rat', cover: '/images/albums/fonda_rae_fat_rat.jpg' },

  // The Gap Band
  { artist: 'gap band', album: 'gap band iv', cover: '/images/albums/gap_band_iv.jpg' },
  { artist: 'the gap band', album: 'gap band iv', cover: '/images/albums/gap_band_iv.jpg' },

  // Grandmaster Flash
  { artist: 'grandmaster flash', album: 'the message', cover: '/images/albums/grandmaster_flash_freedom.jpg' },
  { artist: 'grandmaster flash', album: 'freedom', cover: '/images/albums/grandmaster_flash_freedom.jpg' },
  { artist: 'grandmaster flash and the furious five', album: 'the message', cover: '/images/albums/grandmaster_flash_freedom.jpg' },
  { artist: 'grandmaster flash and the furious five', album: 'freedom', cover: '/images/albums/grandmaster_flash_freedom.jpg' },

  // Janet Jackson Authentic Covers
  { artist: 'janet jackson', album: 'the velvet rope', cover: '/images/albums/janet_jackson_velvet_rope.png' },
  { artist: 'janet jackson', album: 'velvet rope', cover: '/images/albums/janet_jackson_velvet_rope.png' },
  { artist: 'janet jackson', album: 'janet', cover: '/images/albums/janet_jackson_janet.jpg' },
  { artist: 'janet jackson', album: 'rhythm nation 1814', cover: '/images/albums/janet_jackson_rhythm_nation.jpg' },
  { artist: 'janet jackson', album: 'rhythm nation', cover: '/images/albums/janet_jackson_rhythm_nation.jpg' },
  { artist: 'janet jackson', album: 'all for you', cover: '/images/albums/janet_jackson_all_for_you.jpg' },

  // Avant Authentic Covers
  { artist: 'avant', album: 'my thoughts', cover: '/images/albums/avant_my_thoughts.jpg' },
  { artist: 'avant', album: 'ecstasy', cover: '/images/albums/avant_ecstasy.jpg' },

  // 112 Authentic Covers
  { artist: '112', album: 'part iii', cover: '/images/albums/112_part_iii.jpg' },
  { artist: '112', album: 'part 3', cover: '/images/albums/112_part_iii.jpg' },
  { artist: '112', album: '112', cover: '/images/albums/112_self_titled.jpg' },

  // Ashanti Authentic Covers
  { artist: 'ashanti', album: 'ashanti', cover: '/images/albums/ashanti_ashanti.jpg' },
  { artist: 'ashanti', album: 'concrete rose', cover: '/images/albums/ashanti_concrete_rose.jpg' },

  // Chris Brown Authentic Covers
  { artist: 'chris brown', album: 'chris brown', cover: '/images/albums/chris_brown_self_titled.jpg' },

  // Brownstone Authentic Covers
  { artist: 'brownstone', album: 'from the bottom up', cover: '/images/albums/brownstone_from_the_bottom_up.jpg' },

  // Jermaine Dupri Authentic Covers
  { artist: 'jermaine dupri', album: 'instructions', cover: '/images/albums/jermaine_dupri_instructions.jpg' },
  { artist: 'jermaine dupri', album: 'life in 1472', cover: '/images/albums/jermaine_dupri_instructions.jpg' },

  // Lauryn Hill
  { artist: 'lauryn hill', album: 'the miseducation of lauryn hill', cover: '/images/albums/lauryn_hill_miseducation.jpg' },
  { artist: 'lauryn hill', album: 'miseducation of lauryn hill', cover: '/images/albums/lauryn_hill_miseducation.jpg' },
  { artist: 'lauryn hill', album: 'miseducation', cover: '/images/albums/lauryn_hill_miseducation.jpg' },

  // Mary J. Blige
  { artist: 'mary j blige', album: 'share my world', cover: '/images/albums/mary_j_blige_share_my_world.jpg' },

  // Maze feat. Frankie Beverly
  { artist: 'maze', album: 'live in new orleans', cover: '/images/albums/maze_live_in_new_orleans.jpg' },
  { artist: 'maze feat frankie beverly', album: 'live in new orleans', cover: '/images/albums/maze_live_in_new_orleans.jpg' },
  { artist: 'maze featuring frankie beverly', album: 'live in new orleans', cover: '/images/albums/maze_live_in_new_orleans.jpg' },

  // Parliament
  { artist: 'parliament', album: 'funkentelechy vs the placebo syndrome', cover: '/images/albums/parliament_funkentelechy.jpg' },
  { artist: 'parliament', album: 'funkentelechy', cover: '/images/albums/parliament_funkentelechy.jpg' },

  // Sade
  { artist: 'sade', album: 'lovers rock', cover: '/images/albums/sade_lovers_rock.png' },

  // SWV
  { artist: 'swv', album: 'its about time', cover: '/images/albums/swv_its_about_time.jpg' },
  { artist: 'swv', album: 'new beginning', cover: '/images/albums/swv_new_beginning.jpg' },

  // Taana Gardner
  { artist: 'taana gardner', album: 'heartbeat', cover: '/images/albums/taana_gardner_heartbeat.jpg' },
  { artist: 'taana gardner', album: 'west end records vault', cover: '/images/albums/taana_gardner_heartbeat.jpg' },

  // Teedra Moses
  { artist: 'teedra moses', album: 'complex simplicity', cover: '/images/albums/teedra_moses_complex_simplicity.png' },

  // Tevin Campbell
  { artist: 'tevin campbell', album: 'im ready', cover: '/images/albums/tevin_campbell_im_ready.jpg' },

  // The Isley Brothers
  { artist: 'the isley brothers', album: 'the heat is on', cover: '/images/albums/isley_brothers_heat_is_on.jpg' },
  { artist: 'isley brothers', album: 'the heat is on', cover: '/images/albums/isley_brothers_heat_is_on.jpg' },

  // The Spinners
  { artist: 'the spinners', album: 'spinners', cover: '/images/albums/spinners_spinners.jpg' },
  { artist: 'spinners', album: 'spinners', cover: '/images/albums/spinners_spinners.jpg' },

  // Nas
  { artist: 'nas', album: 'illmatic', cover: '/images/albums/nas_illmatic.jpg' },
  { artist: 'nas', album: 'it was written', cover: '/images/albums/nas_it_was_written.jpg' },
  { artist: 'nas', album: 'gods son', cover: '/images/albums/nas_gods_son.jpg' },
  { artist: 'nas', album: "god's son", cover: '/images/albums/nas_gods_son.jpg' },
  { artist: 'nas', album: 'i am', cover: '/images/albums/nas_i_am.jpg' },
  { artist: 'nas', album: 'i am...', cover: '/images/albums/nas_i_am.jpg' },
  { artist: 'nas', album: 'collection', cover: '/images/albums/nas_illmatic.jpg' },
  { artist: 'nas', album: 'vault cuts', cover: '/images/albums/nas_illmatic.jpg' },
];

export const THRILLER_TRACKS = new Set([
  'wanna be startin somethin',
  'baby be mine',
  'the girl is mine',
  'thriller',
  'beat it',
  'billie jean',
  'human nature',
  'p y t',
  'pyt',
  'pretty young thing',
  'the lady in my life',
  'lady in my life',
  'someone in the dark',
  'carousel',
  'billie jean home demo',
  'billie jean home demo from 1981',
  'voice-over session from thriller',
  'voice over session from thriller',
  'cant get outta the rain',
  'can t get outta the rain',
  'for all time',
]);

export const OFF_THE_WALL_TRACKS = new Set([
  'dont stop til you get enough',
  'rock with you',
  'workin day and night',
  'get on the floor',
  'off the wall',
  'girlfriend',
  'shes out of my life',
  'i cant help it',
  'its the falling in love',
  'burn this disco out',
]);

export const normalizeAlbumKey = (v?: any) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function isGenericOrVirtualAlbum(albumTitle?: string): boolean {
  if (!albumTitle) return true;
  const raw = String(albumTitle || '').toLowerCase().trim();
  const norm = normalizeAlbumKey(albumTitle);
  if (!norm) return true;

  const genericKeys = new Set([
    'singles vault cuts',
    'single vault cuts',
    'singles and vault cuts',
    'vault cuts',
    'vault cut',
    'single',
    'singles',
    'single release',
    'direct music library',
    'direct music',
    'master crate vault',
    'collection',
    'collections',
    'album',
    'albums',
    'unknown',
    'unknown album',
    'general music library',
    'general music catalog',
    'general music',
    'stems',
    'miscellaneous',
    'audio',
    'music',
    'album vault',
    'albumvault',
    'vault',
    'unassigned',
  ]);

  return (
    genericKeys.has(norm) ||
    norm.includes('vault') ||
    norm.includes('single') ||
    norm.includes('directmusic') ||
    norm.includes('various') ||
    raw.includes('album-vault') ||
    raw.includes('direct-music-library')
  );
}

export function knownAlbumCover(artist?: string, album?: string, title?: string): string | undefined {
  return getAuthenticCoverForTrack(artist, album, title);
}

export function getAuthenticCoverForTrack(
  artist?: string,
  album?: string,
  title?: string
): string | undefined {
  const a = normalizeAlbumKey(artist);
  const al = normalizeAlbumKey(album);
  const t = normalizeAlbumKey(title);

  // 1. Explicit artist + album direct match from KNOWN_ALBUM_COVERS
  if (a && al) {
    const directMatch = KNOWN_ALBUM_COVERS.find(
      (k) =>
        (a.includes(k.artist) || k.artist.includes(a)) &&
        (al === k.album || al.startsWith(`${k.album} `) || al.includes(k.album) || k.album.includes(al))
    );
    if (directMatch) return directMatch.cover;
  }

  // 2. Track title and album match for Aaliyah
  if (a.includes('aaliyah') || t.includes('aaliyah')) {
    if (al.includes('age aint nothing')) return '/images/albums/aaliyah_age_aint_nothing.jpg';
    if (al.includes('one in a million')) return '/images/albums/aaliyah_one_in_a_million.png';
    if (al.includes('i care 4 u') || al.includes('care 4 u')) return '/images/albums/aaliyah_i_care_4_u.png';
    if (al.includes('ultimate') || al.includes('romeo')) return '/images/albums/aaliyah_ultimate.jpg';
    if (t) {
      if (t.includes('age aint nothing') || t.includes('at your best')) return '/images/albums/aaliyah_age_aint_nothing.jpg';
      if (t.includes('your girl') || t.includes('one in a million') || t.includes('4 page letter')) return '/images/albums/aaliyah_one_in_a_million.png';
      if (t.includes('try again') || t.includes('miss you') || t.includes('i care 4 u')) return '/images/albums/aaliyah_i_care_4_u.png';
      if (t.includes('come back in one piece') || t.includes('one piece')) return '/images/albums/aaliyah_ultimate.jpg';
      if (t.includes('more than a woman') || t.includes('rock the boat') || t.includes('resolution') || t.includes('we need a resolution')) return '/images/albums/aaliyah_2001.png';
    }
    return '/images/albums/aaliyah_2001.png';
  }

  // 3. Track title and album match for Alicia Keys
  if (a.includes('alicia') || t.includes('alicia')) {
    if (al.includes('minor')) return '/images/albums/alicia_keys_songs_in_a_minor.png';
    if (al.includes('diary')) return '/images/albums/alicia_keys_diary.png';
    if (al.includes('as i am')) return '/images/albums/alicia_keys_as_i_am.png';
    if (al.includes('brotha') || al.includes('unreleased')) return '/images/albums/alicia_keys_brotha.jpg';
    if (t) {
      if (t.includes('fallin')) return '/images/albums/alicia_keys_songs_in_a_minor.png';
      if (t.includes('if i aint got you') || t.includes('aint got you') || t.includes('keys if i aint got you')) return '/images/albums/alicia_keys_diary.png';
      if (t.includes('teenage love affair') || t.includes('no one') || t.includes('superwoman')) return '/images/albums/alicia_keys_as_i_am.png';
      if (t.includes('brotha')) return '/images/albums/alicia_keys_brotha.jpg';
    }
    return '/images/albums/alicia_keys_diary.png';
  }

  // 4. Track title / album match for iconic Michael Jackson releases
  const isLikelyMJ =
    a.includes('michael jackson') ||
    !a ||
    a.includes('8 of spades') || a.includes('chancetekone') ||
    al.includes('thriller') ||
    al.includes('off the wall');

  if (isLikelyMJ) {
    if (al.includes('thriller')) return '/audio/uploads/Thriller_cover.jpg';
    if (al.includes('off the wall')) return '/audio/uploads/Off_The_Wall_cover.jpg';
    if (t) {
      for (const track of THRILLER_TRACKS) {
        if (t.includes(track) || track.includes(t)) return '/audio/uploads/Thriller_cover.jpg';
      }
      for (const track of OFF_THE_WALL_TRACKS) {
        if (t.includes(track) || track.includes(t)) return '/audio/uploads/Off_The_Wall_cover.jpg';
      }
    }
  }

  // 5. Classic Artists and Albums Matching (verified authentic albums only)

  if (a.includes('amerie') || t.includes('amerie')) {
    if (al.includes('touch') || t.includes('1 thing') || t.includes('one thing')) return '/images/albums/amerie_touch.png';
    if (al.includes('all i have') || t.includes('why dont we fall') || t.includes('fall in love')) return '/images/albums/amerie_all_i_have.jpg';
    return '/images/albums/amerie_touch.png';
  }

  if (a.includes('biz markie') || t.includes('just a friend')) {
    return '/images/albums/biz_markie_just_a_friend.jpg';
  }

  if (a.includes('blackstreet')) {
    return '/images/albums/blackstreet_joy.jpg';
  }

  if (a.includes('bobby brown') || t.includes('every little step') || t.includes('my prerogative') || t.includes('dont be cruel')) {
    return '/images/albums/bobby_brown_dont_be_cruel.jpg';
  }

  if (a.includes('carl thomas') || t.includes('summer rain') || (t.includes('i wish') && (a.includes('carl') || a.includes('thomas')))) {
    return '/images/albums/carl_thomas_emotional.jpg';
  }

  if (a.includes('change') || t.includes('glow of love')) {
    return '/images/albums/change_glow_of_love.jpg';
  }

  if (a.includes('dennis edwards') || t.includes('dont look any further') || t.includes('look any further')) {
    return '/images/albums/dennis_edwards_dont_look.jpg';
  }

  if (a.includes('fatback') || t.includes('found lovin') || t.includes('found loving')) {
    return '/images/albums/fatback_band_with_love.jpg';
  }

  if (a.includes('fonda rae') || t.includes('over like a fat rat') || t.includes('fat rat')) {
    return '/images/albums/fonda_rae_fat_rat.jpg';
  }

  if (a.includes('gap band') || t.includes('outstanding')) {
    return '/images/albums/gap_band_iv.jpg';
  }

  if (a.includes('grandmaster') || (a.includes('flash') && t.includes('freedom'))) {
    return '/images/albums/grandmaster_flash_freedom.jpg';
  }

  if (a.includes('janet jackson') || (a.includes('janet') && !a.includes('carl'))) {
    if (al.includes('rhythm nation') || t.includes('rhythm nation') || t.includes('miss you much')) return '/images/albums/janet_jackson_rhythm_nation.jpg';
    if (al.includes('all for you') || t.includes('all for you')) return '/images/albums/janet_jackson_all_for_you.jpg';
    if (al.includes('janet') || t.includes('that s the way') || t.includes('thats the way') || t.includes('any time') || t.includes('again')) return '/images/albums/janet_jackson_janet.jpg';
    return '/images/albums/janet_jackson_velvet_rope.png';
  }

  if (a.includes('avant') || t.includes('avant')) {
    if (al.includes('ecstasy') || t.includes('flickin') || t.includes('makin good love')) return '/images/albums/avant_ecstasy.jpg';
    return '/images/albums/avant_my_thoughts.jpg';
  }

  if (a.includes('112') || t.includes('112')) {
    if (al.includes('part iii') || al.includes('part 3') || t.includes('peaches') || t.includes('part 2') || t.includes('over now')) return '/images/albums/112_part_iii.jpg';
    return '/images/albums/112_self_titled.jpg';
  }

  if (a.includes('ashanti') || t.includes('ashanti')) {
    if (al.includes('concrete rose') || t.includes('only you') || t.includes('only u')) return '/images/albums/ashanti_concrete_rose.jpg';
    return '/images/albums/ashanti_ashanti.jpg';
  }

  if (a.includes('chris brown') || t.includes('chris brown')) {
    return '/images/albums/chris_brown_self_titled.jpg';
  }

  if (a.includes('brownstone') || t.includes('brownstone')) {
    return '/images/albums/brownstone_from_the_bottom_up.jpg';
  }

  if (a.includes('jermaine dupri') || t.includes('jermaine dupri')) {
    return '/images/albums/jermaine_dupri_instructions.jpg';
  }

  if (a.includes('lauryn hill') || t.includes('ex factor') || t.includes('miseducation')) {
    return '/images/albums/lauryn_hill_miseducation.jpg';
  }

  if (a.includes('mary j') || (a.includes('blige') && t.includes('love you')) || al.includes('share my world')) {
    return '/images/albums/mary_j_blige_share_my_world.jpg';
  }

  if (a.includes('maze') || t.includes('before i let go')) {
    return '/images/albums/maze_live_in_new_orleans.jpg';
  }

  if (a.includes('parliament') || t.includes('flashlight')) {
    return '/images/albums/parliament_funkentelechy.jpg';
  }

  if (a.includes('sade') || t.includes('by your side') || al.includes('lovers rock')) {
    return '/images/albums/sade_lovers_rock.png';
  }

  if (a.includes('swv')) {
    if (al.includes('new beginning') || t.includes('youre the one') || t.includes('you re the one')) return '/images/albums/swv_new_beginning.jpg';
    return '/images/albums/swv_its_about_time.jpg';
  }

  if (a.includes('taana') || a.includes('gardner') || (t.includes('heartbeat') && !a.includes('childish'))) {
    return '/images/albums/taana_gardner_heartbeat.jpg';
  }

  if (a.includes('teedra') || t.includes('be your girl') || al.includes('complex simplicity')) {
    return '/images/albums/teedra_moses_complex_simplicity.png';
  }

  if (a.includes('tevin') || t.includes('can we talk') || al.includes('im ready')) {
    return '/images/albums/tevin_campbell_im_ready.jpg';
  }

  if (a.includes('isley') || t.includes('for the love of you')) {
    return '/images/albums/isley_brothers_heat_is_on.jpg';
  }

  if (a.includes('spinners') || t.includes('could it be im falling') || t.includes('could it be i m falling') || t.includes('ill be around') || t.includes('i ll be around')) {
    return '/images/albums/spinners_spinners.jpg';
  }

  if (a.includes('luther') || t.includes('never too much')) {
    return '/images/albums/luther_vandross_never_too_much.jpg';
  }

  // 6. Global Fallback purely on track title strings
  if (t) {
    if (t.includes('1 thing') || t.includes('one thing')) return '/images/albums/amerie_touch.png';
    if (t.includes('why dont we fall') || t.includes('fall in love') && a.includes('amerie')) return '/images/albums/amerie_all_i_have.jpg';
    if (t.includes('just a friend')) return '/images/albums/biz_markie_just_a_friend.jpg';
    if (t.includes('joy') && (a.includes('blackstreet') || al.includes('blackstreet'))) return '/images/albums/blackstreet_joy.jpg';
    if (t.includes('every little step') || t.includes('my prerogative')) return '/images/albums/bobby_brown_dont_be_cruel.jpg';
    if (t.includes('summer rain') || (t.includes('i wish') && (a.includes('carl') || a.includes('thomas')))) return '/images/albums/carl_thomas_emotional.jpg';
    if (t.includes('glow of love')) return '/images/albums/change_glow_of_love.jpg';
    if (t.includes('dont look any further') || t.includes('look any further')) return '/images/albums/dennis_edwards_dont_look.jpg';
    if (t.includes('found lovin') || t.includes('found loving')) return '/images/albums/fatback_band_with_love.jpg';
    if (t.includes('over like a fat rat') || t.includes('fat rat')) return '/images/albums/fonda_rae_fat_rat.jpg';
    if (t.includes('outstanding')) return '/images/albums/gap_band_iv.jpg';
    if (t.includes('freedom') && (a.includes('grandmaster') || a.includes('flash') || !a)) return '/images/albums/grandmaster_flash_freedom.jpg';
    if (t.includes('got til its gone') || t.includes('got til it s gone')) return '/images/albums/janet_jackson_velvet_rope.png';
    if (t.includes('ex factor') || t.includes('ex-factor')) return '/images/albums/lauryn_hill_miseducation.jpg';
    if (t.includes('i can love you')) return '/images/albums/mary_j_blige_share_my_world.jpg';
    if (t.includes('before i let go')) return '/images/albums/maze_live_in_new_orleans.jpg';
    if (t.includes('flashlight')) return '/images/albums/parliament_funkentelechy.jpg';
    if (t.includes('by your side')) return '/images/albums/sade_lovers_rock.png';
    if (t.includes('right here')) return '/images/albums/swv_its_about_time.jpg';
    if (t.includes('youre the one') || t.includes('you re the one')) return '/images/albums/swv_new_beginning.jpg';
    if (t.includes('heartbeat') && (a.includes('taana') || a.includes('gardner') || !a)) return '/images/albums/taana_gardner_heartbeat.jpg';
    if (t.includes('be your girl')) return '/images/albums/teedra_moses_complex_simplicity.png';
    if (t.includes('can we talk')) return '/images/albums/tevin_campbell_im_ready.jpg';
    if (t.includes('for the love of you')) return '/images/albums/isley_brothers_heat_is_on.jpg';
    if (t.includes('could it be im falling') || t.includes('could it be i m falling') || t.includes('ill be around') || t.includes('i ll be around')) return '/images/albums/spinners_spinners.jpg';
    for (const track of THRILLER_TRACKS) {
      if (t.includes(track) || track.includes(t)) return '/audio/uploads/Thriller_cover.jpg';
    }
    for (const track of OFF_THE_WALL_TRACKS) {
      if (t.includes(track) || track.includes(t)) return '/audio/uploads/Off_The_Wall_cover.jpg';
    }
  }

  // 7. Pure album title matching
  if (al.includes('thriller')) return '/audio/uploads/Thriller_cover.jpg';
  if (al.includes('off the wall')) return '/audio/uploads/Off_The_Wall_cover.jpg';
  if (al.includes('glow of love')) return '/images/albums/change_glow_of_love.jpg';
  if (al.includes('miseducation')) return '/images/albums/lauryn_hill_miseducation.jpg';
  if (al.includes('velvet rope')) return '/images/albums/janet_jackson_velvet_rope.png';
  if (al.includes('share my world')) return '/images/albums/mary_j_blige_share_my_world.jpg';
  if (al.includes('live in new orleans')) return '/images/albums/maze_live_in_new_orleans.jpg';
  if (al.includes('funkentelechy')) return '/images/albums/parliament_funkentelechy.jpg';
  if (al.includes('lovers rock')) return '/images/albums/sade_lovers_rock.png';
  if (al.includes('gap band iv')) return '/images/albums/gap_band_iv.jpg';
  if (al.includes('dont be cruel')) return '/images/albums/bobby_brown_dont_be_cruel.jpg';
  if (al.includes('emotional')) return '/images/albums/carl_thomas_emotional.jpg';
  if (al.includes('spinners')) return '/images/albums/spinners_spinners.jpg';

  // 8. Platform Original Creators & Labels
  if (a.includes('cipher voltage')) return '/images/quantum_break_sequence_banner.jpg';
  if (a.includes('luna brass')) return '/images/velvet_horns_tape_saturation_banner.jpg';
  if (a.includes('sub-zero rhythm') || a.includes('sub zero')) return '/images/chancetek_banner.png';
  if (a.includes('chancetek') || a.includes('chancellor')) return '/images/chancetek_banner.png';

  return undefined;
}

export function getDefaultCoverForTrack(track?: {
  genre?: string;
  crateId?: string;
  artistName?: string;
  title?: string;
}): string {
  if (!track) return '/images/genres/rnb-neo-soul.jpg';
  const g = (track.genre || '').toLowerCase();
  const c = (track.crateId || '').toLowerCase();
  const a = (track.artistName || '').toLowerCase();
  const t = (track.title || '').toLowerCase();

  if (
    g.includes('hip') ||
    c.includes('hip') ||
    a.includes('jermaine dupri') ||
    a.includes('grandmaster') ||
    a.includes('flash') ||
    a.includes('biz markie')
  ) {
    return '/images/genres/hip-hop.jpg';
  }

  if (g.includes('house') || g.includes('club') || g.includes('dance') || c.includes('house') || c.includes('club')) {
    return '/images/genres/house-club.jpg';
  }

  if (g.includes('latin') || g.includes('freestyle') || c.includes('latin')) {
    return '/images/genres/latin-freestyle.jpg';
  }

  if (g.includes('jazz') || g.includes('blues') || c.includes('jazz')) {
    return '/images/genres/jazz-blues.jpg';
  }

  if (g.includes('reggae') || g.includes('dancehall')) {
    return '/images/genres/reggae-dancehall.jpg';
  }

  if (g.includes('afro') || c.includes('afro')) {
    return '/images/genres/afro-house-beats.jpg';
  }

  if (
    g.includes('breakbeat') ||
    t.includes('break') ||
    (a.includes('chancetek') && (t.includes('break') || t.includes('anthem')))
  ) {
    return '/images/chancetek_banner.png';
  }

  // Default for all R&B, Soul, Slow Jams, and general catalog
  return '/images/genres/rnb-neo-soul.jpg';
}

export function isMissingOrGenericCover(url?: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  if (lower === '' || lower === '/images/logo.png' || lower === 'null' || lower === 'undefined') return true;
  // Authentic embedded artwork, base64 data URLs, blobs, and upload artwork files are NEVER generic!
  if (lower.startsWith('data:image') || lower.startsWith('blob:') || lower.includes('cover_179') || lower.includes('cover_')) {
    return false;
  }
  return (
    lower.includes('images.unsplash.com') ||
    lower.includes('/images/the_lounge_ambient.jpg') ||
    lower.includes('/images/logo') ||
    lower.includes('chancetekone_banner.png') ||
    lower.includes('/images/genres/') ||
    lower.endsWith('folder.jpg')
  );
}

/** Returns the corrected cover for a track, or undefined when the current cover must be left alone. */
export function correctedKnownCover(t: { artistName?: string; albumTitle?: string; title?: string; coverUrl?: string }): string | undefined {
  const known = getAuthenticCoverForTrack(t.artistName, t.albumTitle, t.title);
  if (!known) return undefined;
  if (isMissingOrGenericCover(t.coverUrl)) return known;
  const otherKnown = KNOWN_ALBUM_COVERS.filter((k) => k.cover !== known).some((k) =>
    (t.coverUrl || '').endsWith(k.cover.split('/').pop()!)
  );
  return otherKnown ? known : undefined;
}

export const MICHAEL_JACKSON_TRACKS: Track[] = [
  {
    id: 'trk-pub-1791515551373-c1e09',
    title: "Don't Stop 'Til You Get Enough",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 365,
    genre: 'Disco / R&B Soul',
    bpm: 119,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-167qd',
    title: 'Rock With You',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_02_-_Rock_With_You.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 220,
    genre: 'R&B / Soul / Disco',
    bpm: 114,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-q13u8',
    title: "Workin' Day And Night",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_03_-_Workin__Day_And_Night.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 314,
    genre: 'Funk / Disco',
    bpm: 128,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-3fmxi',
    title: 'Get On The Floor',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_04_-_Get_On_The_Floor.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 279,
    genre: 'Disco / Funk Bass',
    bpm: 118,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-aiyhy',
    title: 'Off The Wall',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_05_-_Off_The_Wall.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 246,
    genre: 'Disco / Funk',
    bpm: 119,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-91sms',
    title: 'Girlfriend',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_06_-_Girlfriend.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 185,
    genre: 'Pop / Soul',
    bpm: 96,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-1791515551373-uhidh',
    title: "She's Out Of My Life",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_07_-_She_s_Out_Of_My_Life.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 218,
    genre: 'Slow Jams / Soul Ballad',
    bpm: 66,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-uxviz',
    title: "I Can't Help It",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_08_-_I_Can_t_Help_It.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 269,
    genre: 'Quiet Storm / Jazz-Soul',
    bpm: 94,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-bee94',
    title: "It's The Falling In Love",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_09_-_It_s_The_Falling_In_Love.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 228,
    genre: 'Disco / Pop-Soul',
    bpm: 114,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-1791515551373-31ndm',
    title: 'Burn This Disco Out',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_10_-_Burn_This_Disco_Out.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 222,
    genre: 'Disco / High-Energy Funk',
    bpm: 132,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-1791515551373-3cke7',
    title: "Don't Stop 'Til You Get Enough (Extended Edition)",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-off-the-wall',
    albumTitle: 'Off The Wall',
    audioUrl: '/audio/uploads/Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3',
    coverUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
    duration: 365,
    genre: 'Disco / Funk / Soul',
    bpm: 119,
    releaseYear: 1979,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-01',
    title: "Wanna Be Startin' Somethin'",
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_01_-_Wanna_Be_Startin_Somethin.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 363,
    genre: 'Post-Disco / Funk / Dance-Pop',
    bpm: 122,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Intro]
I said you wanna be startin' somethin'
You got to be startin' somethin'
I said you wanna be startin' somethin'
You got to be startin' somethin'
It's too high to get over (Yeah, yeah)
Too low to get under (Yeah, yeah)
You're stuck in the middle (Yeah, yeah)
And the pain is thunder (Yeah, yeah)

[Verse 1]
I took my baby to the doctor with a fever, but nothin' found
By the time this hit the street, they said she had a breakdown
Someone's always tryin' to start my baby cryin'
Talkin', squealin', lyin', sayin' you just wanna be startin' somethin'

[Chorus]
Ma-ma-se, ma-ma-sa, ma-ma-koo-sa
Ma-ma-se, ma-ma-sa, ma-ma-koo-sa
Ma-ma-se, ma-ma-sa, ma-ma-koo-sa
Ma-ma-se, ma-ma-sa, ma-ma-koo-sa`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-02',
    title: 'Baby Be Mine',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_02_-_Baby_Be_Mine.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 260,
    genre: 'R&B / Post-Disco / Funk',
    bpm: 110,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
I don't need no dreams when I'm by your side
Every little thing is alright
Baby, make it count, don't you let it go
Take my heart and make it so

[Chorus]
Baby be mine, and girl I'll give you all my time
Baby be mine, and girl I'll love you all the time
Show you that heaven can be mine`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-mj-thriller-03',
    title: 'The Girl Is Mine',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson & Paul McCartney',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_03_-_The_Girl_Is_Mine.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 222,
    genre: 'Pop / Soft Rock / R&B',
    bpm: 92,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1 - Michael Jackson]
Every night she walks right into my dreams
Since I met her I've been living to love

[Verse 2 - Paul McCartney]
I don't understand the way that you feel
'Cause I know the way she feels about me

[Chorus]
The girl is mine, the doggone girl is mine
I know she's mine, because the doggone girl is mine`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-mj-thriller-04',
    title: 'Thriller',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_04_-_Thriller.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 357,
    genre: 'Funk / Post-Disco / Synth-Pop',
    bpm: 118,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
It's close to midnight and something evil's lurking in the dark
Under the moonlight you see a sight that almost stops your heart
You try to scream, but terror takes the sound before you make it
You start to freeze as horror looks you right between the eyes
You're paralyzed

[Chorus]
'Cause this is thriller, thriller night
And no one's gonna save you from the beast about to strike
You know it's thriller, thriller night
You're fighting for your life inside a killer, thriller tonight

[Bridge]
Darkness falls across the land
The midnight hour is close at hand
Creatures crawl in search of blood
To terrorize y'all's neighborhood!`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-05',
    title: 'Beat It',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_05_-_Beat_It.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 258,
    genre: 'Hard Rock / Dance-Rock',
    bpm: 138,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
They told him, "Don't you ever come around here
Don't wanna see your face, you better disappear"
The fire's in their eyes and their words are really clear
So beat it, just beat it

[Chorus]
Just beat it, beat it, beat it, beat it
No one wants to be defeated
Showin' how funky and strong is your fight
It doesn't matter who's wrong or who's right
Just beat it, beat it!`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-06',
    title: 'Billie Jean',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_06_-_Billie_Jean.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 294,
    genre: 'Post-Disco / Dance-Pop / R&B',
    bpm: 117,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
She was more like a beauty queen from a movie scene
I said don't mind, but what do you mean, I am the one
Who will dance on the floor in the round?
She said I am the one, who will dance on the floor in the round

[Pre-Chorus]
People always told me, "Be careful of what you do
And don't go 'round breakin' young girls' hearts"
And mother always told me, "Be careful of who you love
And be careful of what you do, 'cause the lie becomes the truth"

[Chorus]
Billie Jean is not my lover
She's just a girl who claims that I am the one
But the kid is not my son
She says I am the one, but the kid is not my son`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-07',
    title: 'Human Nature',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_07_-_Human_Nature.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 246,
    genre: 'R&B / Synth-Pop / Quiet Storm',
    bpm: 93,
    releaseYear: 1982,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    lyrics: `[Verse 1]
Looking out across the nighttime
The city winks a sleepless eye
Hear her voice, shake my window
Sweet seducing sighs

[Chorus]
If they say, why, why, tell 'em that it's human nature
Why, why, does he do me that way?
If they say, why, why, tell 'em that it's human nature
Why, why, does he do me that way?`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-08',
    title: 'P.Y.T. (Pretty Young Thing)',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_08_-_PYT_Pretty_Young_Thing.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 239,
    genre: 'Post-Disco / Funk / Synth-Pop',
    bpm: 127,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
Where did you come from, lady?
And ooh, won't you take me there?
Right to the groove of paradise
Take me up in the air

[Chorus]
I want to love you (P.Y.T.)
Pretty young thing
You need some lovin' (T.L.C.)
Tender lovin' care
And I'll take you there!`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-09',
    title: 'The Lady in My Life',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_09_-_The_Lady_in_My_Life.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 300,
    genre: 'Slow Jams / Quiet Storm / R&B',
    bpm: 74,
    releaseYear: 1982,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    lyrics: `[Verse 1]
There'll be no darkness tonight
Lady, our love will shine, just put your trust in my heart
And meet me in paradise
Now is the time, girl, you and I

[Chorus]
Listen to my heart beat for you
Listen to my heart, lady in my life
I will always love you
Forever and a day`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-mj-thriller-10',
    title: 'Someone In The Dark',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_10_-_Someone_In_The_Dark.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 298,
    genre: 'R&B / Soul Ballad / Pop',
    bpm: 72,
    releaseYear: 1982,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    lyrics: `[Verse 1]
All alone in the world
With no one to hold on to
Then you walked in my life
And made all my dreams come true

[Chorus]
Someone in the dark
Someone in the dark
Touch me with your light
Make everything alright`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-11',
    title: 'Carousel',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_11_-_Carousel.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 220,
    genre: 'Post-Disco / Pop / Funk',
    bpm: 104,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Verse 1]
Don't come knockin' on my door
If you're not lookin' for more
Spinning around on a carousel of love
Watching the stars above

[Chorus]
Round and round the carousel goes
Where love stops nobody knows
Keep on spinning around tonight`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-mj-thriller-12',
    title: 'Billie Jean (Home Demo from 1981)',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_12_-_Billie_Jean_Demo.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 140,
    genre: 'Post-Disco / Home Studio Demo / Funk',
    bpm: 117,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Intro]
Billie Jean, yeah...
Listen to the bassline...

[Chorus]
Billie Jean is not my lover
She's just a girl who claims that I am the one
But the kid is not my son
She says I am the one, but the kid is not my son`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mj-thriller-13',
    title: 'Voice-Over Session from Thriller (feat. Vincent Price)',
    artistId: 'artist-michael-jackson',
    artistName: 'Michael Jackson feat. Vincent Price',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-thriller',
    albumTitle: 'Thriller',
    audioUrl: '/audio/uploads/Michael_Jackson_-_13_-_Voice_Over_Session.mp3',
    coverUrl: '/audio/uploads/Thriller_cover.jpg',
    duration: 172,
    genre: 'Spoken Word / Studio Vault / Funk',
    bpm: 118,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    lyrics: `[Vincent Price]
Darkness falls across the land
The midnight hour is close at hand
Creatures crawl in search of blood
To terrorize y'all's neighborhood

And whosoever shall be found
Without the soul for getting down
Must stand and face the hounds of hell
And rot inside a corpse's shell

The foulest stench is in the air
The funk of forty thousand years
And grizzly ghouls from every tomb
Are closing in to seal your doom!

[Evil Laughter Echoes]`,
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const VAULT_CLASSIC_TRACKS: Track[] = [
  {
    id: 'trk-pub-amerie-1-thing',
    title: '1 Thing',
    artistId: 'artist-amerie',
    artistName: 'Amerie',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-amerie-touch',
    albumTitle: 'Touch',
    audioUrl: '/audio/uploads/Amerie_1_Thing.mp3',
    coverUrl: '/images/albums/amerie_touch.png',
    duration: 238,
    genre: 'R&B / Go-Go Funk',
    bpm: 100,
    releaseYear: 2005,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-amerie-why-dont-we-fall',
    title: "Why Don't We Fall In Love",
    artistId: 'artist-amerie',
    artistName: 'Amerie',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-amerie-all-i-have',
    albumTitle: 'All I Have',
    audioUrl: '/audio/uploads/Amerie_Why_Dont_We_Fall_In_Love.mp3',
    coverUrl: '/images/albums/amerie_all_i_have.jpg',
    duration: 179,
    genre: 'R&B / Neo-Soul',
    bpm: 96,
    releaseYear: 2002,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-biz-markie-just-a-friend',
    title: 'Just A Friend',
    artistId: 'artist-biz-markie',
    artistName: 'Biz Markie',
    label: 'Cold Chillin / Warner Bros / ChanceTEK One',
    albumId: 'album-biz-markie-just-a-friend',
    albumTitle: 'The Biz Never Sleeps',
    audioUrl: '/audio/uploads/Biz_Markie_Just_A_Friend.mp3',
    coverUrl: '/images/albums/biz_markie_just_a_friend.jpg',
    duration: 240,
    genre: 'Golden Era Hip Hop',
    bpm: 85,
    releaseYear: 1989,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-blackstreet-joy',
    title: 'Joy (12" Remix)',
    artistId: 'artist-blackstreet',
    artistName: 'Blackstreet',
    label: 'Interscope Records / ChanceTEK One',
    albumId: 'album-blackstreet-joy',
    albumTitle: 'Blackstreet',
    audioUrl: '/audio/uploads/Blackstreet_Joy_12_Remix.mp3',
    coverUrl: '/images/albums/blackstreet_joy.jpg',
    duration: 252,
    genre: 'R&B / New Jack Swing',
    bpm: 96,
    releaseYear: 1994,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-bobby-brown-every-little-step',
    title: 'Every Little Step',
    artistId: 'artist-bobby-brown',
    artistName: 'Bobby Brown',
    label: 'MCA Records / ChanceTEK One',
    albumId: 'album-bobby-brown-dont-be-cruel',
    albumTitle: "Don't Be Cruel",
    audioUrl: '/audio/uploads/Bobby_Brown_Every_Little_Step.mp3',
    coverUrl: '/images/albums/bobby_brown_dont_be_cruel.jpg',
    duration: 238,
    genre: 'New Jack Swing / R&B',
    bpm: 100,
    releaseYear: 1988,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-bobby-brown-my-prerogative',
    title: 'My Prerogative',
    artistId: 'artist-bobby-brown',
    artistName: 'Bobby Brown',
    label: 'MCA Records / ChanceTEK One',
    albumId: 'album-bobby-brown-dont-be-cruel',
    albumTitle: "Don't Be Cruel",
    audioUrl: '/audio/uploads/Bobby_Brown_My_Prerogative.mp3',
    coverUrl: '/images/albums/bobby_brown_dont_be_cruel.jpg',
    duration: 291,
    genre: 'New Jack Swing',
    bpm: 110,
    releaseYear: 1988,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-carl-thomas-i-wish',
    title: 'I Wish',
    artistId: 'artist-carl-thomas',
    artistName: 'Carl Thomas',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-carl-thomas-emotional',
    albumTitle: 'Emotional',
    audioUrl: '/audio/uploads/Carl_Thomas_I_Wish.mp3',
    coverUrl: '/images/albums/carl_thomas_emotional.jpg',
    duration: 231,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 72,
    releaseYear: 2000,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-carl-thomas-summer-rain',
    title: 'Summer Rain',
    artistId: 'artist-carl-thomas',
    artistName: 'Carl Thomas',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-carl-thomas-emotional',
    albumTitle: 'Emotional',
    audioUrl: '/audio/uploads/Carl_Thomas_Summer_Rain.mp3',
    coverUrl: '/images/albums/carl_thomas_emotional.jpg',
    duration: 300,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 68,
    releaseYear: 2000,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-change-glow-of-love',
    title: 'The Glow Of Love',
    artistId: 'artist-change',
    artistName: 'Change',
    label: 'Warner Bros / RFC Records / ChanceTEK One',
    albumId: 'album-change-glow-of-love',
    albumTitle: 'The Glow Of Love',
    audioUrl: '/audio/uploads/Change_The_Glow_Of_Love.mp3',
    coverUrl: '/images/albums/change_glow_of_love.jpg',
    duration: 373,
    genre: 'Disco / Post-Disco / Funk',
    bpm: 114,
    releaseYear: 1980,
    crateId: 'disco',
    crateName: 'Disco',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-dennis-edwards-dont-look',
    title: "Don't Look Any Further",
    artistId: 'artist-dennis-edwards',
    artistName: 'Dennis Edwards feat. Siedah Garrett',
    label: 'Gordy / Motown / ChanceTEK One',
    albumId: 'album-dennis-edwards-dont-look',
    albumTitle: "Don't Look Any Further",
    audioUrl: '/audio/uploads/Dennis_Edwards_Dont_Look_Any_Further.mp3',
    coverUrl: '/images/albums/dennis_edwards_dont_look.jpg',
    duration: 242,
    genre: 'R&B / Post-Disco / Break Beats',
    bpm: 96,
    releaseYear: 1984,
    crateId: 'break-beats-samples',
    crateName: 'Break Beats & Samples',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-fatback-band-i-found-lovin',
    title: 'I Found Lovin',
    artistId: 'artist-fatback-band',
    artistName: 'Fatback Band',
    label: 'Cotillion Records / ChanceTEK One',
    albumId: 'album-fatback-band-with-love',
    albumTitle: 'With Love',
    audioUrl: '/audio/uploads/Fatback_Band_I_Found_Lovin.mp3',
    coverUrl: '/images/albums/fatback_band_with_love.jpg',
    duration: 247,
    genre: 'Disco / Funk',
    bpm: 106,
    releaseYear: 1983,
    crateId: 'disco',
    crateName: 'Disco',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-fonda-rae-over-like-a-fat-rat',
    title: 'Over Like A Fat Rat',
    artistId: 'artist-fonda-rae',
    artistName: 'Fonda Rae',
    label: 'Vanguard Records / ChanceTEK One',
    albumId: 'album-fonda-rae-fat-rat',
    albumTitle: 'Over Like A Fat Rat',
    audioUrl: '/audio/uploads/Fonda_Rae_Over_Like_A_Fat_Rat.mp3',
    coverUrl: '/images/albums/fonda_rae_fat_rat.jpg',
    duration: 398,
    genre: 'Disco / Club / Break Beats',
    bpm: 112,
    releaseYear: 1982,
    crateId: 'disco',
    crateName: 'Disco',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-gap-band-outstanding',
    title: 'Outstanding',
    artistId: 'artist-gap-band',
    artistName: 'The Gap Band',
    label: 'Total Experience / ChanceTEK One',
    albumId: 'album-gap-band-iv',
    albumTitle: 'Gap Band IV',
    audioUrl: '/audio/uploads/Gap_Band_Outstanding.mp3',
    coverUrl: '/images/albums/gap_band_iv.jpg',
    duration: 200,
    genre: 'R&B / Funk / Break Beats',
    bpm: 102,
    releaseYear: 1982,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-grandmaster-flash-freedom',
    title: 'Freedom',
    artistId: 'artist-grandmaster-flash',
    artistName: 'Grandmaster Flash & The Furious Five',
    label: 'Sugar Hill Records / ChanceTEK One',
    albumId: 'album-grandmaster-flash-freedom',
    albumTitle: 'The Message',
    audioUrl: '/audio/uploads/Grandmaster_Flash_Freedom.mp3',
    coverUrl: '/images/albums/grandmaster_flash_freedom.jpg',
    duration: 239,
    genre: 'Golden Era Hip Hop / Old School',
    bpm: 110,
    releaseYear: 1980,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-got-til-its-gone',
    title: "Got 'Til It's Gone",
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson feat. Q-Tip & Joni Mitchell',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-velvet-rope',
    albumTitle: 'The Velvet Rope',
    audioUrl: '/audio/uploads/Janet_Jackson_Got_Til_Its_Gone.mp3',
    coverUrl: '/images/albums/janet_jackson_velvet_rope.png',
    duration: 254,
    genre: 'R&B / Neo-Soul',
    bpm: 91,
    releaseYear: 1997,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-lauryn-hill-ex-factor',
    title: 'Ex-Factor',
    artistId: 'artist-lauryn-hill',
    artistName: 'Lauryn Hill',
    label: 'Ruffhouse / Columbia / ChanceTEK One',
    albumId: 'album-lauryn-hill-miseducation',
    albumTitle: 'The Miseducation of Lauryn Hill',
    audioUrl: '/audio/uploads/Lauryn_Hill_Ex_Factor_Remix.mp3',
    coverUrl: '/images/albums/lauryn_hill_miseducation.jpg',
    duration: 326,
    genre: 'R&B / Neo-Soul',
    bpm: 84,
    releaseYear: 1998,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-mary-j-blige-i-can-love-you',
    title: 'I Can Love You',
    artistId: 'artist-mary-j-blige',
    artistName: 'Mary J. Blige feat. Lil Kim',
    label: 'MCA Records / ChanceTEK One',
    albumId: 'album-mary-j-blige-share-my-world',
    albumTitle: 'Share My World',
    audioUrl: '/audio/uploads/Mary_J_Blige_I_Can_Love_You.mp3',
    coverUrl: '/images/albums/mary_j_blige_share_my_world.jpg',
    duration: 284,
    genre: 'R&B / Soul',
    bpm: 86,
    releaseYear: 1997,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-maze-before-i-let-go',
    title: 'Before I Let Go',
    artistId: 'artist-maze',
    artistName: 'Maze feat. Frankie Beverly',
    label: 'Capitol Records / ChanceTEK One',
    albumId: 'album-maze-live-in-new-orleans',
    albumTitle: 'Live in New Orleans',
    audioUrl: '/audio/uploads/Maze_Frankie_Beverly_Before_I_Let_Go.mp3',
    coverUrl: '/images/albums/maze_live_in_new_orleans.jpg',
    duration: 310,
    genre: 'R&B / Soul / Quiet Storm',
    bpm: 114,
    releaseYear: 1981,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-parliament-flashlight',
    title: 'Flashlight',
    artistId: 'artist-parliament',
    artistName: 'Parliament',
    label: 'Casablanca Records / ChanceTEK One',
    albumId: 'album-parliament-funkentelechy',
    albumTitle: 'Funkentelechy Vs. the Placebo Syndrome',
    audioUrl: '/audio/uploads/Parliament_Flashlight.mp3',
    coverUrl: '/images/albums/parliament_funkentelechy.jpg',
    duration: 341,
    genre: 'Funk / P-Funk / Break Beats',
    bpm: 106,
    releaseYear: 1977,
    crateId: 'break-beats-samples',
    crateName: 'Break Beats & Samples',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-sade-by-your-side',
    title: 'By Your Side (Neptunes Remix)',
    artistId: 'artist-sade',
    artistName: 'Sade',
    label: 'Epic Records / ChanceTEK One',
    albumId: 'album-sade-lovers-rock',
    albumTitle: 'Lovers Rock',
    audioUrl: '/audio/uploads/Sade_By_Your_Side_Neptunes_Remix.mp3',
    coverUrl: '/images/albums/sade_lovers_rock.png',
    duration: 247,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 78,
    releaseYear: 2000,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-swv-right-here',
    title: 'Right Here (Human Nature)',
    artistId: 'artist-swv',
    artistName: 'SWV',
    label: 'RCA Records / ChanceTEK One',
    albumId: 'album-swv-its-about-time',
    albumTitle: "It's About Time",
    audioUrl: '/audio/uploads/SWV_Right_Here_Human_Nature.mp3',
    coverUrl: '/images/albums/swv_its_about_time.jpg',
    duration: 227,
    genre: 'R&B / New Jack Swing',
    bpm: 96,
    releaseYear: 1992,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-swv-youre-the-one',
    title: "You're The One",
    artistId: 'artist-swv',
    artistName: 'SWV',
    label: 'RCA Records / ChanceTEK One',
    albumId: 'album-swv-new-beginning',
    albumTitle: 'New Beginning',
    audioUrl: '/audio/uploads/SWV_Youre_The_One.mp3',
    coverUrl: '/images/albums/swv_new_beginning.jpg',
    duration: 284,
    genre: 'R&B / Neo-Soul',
    bpm: 94,
    releaseYear: 1996,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-taana-gardner-heartbeat',
    title: 'Heartbeat',
    artistId: 'artist-taana-gardner',
    artistName: 'Taana Gardner',
    label: 'West End Records / ChanceTEK One',
    albumId: 'album-taana-gardner-heartbeat',
    albumTitle: 'Heartbeat',
    audioUrl: '/audio/uploads/Taana_Gardner_Heartbeat.mp3',
    coverUrl: '/images/albums/taana_gardner_heartbeat.jpg',
    duration: 338,
    genre: 'Disco / Garage House / Break Beats',
    bpm: 100,
    releaseYear: 1981,
    crateId: 'disco',
    crateName: 'Disco',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-teedra-moses-be-your-girl',
    title: 'Be Your Girl',
    artistId: 'artist-teedra-moses',
    artistName: 'Teedra Moses',
    label: 'TVT Records / ChanceTEK One',
    albumId: 'album-teedra-moses-complex-simplicity',
    albumTitle: 'Complex Simplicity',
    audioUrl: '/audio/uploads/Teedra_Moses_Be_Your_Girl.mp3',
    coverUrl: '/images/albums/teedra_moses_complex_simplicity.png',
    duration: 254,
    genre: 'R&B / Neo-Soul',
    bpm: 92,
    releaseYear: 2004,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-tevin-campbell-can-we-talk',
    title: 'Can We Talk',
    artistId: 'artist-tevin-campbell',
    artistName: 'Tevin Campbell',
    label: 'Qwest / Warner Bros / ChanceTEK One',
    albumId: 'album-tevin-campbell-im-ready',
    albumTitle: "I'm Ready",
    audioUrl: '/audio/uploads/Tevin_Campbell_Can_We_Talk.mp3',
    coverUrl: '/images/albums/tevin_campbell_im_ready.jpg',
    duration: 284,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 74,
    releaseYear: 1993,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-isley-brothers-for-the-love-of-you',
    title: 'For The Love Of You',
    artistId: 'artist-isley-brothers',
    artistName: 'The Isley Brothers',
    label: 'T-Neck / Epic / ChanceTEK One',
    albumId: 'album-isley-brothers-heat-is-on',
    albumTitle: 'The Heat Is On',
    audioUrl: '/audio/uploads/The_Isley_Brothers_For_The_Love_Of_You.mp3',
    coverUrl: '/images/albums/isley_brothers_heat_is_on.jpg',
    duration: 337,
    genre: 'Slow Jams / Soul Quiet Storm',
    bpm: 80,
    releaseYear: 1975,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-spinners-could-it-be-im-falling-in-love',
    title: "Could It Be I'm Falling In Love",
    artistId: 'artist-spinners',
    artistName: 'The Spinners',
    label: 'Atlantic Records / ChanceTEK One',
    albumId: 'album-spinners-spinners',
    albumTitle: 'Spinners',
    audioUrl: '/audio/uploads/The_Spinners_Could_It_Be_Im_Falling_In_Love.mp3',
    coverUrl: '/images/albums/spinners_spinners.jpg',
    duration: 253,
    genre: 'Philly Soul / Timeless R&B',
    bpm: 104,
    releaseYear: 1973,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-spinners-ill-be-around',
    title: "I'll Be Around",
    artistId: 'artist-spinners',
    artistName: 'The Spinners',
    label: 'Atlantic Records / ChanceTEK One',
    albumId: 'album-spinners-spinners',
    albumTitle: 'Spinners',
    audioUrl: '/audio/uploads/The_Spinners_Ill_Be_Around.mp3',
    coverUrl: '/images/albums/spinners_spinners.jpg',
    duration: 190,
    genre: 'Philly Soul / Timeless R&B',
    bpm: 112,
    releaseYear: 1972,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-aaliyah-at-your-best',
    title: 'At Your Best (You Are Love)',
    artistId: 'artist-aaliyah',
    artistName: 'Aaliyah',
    label: 'Blackground / Jive / ChanceTEK One',
    albumId: 'album-aaliyah-age-aint-nothing',
    albumTitle: "Age Ain't Nothing But A Number",
    audioUrl: '/audio/uploads/Aaliyah_At_Your_Best_Remix.mp3',
    coverUrl: '/images/albums/aaliyah_age_aint_nothing.jpg',
    duration: 275,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 72,
    releaseYear: 1994,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-aaliyah-one-in-a-million',
    title: 'One In A Million',
    artistId: 'artist-aaliyah',
    artistName: 'Aaliyah',
    label: 'Blackground / Atlantic / ChanceTEK One',
    albumId: 'album-aaliyah-one-in-a-million',
    albumTitle: 'One In A Million',
    audioUrl: '/audio/uploads/Aaliyah_One_In_A_Million_Mashup.mp3',
    coverUrl: '/images/albums/aaliyah_one_in_a_million.png',
    duration: 270,
    genre: 'R&B / Neo-Soul / Slow Jams',
    bpm: 85,
    releaseYear: 1996,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const JANET_JACKSON_TRACKS: Track[] = [
  {
    id: 'trk-pub-janet-jackson-together-again',
    title: 'Together Again',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-velvet-rope',
    albumTitle: 'The Velvet Rope',
    audioUrl: '/audio/uploads/Janet_Jackson_Together_Again.mp3',
    coverUrl: '/images/albums/janet_jackson_velvet_rope.png',
    duration: 301,
    genre: 'R&B / House / Dance',
    bpm: 123,
    releaseYear: 1997,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-i-get-lonely',
    title: 'I Get Lonely',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-velvet-rope',
    albumTitle: 'The Velvet Rope',
    audioUrl: '/audio/uploads/Janet_Jackson_I_Get_Lonely.mp3',
    coverUrl: '/images/albums/janet_jackson_velvet_rope.png',
    duration: 317,
    genre: 'R&B / Neo-Soul / Slow Jams',
    bpm: 64,
    releaseYear: 1997,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-thats-the-way',
    title: "That's The Way Love Goes",
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-janet',
    albumTitle: 'janet.',
    audioUrl: '/audio/uploads/Janet_Jackson_Thats_The_Way_Love_Goes.mp3',
    coverUrl: '/images/albums/janet_jackson_janet.jpg',
    duration: 265,
    genre: 'R&B / Soul / Downtempo',
    bpm: 100,
    releaseYear: 1993,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-any-time-any-place',
    title: 'Any Time, Any Place',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-janet',
    albumTitle: 'janet.',
    audioUrl: '/audio/uploads/Janet_Jackson_Any_Time_Any_Place.mp3',
    coverUrl: '/images/albums/janet_jackson_janet.jpg',
    duration: 428,
    genre: 'R&B / Slow Jams / Soul',
    bpm: 60,
    releaseYear: 1993,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-again',
    title: 'Again',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-janet',
    albumTitle: 'janet.',
    audioUrl: '/audio/uploads/Janet_Jackson_Again.mp3',
    coverUrl: '/images/albums/janet_jackson_janet.jpg',
    duration: 227,
    genre: 'R&B / Ballad / Soul',
    bpm: 68,
    releaseYear: 1993,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-janet-jackson-rhythm-nation',
    title: 'Rhythm Nation',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'A&M Records / ChanceTEK One',
    albumId: 'album-janet-jackson-rhythm-nation',
    albumTitle: "Janet Jackson's Rhythm Nation 1814",
    audioUrl: '/audio/uploads/Janet_Jackson_Rhythm_Nation.mp3',
    coverUrl: '/images/albums/janet_jackson_rhythm_nation.jpg',
    duration: 331,
    genre: 'New Jack Swing / Funk / Dance',
    bpm: 110,
    releaseYear: 1989,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-janet-jackson-all-for-you',
    title: 'All For You',
    artistId: 'artist-janet-jackson',
    artistName: 'Janet Jackson',
    label: 'Virgin Records / ChanceTEK One',
    albumId: 'album-janet-jackson-all-for-you',
    albumTitle: 'All for You',
    audioUrl: '/audio/uploads/Janet_Jackson_All_For_You.mp3',
    coverUrl: '/images/albums/janet_jackson_all_for_you.jpg',
    duration: 329,
    genre: 'Dance-Pop / Disco / R&B',
    bpm: 114,
    releaseYear: 2001,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const AVANT_TRACKS: Track[] = [
  {
    id: 'trk-pub-avant-read-your-mind',
    title: 'Read Your Mind',
    artistId: 'artist-avant',
    artistName: 'Avant',
    label: 'Magic Johnson Music / MCA / ChanceTEK One',
    albumId: 'album-avant-my-thoughts',
    albumTitle: 'My Thoughts',
    audioUrl: '/audio/uploads/Avant_Read_Your_Mind.mp3',
    coverUrl: '/images/albums/avant_my_thoughts.jpg',
    duration: 262,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 65,
    releaseYear: 2003,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-avant-sailing',
    title: 'Sailing',
    artistId: 'artist-avant',
    artistName: 'Avant',
    label: 'Magic Johnson Music / MCA / ChanceTEK One',
    albumId: 'album-avant-my-thoughts',
    albumTitle: 'My Thoughts',
    audioUrl: '/audio/uploads/Avant_Sailing.mp3',
    coverUrl: '/images/albums/avant_my_thoughts.jpg',
    duration: 236,
    genre: 'R&B / Smooth Soul',
    bpm: 82,
    releaseYear: 2000,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-avant-destiny',
    title: 'Destiny',
    artistId: 'artist-avant',
    artistName: 'Avant',
    label: 'Magic Johnson Music / MCA / ChanceTEK One',
    albumId: 'album-avant-my-thoughts',
    albumTitle: 'My Thoughts',
    audioUrl: '/audio/uploads/Avant_Destiny.mp3',
    coverUrl: '/images/albums/avant_my_thoughts.jpg',
    duration: 228,
    genre: 'R&B / Neo-Soul',
    bpm: 90,
    releaseYear: 2000,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-avant-flickin',
    title: "Flickin'",
    artistId: 'artist-avant',
    artistName: 'Avant',
    label: 'Magic Johnson Music / MCA / ChanceTEK One',
    albumId: 'album-avant-ecstasy',
    albumTitle: 'Ecstasy',
    audioUrl: '/audio/uploads/Avant_Flickin.mp3',
    coverUrl: '/images/albums/avant_ecstasy.jpg',
    duration: 245,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 78,
    releaseYear: 2002,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
  {
    id: 'trk-pub-avant-separated',
    title: 'Separated',
    artistId: 'artist-avant',
    artistName: 'Avant',
    label: 'Magic Johnson Music / MCA / ChanceTEK One',
    albumId: 'album-avant-my-thoughts',
    albumTitle: 'My Thoughts',
    audioUrl: '/audio/uploads/Avant_Separated.mp3',
    coverUrl: '/images/albums/avant_my_thoughts.jpg',
    duration: 254,
    genre: 'R&B / Soul / Slow Jams',
    bpm: 68,
    releaseYear: 2000,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const ONE_ONE_TWO_TRACKS: Track[] = [
  {
    id: 'trk-pub-112-part-2-remix',
    title: 'Part 2 the Remix',
    artistId: 'artist-112',
    artistName: '112',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-112-part-iii',
    albumTitle: 'Part III',
    audioUrl: '/audio/uploads/112_Part_2_The_Remix.mp3',
    coverUrl: '/images/albums/112_part_iii.jpg',
    duration: 275,
    genre: 'R&B / Club / Bad Boy',
    bpm: 104,
    releaseYear: 2001,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-112-peaches-and-cream',
    title: 'Peaches & Cream',
    artistId: 'artist-112',
    artistName: '112',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-112-part-iii',
    albumTitle: 'Part III',
    audioUrl: '/audio/uploads/112_Peaches_And_Cream.mp3',
    coverUrl: '/images/albums/112_part_iii.jpg',
    duration: 193,
    genre: 'R&B / Upbeat / Club',
    bpm: 108,
    releaseYear: 2001,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-112-its-over-now',
    title: "It's Over Now",
    artistId: 'artist-112',
    artistName: '112',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-112-part-iii',
    albumTitle: 'Part III',
    audioUrl: '/audio/uploads/112_Its_Over_Now.mp3',
    coverUrl: '/images/albums/112_part_iii.jpg',
    duration: 264,
    genre: 'R&B / Smooth Groove',
    bpm: 98,
    releaseYear: 2001,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-112-cupid',
    title: 'Cupid',
    artistId: 'artist-112',
    artistName: '112',
    label: 'Bad Boy Entertainment / ChanceTEK One',
    albumId: 'album-112-self-titled',
    albumTitle: '112',
    audioUrl: '/audio/uploads/112_Cupid.mp3',
    coverUrl: '/images/albums/112_self_titled.jpg',
    duration: 252,
    genre: 'R&B / Slow Jams / Soul',
    bpm: 64,
    releaseYear: 1996,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const ASHANTI_TRACKS: Track[] = [
  {
    id: 'trk-pub-ashanti-only-you-remix',
    title: 'Only You Remix',
    artistId: 'artist-ashanti',
    artistName: 'Ashanti',
    label: 'Murder Inc / Def Jam / ChanceTEK One',
    albumId: 'album-ashanti-concrete-rose',
    albumTitle: 'Concrete Rose',
    audioUrl: '/audio/uploads/Ashanti_Only_You_Remix.mp3',
    coverUrl: '/images/albums/ashanti_concrete_rose.jpg',
    duration: 186,
    genre: 'R&B / Urban Soul',
    bpm: 94,
    releaseYear: 2004,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-ashanti-foolish',
    title: 'Foolish',
    artistId: 'artist-ashanti',
    artistName: 'Ashanti',
    label: 'Murder Inc / Def Jam / ChanceTEK One',
    albumId: 'album-ashanti-debut',
    albumTitle: 'Ashanti',
    audioUrl: '/audio/uploads/Ashanti_Foolish.mp3',
    coverUrl: '/images/albums/ashanti_ashanti.jpg',
    duration: 227,
    genre: 'R&B / Soul',
    bpm: 90,
    releaseYear: 2002,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-ashanti-rock-wit-u',
    title: 'Rock Wit U (Aww Baby)',
    artistId: 'artist-ashanti',
    artistName: 'Ashanti',
    label: 'Murder Inc / Def Jam / ChanceTEK One',
    albumId: 'album-ashanti-debut',
    albumTitle: 'Ashanti',
    audioUrl: '/audio/uploads/Ashanti_Rock_Wit_U.mp3',
    coverUrl: '/images/albums/ashanti_ashanti.jpg',
    duration: 209,
    genre: 'R&B / Summer Groove',
    bpm: 95,
    releaseYear: 2003,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const CHRIS_BROWN_TRACKS: Track[] = [
  {
    id: 'trk-pub-chris-brown-poppin',
    title: "Poppin'",
    artistId: 'artist-chris-brown',
    artistName: 'Chris Brown',
    label: 'Jive Records / CBE / ChanceTEK One',
    albumId: 'album-chris-brown-debut',
    albumTitle: 'Chris Brown',
    audioUrl: '/audio/uploads/Chris_Brown_Poppin.mp3',
    coverUrl: '/images/albums/chris_brown_self_titled.jpg',
    duration: 265,
    genre: 'R&B / Slow Jams / Urban',
    bpm: 68,
    releaseYear: 2005,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-chris-brown-run-it',
    title: 'Run It!',
    artistId: 'artist-chris-brown',
    artistName: 'Chris Brown feat. Juelz Santana',
    label: 'Jive Records / CBE / ChanceTEK One',
    albumId: 'album-chris-brown-debut',
    albumTitle: 'Chris Brown',
    audioUrl: '/audio/uploads/Chris_Brown_Run_It.mp3',
    coverUrl: '/images/albums/chris_brown_self_titled.jpg',
    duration: 229,
    genre: 'R&B / Crunk & B / Dance',
    bpm: 101,
    releaseYear: 2005,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-chris-brown-yo-excuse-me-miss',
    title: 'Yo (Excuse Me Miss)',
    artistId: 'artist-chris-brown',
    artistName: 'Chris Brown',
    label: 'Jive Records / CBE / ChanceTEK One',
    albumId: 'album-chris-brown-debut',
    albumTitle: 'Chris Brown',
    audioUrl: '/audio/uploads/Chris_Brown_Yo_Excuse_Me_Miss.mp3',
    coverUrl: '/images/albums/chris_brown_self_titled.jpg',
    duration: 229,
    genre: 'R&B / Smooth Urban Soul',
    bpm: 87,
    releaseYear: 2005,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
];

export const BROWNSTONE_TRACKS: Track[] = [
  {
    id: 'trk-pub-brownstone-if-you-love-me',
    title: 'If You Love Me',
    artistId: 'artist-brownstone',
    artistName: 'Brownstone',
    label: 'MJJ Music / Epic / ChanceTEK One',
    albumId: 'album-brownstone-bottom-up',
    albumTitle: 'From the Bottom Up',
    audioUrl: '/audio/uploads/Brownstone_If_You_Love_Me.mp3',
    coverUrl: '/images/albums/brownstone_from_the_bottom_up.jpg',
    duration: 304,
    genre: '90s R&B / Soul Harmonies',
    bpm: 96,
    releaseYear: 1994,
    crateId: 'oldschool-rnb-soul',
    crateName: 'Timeless R&B | Soul Music',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-brownstone-grapevyne',
    title: 'Grapevyne',
    artistId: 'artist-brownstone',
    artistName: 'Brownstone',
    label: 'MJJ Music / Epic / ChanceTEK One',
    albumId: 'album-brownstone-bottom-up',
    albumTitle: 'From the Bottom Up',
    audioUrl: '/audio/uploads/Brownstone_Grapevyne.mp3',
    coverUrl: '/images/albums/brownstone_from_the_bottom_up.jpg',
    duration: 251,
    genre: '90s R&B / Slow Jams',
    bpm: 74,
    releaseYear: 1994,
    crateId: 'slow-jams',
    crateName: 'Slow Jams',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
];

export const JERMAINE_DUPRI_TRACKS: Track[] = [
  {
    id: 'trk-pub-jermaine-dupri-welcome-to-atlanta',
    title: 'Welcome to Atlanta',
    artistId: 'artist-jermaine-dupri',
    artistName: 'Jermaine Dupri feat. Ludacris',
    label: 'So So Def / Columbia / ChanceTEK One',
    albumId: 'album-jermaine-dupri-instructions',
    albumTitle: 'Instructions',
    audioUrl: '/audio/uploads/Jermaine_Dupri_Welcome_To_Atlanta.mp3',
    coverUrl: '/images/albums/jermaine_dupri_instructions.jpg',
    duration: 200,
    genre: 'Hip Hop / Dirty South Anthem',
    bpm: 100,
    releaseYear: 2001,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-ny-state-of-mind',
    title: 'N.Y. State of Mind',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-illmatic',
    albumTitle: 'Illmatic',
    audioUrl: '/audio/uploads/Nas_NY_State_Of_Mind.mp3',
    coverUrl: '/images/albums/nas_illmatic.jpg',
    duration: 294,
    genre: 'Golden Era Hip Hop',
    bpm: 84,
    releaseYear: 1994,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-halftime',
    title: 'Halftime',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-illmatic',
    albumTitle: 'Illmatic',
    audioUrl: '/audio/uploads/Nas_Halftime.mp3',
    coverUrl: '/images/albums/nas_illmatic.jpg',
    duration: 260,
    genre: 'Golden Era Hip Hop',
    bpm: 92,
    releaseYear: 1992,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-the-world-is-yours',
    title: 'The World Is Yours',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-illmatic',
    albumTitle: 'Illmatic',
    audioUrl: '/audio/uploads/Nas_The_World_Is_Yours.mp3',
    coverUrl: '/images/albums/nas_illmatic.jpg',
    duration: 290,
    genre: 'Golden Era Hip Hop',
    bpm: 86,
    releaseYear: 1994,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-if-i-ruled-the-world',
    title: 'If I Ruled the World (Imagine That)',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-it-was-written',
    albumTitle: 'It Was Written',
    audioUrl: '/audio/uploads/Nas_If_I_Ruled_The_World.mp3',
    coverUrl: '/images/albums/nas_it_was_written.jpg',
    duration: 282,
    genre: 'Hip-Hop / R&B',
    bpm: 94,
    releaseYear: 1996,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-made-you-look',
    title: 'Made You Look',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / Ill Will / ChanceTEK One',
    albumId: 'album-nas-gods-son',
    albumTitle: "God's Son",
    audioUrl: '/audio/uploads/Nas_Made_You_Look.mp3',
    coverUrl: '/images/albums/nas_gods_son.jpg',
    duration: 202,
    genre: 'Break Beats',
    bpm: 94,
    releaseYear: 2002,
    crateId: 'break-beats',
    crateName: 'Break Beats',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-nas-is-like',
    title: 'Nas Is Like',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-i-am',
    albumTitle: 'I Am...',
    audioUrl: '/audio/uploads/Nas_Nas_Is_Like.mp3',
    coverUrl: '/images/albums/nas_i_am.jpg',
    duration: 237,
    genre: 'Golden Era Hip Hop',
    bpm: 94,
    releaseYear: 1999,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: true,
  },
  {
    id: 'trk-pub-nas-one-love',
    title: 'One Love',
    artistId: 'artist-nas',
    artistName: 'Nas',
    label: 'Columbia Records / ChanceTEK One',
    albumId: 'album-nas-illmatic',
    albumTitle: 'Illmatic',
    audioUrl: '/audio/uploads/Nas_One_Love.mp3',
    coverUrl: '/images/albums/nas_illmatic.jpg',
    duration: 325,
    genre: 'Golden Era Hip Hop',
    bpm: 91,
    releaseYear: 1994,
    crateId: 'golden-era-hip-hop',
    crateName: 'Golden Era Hip Hop',
    playCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    featured: false,
  },
];

export const BREAKBEAT_ANTHEM_TRACK: Track = {
  id: 'track-1',
  title: 'ChanceTEK One Break Beats',
  artistId: 'artist-1',
  artistName: 'ChanceTEK One',
  label: 'ChanceTEK One',
  albumId: 'album-1',
  albumTitle: 'Genesis of the Concrete Beat',
  audioUrl: '/audio/Fort_Apache.mp3',
  coverUrl: '/images/chancetek_banner.png',
  duration: 194,
  genre: 'Hip Hop / Big Beat',
  bpm: 130,
  releaseYear: 2026,
  lyrics: `[Intro - Scratching]\nYeah... ChanceTEK One in the session.\nChanceTEK One on the master deck.\nDropping the needle on the concrete floor.\n\n[Verse 1]\nWatch the fader flip, double-time rhythm kick,\nVinyl spinning steady with the needle on the tip.\nFrom the legendary roots to the future, hear the snare drum hit,\nChanceTEK One Break Beats, you can't fake this shit.\n\n[Chorus]\nBack to the groove, make the speakers move,\nNothing to hide and everything to prove.\nChanceTEK One Break Beats, authentic and raw,\nChanceTEK One laying down the law.`,
  playCount: 0,
  likeCount: 0,
  dislikeCount: 0,
  commentCount: 0,
  featured: true,
  crateId: 'golden-era-hip-hop',
  crateName: 'Golden Era Hip Hop',
};

export const PLATFORM_CANONICAL_TRACKS: Track[] = [
  BREAKBEAT_ANTHEM_TRACK,
  ...MICHAEL_JACKSON_TRACKS.filter((t) => t.id !== 'trk-pub-1791515551373-3cke7'),
  ...VAULT_CLASSIC_TRACKS,
];

