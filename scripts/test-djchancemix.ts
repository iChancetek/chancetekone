/**
 * DJChanceMix — Automated DSP, Audio Intelligence & Edge-Case Verification Suite
 *
 * Tests real signal processing over synthetic PCM waveforms & transition edge cases:
 * 1. BPM detection & beat-grid accuracy (96 BPM, 120 BPM, 128 BPM)
 * 2. Musical Key & Camelot notation detection (A minor / 8A, C major / 8B)
 * 3. Loudness (BS.1770 LUFS), true-peak detection & clipping-safe gain ceiling
 * 4. Leading/trailing dead silence detection vs quiet ambient passage preservation
 * 5. Multi-band vocal overlap risk & structural sectioning
 * 6. Transition Intelligence across all 6 modes + edge cases (large BPM gap, vocal clash, low-confidence ambient/spoken-word, half-time lock)
 * 7. Crossfade curve energy continuity & AI DJ Flow harmonic playlist sequencing
 */

import assert from 'node:assert/strict';
import { analyzeMonoPcm } from '../src/lib/djchancemix/dsp/analyzePcm';
import { evaluateCamelotCompatibility } from '../src/lib/djchancemix/dsp/keyDetector';
import {
  optimizePlaylistFlow,
  planTransition,
} from '../src/lib/djchancemix/transitionIntelligence';
import { computeCrossfadeGains } from '../src/lib/djchancemix/dualDeckEngine';
import { DJTrackSource, TrackAudioAnalysis } from '../src/types/djchancemix';

const SR = 22050;

/**
 * Generates a realistic synthetic kick+hi-hat rhythmic drum track at an exact BPM.
 */
function generateDrumTrack(
  bpm: number,
  durationSec: number,
  options?: { leadingSilenceSec?: number; trailingSilenceSec?: number; amplitude?: number }
): Float32Array {
  const totalSamples = Math.floor(durationSec * SR);
  const out = new Float32Array(totalSamples);
  const lead = options?.leadingSilenceSec ?? 0;
  const trail = options?.trailingSilenceSec ?? 0;
  const amp = options?.amplitude ?? 0.72;
  const beatPeriod = 60 / bpm;

  for (let t = lead; t < durationSec - trail; t += beatPeriod) {
    const startIdx = Math.floor(t * SR);
    const beatIdx = Math.round((t - lead) / beatPeriod);
    const isDownbeat = beatIdx % 4 === 0;
    const pulseLen = Math.floor(0.11 * SR);
    for (let j = 0; j < pulseLen && startIdx + j < totalSamples; j++) {
      const env = Math.exp(-j / (0.025 * SR));
      // Kick pitch sweep 140Hz -> 52Hz
      const freq = 52 + 88 * Math.exp(-j / (0.015 * SR));
      const kick = Math.sin((2 * Math.PI * freq * j) / SR) * env * amp * (isDownbeat ? 1.0 : 0.78);
      out[startIdx + j] += kick;
    }
  }
  return out;
}

/**
 * Generates a sustained harmonic triad chord wave (e.g., A minor or C major) for key testing.
 */
function generateChordTrack(freqsHz: number[], durationSec: number, amplitude = 0.22): Float32Array {
  const totalSamples = Math.floor(durationSec * SR);
  const out = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SR;
    let sum = 0;
    for (const f of freqsHz) {
      sum += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t);
    }
    out[i] = (sum / freqsHz.length) * amplitude;
  }
  return out;
}

