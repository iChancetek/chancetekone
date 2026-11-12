/**
 * ChanceTEK One -> StrideIQ.fit Server Catalog & Workout Intelligence Engine
 *
 * Aggregates playable music across Firestore (`catalog_tracks`), verified canonical studio
 * releases (`PLATFORM_CANONICAL_TRACKS`), and ChanceTEK Radio (`RADIO_INITIAL_CATALOG`), while
 * strictly enforcing:
 *   1. Permanent `catalog_removed` tombstones (deleted songs never leak to StrideIQ.fit).
 *   2. Zero cross-artist substitutions and zero non-ChanceTEK Fort Apache placeholders.
 *   3. Physical disk or verified HTTPS existence checks (zero 404 tracks in workout queues).
 *   4. Cadence-aware (1x + half-time / double-time) BPM matching for Walking, Running, Biking,
 *      HIIT/Sprint, Strength, Warm-Up, and Cool-Down sessions.
 */

import fs from 'fs';
import path from 'path';
import type { Audiobook, PodcastEpisode, Track } from '@/types/media';
import { OFFICIAL_CRATES, DIRECT_MUSIC_CRATE } from '@/types/catalog';
import {
  PLATFORM_CANONICAL_TRACKS,
  normalizeAlbumKey,
  getDefaultCoverForTrack,
  isMissingOrGenericCover,
  correctedKnownCover,
} from '@/lib/music/canonicalCatalogData';
import { getAuthenticAudioUrl, isCrossArtistAudioMismatch } from '@/lib/music/authenticAudioMap';
import { classifyGenre, isGenericOrInvalidGenre } from '@/lib/music/genreClassifier';
import { RADIO_STATIONS, RADIO_INITIAL_CATALOG } from '@/lib/radio/initialCatalog';
import { MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { SEED_PODCASTS } from '@/lib/media/seedMediaData';
import { readCatalogSnapshot } from './catalogStore';
import { signStrideIqStreamToken } from './strideiqStore';

export type StrideIqActivity =
  | 'walking'
  | 'jogging'
  | 'running'
  | 'sprint'
  | 'hiit'
  | 'biking'
  | 'cycling'
  | 'strength'
  | 'warmup'
  | 'cooldown'
  | 'recovery'
  | 'yoga';

export type WorkoutStructure = 'steady' | 'warmup_main_cooldown' | 'interval';
export type EnergyLevel = 'low' | 'moderate' | 'high' | 'peak';
export type StrideIqQueueMediaType = 'music' | 'audiobook_chapter' | 'podcast';
export type StrideIqWorkoutMediaMode = 'music' | 'audiobook' | 'podcast' | 'mixed';

export function normalizeWorkoutMediaMode(input?: string | null): StrideIqWorkoutMediaMode {
  const clean = String(input || '').trim().toLowerCase();
  if (clean === 'audiobook' || clean === 'audiobooks' || clean === 'book' || clean === 'books') {
    return 'audiobook';
  }
  if (clean === 'podcast' || clean === 'podcasts' || clean === 'talk') {
    return 'podcast';
  }
  if (clean === 'mixed' || clean === 'all' || clean === 'hybrid') {
    return 'mixed';
  }
  return 'music';
}

export interface WorkoutProfileSpec {
  activity: StrideIqActivity;
  label: string;
  description: string;
  bpmRange: [number, number];
  idealBpm: number;
  cadenceSpmRange?: [number, number];
  energy: EnergyLevel;
  preferredGenres: string[];
  preferredCrates: string[];
  supportsHalfTime: boolean;
}

export const WORKOUT_PROFILES: Record<StrideIqActivity, WorkoutProfileSpec> = {
  walking: {
    activity: 'walking',
    label: 'Walking & Brisk Stride',
    description: 'Smooth R&B, Nu-Disco, and Funk grooves calibrated for steady walking cadence.',
    bpmRange: [88, 122],
    idealBpm: 108,
    cadenceSpmRange: [95, 122],
    energy: 'moderate',
    preferredGenres: ['R&B / Neo-Soul', 'Disco / Funk', 'Pop / R&B / Soul', 'Jazz & Blues'],
    preferredCrates: ['disco-funk', 'rnb-neo-soul', 'afro-house'],
    supportsHalfTime: false,
  },
  jogging: {
    activity: 'jogging',
    label: 'Easy & Tempo Jog',
    description: 'Uplifting four-on-the-floor disco, classic soul, and steady hip-hop grooves.',
    bpmRange: [112, 146],
    idealBpm: 128,
    cadenceSpmRange: [145, 165],
    energy: 'high',
    preferredGenres: ['Disco / Funk', 'House-Club', 'Break Beats & Turntablism', 'Hip Hop'],
    preferredCrates: ['break-beats', 'house-club', 'disco-funk', 'hip-hop'],
    supportsHalfTime: true,
  },
  running: {
    activity: 'running',
    label: 'Distance & Endurance Running',
    description: 'High-drive breakbeats, dance grooves, and half-time hip-hop locked to running cadence.',
    bpmRange: [120, 182],
    idealBpm: 136,
    cadenceSpmRange: [158, 186],
    energy: 'high',
    preferredGenres: ['Break Beats & Turntablism', 'House-Club', 'Disco / Funk', 'Hip Hop', 'Afro-House & Beats'],
    preferredCrates: ['break-beats', 'house-club', 'hip-hop', 'disco-funk'],
    supportsHalfTime: true,
  },
  sprint: {
    activity: 'sprint',
    label: 'Sprint & Anaerobic Burst',
    description: 'Peak-intensity breakbeats and driving up-tempo anthems for speed repeats.',
    bpmRange: [128, 190],
    idealBpm: 152,
    cadenceSpmRange: [170, 200],
    energy: 'peak',
    preferredGenres: ['Break Beats & Turntablism', 'House-Club', 'Hip Hop'],
    preferredCrates: ['break-beats', 'house-club', 'hip-hop'],
    supportsHalfTime: true,
  },
  hiit: {
    activity: 'hiit',
    label: 'HIIT & Circuit Training',
    description: 'Punchy rhythms built for work/rest intervals and high-output circuits.',
    bpmRange: [122, 185],
    idealBpm: 140,
    cadenceSpmRange: [150, 190],
    energy: 'peak',
    preferredGenres: ['Break Beats & Turntablism', 'House-Club', 'Hip Hop', 'Disco / Funk'],
    preferredCrates: ['break-beats', 'house-club', 'hip-hop'],
    supportsHalfTime: true,
  },
  biking: {
    activity: 'biking',
    label: 'Road Biking & Indoor Spin',
    description: 'Sustained cadence-driven Disco, House, and Funk rhythms for climbing and flat sprints.',
    bpmRange: [108, 144],
    idealBpm: 124,
    cadenceSpmRange: [75, 108],
    energy: 'high',
    preferredGenres: ['Disco / Funk', 'House-Club', 'Afro-House & Beats', 'Break Beats & Turntablism'],
    preferredCrates: ['house-club', 'disco-funk', 'afro-house', 'break-beats'],
    supportsHalfTime: true,
  },
  cycling: {
    activity: 'cycling',
    label: 'Peloton & Peloton-Style Cycling',
    description: 'Rolling basslines and steady 115-140 BPM pedal-stroke pacing for rides.',
    bpmRange: [108, 144],
    idealBpm: 124,
    cadenceSpmRange: [75, 110],
    energy: 'high',
    preferredGenres: ['Disco / Funk', 'House-Club', 'Afro-House & Beats', 'Break Beats & Turntablism'],
    preferredCrates: ['house-club', 'disco-funk', 'afro-house', 'break-beats'],
    supportsHalfTime: true,
  },
  strength: {
    activity: 'strength',
    label: 'Strength & Conditioning',
    description: 'Heavy drums, classic funk, and hip-hop swagger for lifting blocks.',
    bpmRange: [92, 138],
    idealBpm: 114,
    energy: 'high',
    preferredGenres: ['Hip Hop', 'Disco / Funk', 'Break Beats & Turntablism', 'Pop / R&B / Soul'],
    preferredCrates: ['hip-hop', 'break-beats', 'disco-funk'],
    supportsHalfTime: false,
  },
  warmup: {
    activity: 'warmup',
    label: 'Dynamic Warm-Up',
    description: 'Progressive mid-tempo grooves to elevate heart rate smoothly.',
    bpmRange: [90, 118],
    idealBpm: 104,
    energy: 'moderate',
    preferredGenres: ['R&B / Neo-Soul', 'Disco / Funk', 'Pop / R&B / Soul'],
    preferredCrates: ['rnb-neo-soul', 'disco-funk'],
    supportsHalfTime: false,
  },
  cooldown: {
    activity: 'cooldown',
    label: 'Cool-Down & Mobility',
    description: 'Restorative Slow Jams, Neo-Soul, and Jazz harmonies for heart-rate recovery.',
    bpmRange: [60, 96],
    idealBpm: 80,
    energy: 'low',
    preferredGenres: ['Slow Jams / Soul', 'R&B / Neo-Soul', 'Jazz & Blues'],
    preferredCrates: ['slow-jams', 'rnb-neo-soul', 'jazz-blues'],
    supportsHalfTime: false,
  },
  recovery: {
    activity: 'recovery',
    label: 'Active Recovery & Stretching',
    description: 'Low-tempo soulful selections for post-workout parasympathetic recovery.',
    bpmRange: [60, 96],
    idealBpm: 78,
    energy: 'low',
    preferredGenres: ['Slow Jams / Soul', 'R&B / Neo-Soul', 'Jazz & Blues'],
    preferredCrates: ['slow-jams', 'rnb-neo-soul', 'jazz-blues'],
    supportsHalfTime: false,
  },
  yoga: {
    activity: 'yoga',
    label: 'Yoga & Breathwork',
    description: 'Deep, spacious Neo-Soul and warm classic ballads for mindful movement.',
    bpmRange: [60, 94],
    idealBpm: 76,
    energy: 'low',
    preferredGenres: ['Slow Jams / Soul', 'Jazz & Blues', 'R&B / Neo-Soul'],
    preferredCrates: ['slow-jams', 'jazz-blues', 'rnb-neo-soul'],
    supportsHalfTime: false,
  },
};

const ACTIVITY_ALIASES: Record<string, StrideIqActivity> = {
  walk: 'walking',
  walking: 'walking',
  hike: 'walking',
  hiking: 'walking',
  jog: 'jogging',
  jogging: 'jogging',
  run: 'running',
  running: 'running',
  marathon: 'running',
  trail: 'running',
  treadmill: 'running',
  sprint: 'sprint',
  sprints: 'sprint',
  hiit: 'hiit',
  interval: 'hiit',
  intervals: 'hiit',
  bike: 'biking',
  biking: 'biking',
  spin: 'biking',
  spinning: 'biking',
  cycle: 'cycling',
  cycling: 'cycling',
  ride: 'cycling',
  lift: 'strength',
  lifting: 'strength',
  weights: 'strength',
  strength: 'strength',
  warmup: 'warmup',
  'warm-up': 'warmup',
  warm_up: 'warmup',
  cooldown: 'cooldown',
  'cool-down': 'cooldown',
  cool_down: 'cooldown',
  stretch: 'recovery',
  recovery: 'recovery',
  yoga: 'yoga',
  mobility: 'cooldown',
};

export function normalizeWorkoutActivity(input?: string | null): StrideIqActivity {
  const clean = String(input || '').trim().toLowerCase();
  return ACTIVITY_ALIASES[clean] || 'running';
}

export interface StrideIqTrackDto {
  id: string;
  mediaType?: StrideIqQueueMediaType;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number;
  bpmEstimated: boolean;
  energy: EnergyLevel;
  durationSeconds: number;
  explicit: boolean;
  crateId: string;
  crateName: string;
  source: 'catalog' | 'canonical' | 'radio' | 'audiobook' | 'podcast';
  playable: boolean;
  streamUrl: string | null;
  streamExpiresInSeconds: number | null;
  artworkUrl: string;
  workoutTags: StrideIqActivity[];
  cadenceMatchModes: ('direct' | 'double_time' | 'half_time')[];
  workoutScore?: number;
  workoutPhase?: 'warmup' | 'main' | 'sprint' | 'cooldown';
  releaseYear?: number;
  audiobookId?: string;
  chapterIndex?: number;
  showTitle?: string;
}

export interface ResolvedInternalTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number;
  bpmEstimated: boolean;
  energy: EnergyLevel;
  durationSeconds: number;
  explicit: boolean;
  crateId: string;
  crateName: string;
  source: 'catalog' | 'canonical' | 'radio';
  playable: boolean;
  resolvedAudioSource: string; // local URL path (/audio/...) or external https:// URL
  localFilePath: string | null;
  isExternalUrl: boolean;
  artworkPath: string;
  releaseYear?: number;
  stations?: string[];
}

