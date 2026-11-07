/**
 * ChanceTEKone — Music Metadata & Stream Normalizer
 * 
 * Centralized, authoritative normalizer for:
 * 1. Resolving full track titles (fixing track numbers like '01', '08', raw filenames, and OneDrive artifacts).
 * 2. Resolving full artist names (eliminating 'Unknown Artist' or clipped strings).
 * 3. Resolving full album titles (eliminating 'Single Release'/'Vault Cuts' when authentic album is known).
 * 4. Resolving guaranteed, playable high-fidelity audio streams.
 */

import { getAuthenticAudioUrl, isVerifiedServerUpload, getResilientAudioFallback, isCrossArtistAudioMismatch } from './authenticAudioMap';
import { normalizePlayableUrl } from './audioAssetIntegrity';
export {
  PLATFORM_STANDARD_GENRES,
  classifyGenre,
  isTrackMatchingGenre,
  isGenericOrInvalidGenre,
  normalizeRawGenreString,
} from './genreClassifier';
export type { PlatformGenre } from './genreClassifier';

export interface CanonicalMetadataMatch {
  match: (artist: string, title: string) => boolean;
  album: string;
  artist: string;
}

export const CANONICAL_ALBUM_REGISTRY: CanonicalMetadataMatch[] = [
  // Janet Jackson
  {
    match: (a, t) =>
      a.includes('janet') &&
      (t.includes("got 'til") || t.includes('got til') || t.includes('together again') || t.includes('get lonely')),
    album: 'The Velvet Rope',
    artist: 'Janet Jackson',
  },
  {
    match: (a, t) =>
      a.includes('janet') &&
      (t.includes('that s the way') || t.includes('thats the way') || t.includes('any time') || t.includes('again')),
    album: 'janet.',
    artist: 'Janet Jackson',
  },
  {
    match: (a, t) =>
      a.includes('janet') &&
      (t.includes('rhythm nation') || t.includes('miss you much') || t.includes('love will never do')),
    album: "Janet Jackson's Rhythm Nation 1814",
    artist: 'Janet Jackson',
  },
  {
    match: (a, t) =>
      a.includes('janet') &&
      (t.includes('all for you') || t.includes('someone to call my lover')),
    album: 'All for You',
    artist: 'Janet Jackson',
  },

  // Avant
  {
    match: (a, t) =>
      a.includes('avant') &&
      (t.includes('flickin') || t.includes('makin good love') || t.includes('ecstasy')),
    album: 'Ecstasy',
    artist: 'Avant',
  },
  {
    match: (a, t) =>
      a.includes('avant') ||
      (t.includes('read your mind') ||
        t.includes('sailing') ||
        t.includes('destiny') ||
        t.includes('my first love') ||
        t.includes('separated')),
    album: 'My Thoughts',
    artist: 'Avant',
  },

  // 112
  {
    match: (a, t) =>
      (a.includes('112') || t.includes('112')) &&
      (t.includes('cupid') || t.includes('only you')),
    album: '112',
    artist: '112',
  },
  {
    match: (a, t) =>
      a.includes('112') ||
      (t.includes('peaches') ||
        t.includes('over now') ||
        t.includes('part 2')),
    album: 'Part III',
    artist: '112',
  },

  // Ashanti
  {
    match: (a, t) =>
      a.includes('ashanti') &&
      (t.includes('only you') || t.includes('only u')),
    album: 'Concrete Rose',
    artist: 'Ashanti',
  },
  {
    match: (a, t) =>
      a.includes('ashanti') ||
      (t.includes('foolish') || t.includes('rock wit u') || t.includes('baby') || t.includes('happy')),
    album: 'Ashanti',
    artist: 'Ashanti',
  },

  // Chris Brown
  {
    match: (a, t) =>
      a.includes('chris brown') ||
      (t.includes('poppin') || t.includes('run it') || t.includes('excuse me miss')),
    album: 'Chris Brown',
    artist: 'Chris Brown',
  },

  // Brownstone
  {
    match: (a, t) =>
      a.includes('brownstone') ||
      (t.includes('if you love me') || t.includes('grapevyne')),
    album: 'From the Bottom Up',
    artist: 'Brownstone',
  },

  // Jermaine Dupri
  {
    match: (a, t) =>
      a.includes('jermaine dupri') ||
      (t.includes('welcome to atlanta')),
    album: 'Instructions',
    artist: 'Jermaine Dupri',
  },

  // Michael Jackson
  {
    match: (a, t) =>
      a.includes('michael jackson') &&
      (t.includes('dont stop') ||
        t.includes("don't stop") ||
        t.includes('rock with you') ||
        t.includes('workin') ||
        t.includes('get on the floor') ||
        t.includes('off the wall') ||
        t.includes('girlfriend') ||
        t.includes('out of my life') ||
        t.includes('cant help') ||
        t.includes("can't help") ||
        t.includes('falling in love') ||
        t.includes('burn this disco')),
    album: 'Off The Wall',
    artist: 'Michael Jackson',
  },
  {
    match: (a, t) =>
      a.includes('michael jackson') &&
      (t.includes('startin') ||
        t.includes('baby be mine') ||
        t.includes('girl is mine') ||
        t.includes('thriller') ||
        t.includes('beat it') ||
        t.includes('billie jean') ||
        t.includes('human nature') ||
        t.includes('p.y.t') ||
        t.includes('pyt') ||
        t.includes('lady in my life')),
    album: 'Thriller',
    artist: 'Michael Jackson',
  },

  // Aaliyah
  {
    match: (a, t) =>
      (a.includes('aaliyah') || t.includes('aaliyah')) &&
      (t.includes('at your best') || t.includes('age aint nothing') || t.includes("age ain't nothing")),
    album: "Age Ain't Nothing But A Number",
    artist: 'Aaliyah',
  },
  {
    match: (a, t) =>
      (a.includes('aaliyah') || t.includes('aaliyah')) &&
      (t.includes('one in a million') || t.includes('if your girl') || t.includes('4 page letter')),
    album: 'One In A Million',
    artist: 'Aaliyah',
  },
  {
    match: (a, t) =>
      (a.includes('aaliyah') || t.includes('aaliyah')) &&
      (t.includes('try again') ||
        t.includes('more than a woman') ||
        t.includes('rock the boat') ||
        t.includes('we need a resolution') ||
        t.includes('resolution') ||
        t.includes('care 4 u')),
    album: 'Aaliyah',
    artist: 'Aaliyah',
  },

  // Alicia Keys
  {
    match: (a, t) =>
      (a.includes('alicia') || t.includes('alicia')) && t.includes('fallin'),
    album: 'Songs in A Minor',
    artist: 'Alicia Keys',
  },
  {
    match: (a, t) =>
      (a.includes('alicia') || t.includes('alicia')) &&
      (t.includes('if i aint got you') || t.includes("if i ain't got you") || t.includes('diary') || t.includes('aint got you')),
    album: 'The Diary of Alicia Keys',
    artist: 'Alicia Keys',
  },
  {
    match: (a, t) =>
      (a.includes('alicia') || t.includes('alicia')) &&
      (t.includes('teenage love affair') || t.includes('no one') || t.includes('superwoman')),
    album: 'As I Am',
    artist: 'Alicia Keys',
  },

  // Classic Soul / Disco / Funk Artists
  {
    match: (a, t) => (a.includes('amerie') || t.includes('amerie')) && (t.includes('1 thing') || t.includes('one thing') || t.includes('touch')),
    album: 'Touch',
    artist: 'Amerie',
  },
  {
    match: (a, t) => (a.includes('amerie') || t.includes('amerie')) && (t.includes('why dont we fall') || t.includes("why don't we fall") || t.includes('all i have')),
    album: 'All I Have',
    artist: 'Amerie',
  },
  {
    match: (a, t) => a.includes('biz markie') || t.includes('just a friend'),
    album: 'The Biz Never Sleeps',
    artist: 'Biz Markie',
  },
  {
    match: (a, t) => a.includes('blackstreet') || t.includes('joy'),
    album: 'Blackstreet',
    artist: 'Blackstreet',
  },
  {
    match: (a, t) =>
      a.includes('bobby brown') ||
      t.includes('every little step') ||
      t.includes('my prerogative') ||
      t.includes('dont be cruel') ||
      t.includes("don't be cruel"),
    album: "Don't Be Cruel",
    artist: 'Bobby Brown',
  },
  {
    match: (a, t) =>
      a.includes('carl thomas') || t.includes('summer rain') || t.includes('i wish'),
    album: 'Emotional',
    artist: 'Carl Thomas',
  },
  {
    match: (a, t) => a.includes('change') || t.includes('glow of love'),
    album: 'The Glow Of Love',
    artist: 'Change',
  },
  {
    match: (a, t) =>
      a.includes('dennis edwards') ||
      t.includes('dont look any further') ||
      t.includes("don't look any further") ||
      t.includes('look any further'),
    album: "Don't Look Any Further",
    artist: 'Dennis Edwards',
  },
  {
    match: (a, t) =>
      a.includes('fatback') || t.includes('found lovin') || t.includes('found loving'),
    album: 'With Love',
    artist: 'Fatback Band',
  },
  {
    match: (a, t) =>
      a.includes('fonda rae') || t.includes('fat rat') || t.includes('over like a fat rat'),
    album: 'Over Like A Fat Rat',
    artist: 'Fonda Rae',
  },
  {
    match: (a, t) => a.includes('gap band') || t.includes('outstanding'),
    album: 'Gap Band IV',
    artist: 'The Gap Band',
  },
  {
    match: (a, t) =>
      a.includes('grandmaster') || (a.includes('flash') && t.includes('freedom')),
    album: 'The Message',
    artist: 'Grandmaster Flash & The Furious Five',
  },
  {
    match: (a, t) =>
      a.includes('janet jackson') || t.includes('got til its gone') || t.includes("got 'til") || t.includes('velvet rope'),
    album: 'The Velvet Rope',
    artist: 'Janet Jackson',
  },
  {
    match: (a, t) =>
      a.includes('lauryn hill') || t.includes('ex factor') || t.includes('ex-factor') || t.includes('miseducation'),
    album: 'The Miseducation of Lauryn Hill',
    artist: 'Lauryn Hill',
  },
  {
    match: (a, t) =>
      (a.includes('mary j') && a.includes('blige')) || t.includes('can love you') || t.includes('share my world'),
    album: 'Share My World',
    artist: 'Mary J. Blige',
  },
  {
    match: (a, t) => a.includes('maze') || t.includes('before i let go'),
    album: 'Live in New Orleans',
    artist: 'Maze feat. Frankie Beverly',
  },
  {
    match: (a, t) => a.includes('parliament') || t.includes('flashlight'),
    album: 'Funkentelechy Vs. the Placebo Syndrome',
    artist: 'Parliament',
  },
  {
    match: (a, t) =>
      a.includes('sade') || t.includes('by your side') || t.includes('lovers rock'),
    album: 'Lovers Rock',
    artist: 'Sade',
  },
  {
    match: (a, t) =>
      a.includes('swv') &&
      (t.includes('youre the one') || t.includes("you're the one") || t.includes('new beginning')),
    album: 'New Beginning',
    artist: 'SWV',
  },
  {
    match: (a, t) =>
      a.includes('swv') &&
      (t.includes('right here') || t.includes('weak') || t.includes('about time')),
    album: "It's About Time",
    artist: 'SWV',
  },
  {
    match: (a, t) => a.includes('taana') || t.includes('heartbeat'),
    album: 'Heartbeat',
    artist: 'Taana Gardner',
  },
  {
    match: (a, t) =>
      a.includes('teedra') || t.includes('be your girl') || t.includes('complex simplicity'),
    album: 'Complex Simplicity',
    artist: 'Teedra Moses',
  },
  {
    match: (a, t) =>
      a.includes('tevin campbell') || t.includes('can we talk') || t.includes('im ready') || t.includes("i'm ready"),
    album: "I'm Ready",
    artist: 'Tevin Campbell',
  },
  {
    match: (a, t) =>
      a.includes('isley') || t.includes('for the love of you') || t.includes('heat is on'),
    album: 'The Heat Is On',
    artist: 'The Isley Brothers',
  },
  {
    match: (a, t) =>
      a.includes('spinners') ||
      t.includes('could it be im falling') ||
      t.includes("could it be i'm falling") ||
      t.includes('ill be around') ||
      t.includes("i'll be around"),
    album: 'Spinners',
    artist: 'The Spinners',
  },

  // Platform Originals & Creators
  {
    match: (a, t) =>
      a.includes('ChanceTEKone') ||
      t.includes('break beats') ||
      t.includes('neon crate') ||
      t.includes('sp-1200') ||
      t.includes('dembow underground') ||
      t.includes('concrete amplifier'),
    album: 'Genesis of the Concrete Beat',
    artist: 'ChanceTEKone',
  },
  {
    match: (a, t) =>
      a.includes('cipher voltage') ||
      t.includes('cyber grid') ||
      t.includes('sub-orbital') ||
      t.includes('miami 808'),
    album: 'Quantum Break Sequence',
    artist: 'Cipher Voltage',
  },
  {
    match: (a, t) =>
      a.includes('luna brass') ||
      t.includes('soul kitchen') ||
      t.includes('midnight crate') ||
      t.includes('delta tape') ||
      t.includes('bluegrass break'),
    album: 'Velvet Horns & Tape Saturation',
    artist: 'Luna Brass & The Crate Queens',
  },
  {
    match: (a, t) =>
      a.includes('sub-zero') ||
      a.includes('sub zero') ||
      t.includes('subterranean') ||
      t.includes('lagos midnight'),
    album: 'Bronx Heritage Archive',
    artist: 'Sub-Zero Rhythm Collective',
  },
  {
    match: (a) => a.includes('chancetek') || a.includes('chancellor'),
    album: 'ChanceTEKone PRESENTS: ChanceTEK',
    artist: 'Chancellor @ ChanceTEK LLC',
  },
];

