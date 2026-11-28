/**
 * DJChanceMix — Unified Pure-PCM DSP Audio Analysis Pipeline
 *
 * Orchestrates Loudness/Silence, BPM/Beat-Grid, Musical Key/Camelot, and Structural/Vocal
 * analysis directly over Float32Array mono PCM samples. Runs identically in browser
 * Web Audio contexts and Node.js automated test suites.
 */

import { SilenceSensitivity, TrackAudioAnalysis } from '@/types/djchancemix';
import { analyzeLoudnessAndSilence } from './loudnessSilence';
import { detectBpmAndBeatGrid } from './bpmDetector';
import { detectMusicalKey } from './keyDetector';
import { analyzeTrackStructure } from './structureAnalyzer';

export interface AnalyzePcmOptions {
  trackId: string;
  audioUrlHash: string;
  hintBpm?: number;
  targetLufs?: number;
  silenceSensitivity?: SilenceSensitivity;
  yieldToMainThread?: boolean;
}

const yieldFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Downmixes a browser AudioBuffer into mono Float32Array PCM.
 */
export function audioBufferToMonoPcm(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  if (channels <= 1) {
    return buffer.getChannelData(0);
  }
  const mono = new Float32Array(length);
  const scale = 1 / channels;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] * scale;
    }
  }
  return mono;
}

/**
 * Executes the complete 4-stage DSP pipeline over mono PCM audio.
 */
export async function analyzeMonoPcm(
  samples: Float32Array,
  sampleRate: number,
  options: AnalyzePcmOptions
): Promise<TrackAudioAnalysis> {
  const duration = Math.round((samples.length / Math.max(1, sampleRate)) * 1000) / 1000;

  // Stage 1: Loudness (LUFS), True Peak, Ambient-Safe Silence Bounds
  const loudness = analyzeLoudnessAndSilence(samples, sampleRate, {
    targetLufs: options.targetLufs ?? -14,
    sensitivity: options.silenceSensitivity ?? 'medium',
  });
  if (options.yieldToMainThread) await yieldFrame();

  // Stage 2: BPM, Beat Grid & Downbeats
  const rhythm = detectBpmAndBeatGrid(samples, sampleRate, {
    hintBpm: options.hintBpm,
    activeStartSec: loudness.activeStartSec,
    activeEndSec: loudness.activeEndSec,
  });
  if (options.yieldToMainThread) await yieldFrame();

  // Stage 3: Musical Key, Mode & Camelot Notation
  const harmony = detectMusicalKey(samples, sampleRate, {
    activeStartSec: loudness.activeStartSec,
    activeEndSec: loudness.activeEndSec,
  });
  if (options.yieldToMainThread) await yieldFrame();

  // Stage 4: Musical Structure, Energy, Vocal Presence & Waveform Peaks
  const structure = analyzeTrackStructure(samples, sampleRate, {
    activeStartSec: loudness.activeStartSec,
    activeEndSec: loudness.activeEndSec,
    downbeats: rhythm.downbeats,
    barDurationSec: rhythm.barDurationSec,
  });

  return {
    trackId: options.trackId,
    audioUrlHash: options.audioUrlHash,
    duration,
    sampleRate,
    analyzedAt: new Date().toISOString(),
    analysisStatus: 'ready',

    bpm: rhythm.bpm,
    bpmConfidence: rhythm.bpmConfidence,
    beatOffsetSec: rhythm.beatOffsetSec,
    barDurationSec: rhythm.barDurationSec,
    timeSignature: rhythm.timeSignature,
    beatTimestamps: rhythm.beatTimestamps,
    downbeats: rhythm.downbeats,

    musicalKey: harmony.musicalKey,
    keyRoot: harmony.keyRoot,
    keyMode: harmony.keyMode,
    camelotCode: harmony.camelotCode,
    keyConfidence: harmony.keyConfidence,
    chromaVector: harmony.chromaVector,

    integratedLufs: loudness.integratedLufs,
    truePeakDbfs: loudness.truePeakDbfs,
    dynamicRangeDb: loudness.dynamicRangeDb,
    recommendedGainDb: loudness.recommendedGainDb,

    leadingSilenceSec: loudness.leadingSilenceSec,
    trailingSilenceSec: loudness.trailingSilenceSec,
    activeStartSec: loudness.activeStartSec,
    activeEndSec: loudness.activeEndSec,
    extendedPauses: loudness.extendedPauses,

    energyScore: structure.energyScore,
    energyCurve: structure.energyCurve,
    vocalActivityCurve: structure.vocalActivityCurve,
    introVocalRisk: structure.introVocalRisk,
    outroVocalRisk: structure.outroVocalRisk,
    sections: structure.sections,
    suggestedCueInSec: structure.suggestedCueInSec,
    suggestedMixOutSec: structure.suggestedMixOutSec,
    waveformPeaks: structure.waveformPeaks,
  };
}