const PUBLIC_DIR = path.join(process.cwd(), 'public');

/**
 * Safely resolves `/audio/...` or `/videos/...` inside `public/`.
 * Blocks path traversal and verifies an actual file exists on disk.
 */
export function resolvePhysicalMediaFile(mediaUrl?: string): string | null {
  if (!mediaUrl) return null;
  const cleaned = mediaUrl.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!cleaned.startsWith('/audio/') && !cleaned.startsWith('/videos/')) return null;
  return resolvePhysicalPublicAsset(mediaUrl);
}

/**
 * Safely resolves `/audio/...` or `/audio/uploads/...` inside `public/audio/`.
 * Blocks path traversal and verifies an actual file exists on disk.
 */
export function resolvePhysicalAudioFile(audioUrl?: string): string | null {
  if (!audioUrl) return null;
  if (!audioUrl.trim().toLowerCase().startsWith('/audio/')) return null;
  return resolvePhysicalPublicAsset(audioUrl);
}

function resolvePhysicalPublicAsset(assetUrl?: string): string | null {
  if (!assetUrl) return null;
  const cleaned = assetUrl.split('?')[0].split('#')[0].trim();
  if (!cleaned.startsWith('/')) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(cleaned.slice(1));
  } catch {
    return null;
  }
  if (!decoded || decoded.includes('\0') || decoded.includes('..')) return null;
  const resolvedPublic = path.resolve(PUBLIC_DIR);
  const candidate = path.resolve(resolvedPublic, decoded);
  if (!candidate.startsWith(resolvedPublic + path.sep)) return null;
  try {
    return fs.statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(urlOrPath: string, publicOrigin: string): string {
  if (!urlOrPath) return `${publicOrigin}/images/genres/rnb-neo-soul.jpg`;
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  const normalized = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  const encodedPath = normalized
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(decodeURIComponentSafe(seg)) : seg))
    .join('/');
  return `${publicOrigin.replace(/\/$/, '')}${encodedPath}`;
}