/**
 * Normalizes any track title by removing track numbers, raw filename artifacts, and OneDrive paths.
 */
export function normalizeTrackTitle(rawTitle: string, artistName?: string, albumTitle?: string): string {
  let t = String(rawTitle || '').trim();
  const a = String(artistName || '').toLowerCase().trim();
  const al = String(albumTitle || '').toLowerCase().trim();

  // Strip file extensions and directory paths
  t = t.replace(/\.mp3$/i, '').replace(/\.wav$/i, '').replace(/\.m4a$/i, '');
  t = t.replace(/^OneDrive[\/\\]/i, '').replace(/^Audio[\/\\]/i, '').replace(/^uploads[\/\\]/i, '');

  // Specific numbered track matches
  if (/^0?1$/.test(t)) {
    if (al.includes('thriller')) return "Wanna Be Startin' Somethin'";
    if (a.includes('michael jackson') || al.includes('off the wall')) return "Don't Stop 'Til You Get Enough";
  }
  if (/^0?2$/.test(t)) {
    if (al.includes('thriller')) return 'Baby Be Mine';
    if (a.includes('michael jackson') || al.includes('off the wall')) return 'Rock With You';
  }
  if (/^0?3$/.test(t)) {
    if (al.includes('thriller')) return 'The Girl Is Mine';
    if (a.includes('michael jackson') || al.includes('off the wall')) return "Workin' Day And Night";
  }
  if (/^0?4$/.test(t)) {
    if (al.includes('thriller')) return 'Thriller';
    if (a.includes('michael jackson') || al.includes('off the wall')) return 'Get On The Floor';
  }
  if (/^0?5$/.test(t)) {
    if (al.includes('thriller')) return 'Beat It';
    if (a.includes('michael jackson') || al.includes('off the wall')) return 'Off The Wall';
  }
  if (/^0?6$/.test(t)) {
    if (al.includes('thriller')) return 'Billie Jean';
    if (a.includes('michael jackson') || al.includes('off the wall')) return 'Girlfriend';
  }
  if (/^0?7$/.test(t)) {
    if (al.includes('thriller')) return 'Human Nature';
    if (a.includes('michael jackson') || al.includes('off the wall')) return "She's Out Of My Life";
  }
  if (/^0?8$/.test(t)) {
    if (al.includes('thriller')) return 'P.Y.T. (Pretty Young Thing)';
    if (a.includes('michael jackson') || al.includes('off the wall')) return "I Can't Help It";
  }
  if (/^0?9$/.test(t)) {
    if (al.includes('thriller')) return 'The Lady in My Life';
    if (a.includes('michael jackson') || al.includes('off the wall')) return "It's The Falling In Love";
  }
  if (/^10$/.test(t)) {
    if (a.includes('michael jackson') || al.includes('off the wall')) return 'Burn This Disco Out';
  }

  // Raw Michael Jackson filename pattern
  if (t.includes('Michael_Jackson_-_')) {
    if (t.includes('01')) return "Don't Stop 'Til You Get Enough";
    if (t.includes('02')) return 'Rock With You';
    if (t.includes('03')) return "Workin' Day And Night";
    if (t.includes('04')) return 'Get On The Floor';
    if (t.includes('05')) return 'Off The Wall';
    if (t.includes('06')) return 'Girlfriend';
    if (t.includes('07')) return "She's Out Of My Life";
    if (t.includes('08')) return "I Can't Help It";
    if (t.includes('09')) return "It's The Falling In Love";
    if (t.includes('10')) return 'Burn This Disco Out';
  }

  // Underscore formatted filenames
  if (t.includes('_')) {
    if (t.includes('Aaliyah_At_Your_Best')) return 'At Your Best (You Are Love)';
    if (t.includes('Aaliyah_One_In_A_Million')) return 'One In A Million';
    if (t.includes('Amerie_1_Thing')) return '1 Thing';
    if (t.includes('Amerie_Why_Dont_We_Fall')) return "Why Don't We Fall In Love";
    if (t.includes('Biz_Markie_Just_A_Friend')) return 'Just A Friend';
    if (t.includes('Blackstreet_Joy')) return 'Joy (12" Remix)';
    if (t.includes('Bobby_Brown_Every_Little_Step')) return 'Every Little Step';
    if (t.includes('Bobby_Brown_My_Prerogative')) return 'My Prerogative';
    if (t.includes('Carl_Thomas_I_Wish')) return 'I Wish';
    if (t.includes('Carl_Thomas_Summer_Rain')) return 'Summer Rain';
    if (t.includes('Change_The_Glow_Of_Love')) return 'The Glow Of Love';
    if (t.includes('Dennis_Edwards_Dont_Look')) return "Don't Look Any Further";
    if (t.includes('Fatback_Band_I_Found_Lovin')) return 'I Found Lovin';
    if (t.includes('Fonda_Rae_Over_Like_A_Fat_Rat')) return 'Over Like A Fat Rat';
    if (t.includes('Gap_Band_Outstanding')) return 'Outstanding';
    if (t.includes('Grandmaster_Flash_Freedom')) return 'Freedom';
    if (t.includes('Janet_Jackson_Got_Til')) return "Got 'Til It's Gone";
    if (t.includes('Lauryn_Hill_Ex_Factor')) return 'Ex-Factor';
    if (t.includes('Mary_J_Blige_I_Can_Love_You')) return 'I Can Love You';
    if (t.includes('Maze_Frankie_Beverly_Before')) return 'Before I Let Go';
    if (t.includes('Parliament_Flashlight')) return 'Flashlight';
    if (t.includes('SWV_Right_Here')) return 'Right Here (Human Nature)';
    if (t.includes('SWV_Youre_The_One')) return "You're The One";
    if (t.includes('Sade_By_Your_Side')) return 'By Your Side';
    if (t.includes('Taana_Gardner_Heartbeat')) return 'Heartbeat';
    if (t.includes('Teedra_Moses_Be_Your_Girl')) return 'Be Your Girl';
    if (t.includes('Tevin_Campbell_Can_We_Talk')) return 'Can We Talk';
    if (t.includes('The_Isley_Brothers_For_The_Love')) return 'For The Love Of You';
    if (t.includes('The_Spinners_Could_It_Be')) return "Could It Be I'm Falling In Love";
    if (t.includes('The_Spinners_Ill_Be_Around')) return "I'll Be Around";
    if (t.includes('Luther_Vandross_-_Never_Too_Much')) return 'Never Too Much';
  }

  if (t.toLowerCase().includes('never too much')) {
    if (t.toLowerCase().includes('vandross') || t.includes('TC148')) {
      return 'Never Too Much';
    }
  }

  return t;
}

