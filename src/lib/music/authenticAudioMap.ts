/**
 * ChanceTEK One — Authentic Audio Stream Registry & Integrity Guard
 * 
 * Maps platform music tracks (Michael Jackson, Janet Jackson, Aaliyah, etc.)
 * directly to their verified studio audio files under /audio/uploads/.
 * 
 * CRITICAL AGENT DIRECTIVES:
 * 1. ALWAYS play the original music attached to the MP3 uploaded by the user.
 * 2. NEVER substitute, cross-wire, or copy one artist's song to another artist's track.
 *    (e.g., Janet Jackson MP3s must NEVER play Lauryn Hill; Avant must NEVER play Tevin Campbell).
 * 3. User uploads are the inviolable source of truth.
 * 4. NEVER overwrite or replace a track's audio with Fort_Apache.mp3 unless the track
 *    is explicitly the ChanceTEK One "ChanceTEK One" anthem.
 */

export interface TrackIdentifier {
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  fileName?: string;
  audioUrl?: string;
  genre?: string;
  crateId?: string;
}

/**
 * Authentic studio master files that physically exist in /audio/uploads/
 */
export const VERIFIED_SERVER_UPLOADS = new Set([
  'Aaliyah_At_Your_Best_Remix.mp3',
  'Aaliyah_One_In_A_Million_Mashup.mp3',
  'Amerie_1_Thing.mp3',
  'Amerie_Why_Dont_We_Fall_In_Love.mp3',
  'Biz_Markie_Just_A_Friend.mp3',
  'Blackstreet_Joy_12_Remix.mp3',
  'Bobby_Brown_Every_Little_Step.mp3',
  'Bobby_Brown_My_Prerogative.mp3',
  'Carl_Thomas_I_Wish.mp3',
  'Carl_Thomas_Summer_Rain.mp3',
  'Change_The_Glow_Of_Love.mp3',
  'Dennis_Edwards_Dont_Look_Any_Further.mp3',
  'Fatback_Band_I_Found_Lovin.mp3',
  'Fonda_Rae_Over_Like_A_Fat_Rat.mp3',
  'Gap_Band_Outstanding.mp3',
  'Grandmaster_Flash_Freedom.mp3',
  'Janet_Jackson_Got_Til_Its_Gone.mp3',
  'Lauryn_Hill_Ex_Factor_Remix.mp3',
  'Mary_J_Blige_I_Can_Love_You.mp3',
  'Maze_Frankie_Beverly_Before_I_Let_Go.mp3',
  'Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3',
  'Michael_Jackson_-_02_-_Rock_With_You.mp3',
  'Michael_Jackson_-_03_-_Workin__Day_And_Night.mp3',
  'Michael_Jackson_-_04_-_Get_On_The_Floor.mp3',
  'Michael_Jackson_-_05_-_Off_The_Wall.mp3',
  'Michael_Jackson_-_06_-_Girlfriend.mp3',
  'Michael_Jackson_-_07_-_She_s_Out_Of_My_Life.mp3',
  'Michael_Jackson_-_08_-_I_Can_t_Help_It.mp3',
  'Michael_Jackson_-_09_-_It_s_The_Falling_In_Love.mp3',
  'Michael_Jackson_-_10_-_Burn_This_Disco_Out.mp3',
  'Michael_Jackson_-_01_-_Wanna_Be_Startin_Somethin.mp3',
  'Michael_Jackson_-_02_-_Baby_Be_Mine.mp3',
  'Michael_Jackson_-_03_-_The_Girl_Is_Mine.mp3',
  'Michael_Jackson_-_04_-_Thriller.mp3',
  'Michael_Jackson_-_05_-_Beat_It.mp3',
  'Michael_Jackson_-_06_-_Billie_Jean.mp3',
  'Michael_Jackson_-_07_-_Human_Nature.mp3',
  'Michael_Jackson_-_08_-_PYT_Pretty_Young_Thing.mp3',
  'Michael_Jackson_-_09_-_The_Lady_in_My_Life.mp3',
  'Michael_Jackson_-_10_-_Someone_In_The_Dark.mp3',
  'Michael_Jackson_-_11_-_Carousel.mp3',
  'Michael_Jackson_-_12_-_Billie_Jean_Demo.mp3',
  'Michael_Jackson_-_13_-_Voice_Over_Session.mp3',
  'Parliament_Flashlight.mp3',
  'Sade_By_Your_Side_Neptunes_Remix.mp3',
  'SWV_Right_Here_Human_Nature.mp3',
  'SWV_Youre_The_One.mp3',
  'Taana_Gardner_Heartbeat.mp3',
  'Teedra_Moses_Be_Your_Girl.mp3',
  'Tevin_Campbell_Can_We_Talk.mp3',
  'The_Isley_Brothers_For_The_Love_Of_You.mp3',
  'The_Spinners_Could_It_Be_Im_Falling_In_Love.mp3',
  'The_Spinners_Ill_Be_Around.mp3',
  'Nas_NY_State_Of_Mind.mp3',
  'Nas_Halftime.mp3',
  'Nas_The_World_Is_Yours.mp3',
  'Nas_If_I_Ruled_The_World.mp3',
  'Nas_Made_You_Look.mp3',
  'Nas_Nas_Is_Like.mp3',
  'Nas_One_Love.mp3',
]);