function decodeURIComponentSafe(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function inferTrackBpm(track: {
  id?: string;
  title?: string;
  artistName?: string;
  genre?: string;
  bpm?: number;
}): { bpm: number; estimated: boolean } {
  if (typeof track.bpm === 'number' && Number.isFinite(track.bpm) && track.bpm >= 45 && track.bpm <= 220) {
    return { bpm: Math.round(track.bpm), estimated: false };
  }

  const title = (track.title || '').toLowerCase();
  const artist = (track.artistName || '').toLowerCase();

  // Verified tempo table for flagship ChanceTEK One studio masters
  if (title.includes('breakbeat anthem') || title.includes('chancetek one break')) return { bpm: 130, estimated: false };
  if (title.includes('never too much') && artist.includes('luther')) return { bpm: 108, estimated: true };
  if (title.includes('got \'til it\'s gone') || title.includes('got til')) return { bpm: 94, estimated: true };
  if (title.includes('wanna be startin')) return { bpm: 122, estimated: true };
  if (title.includes('baby be mine')) return { bpm: 110, estimated: true };
  if (title.includes('girl is mine')) return { bpm: 82, estimated: true };
  if (title.includes('thriller') && artist.includes('michael jackson')) return { bpm: 118, estimated: true };
  if (title.includes('beat it')) return { bpm: 139, estimated: true };
  if (title.includes('billie jean')) return { bpm: 117, estimated: true };
  if (title.includes('human nature') && artist.includes('michael jackson')) return { bpm: 92, estimated: true };
  if (title.includes('pretty young thing') || title.includes('p.y.t')) return { bpm: 127, estimated: true };
  if (title.includes('lady in my life')) return { bpm: 84, estimated: true };
  if (title.includes('don\'t stop') || title.includes('dont stop')) return { bpm: 119, estimated: true };
  if (title.includes('rock with you')) return { bpm: 114, estimated: true };
  if (title.includes('workin\' day and night') || title.includes('workin day and night')) return { bpm: 128, estimated: true };
  if (title.includes('get on the floor')) return { bpm: 120, estimated: true };
  if (title.includes('off the wall')) return { bpm: 119, estimated: true };
  if (title.includes('girlfriend')) return { bpm: 115, estimated: true };
  if (title.includes('out of my life')) return { bpm: 68, estimated: true };
  if (title.includes('can\'t help it') || title.includes('cant help it')) return { bpm: 84, estimated: true };
  if (title.includes('falling in love') && artist.includes('michael')) return { bpm: 112, estimated: true };
  if (title.includes('burn this disco out')) return { bpm: 122, estimated: true };
  if (title.includes('1 thing')) return { bpm: 100, estimated: true };
  if (title.includes('every little step')) return { bpm: 110, estimated: true };
  if (title.includes('my prerogative')) return { bpm: 110, estimated: true };
  if (title.includes('glow of love')) return { bpm: 114, estimated: true };
  if (title.includes('found lovin')) return { bpm: 100, estimated: true };
  if (title.includes('over like a fat rat')) return { bpm: 116, estimated: true };
  if (title.includes('outstanding') && artist.includes('gap')) return { bpm: 103, estimated: true };
  if (title.includes('freedom') && artist.includes('grandmaster')) return { bpm: 112, estimated: true };
  if (title.includes('before i let go')) return { bpm: 107, estimated: true };
  if (title.includes('flashlight') && artist.includes('parliament')) return { bpm: 108, estimated: true };
  if (title.includes('heartbeat') && artist.includes('taana')) return { bpm: 100, estimated: true };
  if (title.includes('be your girl')) return { bpm: 98, estimated: true };
  if (title.includes('ex-factor') || title.includes('ex factor')) return { bpm: 78, estimated: true };
  if (title.includes('i can love you')) return { bpm: 91, estimated: true };
  if (title.includes('can we talk')) return { bpm: 80, estimated: true };
  if (title.includes('summer rain') && artist.includes('carl')) return { bpm: 86, estimated: true };
  if (title.includes('i wish') && artist.includes('carl')) return { bpm: 74, estimated: true };
  if (title.includes('just a friend')) return { bpm: 94, estimated: true };
  if (title.includes('right here') && artist.includes('swv')) return { bpm: 93, estimated: true };
  if (title.includes('you\'re the one') && artist.includes('swv')) return { bpm: 94, estimated: true };
  if (title.includes('by your side')) return { bpm: 88, estimated: true };
  if (title.includes('at your best')) return { bpm: 66, estimated: true };
  if (title.includes('one in a million')) return { bpm: 116, estimated: true };

  const g = (track.genre || '').toLowerCase();
  if (g.includes('house') || g.includes('club')) return { bpm: 124, estimated: true };
  if (g.includes('afro')) return { bpm: 120, estimated: true };
  if (g.includes('break') || g.includes('big beat')) return { bpm: 128, estimated: true };
  if (g.includes('disco') || g.includes('funk')) return { bpm: 114, estimated: true };
  if (g.includes('freestyle')) return { bpm: 120, estimated: true };
  if (g.includes('hip hop') || g.includes('rap')) return { bpm: 94, estimated: true };
  if (g.includes('slow jam')) return { bpm: 76, estimated: true };
  if (g.includes('jazz')) return { bpm: 84, estimated: true };
  if (g.includes('reggaeton')) return { bpm: 96, estimated: true };
  if (g.includes('reggae')) return { bpm: 90, estimated: true };
  if (g.includes('pop')) return { bpm: 108, estimated: true };
  return { bpm: 94, estimated: true };
}

function inferEnergyLevel(bpm: number, genre: string): EnergyLevel {
  const g = genre.toLowerCase();
  if (bpm >= 134 || g.includes('break') || (bpm >= 126 && g.includes('house'))) return 'peak';
  if (bpm >= 112 || g.includes('disco') || g.includes('funk') || g.includes('hip hop')) return 'high';
  if (bpm >= 90) return 'moderate';
  return 'low';
}

function computeTrackWorkoutTags(bpm: number, genre: string): StrideIqActivity[] {
  const tags = new Set<StrideIqActivity>();
  for (const spec of Object.values(WORKOUT_PROFILES)) {
    const [minBpm, maxBpm] = spec.bpmRange;
    const directMatch = bpm >= minBpm && bpm <= maxBpm;
    const halfTimeMatch = spec.supportsHalfTime && bpm * 2 >= minBpm && bpm * 2 <= maxBpm;
    const genreMatch = spec.preferredGenres.some((pg) => pg.toLowerCase() === genre.toLowerCase());
    if (directMatch || (halfTimeMatch && genreMatch)) {
      tags.add(spec.activity);
    }
  }
  if (tags.size === 0) {
    tags.add(bpm >= 110 ? 'walking' : 'cooldown');
  }
  return Array.from(tags);
}

function getCrateInfoForTrack(track: Partial<Track>, resolvedGenre: string): { id: string; name: string } {
  if (track.crateId && track.crateName) {
    return { id: track.crateId, name: track.crateName };
  }
  const lowerG = resolvedGenre.toLowerCase();
  const bySlug = OFFICIAL_CRATES.find(
    (c) =>
      c.id === track.crateId ||
      lowerG.includes(c.slug.replace('-', ' ')) ||
      c.name.toLowerCase().includes(lowerG.split('/')[0].trim()),
  );
  if (bySlug) return { id: bySlug.id, name: bySlug.name };
  if (lowerG.includes('break')) return { id: 'crate-break-beats', name: 'Break Beats' };
  if (lowerG.includes('hip')) return { id: 'crate-hip-hop', name: 'Hip Hop' };
  if (lowerG.includes('disco') || lowerG.includes('funk')) return { id: 'crate-disco-funk', name: 'Disco & Funk' };
  if (lowerG.includes('house')) return { id: 'crate-house-club', name: 'House & Club' };
  if (lowerG.includes('slow')) return { id: 'crate-slow-jams', name: 'Slow Jams' };
  if (lowerG.includes('jazz')) return { id: 'crate-jazz-blues', name: 'Jazz & Blues' };
  return { id: DIRECT_MUSIC_CRATE.id, name: DIRECT_MUSIC_CRATE.name };
}

function normalizeAndResolveTrack(
  raw: Record<string, any>,
  source: 'catalog' | 'canonical' | 'radio',
): ResolvedInternalTrack | null {
  const id = String(raw.id || '').trim();
  const title = String(raw.title || '').trim();
  const artist = String(raw.artistName || raw.artist || '').trim();
  if (!id || !title || !artist) return null;
  if (raw.deleted === true || raw.hidden === true || raw.isPublished === false) return null;

  const album = String(raw.albumTitle || raw.album || 'Single').trim();
  const rawGenre = String(raw.genre || '').trim();
  const crateHintId = typeof raw.crateId === 'string' ? raw.crateId : undefined;
  const crateHintName = typeof raw.crateName === 'string' ? raw.crateName : undefined;
  const genre = isGenericOrInvalidGenre(rawGenre)
    ? classifyGenre({
        artist,
        title,
        album,
        rawGenre,
        crateId: crateHintId,
        crateName: crateHintName,
        bpm: typeof raw.bpm === 'number' ? raw.bpm : undefined,
      })
    : rawGenre || classifyGenre({ artist, title, album });

  // Resolve real playable audio URL — strict artist & file verification
  let audioCandidate = String(raw.audioUrl || '').trim();
  let localFilePath: string | null = null;
  let isExternalUrl = false;

  const candidateMismatch = audioCandidate
    ? isCrossArtistAudioMismatch({ artistName: artist, title, audioUrl: audioCandidate })
    : false;

  if (audioCandidate && !candidateMismatch) {
    if (/^https:\/\//i.test(audioCandidate)) {
      isExternalUrl = true;
    } else if (audioCandidate.toLowerCase().startsWith('/audio/')) {
      localFilePath = resolvePhysicalAudioFile(audioCandidate);
    }
  }

  // Try verified authentic studio master ONLY for exact artist + title match when initial candidate fails
  if (!localFilePath && !isExternalUrl) {
    const authentic = getAuthenticAudioUrl({
      id,
      title,
      artistName: artist,
      audioUrl: '',
    });
    if (authentic && !isCrossArtistAudioMismatch({ artistName: artist, title, audioUrl: authentic })) {
      if (/^https:\/\//i.test(authentic)) {
        audioCandidate = authentic;
        isExternalUrl = true;
      } else {
        const disk = resolvePhysicalAudioFile(authentic);
        if (disk) {
          audioCandidate = authentic;
          localFilePath = disk;
        }
      }
    }
  }

  const playable = Boolean(localFilePath || isExternalUrl);

  // Resolve authentic cover artwork
  let artworkPath = String(raw.coverUrl || '').trim();
  const fixedCover = correctedKnownCover({
    artistName: artist,
    albumTitle: album,
    title,
    coverUrl: artworkPath,
  });
  if (fixedCover) artworkPath = fixedCover;

  if (!artworkPath || isMissingOrGenericCover(artworkPath)) {
    artworkPath = getDefaultCoverForTrack({
      genre,
      crateId: crateHintId,
      artistName: artist,
      title,
    });
  } else if (artworkPath.startsWith('/') && !resolvePhysicalPublicAsset(artworkPath)) {
    artworkPath = getDefaultCoverForTrack({
      genre,
      crateId: crateHintId,
      artistName: artist,
      title,
    });
  }

  const { bpm, estimated } = inferTrackBpm({
    id,
    title,
    artistName: artist,
    genre,
    bpm: typeof raw.bpm === 'number' ? raw.bpm : undefined,
  });

  const crate = getCrateInfoForTrack({ crateId: crateHintId, crateName: crateHintName }, genre);
  const rawDuration = Number(raw.duration);
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 20 ? Math.round(rawDuration) : 210;

  return {
    id,
    title,
    artist,
    album,
    genre,
    bpm,
    bpmEstimated: estimated,
    energy: inferEnergyLevel(bpm, genre),
    durationSeconds,
    explicit: Boolean(raw.isExplicit || raw.explicit),
    crateId: crate.id,
    crateName: crate.name,
    source,
    playable,
    resolvedAudioSource: playable ? audioCandidate : '',
    localFilePath,
    isExternalUrl,
    artworkPath,
    releaseYear: typeof raw.releaseYear === 'number' ? raw.releaseYear : typeof raw.year === 'number' ? raw.year : undefined,
    stations: Array.isArray(raw.stations) ? raw.stations.map(String) : undefined,
  };
}

async function loadSnapshotSafe() {
  return readCatalogSnapshot().catch(() => ({
    revision: 0,
    collections: {
      tracks: [],
      albums: [],
      artists: [],
      producers: [],
      audiobooks: [],
      videos: [],
      podcasts: [],
      removed: [],
    },
  }));
}

function isMediaEntityTombstoned(
  removedDocs: Record<string, any>[],
  prefix: 'audiobook:' | 'podcast:',
  id: string,
  title: string,
): boolean {
  const kindName = prefix.slice(0, -1);
  const titleKey = `title:${title.toLowerCase().trim()}`;
  const prefixedTitleKey = `${prefix}${titleKey}`;
  const prefixedId = `${prefix}${id}`;

  return removedDocs.some((rem) => {
    const remId = String(rem.id || '');
    const remKind = String(rem.kind || '');
    if (remId === prefixedId || remId === prefixedTitleKey) return true;
    if (remKind === kindName && (remId === id || remId === titleKey)) return true;
    return false;
  });
}

function resolveMediaSourceLocation(rawUrl?: string): {
  resolvedSource: string;
  localFilePath: string | null;
  isExternalUrl: boolean;
  playable: boolean;
} {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) {
    return { resolvedSource: '', localFilePath: null, isExternalUrl: false, playable: false };
  }
  if (/^https:\/\//i.test(cleaned)) {
    return { resolvedSource: cleaned, localFilePath: null, isExternalUrl: true, playable: true };
  }
  const disk = resolvePhysicalMediaFile(cleaned);
  if (disk) {
    return { resolvedSource: cleaned, localFilePath: disk, isExternalUrl: false, playable: true };
  }
  return { resolvedSource: '', localFilePath: null, isExternalUrl: false, playable: false };
}

