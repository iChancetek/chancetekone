/**
 * DJChanceMix — Musical Key Detection & Camelot Wheel Harmonic Engine
 *
 * Extracts a 12-semitone Pitch Class Profile (Chroma Vector) across 4 octaves (C2–B5)
 * using Goertzel resonators, correlates against Krumhansl-Schmuckler tonal profiles
 * across all 24 major/minor keys, and maps results onto the Camelot Wheel (1A–12B).
 */

import { HarmonicRelation } from '@/types/djchancemix';

export interface KeyAnalysisResult {
  musicalKey: string;
  keyRoot: string;
  keyMode: 'major' | 'minor';
  camelotCode: string;
  keyConfidence: number; // 0..1
  chromaVector: number[]; // 12 pitch classes C..B
}

export const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

// Krumhansl-Schmuckler empirically derived tonal hierarchy profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Camelot Wheel mapping indexed by pitch class (0=C .. 11=B)
const CAMELOT_MAJOR: string[] = [
  '8B', // C
  '3B', // C#/Db
  '10B', // D
  '5B', // Eb
  '12B', // E
  '7B', // F
  '2B', // F#/Gb
  '9B', // G
  '4B', // Ab
  '11B', // A
  '6B', // Bb
  '1B', // B
];

const CAMELOT_MINOR: string[] = [
  '5A', // C minor
  '12A', // C# minor
  '7A', // D minor
  '2A', // Eb minor
  '9A', // E minor
  '4A', // F minor
  '11A', // F# minor
  '6A', // G minor
  '1A', // Ab minor
  '8A', // A minor
  '3A', // Bb minor
  '10A', // B minor
];

/**
 * Goertzel single-frequency energy estimator (O(N) per bin, zero FFT library overhead).
 */