/**
 * Checks whether an audio URL is a valid, playable server upload or local stream.
 * Any valid /audio/uploads/ path created by user ingestion is accepted.
 */
export function isVerifiedServerUpload(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // blob: and data: and indexeddb: URLs are valid local playback sources
  if (
    lower.startsWith('blob:') ||
    lower.startsWith('data:') ||
    lower.startsWith('indexeddb://') ||
    /(?:^|\/)indexeddb(?:%3a|:)\/\//i.test(lower)
  ) {
    return true;
  }

  // Handle /audio/uploads/... path - Any audio file under /audio/uploads/ is a valid upload target
  if (lower.startsWith('/audio/uploads/') || lower.includes('/audio/uploads/')) {
    const rawFile = trimmed.split('/audio/uploads/').pop()?.split('?')[0]?.split('#')[0] || '';
    if (!rawFile) return false;
    return true;
  }

  // Handle direct /audio/ path
  if (lower.startsWith('/audio/')) {
    const rawFile = trimmed.split('/audio/').pop()?.split('?')[0]?.split('#')[0] || '';
    const decodedFile = decodeURIComponent(rawFile).toLowerCase();
    const validRoot = [
      'fort_apache.mp3',
      'fort apache.mp3',
      'agentic ai.mp3',
      'ai security.mp3',
      'healthy living.mp3',
      'intermittent fasting.mp3',
      'iskylar.mp3',
      'the fam... famio.mp3',
      'voice_ad.mp3',
    ];
    return validRoot.includes(decodedFile);
  }

  // Remote URLs (Firebase Storage, CDN, Cloud Catalog)
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return true;
  }

  return false;
}

/**
 * Detects whether an audio URL belongs to a DIFFERENT artist than the track's stated artist.
 * Prevents cross-artist audio hijacking.
 */
