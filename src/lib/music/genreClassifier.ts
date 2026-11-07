/**
 * ChanceTEKone — Unified Genre Classification & Normalization Engine
 * 
 * Provides:
 * 1. PLATFORM_STANDARD_GENRES: The canonical platform music genres matching /music views & crates.
 * 2. classifyGenre(): Autonomous, intelligent genre resolution from artist, title, album, ID3 tag, and crate context.
 * 3. isTrackMatchingGenre(): Resilient genre matching for consumer and admin filtering.
 * 4. isGenericOrInvalidGenre(): Flags placeholder or non-genre strings (e.g. 'Direct Music Library', 'Discographys').
 */

export const PLATFORM_STANDARD_GENRES = [
  'R&B / Neo-Soul',
  'Hip Hop',
  'Country-Soul',
  'Afro-House & Beats',
  'House-Club',
  'Jazz & Blues',
  'Reggae-Dancehall',
  'Reggaeton',
  'Latin-Freestyle',
  'Disco / Funk',
  'Slow Jams / Soul',
  'Break Beats & Turntablism',
  'Pop / R&B / Soul',
] as const;

export type PlatformGenre = (typeof PLATFORM_STANDARD_GENRES)[number];

/**
 * Standard ID3v1 genre index mappings (0-147)
 */
export const ID3V1_GENRE_MAP: Record<number, string> = {
  0: 'Blues',
  1: 'Classic Rock',
  2: 'Country-Soul',
  3: 'Dance',
  4: 'Disco / Funk',
  5: 'Funk',
  6: 'Grunge',
  7: 'Hip Hop',
  8: 'Jazz & Blues',
  9: 'Metal',
  10: 'Jazz & Blues',
  11: 'Oldies',
  12: 'Other',
  13: 'Pop',
  14: 'R&B / Neo-Soul',
  15: 'Rap',
  16: 'Reggae-Dancehall',
  17: 'Rock',
  18: 'Techno',
  19: 'Industrial',
  20: 'Alternative',
  21: 'Ska',
  22: 'Death Metal',
  23: 'Pranks',
  24: 'Soundtrack',
  25: 'Euro-Techno',
  26: 'Ambient',
  27: 'Trip-Hop',
  28: 'Vocal',
  29: 'Jazz+Funk',
  30: 'Fusion',
  31: 'Trance',
  32: 'Classical',
  33: 'Instrumental',
  34: 'Acid',
  35: 'House-Club',
  36: 'Game',
  37: 'Sound Clip',
  38: 'Gospel',
  39: 'Noise',
  40: 'Alternative Rock',
  41: 'Bass',
  42: 'Soul',
  43: 'Punk',
  44: 'Space',
  45: 'Meditative',
  46: 'Instrumental Pop',
  47: 'Instrumental Rock',
  48: 'Ethnic',
  49: 'Gothic',
  50: 'Darkwave',
  51: 'Techno-Industrial',
  52: 'Electronic',
  53: 'Pop-Folk',
  54: 'Eurodance',
  55: 'Dream',
  56: 'Southern Rock',
  57: 'Comedy',
  58: 'Cult',
  59: 'Gangsta Rap',
  60: 'Top 40',
  61: 'Christian Rap',
  62: 'Pop/Funk',
  63: 'Jungle',
  64: 'Native American',
  65: 'Cabaret',
  66: 'New Wave',
  67: 'Psychedelic',
  68: 'Rave',
  69: 'Showtunes',
  70: 'Trailer',
  71: 'Lo-Fi',
  72: 'Tribal',
  73: 'Acid Punk',
  74: 'Acid Jazz',
  75: 'Polka',
  76: 'Retro',
  77: 'Musical',
  78: 'Rock & Roll',
  79: 'Hard Rock',
  80: 'Folk',
  81: 'Folk-Rock',
  82: 'National Folk',
  83: 'Swing',
  84: 'Fast Fusion',
  85: 'Bebop',
  86: 'Latin',
  87: 'Revival',
  88: 'Celtic',
  89: 'Bluegrass',
  90: 'Avantgarde',
  91: 'Gothic Rock',
  92: 'Progressive Rock',
  93: 'Psychedelic Rock',
  94: 'Symphonic Rock',
  95: 'Slow Rock',
  96: 'Big Band',
  97: 'Chorus',
  98: 'Easy Listening',
  99: 'Acoustic',
  100: 'Humour',
  101: 'Speech',
  102: 'Chanson',
  103: 'Opera',
  104: 'Chamber Music',
  105: 'Sonata',
  106: 'Symphony',
  107: 'Booty Bass',
  108: 'Primus',
  109: 'Porn Groove',
  110: 'Satire',
  111: 'Slow Jam',
  112: 'Club',
  113: 'Tango',
  114: 'Samba',
  115: 'Folklore',
  116: 'Ballad',
  117: 'Power Ballad',
  118: 'Rhythmic Soul',
  119: 'Freestyle',
  120: 'Duet',
  121: 'Punk Rock',
  122: 'Drum Solo',
  123: 'A cappella',
  124: 'Euro-House',
  125: 'Dance Hall',
  126: 'Goa',
  127: 'Drum & Bass',
  128: 'Club-House',
  129: 'Hardcore',
  130: 'Terror',
  131: 'Indie',
  132: 'BritPop',
  133: 'Negerpunk',
  134: 'Polsk Punk',
  135: 'Beat',
  136: 'Christian Gangsta Rap',
  137: 'Heavy Metal',
  138: 'Black Metal',
  139: 'Crossover',
  140: 'Contemporary Christian',
  141: 'Christian Rock',
  142: 'Merengue',
  143: 'Salsa',
  144: 'Thrash Metal',
  145: 'Anime',
  146: 'JPop',
  147: 'Synthpop',
};

/**
 * Known artist-to-genre master lookup table
 */
interface ArtistGenreMapping {
  match: (artist: string) => boolean;
  genre: PlatformGenre;
}

