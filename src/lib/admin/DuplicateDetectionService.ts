import { Track, Audiobook, Video } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { AdminRole } from '@/types/admin';

export type DuplicateMediaType = 'song' | 'audiobook' | 'book' | 'video';

export interface DuplicateItemRecord {
  id: string;
  mediaType: DuplicateMediaType;
  title: string;
  creator: string; // artist / author / director / producer
  albumTitle?: string;
  secondaryText?: string;
  coverUrl?: string;
  mediaUrl: string; // audioUrl, videoUrl, or pdfUrl
  pdfUrl?: string;
  duration?: number;
  playCountOrViews?: number;
  uploadedAt?: string;
  fileDetails?: string;
  isRecommendedKeep: boolean;
  recommendationReason?: string;
  rawItem: Track | Audiobook | Video;
}

export type VariantType =
  | 'remix'
  | 'demo'
  | 'instrumental'
  | 'acapella'
  | 'extended'
  | 'live'
  | 'alternate'
  | 'master_variant';

export interface KeptDuplicateRecord {
  id: string;
  mediaType: DuplicateMediaType;
  title: string;
  creator: string;
  variantType: VariantType;
  reason?: string;
  keptAt: string;
  keptBy?: string;
  albumTitle?: string;
  secondaryText?: string;
  coverUrl?: string;
  mediaUrl: string;
  duration?: number;
  playCountOrViews?: number;
  rawItem?: Track | Audiobook | Video;
}

export interface DuplicateGroup {
  groupId: string;
  mediaType: DuplicateMediaType;
  canonicalTitle: string;
  canonicalCreator: string;
  matchReason: string;
  confidence: 'EXACT' | 'HIGH' | 'ASSET_COLLISION';
  recommendedKeepId: string;
  items: DuplicateItemRecord[];
  detectedAt: string;
}

export interface DuplicateStats {
  totalClusters: number;
  totalDuplicateItems: number;
  songClusters: number;
  audiobookClusters: number;
  bookClusters: number;
  videoClusters: number;
  totalKeptVariants: number;
  cleanScorePercentage: number;
}

/**
 * Detects whether an item represents an authentic variant such as a Remix, Demo,
 * Instrumental, Acapella, Live Recording, Extended Mix, or Alternate Take.
 */
export function detectVariantType(
  title: string,
  secondaryText?: string
): VariantType {
  const text = `${title || ''} ${secondaryText || ''}`.toLowerCase();
  if (text.includes('remix') || text.includes('re-mix') || text.includes('club mix') || text.includes('dance mix') || text.includes('mashup')) return 'remix';
  if (text.includes('demo') || text.includes('home studio') || text.includes('session') || text.includes('vault') || text.includes('unreleased')) return 'demo';
  if (text.includes('instrumental') || text.includes('karaoke') || text.includes('backing track')) return 'instrumental';
  if (text.includes('acapella') || text.includes('a cappella') || text.includes('vocals only')) return 'acapella';
  if (text.includes('live') || text.includes('concert') || text.includes('stage') || text.includes('tour')) return 'live';
  if (text.includes('extended') || text.includes('12"') || text.includes('12 inch') || text.includes('long version') || text.includes('deluxe') || text.includes('expanded')) return 'extended';
  if (text.includes('take') || text.includes('alternate') || text.includes('alt take') || text.includes('radio edit') || text.includes('clean version')) return 'alternate';
  return 'master_variant';
}

/**
 * Returns a human-friendly display label and badge color for a variant type.
 */