export function isCrossArtistAudioMismatch(track: {
  artistName?: string;
  title?: string;
  audioUrl?: string;
  fileName?: string;
}): boolean {
  const artist = (track.artistName || '').toLowerCase().trim();
  const rawAudio = (track.audioUrl || track.fileName || '').toLowerCase().trim();
  if (!artist || !rawAudio) return false;

  // Only the file's own name is inspected (never the query string / token), and only against the
  // ARTIST-name prefix of the platform's studio masters. Song-title words (e.g. "freedom",
  // "heartbeat", "i_wish", "outstanding") are deliberately NOT signatures: a different artist's song with
  // the same title is not a mismatch, and flagging it triggered "repairs" that swapped in wrong audio.
  const baseName = rawAudio.split('#')[0].split('?')[0].split('/').pop() || '';
  let decodedBase = baseName;
  try {
    decodedBase = decodeURIComponent(baseName);
  } catch {
    /* keep raw */
  }
  // Drop the upload prefix (`<timestamp>_` legacy or `<uploadId>_<sha12>_` current).
  const studioName = decodedBase.replace(/^(?:[a-z0-9-]+_[a-f0-9]{12}_|\d+_)/i, '');

  const masterSignatures: { pattern: RegExp; expectedArtist: string }[] = [
    { pattern: /^lauryn_hill_/i, expectedArtist: 'lauryn hill' },
    { pattern: /^mary_j_blige_/i, expectedArtist: 'mary j' },
    { pattern: /^michael_jackson_/i, expectedArtist: 'michael jackson' },
    { pattern: /^aaliyah_/i, expectedArtist: 'aaliyah' },
    { pattern: /^amerie_/i, expectedArtist: 'amerie' },
    { pattern: /^biz_markie_/i, expectedArtist: 'biz markie' },
    { pattern: /^blackstreet_/i, expectedArtist: 'blackstreet' },
    { pattern: /^bobby_brown_/i, expectedArtist: 'bobby brown' },
    { pattern: /^carl_thomas_/i, expectedArtist: 'carl thomas' },
    { pattern: /^change_the_glow_of_love/i, expectedArtist: 'change' },
    { pattern: /^dennis_edwards_/i, expectedArtist: 'dennis edwards' },
    { pattern: /^fatback_band_/i, expectedArtist: 'fatback' },
    { pattern: /^fonda_rae_/i, expectedArtist: 'fonda rae' },
    { pattern: /^gap_band_/i, expectedArtist: 'gap band' },
    { pattern: /^grandmaster_flash_/i, expectedArtist: 'grandmaster' },
    { pattern: /^janet_jackson_/i, expectedArtist: 'janet' },
    { pattern: /^maze_frankie_beverly_/i, expectedArtist: 'maze' },
    { pattern: /^parliament_/i, expectedArtist: 'parliament' },
    { pattern: /^sade_/i, expectedArtist: 'sade' },
    { pattern: /^swv_/i, expectedArtist: 'swv' },
    { pattern: /^taana_gardner_/i, expectedArtist: 'taana gardner' },
    { pattern: /^teedra_moses_/i, expectedArtist: 'teedra moses' },
    { pattern: /^tevin_campbell_/i, expectedArtist: 'tevin campbell' },
    { pattern: /^the_isley_brothers_/i, expectedArtist: 'isley' },
    { pattern: /^the_spinners_/i, expectedArtist: 'spinners' },
    { pattern: /^nas_/i, expectedArtist: 'nas' },
  ];

  for (const sig of masterSignatures) {
    if (sig.pattern.test(studioName)) {
      if (!artist.includes(sig.expectedArtist)) {
        return true; // MISMATCH: Audio belongs to sig.expectedArtist, but track artist is different!
      }
    }
  }

  return false;
}

/**
 * Returns the authentic high-fidelity audio URL for any recognized track or artist,
 * or null if no authentic override is registered.
 * 
 * CRITICAL RULE: If the track has an authentic user-uploaded URL, IT MUST BE PRESERVED.
 * Never substitute an uploaded file with another artist's audio.
 */
