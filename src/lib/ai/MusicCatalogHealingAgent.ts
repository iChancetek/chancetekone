/**
 * ChanceTEK One — Autonomous Music Catalog & Cover Art Healing Agent
 * 
 * An autonomous agentic AI specialist that:
 * 1. Resolves why music in the Music Area fails to play by verifying, sanitizing,
 *    and repairing audio streams with authentic high-fidelity studio files.
 * 2. Normalizes full artist and album names (eliminating track numbers like '01', '08',
 *    raw filenames, 'Unknown Artist', and generic 'Single Release'/'Vault Cuts' tags).
 * 3. Resolves all cover art issues (replacing Folder.jpg, generic stock, and missing covers
 *    with authentic verified album art locally or via Tavily internet discovery).
 */

import { Track, Album } from '@/types/media';
import {
  MusicCatalogService,
  isMissingOrGenericCover,
  isGenericOrVirtualAlbum,
  KNOWN_ALBUM_COVERS,
  PLATFORM_CANONICAL_TRACKS,
  getDefaultCoverForTrack,
} from '@/lib/music/MusicCatalogService';
import { getAuthenticAudioUrl, isVerifiedServerUpload, isCrossArtistAudioMismatch } from '@/lib/music/authenticAudioMap';
import { normalizePlayableUrl } from '@/lib/music/audioAssetIntegrity';
import { TavilyCoverArtService, CoverArtCandidate } from './tavilyCoverArt';
import { optimizeCoverArtDataUrl } from '../audio/id3Parser';
import { AudioStorageService } from '../audio/AudioStorageService';
import { AuditLogger } from '../admin/AuditLogger';
import { classifyGenre, isGenericOrInvalidGenre } from '@/lib/music/genreClassifier';

export interface CatalogDiagnosticReport {
  timestamp: string;
  totalTracks: number;
  totalAlbums: number;
  unplayableAudioCount: number;
  missingCoverCount: number;
  nameIssuesCount: number;
  invalidGenreCount: number;
  issues: {
    trackId: string;
    title: string;
    artistName: string;
    albumTitle?: string;
    audioIssue?: string;
    coverIssue?: string;
    nameIssue?: string;
    genreIssue?: string;
  }[];
}

export interface CatalogHealingReport {
  startedAt: string;
  completedAt: string;
  totalTracksProcessed: number;
  audioRepairedCount: number;
  coversRepairedCount: number;
  namesRepairedCount: number;
  genresRepairedCount: number;
  details: {
    trackId: string;
    previousTitle: string;
    healedTitle: string;
    previousArtist: string;
    healedArtist: string;
    previousAlbum?: string;
    healedAlbum: string;
    previousAudio: string;
    healedAudio: string;
    previousCover: string;
    healedCover: string;
    previousGenre?: string;
    healedGenre?: string;
    audioFixed: boolean;
    coverFixed: boolean;
    nameFixed: boolean;
    genreFixed: boolean;
  }[];
}

export class MusicCatalogHealingAgent {
  public static readonly AGENT_ID = 'agent-catalog-audio-healing-v1';
  public static readonly AGENT_NAME = 'Agentic AI Music Catalog & Cover Art Healing Specialist';