const ARTIST_GENRE_REGISTRY: ArtistGenreMapping[] = [
  // Michael Jackson & Janet Jackson
  {
    match: (a) => a.includes('michael jackson'),
    genre: 'Pop / R&B / Soul',
  },
  {
    match: (a) => a.includes('janet jackson'),
    genre: 'R&B / Neo-Soul',
  },

  // R&B / Neo-Soul Core Artists
  {
    match: (a) =>
      a.includes('avant') ||
      a.includes('112') ||
      a.includes('ashanti') ||
      a.includes('chris brown') ||
      a.includes('brownstone') ||
      a.includes('carl thomas') ||
      a.includes('tevin campbell') ||
      a.includes('luther vandross') ||
      a.includes('aaliyah') ||
      a.includes('alicia keys') ||
      a.includes('amerie') ||
      a.includes('blackstreet') ||
      a.includes('bobby brown') ||
      a.includes('dennis edwards') ||
      a.includes('mary j') ||
      a.includes('sade') ||
      a.includes('swv') ||
      a.includes('teedra moses') ||
      a.includes('isley') ||
      a.includes('spinners') ||
      a.includes('maze') ||
      a.includes('frankie beverly') ||
      a.includes('jodeci') ||
      a.includes('boyz ii men') ||
      a.includes('tlc') ||
      a.includes('faith evans') ||
      a.includes('erykah badu') ||
      a.includes('dangelo') ||
      a.includes("d'angelo") ||
      a.includes('maxwell') ||
      a.includes('anthony hamilton') ||
      a.includes('musiq') ||
      a.includes('jill scott') ||
      a.includes('toni braxton') ||
      a.includes('usher') ||
      a.includes('ginuwine') ||
      a.includes('donell jones') ||
      a.includes('brian mcknight') ||
      a.includes('joe') ||
      a.includes('tamia') ||
      a.includes('brandy') ||
      a.includes('monica') ||
      a.includes('jagged edge') ||
      a.includes('dru hill') ||
      a.includes('k-ci') ||
      a.includes('total') ||
      a.includes('xscape') ||
      a.includes('702') ||
      a.includes('zhane') ||
      a.includes('silk') ||
      a.includes('shai') ||
      a.includes('teena marie') ||
      a.includes('keith sweat') ||
      a.includes('new edition') ||
      a.includes('bell biv devoe'),
    genre: 'R&B / Neo-Soul',
  },

  // Hip Hop & Boom Bap Artists
  {
    match: (a) =>
      a.includes('grandmaster') ||
      a.includes('jermaine dupri') ||
      a.includes('biz markie') ||
      a.includes('sugarhill') ||
      a.includes('kurtis blow') ||
      a.includes('afrika bambaataa') ||
      a.includes('run-dmc') ||
      a.includes('run dmc') ||
      a.includes('rakim') ||
      a.includes('big daddy kane') ||
      a.includes('slick rick') ||
      a.includes('krs-one') ||
      a.includes('krs one') ||
      a.includes('boogie down') ||
      a.includes('public enemy') ||
      a.includes('epmd') ||
      a.includes('tribe called quest') ||
      a.includes('de la soul') ||
      a.includes('gang starr') ||
      a.includes('pete rock') ||
      a.includes('nas') ||
      a.includes('notorious b.i.g') ||
      a.includes('biggie') ||
      a.includes('tupac') ||
      a.includes('2pac') ||
      a.includes('wu-tang') ||
      a.includes('raekwon') ||
      a.includes('ghostface') ||
      a.includes('method man') ||
      a.includes('redman') ||
      a.includes('jay-z') ||
      a.includes('jay z') ||
      a.includes('mobb deep') ||
      a.includes('big l') ||
      a.includes('big pun') ||
      a.includes('snoop') ||
      a.includes('dr. dre') ||
      a.includes('ice cube') ||
      a.includes('n.w.a') ||
      a.includes('cypress hill') ||
      a.includes('outkast') ||
      a.includes('scarface') ||
      a.includes('the roots') ||
      a.includes('common') ||
      a.includes('mos def') ||
      a.includes('talib kweli') ||
      a.includes('busta rhymes') ||
      a.includes('dmx') ||
      a.includes('ll cool j') ||
      a.includes('heavy d') ||
      a.includes('lord finesse') ||
      a.includes('diamond d') ||
      a.includes('marley marl') ||
      a.includes('kool g rap') ||
      a.includes('roxanne shante') ||
      a.includes('lauryn hill') ||
      a.includes('fugees'),
    genre: 'Hip Hop',
  },

  // Break Beats & Turntablism
  {
    match: (a) =>
      a.includes('8 of spades') || a.includes('chancetekone') ||
      a.includes('breakbeat') ||
      a.includes('turntablist'),
    genre: 'Break Beats & Turntablism',
  },

  // Disco & Funk
  {
    match: (a) =>
      a.includes('chic') ||
      a.includes('donna summer') ||
      a.includes('earth wind') ||
      a.includes('kool & the gang') ||
      a.includes('gap band') ||
      a.includes('commodores') ||
      a.includes('parliament') ||
      a.includes('funkadelic') ||
      a.includes('george clinton') ||
      a.includes('rick james') ||
      a.includes('ohio players') ||
      a.includes('slave') ||
      a.includes('zapp') ||
      a.includes('roger') ||
      a.includes('lakeside') ||
      a.includes('con funk shun') ||
      a.includes('bar-kays') ||
      a.includes('d-train') ||
      a.includes('evelyn champagne') ||
      a.includes('cheryl lynn') ||
      a.includes('stephanie mills') ||
      a.includes('shalamar') ||
      a.includes('midnight star') ||
      a.includes('sos band') ||
      a.includes('whispers') ||
      a.includes('heatwave') ||
      a.includes('tavares') ||
      a.includes('sister sledge') ||
      a.includes('kc and the sunshine') ||
      a.includes('village people') ||
      a.includes('sylvester') ||
      a.includes('trammps') ||
      a.includes('gloria gaynor') ||
      a.includes('barry white') ||
      a.includes('fatback') ||
      a.includes('fonda rae') ||
      a.includes('change') ||
      a.includes('taana gardner'),
    genre: 'Disco / Funk',
  },

  // House-Club & Electronic Breaks
  {
    match: (a) =>
      a.includes('cipher voltage') ||
      a.includes('frankie knuckles') ||
      a.includes('marshall jefferson') ||
      a.includes('larry heard') ||
      a.includes('mr. fingers') ||
      a.includes('todd terry') ||
      a.includes('masters at work') ||
      a.includes('kerri chandler') ||
      a.includes('armand van helden') ||
      a.includes('crystal waters') ||
      a.includes('robin s') ||
      a.includes('cece peniston') ||
      a.includes('ce ce peniston') ||
      a.includes('daft punk') ||
      a.includes('basement jaxx') ||
      a.includes('david morales') ||
      a.includes('roger sanchez') ||
      a.includes('paul johnson') ||
      a.includes('green velvet') ||
      a.includes('ultra nate') ||
      a.includes('ultra naté') ||
      a.includes('black box') ||
      a.includes('inner city') ||
      a.includes('kevin saunderson') ||
      a.includes('derrick may') ||
      a.includes('hardrive'),
    genre: 'House-Club',
  },

  // Afro-House & Beats
  {
    match: (a) =>
      a.includes('fela kuti') ||
      a.includes('burna boy') ||
      a.includes('wizkid') ||
      a.includes('davido') ||
      a.includes('black coffee') ||
      a.includes('master kg') ||
      a.includes('rema') ||
      a.includes('asake') ||
      a.includes('tems') ||
      a.includes('tiwa savage') ||
      a.includes('olamide') ||
      a.includes('ckay') ||
      a.includes('fireboy') ||
      a.includes('king sunny ade'),
    genre: 'Afro-House & Beats',
  },

  // Jazz & Blues
  {
    match: (a) =>
      a.includes('miles davis') ||
      a.includes('john coltrane') ||
      a.includes('coltrane') ||
      a.includes('thelonious monk') ||
      a.includes('charlie parker') ||
      a.includes('duke ellington') ||
      a.includes('count basie') ||
      a.includes('louis armstrong') ||
      a.includes('billie holiday') ||
      a.includes('ella fitzgerald') ||
      a.includes('nina simone') ||
      a.includes('sarah vaughan') ||
      a.includes('chet baker') ||
      a.includes('herbie hancock') ||
      a.includes('wayne shorter') ||
      a.includes('art blakey') ||
      a.includes('horace silver') ||
      a.includes('charles mingus') ||
      a.includes('b.b. king') ||
      a.includes('bb king') ||
      a.includes('muddy waters') ||
      a.includes('howlin wolf') ||
      a.includes("howlin' wolf") ||
      a.includes('john lee hooker') ||
      a.includes('albert king') ||
      a.includes('freddie king') ||
      a.includes('buddy guy') ||
      a.includes('etta james') ||
      a.includes('robert johnson') ||
      a.includes('ray charles') ||
      a.includes('t-bone walker') ||
      a.includes('dave brubeck') ||
      a.includes('sonny rollins') ||
      a.includes('wynton marsalis'),
    genre: 'Jazz & Blues',
  },

  // Reggae-Dancehall
  {
    match: (a) =>
      a.includes('bob marley') ||
      a.includes('the wailers') ||
      a.includes('peter tosh') ||
      a.includes('bunny wailer') ||
      a.includes('dennis brown') ||
      a.includes('gregory isaacs') ||
      a.includes('beres hammond') ||
      a.includes('barrington levy') ||
      a.includes('yellowman') ||
      a.includes('shabba ranks') ||
      a.includes('super cat') ||
      a.includes('buju banton') ||
      a.includes('beenie man') ||
      a.includes('bounty killer') ||
      a.includes('sean paul') ||
      a.includes('capleton') ||
      a.includes('sizzla') ||
      a.includes('chronixx') ||
      a.includes('koffee') ||
      a.includes('sister nancy') ||
      a.includes('damian marley') ||
      a.includes('ziggy marley') ||
      a.includes('burning spear') ||
      a.includes('garnett silk') ||
      a.includes('maxi priest') ||
      a.includes('wayne wonder') ||
      a.includes('popcaan') ||
      a.includes('vybz kartel'),
    genre: 'Reggae-Dancehall',
  },

  // Reggaeton
  {
    match: (a) =>
      a.includes('daddy yankee') ||
      a.includes('don omar') ||
      a.includes('wisin') ||
      a.includes('yandel') ||
      a.includes('tego calderon') ||
      a.includes('tego calderón') ||
      a.includes('ivy queen') ||
      a.includes('hector') ||
      a.includes('tito') ||
      a.includes('plan b') ||
      a.includes('zion') ||
      a.includes('lennox') ||
      a.includes('bad bunny') ||
      a.includes('j balvin') ||
      a.includes('nicky jam') ||
      a.includes('ozuna') ||
      a.includes('maluma') ||
      a.includes('anuel') ||
      a.includes('farruko') ||
      a.includes('arcangel') ||
      a.includes('arcángel') ||
      a.includes('rauw alejandro') ||
      a.includes('sech'),
    genre: 'Reggaeton',
  },

  // Latin-Freestyle
  {
    match: (a) =>
      a.includes('stevie b') ||
      a.includes('lisa lisa') ||
      a.includes('expose') ||
      a.includes('exposé') ||
      a.includes('shannon') ||
      a.includes('cover girls') ||
      a.includes('cynthia') ||
      a.includes('johnny o') ||
      a.includes('noel') ||
      a.includes('coro') ||
      a.includes('sweet sensation') ||
      a.includes('george lamond') ||
      a.includes('tka') ||
      a.includes('judy torres') ||
      a.includes('safire') ||
      a.includes('sa-fire') ||
      a.includes('corina') ||
      a.includes('brenda k') ||
      a.includes('lil suzy') ||
      a.includes('rockell') ||
      a.includes('nayobe') ||
      a.includes('collage') ||
      a.includes('collagè'),
    genre: 'Latin-Freestyle',
  },

  // Country-Soul
  {
    match: (a) =>
      a.includes('solomon burke') ||
      a.includes('arthur alexander') ||
      a.includes('candi staton') ||
      a.includes('dan penn') ||
      a.includes('tony joe white') ||
      a.includes('charlie rich') ||
      a.includes('swamp dogg') ||
      a.includes('bettye lavette'),
    genre: 'Country-Soul',
  },
];

