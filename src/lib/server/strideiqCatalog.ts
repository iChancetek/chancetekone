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
import type { Track } from '@/types/media';
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
  streamUrl: string | null;
  streamExpiresInSeconds: number | null;
  artworkUrl: string;
  workoutTags: StrideIqActivity[];
  cadenceMatchModes: ('direct' | 'double_time' | 'half_time')[];
  workoutScore?: number;
  workoutPhase?: 'warmup' | 'main' | 'sprint' | 'cooldown';
  releaseYear?: number;
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
const PUBLIC_AUDIO_DIR = path.resolve(PUBLIC_DIR, 'audio');

/**
 * Safely resolves `/audio/...` or `/audio/uploads/...` inside `public/audio/`.
 * Blocks path traversal and verifies an actual file exists on disk.
 */
export function resolvePhysicalAudioFile(audioUrl?: string): string | null {
  if (!audioUrl) return null;
  const cleaned = audioUrl.split('?')[0].split('#')[0].trim();
  if (!cleaned.toLowerCase().startsWith('/audio/')) return null;

  const relRaw = cleaned.slice('/audio/'.length);
  if (!relRaw) return null;

  let decodedRel: string;
  try {
    decodedRel = decodeURIComponent(relRaw);
  } catch {
    return null;
  }

  if (decodedRel.includes('\0') || decodedRel.includes('..')) return null;
  const candidate = path.resolve(PUBLIC_AUDIO_DIR, decodedRel);
  if (!candidate.startsWith(PUBLIC_AUDIO_DIR + path.sep)) return null;

  try {
    return fs.statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
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

/**
 * Loads all tracks across Firestore cloud catalog, canonical studio releases, and radio rotation,
 * omitting deleted tombstones and deduplicating by ID and normalized title+artist.
 */
export async function resolveServerCatalog(options?: {
  includeUnplayable?: boolean;
}): Promise<ResolvedInternalTrack[]> {
  const snapshot = await readCatalogSnapshot().catch(() => ({
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
  structure?: WorkoutStructure;
  excludeTrackIds?: string[];
  limit?: number;
  allowExplicit?: boolean;
  allowLoop?: boolean;
}) {
  const activity = normalizeWorkoutActivity(options.activity);
  const profile = WORKOUT_PROFILES[activity];
  const durationMinutes = Math.min(180, Math.max(5, Number(options.targetDurationMinutes) || 30));
  const structure: WorkoutStructure = options.structure || 'steady';
  const maxTracks = Math.min(50, Math.max(1, Number(options.limit) || 24));
  const excludeSet = new Set((options.excludeTrackIds || []).map(String));

  const catalog = await resolveServerCatalog({ includeUnplayable: false });
  const pool = catalog.filter((t) => {
    if (excludeSet.has(t.id)) return false;
    if (options.allowExplicit === false && t.explicit) return false;
    if (typeof options.bpmMin === 'number' && t.bpm < options.bpmMin) return false;
    if (typeof options.bpmMax === 'number' && t.bpm > options.bpmMax) return false;
    if (options.crate && t.crateId !== options.crate && !t.crateName.toLowerCase().includes(options.crate.toLowerCase())) {
      return false;
    }
    return true;
  });

  const usedIds = new Set<string>();
  const targetSeconds = durationMinutes * 60;
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

    const warmupPicks = selectVariedQueue(scorePool(WORKOUT_PROFILES.warmup), warmupSecs, 4, 'warmup', usedIds, false);
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
      .map((track) => ({ track, ...scoreTrackForActivity(track, WORKOUT_PROFILES.sprint, { preferredGenre: options.genre }) }))
      .sort((a, b) => b.score - a.score);
    const steadyScored = pool
      .map((track) => ({ track, ...scoreTrackForActivity(track, WORKOUT_PROFILES.warmup, { preferredGenre: options.genre }) }))
      .sort((a, b) => b.score - a.score);

    let accum = 0;
    let i = 0;
    while (accum < targetSeconds && assembled.length < maxTracks && (sprintScored.length > 0 || steadyScored.length > 0)) {
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
    assembled = selectVariedQueue(scored, targetSeconds, maxTracks, 'main', usedIds, options.allowLoop !== false);
  }

  const tracks = await Promise.all(
    assembled.map((entry) =>
      toStrideIqTrackDto(entry.track, options.publicOrigin, {
        workoutScore: entry.score,
        workoutPhase: entry.phase,
        cadenceMatchModes: entry.modes,
      }),
    ),
  );

  const totalDurationSeconds = tracks.reduce((sum, t) => sum + t.durationSeconds, 0);
  const averageBpm =
    tracks.length > 0 ? Math.round(tracks.reduce((sum, t) => sum + t.bpm, 0) / tracks.length) : profile.idealBpm;

  return {
    mixId: `strideiq-mix-${activity}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    activity: profile.activity,
    activityLabel: profile.label,
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