/**
 * Normalizes full artist names, replacing 'Unknown Artist' or incomplete tags.
 */
export function normalizeArtistName(rawArtist?: string, title?: string): string {
  const a = String(rawArtist || '').trim();
  const t = String(title || '').toLowerCase().trim();

  if (!a || a.toLowerCase() === 'unknown' || a.toLowerCase() === 'unknown artist') {
    const match = CANONICAL_ALBUM_REGISTRY.find((m) => m.match('', t));
    if (match) return match.artist;
    return 'ChanceTEKone';
  }

  const low = a.toLowerCase();
  if (low.includes('luther')) return 'Luther Vandross';
  if (low.includes('avant')) return 'Avant';
  if (low.includes('112')) return '112';
  if (low.includes('ashanti')) return 'Ashanti';
  if (low.includes('chris brown')) return 'Chris Brown';
  if (low.includes('jermaine dupri')) return 'Jermaine Dupri';
  if (low.includes('brownstone')) return 'Brownstone';
  if (low.includes('michael jackson')) return 'Michael Jackson';
  if (low.includes('aaliyah')) return 'Aaliyah';
  if (low.includes('alicia keys')) return 'Alicia Keys';
  if (low.includes('amerie')) return 'Amerie';
  if (low.includes('biz markie')) return 'Biz Markie';
  if (low.includes('blackstreet')) return 'Blackstreet';
  if (low.includes('bobby brown')) return 'Bobby Brown';
  if (low.includes('carl thomas')) return 'Carl Thomas';
  if (low.includes('change')) return 'Change';
  if (low.includes('dennis edwards')) return 'Dennis Edwards';
  if (low.includes('fatback')) return 'Fatback Band';
  if (low.includes('fonda rae')) return 'Fonda Rae';
  if (low.includes('gap band')) return 'The Gap Band';
  if (low.includes('grandmaster')) return 'Grandmaster Flash & The Furious Five';
  if (low.includes('janet jackson')) return 'Janet Jackson';
  if (low.includes('lauryn hill')) return 'Lauryn Hill';
  if (low.includes('mary j') && low.includes('blige')) return 'Mary J. Blige';
  if (low.includes('maze')) return 'Maze feat. Frankie Beverly';
  if (low.includes('parliament')) return 'Parliament';
  if (low.includes('sade')) return 'Sade';
  if (low.includes('swv')) return 'SWV';
  if (low.includes('taana gardner')) return 'Taana Gardner';
  if (low.includes('teedra moses')) return 'Teedra Moses';
  if (low.includes('tevin campbell')) return 'Tevin Campbell';
  if (low.includes('isley')) return 'The Isley Brothers';
  if (low.includes('spinners')) return 'The Spinners';
  if (low.includes('cipher voltage')) return 'Cipher Voltage';
  if (low.includes('luna brass')) return 'Luna Brass & The Crate Queens';
  if (low.includes('sub-zero') || low.includes('sub zero')) return 'Sub-Zero Rhythm Collective';
  if (low.includes('chancetek') || low.includes('chancellor')) return 'Chancellor @ ChanceTEK LLC';
  if (low.includes('8 of spades') || low.includes('chancetekone')) return 'ChanceTEKone';

  return a;
}