/**
 * Returns true if a genre string is generic, empty, or an invalid crate placeholder
 */
export function isGenericOrInvalidGenre(genre?: string): boolean {
  if (!genre || typeof genre !== 'string') return true;
  const lower = genre.toLowerCase().trim();
  if (lower.length === 0) return true;

  const genericPlaceholders = [
    'direct music library',
    'direct-music-library',
    'discographys',
    'stems',
    'miscellaneous',
    'general music catalog',
    'general music',
    'general crate',
    'master crate vault',
    'vault cuts',
    'music',
    'audio',
    'soundtrack',
    'sound clip',
    'unknown',
    'unknown genre',
    'other',
    'none',
    'undefined',
    'various',
    'album',
    'single',
  ];

  return genericPlaceholders.includes(lower) || /^\(\d+\)$/.test(lower) || /^\d+$/.test(lower);
}

/**
 * Normalizes an ID3 genre code or raw string
 */
export function normalizeRawGenreString(rawGenre?: string): string | null {
  if (!rawGenre || typeof rawGenre !== 'string') return null;
  let clean = rawGenre.trim();

  // Check (17) or 17 numeric ID3v1 codes
  const numMatch = clean.match(/^\(?(\d{1,3})\)?$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!isNaN(num) && ID3V1_GENRE_MAP[num]) {
      clean = ID3V1_GENRE_MAP[num];
    }
  }

  if (isGenericOrInvalidGenre(clean)) return null;

  const lower = clean.toLowerCase();

  // R&B / Neo-Soul
  if (
    lower.includes('r&b') ||
    lower.includes('rnb') ||
    lower.includes('r & b') ||
    lower.includes('neo-soul') ||
    lower.includes('neo soul') ||
    lower.includes('quiet storm') ||
    lower.includes('motown') ||
    lower.includes('rhythmic soul')
  ) {
    return 'R&B / Neo-Soul';
  }

  // Hip Hop
  if (
    lower.includes('hip hop') ||
    lower.includes('hip-hop') ||
    lower.includes('hiphop') ||
    lower.includes('rap') ||
    lower.includes('boom bap') ||
    lower.includes('trap') ||
    lower.includes('east coast')
  ) {
    return 'Hip Hop';
  }

  // Break Beats
  if (lower.includes('breakbeat') || lower.includes('break beat') || lower.includes('breaks') || lower.includes('turntablism')) {
    return 'Break Beats & Turntablism';
  }

  // Disco & Funk
  if (lower.includes('disco') || lower.includes('funk') || lower.includes('boogie')) {
    return 'Disco / Funk';
  }

  // Afro-House & Beats (Evaluated before House-Club to prevent afro-house from being mislabeled as generic house)
  if (
    lower.includes('afro') ||
    lower.includes('afrobeats') ||
    lower.includes('afrobeat') ||
    lower.includes('amapiano') ||
    lower.includes('djembe')
  ) {
    return 'Afro-House & Beats';
  }

  // House-Club & Electronic Breaks
  if (
    lower.includes('house') ||
    lower.includes('club') ||
    lower.includes('electronic') ||
    lower.includes('techno') ||
    lower.includes('edm') ||
    lower.includes('eurodance') ||
    lower.includes('garage house') ||
    lower.includes('warehouse') ||
    lower.includes('euro-house') ||
    lower.includes('club-house') ||
    lower.includes('deep house') ||
    lower.includes('tech house') ||
    lower.includes('acid house') ||
    lower === 'dance' ||
    lower.includes('dance club') ||
    lower.includes('club dance') ||
    lower.includes('electronic dance')
  ) {
    return 'House-Club';
  }

  // Jazz & Blues
  if (
    lower.includes('jazz') ||
    lower.includes('blues') ||
    lower.includes('bebop') ||
    lower.includes('hard bop') ||
    lower.includes('cool jazz') ||
    lower.includes('swing') ||
    lower.includes('big band') ||
    lower.includes('delta blues') ||
    lower.includes('chicago blues') ||
    lower.includes('blue note') ||
    lower.includes('acid jazz') ||
    lower.includes('fusion') ||
    lower.includes('dixieland')
  ) {
    return 'Jazz & Blues';
  }

  // Reggaeton & Dembow (Evaluated before Reggae-Dancehall because 'reggaeton' contains 'reggae')
  if (
    lower.includes('reggaeton') ||
    lower.includes('reggae-ton') ||
    lower.includes('reggaetón') ||
    lower.includes('dembow') ||
    lower.includes('perreo') ||
    lower.includes('urbano latino') ||
    lower.includes('latin urban') ||
    lower.includes('latin trap')
  ) {
    return 'Reggaeton';
  }

  // Reggae & Dancehall
  if (
    lower.includes('reggae') ||
    lower.includes('dancehall') ||
    lower.includes('dance hall') ||
    lower.includes('dub') ||
    lower.includes('riddim') ||
    lower.includes('roots reggae') ||
    lower.includes('lovers rock') ||
    lower.includes('rocksteady') ||
    lower.includes('ska')
  ) {
    return 'Reggae-Dancehall';
  }

  // Latin-Freestyle
  if (
    lower.includes('freestyle') ||
    lower.includes('latin-freestyle') ||
    lower.includes('latin freestyle') ||
    lower.includes('miami 808') ||
    lower.includes('electro freestyle') ||
    lower.includes('synth freestyle') ||
    lower.includes('miami bass')
  ) {
    return 'Latin-Freestyle';
  }

  // Country-Soul
  if (lower.includes('country') || lower.includes('americana') || lower.includes('southern soul')) {
    return 'Country-Soul';
  }

  // Slow Jams
  if (lower.includes('slow jam') || lower.includes('ballad')) {
    return 'Slow Jams / Soul';
  }

  // Soul
  if (lower.includes('soul')) {
    return 'R&B / Neo-Soul';
  }

  // Pop
  if (lower.includes('pop')) {
    return 'Pop / R&B / Soul';
  }

  return clean;
}