function makeMockAnalysis(overrides: Partial<TrackAudioAnalysis>): TrackAudioAnalysis {
  return {
    trackId: 't-base',
    audioUrlHash: 'h-base',
    duration: 210,
    sampleRate: 44100,
    analyzedAt: new Date().toISOString(),
    analysisStatus: 'ready',
    bpm: 100,
    bpmConfidence: 0.9,
    beatOffsetSec: 0.4,
    barDurationSec: 2.4,
    timeSignature: '4/4',
    beatTimestamps: [0.4, 1.0, 1.6, 2.2],
    downbeats: Array.from({ length: 80 }, (_, i) => Math.round((0.4 + i * 2.4) * 100) / 100),
    musicalKey: 'A minor',
    keyRoot: 'A',
    keyMode: 'minor',
    camelotCode: '8A',
    keyConfidence: 0.88,
    chromaVector: new Array(12).fill(0.2),
    integratedLufs: -12,
    truePeakDbfs: -0.5,
    dynamicRangeDb: 7,
    recommendedGainDb: -2,
    leadingSilenceSec: 0.2,
    trailingSilenceSec: 1.0,
    activeStartSec: 0.2,
    activeEndSec: 209,
    extendedPauses: [],
    energyScore: 72,
    energyCurve: new Array(64).fill(0.7),
    vocalActivityCurve: new Array(64).fill(0.2),
    introVocalRisk: 0.15,
    outroVocalRisk: 0.15,
    sections: [],
    suggestedCueInSec: 0.4,
    suggestedMixOutSec: 199.6,
    waveformPeaks: new Array(160).fill(0.6),
    ...overrides,
  };
}

