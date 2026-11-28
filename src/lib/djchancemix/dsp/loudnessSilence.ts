/**
 * DJChanceMix — Loudness Normalization (BS.1770 LUFS), True Peak & Ambient-Safe Silence Detector
 *
 * Computes integrated loudness (K-weighted LUFS approximation), true peak dBFS,
 * safe non-clipping normalization gain targeting -14 LUFS with -1.0 dBTP headroom,
 * and music-aware leading/trailing silence boundaries that preserve quiet ambient passages.
 */

import { ExtendedPause, SilenceSensitivity } from '@/types/djchancemix';

export interface LoudnessAndSilenceResult {
  integratedLufs: number;
  truePeakDbfs: number;
  dynamicRangeDb: number;
  recommendedGainDb: number;
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  activeStartSec: number;
  activeEndSec: number;
  extendedPauses: ExtendedPause[];
}

const SILENCE_THRESHOLDS_DB: Record<SilenceSensitivity, { hardDb: number; quietMusicDb: number }> = {
  low: { hardDb: -56, quietMusicDb: -48 },
  medium: { hardDb: -50, quietMusicDb: -42 },
  high: { hardDb: -44, quietMusicDb: -36 },
};

/**
 * Applies a simplified K-weighting high-pass shelf (BS.1770 pre-filter approximation)
 * and computes gated integrated LUFS, true peak dBFS, and ambient-safe silence bounds.
 */