function goertzelPower(frame: Float32Array, targetFreqHz: number, sampleRate: number): number {
  const n = frame.length;
  const omega = (2 * Math.PI * targetFreqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let sPrev = 0;
  let sPrev2 = 0;

  for (let i = 0; i < n; i++) {
    // Hann window approximation reduces spectral leakage between adjacent semitones
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const s = frame[i] * w + coeff * sPrev - sPrev2;
    sPrev2 = sPrev;
    sPrev = s;
  }

  return Math.max(0, sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2);
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-10 ? num / den : 0;
}

/**
 * Detects musical key, mode, Camelot code, and 12-bin chroma profile from mono PCM audio.
 */
export function detectMusicalKey(
  samples: Float32Array,
  sampleRate: number,
  options?: { activeStartSec?: number; activeEndSec?: number }
): KeyAnalysisResult {
  const duration = samples.length / Math.max(1, sampleRate);
  if (samples.length < sampleRate) {
    return {
      musicalKey: 'A minor',
      keyRoot: 'A',
      keyMode: 'minor',
      camelotCode: '8A',
      keyConfidence: 0.15,
      chromaVector: new Array(12).fill(1 / 12),
    };
  }

  // Downsample to ~11,025 Hz so Goertzel resonators across C2..B5 (65Hz–988Hz) run 4x faster
  const downsampleFactor = Math.max(1, Math.floor(sampleRate / 11025));
  const dsRate = sampleRate / downsampleFactor;

  const activeStart = Math.max(0, options?.activeStartSec ?? 0);
  const activeEnd = Math.min(duration, options?.activeEndSec ?? duration);
  const startSample = Math.floor(activeStart * sampleRate);
  const endSample = Math.min(samples.length, Math.floor(activeEnd * sampleRate));

  // Sample up to 24 evenly distributed 4096-sample frames (~0.37s each at 11kHz) across the song
  const frameLen = Math.min(4096, Math.floor((endSample - startSample) / downsampleFactor));
  if (frameLen < 512) {
    return {
      musicalKey: 'A minor',
      keyRoot: 'A',
      keyMode: 'minor',
      camelotCode: '8A',
      keyConfidence: 0.15,
      chromaVector: new Array(12).fill(1 / 12),
    };
  }

  const numFrames = Math.min(24, Math.max(4, Math.floor((activeEnd - activeStart) / 3)));
  const span = Math.max(1, endSample - startSample - frameLen * downsampleFactor);
  const chroma = new Array<number>(12).fill(0);
  const frameBuf = new Float32Array(frameLen);

  // Precompute semitone frequencies across 4 octaves (MIDI 36=C2 .. MIDI 83=B5)
  const noteBins: Array<{ pc: number; freq: number; weight: number }> = [];
  for (let midi = 36; midi <= 83; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    if (freq < dsRate * 0.45) {
      const pc = ((midi % 12) + 12) % 12;
      // Mid-register (C3–B4) carries strongest harmonic clarity
      const octaveWeight = midi >= 48 && midi <= 71 ? 1.2 : 0.85;
      noteBins.push({ pc, freq, weight: octaveWeight });
    }
  }

  for (let f = 0; f < numFrames; f++) {
    const offset = startSample + Math.floor((span * f) / Math.max(1, numFrames - 1));
    let frameEnergy = 0;
    for (let i = 0; i < frameLen; i++) {
      const s = samples[offset + i * downsampleFactor] || 0;
      frameBuf[i] = s;
      frameEnergy += s * s;
    }
    if (frameEnergy / frameLen < 1e-6) continue;

    for (let b = 0; b < noteBins.length; b++) {
      const { pc, freq, weight } = noteBins[b];
      const power = goertzelPower(frameBuf, freq, dsRate);
      chroma[pc] += Math.sqrt(power) * weight;
    }
  }

  // Normalize chroma vector
  const maxChroma = Math.max(...chroma, 1e-9);
  const normalizedChroma = chroma.map((v) => Math.round((v / maxChroma) * 1000) / 1000);

  // Evaluate correlation across all 24 keys (12 major + 12 minor)
  let bestScore = -2;
  let secondBestScore = -2;
  let bestRootIdx = 9; // A
  let bestMode: 'major' | 'minor' = 'minor';

  for (let root = 0; root < 12; root++) {
    const rotated = new Array<number>(12);
    for (let i = 0; i < 12; i++) {
      rotated[i] = normalizedChroma[(i + root) % 12];
    }

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (majorCorr > bestScore) {
      secondBestScore = bestScore;
      bestScore = majorCorr;
      bestRootIdx = root;
      bestMode = 'major';
    } else if (majorCorr > secondBestScore) {
      secondBestScore = majorCorr;
    }

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (minorCorr > bestScore) {
      secondBestScore = bestScore;
      bestScore = minorCorr;
      bestRootIdx = root;
      bestMode = 'minor';
    } else if (minorCorr > secondBestScore) {
      secondBestScore = minorCorr;
    }
  }

  const keyRoot = PITCH_CLASS_NAMES[bestRootIdx];
  const camelotCode = bestMode === 'major' ? CAMELOT_MAJOR[bestRootIdx] : CAMELOT_MINOR[bestRootIdx];
  const margin = Math.max(0, bestScore - secondBestScore);
  const rawConf = Math.max(0, Math.min(1, bestScore * 0.72 + margin * 2.4));

  return {
    musicalKey: `${keyRoot} ${bestMode}`,
    keyRoot,
    keyMode: bestMode,
    camelotCode,
    keyConfidence: Math.round(rawConf * 100) / 100,
    chromaVector: normalizedChroma,
  };
}

/**
 * Evaluates harmonic compatibility between two Camelot codes (e.g., "8A" vs "8B", "9A", etc.).
 */
export function evaluateCamelotCompatibility(
  camelotA?: string,
  camelotB?: string
): { score: number; relation: HarmonicRelation; description: string } {
  if (!camelotA || !camelotB) {
    return { score: 60, relation: 'unknown', description: 'Harmonic metadata pending' };
  }

  const parse = (code: string) => {
    const match = /^(\d{1,2})([AB])$/i.exec(code.trim());
    if (!match) return null;
    return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() as 'A' | 'B' };
  };

  const a = parse(camelotA);
  const b = parse(camelotB);
  if (!a || !b) {
    return { score: 60, relation: 'unknown', description: 'Unrecognized key notation' };
  }

  const circularDiff = (x: number, y: number) => {
    const d = Math.abs(x - y) % 12;
    return Math.min(d, 12 - d);
  };
  const forwardDiff = (b.num - a.num + 12) % 12;
  const dist = circularDiff(a.num, b.num);

  // Same Camelot code (e.g. 8A -> 8A)
  if (a.num === b.num && a.letter === b.letter) {
    return { score: 100, relation: 'perfect-match', description: `Exact key match (${camelotA})` };
  }

  // Relative major/minor (e.g. 8A <-> 8B: A minor <-> C major)
  if (a.num === b.num && a.letter !== b.letter) {
    return {
      score: 94,
      relation: 'relative-major-minor',
      description: `Relative major/minor harmonic lock (${camelotA} → ${camelotB})`,
    };
  }

  // Adjacent fifth on Camelot wheel (+/- 1 same letter, e.g. 8A -> 9A or 7A)
  if (dist === 1 && a.letter === b.letter) {
    return {
      score: 92,
      relation: 'adjacent-camelot',
      description: `Adjacent Camelot harmonic blend (${camelotA} → ${camelotB})`,
    };
  }

  // Energy boost (+2 semitones/steps, e.g. 8A -> 10A) or +7 semitone lift
  if ((forwardDiff === 2 || forwardDiff === 7) && a.letter === b.letter) {
    return {
      score: 80,
      relation: 'energy-boost',
      description: `Harmonic energy lift (${camelotA} → ${camelotB})`,
    };
  }

  // Diagonal adjacent (+/- 1 across A/B)
  if (dist === 1 && a.letter !== b.letter) {
    return {
      score: 74,
      relation: 'compatible-fifth',
      description: `Compatible diagonal transition (${camelotA} → ${camelotB})`,
    };
  }

  // Moderate distance (+/- 2)
  if (dist === 2) {
    return {
      score: 62,
      relation: 'compatible-fifth',
      description: `Moderate harmonic shift (${camelotA} → ${camelotB})`,
    };
  }

  // Distant / semitone clash
  return {
    score: 32,
    relation: 'incompatible',
    description: `Harmonic key clash (${camelotA} → ${camelotB}) — shorten harmonic overlap`,
  };
}