/**
 * Normalizes full album titles, replacing generic 'Single Release' or 'Vault Cuts' tags.
 */
export function normalizeAlbumTitle(rawAlbum?: string, artistName?: string, title?: string): string {
  const alb = String(rawAlbum || '').trim();
  const a = String(artistName || '').toLowerCase().trim();
  const t = String(title || '').toLowerCase().trim();

  // If already an authentic specific album name, preserve it
  if (
    alb &&
    alb !== 'Single Release' &&
    alb !== 'Vault Cuts' &&
    alb !== 'Master Crate Vault' &&
    alb !== 'Collection' &&
    !alb.toLowerCase().includes('unknown')
  ) {
    return alb;
  }

  const match = CANONICAL_ALBUM_REGISTRY.find((m) => m.match(a, t));
  if (match) return match.album;

  if (a.includes('8 of spades') || a.includes('chancetekone')) return 'Genesis of the Concrete Beat';
  if (a.includes('cipher voltage')) return 'Quantum Break Sequence';
  if (a.includes('luna brass')) return 'Velvet Horns & Tape Saturation';
  if (a.includes('sub-zero') || a.includes('sub zero')) return 'Bronx Heritage Archive';

  return 'Genesis of the Concrete Beat';
}


/**
 * Resolves a guaranteed, playable high-fidelity audio URL for any track.
 */