export function getVariantTypeBadge(type: VariantType): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  color: string;
} {
  switch (type) {
    case 'remix':
      return {
        label: 'Remix',
        bgClass: 'bg-indigo-500/20',
        textClass: 'text-indigo-300',
        borderClass: 'border-indigo-500/40',
        color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      };
    case 'demo':
      return {
        label: 'Demo Version',
        bgClass: 'bg-amber-500/20',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-500/40',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    case 'instrumental':
      return {
        label: 'Instrumental',
        bgClass: 'bg-emerald-500/20',
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-500/40',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    case 'acapella':
      return {
        label: 'Acapella',
        bgClass: 'bg-purple-500/20',
        textClass: 'text-purple-300',
        borderClass: 'border-purple-500/40',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      };
    case 'extended':
      return {
        label: 'Extended Mix',
        bgClass: 'bg-blue-500/20',
        textClass: 'text-blue-300',
        borderClass: 'border-blue-500/40',
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      };
    case 'live':
      return {
        label: 'Live Cut',
        bgClass: 'bg-rose-500/20',
        textClass: 'text-rose-300',
        borderClass: 'border-rose-500/40',
        color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    case 'alternate':
      return {
        label: 'Alternate Take',
        bgClass: 'bg-cyan-500/20',
        textClass: 'text-cyan-300',
        borderClass: 'border-cyan-500/40',
        color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      };
    case 'master_variant':
    default:
      return {
        label: 'Kept Master Variant',
        bgClass: 'bg-amber-400/20',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-400/40',
        color: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
      };
  }
}

/**
 * Normalizes title for deduplication comparison:
 * Strips leading track numbers (e.g. "01 - ", "TC148_"),
 * redundant artist prefixes, parentheticals, and punctuation.
 */
function normalizeTitle(rawTitle: string, rawCreator?: string): string {
  if (!rawTitle) return '';
  let str = rawTitle.toLowerCase().trim();

  // Strip leading track numbers: e.g. "01 - ", "12. ", "tc148_", "trk_01 "
  str = str.replace(/^(?:track\s*[-_]?\s*|tc\d+[-_]?\s*|\d{1,3}[\s._-]+)+/i, '');

  // Strip creator prefix if embedded: e.g. "vandross - never too much" -> "never too much"
  if (rawCreator) {
    const creatorClean = rawCreator.toLowerCase().trim();
    if (creatorClean && str.startsWith(creatorClean)) {
      str = str.slice(creatorClean.length).replace(/^[\s\-_:]+/, '');
    }
    // Also check creator surname (e.g. "vandross")
    const creatorWords = creatorClean.split(/\s+/);
    if (creatorWords.length > 1) {
      const surname = creatorWords[creatorWords.length - 1];
      if (surname && surname.length > 3 && str.startsWith(surname)) {
        str = str.slice(surname.length).replace(/^[\s\-_:]+/, '');
      }
    }
  }

  // Strip common trailing metadata suffixes
  str = str.replace(
    /\s*[\(\[]\s*(?:official\s*(?:music\s*)?video|official\s*audio|album\s*version|single\s*version|radio\s*edit|remaster(?:ed)?|deluxe|explicit|clean|hd|4k|mp3|promo)\s*[\)\]]/gi,
    ''
  );

  // Strip special characters, collapse whitespace
  str = str.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return str;
}

/**
 * Normalizes creator name (artist / author / director) by removing prefixes,
 * domain tags, leading articles ("The ", "A "), and special characters.
 */
export function cleanCreatorString(rawCreator?: string): string {
  if (!rawCreator) return '';
  let str = rawCreator.toLowerCase().trim();
  str = str.replace(/^(?:by|author|written\s*by|produced\s*by|dir\s*by|directed\s*by)[\s,:]+/i, '');
  str = str.replace(/@\s*chancetek\s*llc/gi, 'chancetek');
  str = str.replace(/@\s*8\s*of\s*spades\s*works/gi, '');
  // Strip leading articles
  str = str.replace(/^(?:the|a|an)\s+/i, '');
  // Collapse punctuation and special chars to spaces
  str = str.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return str;
}

/**
 * Normalizes creator name (backward compatibility alias for cleanCreatorString)
 */
function normalizeCreator(rawCreator: string): string {
  return cleanCreatorString(rawCreator);
}

/**
 * Returns a canonical key for a creator name with words sorted alphabetically.
 * This guarantees that inverted names match identically:
 * - "Fonda Rae" -> words ["fonda", "rae"] -> "fonda rae"
 * - "Rae Fonda" -> words ["fonda", "rae"] -> "fonda rae"
 * - "Jackson, Michael" -> words ["jackson", "michael"] -> "jackson michael"
 * - "Michael Jackson" -> words ["jackson", "michael"] -> "jackson michael"
 */
export function getCanonicalCreatorKey(rawCreator?: string): string {
  const clean = cleanCreatorString(rawCreator);
  if (!clean) return '';
  const words = clean.split(/\s+/).filter(Boolean);
  return words.sort().join(' ');
}

/**
 * Levenshtein edit distance for evaluating fuzzy spelling matches.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Comprehensive creator comparison function supporting:
 * 1. Exact raw or cleaned equality
 * 2. Inverted name order (e.g. "Fonda Rae" vs "Rae Fonda")
 * 3. Primary artist extraction (stripping featuring/collaboration clauses)
 * 4. Substring containment for collaborative or extended titles
 * 5. Minor typo tolerance via Levenshtein distance
 */
export function areCreatorsMatching(c1Raw?: string, c2Raw?: string): boolean {
  if (!c1Raw || !c2Raw) return false;

  const norm1 = cleanCreatorString(c1Raw);
  const norm2 = cleanCreatorString(c2Raw);
  if (!norm1 || !norm2) return false;

  // 1. Direct cleaned match
  if (norm1 === norm2) return true;

  // 2. Canonical word-sorted match (catches inverted names like "Fonda Rae" vs "Rae Fonda")
  const canon1 = getCanonicalCreatorKey(c1Raw);
  const canon2 = getCanonicalCreatorKey(c2Raw);
  if (canon1 && canon2 && canon1 === canon2) return true;

  // 3. Primary artist comparison (strip featuring, ft, with, and, & clauses)
  const stripFeatures = (s: string) => {
    return s.split(/\s+(?:feat\.?|ft\.?|featuring|with|and|&|vs\.?)\s+/i)[0].trim();
  };
  const prim1 = stripFeatures(norm1);
  const prim2 = stripFeatures(norm2);
  if (prim1 && prim2) {
    if (prim1 === prim2) return true;
    const canonPrim1 = getCanonicalCreatorKey(prim1);
    const canonPrim2 = getCanonicalCreatorKey(prim2);
    if (canonPrim1 && canonPrim2 && canonPrim1 === canonPrim2) return true;
  }

  // 4. Substring containment for multi-word artists (e.g. "Maze" in "Maze Featuring Frankie Beverly")
  if (norm1.length >= 4 && norm2.length >= 4) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }
  }

  // 5. Minor typo tolerance via Levenshtein edit distance
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 5) {
    const dist = levenshteinDistance(norm1, norm2);
    if (minLen <= 8 && dist <= 1) return true;
    if (minLen > 8 && dist <= 2) return true;
  }

  return false;
}

/**
 * Extracts a normalized asset key from a URL (ignoring tokens, timestamps, host)
 */
function extractAssetSignature(url?: string): string {
  if (!url) return '';
  try {
    const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase().trim();
    const fileName = cleanUrl.split('/').pop() || cleanUrl;
    // Strip timestamp prefix: e.g. "1793200779829_tc148_"
    return fileName.replace(/^\d{10,15}[_-]/, '').replace(/^tc\d+[-_]/, '');
  } catch {
    return (url || '').toLowerCase().trim();
  }
}

/**
 * Normalizes an album title for identity checking.
 * Returns empty string if the album is a generic single / vault cut / placeholder.
 */