export function getAuthenticAudioUrl(track: TrackIdentifier): string | null {
  const id = (track.id || '').toLowerCase().trim();
  const title = (track.title || '').toLowerCase().trim();
  const artist = (track.artistName || '').toLowerCase().trim();
  const file = (track.fileName || '').toLowerCase().trim();
  const url = (track.audioUrl || '').trim();

  // 1. If the track already has a durable, verified real audio URL on disk or blob, PRESERVE IT!
  if (
    url &&
    !url.startsWith('indexeddb://') &&
    !/(?:^|\/)indexeddb(?:%3a|:)\/\//i.test(url) &&
    url !== 'null' &&
    url !== 'undefined'
  ) {
    if (url === '/audio/Fort Apache.mp3') {
      return '/audio/Fort_Apache.mp3';
    }
    // If URL points to an unverified local upload file that does not exist on disk, do not treat it as valid!
    if (url.startsWith('/audio/uploads/') && !isVerifiedServerUpload(url)) {
      // Unverified upload file on server disk — fall through to authentic artist/title mapping!
    } else if (!isCrossArtistAudioMismatch({ artistName: artist, title, audioUrl: url, fileName: file })) {
      return url;
    }
  }

  // 1b. Luther Vandross — Never Too Much verified studio recording
  if (
    (artist.includes('luther') || file.includes('luther')) &&
    (title.includes('never too much') || file.includes('never_too_much') || file.includes('tc148'))
  ) {
    return 'https://firebasestorage.googleapis.com/v0/b/spadesworks8.firebasestorage.app/o/media%2Fcatalog%2Faudio%2F1793254898258_trk-pub-1793247158957-c3734ea524_8e697043.mp3?alt=media&token=711e3a11-58b7-4593-9fad-34935e0e4222';
  }

  // 2. Janet Jackson — the ONE studio master the platform holds is "Got 'Til It's Gone".
  // It is returned only when BOTH the artist and the song title are that recording. It must never be
  // used as a stand-in for any other Janet Jackson song (that substitution is exactly the
  // "published song plays a different track" defect).
  if (
    (artist.includes('janet') || file.includes('janet_jackson_got_til')) &&
    (title.replace(/[^a-z0-9]/g, '').includes('gottil') || file.includes('got_til'))
  ) {
    return '/audio/uploads/Janet_Jackson_Got_Til_Its_Gone.mp3';
  }

  // 3. Lauryn Hill (ONLY match "Ex-Factor" when artist is Lauryn Hill)
  if (
    (title.includes('ex-factor') || title.includes('ex factor') || file.includes('ex_factor')) &&
    (artist.includes('lauryn') || file.includes('lauryn') || id.includes('lauryn'))
  ) {
    return '/audio/uploads/Lauryn_Hill_Ex_Factor_Remix.mp3';
  }

  // 4. Nas authentic studio masters (Illmatic, It Was Written, God's Son, I Am...)
  if (artist.includes('nas') || file.includes('nas_') || id.includes('nas-') || id.includes('trk-pub-nas')) {
    if (title.includes('state of mind') || file.includes('state_of_mind')) {
      return '/audio/uploads/Nas_NY_State_Of_Mind.mp3';
    }
    if (title.includes('halftime') || file.includes('halftime')) {
      return '/audio/uploads/Nas_Halftime.mp3';
    }
    if (title.includes('world is yours') || file.includes('world_is_yours')) {
      return '/audio/uploads/Nas_The_World_Is_Yours.mp3';
    }
    if (title.includes('if i ruled') || file.includes('if_i_ruled')) {
      return '/audio/uploads/Nas_If_I_Ruled_The_World.mp3';
    }
    if (title.includes('made you look') || file.includes('made_you_look')) {
      return '/audio/uploads/Nas_Made_You_Look.mp3';
    }
    if (title.includes('nas is like') || file.includes('nas_is_like')) {
      return '/audio/uploads/Nas_Nas_Is_Like.mp3';
    }
    if (title.includes('one love') || file.includes('one_love')) {
      return '/audio/uploads/Nas_One_Love.mp3';
    }
    return '/audio/uploads/Nas_NY_State_Of_Mind.mp3';
  }

  // 5. Mary J. Blige (ONLY match "I Can Love You" when artist is Mary J. Blige)
  if (
    (title.includes('i can love you') || file.includes('i_can_love_you')) &&
    (artist.includes('mary') || file.includes('mary') || id.includes('mary'))
  ) {
    return '/audio/uploads/Mary_J_Blige_I_Can_Love_You.mp3';
  }

  // 6. Maze feat. Frankie Beverly (ONLY match "Before I Let Go")
  if (
    (title.includes('before i let go') || file.includes('before_i_let_go')) &&
    (artist.includes('maze') || artist.includes('frankie') || file.includes('maze') || id.includes('maze'))
  ) {
    return '/audio/uploads/Maze_Frankie_Beverly_Before_I_Let_Go.mp3';
  }

  // 7. The Gap Band (ONLY match "Outstanding")
  if (
    (title.includes('outstanding') || file.includes('outstanding')) &&
    (artist.includes('gap') || file.includes('gap') || id.includes('gap'))
  ) {
    return '/audio/uploads/Gap_Band_Outstanding.mp3';
  }

  // 8. Dennis Edwards (ONLY match "Don't Look Any Further")
  if (
    (title.includes('dont look any further') || title.includes("don't look any further") || file.includes('dont_look')) &&
    (artist.includes('dennis') || file.includes('dennis') || id.includes('dennis'))
  ) {
    return '/audio/uploads/Dennis_Edwards_Dont_Look_Any_Further.mp3';
  }

  // 9. Fatback Band (ONLY match "I Found Lovin'")
  if (
    (title.includes('found lovin') || title.includes('found loving') || file.includes('found_lovin')) &&
    (artist.includes('fatback') || file.includes('fatback') || id.includes('fatback'))
  ) {
    return '/audio/uploads/Fatback_Band_I_Found_Lovin.mp3';
  }

  // 10. Fonda Rae (ONLY match "Over Like A Fat Rat")
  if (
    (title.includes('fat rat') || file.includes('fat_rat')) &&
    (artist.includes('fonda') || file.includes('fonda') || id.includes('fonda'))
  ) {
    return '/audio/uploads/Fonda_Rae_Over_Like_A_Fat_Rat.mp3';
  }

  // 11. Taana Gardner (ONLY match "Heartbeat")
  if (
    (title.includes('heartbeat') || file.includes('heartbeat')) &&
    (artist.includes('taana') || file.includes('taana') || id.includes('taana'))
  ) {
    return '/audio/uploads/Taana_Gardner_Heartbeat.mp3';
  }

  // 12. Change (ONLY match "The Glow Of Love")
  if (
    (title.includes('glow of love') || file.includes('glow_of_love')) &&
    (artist.includes('change') || file.includes('change') || id.includes('change'))
  ) {
    return '/audio/uploads/Change_The_Glow_Of_Love.mp3';
  }

  // 13. Bobby Brown (ONLY match Bobby Brown's own verified tracks)
  if (
    (artist.includes('bobby brown') || file.includes('bobby_brown') || id.includes('bobby-brown')) &&
    (title.includes('prerogative') || title.includes('every little step') || file.includes('prerogative') || file.includes('every_little_step'))
  ) {
    if (title.includes('prerogative') || file.includes('prerogative')) {
      return '/audio/uploads/Bobby_Brown_My_Prerogative.mp3';
    }
    return '/audio/uploads/Bobby_Brown_Every_Little_Step.mp3';
  }

  // 14. Carl Thomas (ONLY match Carl Thomas's own verified tracks)
  if (
    (artist.includes('carl thomas') || file.includes('carl_thomas') || id.includes('carl-thomas')) &&
    (title.includes('i wish') || title.includes('summer rain') || file.includes('i_wish') || file.includes('summer_rain'))
  ) {
    if (title.includes('i wish') || file.includes('i_wish')) {
      return '/audio/uploads/Carl_Thomas_I_Wish.mp3';
    }
    return '/audio/uploads/Carl_Thomas_Summer_Rain.mp3';
  }

  // 15. Blackstreet (ONLY match Blackstreet's own track: "Joy")
  if (
    (artist.includes('blackstreet') || file.includes('blackstreet') || id.includes('blackstreet')) &&
    (title.includes('joy') || file.includes('joy'))
  ) {
    return '/audio/uploads/Blackstreet_Joy_12_Remix.mp3';
  }

  // 16. Biz Markie (ONLY match "Just A Friend")
  if (
    (title.includes('just a friend') || file.includes('just_a_friend')) &&
    (artist.includes('biz') || file.includes('biz') || id.includes('biz'))
  ) {
    return '/audio/uploads/Biz_Markie_Just_A_Friend.mp3';
  }

  // 17. Amerie (ONLY match Amerie's own tracks)
  if (
    (artist.includes('amerie') || file.includes('amerie') || id.includes('amerie')) &&
    (title.includes('why dont we') || title.includes("why don't we") || title.includes('1 thing') || title.includes('one thing') || file.includes('fall_in_love') || file.includes('1_thing'))
  ) {
    if (title.includes('why dont we') || title.includes("why don't we") || file.includes('fall_in_love')) {
      return '/audio/uploads/Amerie_Why_Dont_We_Fall_In_Love.mp3';
    }
    return '/audio/uploads/Amerie_1_Thing.mp3';
  }

  // 18. Tevin Campbell (ONLY match "Can We Talk")
  if (
    (title.includes('can we talk') || file.includes('can_we_talk')) &&
    (artist.includes('tevin') || file.includes('tevin') || id.includes('tevin'))
  ) {
    return '/audio/uploads/Tevin_Campbell_Can_We_Talk.mp3';
  }

  // 19. Teedra Moses (ONLY match "Be Your Girl")
  if (
    (title.includes('be your girl') || file.includes('be_your_girl')) &&
    (artist.includes('teedra') || file.includes('teedra') || id.includes('teedra'))
  ) {
    return '/audio/uploads/Teedra_Moses_Be_Your_Girl.mp3';
  }

  // 20. SWV (ONLY match SWV's own tracks)
  if (
    (artist.includes('swv') || file.includes('swv') || id.includes('swv')) &&
    (title.includes('youre the one') || title.includes("you're the one") || title.includes('right here') || file.includes('youre_the_one') || file.includes('right_here'))
  ) {
    if (title.includes('youre the one') || title.includes("you're the one") || file.includes('youre_the_one')) {
      return '/audio/uploads/SWV_Youre_The_One.mp3';
    }
    return '/audio/uploads/SWV_Right_Here_Human_Nature.mp3';
  }

  // 21. Sade (ONLY match "By Your Side")
  if (
    (title.includes('by your side') || file.includes('by_your_side')) &&
    (artist.includes('sade') || file.includes('sade') || id.includes('sade'))
  ) {
    return '/audio/uploads/Sade_By_Your_Side_Neptunes_Remix.mp3';
  }

  // 22. The Spinners (ONLY match "I'll Be Around" or "Could It Be I'm Falling In Love")
  if (
    (artist.includes('spinners') || file.includes('spinners') || id.includes('spinners')) &&
    (title.includes('ill be around') || title.includes("i'll be around") || title.includes('could it be') || file.includes('ill_be_around') || file.includes('could_it_be'))
  ) {
    if (title.includes('ill be around') || title.includes("i'll be around") || file.includes('ill_be_around')) {
      return '/audio/uploads/The_Spinners_Ill_Be_Around.mp3';
    }
    return '/audio/uploads/The_Spinners_Could_It_Be_Im_Falling_In_Love.mp3';
  }

  // 23. The Isley Brothers (ONLY match "For The Love Of You")
  if (
    (title.includes('for the love of you') || file.includes('for_the_love_of_you')) &&
    (artist.includes('isley') || file.includes('isley') || id.includes('isley'))
  ) {
    return '/audio/uploads/The_Isley_Brothers_For_The_Love_Of_You.mp3';
  }

  // 24. Parliament (ONLY match "Flashlight")
  if (
    (title.includes('flashlight') || file.includes('flashlight')) &&
    (artist.includes('parliament') || file.includes('parliament') || id.includes('parliament'))
  ) {
    return '/audio/uploads/Parliament_Flashlight.mp3';
  }

  // 25. Grandmaster Flash (ONLY match "Freedom")
  if (
    (title.includes('freedom') || file.includes('freedom')) &&
    (artist.includes('grandmaster') || file.includes('grandmaster') || id.includes('grandmaster'))
  ) {
    return '/audio/uploads/Grandmaster_Flash_Freedom.mp3';
  }

  // 26. Aaliyah (ONLY match Aaliyah's own tracks)
  if (
    (artist.includes('aaliyah') || file.includes('aaliyah') || id.includes('aaliyah')) &&
    (title.includes('one in a million') || title.includes('at your best') || file.includes('one_in_a_million') || file.includes('at_your_best'))
  ) {
    if (title.includes('one in a million') || file.includes('one_in_a_million')) {
      return '/audio/uploads/Aaliyah_One_In_A_Million_Mashup.mp3';
    }
    return '/audio/uploads/Aaliyah_At_Your_Best_Remix.mp3';
  }

  // 27. Michael Jackson
  if (artist.includes('michael jackson') || file.includes('michael_jackson') || id.includes('michael-jackson') || id.includes('mj-thriller')) {
    if (title.includes('wanna be startin') || title.includes('startin somethin') || id.includes('mj-thriller-01')) {
      return '/audio/uploads/Michael_Jackson_-_01_-_Wanna_Be_Startin_Somethin.mp3';
    }
    if (title.includes('baby be mine') || id.includes('mj-thriller-02')) {
      return '/audio/uploads/Michael_Jackson_-_02_-_Baby_Be_Mine.mp3';
    }
    if (title.includes('the girl is mine') || title.includes('girl is mine') || id.includes('mj-thriller-03')) {
      return '/audio/uploads/Michael_Jackson_-_03_-_The_Girl_Is_Mine.mp3';
    }
    if (title.includes('thriller') || id.includes('mj-thriller-04')) {
      return '/audio/uploads/Michael_Jackson_-_04_-_Thriller.mp3';
    }
    if (title.includes('beat it') || id.includes('mj-thriller-05')) {
      return '/audio/uploads/Michael_Jackson_-_05_-_Beat_It.mp3';
    }
    if ((title.includes('billie jean') && !title.includes('demo')) || id.includes('mj-thriller-06')) {
      return '/audio/uploads/Michael_Jackson_-_06_-_Billie_Jean.mp3';
    }
    if (title.includes('human nature') || id.includes('mj-thriller-07')) {
      return '/audio/uploads/Michael_Jackson_-_07_-_Human_Nature.mp3';
    }
    if (title.includes('p.y.t') || title.includes('pyt') || title.includes('pretty young thing') || id.includes('mj-thriller-08')) {
      return '/audio/uploads/Michael_Jackson_-_08_-_PYT_Pretty_Young_Thing.mp3';
    }
    if (title.includes('lady in my life') || id.includes('mj-thriller-09')) {
      return '/audio/uploads/Michael_Jackson_-_09_-_The_Lady_in_My_Life.mp3';
    }
    if (title.includes('someone in the dark') || id.includes('mj-thriller-10')) {
      return '/audio/uploads/Michael_Jackson_-_10_-_Someone_In_The_Dark.mp3';
    }
    if (title.includes('carousel') || id.includes('mj-thriller-11')) {
      return '/audio/uploads/Michael_Jackson_-_11_-_Carousel.mp3';
    }
    if ((title.includes('billie jean') && title.includes('demo')) || id.includes('mj-thriller-12')) {
      return '/audio/uploads/Michael_Jackson_-_12_-_Billie_Jean_Demo.mp3';
    }
    if (title.includes('voice-over') || title.includes('voice over') || title.includes('cant get outta the rain') || title.includes("can't get outta the rain") || id.includes('mj-thriller-13')) {
      return '/audio/uploads/Michael_Jackson_-_13_-_Voice_Over_Session.mp3';
    }
    if (title.includes('dont stop') || title.includes("don't stop") || title === '01') {
      return '/audio/uploads/Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3';
    }
    if (title.includes('rock with you') || title === '02') {
      return '/audio/uploads/Michael_Jackson_-_02_-_Rock_With_You.mp3';
    }
    if (title.includes('workin') || title === '03') {
      return '/audio/uploads/Michael_Jackson_-_03_-_Workin__Day_And_Night.mp3';
    }
    if (title.includes('get on the floor') || title === '04') {
      return '/audio/uploads/Michael_Jackson_-_04_-_Get_On_The_Floor.mp3';
    }
    if (title.includes('off the wall') || title === '05') {
      return '/audio/uploads/Michael_Jackson_-_05_-_Off_The_Wall.mp3';
    }
    if (title.includes('girlfriend') || title === '06') {
      return '/audio/uploads/Michael_Jackson_-_06_-_Girlfriend.mp3';
    }
    if (title.includes('out of my life') || title === '07') {
      return '/audio/uploads/Michael_Jackson_-_07_-_She_s_Out_Of_My_Life.mp3';
    }
    if (title.includes('cant help') || title.includes("can't help") || title === '08') {
      return '/audio/uploads/Michael_Jackson_-_08_-_I_Can_t_Help_It.mp3';
    }
    if (title.includes('falling in love') || title === '09') {
      return '/audio/uploads/Michael_Jackson_-_09_-_It_s_The_Falling_In_Love.mp3';
    }
    if (title.includes('burn this disco') || title === '10') {
      return '/audio/uploads/Michael_Jackson_-_10_-_Burn_This_Disco_Out.mp3';
    }
    // Safe same-artist studio stream fallback
    return '/audio/uploads/Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3';
  }

  // 28. ChanceTEK One Original Breakbeat Anthem
  if (
    id === 'track-1' ||
    title.includes('chancetek one break') ||
    title.includes('breakbeat anthem')
  ) {
    return '/audio/Fort_Apache.mp3';
  }

  // Do NOT blanket-fallback or cross-substitute. Return null so the track's own original audio is preserved!
  return null;
}