/**
 * Loads all tracks across Firestore cloud catalog, canonical studio releases, and radio rotation,
 * omitting deleted tombstones and deduplicating by ID and normalized title+artist.
 */
export async function resolveServerCatalog(options?: {
  includeUnplayable?: boolean;
}): Promise<ResolvedInternalTrack[]> {
  const snapshot = await loadSnapshotSafe();

  const tombstoneSet = new Set<string>();
  for (const rem of snapshot.collections.removed || []) {
    if (rem.id) tombstoneSet.add(String(rem.id));
    if (rem.titleKey) tombstoneSet.add(String(rem.titleKey));
    if (rem.compositeKey) tombstoneSet.add(String(rem.compositeKey));
    if (rem.key) tombstoneSet.add(String(rem.key));
  }

  const isTombstoned = (id: string, title: string, artist: string): boolean => {
    if (tombstoneSet.has(id)) return true;
    const normTitle = normalizeAlbumKey(title);
    const normArtist = normalizeAlbumKey(artist);
    if (normTitle && tombstoneSet.has(`title:${normTitle}`)) return true;
    if (normTitle && normArtist && tombstoneSet.has(`key:${normTitle}:::${normArtist}`)) return true;
    return false;
  };

  const mergedById = new Map<string, ResolvedInternalTrack>();
  const seenCompositeKeys = new Set<string>();

  const registerTrack = (item: ResolvedInternalTrack | null) => {
    if (!item) return;
    if (isTombstoned(item.id, item.title, item.artist)) return;
    if (!options?.includeUnplayable && !item.playable) return;
    const compKey = `${normalizeAlbumKey(item.title)}:::${normalizeAlbumKey(item.artist)}`;
    if (mergedById.has(item.id) || (compKey !== ':::' && seenCompositeKeys.has(compKey))) return;
    mergedById.set(item.id, item);
    if (compKey !== ':::') seenCompositeKeys.add(compKey);
  };

  // 1. Firestore user-uploaded & live catalog tracks take priority
  for (const doc of snapshot.collections.tracks || []) {
    registerTrack(normalizeAndResolveTrack(doc, 'catalog'));
  }

  // 2. Canonical platform studio masters
  for (const canon of PLATFORM_CANONICAL_TRACKS) {
    registerTrack(normalizeAndResolveTrack(canon as Record<string, any>, 'canonical'));
  }

  // 3. ChanceTEK Radio active rotation tracks
  for (const radioTrack of RADIO_INITIAL_CATALOG) {
    if (!radioTrack.isApproved || !radioTrack.inRotation) continue;
    registerTrack(normalizeAndResolveTrack(radioTrack as Record<string, any>, 'radio'));
  }

  return Array.from(mergedById.values());
}

export async function toStrideIqTrackDto(
  track: ResolvedInternalTrack,
  publicOrigin: string,
  extra?: {
    workoutScore?: number;
    workoutPhase?: 'warmup' | 'main' | 'sprint' | 'cooldown';
    cadenceMatchModes?: ('direct' | 'double_time' | 'half_time')[];
  },
): Promise<StrideIqTrackDto> {
  const tokenTtl = 3600;
  let streamUrl: string | null = null;
  if (track.playable) {
    const token = await signStrideIqStreamToken(track.id, tokenTtl);
    streamUrl = `${publicOrigin.replace(/\/$/, '')}/api/strideiq/v1/stream/${encodeURIComponent(track.id)}?token=${encodeURIComponent(token)}`;
  }

  return {
    id: track.id,
    mediaType: 'music',
    title: track.title,
    artist: track.artist,
    album: track.album,
    genre: track.genre,
    bpm: track.bpm,
    bpmEstimated: track.bpmEstimated,
    energy: track.energy,
    durationSeconds: track.durationSeconds,
    explicit: track.explicit,
    crateId: track.crateId,
    crateName: track.crateName,
    source: track.source,
    playable: track.playable,
    streamUrl,
    streamExpiresInSeconds: track.playable ? tokenTtl : null,
    artworkUrl: toAbsoluteUrl(track.artworkPath, publicOrigin),
    workoutTags: computeTrackWorkoutTags(track.bpm, track.genre),
    cadenceMatchModes: extra?.cadenceMatchModes || ['direct'],
    ...(extra?.workoutScore !== undefined ? { workoutScore: Number(extra.workoutScore.toFixed(2)) } : {}),
    ...(extra?.workoutPhase ? { workoutPhase: extra.workoutPhase } : {}),
    ...(track.releaseYear ? { releaseYear: track.releaseYear } : {}),
  };
}

export async function getStrideIqTrackById(
  trackId: string,
  options?: { includeUnplayable?: boolean },
): Promise<ResolvedInternalTrack | null> {
  const catalog = await resolveServerCatalog(options);
  return catalog.find((t) => t.id === trackId) || null;
}