/**
 * Intelligent Genre Classifier
 * Analyzes artist, track title, album, raw ID3 genre, and crate context
 * to automatically assign the song to its true musical genre.
 */
export function classifyGenre(metadata: {
  artist?: string;
  title?: string;
  album?: string;
  rawGenre?: string;
  crateId?: string;
  crateName?: string;
  bpm?: number;
}): string {
  const artistClean = String(metadata.artist || '').toLowerCase().trim();
  const titleClean = String(metadata.title || '').toLowerCase().trim();
  const albumClean = String(metadata.album || '').toLowerCase().trim();
  const crateIdClean = String(metadata.crateId || '').toLowerCase().trim();
  const crateNameClean = String(metadata.crateName || '').toLowerCase().trim();

  // 1. Check known artist master registry (highest confidence)
  for (const entry of ARTIST_GENRE_REGISTRY) {
    if (entry.match(artistClean)) {
      return entry.genre;
    }
  }

  // 2. Check normalized raw genre if present and non-generic
  const normalizedRaw = normalizeRawGenreString(metadata.rawGenre);
  if (normalizedRaw && !isGenericOrInvalidGenre(normalizedRaw)) {
    return normalizedRaw;
  }

  // 3. Keyword analysis across title, album, and combined text
  const combined = `${titleClean} ${albumClean}`.toLowerCase();

  // R&B / Neo-Soul / Slow Jams
  if (
    combined.includes('slow jam') ||
    combined.includes('quiet storm') ||
    combined.includes('ballad') ||
    combined.includes('love song') ||
    combined.includes('can we talk') ||
    combined.includes('summer rain') ||
    combined.includes('i wish') ||
    combined.includes('read your mind') ||
    combined.includes('my thoughts')
  ) {
    return 'Slow Jams / Soul';
  }

  if (
    combined.includes('r&b') ||
    combined.includes('rnb') ||
    combined.includes('neo-soul') ||
    combined.includes('neo soul') ||
    combined.includes('soul') ||
    combined.includes('velvet') ||
    combined.includes('motown')
  ) {
    return 'R&B / Neo-Soul';
  }

  // Break Beats
  if (
    combined.includes('break beat') ||
    combined.includes('breakbeat') ||
    combined.includes('drum break') ||
    combined.includes('turntablism') ||
    combined.includes('scratch') ||
    combined.includes('sp-1200') ||
    combined.includes('apache')
  ) {
    return 'Break Beats & Turntablism';
  }

  // Latin-Freestyle (Checked before Hip Hop so authentic 80s/90s freestyle records are never misclassified as rap)
  if (
    combined.includes('freestyle') ||
    combined.includes('latin freestyle') ||
    combined.includes('miami 808') ||
    combined.includes('electro freestyle') ||
    combined.includes('synth freestyle') ||
    combined.includes('spring love') ||
    combined.includes('let the music play') ||
    combined.includes('point of no return') ||
    combined.includes('show me') ||
    combined.includes('fantasy girl')
  ) {
    return 'Latin-Freestyle';
  }

  // Hip Hop
  if (
    combined.includes('hip hop') ||
    combined.includes('hip-hop') ||
    combined.includes('boom bap') ||
    combined.includes('rap freestyle') ||
    combined.includes('cypher') ||
    combined.includes('rap') ||
    combined.includes('concrete beat') ||
    combined.includes('bronx') ||
    combined.includes('12-bit')
  ) {
    return 'Hip Hop';
  }

  // Disco & Funk
  if (
    combined.includes('disco') ||
    combined.includes('funk') ||
    combined.includes('studio 54') ||
    combined.includes('12" mix') ||
    combined.includes('boogie') ||
    combined.includes('mirrorball')
  ) {
    return 'Disco / Funk';
  }

  // Afro-House & Beats (Checked before House-Club to prevent Afro-House from being misclassified as generic house)
  if (
    combined.includes('afro') ||
    combined.includes('afrobeats') ||
    combined.includes('amapiano') ||
    combined.includes('djembe') ||
    combined.includes('lagos')
  ) {
    return 'Afro-House & Beats';
  }

  // House & Club
  if (
    combined.includes('house') ||
    combined.includes('club') ||
    combined.includes('techno') ||
    combined.includes('edm') ||
    combined.includes('electro') ||
    combined.includes('warehouse') ||
    combined.includes('cyber') ||
    combined.includes('quantum break') ||
    combined.includes('eurodance') ||
    combined.includes('deep house') ||
    combined.includes('garage house')
  ) {
    return 'House-Club';
  }

  // Reggaeton & Dembow (Checked before Reggae-Dancehall because 'reggaeton' contains 'reggae')
  if (
    combined.includes('reggaeton') ||
    combined.includes('reggae-ton') ||
    combined.includes('reggaetón') ||
    combined.includes('dembow') ||
    combined.includes('perreo') ||
    combined.includes('urbano latino') ||
    combined.includes('latin urban')
  ) {
    return 'Reggaeton';
  }

  // Reggae-Dancehall
  if (
    combined.includes('reggae') ||
    combined.includes('dancehall') ||
    combined.includes('dance hall') ||
    combined.includes('riddim') ||
    combined.includes('kingston') ||
    combined.includes('dub') ||
    combined.includes('one drop') ||
    combined.includes('roots reggae')
  ) {
    return 'Reggae-Dancehall';
  }

  // Jazz & Blues
  if (
    combined.includes('jazz') ||
    combined.includes('blues') ||
    combined.includes('brass') ||
    combined.includes('sax') ||
    combined.includes('trumpet') ||
    combined.includes('bebop') ||
    combined.includes('swing') ||
    combined.includes('big band') ||
    combined.includes('so what') ||
    combined.includes('kind of blue') ||
    combined.includes('the thrill is gone')
  ) {
    return 'Jazz & Blues';
  }

  // Country-Soul
  if (combined.includes('country') || combined.includes('slide guitar') || combined.includes('nashville') || combined.includes('delta')) {
    return 'Country-Soul';
  }

  // 4. Infer from selected 8 official crates if applicable
  if (crateIdClean === 'slow-jams' || crateNameClean.includes('slow jam')) {
    return 'Slow Jams / Soul';
  }
  if (crateIdClean === 'disco' || crateNameClean.includes('disco')) {
    return 'Disco / Funk';
  }
  if (crateIdClean === 'oldschool-rnb-soul' || crateNameClean.includes('timeless r&b')) {
    return 'R&B / Neo-Soul';
  }
  if (crateIdClean === 'golden-era-hip-hop' || crateNameClean.includes('golden era')) {
    return 'Hip Hop';
  }
  if (crateIdClean === 'break-beats-samples' || crateNameClean.includes('break beat')) {
    return 'Break Beats & Turntablism';
  }

  // 5. Default authentic fallback
  // R&B / Neo-Soul is the core ambient soundscape of ChanceTEKone The Lounge
  return 'R&B / Neo-Soul';
}