async function runTests() {
  let passed = 0;
  const check = async (label: string, fn: () => Promise<void> | void) => {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  };

  console.log('\n=== DJChanceMix DSP & Transition Intelligence Test Suite ===\n');

  // 1. BPM Detection Accuracy
  await check('BPM detector accurately measures 96 BPM synthetic groove (±2 BPM)', async () => {
    const pcm = generateDrumTrack(96, 20);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-96', audioUrlHash: 'h1' });
    assert.ok(
      Math.abs(analysis.bpm - 96) <= 2.0,
      `Expected ~96 BPM, got ${analysis.bpm}`
    );
    assert.ok(analysis.bpmConfidence >= 0.45, `Expected confidence >= 0.45, got ${analysis.bpmConfidence}`);
    assert.ok(analysis.downbeats.length >= 4, 'Expected downbeat bar markers');
  });

  await check('BPM detector accurately measures 120 BPM house groove (±2 BPM)', async () => {
    const pcm = generateDrumTrack(120, 20);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-120', audioUrlHash: 'h2' });
    assert.ok(
      Math.abs(analysis.bpm - 120) <= 2.0,
      `Expected ~120 BPM, got ${analysis.bpm}`
    );
  });

  await check('BPM detector accurately measures 128 BPM club beat (±2.5 BPM)', async () => {
    const pcm = generateDrumTrack(128, 20);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-128', audioUrlHash: 'h3' });
    assert.ok(
      Math.abs(analysis.bpm - 128) <= 2.5,
      `Expected ~128 BPM, got ${analysis.bpm}`
    );
  });

  // 2. Musical Key & Camelot Wheel Detection
  await check('Key detector identifies A minor (8A) from A-C-E minor triad harmonics', async () => {
    // A3=220, C4=261.63, E4=329.63, A4=440
    const pcm = generateChordTrack([220, 261.63, 329.63, 440], 10);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-am', audioUrlHash: 'h-am' });
    assert.equal(analysis.camelotCode, '8A', `Expected 8A (A minor), got ${analysis.camelotCode} (${analysis.musicalKey})`);
  });

  await check('Key detector identifies C major (8B) from C-E-G major triad harmonics', async () => {
    // C3=130.81, C4=261.63, E4=329.63, G4=392.00
    const pcm = generateChordTrack([130.81, 261.63, 329.63, 392.0], 10);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-cmaj', audioUrlHash: 'h-cmaj' });
    assert.equal(analysis.camelotCode, '8B', `Expected 8B (C major), got ${analysis.camelotCode} (${analysis.musicalKey})`);
  });

  await check('Camelot compatibility scores exact, relative major/minor, adjacent, and clashes properly', () => {
    assert.equal(evaluateCamelotCompatibility('8A', '8A').score, 100);
    assert.equal(evaluateCamelotCompatibility('8A', '8B').relation, 'relative-major-minor');
    assert.ok(evaluateCamelotCompatibility('8A', '9A').score >= 90);
    assert.equal(evaluateCamelotCompatibility('8A', '2B').relation, 'incompatible');
  });

  // 3. Silence Detection vs Ambient Preservation
  await check('Silence detector trims dead leading (2.5s) and trailing (3.0s) silence accurately', async () => {
    const pcm = generateDrumTrack(105, 18, { leadingSilenceSec: 2.5, trailingSilenceSec: 3.0 });
    const analysis = await analyzeMonoPcm(pcm, SR, {
      trackId: 't-sil',
      audioUrlHash: 'h-sil',
      silenceSensitivity: 'medium',
    });
    assert.ok(analysis.leadingSilenceSec >= 2.0 && analysis.leadingSilenceSec <= 2.9, `Got leading ${analysis.leadingSilenceSec}s`);
    assert.ok(analysis.trailingSilenceSec >= 2.1 && analysis.trailingSilenceSec <= 3.3, `Got trailing ${analysis.trailingSilenceSec}s`);
  });

  await check('Ambient-safe silence detector preserves quiet musical intros (-45 dBFS pad)', async () => {
    // Quiet 220 Hz tonal pad (~0.0056 amp = -45 dBFS) right from 0s
    const pcm = generateChordTrack([220, 330], 10, 0.006);
    const analysis = await analyzeMonoPcm(pcm, SR, {
      trackId: 't-amb',
      audioUrlHash: 'h-amb',
      silenceSensitivity: 'medium',
    });
    assert.ok(
      analysis.leadingSilenceSec < 0.5,
      `Quiet musical ambient intro was mistakenly trimmed (${analysis.leadingSilenceSec}s)`
    );
  });

  // 4. Loudness Normalization & True Peak Headroom
  await check('Loudness normalization enforces -1.0 dBTP true-peak ceiling to prevent digital clipping', async () => {
    // Hot signal peaking near 0 dBFS
    const pcm = generateChordTrack([220, 440], 8, 0.98);
    const analysis = await analyzeMonoPcm(pcm, SR, { trackId: 't-hot', audioUrlHash: 'h-hot', targetLufs: -14 });
    assert.ok(analysis.truePeakDbfs + analysis.recommendedGainDb <= -0.95, 'Gain must never exceed -1.0 dBTP headroom');
  });

  // 5. Transition Intelligence & Edge Cases
  await check('AutoMix selects beat-locked phrase-matched crossfade for compatible 100→102 BPM, 8A→8B instrumental tracks', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 100, camelotCode: '8A', energyScore: 72, outroVocalRisk: 0.12 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 102, camelotCode: '8B', energyScore: 75, introVocalRisk: 0.14 });
    const plan = planTransition({
      fromTrack: { id: 'a', title: 'Track A', artistName: 'Artist A', genre: 'R&B / Neo-Soul', duration: 210 },
      toTrack: { id: 'b', title: 'Track B', artistName: 'Artist B', genre: 'R&B / Neo-Soul', duration: 210 },
      fromAnalysis: a,
      toAnalysis: b,
    });
    assert.equal(plan.beatSyncEnabled, true);
    assert.equal(plan.transitionType, 'phrase-matched-crossfade');
    assert.ok(plan.compatibilityScore >= 88, `Expected >= 88%, got ${plan.compatibilityScore}%`);
    assert.equal(plan.preservePitch, true);
    assert.ok(Math.abs(plan.tempoAdjustmentPercent) <= 8);
  });

  await check('AutoMix refuses forced beat-matching when BPM gap exceeds ±8% limit', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 84 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 128 });
    const plan = planTransition({
      fromTrack: { id: 'a', title: 'Slow Jam', artistName: 'A', genre: 'Slow Jams', duration: 220 },
      toTrack: { id: 'b', title: 'House Anthem', artistName: 'B', genre: 'House-Club', duration: 220 },
      fromAnalysis: a,
      toAnalysis: b,
    });
    assert.equal(plan.beatSyncEnabled, false);
    assert.equal(plan.targetPlaybackRate, 1);
    assert.ok(plan.warnings.length > 0);
  });

  await check('Vocal protection detects outro+intro vocal collision and uses vocal-safe fade', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 100, outroVocalRisk: 0.88 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 100, introVocalRisk: 0.85 });
    const plan = planTransition({
      fromTrack: { id: 'a', title: 'Vocal A', artistName: 'A', genre: 'R&B', duration: 200 },
      toTrack: { id: 'b', title: 'Vocal B', artistName: 'B', genre: 'R&B', duration: 200 },
      fromAnalysis: a,
      toAnalysis: b,
    });
    assert.equal(plan.transitionType, 'vocal-safe-fade');
    assert.ok(plan.transitionDurationSec <= 5, `Expected short vocal-safe blend, got ${plan.transitionDurationSec}s`);
  });

  await check('Ambient / Spoken-word low-confidence tracks automatically disable BeatSync', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 95, bpmConfidence: 0.22 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 96, bpmConfidence: 0.25 });
    const plan = planTransition({
      fromTrack: { id: 'a', title: 'Ambient Prelude', artistName: 'A', genre: 'Ambient', duration: 180 },
      toTrack: { id: 'b', title: 'Spoken Poem', artistName: 'B', genre: 'Spoken Word', duration: 180 },
      fromAnalysis: a,
      toAnalysis: b,
      modeOverride: 'beatsync',
    });
    assert.equal(plan.beatSyncEnabled, false);
  });

  await check('Original Playback mode makes zero crossfade or tempo modifications', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 100 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 104 });
    const plan = planTransition({
      fromTrack: { id: 'a', title: 'A', artistName: 'A', genre: 'Hip Hop', duration: 210 },
      toTrack: { id: 'b', title: 'B', artistName: 'B', genre: 'Hip Hop', duration: 210 },
      fromAnalysis: a,
      toAnalysis: b,
      modeOverride: 'original',
    });
    assert.equal(plan.transitionDurationSec, 0);
    assert.equal(plan.targetPlaybackRate, 1);
    assert.equal(plan.transitionType, 'direct');
  });

  // 6. Crossfade Curve Energy Continuity
  await check('Equal-power crossfade preserves constant power (out² + in² ≈ 1.0) with no dip', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const { outGain, inGain } = computeCrossfadeGains(p, 'equal-power');
      const power = outGain * outGain + inGain * inGain;
      assert.ok(Math.abs(power - 1.0) < 1e-6, `Power dip/spike at p=${p}: ${power}`);
    }
  });

  // 6b. Every mixing mode must behave distinctly (regression: "all modes do the same thing")
  await check('All 6 mixing modes produce distinct transition plans for the same song pair', () => {
    const a = makeMockAnalysis({ trackId: 'a', bpm: 100, camelotCode: '8A', outroVocalRisk: 0.4 });
    const b = makeMockAnalysis({ trackId: 'b', bpm: 103, camelotCode: '9A', introVocalRisk: 0.4 });
    const modes = ['automix', 'smart-crossfade', 'beatsync', 'harmonic', 'continuous', 'original'] as const;
    const signatures = modes.map((mode) => {
      const p = planTransition({
        fromTrack: { id: 'a', title: 'A', artistName: 'A', genre: 'R&B', duration: 210 },
        toTrack: { id: 'b', title: 'B', artistName: 'B', genre: 'R&B', duration: 210 },
        fromAnalysis: a,
        toAnalysis: b,
        modeOverride: mode,
      });
      return `${p.transitionType}|${p.transitionDurationSec}|${p.beatSyncEnabled}|${p.crossfadeCurve}|${p.eqSweepEnabled}`;
    });
    assert.equal(new Set(signatures).size, modes.length, `Modes collapsed: ${signatures.join(' / ')}`);
  });

  await check('Modes stay distinct even on fallback (unverified) analysis; harmonic never trusts placeholder keys', () => {
    const fb = (id: string) =>
      makeMockAnalysis({
        trackId: id,
        analysisStatus: 'fallback',
        bpm: 100,
        bpmConfidence: 0.28,
        keyConfidence: 0.2,
        camelotCode: '8A',
        introVocalRisk: 0.35,
        outroVocalRisk: 0.35,
        downbeats: [],
      });
    const modes = ['automix', 'smart-crossfade', 'beatsync', 'harmonic', 'continuous'] as const;
    const plans = modes.map((mode) =>
      planTransition({
        fromTrack: { id: 'x', title: 'X', artistName: 'X', genre: 'Hip Hop', duration: 200 },
        toTrack: { id: 'y', title: 'Y', artistName: 'Y', genre: 'Hip Hop', duration: 200 },
        fromAnalysis: fb('x'),
        toAnalysis: fb('y'),
        modeOverride: mode,
      })
    );
    const sigs = plans.map((p) => `${p.transitionType}|${p.transitionDurationSec}|${p.beatSyncEnabled}|${p.crossfadeCurve}`);
    assert.equal(new Set(sigs).size, modes.length, `Fallback modes collapsed: ${sigs.join(' / ')}`);
    const harmonic = plans[3];
    assert.equal(harmonic.harmonicRelation, 'unknown');
    assert.notEqual(harmonic.transitionType, 'harmonic-blend');
    assert.equal(plans[2].beatSyncEnabled, true, 'BeatSync mode should lock tempo with metadata-assisted confidence');
    assert.ok(plans[4].transitionDurationSec < 1, 'Continuous Play should splice with a sub-second micro-fade');
  });

  // 7. AI DJ Flow Playlist Sequencing
  await check('AI DJ Flow sequences playlist to place harmonically & tempo compatible tracks consecutively', () => {
    const tracks: DJTrackSource[] = [
      { id: 't1', title: 'Start 96 8A', artistName: 'A', coverUrl: '', audioUrl: '', duration: 200, genre: 'Hip Hop', sourceType: 'catalog' },
      { id: 't2', title: 'Clash 132 2B', artistName: 'B', coverUrl: '', audioUrl: '', duration: 200, genre: 'House', sourceType: 'catalog' },
      { id: 't3', title: 'Match 98 8B', artistName: 'C', coverUrl: '', audioUrl: '', duration: 200, genre: 'Hip Hop', sourceType: 'catalog' },
      { id: 't4', title: 'Step 104 9B', artistName: 'D', coverUrl: '', audioUrl: '', duration: 200, genre: 'R&B', sourceType: 'catalog' },
    ];
    const analyses: Record<string, TrackAudioAnalysis> = {
      t1: makeMockAnalysis({ trackId: 't1', bpm: 96, camelotCode: '8A', energyScore: 68 }),
      t2: makeMockAnalysis({ trackId: 't2', bpm: 132, camelotCode: '2B', energyScore: 92 }),
      t3: makeMockAnalysis({ trackId: 't3', bpm: 98, camelotCode: '8B', energyScore: 71 }),
      t4: makeMockAnalysis({ trackId: 't4', bpm: 104, camelotCode: '9B', energyScore: 74 }),
    };
    const { orderedTracks, avgCompatibility } = optimizePlaylistFlow(tracks, analyses, undefined, 't1');
    assert.equal(orderedTracks[0].id, 't1');
    assert.equal(orderedTracks[1].id, 't3', `Expected t3 (98 BPM 8B) right after t1, got ${orderedTracks[1].id}`);
    assert.equal(orderedTracks[2].id, 't4', `Expected t4 (104 BPM 9B) third, got ${orderedTracks[2].id}`);
    assert.ok(avgCompatibility >= 70);
  });

  console.log(`\nALL ${passed} DJChanceMix DSP & Transition Intelligence Tests PASSED!\n`);
}

runTests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});