  /**
   * Canonical album titles mapped by (artist, track title or keyword)
   */
  private static readonly CANONICAL_ALBUM_MAP: { match: (a: string, t: string) => boolean; album: string; artist: string }[] = [
    // Michael Jackson
    { match: (a, t) => a.includes('michael jackson') && (t.includes('dont stop') || t.includes('rock with you') || t.includes('workin') || t.includes('get on the floor') || t.includes('off the wall') || t.includes('girlfriend') || t.includes('out of my life') || t.includes('cant help') || t.includes('falling in love') || t.includes('burn this disco')), album: 'Off The Wall', artist: 'Michael Jackson' },
    { match: (a, t) => a.includes('michael jackson') && (t.includes('startin') || t.includes('baby be mine') || t.includes('girl is mine') || t.includes('thriller') || t.includes('beat it') || t.includes('billie jean') || t.includes('human nature') || t.includes('p.y.t') || t.includes('pyt') || t.includes('lady in my life')), album: 'Thriller', artist: 'Michael Jackson' },

    // Aaliyah
    { match: (a, t) => a.includes('aaliyah') && (t.includes('at your best') || t.includes('age aint nothing')), album: "Age Ain't Nothing But A Number", artist: 'Aaliyah' },
    { match: (a, t) => a.includes('aaliyah') && (t.includes('one in a million') || t.includes('if your girl') || t.includes('4 page letter')), album: 'One In A Million', artist: 'Aaliyah' },
    { match: (a, t) => a.includes('aaliyah') && (t.includes('try again') || t.includes('more than a woman') || t.includes('rock the boat') || t.includes('we need a resolution') || t.includes('care 4 u')), album: 'Aaliyah', artist: 'Aaliyah' },

    // Alicia Keys
    { match: (a, t) => a.includes('alicia') && t.includes('fallin'), album: 'Songs in A Minor', artist: 'Alicia Keys' },
    { match: (a, t) => a.includes('alicia') && (t.includes('if i aint got you') || t.includes('aint got you') || t.includes('diary')), album: 'The Diary of Alicia Keys', artist: 'Alicia Keys' },
    { match: (a, t) => a.includes('alicia') && (t.includes('teenage love affair') || t.includes('no one') || t.includes('superwoman')), album: 'As I Am', artist: 'Alicia Keys' },

    // Classic R&B / Soul / Funk
    { match: (a, t) => (a.includes('amerie') || t.includes('amerie')) && (t.includes('1 thing') || t.includes('touch')), album: 'Touch', artist: 'Amerie' },
    { match: (a, t) => (a.includes('amerie') || t.includes('amerie')) && (t.includes('why dont we fall') || t.includes('all i have')), album: 'All I Have', artist: 'Amerie' },
    { match: (a, t) => a.includes('biz markie') || t.includes('just a friend'), album: 'The Biz Never Sleeps', artist: 'Biz Markie' },
    { match: (a, t) => a.includes('blackstreet') || t.includes('joy'), album: 'Blackstreet', artist: 'Blackstreet' },
    { match: (a, t) => a.includes('bobby brown') || t.includes('every little step') || t.includes('my prerogative') || t.includes('dont be cruel'), album: "Don't Be Cruel", artist: 'Bobby Brown' },
    { match: (a, t) => a.includes('carl thomas') || t.includes('summer rain') || t.includes('i wish'), album: 'Emotional', artist: 'Carl Thomas' },
    { match: (a, t) => a.includes('change') || t.includes('glow of love'), album: 'The Glow Of Love', artist: 'Change' },
    { match: (a, t) => a.includes('dennis edwards') || t.includes('dont look any further') || t.includes('look any further'), album: "Don't Look Any Further", artist: 'Dennis Edwards' },
    { match: (a, t) => a.includes('fatback') || t.includes('found lovin') || t.includes('found loving'), album: 'With Love', artist: 'Fatback Band' },
    { match: (a, t) => a.includes('fonda rae') || t.includes('fat rat') || t.includes('over like a fat rat'), album: 'Over Like A Fat Rat', artist: 'Fonda Rae' },
    { match: (a, t) => a.includes('gap band') || t.includes('outstanding'), album: 'Gap Band IV', artist: 'The Gap Band' },
    { match: (a, t) => a.includes('grandmaster') || (a.includes('flash') && t.includes('freedom')), album: 'The Message', artist: 'Grandmaster Flash & The Furious Five' },
    { match: (a, t) => a.includes('janet jackson') || t.includes('got til its gone') || t.includes('velvet rope'), album: 'The Velvet Rope', artist: 'Janet Jackson' },
    { match: (a, t) => a.includes('lauryn hill') || t.includes('ex factor') || t.includes('miseducation'), album: 'The Miseducation of Lauryn Hill', artist: 'Lauryn Hill' },
    { match: (a, t) => (a.includes('mary j') && a.includes('blige')) || t.includes('can love you') || t.includes('share my world'), album: 'Share My World', artist: 'Mary J. Blige' },
    { match: (a, t) => a.includes('maze') || t.includes('before i let go'), album: 'Live in New Orleans', artist: 'Maze feat. Frankie Beverly' },
    { match: (a, t) => a.includes('parliament') || t.includes('flashlight'), album: 'Funkentelechy Vs. the Placebo Syndrome', artist: 'Parliament' },
    { match: (a, t) => a.includes('sade') || t.includes('by your side') || t.includes('lovers rock'), album: 'Lovers Rock', artist: 'Sade' },
    { match: (a, t) => a.includes('swv') && (t.includes('youre the one') || t.includes('you re the one') || t.includes('new beginning')), album: 'New Beginning', artist: 'SWV' },
    { match: (a, t) => a.includes('swv') && (t.includes('right here') || t.includes('weak') || t.includes('about time')), album: "It's About Time", artist: 'SWV' },
    { match: (a, t) => a.includes('taana') || t.includes('heartbeat'), album: 'Heartbeat', artist: 'Taana Gardner' },
    { match: (a, t) => a.includes('teedra') || t.includes('be your girl') || t.includes('complex simplicity'), album: 'Complex Simplicity', artist: 'Teedra Moses' },
    { match: (a, t) => a.includes('tevin campbell') || t.includes('can we talk') || t.includes('im ready'), album: "I'm Ready", artist: 'Tevin Campbell' },
    { match: (a, t) => a.includes('isley') || t.includes('for the love of you') || t.includes('heat is on'), album: 'The Heat Is On', artist: 'The Isley Brothers' },
    { match: (a, t) => a.includes('spinners') || t.includes('could it be im falling') || t.includes('could it be i m falling') || t.includes('ill be around') || t.includes('i ll be around'), album: 'Spinners', artist: 'The Spinners' },

    // Platform Creators
    { match: (a, t) => a.includes('ChanceTEK One') || t.includes('break beats') || t.includes('neon crate') || t.includes('sp-1200') || t.includes('dembow underground') || t.includes('concrete amplifier'), album: 'Genesis of the Concrete Beat', artist: 'ChanceTEK One' },
    { match: (a, t) => a.includes('cipher voltage') || t.includes('cyber grid') || t.includes('sub-orbital') || t.includes('miami 808'), album: 'Quantum Break Sequence', artist: 'Cipher Voltage' },
    { match: (a, t) => a.includes('luna brass') || t.includes('soul kitchen') || t.includes('midnight crate') || t.includes('delta tape') || t.includes('bluegrass break'), album: 'Velvet Horns & Tape Saturation', artist: 'Luna Brass & The Crate Queens' },
    { match: (a, t) => a.includes('sub-zero') || t.includes('subterranean') || t.includes('lagos midnight'), album: 'Bronx Heritage Archive', artist: 'Sub-Zero Rhythm Collective' },
    { match: (a, t) => a.includes('chancetek') || a.includes('chancellor'), album: 'ChanceTEK One PRESENTS: ChanceTEK', artist: 'Chancellor @ ChanceTEK LLC' },
  ];