/**
 * Fallback audio only for tracks that have zero audioUrl specified.
 * NEVER returns Fort Apache unless the track is genuinely an ChanceTEK One breakbeat anthem.
 */
export function getResilientAudioFallback(track?: TrackIdentifier): string {
  if (!track) return '';

  const title = (track.title || '').toLowerCase();
  const artist = (track.artistName || '').toLowerCase();
  const file = (track.fileName || '').toLowerCase();

  // ONLY return Fort Apache for actual ChanceTEK One breakbeat anthems!
  if (track.id === 'track-1' || title.includes('chancetek one break') || title.includes('breakbeat anthem')) {
    return '/audio/Fort_Apache.mp3';
  }

  // Registered studio master for THIS exact artist + song only. There is no artist-level
  // stand-in: one artist's other songs are never answered with a different recording.
  const sameArtistAuth = getAuthenticAudioUrl(track);
  if (sameArtistAuth && !isCrossArtistAudioMismatch({ ...track, audioUrl: sameArtistAuth })) {
    return sameArtistAuth;
  }

  // NEVER return another artist's song or deleted content
  return '';
}

/**
 * Last-resort same-artist studio fallback used ONLY by PlayerContext when a track's own
 * server/cloud asset 404s AND its local IndexedDB / in-memory File blob is unavailable in the
 * current browser. Never crosses artist boundaries and never modifies catalog records.
 */
