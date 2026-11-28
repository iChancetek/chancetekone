/**
 * DJChanceMix — Server-Side Persistence Store (Firestore + Local JSON Fallback)
 *
 * Persists:
 * 1. `djchancemix_configs` — per-user MixConfiguration
 * 2. `djchancemix_analyses` — shared TrackAudioAnalysis DSP cache
 * 3. `djchancemix_playlist_settings` — per-user, per-playlist AutoMix overrides
 */

import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';
import {
  CrossfadeCurve,
  DEFAULT_MIX_CONFIGURATION,
  MixConfiguration,
  MixMode,
  PlaylistMixSettings,
  SilenceSensitivity,
  TrackAudioAnalysis,
} from '@/types/djchancemix';

const CONFIGS_COLLECTION = 'djchancemix_configs';
const ANALYSES_COLLECTION = 'djchancemix_analyses';
const PLAYLIST_SETTINGS_COLLECTION = 'djchancemix_playlist_settings';

interface LocalDJStoreShape {
  configs: Record<string, MixConfiguration>;
  analyses: Record<string, TrackAudioAnalysis>;
  playlistSettings: Record<string, PlaylistMixSettings>;
}

const VALID_MODES = new Set<MixMode>([
  'automix',
  'smart-crossfade',
  'beatsync',
  'harmonic',
  'continuous',
  'original',
]);

const VALID_CURVES = new Set<CrossfadeCurve>([
  'equal-power',
  'linear',
  'adaptive',
  'volume-aware',
]);

const VALID_SENSITIVITIES = new Set<SilenceSensitivity>(['low', 'medium', 'high']);

function canUseFirebaseAdmin(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
  );
}

function getLocalPath(): string {
  return path.join(process.cwd(), '.data', 'djchancemix_store.json');
}

function readLocal(): LocalDJStoreShape {
  try {
    const file = getLocalPath();
    if (!fs.existsSync(file)) {
      return { configs: {}, analyses: {}, playlistSettings: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      configs: parsed?.configs && typeof parsed.configs === 'object' ? parsed.configs : {},
      analyses: parsed?.analyses && typeof parsed.analyses === 'object' ? parsed.analyses : {},
      playlistSettings:
        parsed?.playlistSettings && typeof parsed.playlistSettings === 'object'
          ? parsed.playlistSettings
          : {},
    };
  } catch {
    return { configs: {}, analyses: {}, playlistSettings: {} };
  }
}

function writeLocal(store: LocalDJStoreShape): void {
  try {
    const dir = path.dirname(getLocalPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const target = getLocalPath();
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch {
    // Non-fatal in read-only serverless containers
  }
}

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function sanitizeDocId(raw: string): string {
  return String(raw || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._:@-]/g, '_')
    .slice(0, 140);
}

export function sanitizeMixConfiguration(
  raw: Partial<MixConfiguration>,
  userId?: string
): MixConfiguration {
  const mode = VALID_MODES.has(raw.defaultMode as MixMode)
    ? (raw.defaultMode as MixMode)
    : DEFAULT_MIX_CONFIGURATION.defaultMode;
  const curve = VALID_CURVES.has(raw.crossfadeCurve as CrossfadeCurve)
    ? (raw.crossfadeCurve as CrossfadeCurve)
    : DEFAULT_MIX_CONFIGURATION.crossfadeCurve;
  const sensitivity = VALID_SENSITIVITIES.has(raw.silenceSensitivity as SilenceSensitivity)
    ? (raw.silenceSensitivity as SilenceSensitivity)
    : DEFAULT_MIX_CONFIGURATION.silenceSensitivity;

  const crossfadeDurationSec = Math.max(
    1,
    Math.min(30, Number(raw.crossfadeDurationSec ?? DEFAULT_MIX_CONFIGURATION.crossfadeDurationSec))
  );
  const maxTempoAdjustmentPercent = Math.max(
    2,
    Math.min(16, Number(raw.maxTempoAdjustmentPercent ?? DEFAULT_MIX_CONFIGURATION.maxTempoAdjustmentPercent))
  );
  const targetLufs = Math.max(
    -24,
    Math.min(-8, Number(raw.targetLufs ?? DEFAULT_MIX_CONFIGURATION.targetLufs))
  );

  return stripUndefined({
    userId: userId || raw.userId || 'guest',
    defaultMode: mode,
    crossfadeDurationSec,
    autoTransitionDuration:
      typeof raw.autoTransitionDuration === 'boolean'
        ? raw.autoTransitionDuration
        : DEFAULT_MIX_CONFIGURATION.autoTransitionDuration,
    crossfadeCurve: curve,
    maxTempoAdjustmentPercent,
    allowPitchShift:
      typeof raw.allowPitchShift === 'boolean'
        ? raw.allowPitchShift
        : DEFAULT_MIX_CONFIGURATION.allowPitchShift,
    harmonicMixingEnabled:
      typeof raw.harmonicMixingEnabled === 'boolean'
        ? raw.harmonicMixingEnabled
        : DEFAULT_MIX_CONFIGURATION.harmonicMixingEnabled,
    silenceSensitivity: sensitivity,
    removeSilenceGaps:
      typeof raw.removeSilenceGaps === 'boolean'
        ? raw.removeSilenceGaps
        : DEFAULT_MIX_CONFIGURATION.removeSilenceGaps,
    normalizationEnabled:
      typeof raw.normalizationEnabled === 'boolean'
        ? raw.normalizationEnabled
        : DEFAULT_MIX_CONFIGURATION.normalizationEnabled,
    targetLufs,
    eqBassSwapEnabled:
      typeof raw.eqBassSwapEnabled === 'boolean'
        ? raw.eqBassSwapEnabled
        : DEFAULT_MIX_CONFIGURATION.eqBassSwapEnabled,
    vocalProtectionEnabled:
      typeof raw.vocalProtectionEnabled === 'boolean'
        ? raw.vocalProtectionEnabled
        : DEFAULT_MIX_CONFIGURATION.vocalProtectionEnabled,
    updatedAt: new Date().toISOString(),
  });
}

export function sanitizeTrackAnalysis(raw: TrackAudioAnalysis): TrackAudioAnalysis {
  // Cap timestamp arrays neatly so every Firestore doc stays ultra-light (< 18 KB)
  return stripUndefined({
    ...raw,
    trackId: String(raw.trackId).slice(0, 140),
    audioUrlHash: String(raw.audioUrlHash || '').slice(0, 80),
    beatTimestamps: Array.isArray(raw.beatTimestamps) ? raw.beatTimestamps.slice(0, 1200) : [],
    downbeats: Array.isArray(raw.downbeats) ? raw.downbeats.slice(0, 350) : [],
    chromaVector: Array.isArray(raw.chromaVector) ? raw.chromaVector.slice(0, 12) : [],
    energyCurve: Array.isArray(raw.energyCurve) ? raw.energyCurve.slice(0, 64) : [],
    vocalActivityCurve: Array.isArray(raw.vocalActivityCurve) ? raw.vocalActivityCurve.slice(0, 64) : [],
    waveformPeaks: Array.isArray(raw.waveformPeaks) ? raw.waveformPeaks.slice(0, 160) : [],
    sections: Array.isArray(raw.sections) ? raw.sections.slice(0, 16) : [],
    extendedPauses: Array.isArray(raw.extendedPauses) ? raw.extendedPauses.slice(0, 16) : [],
    analyzedAt: raw.analyzedAt || new Date().toISOString(),
  });
}

// ── Mix Configuration CRUD ───────────────────────────────────────────

export async function getServerMixConfig(userId: string): Promise<MixConfiguration> {
  const key = sanitizeDocId(userId);
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const snap = await adminDb.collection(CONFIGS_COLLECTION).doc(key).get();
      if (snap.exists) {
        return sanitizeMixConfiguration(snap.data() as Partial<MixConfiguration>, userId);
      }
    } catch {
      // fall through to local
    }
  }
  const local = readLocal();
  if (local.configs[key]) {
    return sanitizeMixConfiguration(local.configs[key], userId);
  }
  return sanitizeMixConfiguration(DEFAULT_MIX_CONFIGURATION, userId);
}