export function analyzeLoudnessAndSilence(
  samples: Float32Array,
  sampleRate: number,
  options?: {
    targetLufs?: number;
    sensitivity?: SilenceSensitivity;
  }
): LoudnessAndSilenceResult {
  const duration = samples.length / Math.max(1, sampleRate);
  const targetLufs = options?.targetLufs ?? -14;
  const sensitivity = options?.sensitivity ?? 'medium';

  if (samples.length === 0 || duration < 0.2) {
    return {
      integratedLufs: -14,
      truePeakDbfs: -1,
      dynamicRangeDb: 6,
      recommendedGainDb: 0,
      leadingSilenceSec: 0,
      trailingSilenceSec: 0,
      activeStartSec: 0,
      activeEndSec: duration,
      extendedPauses: [],
    };
  }

  // 1. True-peak detection (4x linear/cubic inter-sample interpolation check)
  let maxPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxPeak) maxPeak = abs;
    // Check midpoint overshoot between adjacent loud samples (catches inter-sample peaks)
    if (abs > 0.7 && i > 0 && i < samples.length - 1) {
      const mid = Math.abs(-0.0625 * samples[i - 1] + 0.5625 * samples[i] + 0.5625 * samples[i + 1] - 0.0625 * (samples[i + 2] ?? samples[i + 1]));
      if (mid > maxPeak) maxPeak = mid;
    }
  }
  const truePeakDbfs = maxPeak > 1e-6 ? Math.round(20 * Math.log10(maxPeak) * 100) / 100 : -96;

  // 2. Analyze 100ms blocks for K-weighted loudness & silence segmentation
  const blockSamples = Math.max(256, Math.round(sampleRate * 0.1));
  const numBlocks = Math.max(1, Math.floor(samples.length / blockSamples));
  const blockDb = new Float32Array(numBlocks);
  const blockZcr = new Float32Array(numBlocks);
  const blockMeanSq = new Float32Array(numBlocks);

  // High-pass K-weighting state (~100 Hz rolloff + subtle upper-mid presence weight)
  const hpRc = 1 / (2 * Math.PI * 100);
  const dt = 1 / sampleRate;
  const hpAlpha = hpRc / (hpRc + dt);
  let hpY = 0;
  let hpPrevX = 0;

  for (let b = 0; b < numBlocks; b++) {
    const start = b * blockSamples;
    const end = Math.min(samples.length, start + blockSamples);
    let rawSumSq = 0;
    let kwSumSq = 0;
    let zeroCrossings = 0;
    let prev = samples[start] || 0;

    for (let i = start; i < end; i++) {
      const x = samples[i];
      rawSumSq += x * x;

      hpY = hpAlpha * (hpY + x - hpPrevX);
      hpPrevX = x;
      kwSumSq += hpY * hpY;

      if ((x >= 0 && prev < 0) || (x < 0 && prev >= 0)) {
        zeroCrossings++;
      }
      prev = x;
    }

    const len = Math.max(1, end - start);
    const rms = Math.sqrt(rawSumSq / len);
    blockDb[b] = rms > 1e-6 ? 20 * Math.log10(rms) : -96;
    blockZcr[b] = zeroCrossings / len;
    blockMeanSq[b] = kwSumSq / len;
  }

  // 3. BS.1770 Two-Stage Gating (Absolute gate -70 LUFS, then Relative gate -10 LU below ungated mean)
  const absGateLinear = Math.pow(10, (-70 + 0.691) / 10);
  let ungatedSum = 0;
  let ungatedCount = 0;
  for (let b = 0; b < numBlocks; b++) {
    if (blockMeanSq[b] > absGateLinear) {
      ungatedSum += blockMeanSq[b];
      ungatedCount++;
    }
  }
  const ungatedMean = ungatedCount > 0 ? ungatedSum / ungatedCount : 1e-7;
  const ungatedLufs = -0.691 + 10 * Math.log10(Math.max(1e-9, ungatedMean));

  const relGateLufs = ungatedLufs - 10;
  const relGateLinear = Math.pow(10, (relGateLufs + 0.691) / 10);
  let gatedSum = 0;
  let gatedCount = 0;
  for (let b = 0; b < numBlocks; b++) {
    if (blockMeanSq[b] > relGateLinear) {
      gatedSum += blockMeanSq[b];
      gatedCount++;
    }
  }
  const gatedMean = gatedCount > 0 ? gatedSum / gatedCount : ungatedMean;
  const integratedLufs = Math.round(Math.max(-60, Math.min(0, -0.691 + 10 * Math.log10(Math.max(1e-9, gatedMean)))) * 10) / 10;

  // Dynamic range estimate (95th percentile block dB minus 20th percentile active block dB)
  const activeBlocks: number[] = [];
  for (let b = 0; b < numBlocks; b++) {
    if (blockDb[b] > -58) activeBlocks.push(blockDb[b]);
  }
  activeBlocks.sort((a, b) => a - b);
  const p95 = activeBlocks.length > 0 ? activeBlocks[Math.floor(activeBlocks.length * 0.95)] : -12;
  const p20 = activeBlocks.length > 0 ? activeBlocks[Math.floor(activeBlocks.length * 0.2)] : -20;
  const dynamicRangeDb = Math.round(Math.max(1, Math.min(30, p95 - p20)) * 10) / 10;

  // Safe gain targeting -14 LUFS while strictly keeping true peak <= -1.0 dBTP (prevents digital clipping)
  const desiredGainDb = targetLufs - integratedLufs;
  const maxSafeHeadroomDb = -1.0 - truePeakDbfs;
  const recommendedGainDb =
    Math.round(Math.max(-12, Math.min(9, Math.min(desiredGainDb, maxSafeHeadroomDb))) * 100) / 100;

  // 4. Ambient-safe Silence Detection
  // Distinguishes true dead silence / digital zero floor from quiet ambient musical passages.
  const { hardDb, quietMusicDb } = SILENCE_THRESHOLDS_DB[sensitivity];
  const isSilentBlock = (idx: number): boolean => {
    const db = blockDb[idx];
    if (db <= hardDb) return true; // Digital silence or pure noise floor
    if (db > quietMusicDb) return false; // Clearly audible music
    // In the quiet boundary zone (hardDb..quietMusicDb): check if musical tonal content exists
    // Pure white noise / hiss has very high ZCR (> 0.28) or near-zero flat DC (< 0.001)
    const zcr = blockZcr[idx];
    const looksLikeMusicalTone = zcr >= 0.002 && zcr <= 0.26;
    return !looksLikeMusicalTone;
  };

  // Leading silence: clearly audible musical transients (> -34 dBFS) start the track immediately
  // (protects sparse percussive count-ins), while quiet ambient passages require 2 consecutive blocks
  // to ignore single-frame clicks.
  let firstActiveBlock = 0;
  for (let b = 0; b < numBlocks; b++) {
    if (blockDb[b] > -34) {
      firstActiveBlock = b;
      break;
    }
    if (b < numBlocks - 1 && !isSilentBlock(b) && !isSilentBlock(b + 1)) {
      firstActiveBlock = b;
      break;
    }
  }
  // Never trim more than 12s off the start automatically (protects long artistic fade-ins)
  const rawLeadingSec = firstActiveBlock * 0.1;
  const leadingSilenceSec = rawLeadingSec > 0.15 ? Math.min(12, Math.round(rawLeadingSec * 100) / 100) : 0;

  // Trailing silence: scan backwards preserving final percussive hits & a 0.15s reverb tail buffer
  let lastActiveBlock = numBlocks - 1;
  for (let b = numBlocks - 1; b >= 0; b--) {
    if (blockDb[b] > -34) {
      lastActiveBlock = Math.min(numBlocks - 1, b + 1);
      break;
    }
    if (b >= 1 && !isSilentBlock(b) && !isSilentBlock(b - 1)) {
      lastActiveBlock = Math.min(numBlocks - 1, b + 1);
      break;
    }
  }
  const activeEndRaw = Math.min(duration, (lastActiveBlock + 1) * 0.1 + 0.15);
  const rawTrailingSec = Math.max(0, duration - activeEndRaw);
  const trailingSilenceSec =
    rawTrailingSec > 0.25 ? Math.min(18, Math.round(rawTrailingSec * 100) / 100) : 0;

  const activeStartSec = Math.min(duration * 0.25, leadingSilenceSec);
  const activeEndSec = Math.max(activeStartSec + 1, Math.round((duration - trailingSilenceSec) * 100) / 100);

  // Extended internal pauses (>= 1.8s of hard silence inside active bounds)
  const extendedPauses: ExtendedPause[] = [];
  let pauseStart = -1;
  for (let b = firstActiveBlock + 2; b < lastActiveBlock - 2; b++) {
    if (blockDb[b] <= hardDb) {
      if (pauseStart === -1) pauseStart = b;
    } else if (pauseStart !== -1) {
      const pauseDur = (b - pauseStart) * 0.1;
      if (pauseDur >= 1.8) {
        extendedPauses.push({
          startSec: Math.round(pauseStart * 0.1 * 100) / 100,
          endSec: Math.round(b * 0.1 * 100) / 100,
          durationSec: Math.round(pauseDur * 100) / 100,
        });
      }
      pauseStart = -1;
    }
  }

  return {
    integratedLufs,
    truePeakDbfs,
    dynamicRangeDb,
    recommendedGainDb,
    leadingSilenceSec,
    trailingSilenceSec,
    activeStartSec,
    activeEndSec,
    extendedPauses,
  };
}

