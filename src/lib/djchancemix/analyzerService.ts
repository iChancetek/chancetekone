/**
 * DJChanceMix — Asynchronous Track Analysis Service & Multi-Tier Cache
 *
 * Cache hierarchy:
 * 1. In-memory LRU map (instant)
 * 2. IndexedDB (`djchancemix_analysis_v1`) (persists across browser reloads)
 * 3. Server shared analysis cache (`/api/djchancemix/analysis`) for catalog tracks
 * 4. Real-time Web Audio `decodeAudioData()` + pure-PCM DSP pipeline
 *
 * Privacy guarantee: User-imported local files are NEVER transmitted to the server cache.
 */

import {
  DJTrackSource,
  SilenceSensitivity,
  TrackAudioAnalysis,
} from '@/types/djchancemix';
import { analyzeMonoPcm, audioBufferToMonoPcm } from './dsp/analyzePcm';
import { hashAudioReference, resolveAuthorizedPlayableUrl } from './audioSourceProvider';
import { reportClientAiMetric } from '@/lib/telemetry/wyresClient';

const IDB_NAME = 'djchancemix_analysis_v1';
const IDB_VERSION = 1;
const IDB_STORE = 'track_analyses';

const memoryCache = new Map<string, TrackAudioAnalysis>();
const inFlightAnalyses = new Map<string, Promise<TrackAudioAnalysis>>();
let dbPromise: Promise<IDBDatabase> | null = null;
let decodeAudioCtx: AudioContext | null = null;

function getDecodeAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!decodeAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      decodeAudioCtx = new AudioCtx();
    }
  }
  return decodeAudioCtx;
}

function openAnalysisDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (evt) => {
          const db = (evt.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'trackId' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open analysis IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbPromise;
}

async function readFromIdb(trackId: string): Promise<TrackAudioAnalysis | null> {
  try {
    const db = await openAnalysisDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(trackId);
      req.onsuccess = () => resolve((req.result as TrackAudioAnalysis) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeToIdb(analysis: TrackAudioAnalysis): Promise<void> {
  try {
    const db = await openAnalysisDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(analysis);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Non-fatal
  }
}

async function fetchFromServerCache(trackId: string, audioUrlHash: string): Promise<TrackAudioAnalysis | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(
      `/api/djchancemix/analysis?trackId=${encodeURIComponent(trackId)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const cached = json?.analysis as TrackAudioAnalysis | undefined;
    if (cached && cached.analysisStatus === 'ready' && cached.audioUrlHash === audioUrlHash) {
      return cached;
    }
    return null;
  } catch {
    return null;
  }
}

async function persistToServerCache(analysis: TrackAudioAnalysis): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/djchancemix/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis }),
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Builds a deterministic conservative fallback analysis if CORS prevents raw PCM decoding.
 * Marks bpmConfidence low (0.28) so BeatSync is never forced unsafely without real beat verification.
 */
export function buildFallbackAnalysis(track: DJTrackSource, audioUrlHash: string): TrackAudioAnalysis {
  const duration = Math.max(30, track.duration || 180);
  const bpm = track.bpm && track.bpm >= 60 && track.bpm <= 185 ? track.bpm : 100;
  const barDurationSec = Math.round((60 / bpm) * 4 * 1000) / 1000;

  // Deterministic pseudo-waveform purely for UI continuity when audio buffer is CORS-opaque
  const peaks: number[] = [];
  let seed = 0;
  for (let i = 0; i < track.id.length; i++) seed = (seed * 31 + track.id.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 160; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const env = i < 12 ? i / 12 : i > 144 ? (160 - i) / 16 : 1;
    peaks.push(Math.round((0.28 + ((seed % 1000) / 1000) * 0.62) * env * 1000) / 1000);
  }

  return {
    trackId: track.id,
    audioUrlHash,
    duration,
    sampleRate: 44100,
    analyzedAt: new Date().toISOString(),
    analysisStatus: 'fallback',
    bpm,
    bpmConfidence: 0.28,
    beatOffsetSec: 0,
    barDurationSec,
    timeSignature: 'unknown',
    beatTimestamps: [],
    downbeats: [],
    musicalKey: 'A minor',
    keyRoot: 'A',
    keyMode: 'minor',
    camelotCode: '8A',
    keyConfidence: 0.2,
    chromaVector: new Array(12).fill(1 / 12),
    integratedLufs: -14,
    truePeakDbfs: -1.0,
    dynamicRangeDb: 7,
    recommendedGainDb: 0,
    leadingSilenceSec: 0,
    trailingSilenceSec: 0,
    activeStartSec: 0,
    activeEndSec: duration,
    extendedPauses: [],
    energyScore: 60,
    energyCurve: new Array(64).fill(0.6),
    vocalActivityCurve: new Array(64).fill(0.35),
    introVocalRisk: 0.35,
    outroVocalRisk: 0.35,
    sections: [
      { type: 'intro', startSec: 0, endSec: Math.min(14, duration * 0.12), avgEnergy: 0.45, vocalPresence: 0.25 },
      { type: 'chorus', startSec: Math.min(14, duration * 0.12), endSec: Math.max(20, duration - 14), avgEnergy: 0.68, vocalPresence: 0.5 },
      { type: 'outro', startSec: Math.max(20, duration - 14), endSec: duration, avgEnergy: 0.42, vocalPresence: 0.3 },
    ],
    suggestedCueInSec: 0,
    suggestedMixOutSec: Math.max(10, duration - 10),
    waveformPeaks: peaks,
  };
}

export class TrackAnalyzerService {
  /**
   * Returns an already-cached analysis synchronously if present in memory.
   */
  public static getCached(trackId: string): TrackAudioAnalysis | null {
    return memoryCache.get(trackId) || null;
  }

  /**
   * Analyzes a track using real Web Audio decoding + 4-stage DSP, with multi-tier caching.
   */
  public static async analyzeTrack(
    track: DJTrackSource,
    options?: {
      targetLufs?: number;
      silenceSensitivity?: SilenceSensitivity;
      forceReanalyze?: boolean;
    }
  ): Promise<TrackAudioAnalysis> {
    const resolvedUrl = await resolveAuthorizedPlayableUrl(track);
    const urlHash = hashAudioReference(track.id, track.audioUrl || resolvedUrl);
    const cacheKey = `${track.id}::${options?.silenceSensitivity || 'medium'}`;

    if (!options?.forceReanalyze) {
      const mem = memoryCache.get(track.id);
      if (mem && mem.audioUrlHash === urlHash && mem.analysisStatus === 'ready') {
        return mem;
      }

      const pending = inFlightAnalyses.get(cacheKey);
      if (pending) return pending;
    }

    const work = (async (): Promise<TrackAudioAnalysis> => {
      const startedMs = Date.now();
      const startTime = new Date(startedMs).toISOString();

      // 1. Check IndexedDB persistent browser cache
      if (!options?.forceReanalyze) {
        const idbCached = await readFromIdb(track.id);
        if (idbCached && idbCached.audioUrlHash === urlHash && idbCached.analysisStatus === 'ready') {
          memoryCache.set(track.id, idbCached);
          return idbCached;
        }

        // 2. Check shared server cache (ONLY for non-private catalog tracks)
        if (track.sourceType !== 'local-file') {
          const serverCached = await fetchFromServerCache(track.id, urlHash);
          if (serverCached) {
            memoryCache.set(track.id, serverCached);
            void writeToIdb(serverCached);
            return serverCached;
          }
        }
      }

      // 3. Decode actual audio bytes into PCM via Web Audio API
      try {
        const audioCtx = getDecodeAudioContext();
        if (!audioCtx) {
          const fb = buildFallbackAnalysis(track, urlHash);
          memoryCache.set(track.id, fb);
          return fb;
        }

        let arrayBuffer: ArrayBuffer;
        if (track.sourceType === 'local-file' && track.localFile) {
          arrayBuffer = await track.localFile.arrayBuffer();
        } else {
          const res = await fetch(resolvedUrl, { mode: 'cors' });
          if (!res.ok) {
            throw new Error(`Audio fetch HTTP ${res.status}`);
          }
          arrayBuffer = await res.arrayBuffer();
        }

        // Copy buffer before decodeAudioData because Web Audio detaches the transferred buffer
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        const monoPcm = audioBufferToMonoPcm(decoded);

        const analysis = await analyzeMonoPcm(monoPcm, decoded.sampleRate, {
          trackId: track.id,
          audioUrlHash: urlHash,
          hintBpm: track.bpm,
          targetLufs: options?.targetLufs ?? -14,
          silenceSensitivity: options?.silenceSensitivity ?? 'medium',
          yieldToMainThread: true,
        });

        memoryCache.set(track.id, analysis);
        void writeToIdb(analysis);
        if (track.sourceType !== 'local-file') {
          void persistToServerCache(analysis);
        }

        const endedMs = Date.now();
        reportClientAiMetric({
          name: 'djchancemix:dsp-track-analysis',
          runType: 'agent',
          provider: 'chancetek-agent',
          model: 'djchancemix-dsp-v1',
          category: 'agentic_agent',
          feature: 'djchancemix-audio-analysis',
          startTime,
          endTime: new Date(endedMs).toISOString(),
          latencyMs: endedMs - startedMs,
          input: {
            trackId: track.id,
            title: track.title,
            sourceType: track.sourceType,
          },
          output: {
            bpm: analysis.bpm,
            bpmConfidence: analysis.bpmConfidence,
            musicalKey: analysis.musicalKey,
            camelotCode: analysis.camelotCode,
            integratedLufs: analysis.integratedLufs,
            energyScore: analysis.energyScore,
            leadingSilenceSec: analysis.leadingSilenceSec,
            trailingSilenceSec: analysis.trailingSilenceSec,
          },
          tags: ['djchancemix', 'dsp', 'audio-analysis'],
        });

        return analysis;
      } catch (err) {
        console.warn(`[DJChanceMix] Fallback analysis for "${track.title}":`, err);
        const fb = buildFallbackAnalysis(track, urlHash);
        memoryCache.set(track.id, fb);
        return fb;
      }
    })();

    inFlightAnalyses.set(cacheKey, work);
    try {
      return await work;
    } finally {
      inFlightAnalyses.delete(cacheKey);
    }
  }
}