function normalizeAlbumName(rawAlbum?: string): string {
  if (!rawAlbum) return '';
  const lower = rawAlbum.toLowerCase().trim();
  if (
    !lower ||
    lower === 'single' ||
    lower === 'single release' ||
    lower === 'vault cuts' ||
    lower === 'master crate vault' ||
    lower === 'direct music library' ||
    lower === 'general crate' ||
    lower === 'crate vault' ||
    lower === 'collection' ||
    lower.includes('unknown')
  ) {
    return '';
  }
  return lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks whether two tracks are genuine duplicate candidates of each other.
 * Rules:
 * 1. Must share the same creator (handles inverted names, articles, aliases, Levenshtein distance).
 * 2. Must share the same normalized title (or verified title alias/prefix).
 * 3. Cannot belong to two different recognized studio albums (e.g. Off The Wall vs Thriller),
 *    unless one of the albums is a single release matching the track title.
 */
function areTracksDuplicateCandidates(t1: Track, t2: Track): boolean {
  if (t1.id === t2.id) return false;

  // 1. Creator must match (handles "Fonda Rae" vs "Rae Fonda", aliases, features)
  if (!areCreatorsMatching(t1.artistName, t2.artistName)) return false;

  // 2. Title must match (or close title variant)
  const normT1 = normalizeTitle(t1.title, t1.artistName);
  const normT2 = normalizeTitle(t2.title, t2.artistName);
  if (!normT1 || !normT2) return false;
  const titlesMatch = normT1 === normT2 || normT1.startsWith(normT2) || normT2.startsWith(normT1);
  if (!titlesMatch) return false;

  // 3. Album conflict check:
  // If both tracks have recognized non-generic studio album titles,
  // and those albums differ (e.g. "Off The Wall" vs "Thriller"), they CANNOT be duplicates!
  const alb1 = normalizeAlbumName(t1.albumTitle);
  const alb2 = normalizeAlbumName(t2.albumTitle);
  if (alb1 && alb2 && alb1 !== alb2) {
    // Exemption: If one of the album titles equals the track title, it is a single or title-track release
    const isSingle1 = alb1 === normT1;
    const isSingle2 = alb2 === normT2;
    if (!isSingle1 && !isSingle2) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether two videos are genuine duplicate candidates.
 * Must share matching creator and matching normalized title.
 */
function areVideosDuplicateCandidates(v1: Video, v2: Video): boolean {
  if (v1.id === v2.id) return false;
  if (!areCreatorsMatching(v1.artistName, v2.artistName)) return false;

  const normT1 = normalizeTitle(v1.title, v1.artistName);
  const normT2 = normalizeTitle(v2.title, v2.artistName);
  if (!normT1 || !normT2) return false;

  return normT1 === normT2 || normT1.startsWith(normT2) || normT2.startsWith(normT1);
}

/**
 * Checks whether two audiobooks are genuine duplicate candidates.
 * Must share matching author and matching normalized title.
 */
function areAudiobooksDuplicateCandidates(a1: Audiobook, a2: Audiobook): boolean {
  if (a1.id === a2.id) return false;
  if (!areCreatorsMatching(a1.author, a2.author)) return false;

  const normT1 = normalizeTitle(a1.title, a1.author);
  const normT2 = normalizeTitle(a2.title, a2.author);
  if (!normT1 || !normT2) return false;

  return normT1 === normT2 || normT1.startsWith(normT2) || normT2.startsWith(normT1);
}

/**
 * Detects whether an Audiobook record is specifically a PDF Book / Literature
 */
export function isBookItem(ab: Audiobook): boolean {
  if (ab.mediaFormat === 'pdf') return true;
  if (ab.pdfUrl) return true;
  if (ab.chapters && ab.chapters.some((ch) => Boolean(ch.pdfUrl) || (ch.audioUrl && ch.audioUrl.toLowerCase().endsWith('.pdf')))) {
    return true;
  }
  return false;
}

class DuplicateDetectionServiceClass {
  private listeners = new Set<() => void>();
  private isScanning = false;
  private lastScanTime: string = new Date().toISOString();
  private keptDuplicates = new Map<string, KeptDuplicateRecord>();
  private readonly KEPT_STORAGE_KEY = 'spades_kept_duplicates_v2';

  constructor() {
    this.loadKeptDuplicates();
    if (typeof window !== 'undefined') {
      window.addEventListener('catalog-updated', () => this.notify());
      window.addEventListener('media-catalog-updated', () => this.notify());
    }
  }

  private loadKeptDuplicates() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.KEPT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as KeptDuplicateRecord[];
        if (Array.isArray(parsed)) {
          this.keptDuplicates.clear();
          parsed.forEach((item) => {
            if (item && item.id) {
              this.keptDuplicates.set(item.id, item);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[DuplicateDetectionService] Failed to load kept duplicates:', e);
    }
  }

  private saveKeptDuplicates() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.keptDuplicates.values());
      localStorage.setItem(this.KEPT_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[DuplicateDetectionService] Failed to save kept duplicates:', e);
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[DuplicateDetectionService] Listener error:', err);
      }
    });
  }

  /**
   * Scans all Songs, Audiobooks, Books, and Videos across the platform
   * and aggregates duplicate candidate clusters.
   * Excludes any tracks, videos, or literature that the admin explicitly marked to keep
   * as legitimate Remixes, Demos, Extended Cuts, or Alternate Takes.
   */
  public scanAllDuplicates(): DuplicateGroup[] {
    this.isScanning = true;
    this.lastScanTime = new Date().toISOString();

    const groups: DuplicateGroup[] = [];

    try {
      // 1. Scan Songs (exclude any track explicitly marked to keep as remix / demo / variant)
      const tracks = MusicCatalogService.getAllTracks().filter((t) => !this.isItemKept(t.id));
      const songGroups = this.detectTrackDuplicates(tracks);
      groups.push(...songGroups);

      // 2. Scan Audiobooks & Books (exclude kept items)
      const allAudiobooks = MediaCatalogService.getAllAudiobooks().filter((ab) => !this.isItemKept(ab.id));
      const regularAudiobooks = allAudiobooks.filter((ab) => !isBookItem(ab));
      const pdfBooks = allAudiobooks.filter((ab) => isBookItem(ab));

      const audiobookGroups = this.detectAudiobookDuplicates(regularAudiobooks);
      groups.push(...audiobookGroups);

      const bookGroups = this.detectBookDuplicates(pdfBooks);
      groups.push(...bookGroups);

      // 3. Scan Videos (exclude kept items)
      const videos = MediaCatalogService.getAllVideos().filter((v) => !this.isItemKept(v.id));
      const videoGroups = this.detectVideoDuplicates(videos);
      groups.push(...videoGroups);
    } catch (err) {
      console.error('[DuplicateDetectionService] Scan error:', err);
    } finally {
      this.isScanning = false;
    }

    return groups;
  }

  /**
   * Detects duplicate songs in the music catalog
   */
  private detectTrackDuplicates(tracks: Track[]): DuplicateGroup[] {
    const titleCreatorBuckets = new Map<string, Track[]>();
    const titleOnlyBuckets = new Map<string, Track[]>();
    const assetUrlBuckets = new Map<string, Track[]>();

    tracks.forEach((track) => {
      const normT = normalizeTitle(track.title, track.artistName);
      const canonC = getCanonicalCreatorKey(track.artistName);

      // Bucket 1: Normalized Title + Canonical Creator Key (inverted name resilient)
      if (normT && canonC) {
        const key = `t:${normT}:::c:${canonC}`;
        const existing = titleCreatorBuckets.get(key) || [];
        existing.push(track);
        titleCreatorBuckets.set(key, existing);
      }

      // Bucket 2: Title Only (for secondary cross-creator evaluation)
      if (normT) {
        const tKey = `t:${normT}`;
        const existing = titleOnlyBuckets.get(tKey) || [];
        existing.push(track);
        titleOnlyBuckets.set(tKey, existing);
      }

      // Bucket 3: Asset URL signature
      const assetSig = extractAssetSignature(track.audioUrl);
      if (assetSig && assetSig.length > 5 && !assetSig.includes('fort_apache')) {
        const key = `asset:${assetSig}`;
        const existing = assetUrlBuckets.get(key) || [];
        existing.push(track);
        assetUrlBuckets.set(key, existing);
      }
    });

    const groups: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    const createTrackDuplicateGroup = (groupTracks: Track[], fallbackMatchReason: string): void => {
      if (groupTracks.length < 2) return;
      groupTracks.forEach((t) => seenIds.add(t.id));

      // Select recommended item to keep:
      // Priority:
      // 1. Audio status 'verified'
      // 2. Cover verification 'verified'
      // 3. Curated crate vs generic Direct Music Library
      // 4. Archival release year (e.g. 1982) vs current/placeholder year (2026)
      // 5. Higher playCount
      // 6. Seniority (earlier uploadedAt)
      const currentYear = new Date().getFullYear();
      const sorted = [...groupTracks].sort((a, b) => {
        if ((b.audioStatus === 'verified') !== (a.audioStatus === 'verified')) {
          return b.audioStatus === 'verified' ? 1 : -1;
        }
        if ((b.coverVerification === 'verified') !== (a.coverVerification === 'verified')) {
          return b.coverVerification === 'verified' ? 1 : -1;
        }
        const aIsGenericCrate =
          !a.crateName ||
          a.crateName.toLowerCase().includes('direct music library') ||
          a.crateName.toLowerCase().includes('general');
        const bIsGenericCrate =
          !b.crateName ||
          b.crateName.toLowerCase().includes('direct music library') ||
          b.crateName.toLowerCase().includes('general');
        if (aIsGenericCrate !== bIsGenericCrate) {
          return aIsGenericCrate ? 1 : -1;
        }
        const aHasHistoricYear = Boolean(a.releaseYear && a.releaseYear > 1900 && a.releaseYear < currentYear);
        const bHasHistoricYear = Boolean(b.releaseYear && b.releaseYear > 1900 && b.releaseYear < currentYear);
        if (aHasHistoricYear !== bHasHistoricYear) {
          return bHasHistoricYear ? 1 : -1;
        }
        if ((b.playCount || 0) !== (a.playCount || 0)) {
          return (b.playCount || 0) - (a.playCount || 0);
        }
        if (a.uploadedAt && b.uploadedAt && a.uploadedAt !== b.uploadedAt) {
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        }
        return 0;
      });
      const recommended = sorted[0];

      // Detect if there was an inverted artist name match
      const rawCreators = groupTracks.map((t) => cleanCreatorString(t.artistName));
      const hasInvertedOrAlias = rawCreators.some((c) => c !== rawCreators[0]);
      const matchReason = hasInvertedOrAlias
        ? `Identical Title & Inverted / Alias Artist Match (${groupTracks.map((t) => t.artistName).join(' / ')})`
        : fallbackMatchReason;

      const items: DuplicateItemRecord[] = groupTracks.map((t) => ({
        id: t.id,
        mediaType: 'song',
        title: t.title,
        creator: t.artistName,
        albumTitle: t.albumTitle,
        secondaryText: `${t.albumTitle || 'Single'} • ${t.genre || 'Music'} • ${t.crateName || 'General Crate'}${t.releaseYear ? ` • ${t.releaseYear}` : ''}`,
        coverUrl: t.coverUrl || t.albumCoverUrl,
        mediaUrl: t.audioUrl,
        duration: t.duration,
        playCountOrViews: t.playCount || 0,
        uploadedAt: t.uploadedAt,
        fileDetails: t.audioAsset
          ? `Asset: ${(t.audioAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB (${t.audioAsset.storageBackend})`
          : t.audioUrl.startsWith('/audio/')
          ? 'Local Studio Stream'
          : 'Cloud Storage Stream',
        isRecommendedKeep: t.id === recommended.id,
        recommendationReason:
          t.id === recommended.id
            ? t.audioStatus === 'verified'
              ? 'Verified Master Recording'
              : recommended.releaseYear && recommended.releaseYear < currentYear
              ? `Archival Master Release (${recommended.releaseYear})`
              : 'Senior Platform Master Record'
            : 'Duplicate Candidate',
        rawItem: t,
      }));

      groups.push({
        groupId: `grp-song-${groups.length + 1}-${recommended.id}`,
        mediaType: 'song',
        canonicalTitle: recommended.title,
        canonicalCreator: recommended.artistName,
        matchReason,
        confidence: 'EXACT',
        recommendedKeepId: recommended.id,
        items,
        detectedAt: this.lastScanTime,
      });
    };

    // Pass 1: Process Title + Canonical Creator Buckets
    titleCreatorBuckets.forEach((bucketTracks) => {
      if (bucketTracks.length >= 2) {
        const unassigned = bucketTracks.filter((t) => !seenIds.has(t.id));
        if (unassigned.length < 2) return;

        const clusters: Track[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areTracksDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }

        clusters.forEach((groupTracks) => {
          if (groupTracks.length >= 2) {
            createTrackDuplicateGroup(groupTracks, 'Identical Title & Artist Match');
          }
        });
      }
    });

    // Pass 2: Process Title-Only Buckets (catches collaboration clauses, minor typos)
    titleOnlyBuckets.forEach((bucketTracks) => {
      const unassigned = bucketTracks.filter((t) => !seenIds.has(t.id));
      if (unassigned.length >= 2) {
        const clusters: Track[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areTracksDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }

        clusters.forEach((groupTracks) => {
          if (groupTracks.length >= 2) {
            createTrackDuplicateGroup(groupTracks, 'Identical Title & Cross-Alias Artist Match');
          }
        });
      }
    });

    // Pass 3: Process Asset URL duplicates (same underlying audio binary)
    assetUrlBuckets.forEach((bucketTracks) => {
      if (bucketTracks.length >= 2) {
        const unassigned = bucketTracks.filter((t) => !seenIds.has(t.id));
        if (unassigned.length < 2) return;

        const clusters: Track[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areTracksDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }

        clusters.forEach((groupTracks) => {
          if (groupTracks.length >= 2) {
            groupTracks.forEach((t) => seenIds.add(t.id));

            const sorted = [...groupTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
            const recommended = sorted[0];

            const items: DuplicateItemRecord[] = groupTracks.map((t) => ({
              id: t.id,
              mediaType: 'song',
              title: t.title,
              creator: t.artistName,
              albumTitle: t.albumTitle,
              secondaryText: `${t.albumTitle || 'Single'} • Asset Collision`,
              coverUrl: t.coverUrl,
              mediaUrl: t.audioUrl,
              duration: t.duration,
              playCountOrViews: t.playCount || 0,
              uploadedAt: t.uploadedAt,
              fileDetails: `Identical Audio Binary: ${extractAssetSignature(t.audioUrl)}`,
              isRecommendedKeep: t.id === recommended.id,
              recommendationReason: t.id === recommended.id ? 'Primary Track Reference' : 'Duplicate Asset Reference',
              rawItem: t,
            }));

            groups.push({
              groupId: `grp-song-asset-${groups.length + 1}-${recommended.id}`,
              mediaType: 'song',
              canonicalTitle: recommended.title,
              canonicalCreator: recommended.artistName,
              matchReason: 'Identical Audio Binary Asset',
              confidence: 'ASSET_COLLISION',
              recommendedKeepId: recommended.id,
              items,
              detectedAt: this.lastScanTime,
            });
          }
        });
      }
    });

    return groups;
  }

  /**
   * Detects duplicate audiobooks in the catalog
   */
  private detectAudiobookDuplicates(audiobooks: Audiobook[]): DuplicateGroup[] {
    const buckets = new Map<string, Audiobook[]>();
    const titleOnlyBuckets = new Map<string, Audiobook[]>();

    audiobooks.forEach((ab) => {
      const normT = normalizeTitle(ab.title, ab.author);
      const canonC = getCanonicalCreatorKey(ab.author);
      if (normT && canonC) {
        const key = `t:${normT}:::c:${canonC}`;
        const existing = buckets.get(key) || [];
        existing.push(ab);
        buckets.set(key, existing);
      }
      if (normT) {
        const tKey = `t:${normT}`;
        const existing = titleOnlyBuckets.get(tKey) || [];
        existing.push(ab);
        titleOnlyBuckets.set(tKey, existing);
      }
    });

    const groups: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    const createAudiobookGroup = (bucketItems: Audiobook[], matchReason: string) => {
      if (bucketItems.length < 2) return;
      bucketItems.forEach((ab) => seenIds.add(ab.id));

      const sorted = [...bucketItems].sort((a, b) => {
        return (b.chapters?.length || 0) - (a.chapters?.length || 0);
      });
      const recommended = sorted[0];

      const rawCreators = bucketItems.map((ab) => cleanCreatorString(ab.author));
      const hasInverted = rawCreators.some((c) => c !== rawCreators[0]);
      const finalMatchReason = hasInverted
        ? `Identical Spoken Title & Inverted Author (${bucketItems.map((ab) => ab.author).join(' / ')})`
        : matchReason;

      const items: DuplicateItemRecord[] = bucketItems.map((ab) => {
        const primaryAudioUrl = ab.chapters?.[0]?.audioUrl || (ab as any).audioUrl || '';
        return {
          id: ab.id,
          mediaType: 'audiobook',
          title: ab.title,
          creator: ab.author,
          secondaryText: `Narrated by ${ab.narrator || 'Author'} • ${ab.chapters?.length || 0} Chapters`,
          coverUrl: ab.coverUrl,
          mediaUrl: primaryAudioUrl,
          duration: ab.duration,
          playCountOrViews: ab.likeCount || 0,
          fileDetails: `${ab.chapters?.length || 0} Chapters • Duration: ${Math.round((ab.duration || 0) / 60)} min`,
          isRecommendedKeep: ab.id === recommended.id,
          recommendationReason: ab.id === recommended.id ? 'Most Complete Chapters' : 'Duplicate Candidate',
          rawItem: ab,
        };
      });

      groups.push({
        groupId: `grp-audiobook-${groups.length + 1}-${recommended.id}`,
        mediaType: 'audiobook',
        canonicalTitle: recommended.title,
        canonicalCreator: recommended.author,
        matchReason: finalMatchReason,
        confidence: 'EXACT',
        recommendedKeepId: recommended.id,
        items,
        detectedAt: this.lastScanTime,
      });
    };

    // Pass 1: Canonical Author
    buckets.forEach((bucketItems) => {
      const unassigned = bucketItems.filter((ab) => !seenIds.has(ab.id));
      if (unassigned.length >= 2) {
        createAudiobookGroup(unassigned, 'Identical Spoken Title & Author');
      }
    });

    // Pass 2: Title-Only Author Comparison
    titleOnlyBuckets.forEach((bucketItems) => {
      const unassigned = bucketItems.filter((ab) => !seenIds.has(ab.id));
      if (unassigned.length >= 2) {
        const clusters: Audiobook[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areAudiobooksDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }
        clusters.forEach((cluster) => {
          if (cluster.length >= 2) {
            createAudiobookGroup(cluster, 'Identical Spoken Title & Author Match');
          }
        });
      }
    });

    return groups;
  }

  /**
   * Detects duplicate books (PDF literature) in the catalog
   */
  private detectBookDuplicates(books: Audiobook[]): DuplicateGroup[] {
    const buckets = new Map<string, Audiobook[]>();
    const titleOnlyBuckets = new Map<string, Audiobook[]>();

    books.forEach((b) => {
      const normT = normalizeTitle(b.title, b.author);
      const canonC = getCanonicalCreatorKey(b.author);
      if (normT && canonC) {
        const key = `t:${normT}:::c:${canonC}`;
        const existing = buckets.get(key) || [];
        existing.push(b);
        buckets.set(key, existing);
      }
      if (normT) {
        const tKey = `t:${normT}`;
        const existing = titleOnlyBuckets.get(tKey) || [];
        existing.push(b);
        titleOnlyBuckets.set(tKey, existing);
      }
    });

    const groups: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    const createBookGroup = (bucketItems: Audiobook[], matchReason: string) => {
      if (bucketItems.length < 2) return;
      bucketItems.forEach((b) => seenIds.add(b.id));

      const sorted = [...bucketItems].sort((a, b) => {
        const aHasPdf = Boolean(a.pdfUrl);
        const bHasPdf = Boolean(b.pdfUrl);
        if (aHasPdf !== bHasPdf) return bHasPdf ? 1 : -1;
        return (b.likeCount || 0) - (a.likeCount || 0);
      });
      const recommended = sorted[0];

      const rawCreators = bucketItems.map((b) => cleanCreatorString(b.author));
      const hasInverted = rawCreators.some((c) => c !== rawCreators[0]);
      const finalMatchReason = hasInverted
        ? `Identical Book Title & Inverted Author (${bucketItems.map((b) => b.author).join(' / ')})`
        : matchReason;

      const items: DuplicateItemRecord[] = bucketItems.map((b) => {
        const pdfPath = b.pdfUrl || b.chapters?.[0]?.pdfUrl || b.chapters?.[0]?.audioUrl || '';
        return {
          id: b.id,
          mediaType: 'book',
          title: b.title,
          creator: b.author,
          secondaryText: `Literature • Format: PDF Book`,
          coverUrl: b.coverUrl,
          mediaUrl: pdfPath,
          pdfUrl: pdfPath,
          duration: 0,
          playCountOrViews: b.likeCount || 0,
          fileDetails: `PDF Source: ${pdfPath.split('/').pop() || 'document.pdf'}`,
          isRecommendedKeep: b.id === recommended.id,
          recommendationReason: b.id === recommended.id ? 'Primary Verified PDF Master' : 'Duplicate Candidate',
          rawItem: b,
        };
      });

      groups.push({
        groupId: `grp-book-${groups.length + 1}-${recommended.id}`,
        mediaType: 'book',
        canonicalTitle: recommended.title,
        canonicalCreator: recommended.author,
        matchReason: finalMatchReason,
        confidence: 'EXACT',
        recommendedKeepId: recommended.id,
        items,
        detectedAt: this.lastScanTime,
      });
    };

    // Pass 1: Canonical author
    buckets.forEach((bucketItems) => {
      const unassigned = bucketItems.filter((b) => !seenIds.has(b.id));
      if (unassigned.length >= 2) {
        createBookGroup(unassigned, 'Identical Book Title & Author');
      }
    });

    // Pass 2: Title-Only author comparison
    titleOnlyBuckets.forEach((bucketItems) => {
      const unassigned = bucketItems.filter((b) => !seenIds.has(b.id));
      if (unassigned.length >= 2) {
        const clusters: Audiobook[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areAudiobooksDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }
        clusters.forEach((cluster) => {
          if (cluster.length >= 2) {
            createBookGroup(cluster, 'Identical Book Title & Author Match');
          }
        });
      }
    });

    return groups;
  }

  /**
   * Detects duplicate videos in the catalog
   */
  private detectVideoDuplicates(videos: Video[]): DuplicateGroup[] {
    const titleCreatorBuckets = new Map<string, Video[]>();
    const titleOnlyBuckets = new Map<string, Video[]>();
    const assetBuckets = new Map<string, Video[]>();

    videos.forEach((v) => {
      const normT = normalizeTitle(v.title, v.artistName);
      const canonC = getCanonicalCreatorKey(v.artistName);
      if (normT && canonC) {
        const key = `t:${normT}:::c:${canonC}`;
        const existing = titleCreatorBuckets.get(key) || [];
        existing.push(v);
        titleCreatorBuckets.set(key, existing);
      }
      if (normT) {
        const tKey = `t:${normT}`;
        const existing = titleOnlyBuckets.get(tKey) || [];
        existing.push(v);
        titleOnlyBuckets.set(tKey, existing);
      }

      const assetSig = extractAssetSignature(v.videoUrl);
      if (assetSig && assetSig.length > 5) {
        const key = `asset:${assetSig}`;
        const existing = assetBuckets.get(key) || [];
        existing.push(v);
        assetBuckets.set(key, existing);
      }
    });

    const groups: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    const createVideoGroup = (groupVideos: Video[], matchReason: string) => {
      if (groupVideos.length < 2) return;
      groupVideos.forEach((v) => seenIds.add(v.id));

      const sorted = [...groupVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
      const recommended = sorted[0];

      const rawCreators = groupVideos.map((v) => cleanCreatorString(v.artistName));
      const hasInverted = rawCreators.some((c) => c !== rawCreators[0]);
      const finalMatchReason = hasInverted
        ? `Identical Video Title & Inverted Creator (${groupVideos.map((v) => v.artistName).join(' / ')})`
        : matchReason;

      const items: DuplicateItemRecord[] = groupVideos.map((v) => ({
        id: v.id,
        mediaType: 'video',
        title: v.title,
        creator: v.artistName,
        secondaryText: `${v.category || '4K Cinema'} • ${v.duration}s`,
        coverUrl: v.thumbnailUrl,
        mediaUrl: v.videoUrl,
        duration: v.duration,
        playCountOrViews: v.views || 0,
        fileDetails: `Video Asset: ${extractAssetSignature(v.videoUrl)}`,
        isRecommendedKeep: v.id === recommended.id,
        recommendationReason: v.id === recommended.id ? 'Highest Viewer Count' : 'Duplicate Candidate',
        rawItem: v,
      }));

      groups.push({
        groupId: `grp-video-${groups.length + 1}-${recommended.id}`,
        mediaType: 'video',
        canonicalTitle: recommended.title,
        canonicalCreator: recommended.artistName,
        matchReason: finalMatchReason,
        confidence: 'EXACT',
        recommendedKeepId: recommended.id,
        items,
        detectedAt: this.lastScanTime,
      });
    };

    // Pass 1: Canonical creator
    titleCreatorBuckets.forEach((bucketVideos) => {
      if (bucketVideos.length >= 2) {
        const unassigned = bucketVideos.filter((v) => !seenIds.has(v.id));
        if (unassigned.length < 2) return;

        const clusters: Video[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areVideosDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }

        clusters.forEach((groupVideos) => {
          if (groupVideos.length >= 2) {
            createVideoGroup(groupVideos, 'Identical Video Title & Creator');
          }
        });
      }
    });

    // Pass 2: Title-Only comparison
    titleOnlyBuckets.forEach((bucketVideos) => {
      const unassigned = bucketVideos.filter((v) => !seenIds.has(v.id));
      if (unassigned.length >= 2) {
        const clusters: Video[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areVideosDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }
        clusters.forEach((groupVideos) => {
          if (groupVideos.length >= 2) {
            createVideoGroup(groupVideos, 'Identical Video Title & Creator Match');
          }
        });
      }
    });

    // Pass 3: Asset collisions
    assetBuckets.forEach((bucketVideos) => {
      if (bucketVideos.length >= 2) {
        const unassigned = bucketVideos.filter((v) => !seenIds.has(v.id));
        if (unassigned.length < 2) return;

        const clusters: Video[][] = [];
        for (const candidate of unassigned) {
          let placed = false;
          for (const cluster of clusters) {
            if (areVideosDuplicateCandidates(cluster[0], candidate)) {
              cluster.push(candidate);
              placed = true;
              break;
            }
          }
          if (!placed) {
            clusters.push([candidate]);
          }
        }

        clusters.forEach((groupVideos) => {
          if (groupVideos.length >= 2) {
            groupVideos.forEach((v) => seenIds.add(v.id));

            const sorted = [...groupVideos].sort((a, b) => (b.views || 0) - (a.views || 0));
            const recommended = sorted[0];

            const items: DuplicateItemRecord[] = groupVideos.map((v) => ({
              id: v.id,
              mediaType: 'video',
              title: v.title,
              creator: v.artistName,
              secondaryText: `Asset Collision • ${v.category}`,
              coverUrl: v.thumbnailUrl,
              mediaUrl: v.videoUrl,
              duration: v.duration,
              playCountOrViews: v.views || 0,
              fileDetails: `Identical Video Binary: ${extractAssetSignature(v.videoUrl)}`,
              isRecommendedKeep: v.id === recommended.id,
              recommendationReason: v.id === recommended.id ? 'Primary Video Reference' : 'Duplicate Video Reference',
              rawItem: v,
            }));

            groups.push({
              groupId: `grp-video-asset-${groups.length + 1}-${recommended.id}`,
              mediaType: 'video',
              canonicalTitle: recommended.title,
              canonicalCreator: recommended.artistName,
              matchReason: 'Identical Video File Asset',
              confidence: 'ASSET_COLLISION',
              recommendedKeepId: recommended.id,
              items,
              detectedAt: this.lastScanTime,
            });
          }
        });
      }
    });

    return groups;
  }

  /**
   * Returns filtered duplicate groups
   */
  public getDuplicateGroups(filter: 'all' | 'song' | 'audiobook' | 'book' | 'video' = 'all'): DuplicateGroup[] {
    const all = this.scanAllDuplicates();
    if (filter === 'all') return all;
    return all.filter((g) => g.mediaType === filter);
  }

  /**
   * Returns live catalog deduplication stats
   */
  public getStats(): DuplicateStats {
    const groups = this.scanAllDuplicates();
    let totalItems = 0;
    let songs = 0;
    let audiobooks = 0;
    let books = 0;
    let videos = 0;

    groups.forEach((g) => {
      totalItems += g.items.length;
      if (g.mediaType === 'song') songs++;
      else if (g.mediaType === 'audiobook') audiobooks++;
      else if (g.mediaType === 'book') books++;
      else if (g.mediaType === 'video') videos++;
    });

    const totalCatalogItems =
      MusicCatalogService.getAllTracks().length +
      MediaCatalogService.getAllAudiobooks().length +
      MediaCatalogService.getAllVideos().length;

    const redundantCount = Math.max(0, totalItems - groups.length);
    const cleanScore = totalCatalogItems > 0 ? Math.max(0, Math.round(((totalCatalogItems - redundantCount) / totalCatalogItems) * 100)) : 100;

    return {
      totalClusters: groups.length,
      totalDuplicateItems: totalItems,
      songClusters: songs,
      audiobookClusters: audiobooks,
      bookClusters: books,
      videoClusters: videos,
      totalKeptVariants: this.keptDuplicates.size,
      cleanScorePercentage: cleanScore,
    };
  }

  /**
   * Checks whether a specific media item is marked as a Kept Variant (Remix / Demo / etc.)
   */
  public isItemKept(id: string): boolean {
    return this.keptDuplicates.has(id);
  }

  /**
   * Returns all items currently kept as legitimate variants (remixes, demos, extended cuts, etc.)
   */
  public getKeptDuplicates(): KeptDuplicateRecord[] {
    return Array.from(this.keptDuplicates.values());
  }

  /**
   * Returns a specific kept duplicate record by ID
   */
  public getKeptItem(id: string): KeptDuplicateRecord | undefined {
    return this.keptDuplicates.get(id);
  }

  /**
   * Explicitly marks a duplicate candidate to be KEPT on the platform as an authentic
   * Remix, Demo, Extended Mix, Instrumental, Live Cut, or Master Variant.
   * This immediately removes it from the duplicate candidate list while protecting it from deletion.
   */
  public keepDuplicateItem(
    item: DuplicateItemRecord,
    variantType?: VariantType,
    adminActor?: { id: string; name: string; email: string; role: AdminRole },
    reason?: string
  ): boolean {
    try {
      const vType = variantType || detectVariantType(item.title, item.secondaryText);
      const defaultReason =
        reason ||
        `Retained authentic ${vType} version "${item.title}" on platform catalog`;

      const record: KeptDuplicateRecord = {
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        creator: item.creator,
        variantType: vType,
        reason: defaultReason,
        keptAt: new Date().toISOString(),
        keptBy: adminActor?.name || adminActor?.email || 'Platform Administrator',
        albumTitle: item.albumTitle,
        secondaryText: item.secondaryText,
        coverUrl: item.coverUrl,
        mediaUrl: item.mediaUrl,
        duration: item.duration,
        playCountOrViews: item.playCountOrViews,
        rawItem: item.rawItem,
      };

      this.keptDuplicates.set(item.id, record);
      this.saveKeptDuplicates();

      AuditLogger.logAction({
        adminId: adminActor?.id || 'usr-admin',
        adminName: adminActor?.name || 'Platform Administrator',
        adminRole: adminActor?.role || 'admin',
        eventType: 'CATALOG_DEDUPLICATION',
        action: `Kept duplicate ${item.mediaType} "${item.title}" (${item.id}) as authentic ${vType}`,
        resource: `${item.mediaType.toUpperCase()} Catalog`,
        resourceId: item.id,
        previousValue: {
          title: item.title,
          status: 'DUPLICATE_FLAGGED',
        },
        newValue: {
          status: 'KEPT_AUTHENTIC_VARIANT',
          variantType: vType,
          reason: defaultReason,
          keptAt: record.keptAt,
        },
        status: 'SUCCESS',
      });

      this.notify();
      return true;
    } catch (err) {
      console.error('[DuplicateDetectionService] Failed to keep duplicate item:', err);
      return false;
    }
  }

  /**
   * Marks multiple selected duplicate items to be kept simultaneously
   */
  public keepSelectedDuplicateItems(
    items: DuplicateItemRecord[],
    adminActor?: { id: string; name: string; email: string; role: AdminRole },
    reason?: string
  ): { keptCount: number } {
    let count = 0;
    for (const item of items) {
      if (this.keepDuplicateItem(item, undefined, adminActor, reason)) {
        count++;
      }
    }
    this.notify();
    return { keptCount: count };
  }

  /**
   * Marks all items in a cluster to be kept as legitimate master variants, remixes, or demos.
   */
  public keepClusterDuplicates(
    group: DuplicateGroup,
    adminActor?: { id: string; name: string; email: string; role: AdminRole }
  ): { keptCount: number } {
    return this.keepSelectedDuplicateItems(
      group.items,
      adminActor,
      `Kept all ${group.items.length} items in cluster "${group.canonicalTitle}" as authentic master variants, remixes, and demos`
    );
  }

  /**
   * Unmarks a previously kept duplicate item, returning it to active candidate scanning if still duplicate.
   */
  public unkeepDuplicateItem(
    itemId: string,
    adminActor?: { id: string; name: string; email: string; role: AdminRole }
  ): boolean {
    const existing = this.keptDuplicates.get(itemId);
    if (!existing) return false;

    this.keptDuplicates.delete(itemId);
    this.saveKeptDuplicates();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || 'Platform Administrator',
      adminRole: adminActor?.role || 'admin',
      eventType: 'CATALOG_DEDUPLICATION',
      action: `Unmarked kept duplicate ${existing.mediaType} "${existing.title}" (${itemId}) - returned to candidate scan`,
      resource: 'Duplicate Detection',
      resourceId: itemId,
      status: 'SUCCESS',
    });

    this.notify();
    return true;
  }

  /**
   * Clears all kept duplicate exemptions, restoring full candidate scan.
   */
  public clearAllKeptDuplicates(
    adminActor?: { id: string; name: string; email: string; role: AdminRole }
  ): void {
    const total = this.keptDuplicates.size;
    this.keptDuplicates.clear();
    this.saveKeptDuplicates();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || 'Platform Administrator',
      adminRole: adminActor?.role || 'admin',
      eventType: 'CATALOG_DEDUPLICATION',
      action: `Reset and cleared all ${total} kept duplicate variant exemptions`,
      resource: 'Duplicate Detection',
      status: 'SUCCESS',
    });

    this.notify();
  }

  /**
   * Deletes a single duplicate item in real time across services.
   * Uses exactIdOnly: true so the primary master record with matching title/artist remains intact!
   */
  public deleteDuplicateItem(
    item: DuplicateItemRecord,
    adminActor: { id: string; name: string; email: string; role: AdminRole },
    reason: string = 'Catalog deduplication: removed redundant duplicate item'
  ): boolean {
    try {
      if (item.mediaType === 'song') {
        MusicCatalogService.removeTrack(item.id, adminActor, reason, { exactIdOnly: true });
      } else if (item.mediaType === 'audiobook' || item.mediaType === 'book') {
        MediaCatalogService.removeAudiobook(item.id, adminActor, reason, { exactIdOnly: true });
      } else if (item.mediaType === 'video') {
        MediaCatalogService.removeVideo(item.id, adminActor, reason, { exactIdOnly: true });
      }

      AuditLogger.logAction({
        adminId: adminActor.id || 'usr-admin',
        adminName: adminActor.name || 'Platform Administrator',
        adminRole: adminActor.role || 'admin',
        eventType: 'CATALOG_DEDUPLICATION',
        action: `Deleted duplicate ${item.mediaType} "${item.title}" (${item.id})`,
        resource: `${item.mediaType.toUpperCase()} Catalog`,
        resourceId: item.id,
        previousValue: {
          title: item.title,
          creator: item.creator,
          mediaUrl: item.mediaUrl,
        },
        newValue: {
          status: 'DELETED_DUPLICATE',
          deletedAt: new Date().toISOString(),
          reason,
        },
        status: 'SUCCESS',
      });

      this.notify();
      return true;
    } catch (err) {
      console.error('[DuplicateDetectionService] Deletion error:', err);
      return false;
    }
  }

  /**
   * Retains the specified item in the group and deletes all other duplicate copies in real time
   */
  public keepItemAndDeleteOthers(
    group: DuplicateGroup,
    keepItemId: string,
    adminActor: { id: string; name: string; email: string; role: AdminRole }
  ): { deletedCount: number } {
    let count = 0;
    for (const item of group.items) {
      if (item.id !== keepItemId) {
        const ok = this.deleteDuplicateItem(
          item,
          adminActor,
          `Catalog deduplication: retained primary record ${keepItemId} and purged redundant duplicate copy ${item.id}`
        );
        if (ok) count++;
      }
    }
    this.notify();
    return { deletedCount: count };
  }

  /**
   * Batch deletes multiple selected duplicate items in real time across the platform
   */
  public batchDeleteDuplicateItems(
    items: DuplicateItemRecord[],
    adminActor: { id: string; name: string; email: string; role: AdminRole },
    reason: string = 'Batch catalog deduplication: purged redundant duplicate items'
  ): { deletedCount: number; failedCount: number } {
    let deletedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      const ok = this.deleteDuplicateItem(
        item,
        adminActor,
        reason || `Batch catalog deduplication: purged redundant duplicate ${item.mediaType} "${item.title}" (${item.id})`
      );
      if (ok) {
        deletedCount++;
      } else {
        failedCount++;
      }
    }

    if (deletedCount > 0) {
      AuditLogger.logAction({
        adminId: adminActor.id || 'usr-admin',
        adminName: adminActor.name || 'Platform Administrator',
        adminRole: adminActor.role || 'admin',
        eventType: 'CATALOG_DEDUPLICATION_BATCH',
        action: `Batch deleted ${deletedCount} duplicate items in real time`,
        resource: 'Catalog Deduplication',
        status: 'SUCCESS',
        newValue: {
          totalDeleted: deletedCount,
          totalFailed: failedCount,
          deletedItems: items.map((i) => ({ id: i.id, title: i.title, type: i.mediaType })),
        },
      });
    }

    this.notify();
    return { deletedCount, failedCount };
  }

  /**
   * Selects and deletes ALL duplicate song copies across all song clusters at one time,
   * retaining the primary/recommended master copy of each song.
   */
  public deleteAllDuplicateSongs(
    adminActor: { id: string; name: string; email: string; role: AdminRole }
  ): { deletedCount: number; totalDeleted: number } {
    const groups = this.scanAllDuplicates();
    const songGroups = groups.filter((g) => g.mediaType === 'song');

    const duplicateSongsToDelete: DuplicateItemRecord[] = [];
    songGroups.forEach((g) => {
      g.items.forEach((item) => {
        // Collect every copy that is not marked as recommended keep (or not the recommendedKeepId)
        if (!item.isRecommendedKeep || item.id !== g.recommendedKeepId) {
          duplicateSongsToDelete.push(item);
        }
      });
    });

    if (duplicateSongsToDelete.length === 0) {
      return { deletedCount: 0, totalDeleted: 0 };
    }

    const res = this.batchDeleteDuplicateItems(
      duplicateSongsToDelete,
      adminActor,
      `Purged all ${duplicateSongsToDelete.length} duplicate songs in real time (retained primary masters)`
    );

    return { deletedCount: res.deletedCount, totalDeleted: duplicateSongsToDelete.length };
  }
}

export const DuplicateDetectionService = new DuplicateDetectionServiceClass();