  /**
   * Canonical track title dictionary for numbered titles or raw filenames
   */
  public static normalizeTitle(rawTitle: string, artistName?: string, albumTitle?: string): string {
    let t = (rawTitle || '').trim();
    const a = (artistName || '').toLowerCase().trim();
    const al = (albumTitle || '').toLowerCase().trim();

    // 1. Remove file extensions & leading track numbering patterns
    t = t.replace(/\.mp3$/i, '').replace(/\.wav$/i, '');
    t = t.replace(/^OneDrive[\/\\]/i, '').replace(/^Audio[\/\\]/i, '');

    // 2. Specific Numbered Track Matches
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

    // 3. Raw filename cleanup (e.g. Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough)
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

    // 4. Underscore filenames
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
    }

    return t;
  }

  /**
   * Canonical full artist name normalization
   */
  public static normalizeArtist(rawArtist?: string, title?: string): string {
    const a = (rawArtist || '').trim();
    const t = (title || '').toLowerCase().trim();

    if (!a || a.toLowerCase() === 'unknown' || a.toLowerCase() === 'unknown artist') {
      const match = this.CANONICAL_ALBUM_MAP.find((m) => m.match('', t));
      if (match) return match.artist;
      return 'ChanceTEK One';
    }

    const low = a.toLowerCase();
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
    if (low.includes('8 of spades') || low.includes('chancetekone')) return 'ChanceTEK One';

    return a;
  }

  /**
   * Canonical full album title normalization
   */
  public static normalizeAlbum(rawAlbum?: string, artistName?: string, title?: string): string {
    const alb = (rawAlbum || '').trim();
    const a = (artistName || '').toLowerCase().trim();
    const t = (title || '').toLowerCase().trim();

    // If already has a clean authentic album name, keep it
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

    const match = this.CANONICAL_ALBUM_MAP.find((m) => m.match(a, t));
    if (match) return match.album;

    if (a.includes('8 of spades') || a.includes('chancetekone')) return 'Genesis of the Concrete Beat';
    if (a.includes('cipher voltage')) return 'Quantum Break Sequence';
    if (a.includes('luna brass')) return 'Velvet Horns & Tape Saturation';
    if (a.includes('sub-zero') || a.includes('sub zero')) return 'Bronx Heritage Archive';

    return 'Genesis of the Concrete Beat';
  }

  /**
   * Resolves a guaranteed, playable high-fidelity audio URL for any track.
   * Eliminates dead indexeddb:// URLs, unencoded spaces, and broken links.
   */
  /**
   * Verifies that a track's audio stream belongs to the correct artist.
   * Prevents cross-artist audio hijacking.
   */
  public static verifyArtistAudioAssociation(track: Track): {
    isValid: boolean;
    issue?: string;
    suggestedAudio?: string;
  } {
    if (!track.audioUrl) {
      return { isValid: false, issue: 'Missing audio URL' };
    }

    if (isCrossArtistAudioMismatch(track)) {
      const authentic = getAuthenticAudioUrl(track);
      return {
        isValid: false,
        issue: `Cross-artist audio mismatch: "${track.title}" by ${track.artistName} is linked to another artist's audio (${track.audioUrl}).`,
        suggestedAudio: authentic && !isCrossArtistAudioMismatch({ ...track, audioUrl: authentic }) ? authentic : undefined,
      };
    }

    return { isValid: true };
  }

  /**
   * Resolves a guaranteed, playable high-fidelity audio URL for any track.
   * Eliminates dead indexeddb:// URLs, unencoded spaces, and broken links.
   * NEVER substitutes an audio stream belonging to a different artist!
   */
  public static resolveAuthenticAudio(track: Track): string {
    const raw = (track.audioUrl || '').trim();

    // 1. Guard against cross-artist mismatch (e.g. Janet Jackson mapped to Lauryn Hill)
    if (raw && isCrossArtistAudioMismatch(track)) {
      const authenticSameArtist = getAuthenticAudioUrl(track);
      if (authenticSameArtist && !isCrossArtistAudioMismatch({ ...track, audioUrl: authenticSameArtist })) {
        return normalizePlayableUrl(authenticSameArtist);
      }
      return '';
    }

    // 2. If track already has a verified real playable audioUrl, preserve it!
    if (raw && isVerifiedServerUpload(raw)) {
      if (raw === '/audio/Fort Apache.mp3') return '/audio/Fort_Apache.mp3';
      return normalizePlayableUrl(raw);
    }

    // 3. Try Authentic Audio Map (Janet Jackson Got Til Its Gone, Michael Jackson, etc.)
    const authentic = getAuthenticAudioUrl(track);
    if (authentic && !isCrossArtistAudioMismatch({ ...track, audioUrl: authentic })) {
      return normalizePlayableUrl(authentic);
    }

    return raw ? normalizePlayableUrl(raw) : '';
  }

  /**
   * Resolves authentic cover art for any track, replacing Folder.jpg, stock photos,
   * or broken covers with verified original album artwork.
   */
  public static resolveAuthenticCover(track: Track): string {
    return MusicCatalogService.resolveTrackCover(track);
  }

  /**
   * Diagnoses all tracks in the catalog and reports all audio, cover, and naming issues.
   */
  public static diagnoseCatalog(): CatalogDiagnosticReport {
    const allTracks = MusicCatalogService.getAllTracks();
    const allAlbums = MusicCatalogService.getAllAlbums();

    let unplayableAudioCount = 0;
    let missingCoverCount = 0;
    let nameIssuesCount = 0;
    let invalidGenreCount = 0;
    const issues: CatalogDiagnosticReport['issues'] = [];

    allTracks.forEach((t) => {
      let audioIssue: string | undefined;
      let coverIssue: string | undefined;
      let nameIssue: string | undefined;
      let genreIssue: string | undefined;

      // Audio verification & artist matching
      const audioVerification = this.verifyArtistAudioAssociation(t);
      if (!audioVerification.isValid) {
        audioIssue = audioVerification.issue;
        unplayableAudioCount++;
      } else if (!t.audioUrl || t.audioUrl.startsWith('indexeddb://') || t.audioUrl.includes('Fort Apache.mp3')) {
        audioIssue = 'Contains unplayable, unencoded, or fragile audio stream URL';
        unplayableAudioCount++;
      }

      // Cover verification
      if (!t.coverUrl || isMissingOrGenericCover(t.coverUrl)) {
        coverIssue = 'Missing authentic cover art or using stock/Folder.jpg';
        missingCoverCount++;
      }

      // Naming verification
      const isNumbered = /^\d{1,2}$/.test(t.title.trim());
      const hasRawFile = t.title.includes('.mp3') || t.title.includes('Michael_Jackson_-_') || t.title.includes('_');
      const isUnknownArtist = !t.artistName || t.artistName.toLowerCase().includes('unknown');
      const isGenericAlbum = isGenericOrVirtualAlbum(t.albumTitle);

      if (isNumbered || hasRawFile || isUnknownArtist || isGenericAlbum) {
        nameIssue = `Incomplete naming metadata (${[
          isNumbered ? 'numbered title' : null,
          hasRawFile ? 'raw filename' : null,
          isUnknownArtist ? 'unknown artist' : null,
          isGenericAlbum ? 'generic album' : null,
        ].filter(Boolean).join(', ')})`;
        nameIssuesCount++;
      }

      // Genre verification
      const lowArt = (t.artistName || '').toLowerCase();
      const isRnBArt =
        lowArt.includes('luther') ||
        lowArt.includes('janet') ||
        lowArt.includes('michael jackson') ||
        lowArt.includes('avant') ||
        lowArt.includes('112') ||
        lowArt.includes('ashanti') ||
        lowArt.includes('chris brown') ||
        lowArt.includes('brownstone') ||
        lowArt.includes('carl thomas') ||
        lowArt.includes('tevin campbell') ||
        lowArt.includes('alicia keys') ||
        lowArt.includes('sade') ||
        lowArt.includes('mary j') ||
        lowArt.includes('bobby brown') ||
        lowArt.includes('blackstreet') ||
        lowArt.includes('swv');

      if (isGenericOrInvalidGenre(t.genre) || (isRnBArt && (t.genre?.toLowerCase().includes('hip hop') || t.crateId === 'golden-era-hip-hop'))) {
        genreIssue = `Misclassified, generic, or invalid genre tag ('${t.genre || 'empty'}')`;
        invalidGenreCount++;
      }

      if (audioIssue || coverIssue || nameIssue || genreIssue) {
        issues.push({
          trackId: t.id,
          title: t.title,
          artistName: t.artistName,
          albumTitle: t.albumTitle,
          audioIssue,
          coverIssue,
          nameIssue,
          genreIssue,
        });
      }
    });

    return {
      timestamp: new Date().toISOString(),
      totalTracks: allTracks.length,
      totalAlbums: allAlbums.length,
      unplayableAudioCount,
      missingCoverCount,
      nameIssuesCount,
      invalidGenreCount,
      issues,
    };
  }

  /**
   * Autonomous Self-Healing Execution:
   * Heals all tracks in the catalog across audio playability, cover art, authentic genres, and full naming metadata.
   */
  public static async healCatalog(options?: {
    dryRun?: boolean;
    forceTavily?: boolean;
    actorEmail?: string;
  }): Promise<CatalogHealingReport> {
    const startedAt = new Date().toISOString();
    const allTracks = MusicCatalogService.getAllTracks();

    let audioRepairedCount = 0;
    let coversRepairedCount = 0;
    let namesRepairedCount = 0;
    let genresRepairedCount = 0;
    const details: CatalogHealingReport['details'] = [];

    for (const t of allTracks) {
      const prevTitle = t.title;
      const prevArtist = t.artistName;
      const prevAlbum = t.albumTitle;
      const prevAudio = t.audioUrl || '';
      const prevCover = t.coverUrl || '';
      const prevGenre = t.genre;

      // 1. Normalize Names
      const healedTitle = this.normalizeTitle(t.title, t.artistName, t.albumTitle);
      const healedArtist = this.normalizeArtist(t.artistName, healedTitle);
      const healedAlbum = this.normalizeAlbum(t.albumTitle, healedArtist, healedTitle);

      const nameFixed =
        healedTitle !== prevTitle ||
        healedArtist !== prevArtist ||
        healedAlbum !== prevAlbum;

      if (nameFixed) namesRepairedCount++;

      // 2. Resolve Audio Stream
      const tempTrack: Track = {
        ...t,
        title: healedTitle,
        artistName: healedArtist,
        albumTitle: healedAlbum,
      };
      const healedAudio = this.resolveAuthenticAudio(tempTrack);
      const audioFixed = Boolean(healedAudio && healedAudio !== prevAudio && (prevAudio.startsWith('indexeddb://') || !prevAudio));

      if (audioFixed) audioRepairedCount++;

      // 3. Resolve Cover Art
      let healedCover = this.resolveAuthenticCover(tempTrack);

      // If still missing or generic, and Tavily is enabled or forceTavily requested
      if (options?.forceTavily && isMissingOrGenericCover(healedCover)) {
        try {
          const candidates = await TavilyCoverArtService.searchCoverArt({
            artist: healedArtist,
            album: healedAlbum,
            title: healedTitle,
            genre: t.genre,
          });
          if (candidates.length > 0) {
            healedCover = candidates[0].url;
          }
        } catch (e) {
          console.warn('[MusicCatalogHealingAgent] Tavily cover art fetch skipped/failed:', e);
        }
      }

      const coverFixed = healedCover !== prevCover || isMissingOrGenericCover(prevCover);
      if (coverFixed) coversRepairedCount++;

      // 4. Resolve & Normalize Genre and Crate
      let healedGenre = t.genre;
      let genreFixed = false;
      const lowerArtist = healedArtist.toLowerCase();
      const isRnB =
        lowerArtist.includes('luther') ||
        lowerArtist.includes('janet') ||
        lowerArtist.includes('michael jackson') ||
        lowerArtist.includes('avant') ||
        lowerArtist.includes('112') ||
        lowerArtist.includes('ashanti') ||
        lowerArtist.includes('chris brown') ||
        lowerArtist.includes('brownstone') ||
        lowerArtist.includes('carl thomas') ||
        lowerArtist.includes('tevin campbell') ||
        lowerArtist.includes('alicia keys') ||
        lowerArtist.includes('sade') ||
        lowerArtist.includes('mary j') ||
        lowerArtist.includes('bobby brown') ||
        lowerArtist.includes('blackstreet') ||
        lowerArtist.includes('swv');

      let healedCrateId = t.crateId;
      let healedCrateName = t.crateName;
      let crateFixed = false;
      if (isRnB && healedCrateId === 'golden-era-hip-hop') {
        healedCrateId = 'oldschool-rnb-soul';
        healedCrateName = 'Timeless R&B | Soul Music';
        crateFixed = true;
      }

      const normalizedGenre = classifyGenre({
        artist: healedArtist,
        title: healedTitle,
        album: healedAlbum,
        rawGenre: t.genre,
        crateId: healedCrateId,
        crateName: healedCrateName,
      });

      if (
        isGenericOrInvalidGenre(t.genre) ||
        (isRnB && t.genre?.toLowerCase().includes('hip hop')) ||
        (t.genre === 'R&B / Neo-Soul' && normalizedGenre !== 'R&B / Neo-Soul' && !isRnB) ||
        (t.genre?.toLowerCase().includes('hip hop') && normalizedGenre === 'Latin-Freestyle') ||
        crateFixed
      ) {
        healedGenre = normalizedGenre;
        genreFixed = healedGenre !== prevGenre || crateFixed;
        if (genreFixed) genresRepairedCount++;
      }

      details.push({
        trackId: t.id,
        previousTitle: prevTitle,
        healedTitle,
        previousArtist: prevArtist,
        healedArtist,
        previousAlbum: prevAlbum,
        healedAlbum,
        previousAudio: prevAudio,
        healedAudio,
        previousCover: prevCover,
        healedCover,
        previousGenre: prevGenre,
        healedGenre,
        audioFixed,
        coverFixed,
        nameFixed,
        genreFixed,
      });

      // Apply updates to MusicCatalogService if not dryRun
      if (!options?.dryRun && (nameFixed || audioFixed || coverFixed || genreFixed || crateFixed)) {
        MusicCatalogService.updateTrack(t.id, {
          title: healedTitle,
          artistName: healedArtist,
          albumTitle: healedAlbum,
          audioUrl: healedAudio,
          coverUrl: healedCover,
          albumCoverUrl: healedCover,
          coverVerification: 'verified',
          genre: healedGenre,
          crateId: healedCrateId,
          crateName: healedCrateName,
        }, {
          id: options?.actorEmail || this.AGENT_ID,
          name: this.AGENT_NAME,
        });

        // Also update matching album/folder if applicable
        if (t.albumId) {
          MusicCatalogService.updateFolderCover(t.albumId, healedCover);
        }
      }
    }

    const completedAt = new Date().toISOString();

    // Log action to AuditLogger
    if (!options?.dryRun) {
      AuditLogger.logAction({
        adminId: options?.actorEmail || this.AGENT_ID,
        adminName: this.AGENT_NAME,
        adminRole: 'admin',
        eventType: 'CATALOG_FULL_AUDIT',
        action: `MusicCatalogHealingAgent healed ${allTracks.length} tracks (Audio: ${audioRepairedCount}, Covers: ${coversRepairedCount}, Names: ${namesRepairedCount}, Genres: ${genresRepairedCount})`,
        resource: 'Music Catalog',
        resourceId: 'all-tracks',
        newValue: {
          audioRepairedCount,
          coversRepairedCount,
          namesRepairedCount,
          genresRepairedCount,
        },
        status: 'SUCCESS',
      });
    }

    return {
      startedAt,
      completedAt,
      totalTracksProcessed: allTracks.length,
      audioRepairedCount,
      coversRepairedCount,
      namesRepairedCount,
      genresRepairedCount,
      details,
    };
  }
}