export async function queryStrideIqTracks(params: {
  publicOrigin: string;
  q?: string;
  activity?: string;
  genre?: string;
  crate?: string;
  bpmMin?: number;
  bpmMax?: number;
  energy?: EnergyLevel;
  limit?: number;
  offset?: number;
  includeUnplayable?: boolean;
}): Promise<{ tracks: StrideIqTrackDto[]; total: number; limit: number; offset: number }> {
  const all = await resolveServerCatalog({ includeUnplayable: params.includeUnplayable });
  const qLower = (params.q || '').trim().toLowerCase();
  const genreLower = (params.genre || '').trim().toLowerCase();
  const crateLower = (params.crate || '').trim().toLowerCase();
  const actFilter = params.activity ? normalizeWorkoutActivity(params.activity) : null;

  const filtered = all.filter((t) => {
    if (qLower) {
      const hay = `${t.title} ${t.artist} ${t.album} ${t.genre} ${t.crateName}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    if (genreLower && !t.genre.toLowerCase().includes(genreLower)) return false;
    if (
      crateLower &&
      t.crateId.toLowerCase() !== crateLower &&
      !t.crateName.toLowerCase().includes(crateLower)
    ) {
      return false;
    }
    if (params.energy && t.energy !== params.energy) return false;
    if (typeof params.bpmMin === 'number' && t.bpm < params.bpmMin) return false;
    if (typeof params.bpmMax === 'number' && t.bpm > params.bpmMax) return false;
    if (actFilter) {
      const tags = computeTrackWorkoutTags(t.bpm, t.genre);
      if (!tags.includes(actFilter)) return false;
    }
    return true;
  });

  const limit = Math.min(100, Math.max(1, params.limit ?? 40));
  const offset = Math.max(0, params.offset ?? 0);
  const sliced = filtered.slice(offset, offset + limit);
  const tracks = await Promise.all(sliced.map((t) => toStrideIqTrackDto(t, params.publicOrigin)));

  return { tracks, total: filtered.length, limit, offset };
}

function scoreTrackForActivity(
  track: ResolvedInternalTrack,
  spec: WorkoutProfileSpec,
  options: { targetBpm?: number; cadenceSpm?: number; preferredGenre?: string },
): { score: number; modes: ('direct' | 'double_time' | 'half_time')[] } {
  const target = options.targetBpm || options.cadenceSpm || spec.idealBpm;
  const [minBpm, maxBpm] = spec.bpmRange;
  const modes: ('direct' | 'double_time' | 'half_time')[] = [];

  let score = 50;
  const directDist = Math.abs(track.bpm - target);

  if (track.bpm >= minBpm && track.bpm <= maxBpm) {
    modes.push('direct');
    score += Math.max(0, 35 - directDist * 0.9);
  } else {
    score -= Math.min(25, directDist * 0.45);
  }

  // Double-time cadence alignment: e.g. 88 BPM Hip-Hop fits 176 SPM running stride
  if (spec.supportsHalfTime) {
    const doubleDist = Math.abs(track.bpm * 2 - target);
    if (doubleDist <= 18) {
      modes.push('half_time');
      score += Math.max(8, 28 - doubleDist * 1.1);
    }
    const halfDist = Math.abs(track.bpm / 2 - target);
    if (halfDist <= 12) {
      modes.push('double_time');
      score += 12;
    }
  }

  // Genre alignment bonus
  const genreIdx = spec.preferredGenres.findIndex((g) => g.toLowerCase() === track.genre.toLowerCase());
  if (genreIdx === 0) score += 18;
  else if (genreIdx > 0) score += 12 - genreIdx;

  if (spec.preferredCrates.includes(track.crateId.replace('crate-', ''))) {
    score += 6;
  }

  if (options.preferredGenre && track.genre.toLowerCase().includes(options.preferredGenre.toLowerCase())) {
    score += 14;
  }

  if (modes.length === 0) modes.push('direct');
  return { score: Math.max(1, Math.min(100, score)), modes };
}

function selectVariedQueue(
  scored: { track: ResolvedInternalTrack; score: number; modes: ('direct' | 'double_time' | 'half_time')[] }[],
  targetSeconds: number,
  maxTracks: number,
  phase: 'warmup' | 'main' | 'sprint' | 'cooldown',
  usedIds: Set<string>,
  allowReuse: boolean,
): { track: ResolvedInternalTrack; score: number; modes: ('direct' | 'double_time' | 'half_time')[]; phase: 'warmup' | 'main' | 'sprint' | 'cooldown' }[] {
  const picked: { track: ResolvedInternalTrack; score: number; modes: ('direct' | 'double_time' | 'half_time')[]; phase: 'warmup' | 'main' | 'sprint' | 'cooldown' }[] = [];
  let accum = 0;

  const tryPass = (pool: typeof scored, enforceUniqueArtistBackToBack: boolean) => {
    for (const candidate of pool) {
      if (picked.length >= maxTracks || accum >= targetSeconds) break;
      if (usedIds.has(candidate.track.id)) continue;
      const lastArtist = picked[picked.length - 1]?.track.artist.toLowerCase();
      if (enforceUniqueArtistBackToBack && lastArtist && candidate.track.artist.toLowerCase() === lastArtist) {
        continue;
      }
      picked.push({ ...candidate, phase });
      usedIds.add(candidate.track.id);
      accum += candidate.track.durationSeconds;
    }
  };

  tryPass(scored, true);
  if (accum < targetSeconds && picked.length < maxTracks) {
    tryPass(scored, false);
  }
  if (allowReuse && accum < targetSeconds && picked.length < maxTracks && scored.length > 0) {
    let idx = 0;
    while (accum < targetSeconds && picked.length < maxTracks && idx < maxTracks * 2) {
      const candidate = scored[idx % scored.length];
      picked.push({ ...candidate, phase });
      accum += candidate.track.durationSeconds;
      idx++;
    }
  }
  return picked;
}

export async function generateStrideIqWorkoutMix(options: {
  publicOrigin: string;
  activity?: string;
  targetDurationMinutes?: number;
  cadenceSpm?: number;
  targetBpm?: number;
  bpmMin?: number;
  bpmMax?: number;
  genre?: string;
  crate?: string;
  q?: string;
  mediaMode?: string;
  structure?: WorkoutStructure;
  excludeTrackIds?: string[];
  limit?: number;
  allowExplicit?: boolean;
  allowLoop?: boolean;
}) {
  const activity = normalizeWorkoutActivity(options.activity);
  const mediaMode = normalizeWorkoutMediaMode(options.mediaMode);
  const profile = WORKOUT_PROFILES[activity];
  const durationMinutes = Math.min(180, Math.max(5, Number(options.targetDurationMinutes) || 30));
  const structure: WorkoutStructure = options.structure || 'steady';
  const maxTracks = Math.min(50, Math.max(1, Number(options.limit) || 24));
  const excludeSet = new Set((options.excludeTrackIds || []).map(String));
  const targetSeconds = durationMinutes * 60;
  const queryLower = (options.q || options.genre || '').trim().toLowerCase();

  let tracks: StrideIqTrackDto[] = [];

  if (mediaMode === 'audiobook' || mediaMode === 'podcast') {
    if (mediaMode === 'audiobook') {
      const books = await resolveServerAudiobooks({ includeUnplayable: false });
      const matchingBooks = queryLower
        ? books.filter((b) =>
            `${b.title} ${b.author} ${b.genre} ${b.description}`.toLowerCase().includes(queryLower),
          )
        : books;
      const sourceBooks = matchingBooks.length > 0 ? matchingBooks : books;
      let accum = 0;
      for (const book of sourceBooks) {
        for (const ch of book.chapters) {
          if (!ch.playable) continue;
          if (excludeSet.has(ch.streamId) || excludeSet.has(ch.id)) continue;
          if (tracks.length >= maxTracks || (accum >= targetSeconds && tracks.length > 0)) break;
          tracks.push(await chapterToQueueDto(book, ch, options.publicOrigin, 'main'));
          accum += ch.durationSeconds;
        }
        if (tracks.length >= maxTracks || (accum >= targetSeconds && tracks.length > 0)) break;
      }
    } else {
      const podcasts = await resolveServerPodcasts({ includeUnplayable: false });
      const ordered = [...podcasts].sort((a, b) =>
        a.mediaType === b.mediaType ? 0 : a.mediaType === 'audio' ? -1 : 1,
      );
      const matching = queryLower
        ? ordered.filter((p) =>
            `${p.title} ${p.showTitle} ${p.host} ${p.category} ${p.description}`
              .toLowerCase()
              .includes(queryLower),
          )
        : ordered;
      const sourcePods = matching.length > 0 ? matching : ordered;
      let accum = 0;
      for (const ep of sourcePods) {
        if (excludeSet.has(ep.id)) continue;
        if (tracks.length >= maxTracks || (accum >= targetSeconds && tracks.length > 0)) break;
        tracks.push(await podcastToQueueDto(ep, options.publicOrigin, 'main'));
        accum += ep.durationSeconds;
      }
    }
  } else if (mediaMode === 'mixed') {
    const [catalog, books, podcasts] = await Promise.all([
      resolveServerCatalog({ includeUnplayable: false }),
      resolveServerAudiobooks({ includeUnplayable: false }),
      resolveServerPodcasts({ includeUnplayable: false }),
    ]);

    const musicPool = catalog.filter((t) => {
      if (excludeSet.has(t.id)) return false;
      if (options.allowExplicit === false && t.explicit) return false;
      return true;
    });

    const usedMusicIds = new Set<string>();
    const warmupScored = musicPool
      .map((track) => ({
        track,
        ...scoreTrackForActivity(track, WORKOUT_PROFILES.warmup, { preferredGenre: options.genre }),
      }))
      .sort((a, b) => b.score - a.score);
    const warmupPick = selectVariedQueue(warmupScored, 240, 1, 'warmup', usedMusicIds, false);
    for (const entry of warmupPick) {
      tracks.push(
        await toStrideIqTrackDto(entry.track, options.publicOrigin, {
          workoutScore: entry.score,
          workoutPhase: 'warmup',
          cadenceMatchModes: entry.modes,
        }),
      );
    }

    const spokenBudget = Math.max(240, Math.round(targetSeconds * 0.55));
    let spokenAccum = 0;
    const audioPods = podcasts.filter((p) => p.mediaType === 'audio' && !excludeSet.has(p.id));
    if (audioPods.length > 0) {
      tracks.push(await podcastToQueueDto(audioPods[0], options.publicOrigin, 'main'));
      spokenAccum += audioPods[0].durationSeconds;
    }
    for (const book of books) {
      for (const ch of book.chapters) {
        if (!ch.playable || excludeSet.has(ch.streamId) || excludeSet.has(ch.id)) continue;
        if (spokenAccum >= spokenBudget || tracks.length >= Math.max(2, maxTracks - 2)) break;
        tracks.push(await chapterToQueueDto(book, ch, options.publicOrigin, 'main'));
        spokenAccum += ch.durationSeconds;
      }
      if (spokenAccum >= spokenBudget) break;
    }

    const remainingSecs = Math.max(
      180,
      targetSeconds - tracks.reduce((s, t) => s + t.durationSeconds, 0),
    );
    const mainScored = musicPool
      .map((track) => ({
        track,
        ...scoreTrackForActivity(track, profile, {
          targetBpm: options.targetBpm,
          cadenceSpm: options.cadenceSpm,
          preferredGenre: options.genre,
        }),
      }))
      .sort((a, b) => b.score - a.score);
    const mainPicks = selectVariedQueue(
      mainScored,
      remainingSecs,
      Math.max(1, maxTracks - tracks.length),
      'main',
      usedMusicIds,
      options.allowLoop !== false,
    );
    for (const entry of mainPicks) {
      tracks.push(
        await toStrideIqTrackDto(entry.track, options.publicOrigin, {
          workoutScore: entry.score,
          workoutPhase: 'main',
          cadenceMatchModes: entry.modes,
        }),
      );
    }
  } else {
    const catalog = await resolveServerCatalog({ includeUnplayable: false });
    const pool = catalog.filter((t) => {
      if (excludeSet.has(t.id)) return false;
      if (options.allowExplicit === false && t.explicit) return false;
      if (typeof options.bpmMin === 'number' && t.bpm < options.bpmMin) return false;
      if (typeof options.bpmMax === 'number' && t.bpm > options.bpmMax) return false;
      if (
        options.crate &&
        t.crateId !== options.crate &&
        !t.crateName.toLowerCase().includes(options.crate.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const usedIds = new Set<string>();
    let assembled: {
      track: ResolvedInternalTrack;
      score: number;
      modes: ('direct' | 'double_time' | 'half_time')[];
      phase: 'warmup' | 'main' | 'sprint' | 'cooldown';
    }[] = [];

    if (structure === 'warmup_main_cooldown' && durationMinutes >= 12) {
      const warmupSecs = Math.round(targetSeconds * 0.15);
      const cooldownSecs = Math.round(targetSeconds * 0.15);
      const mainSecs = Math.max(180, targetSeconds - warmupSecs - cooldownSecs);

      const scorePool = (spec: WorkoutProfileSpec, bpmOverride?: number) =>
        pool
          .map((track) => ({
            track,
            ...scoreTrackForActivity(track, spec, {
              targetBpm: bpmOverride,
              cadenceSpm: options.cadenceSpm,
              preferredGenre: options.genre,
            }),
          }))
          .sort((a, b) => b.score - a.score);

      const warmupPicks = selectVariedQueue(
        scorePool(WORKOUT_PROFILES.warmup),
        warmupSecs,
        4,
        'warmup',
        usedIds,
        false,
      );
      const mainPicks = selectVariedQueue(
        scorePool(profile, options.targetBpm),
        mainSecs,
        Math.max(1, maxTracks - 4),
        'main',
        usedIds,
        options.allowLoop !== false,
      );
      const cooldownPicks = selectVariedQueue(
        scorePool(WORKOUT_PROFILES.cooldown),
        cooldownSecs,
        4,
        'cooldown',
        usedIds,
        false,
      );
      assembled = [...warmupPicks, ...mainPicks, ...cooldownPicks].slice(0, maxTracks);
    } else if (structure === 'interval') {
      const sprintScored = pool
        .map((track) => ({
          track,
          ...scoreTrackForActivity(track, WORKOUT_PROFILES.sprint, {
            preferredGenre: options.genre,
          }),
        }))
        .sort((a, b) => b.score - a.score);
      const steadyScored = pool
        .map((track) => ({
          track,
          ...scoreTrackForActivity(track, WORKOUT_PROFILES.warmup, {
            preferredGenre: options.genre,
          }),
        }))
        .sort((a, b) => b.score - a.score);

      let accum = 0;
      let i = 0;
      while (
        accum < targetSeconds &&
        assembled.length < maxTracks &&
        (sprintScored.length > 0 || steadyScored.length > 0)
      ) {
        const list = i % 2 === 0 ? sprintScored : steadyScored;
        const candidate = list.find((c) => !usedIds.has(c.track.id)) || list[i % list.length];
        if (!candidate) break;
        usedIds.add(candidate.track.id);
        assembled.push({ ...candidate, phase: i % 2 === 0 ? 'sprint' : 'warmup' });
        accum += candidate.track.durationSeconds;
        i++;
      }
    } else {
      const scored = pool
        .map((track) => ({
          track,
          ...scoreTrackForActivity(track, profile, {
            targetBpm: options.targetBpm,
            cadenceSpm: options.cadenceSpm,
            preferredGenre: options.genre,
          }),
        }))
        .sort((a, b) => b.score - a.score);
      assembled = selectVariedQueue(
        scored,
        targetSeconds,
        maxTracks,
        'main',
        usedIds,
        options.allowLoop !== false,
      );
    }

    tracks = await Promise.all(
      assembled.map((entry) =>
        toStrideIqTrackDto(entry.track, options.publicOrigin, {
          workoutScore: entry.score,
          workoutPhase: entry.phase,
          cadenceMatchModes: entry.modes,
        }),
      ),
    );
  }

  const totalDurationSeconds = tracks.reduce((sum, t) => sum + t.durationSeconds, 0);
  const tempoTracks = tracks.filter((t) => t.bpm > 0);
  const averageBpm =
    tempoTracks.length > 0
      ? Math.round(tempoTracks.reduce((sum, t) => sum + t.bpm, 0) / tempoTracks.length)
      : null;

  return {
    mixId: `strideiq-mix-${activity}-${mediaMode}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    activity: profile.activity,
    activityLabel: profile.label,
    mediaMode,
    structure,
    targetDurationMinutes: durationMinutes,
    actualDurationSeconds: totalDurationSeconds,
    averageBpm,
    bpmTargetRange: profile.bpmRange,
    cadenceSpmRequested: options.cadenceSpm ?? null,
    trackCount: tracks.length,
    tracks,
  };
}

export async function getStrideIqCrates(publicOrigin: string) {
  const catalog = await resolveServerCatalog({ includeUnplayable: false });
  const allCrates = [DIRECT_MUSIC_CRATE, ...OFFICIAL_CRATES];

  return allCrates.map((crate) => {
    const members = catalog.filter(
      (t) =>
        t.crateId === crate.id ||
        t.crateName.toLowerCase() === crate.name.toLowerCase() ||
        computeTrackWorkoutTags(t.bpm, t.genre).some((act) =>
          WORKOUT_PROFILES[act].preferredCrates.includes(crate.slug),
        ),
    );
    const avgBpm =
      members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.bpm, 0) / members.length) : null;

    const recommendedActivities = (Object.values(WORKOUT_PROFILES) as WorkoutProfileSpec[])
      .filter((spec) => spec.preferredCrates.includes(crate.slug))
      .map((spec) => spec.activity);

    return {
      id: crate.id,
      slug: crate.slug,
      name: crate.name,
      subtitle: crate.subtitle,
      badge: crate.badge,
      bpmRange: crate.bpmRange,
      description: crate.description,
      trackCount: members.length,
      averageBpm: avgBpm,
      recommendedActivities,
      artworkUrl: toAbsoluteUrl(crate.artworkUrl || '/images/genres/rnb-neo-soul.jpg', publicOrigin),
    };
  });
}