export function resolveSafeAudioUrl(track: {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  audioUrl?: string;
  fileName?: string;
}): string {
  const raw = (track.audioUrl || '').trim();

  // 1. Guard against cross-artist mismatch
  if (raw && isCrossArtistAudioMismatch({ ...track, audioUrl: raw })) {
    const authenticSameArtist = getAuthenticAudioUrl(track);
    if (authenticSameArtist && !isCrossArtistAudioMismatch({ ...track, audioUrl: authenticSameArtist })) {
      return normalizePlayableUrl(authenticSameArtist);
    }
    return '';
  }

  // 1b. If audioUrl is an unverified local upload file that doesn't exist on disk, resolve via authentic mapping
  if (raw.startsWith('/audio/uploads/') && !isVerifiedServerUpload(raw)) {
    const authenticSameArtist = getAuthenticAudioUrl(track);
    if (authenticSameArtist && !isCrossArtistAudioMismatch({ ...track, audioUrl: authenticSameArtist })) {
      return normalizePlayableUrl(authenticSameArtist);
    }
  }

  // 2. If raw audioUrl is verified real playable file (real upload, local audio, external), preserve it!
  if (raw && isVerifiedServerUpload(raw)) {
    if (raw === '/audio/Fort Apache.mp3') return '/audio/Fort_Apache.mp3';
    return normalizePlayableUrl(raw);
  }

  // 3. Try authentic audio registry mapping (specific single verified tracks only)
  const authentic = getAuthenticAudioUrl(track);
  if (authentic && !isCrossArtistAudioMismatch({ ...track, audioUrl: authentic })) {
    return normalizePlayableUrl(authentic);
  }

  // 4. Preserve the track's own original audioUrl
  return raw ? normalizePlayableUrl(raw) : '';
}

/**
 * Detects missing, generic, or stock placeholder cover artwork.
 */
export function isMissingOrGenericCover(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  if (lower === '' || lower === '/images/logo.png' || lower === 'null' || lower === 'undefined') return true;
  // Authentic embedded artwork, base64 data URLs, blobs, and upload artwork files are NEVER generic!
  if (lower.startsWith('data:image') || lower.startsWith('blob:') || lower.includes('cover_179') || lower.includes('cover_')) {
    return false;
  }
  if (
    lower.includes('placeholder') ||
    lower.includes('unsplash.com') ||
    lower.includes('folder.jpg') ||
    lower.includes('default-track') ||
    lower.includes('default-cover') ||
    lower.includes('chancetekone_banner.png')
  ) {
    return true;
  }
  return false;
}