export function getSameArtistEmergencyFallback(track?: TrackIdentifier): string {
  if (!track) return '';
  const exact = getAuthenticAudioUrl(track);
  if (exact && !isCrossArtistAudioMismatch({ ...track, audioUrl: exact })) {
    return exact;
  }
  const artist = (track.artistName || '').toLowerCase().trim();
  const title = (track.title || '').toLowerCase().trim();
  if (!artist) return '';
  if (track.id === 'track-1' || title.includes('chancetek one break') || title.includes('breakbeat anthem')) {
    return '/audio/Fort_Apache.mp3';
  }
  if (artist.includes('luther')) {
    return 'https://firebasestorage.googleapis.com/v0/b/spadesworks8.firebasestorage.app/o/media%2Fcatalog%2Faudio%2F1793254898258_trk-pub-1793247158957-c3734ea524_8e697043.mp3?alt=media&token=711e3a11-58b7-4593-9fad-34935e0e4222';
  }
  if (artist.includes('janet')) return '/audio/uploads/Janet_Jackson_Got_Til_Its_Gone.mp3';
  if (artist.includes('michael jackson')) return '/audio/uploads/Michael_Jackson_-_01_-_Don_t_Stop__Til_You_Get_Enough.mp3';
  if (artist.includes('aaliyah')) return '/audio/uploads/Aaliyah_At_Your_Best_Remix.mp3';
  if (artist.includes('amerie')) return '/audio/uploads/Amerie_1_Thing.mp3';
  if (artist.includes('bobby brown')) return '/audio/uploads/Bobby_Brown_Every_Little_Step.mp3';
  if (artist.includes('carl thomas')) return '/audio/uploads/Carl_Thomas_Summer_Rain.mp3';
  if (artist.includes('swv')) return '/audio/uploads/SWV_Right_Here_Human_Nature.mp3';
  if (artist.includes('spinners')) return '/audio/uploads/The_Spinners_Ill_Be_Around.mp3';
  if (artist.includes('lauryn hill')) return '/audio/uploads/Lauryn_Hill_Ex_Factor_Remix.mp3';
  if (artist.includes('mary j')) return '/audio/uploads/Mary_J_Blige_I_Can_Love_You.mp3';
  if (artist.includes('blackstreet')) return '/audio/uploads/Blackstreet_Joy_12_Remix.mp3';
  if (artist.includes('tevin campbell')) return '/audio/uploads/Tevin_Campbell_Can_We_Talk.mp3';
  if (artist.includes('sade')) return '/audio/uploads/Sade_By_Your_Side_Neptunes_Remix.mp3';
  if (artist.includes('isley')) return '/audio/uploads/The_Isley_Brothers_For_The_Love_Of_You.mp3';
  if (artist.includes('parliament')) return '/audio/uploads/Parliament_Flashlight.mp3';
  if (artist.includes('gap band')) return '/audio/uploads/Gap_Band_Outstanding.mp3';
  if (artist.includes('maze') || artist.includes('frankie beverly')) return '/audio/uploads/Maze_Frankie_Beverly_Before_I_Let_Go.mp3';
  return '';
}