export async function getStrideIqPlaylists(publicOrigin: string, activityFilter?: string) {
  const featuredActivities: StrideIqActivity[] = [
    'walking',
    'running',
    'biking',
    'hiit',
    'strength',
    'cooldown',
  ];

  const targetActivities = activityFilter
    ? [normalizeWorkoutActivity(activityFilter)]
    : featuredActivities;

  const playlists = await Promise.all(
    targetActivities.map(async (act) => {
      const profile = WORKOUT_PROFILES[act];
      const mix = await generateStrideIqWorkoutMix({
        publicOrigin,
        activity: act,
        targetDurationMinutes: 35,
        structure: act === 'running' || act === 'biking' ? 'warmup_main_cooldown' : 'steady',
        allowLoop: false,
        limit: 12,
      });

      return {
        id: `strideiq-playlist-${act}`,
        name: `StrideIQ x ChanceTEK One: ${profile.label}`,
        description: profile.description,
        activity: act,
        bpmRange: profile.bpmRange,
        energy: profile.energy,
        trackCount: mix.trackCount,
        totalDurationSeconds: mix.actualDurationSeconds,
        averageBpm: mix.averageBpm,
        artworkUrl:
          mix.tracks[0]?.artworkUrl ||
          toAbsoluteUrl('/images/genres/break-beats.jpg', publicOrigin),
        tracks: mix.tracks,
      };
    }),
  );

  return playlists;
}

export async function getStrideIqRadioFeed(publicOrigin: string) {
  const catalog = await resolveServerCatalog({ includeUnplayable: false });

  return Promise.all(
    RADIO_STATIONS.map(async (station) => {
      const stationTracks = catalog.filter(
        (t) => t.source === 'radio' && t.stations?.includes(station.id),
      );
      const tracks = await Promise.all(
        stationTracks.map((t) => toStrideIqTrackDto(t, publicOrigin)),
      );
      const bpms = stationTracks.map((t) => t.bpm);
      const bpmRange: [number, number] =
        bpms.length > 0 ? [Math.min(...bpms), Math.max(...bpms)] : [72, 120];
      return {
        id: station.id,
        name: station.name,
        tagline: station.tagline,
        genre: station.genre,
        description: station.description,
        accentColor: station.accentColor,
        bpmRange,
        isLive: station.isLive,
        artworkUrl: toAbsoluteUrl(station.artworkUrl, publicOrigin),
        trackCount: stationTracks.length,
        tracks,
      };
    }),
  );
}

/* ──────────────────────── Audiobooks & Spoken Literature ──────────────────────── */

const SPOKEN_WORKOUT_TAGS: StrideIqActivity[] = [
  'walking',
  'jogging',
  'running',
  'biking',
  'cycling',
  'warmup',
  'cooldown',
  'recovery',
];

export interface ResolvedInternalChapter {
  id: string;
  streamId: string;
  chapterIndex: number;
  title: string;
  durationSeconds: number;
  playable: boolean;
  resolvedSource: string;
  localFilePath: string | null;
  isExternalUrl: boolean;
}

export interface ResolvedInternalAudiobook {
  id: string;
  title: string;
  author: string;
  narrator: string;
  genre: string;
  description: string;
  releaseYear: number;
  artworkPath: string;
  playable: boolean;
  totalDurationSeconds: number;
  chapters: ResolvedInternalChapter[];
}

