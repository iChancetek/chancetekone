import { Track } from '@/types/media';

/**
 * Universal Search & Multi-Token Matcher
 *
 * Resolves composite search patterns like:
 * - "michael jackson - human nature"
 * - "human nature - michael jackson"
 * - "michael jackson human nature"
 * - "human nature michael jackson"
 * - "michael thriller"
 *
 * Supports:
 * 1. Diacritic and punctuation normalization (smart quotes, dashes, accents)
 * 2. Composite string substring matching (artist - title, title - artist, etc.)
 * 3. Multi-token (AND) matching where every keyword entered must be found in the item's metadata
 * 4. Relevance scoring and ranking so exact matches and closest matches appear at the top.
 */

/**
 * Normalizes text for search comparison:
 * - Lowercases and trims
 * - Removes accents / diacritics (e.g. café -> cafe)
 * - Normalizes quotes / apostrophes (smart quotes -> straight quotes)
 * - Collapses whitespace
 */
export function normalizeSearchString(text?: any): string {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : String(text);
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts clean search tokens (words) from a query,
 * breaking on spaces and punctuation like hyphens, colons, slashes.
 */
export function extractSearchTokens(query?: any): string[] {
  if (query === null || query === undefined) return [];
  const normalized = normalizeSearchString(query);
  if (!normalized) return [];
  return normalized
    .split(/[\s\-–—:,./\\]+/)
    .map((t) => t.replace(/[^\w]/g, '').trim())
    .filter((t) => t.length > 0);
}

/**
 * Checks whether a Track matches the given search query.
 */
export function matchesTrackSearch(track: Track, query?: string): boolean {
  if (!track) return false;
  const qStr = query !== null && query !== undefined ? String(query).trim() : '';
  if (!qStr) return true;

  const rawQ = qStr.toLowerCase();
  const normQ = normalizeSearchString(qStr);
  if (!normQ) return true;
  const tokens = extractSearchTokens(qStr);

  const title = String(track.title || '').toLowerCase();
  const artist = String(track.artistName || '').toLowerCase();
  const album = String(track.albumTitle || '').toLowerCase();
  const genre = String(track.genre || '').toLowerCase();
  const crate = String(track.crateName || track.crateId || '').toLowerCase();
  const producer = String(track.producer || '').toLowerCase();

  const normTitle = normalizeSearchString(track.title);
  const normArtist = normalizeSearchString(track.artistName);
  const normAlbum = normalizeSearchString(track.albumTitle);
  const normGenre = normalizeSearchString(track.genre);
  const normCrate = normalizeSearchString(track.crateName || track.crateId);

  // 1. Direct single-field substring match
  if (
    title.includes(rawQ) ||
    artist.includes(rawQ) ||
    album.includes(rawQ) ||
    genre.includes(rawQ) ||
    crate.includes(rawQ) ||
    producer.includes(rawQ)
  ) {
    return true;
  }

  // 2. Normalized single-field substring match
  if (
    (normTitle && normTitle.includes(normQ)) ||
    (normArtist && normArtist.includes(normQ)) ||
    (normAlbum && normAlbum.includes(normQ)) ||
    (normGenre && normGenre.includes(normQ)) ||
    (normCrate && normCrate.includes(normQ))
  ) {
    return true;
  }

  // 3. Composite strings (e.g. "michael jackson - human nature", "jackson - human nature", "human nature michael jackson")
  const artistWords = normArtist ? normArtist.split(/\s+/).filter((w) => w.length >= 3) : [];
  const rawComposites = [
    `${normArtist} ${normTitle}`,
    `${normTitle} ${normArtist}`,
    `${normArtist} - ${normTitle}`,
    `${normTitle} - ${normArtist}`,
    `${normArtist} ${normAlbum} ${normTitle}`,
    `${normTitle} ${normAlbum} ${normArtist}`,
    ...artistWords.flatMap((w) => [
      `${w} - ${normTitle}`,
      `${normTitle} - ${w}`,
      `${w} ${normTitle}`,
      `${normTitle} ${w}`,
    ]),
  ];
  const composites = rawComposites
    .map((c) => c.trim())
    .filter((c) => c.length > 2 && c.replace(/[\s\-]/g, '').length > 0);

  if (composites.some((comp) => comp.includes(normQ) || (normQ.length > 2 && normQ.includes(comp)))) {
    return true;
  }

  // 4. Multi-token (AND) matching: every word token in the query must appear in the track's metadata
  if (tokens.length > 0) {
    const searchableCorpus = `${normTitle} ${normArtist} ${normAlbum} ${normGenre} ${normCrate} ${normalizeSearchString(producer)}`;
    const allTokensMatch = tokens.every((tok) => searchableCorpus.includes(tok));
    if (allTokensMatch) {
      return true;
    }
  }

  return false;
}

/**
 * Computes a relevance score for a track given a search query.
 * Higher score = more relevant match.
 */
export function computeTrackSearchScore(track: Track, query?: string): number {
  if (!track) return 0;
  const qStr = query !== null && query !== undefined ? String(query).trim() : '';
  if (!qStr) return 0;

  const rawQ = qStr.toLowerCase();
  const normQ = normalizeSearchString(qStr);
  if (!normQ) return 0;
  const tokens = extractSearchTokens(qStr);

  const title = String(track.title || '').toLowerCase();
  const artist = String(track.artistName || '').toLowerCase();
  const album = String(track.albumTitle || '').toLowerCase();
  const normTitle = normalizeSearchString(track.title);
  const normArtist = normalizeSearchString(track.artistName);

  let score = 0;

  // Exact matches
  if (title === rawQ || normTitle === normQ) score += 1000;
  if (normArtist && normTitle && (`${normArtist} - ${normTitle}` === normQ || `${normTitle} - ${normArtist}` === normQ)) score += 950;
  if (normArtist && normTitle && (`${normArtist} ${normTitle}` === normQ || `${normTitle} ${normArtist}` === normQ)) score += 900;
  if (artist === rawQ || normArtist === normQ) score += 850;

  // Surname / Single-name artist composite matches (e.g. "Jackson - Human Nature", "Human Nature - Jackson")
  const artistWords = normArtist ? normArtist.split(/\s+/).filter((w) => w.length >= 3) : [];
  for (const word of artistWords) {
    if (
      `${word} - ${normTitle}` === normQ ||
      `${normTitle} - ${word}` === normQ ||
      `${word} ${normTitle}` === normQ ||
      `${normTitle} ${word}` === normQ
    ) {
      score += 850;
      break;
    }
  }

  // Prefix matches
  if (normTitle && normTitle.startsWith(normQ)) score += 600;
  if (normArtist && normArtist.startsWith(normQ)) score += 500;
  if (normArtist && normTitle && `${normArtist} ${normTitle}`.startsWith(normQ)) score += 550;
  if (normTitle && normArtist && `${normTitle} ${normArtist}`.startsWith(normQ)) score += 550;

  // Substring matches
  if (normTitle && normTitle.includes(normQ)) score += 400;
  if (normArtist && normArtist.includes(normQ)) score += 350;
  if (album && album.includes(rawQ)) score += 200;

  // Multi-token matches
  if (tokens.length > 1) {
    const inTitleCount = tokens.filter((tok) => normTitle && normTitle.includes(tok)).length;
    const inArtistCount = tokens.filter((tok) => normArtist && normArtist.includes(tok)).length;
    score += inTitleCount * 60 + inArtistCount * 50;

    // Cross-field bonus: query specifies both artist and song keywords simultaneously
    if (inTitleCount > 0 && inArtistCount > 0) {
      score += 500;
    }
  }

  // Bonus for plays and verified audio
  if (track.audioStatus === 'verified') score += 20;
  if (track.playCount) score += Math.min(30, Math.log10(Number(track.playCount) + 1) * 10);

  return score;
}

/**
 * Filters and ranks tracks based on universal search matching.
 */
export function filterAndRankTracks(tracks: Track[], query?: string): Track[] {
  if (!Array.isArray(tracks)) return [];
  const qStr = query !== null && query !== undefined ? String(query).trim() : '';
  if (!qStr) return tracks;

  const matched = tracks.filter((t) => t && matchesTrackSearch(t, qStr));
  return matched.sort((a, b) => computeTrackSearchScore(b, qStr) - computeTrackSearchScore(a, qStr));
}

/**
 * Generic search matcher for any media or entity (Artist, Video, Audiobook, Product).
 */
export function matchesGenericMediaSearch(
  item: {
    title?: string;
    name?: string;
    artistName?: string;
    author?: string;
    narrator?: string;
    bio?: string;
    description?: string;
    category?: string;
    genre?: string;
    genres?: string[];
  },
  query?: string
): boolean {
  if (!item) return false;
  const qStr = query !== null && query !== undefined ? String(query).trim() : '';
  if (!qStr) return true;

  const normQ = normalizeSearchString(qStr);
  if (!normQ) return true;
  const tokens = extractSearchTokens(qStr);

  const primaryTitle = normalizeSearchString(item.title || item.name || '');
  const creator = normalizeSearchString(item.artistName || item.author || item.narrator || '');
  const genresStr = Array.isArray(item.genres) ? item.genres.join(' ') : '';
  const extra = normalizeSearchString(
    `${item.bio || ''} ${item.description || ''} ${item.category || ''} ${item.genre || ''} ${genresStr}`
  );

  // 1. Direct single-field match
  if (
    (primaryTitle && primaryTitle.includes(normQ)) ||
    (creator && creator.includes(normQ)) ||
    (extra && extra.includes(normQ))
  ) {
    return true;
  }

  // 2. Composite matching
  const comp1 = `${creator} ${primaryTitle}`.trim();
  const comp2 = `${primaryTitle} ${creator}`.trim();
  if ((comp1 && comp1.includes(normQ)) || (comp2 && comp2.includes(normQ))) {
    return true;
  }

  // 3. Multi-token (AND) matching
  if (tokens.length > 0) {
    const corpus = `${primaryTitle} ${creator} ${extra}`;
    if (tokens.every((tok) => corpus.includes(tok))) {
      return true;
    }
  }

  return false;
}