export async function saveServerMixConfig(
  userId: string,
  config: Partial<MixConfiguration>
): Promise<MixConfiguration> {
  const key = sanitizeDocId(userId);
  const clean = sanitizeMixConfiguration(config, userId);

  const local = readLocal();
  local.configs[key] = clean;
  writeLocal(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(CONFIGS_COLLECTION).doc(key).set(clean, { merge: true });
    } catch (err) {
      console.warn('[djChanceMixStore] Firestore config write warning:', err);
    }
  }
  return clean;
}

// ── Track Audio Analysis Cache CRUD ──────────────────────────────────

export async function getServerTrackAnalysis(trackId: string): Promise<TrackAudioAnalysis | null> {
  const key = sanitizeDocId(trackId);
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const snap = await adminDb.collection(ANALYSES_COLLECTION).doc(key).get();
      if (snap.exists) return snap.data() as TrackAudioAnalysis;
    } catch {}
  }
  const local = readLocal();
  return local.analyses[key] || null;
}

export async function saveServerTrackAnalysis(
  analysis: TrackAudioAnalysis
): Promise<TrackAudioAnalysis> {
  const clean = sanitizeTrackAnalysis(analysis);
  const key = sanitizeDocId(clean.trackId);

  const local = readLocal();
  local.analyses[key] = clean;
  writeLocal(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(ANALYSES_COLLECTION).doc(key).set(clean, { merge: true });
    } catch (err) {
      console.warn('[djChanceMixStore] Firestore analysis write warning:', err);
    }
  }
  return clean;
}

// ── Per-Playlist Mix Settings CRUD ───────────────────────────────────

export async function getServerPlaylistMixSettings(
  userId: string,
  playlistId: string
): Promise<PlaylistMixSettings | null> {
  const key = sanitizeDocId(`${userId}__${playlistId}`);
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const snap = await adminDb.collection(PLAYLIST_SETTINGS_COLLECTION).doc(key).get();
      if (snap.exists) return snap.data() as PlaylistMixSettings;
    } catch {}
  }
  const local = readLocal();
  return local.playlistSettings[key] || null;
}

export async function saveServerPlaylistMixSettings(
  userId: string,
  settings: PlaylistMixSettings
): Promise<PlaylistMixSettings> {
  const key = sanitizeDocId(`${userId}__${settings.playlistId}`);
  const clean: PlaylistMixSettings = stripUndefined({
    playlistId: String(settings.playlistId).slice(0, 120),
    userId: String(userId).slice(0, 120),
    autoMixEnabled: Boolean(settings.autoMixEnabled),
    mixingMode: VALID_MODES.has(settings.mixingMode) ? settings.mixingMode : 'automix',
    shuffleAware: settings.shuffleAware !== false,
    updatedAt: new Date().toISOString(),
  });

  const local = readLocal();
  local.playlistSettings[key] = clean;
  writeLocal(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(PLAYLIST_SETTINGS_COLLECTION).doc(key).set(clean, { merge: true });
    } catch (err) {
      console.warn('[djChanceMixStore] Firestore playlist settings write warning:', err);
    }
  }
  return clean;
}