/**
 * Resilient Genre Matcher for consumer and admin filtering
 * Matches songs against the 9 main genre sections on /music:
 * 'Hip Hop', 'R&B/Neo-Soul', 'Country-Soul', 'Afro-House & Beats',
 * 'House-Club', 'Jazz & Blues', 'Reggae-Dancehall', 'Reggaeton', 'Latin-Freestyle'
 */
export function isTrackMatchingGenre(
  trackGenre?: string,
  targetGenre?: string,
  trackCrateId?: string,
  trackArtist?: string,
  trackTitle?: string
): boolean {
  if (!targetGenre || targetGenre === 'Genre' || targetGenre === 'all') return true;

  const targetG = String(targetGenre || '').toLowerCase().trim();
  const rawGenreClean = String(trackGenre || '').toLowerCase().trim();
  const artistClean = String(trackArtist || '').toLowerCase().trim();
  const titleClean = String(trackTitle || '').toLowerCase().trim();

  // If track has a generic/placeholder or empty genre, infer from artist & title
  let effectiveGenre = rawGenreClean;
  if (!effectiveGenre || isGenericOrInvalidGenre(effectiveGenre)) {
    effectiveGenre = String(
      classifyGenre({
        artist: artistClean,
        title: titleClean,
        rawGenre: trackGenre,
        crateId: trackCrateId,
      }) || ''
    ).toLowerCase();
  }

  // Known pure R&B, Soul, Pop, or Funk artists that must NEVER be grouped under Hip Hop, Country, Jazz, etc.
  const isPureRnBSoulArtist =
    artistClean.includes('luther vandross') ||
    artistClean.includes('luther') ||
    artistClean.includes('janet jackson') ||
    artistClean.includes('michael jackson') ||
    artistClean.includes('avant') ||
    artistClean.includes('112') ||
    artistClean.includes('ashanti') ||
    artistClean.includes('chris brown') ||
    artistClean.includes('brownstone') ||
    artistClean.includes('carl thomas') ||
    artistClean.includes('tevin campbell') ||
    artistClean.includes('alicia keys') ||
    artistClean.includes('sade') ||
    artistClean.includes('mary j') ||
    artistClean.includes('bobby brown') ||
    artistClean.includes('blackstreet') ||
    artistClean.includes('swv') ||
    artistClean.includes('isley') ||
    artistClean.includes('spinners') ||
    artistClean.includes('maze') ||
    artistClean.includes('change') ||
    artistClean.includes('teedra moses') ||
    artistClean.includes('jodeci') ||
    artistClean.includes('boyz ii men') ||
    artistClean.includes('tlc') ||
    artistClean.includes('dangelo') ||
    artistClean.includes("d'angelo") ||
    artistClean.includes('maxwell') ||
    artistClean.includes('anthony hamilton') ||
    artistClean.includes('jill scott') ||
    artistClean.includes('toni braxton') ||
    artistClean.includes('usher') ||
    artistClean.includes('ginuwine') ||
    artistClean.includes('brian mcknight') ||
    artistClean.includes('tamia') ||
    artistClean.includes('brandy') ||
    artistClean.includes('monica') ||
    artistClean.includes('dru hill');

  // Known pure Hip Hop / Rap artists
  const isHipHopArtist =
    artistClean.includes('grandmaster flash') ||
    artistClean.includes('biz markie') ||
    artistClean.includes('run-dmc') ||
    artistClean.includes('rakim') ||
    artistClean.includes('ll cool j') ||
    artistClean.includes('public enemy') ||
    artistClean.includes('big daddy kane') ||
    artistClean.includes('slick rick') ||
    artistClean.includes('2pac') ||
    artistClean.includes('tupac') ||
    artistClean.includes('notorious b.i.g') ||
    artistClean.includes('biggie') ||
    artistClean.includes('nas') ||
    artistClean.includes('jay-z') ||
    artistClean.includes('outkast') ||
    artistClean.includes('wu-tang') ||
    artistClean.includes('snoop') ||
    artistClean.includes('dr. dre') ||
    artistClean.includes('ice cube') ||
    artistClean.includes('kendrick') ||
    artistClean.includes('j. cole');

  // Known authentic Reggaeton / Dembow artists
  const isReggaetonArtist =
    artistClean.includes('daddy yankee') ||
    artistClean.includes('don omar') ||
    artistClean.includes('wisin') ||
    artistClean.includes('yandel') ||
    artistClean.includes('tego calderon') ||
    artistClean.includes('tego calderón') ||
    artistClean.includes('ivy queen') ||
    artistClean.includes('bad bunny') ||
    artistClean.includes('j balvin') ||
    artistClean.includes('nicky jam') ||
    artistClean.includes('ozuna') ||
    artistClean.includes('maluma') ||
    artistClean.includes('anuel') ||
    artistClean.includes('farruko') ||
    artistClean.includes('arcangel') ||
    artistClean.includes('arcángel') ||
    artistClean.includes('rauw alejandro') ||
    artistClean.includes('zion') ||
    artistClean.includes('lennox') ||
    artistClean.includes('plan b') ||
    artistClean.includes('sech');

  // Known authentic Reggae / Dancehall artists
  const isReggaeArtist =
    artistClean.includes('bob marley') ||
    artistClean.includes('the wailers') ||
    artistClean.includes('peter tosh') ||
    artistClean.includes('bunny wailer') ||
    artistClean.includes('dennis brown') ||
    artistClean.includes('gregory isaacs') ||
    artistClean.includes('beres hammond') ||
    artistClean.includes('barrington levy') ||
    artistClean.includes('yellowman') ||
    artistClean.includes('shabba ranks') ||
    artistClean.includes('super cat') ||
    artistClean.includes('buju banton') ||
    artistClean.includes('beenie man') ||
    artistClean.includes('bounty killer') ||
    artistClean.includes('sean paul') ||
    artistClean.includes('capleton') ||
    artistClean.includes('sizzla') ||
    artistClean.includes('chronixx') ||
    artistClean.includes('koffee') ||
    artistClean.includes('sister nancy') ||
    artistClean.includes('damian marley') ||
    artistClean.includes('ziggy marley') ||
    artistClean.includes('burning spear') ||
    artistClean.includes('garnett silk') ||
    artistClean.includes('maxi priest') ||
    artistClean.includes('wayne wonder') ||
    artistClean.includes('popcaan') ||
    artistClean.includes('vybz kartel');

  // Known authentic Latin-Freestyle artists
  const isFreestyleArtist =
    artistClean.includes('stevie b') ||
    artistClean.includes('lisa lisa') ||
    artistClean.includes('expose') ||
    artistClean.includes('exposé') ||
    artistClean.includes('shannon') ||
    artistClean.includes('cover girls') ||
    artistClean.includes('cynthia') ||
    artistClean.includes('johnny o') ||
    artistClean.includes('noel') ||
    artistClean.includes('coro') ||
    artistClean.includes('sweet sensation') ||
    artistClean.includes('george lamond') ||
    artistClean.includes('tka') ||
    artistClean.includes('judy torres') ||
    artistClean.includes('safire') ||
    artistClean.includes('sa-fire') ||
    artistClean.includes('corina') ||
    artistClean.includes('brenda k') ||
    artistClean.includes('lil suzy') ||
    artistClean.includes('rockell') ||
    artistClean.includes('nayobe') ||
    artistClean.includes('collage') ||
    artistClean.includes('collagè');

  // Known authentic House & Club artists
  const isHouseClubArtist =
    artistClean.includes('cipher voltage') ||
    artistClean.includes('frankie knuckles') ||
    artistClean.includes('marshall jefferson') ||
    artistClean.includes('larry heard') ||
    artistClean.includes('mr. fingers') ||
    artistClean.includes('todd terry') ||
    artistClean.includes('masters at work') ||
    artistClean.includes('kerri chandler') ||
    artistClean.includes('armand van helden') ||
    artistClean.includes('crystal waters') ||
    artistClean.includes('robin s') ||
    artistClean.includes('cece peniston') ||
    artistClean.includes('ce ce peniston') ||
    artistClean.includes('daft punk') ||
    artistClean.includes('basement jaxx') ||
    artistClean.includes('david morales') ||
    artistClean.includes('roger sanchez') ||
    artistClean.includes('paul johnson') ||
    artistClean.includes('green velvet') ||
    artistClean.includes('ultra nate') ||
    artistClean.includes('ultra naté') ||
    artistClean.includes('black box') ||
    artistClean.includes('inner city') ||
    artistClean.includes('kevin saunderson') ||
    artistClean.includes('derrick may') ||
    artistClean.includes('hardrive');

  // Known authentic Jazz & Blues artists
  const isJazzBluesArtist =
    artistClean.includes('miles davis') ||
    artistClean.includes('john coltrane') ||
    artistClean.includes('coltrane') ||
    artistClean.includes('thelonious monk') ||
    artistClean.includes('charlie parker') ||
    artistClean.includes('duke ellington') ||
    artistClean.includes('count basie') ||
    artistClean.includes('louis armstrong') ||
    artistClean.includes('billie holiday') ||
    artistClean.includes('ella fitzgerald') ||
    artistClean.includes('nina simone') ||
    artistClean.includes('sarah vaughan') ||
    artistClean.includes('chet baker') ||
    artistClean.includes('herbie hancock') ||
    artistClean.includes('wayne shorter') ||
    artistClean.includes('art blakey') ||
    artistClean.includes('horace silver') ||
    artistClean.includes('charles mingus') ||
    artistClean.includes('b.b. king') ||
    artistClean.includes('bb king') ||
    artistClean.includes('muddy waters') ||
    artistClean.includes('howlin wolf') ||
    artistClean.includes("howlin' wolf") ||
    artistClean.includes('john lee hooker') ||
    artistClean.includes('albert king') ||
    artistClean.includes('freddie king') ||
    artistClean.includes('buddy guy') ||
    artistClean.includes('etta james') ||
    artistClean.includes('robert johnson') ||
    artistClean.includes('ray charles') ||
    artistClean.includes('t-bone walker') ||
    artistClean.includes('dave brubeck') ||
    artistClean.includes('sonny rollins') ||
    artistClean.includes('wynton marsalis');

  // 1. Hip Hop
  if (targetG === 'hip hop' || targetG === 'hip-hop') {
    // Pure R&B, Soul, Pop artists (Michael Jackson, Janet Jackson, Luther Vandross, Avant, 112, Tevin Campbell, etc.)
    // are strictly prohibited from appearing in Hip Hop.
    if (isPureRnBSoulArtist && !isHipHopArtist) return false;

    // Must have authentic hip hop attributes
    if (isHipHopArtist) return true;
    return (
      effectiveGenre === 'hip hop' ||
      effectiveGenre.includes('boom bap') ||
      effectiveGenre.includes('turntablism') ||
      (effectiveGenre.includes('rap') && !effectiveGenre.includes('trap soul')) ||
      (effectiveGenre.includes('hip hop') && !effectiveGenre.includes('hip hop soul'))
    );
  }

  // 2. R&B / Neo-Soul
  if (
    targetG === 'r&b/neo-soul' ||
    targetG === 'r&b / neo-soul' ||
    targetG === 'rnb' ||
    targetG === 'r&b' ||
    targetG === 'soul'
  ) {
    if (isPureRnBSoulArtist) return true;
    return (
      effectiveGenre.includes('r&b') ||
      effectiveGenre.includes('rnb') ||
      effectiveGenre.includes('soul') ||
      effectiveGenre.includes('neo-soul') ||
      effectiveGenre.includes('neo soul') ||
      effectiveGenre.includes('slow jam') ||
      effectiveGenre.includes('quiet storm') ||
      effectiveGenre.includes('motown') ||
      effectiveGenre.includes('new jack swing') ||
      effectiveGenre.includes('pop / r&b / soul') ||
      effectiveGenre.includes('funk') ||
      effectiveGenre.includes('disco')
    );
  }

  // 3. House-Club
  if (targetG === 'house-club' || targetG === 'house' || targetG === 'club' || targetG === 'dance') {
    // Ballads, slow jams, and pure soul do NOT match House-Club
    if (isPureRnBSoulArtist && !isHouseClubArtist) return false;
    if (effectiveGenre.includes('slow jam') || effectiveGenre.includes('quiet storm') || effectiveGenre.includes('ballad')) {
      return false;
    }
    // Strictly exclude Afro-House & Amapiano from generic House-Club
    if (effectiveGenre.includes('afro') || effectiveGenre.includes('amapiano')) {
      return false;
    }
    // Strictly exclude Reggae-Dancehall and Latin-Freestyle from House-Club
    if (
      effectiveGenre.includes('reggae') ||
      effectiveGenre.includes('dancehall') ||
      effectiveGenre.includes('dance hall') ||
      effectiveGenre.includes('freestyle')
    ) {
      return false;
    }
    if (isHouseClubArtist && !effectiveGenre.includes('freestyle') && !effectiveGenre.includes('reggae')) {
      return true;
    }
    return (
      effectiveGenre.includes('house') ||
      effectiveGenre.includes('techno') ||
      effectiveGenre.includes('edm') ||
      effectiveGenre.includes('electronic') ||
      effectiveGenre.includes('garage house') ||
      effectiveGenre.includes('warehouse') ||
      effectiveGenre.includes('club') ||
      effectiveGenre.includes('eurodance') ||
      (effectiveGenre.includes('dance') && !effectiveGenre.includes('dancehall'))
    );
  }

  // 4. Afro-House & Beats
  if (targetG.includes('afro')) {
    if (isPureRnBSoulArtist) return false;
    return (
      effectiveGenre.includes('afro') ||
      effectiveGenre.includes('afrobeats') ||
      effectiveGenre.includes('afrobeat') ||
      effectiveGenre.includes('amapiano') ||
      effectiveGenre.includes('djembe')
    );
  }

  // 5. Country-Soul
  if (targetG.includes('country')) {
    if (isPureRnBSoulArtist) return false;
    return (
      effectiveGenre.includes('country') ||
      effectiveGenre.includes('americana') ||
      effectiveGenre.includes('pedal steel') ||
      effectiveGenre.includes('nashville') ||
      effectiveGenre.includes('southern grit')
    );
  }

  // 6. Jazz & Blues
  if (targetG.includes('jazz') || targetG.includes('blues')) {
    if (isPureRnBSoulArtist && !isJazzBluesArtist) return false;
    if (isJazzBluesArtist) return true;
    return (
      effectiveGenre.includes('jazz') ||
      effectiveGenre.includes('blues') ||
      effectiveGenre.includes('bebop') ||
      effectiveGenre.includes('hard bop') ||
      effectiveGenre.includes('cool jazz') ||
      effectiveGenre.includes('swing') ||
      effectiveGenre.includes('big band') ||
      effectiveGenre.includes('delta blues') ||
      effectiveGenre.includes('chicago blues')
    );
  }

  // 7. Reggaeton (Checked BEFORE Reggae-Dancehall because 'reggaeton' contains 'reggae')
  if (
    targetG === 'reggaeton' ||
    targetG.includes('reggaeton') ||
    targetG.includes('dembow') ||
    targetG.includes('perreo') ||
    targetG.includes('urbano latino')
  ) {
    if (isPureRnBSoulArtist && !isReggaetonArtist) return false;
    if (isReggaetonArtist) return true;
    return (
      effectiveGenre.includes('reggaeton') ||
      effectiveGenre.includes('reggae-ton') ||
      effectiveGenre.includes('reggaetón') ||
      effectiveGenre.includes('dembow') ||
      effectiveGenre.includes('perreo') ||
      effectiveGenre.includes('urbano latino') ||
      effectiveGenre.includes('latin urban')
    );
  }

  // 8. Reggae-Dancehall & Reggae-Dance
  if (
    (targetG.includes('reggae') && !targetG.includes('reggaeton')) ||
    targetG.includes('dancehall') ||
    targetG.includes('dance hall') ||
    targetG === 'reggae-dance' ||
    targetG === 'dub' ||
    targetG === 'riddim'
  ) {
    if (isPureRnBSoulArtist && !isReggaeArtist) return false;
    // Strictly prohibit Reggaeton & Dembow from leaking into Reggae-Dancehall
    if (
      effectiveGenre.includes('reggaeton') ||
      effectiveGenre.includes('reggae-ton') ||
      effectiveGenre.includes('reggaetón') ||
      effectiveGenre.includes('dembow')
    ) {
      return false;
    }
    if (isReggaeArtist) return true;
    return (
      effectiveGenre.includes('reggae') ||
      effectiveGenre.includes('dancehall') ||
      effectiveGenre.includes('dance hall') ||
      effectiveGenre.includes('dub') ||
      effectiveGenre.includes('riddim') ||
      effectiveGenre.includes('roots reggae') ||
      effectiveGenre.includes('lovers rock') ||
      effectiveGenre.includes('rocksteady') ||
      effectiveGenre.includes('ska')
    );
  }

  // 9. Latin-Freestyle
  if (
    targetG === 'latin-freestyle' ||
    targetG === 'latin freestyle' ||
    targetG === 'freestyle' ||
    targetG.includes('freestyle') ||
    (targetG.includes('latin') && !targetG.includes('reggaeton'))
  ) {
    if (isPureRnBSoulArtist && !isFreestyleArtist) return false;
    if (isFreestyleArtist) return true;
    return (
      effectiveGenre.includes('latin-freestyle') ||
      effectiveGenre.includes('latin freestyle') ||
      effectiveGenre === 'freestyle' ||
      effectiveGenre.includes('freestyle') ||
      effectiveGenre.includes('miami 808') ||
      effectiveGenre.includes('electro freestyle') ||
      effectiveGenre.includes('synth freestyle') ||
      effectiveGenre.includes('miami bass')
    );
  }

  return false;
}