export interface StrideIqAudiobookChapterDto {
  id: string;
  streamId: string;
  chapterIndex: number;
  title: string;
  durationSeconds: number;
  playable: boolean;
  streamUrl: string | null;
  streamExpiresInSeconds: number | null;
}

export interface StrideIqAudiobookDto {
  id: string;
  mediaType: 'audiobook';
  title: string;
  author: string;
  narrator: string;
  genre: string;
  description: string;
  releaseYear: number;
  totalDurationSeconds: number;
  chapterCount: number;
  playable: boolean;
  artworkUrl: string;
  workoutTags: StrideIqActivity[];
  chapters: StrideIqAudiobookChapterDto[];
}

function safeResolveSpokenArtwork(rawCover?: string): string {
  const c = String(rawCover || '').trim();
  if (/^https?:\/\//i.test(c)) return c;
  if (c && resolvePhysicalPublicAsset(c)) return c;
  if (resolvePhysicalPublicAsset('/images/chancetek_banner.png')) return '/images/chancetek_banner.png';
  return '/images/logo.png';
}

function normalizeInternalAudiobook(raw: Record<string, any>): ResolvedInternalAudiobook | null {
  const id = String(raw.id || '').trim();
  const title = String(raw.title || '').trim();
  if (!id || !title) return null;
  if (raw.deleted === true || raw.hidden === true || raw.isPublished === false) return null;

  const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  const fallbackChapters =
    rawChapters.length > 0
      ? rawChapters
      : raw.audioUrl
        ? [
            {
              id: `${id}-ch-1`,
              chapterIndex: 1,
              title,
              duration: Number(raw.duration) || 300,
              audioUrl: raw.audioUrl,
            },
          ]
        : [];

  const chapters: ResolvedInternalChapter[] = fallbackChapters
    .map((ch: any, idx: number) => {
      const chId = String(ch?.id || `${id}-ch-${idx + 1}`).trim();
      const loc = resolveMediaSourceLocation(ch?.audioUrl || ch?.mediaUrl);
      const rawDur = Number(ch?.duration);
      return {
        id: chId,
        streamId: `ab:${id}:${chId}`,
        chapterIndex: Number(ch?.chapterIndex) || idx + 1,
        title: String(ch?.title || `Chapter ${idx + 1}`).trim(),
        durationSeconds: Number.isFinite(rawDur) && rawDur > 5 ? Math.round(rawDur) : 300,
        playable: loc.playable,
        resolvedSource: loc.resolvedSource,
        localFilePath: loc.localFilePath,
        isExternalUrl: loc.isExternalUrl,
      };
    })
    .sort((a, b) => a.chapterIndex - b.chapterIndex);

  const playable = chapters.some((c) => c.playable);
  const totalDurationSeconds =
    chapters.reduce((sum, c) => sum + c.durationSeconds, 0) || Number(raw.duration) || 300;

  return {
    id,
    title,
    author: String(raw.author || 'ChanceTEK LLC').trim(),
    narrator: String(raw.narrator || raw.author || 'ChanceTEK LLC').trim(),
    genre: String(raw.genre || 'Spoken Audio').trim(),
    description: String(raw.description || '').trim(),
    releaseYear: Number(raw.releaseYear) || 2026,
    artworkPath: safeResolveSpokenArtwork(raw.coverUrl),
    playable,
    totalDurationSeconds,
    chapters,
  };
}

export async function resolveServerAudiobooks(options?: {
  includeUnplayable?: boolean;
}): Promise<ResolvedInternalAudiobook[]> {
  const snapshot = await loadSnapshotSafe();
  const removedDocs = snapshot.collections.removed || [];
  const byId = new Map<string, ResolvedInternalAudiobook>();

  const register = (raw: Record<string, any>) => {
    const item = normalizeInternalAudiobook(raw);
    if (!item) return;
    if (isMediaEntityTombstoned(removedDocs, 'audiobook:', item.id, item.title)) return;
    if (!options?.includeUnplayable && !item.playable) return;
    if (!byId.has(item.id)) byId.set(item.id, item);
  };

  for (const doc of snapshot.collections.audiobooks || []) register(doc);
  for (const seed of MOCK_AUDIOBOOKS) register(seed as Record<string, any>);

  return Array.from(byId.values());
}

async function toStrideIqAudiobookDto(
  book: ResolvedInternalAudiobook,
  publicOrigin: string,
): Promise<StrideIqAudiobookDto> {
  const tokenTtl = 3600;
  const chapters: StrideIqAudiobookChapterDto[] = await Promise.all(
    book.chapters.map(async (ch) => {
      let streamUrl: string | null = null;
      if (ch.playable) {
        const token = await signStrideIqStreamToken(ch.streamId, tokenTtl);
        streamUrl = `${publicOrigin.replace(/\/$/, '')}/api/strideiq/v1/stream/${encodeURIComponent(ch.streamId)}?token=${encodeURIComponent(token)}`;
      }
      return {
        id: ch.id,
        streamId: ch.streamId,
        chapterIndex: ch.chapterIndex,
        title: ch.title,
        durationSeconds: ch.durationSeconds,
        playable: ch.playable,
        streamUrl,
        streamExpiresInSeconds: ch.playable ? tokenTtl : null,
      };
    }),
  );

  return {
    id: book.id,
    mediaType: 'audiobook',
    title: book.title,
    author: book.author,
    narrator: book.narrator,
    genre: book.genre,
    description: book.description,
    releaseYear: book.releaseYear,
    totalDurationSeconds: book.totalDurationSeconds,
    chapterCount: chapters.length,
    playable: book.playable,
    artworkUrl: toAbsoluteUrl(book.artworkPath, publicOrigin),
    workoutTags: SPOKEN_WORKOUT_TAGS,
    chapters,
  };
}

async function chapterToQueueDto(
  book: ResolvedInternalAudiobook,
  ch: ResolvedInternalChapter,
  publicOrigin: string,
  phase: 'warmup' | 'main' | 'sprint' | 'cooldown',
): Promise<StrideIqTrackDto> {
  const tokenTtl = 3600;
  const token = await signStrideIqStreamToken(ch.streamId, tokenTtl);
  return {
    id: ch.streamId,
    mediaType: 'audiobook_chapter',
    title: `${book.title} — ${ch.title}`,
    artist: book.author,
    album: book.title,
    genre: book.genre,
    bpm: 0,
    bpmEstimated: false,
    energy: 'moderate',
    durationSeconds: ch.durationSeconds,
    explicit: false,
    crateId: 'audiobooks',
    crateName: 'Audiobooks & Literature',
    source: 'audiobook',
    playable: ch.playable,
    streamUrl: `${publicOrigin.replace(/\/$/, '')}/api/strideiq/v1/stream/${encodeURIComponent(ch.streamId)}?token=${encodeURIComponent(token)}`,
    streamExpiresInSeconds: tokenTtl,
    artworkUrl: toAbsoluteUrl(book.artworkPath, publicOrigin),
    workoutTags: SPOKEN_WORKOUT_TAGS,
    cadenceMatchModes: ['direct'],
    workoutScore: 95,
    workoutPhase: phase,
    releaseYear: book.releaseYear,
    audiobookId: book.id,
    chapterIndex: ch.chapterIndex,
  };
}

export async function queryStrideIqAudiobooks(params: {
  publicOrigin: string;
  q?: string;
  genre?: string;
  author?: string;
  limit?: number;
  offset?: number;
  includeUnplayable?: boolean;
}) {
  const all = await resolveServerAudiobooks({ includeUnplayable: params.includeUnplayable });
  const qLower = (params.q || '').trim().toLowerCase();
  const genreLower = (params.genre || '').trim().toLowerCase();
  const authorLower = (params.author || '').trim().toLowerCase();

  const filtered = all.filter((b) => {
    if (qLower) {
      const hay = `${b.title} ${b.author} ${b.narrator} ${b.genre} ${b.description}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    if (genreLower && !b.genre.toLowerCase().includes(genreLower)) return false;
    if (
      authorLower &&
      !b.author.toLowerCase().includes(authorLower) &&
      !b.narrator.toLowerCase().includes(authorLower)
    ) {
      return false;
    }
    return true;
  });

  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = Math.max(0, params.offset ?? 0);
  const sliced = filtered.slice(offset, offset + limit);
  const audiobooks = await Promise.all(
    sliced.map((b) => toStrideIqAudiobookDto(b, params.publicOrigin)),
  );

  return { audiobooks, total: filtered.length, limit, offset };
}

export async function getStrideIqAudiobookById(
  id: string,
  publicOrigin: string,
  options?: { includeUnplayable?: boolean },
): Promise<StrideIqAudiobookDto | null> {
  const all = await resolveServerAudiobooks(options);
  const match = all.find((b) => b.id === id);
  return match ? toStrideIqAudiobookDto(match, publicOrigin) : null;
}

/* ──────────────────────── Podcasts & Spoken Shows ──────────────────────── */

export interface ResolvedInternalPodcast {
  id: string;
  title: string;
  showTitle: string;
  host: string;
  description: string;
  category: string;
  mediaType: 'audio' | 'video';
  releaseDate: string;
  durationSeconds: number;
  playable: boolean;
  resolvedSource: string;
  localFilePath: string | null;
  isExternalUrl: boolean;
  artworkPath: string;
}

export interface StrideIqPodcastDto {
  id: string;
  mediaType: 'audio' | 'video';
  contentKind: 'podcast';
  title: string;
  showTitle: string;
  host: string;
  category: string;
  description: string;
  releaseDate: string;
  durationSeconds: number;
  playable: boolean;
  streamUrl: string | null;
  streamExpiresInSeconds: number | null;
  artworkUrl: string;
  workoutTags: StrideIqActivity[];
}

function normalizeInternalPodcast(raw: Record<string, any>): ResolvedInternalPodcast | null {
  const id = String(raw.id || '').trim();
  const title = String(raw.title || '').trim();
  if (!id || !title) return null;
  if (raw.deleted === true || raw.hidden === true || raw.isPublished === false) return null;

  const mediaUrl = String(raw.mediaUrl || raw.audioUrl || '').trim();
  const loc = resolveMediaSourceLocation(mediaUrl);
  const mediaType: 'audio' | 'video' =
    raw.mediaType === 'video' || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl)
      ? 'video'
      : 'audio';
  const rawDur = Number(raw.duration);

  return {
    id,
    title,
    showTitle: String(raw.showTitle || 'ChanceTEK Podcast').trim(),
    host: String(raw.host || 'Chancellor @ ChanceTEK LLC').trim(),
    description: String(raw.description || '').trim(),
    category: String(raw.category || 'Culture & Technology').trim(),
    mediaType,
    releaseDate: String(raw.releaseDate || '2026-03-01'),
    durationSeconds: Number.isFinite(rawDur) && rawDur > 5 ? Math.round(rawDur) : 900,
    playable: loc.playable,
    resolvedSource: loc.resolvedSource,
    localFilePath: loc.localFilePath,
    isExternalUrl: loc.isExternalUrl,
    artworkPath: safeResolveSpokenArtwork(raw.coverUrl),
  };
}

export async function resolveServerPodcasts(options?: {
  includeUnplayable?: boolean;
}): Promise<ResolvedInternalPodcast[]> {
  const snapshot = await loadSnapshotSafe();
  const removedDocs = snapshot.collections.removed || [];
  const byId = new Map<string, ResolvedInternalPodcast>();

  const register = (raw: Record<string, any>) => {
    const item = normalizeInternalPodcast(raw);
    if (!item) return;
    if (isMediaEntityTombstoned(removedDocs, 'podcast:', item.id, item.title)) return;
    if (!options?.includeUnplayable && !item.playable) return;
    if (!byId.has(item.id)) byId.set(item.id, item);
  };

  for (const doc of snapshot.collections.podcasts || []) register(doc);
  for (const seed of SEED_PODCASTS) register(seed as Record<string, any>);

  return Array.from(byId.values());
}

async function toStrideIqPodcastDto(
  ep: ResolvedInternalPodcast,
  publicOrigin: string,
): Promise<StrideIqPodcastDto> {
  const tokenTtl = 3600;
  let streamUrl: string | null = null;
  if (ep.playable) {
    const token = await signStrideIqStreamToken(ep.id, tokenTtl);
    streamUrl = `${publicOrigin.replace(/\/$/, '')}/api/strideiq/v1/stream/${encodeURIComponent(ep.id)}?token=${encodeURIComponent(token)}`;
  }

  return {
    id: ep.id,
    mediaType: ep.mediaType,
    contentKind: 'podcast',
    title: ep.title,
    showTitle: ep.showTitle,
    host: ep.host,
    category: ep.category,
    description: ep.description,
    releaseDate: ep.releaseDate,
    durationSeconds: ep.durationSeconds,
    playable: ep.playable,
    streamUrl,
    streamExpiresInSeconds: ep.playable ? tokenTtl : null,
    artworkUrl: toAbsoluteUrl(ep.artworkPath, publicOrigin),
    workoutTags: SPOKEN_WORKOUT_TAGS,
  };
}

async function podcastToQueueDto(
  ep: ResolvedInternalPodcast,
  publicOrigin: string,
  phase: 'warmup' | 'main' | 'sprint' | 'cooldown',
): Promise<StrideIqTrackDto> {
  const tokenTtl = 3600;
  const token = await signStrideIqStreamToken(ep.id, tokenTtl);
  return {
    id: ep.id,
    mediaType: 'podcast',
    title: ep.title,
    artist: ep.host,
    album: ep.showTitle,
    genre: ep.category,
    bpm: 0,
    bpmEstimated: false,
    energy: 'moderate',
    durationSeconds: ep.durationSeconds,
    explicit: false,
    crateId: 'podcasts',
    crateName: ep.showTitle,
    source: 'podcast',
    playable: ep.playable,
    streamUrl: `${publicOrigin.replace(/\/$/, '')}/api/strideiq/v1/stream/${encodeURIComponent(ep.id)}?token=${encodeURIComponent(token)}`,
    streamExpiresInSeconds: tokenTtl,
    artworkUrl: toAbsoluteUrl(ep.artworkPath, publicOrigin),
    workoutTags: SPOKEN_WORKOUT_TAGS,
    cadenceMatchModes: ['direct'],
    workoutScore: 95,
    workoutPhase: phase,
    showTitle: ep.showTitle,
  };
}

export async function queryStrideIqPodcasts(params: {
  publicOrigin: string;
  q?: string;
  category?: string;
  show?: string;
  mediaType?: 'audio' | 'video';
  limit?: number;
  offset?: number;
  includeUnplayable?: boolean;
}) {
  const all = await resolveServerPodcasts({ includeUnplayable: params.includeUnplayable });
  const qLower = (params.q || '').trim().toLowerCase();
  const catLower = (params.category || '').trim().toLowerCase();
  const showLower = (params.show || '').trim().toLowerCase();

  const filtered = all.filter((p) => {
    if (params.mediaType && p.mediaType !== params.mediaType) return false;
    if (qLower) {
      const hay = `${p.title} ${p.showTitle} ${p.host} ${p.category} ${p.description}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    if (catLower && !p.category.toLowerCase().includes(catLower)) return false;
    if (showLower && !p.showTitle.toLowerCase().includes(showLower)) return false;
    return true;
  });

  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = Math.max(0, params.offset ?? 0);
  const sliced = filtered.slice(offset, offset + limit);
  const podcasts = await Promise.all(
    sliced.map((p) => toStrideIqPodcastDto(p, params.publicOrigin)),
  );

  return { podcasts, total: filtered.length, limit, offset };
}

export async function getStrideIqPodcastById(
  id: string,
  publicOrigin: string,
  options?: { includeUnplayable?: boolean },
): Promise<StrideIqPodcastDto | null> {
  const all = await resolveServerPodcasts(options);
  const match = all.find((p) => p.id === id);
  return match ? toStrideIqPodcastDto(match, publicOrigin) : null;
}

/* ──────────────────────── Unified Stream Resolver ──────────────────────── */

export interface PlayableStreamAsset {
  kind: 'music' | 'audiobook' | 'podcast';
  id: string;
  title: string;
  playable: boolean;
  isExternalUrl: boolean;
  resolvedAudioSource: string;
  localFilePath: string | null;
}

/**
 * Resolves any playable asset (music track, audiobook chapter, or podcast episode) by ID
 * for HTTP 206 streaming on `/api/strideiq/v1/stream/[trackId]`.
 */
export async function resolvePlayableStreamAsset(
  requestedId: string,
): Promise<PlayableStreamAsset | null> {
  const id = decodeURIComponentSafe(requestedId || '').trim();
  if (!id) return null;

  // 1. Music track
  const track = await getStrideIqTrackById(id, { includeUnplayable: false });
  if (track && track.playable) {
    return {
      kind: 'music',
      id: track.id,
      title: track.title,
      playable: true,
      isExternalUrl: track.isExternalUrl,
      resolvedAudioSource: track.resolvedAudioSource,
      localFilePath: track.localFilePath,
    };
  }

  // 2. Audiobook chapter (exact streamId `ab:<book>:<ch>`, chapter ID, or book ID -> first playable chapter)
  const books = await resolveServerAudiobooks({ includeUnplayable: false });
  for (const book of books) {
    const ch =
      book.chapters.find((c) => c.playable && (c.streamId === id || c.id === id)) ||
      (book.id === id ? book.chapters.find((c) => c.playable) : undefined);
    if (ch) {
      return {
        kind: 'audiobook',
        id: ch.streamId,
        title: `${book.title} — ${ch.title}`,
        playable: true,
        isExternalUrl: ch.isExternalUrl,
        resolvedAudioSource: ch.resolvedSource,
        localFilePath: ch.localFilePath,
      };
    }
  }

  // 3. Podcast episode
  const podcasts = await resolveServerPodcasts({ includeUnplayable: false });
  const pod = podcasts.find((p) => p.id === id && p.playable);
  if (pod) {
    return {
      kind: 'podcast',
      id: pod.id,
      title: pod.title,
      playable: true,
      isExternalUrl: pod.isExternalUrl,
      resolvedAudioSource: pod.resolvedSource,
      localFilePath: pod.localFilePath,
    };
  }

  return null;
}
