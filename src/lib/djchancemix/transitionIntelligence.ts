/**
 * DJChanceMix — AI Music Intelligence & Transition Decision Engine
 *
 * Evaluates all 10 musical dimensions between consecutive tracks:
 * 1. BPM compatibility (including half-time & double-time relationships)
 * 2. Musical key & Camelot Wheel harmonic compatibility
 * 3. Beat grid & downbeat phrase alignment
 * 4. Song structure (intro/outro length & energy curves)
 * 5. Intro & outro characteristics
 * 6. Vocal overlap risk protection
 * 7. Instrumental transition window availability
 * 8. Energy compatibility
 * 9. Genre compatibility
 * 10. Active mixing mode & user configuration limits
 *
 * 100% deterministic in the real-time audio pipeline (zero blocking LLM calls).
 * Automatically falls back to smooth crossfades or gapless cuts when confidence is low.
 */

import {
  CrossfadeCurve,
  DEFAULT_MIX_CONFIGURATION,
  DJTrackSource,
  MixConfiguration,
  MixMode,
  TrackAudioAnalysis,
  TransitionPlan,
  TransitionType,
} from '@/types/djchancemix';
import { evaluateCamelotCompatibility } from './dsp/keyDetector';

export interface EvaluateTransitionInput {
  fromTrack: Pick<DJTrackSource, 'id' | 'title' | 'artistName' | 'genre' | 'duration' | 'bpm'>;
  toTrack: Pick<DJTrackSource, 'id' | 'title' | 'artistName' | 'genre' | 'duration' | 'bpm'>;
  fromAnalysis: TrackAudioAnalysis;
  toAnalysis: TrackAudioAnalysis;
  config?: Partial<MixConfiguration>;
  modeOverride?: MixMode;
}

/**
 * Evaluates tempo relationship including half-time / double-time locks (e.g. 72 BPM <-> 144 BPM).
 */
function evaluateTempoRelationship(
  bpmA: number,
  bpmB: number,
  maxAdjustPercent: number
): {
  compatibilityScore: number;
  deltaPercent: number;
  effectiveTargetBpm: number;
  playbackRate: number;
  canBeatSync: boolean;
  isHalfDoubleTime: boolean;
} {
  if (!bpmA || !bpmB || bpmA <= 0 || bpmB <= 0) {
    return {
      compatibilityScore: 50,
      deltaPercent: 0,
      effectiveTargetBpm: bpmB || 100,
      playbackRate: 1,
      canBeatSync: false,
      isHalfDoubleTime: false,
    };
  }

  // Test direct (1x), half-time (0.5x), and double-time (2x) tempo ratios
  const ratios = [
    { mult: 1, halfDouble: false },
    { mult: 2, halfDouble: true },
    { mult: 0.5, halfDouble: true },
  ];

  let bestDiffPct = Infinity;
  let bestRate = 1;
  let bestHalfDouble = false;
  let bestTargetBpm = bpmA;

  for (const r of ratios) {
    const scaledB = bpmB * r.mult;
    const rate = bpmA / scaledB;
    const diffPct = Math.abs(rate - 1) * 100;
    if (diffPct < bestDiffPct) {
      bestDiffPct = diffPct;
      bestRate = rate;
      bestHalfDouble = r.halfDouble;
      bestTargetBpm = bpmA;
    }
  }

  const canBeatSync = bestDiffPct <= maxAdjustPercent;
  const signedDeltaPct = Math.round((bestRate - 1) * 1000) / 10;

  let score = 100;
  if (bestDiffPct <= 2) score = 98;
  else if (bestDiffPct <= 5) score = 90;
  else if (bestDiffPct <= maxAdjustPercent) score = Math.round(85 - (bestDiffPct - 5) * 3.5);
  else if (bestDiffPct <= 16) score = Math.round(62 - (bestDiffPct - maxAdjustPercent) * 2.5);
  else score = Math.max(18, Math.round(42 - (bestDiffPct - 16) * 0.8));

  if (bestHalfDouble) score = Math.max(40, score - 6);

  return {
    compatibilityScore: Math.max(15, Math.min(100, score)),
    deltaPercent: canBeatSync ? signedDeltaPct : 0,
    effectiveTargetBpm: bestTargetBpm,
    playbackRate: canBeatSync ? Math.round(bestRate * 10000) / 10000 : 1,
    canBeatSync,
    isHalfDoubleTime: bestHalfDouble,
  };
}

function evaluateGenreCompatibility(genreA?: string, genreB?: string): number {
  const a = (genreA || '').toLowerCase();
  const b = (genreB || '').toLowerCase();
  if (!a || !b) return 70;
  if (a === b) return 100;

  const families: string[][] = [
    ['r&b', 'rnb', 'neo-soul', 'soul', 'slow jams', 'quiet storm', 'motown'],
    ['hip hop', 'hip-hop', 'boom bap', 'rap', 'breakbeat', 'break beats', 'golden era'],
    ['house', 'afro house', 'club', 'dance', 'disco', 'funk', 'freestyle', 'electronic'],
    ['jazz', 'blues', 'lounge', 'instrumental', 'ambient', 'classical'],
    ['reggae', 'dancehall', 'reggaeton', 'latin', 'afrobeats'],
  ];

  const famA = families.findIndex((fam) => fam.some((kw) => a.includes(kw)));
  const famB = families.findIndex((fam) => fam.some((kw) => b.includes(kw)));
  if (famA !== -1 && famA === famB) return 90;
  // Adjacent urban/groove families (R&B <-> Hip Hop, Hip Hop <-> House/Funk) blend smoothly
  if (
    (famA === 0 && famB === 1) ||
    (famA === 1 && famB === 0) ||
    (famA === 1 && famB === 2) ||
    (famA === 2 && famB === 1) ||
    (famA === 0 && famB === 3) ||
    (famA === 3 && famB === 0)
  ) {
    return 76;
  }
  return 54;
}

/**
 * Computes an intelligent, explainable TransitionPlan between Track A and Track B.
 */
export function planTransition(input: EvaluateTransitionInput): TransitionPlan {
  const cfg: MixConfiguration = {
    ...DEFAULT_MIX_CONFIGURATION,
    ...(input.config || {}),
  };
  const mode: MixMode = input.modeOverride || cfg.defaultMode;
  const { fromAnalysis: a, toAnalysis: b, fromTrack, toTrack } = input;
  const warnings: string[] = [];

  const durationA = Math.max(4, a.duration || fromTrack.duration || 180);
  const durationB = Math.max(4, b.duration || toTrack.duration || 180);
  const activeEndA = cfg.removeSilenceGaps ? Math.min(durationA, a.activeEndSec || durationA) : durationA;
  const activeStartB = cfg.removeSilenceGaps ? Math.max(0, b.activeStartSec || 0) : 0;

  // Mode 6: Original Playback — zero modification, zero crossfade
  if (mode === 'original') {
    return {
      fromTrackId: fromTrack.id,
      toTrackId: toTrack.id,
      mode,
      compatibilityScore: 100,
      confidence: 1,
      transitionType: 'direct',
      bpmCompatibility: 100,
      keyCompatibility: 100,
      harmonicRelation: 'unknown',
      energyCompatibility: 100,
      genreCompatibility: 100,
      vocalOverlapRisk: 0,
      beatAlignmentQuality: 0,
      transitionPointQuality: 100,
      beatSyncEnabled: false,
      tempoAdjustmentPercent: 0,
      targetPlaybackRate: 1,
      preservePitch: true,
      mixOutSec: durationA,
      cueInSec: 0,
      transitionDurationSec: 0,
      crossfadeCurve: 'linear',
      eqSweepEnabled: false,
      rationale: 'Original Playback mode — full unmodified studio recordings end-to-end.',
      warnings: [],
      computedAt: new Date().toISOString(),
    };
  }

  // Evaluate all musical dimensions
  const tempo = evaluateTempoRelationship(a.bpm, b.bpm, cfg.maxTempoAdjustmentPercent);

  // Only trust Camelot keys that were actually measured from the audio (fallback analyses carry a placeholder key)
  const keyReliable = (a.keyConfidence ?? 0) >= 0.3 && (b.keyConfidence ?? 0) >= 0.3;
  const harmony: { score: number; relation: TransitionPlan['harmonicRelation']; description: string } = keyReliable
    ? evaluateCamelotCompatibility(a.camelotCode, b.camelotCode)
    : { score: 65, relation: 'unknown', description: 'Key not yet verified from audio' };

  const genreCompatibility = evaluateGenreCompatibility(fromTrack.genre, toTrack.genre);
  const energyDelta = Math.abs((a.energyScore || 60) - (b.energyScore || 60));
  const energyCompatibility = Math.max(20, Math.round(100 - energyDelta * 1.15));

  // Combined vocal overlap risk (0..100): high when BOTH Track A outro and Track B intro have strong vocals
  const rawVocalOverlap = Math.min(1, a.outroVocalRisk * 0.55 + b.introVocalRisk * 0.55 + a.outroVocalRisk * b.introVocalRisk * 0.7);
  const vocalOverlapRisk = Math.round(rawVocalOverlap * 100);
  const bothInstrumental = a.outroVocalRisk < 0.28 && b.introVocalRisk < 0.28;
  const vocalClash = cfg.vocalProtectionEnabled && vocalOverlapRisk >= 62;

  // Rhythm reliability check (never force beat-matching on ambient, spoken-word, classical, or low-confidence audio).
  // BeatSync mode is the dedicated tempo-lock mode, so it accepts a lower (metadata-assisted) confidence floor.
  const rhythmConf = Math.min(a.bpmConfidence || 0, b.bpmConfidence || 0);
  const isSpokenOrAmbientGenre =
    (fromTrack.genre || '').toLowerCase().match(/ambient|spoken|classical|audiobook|podcast/) !== null ||
    (toTrack.genre || '').toLowerCase().match(/ambient|spoken|classical|audiobook|podcast/) !== null;
  const rhythmFloor = mode === 'beatsync' ? 0.25 : 0.42;
  const rhythmReliable = !isSpokenOrAmbientGenre && rhythmConf >= rhythmFloor;
  const canSync = rhythmReliable && tempo.canBeatSync;

  if (!rhythmReliable && (mode === 'automix' || mode === 'beatsync')) {
    warnings.push('Low rhythmic confidence or ambient/spoken passage detected — falling back to smooth blend.');
  }
  if (!tempo.canBeatSync && (mode === 'automix' || mode === 'beatsync')) {
    warnings.push(
      `Tempo gap (${a.bpm} → ${b.bpm} BPM) exceeds ±${cfg.maxTempoAdjustmentPercent}% limit — preserving natural tempo.`
    );
  }
  if (harmony.relation === 'incompatible' && (cfg.harmonicMixingEnabled || mode === 'harmonic')) {
    warnings.push(`Harmonic key clash (${a.camelotCode} → ${b.camelotCode}) — keeping blend tight.`);
  }
  if (!keyReliable && mode === 'harmonic') {
    warnings.push('Musical key still being verified — using a conservative blend until analysis completes.');
  }
  if (vocalClash) {
    warnings.push('Vocal overlap risk detected between outro and intro — applying vocal-safe transition.');
  }

  const barA = a.barDurationSec > 0 ? a.barDurationSec : (60 / Math.max(60, a.bpm || 100)) * 4;
  const manualDur = cfg.crossfadeDurationSec;

  // Per-mode execution profile
  let beatSyncEnabled = false;
  let transitionType: TransitionType = 'adaptive-crossfade';
  let crossfadeCurve: CrossfadeCurve = cfg.crossfadeCurve;
  let targetDuration = manualDur;
  let eqSweepEnabled = false;
  let minDuration = 1.2;
  let cueStrategy: 'active-start' | 'suggested' = 'active-start';
  let snapToDownbeat = false;
  // Continuous Play ALWAYS trims dead air, regardless of the global silence toggle
  let effectiveEndA = activeEndA;
  let effectiveStartB = activeStartB;

  switch (mode) {
    case 'smart-crossfade': {
      // Pure volume blend at the natural outro → intro: no tempo change, no EQ, user's curve & duration.
      transitionType = vocalClash ? 'vocal-safe-fade' : 'outro-to-intro';
      crossfadeCurve = cfg.crossfadeCurve;
      targetDuration = cfg.autoTransitionDuration ? (vocalClash ? 5 : 8) : manualDur;
      break;
    }

    case 'beatsync': {
      // Club tempo lock: incoming track is time-stretched to the outgoing BPM, phase-aligned on a downbeat,
      // blended over whole bars with a low-end bass swap, and held locked through the entire blend.
      snapToDownbeat = true;
      if (canSync) {
        beatSyncEnabled = true;
        transitionType = 'beat-matched-blend';
        crossfadeCurve = 'linear';
        eqSweepEnabled = cfg.eqBassSwapEnabled;
        cueStrategy = 'suggested';
        const bars8 = barA * 8;
        const bars4 = barA * 4;
        targetDuration = cfg.autoTransitionDuration
          ? Math.max(6, Math.min(16, Math.round((bars8 <= 16 ? bars8 : bars4) * 10) / 10))
          : manualDur;
      } else {
        // Tempos too far apart for a natural lock — quick 1-bar drop on the downbeat
        transitionType = 'adaptive-crossfade';
        crossfadeCurve = 'linear';
        targetDuration = cfg.autoTransitionDuration ? Math.max(2, Math.min(4, Math.round(barA * 10) / 10)) : manualDur;
      }
      break;
    }

    case 'harmonic': {
      // Key-first blending: long overlaps for compatible keys, tight cuts on clashes.
      if (harmony.relation === 'unknown') {
        transitionType = 'adaptive-crossfade';
        crossfadeCurve = 'equal-power';
        targetDuration = cfg.autoTransitionDuration ? 6 : manualDur;
      } else if (harmony.score >= 88) {
        transitionType = 'harmonic-blend';
        crossfadeCurve = 'equal-power';
        beatSyncEnabled = canSync;
        eqSweepEnabled = beatSyncEnabled && cfg.eqBassSwapEnabled;
        cueStrategy = beatSyncEnabled ? 'suggested' : 'active-start';
        snapToDownbeat = beatSyncEnabled;
        const longBlend = Math.max(10, Math.min(18, Math.round(barA * 8 * 10) / 10));
        targetDuration = cfg.autoTransitionDuration ? (vocalClash ? 8 : longBlend) : manualDur;
      } else if (harmony.score >= 70) {
        transitionType = 'harmonic-blend';
        crossfadeCurve = 'adaptive';
        beatSyncEnabled = canSync;
        snapToDownbeat = beatSyncEnabled;
        targetDuration = cfg.autoTransitionDuration ? 8 : manualDur;
      } else {
        // Key clash: keep both keys from sounding together
        transitionType = 'adaptive-crossfade';
        crossfadeCurve = 'volume-aware';
        targetDuration = cfg.autoTransitionDuration ? 2.5 : Math.min(3, manualDur);
      }
      break;
    }

    case 'continuous': {
      // Zero dead air: trim silence on both sides and butt-splice with a micro crossfade.
      effectiveEndA = Math.min(durationA, a.activeEndSec || durationA);
      effectiveStartB = Math.max(0, b.activeStartSec || 0);
      if (bothInstrumental && keyReliable && harmony.score >= 74) {
        transitionType = 'outro-to-intro';
        crossfadeCurve = 'equal-power';
        targetDuration = 2;
      } else {
        transitionType = 'gapless-cut';
        crossfadeCurve = 'equal-power';
        targetDuration = 0.6;
      }
      minDuration = 0.5;
      break;
    }

    case 'automix':
    default: {
      // Full AI DJ: picks the best technique per pair of songs.
      beatSyncEnabled = canSync;
      snapToDownbeat = beatSyncEnabled;
      cueStrategy = beatSyncEnabled ? 'suggested' : 'active-start';
      if (vocalOverlapRisk >= 65 && cfg.vocalProtectionEnabled) {
        transitionType = 'vocal-safe-fade';
        crossfadeCurve = 'volume-aware';
        targetDuration = cfg.autoTransitionDuration ? 3.5 : Math.min(5, manualDur);
        // Avoid forcing unnatural long beat blend over colliding lead vocals
        if (vocalOverlapRisk >= 78) beatSyncEnabled = false;
      } else if (beatSyncEnabled && bothInstrumental && harmony.score >= 80) {
        transitionType = 'phrase-matched-crossfade';
        crossfadeCurve = 'equal-power';
        // Snap automatic blend duration to exact 4 or 2 bars (clamped 5..14s)
        const bars4 = barA * 4;
        const bars2 = barA * 2;
        targetDuration = cfg.autoTransitionDuration
          ? Math.max(5, Math.min(14, Math.round((bars4 <= 12 ? bars4 : bars2) * 10) / 10))
          : manualDur;
      } else if (beatSyncEnabled) {
        transitionType = 'beat-matched-blend';
        crossfadeCurve = 'adaptive';
        targetDuration = cfg.autoTransitionDuration
          ? Math.max(4, Math.min(10, Math.round(barA * 2 * 10) / 10))
          : manualDur;
      } else if (bothInstrumental) {
        transitionType = 'instrumental-bridge';
        crossfadeCurve = 'equal-power';
        targetDuration = cfg.autoTransitionDuration ? 7 : manualDur;
      } else {
        transitionType = 'adaptive-crossfade';
        crossfadeCurve = 'volume-aware';
        targetDuration = cfg.autoTransitionDuration
          ? harmony.relation === 'incompatible'
            ? 3.5
            : 5.5
          : manualDur;
      }
      eqSweepEnabled = Boolean(cfg.eqBassSwapEnabled && beatSyncEnabled);
      break;
    }
  }

  // Clamp transition duration cleanly to available track lengths
  const maxSafeFade = Math.max(minDuration, Math.min(18, Math.min(effectiveEndA * 0.35, durationB * 0.35)));
  const transitionDurationSec =
    Math.round(Math.max(minDuration, Math.min(maxSafeFade, targetDuration)) * 10) / 10;
  if (eqSweepEnabled && transitionDurationSec < 4) eqSweepEnabled = false;

  // Choose Cue-In (Track B) aligned to musical structure & silence boundaries
  const cueInSec = Math.max(
    effectiveStartB,
    Math.min(durationB * 0.2, cueStrategy === 'suggested' ? b.suggestedCueInSec : effectiveStartB)
  );

  // Place Mix-Out so Track A finishes cleanly near its end without cutting off the chorus prematurely
  const naturalMixOut = Math.max(2, effectiveEndA - transitionDurationSec);
  let mixOutSec = naturalMixOut;
  if (snapToDownbeat && a.downbeats.length > 0) {
    // Snap mix-out to nearest downbeat within ±2.5s of naturalMixOut
    let nearestDb = naturalMixOut;
    let bestDist = Infinity;
    for (const db of a.downbeats) {
      if (db < effectiveEndA - 2 && db > 4) {
        const d = Math.abs(db - naturalMixOut);
        if (d < bestDist) {
          bestDist = d;
          nearestDb = db;
        }
      }
    }
    if (bestDist <= 2.5) {
      mixOutSec = nearestDb;
    }
  }
  mixOutSec =
    Math.round(Math.max(2, Math.min(effectiveEndA - Math.min(1.2, transitionDurationSec), mixOutSec)) * 100) / 100;

  // Compute component quality metrics & weighted compatibility score (0..100)
  const beatAlignmentQuality = beatSyncEnabled
    ? Math.round(Math.min(100, 55 + rhythmConf * 45))
    : Math.round(40 + rhythmConf * 30);
  const transitionPointQuality = Math.round(
    Math.min(100, (bothInstrumental ? 92 : 76) - Math.max(0, vocalOverlapRisk - 50) * 0.6)
  );

  const keyWeight = mode === 'harmonic' ? 0.34 : cfg.harmonicMixingEnabled ? 0.22 : 0.1;
  const bpmWeight = mode === 'beatsync' ? 0.36 : 0.26;
  const vocalWeight = 0.16;
  const energyWeight = 0.16;
  const genreWeight = Math.max(0.08, 1 - (keyWeight + bpmWeight + vocalWeight + energyWeight));

  const compatibilityScore = Math.round(
    Math.max(
      15,
      Math.min(
        99,
        tempo.compatibilityScore * bpmWeight +
          harmony.score * keyWeight +
          (100 - vocalOverlapRisk) * vocalWeight +
          energyCompatibility * energyWeight +
          genreCompatibility * genreWeight
      )
    )
  );

  const confidence =
    Math.round(
      Math.max(
        0.25,
        Math.min(
          0.99,
          (a.analysisStatus === 'ready' && b.analysisStatus === 'ready' ? 0.45 : 0.2) +
            rhythmConf * 0.32 +
            Math.min(a.keyConfidence || 0.3, b.keyConfidence || 0.3) * 0.23
        )
      ) * 100
    ) / 100;

  // Build concise, musical DJ rationale
  const parts: string[] = [];
  const modeLead: Record<MixMode, string> = {
    automix: 'AutoMix AI',
    'smart-crossfade': 'Smart Crossfade (no tempo change)',
    beatsync: beatSyncEnabled ? 'BeatSync tempo lock held through blend' : 'BeatSync downbeat drop',
    harmonic: 'Harmonic key-first blend',
    continuous: 'Continuous Play gapless splice',
    original: 'Original Playback',
  };
  parts.push(modeLead[mode]);
  if (beatSyncEnabled) {
    const adjStr =
      Math.abs(tempo.deltaPercent) < 0.3
        ? 'exact tempo lock'
        : `${tempo.deltaPercent > 0 ? '+' : ''}${tempo.deltaPercent}% pitch-safe sync`;
    parts.push(`Beat-locked ${a.bpm} → ${b.bpm} BPM (${adjStr})`);
  } else {
    parts.push(`Natural tempo (${a.bpm} → ${b.bpm} BPM)`);
  }
  if (harmony.relation !== 'unknown') {
    parts.push(harmony.description);
  }
  if (bothInstrumental) {
    parts.push('clean instrumental outro→intro pocket');
  } else if (vocalOverlapRisk >= 62 && cfg.vocalProtectionEnabled) {
    parts.push('vocal-safe fade prevents lyric collision');
  }
  if (eqSweepEnabled) {
    parts.push('low-end bass EQ swap active');
  }

  return {
    fromTrackId: fromTrack.id,
    toTrackId: toTrack.id,
    mode,
    compatibilityScore,
    confidence,
    transitionType,

    bpmCompatibility: tempo.compatibilityScore,
    keyCompatibility: harmony.score,
    harmonicRelation: harmony.relation,
    energyCompatibility,
    genreCompatibility,
    vocalOverlapRisk,
    beatAlignmentQuality,
    transitionPointQuality,

    beatSyncEnabled,
    tempoAdjustmentPercent: beatSyncEnabled ? tempo.deltaPercent : 0,
    targetPlaybackRate: beatSyncEnabled ? tempo.playbackRate : 1,
    preservePitch: !cfg.allowPitchShift,
    mixOutSec,
    cueInSec: Math.round(cueInSec * 100) / 100,
    transitionDurationSec,
    crossfadeCurve,
    eqSweepEnabled,

    rationale: parts.join(' • '),
    warnings,
    computedAt: new Date().toISOString(),
  };
}

/**
 * AI DJ Flow — Sequences a playlist for maximum harmonic (Camelot), BPM, and energy flow.
 * Keeps index 0 (the anchor/currently playing track) pinned at position 0 and greedily
 * picks the most musically compatible next track at each step.
 */
export function optimizePlaylistFlow(
  tracks: DJTrackSource[],
  analyses: Record<string, TrackAudioAnalysis>,
  config?: Partial<MixConfiguration>,
  anchorTrackId?: string
): { orderedTracks: DJTrackSource[]; avgCompatibility: number } {
  if (tracks.length <= 2) {
    return { orderedTracks: [...tracks], avgCompatibility: 85 };
  }

  const remaining = [...tracks];
  const anchorIdx = anchorTrackId ? remaining.findIndex((t) => t.id === anchorTrackId) : 0;
  const startTrack = remaining.splice(anchorIdx >= 0 ? anchorIdx : 0, 1)[0];
  const ordered: DJTrackSource[] = [startTrack];
  let totalScore = 0;
  let transitions = 0;

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    const curAnalysis = analyses[current.id];
    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const candAnalysis = analyses[candidate.id];

      let score = 60;
      if (curAnalysis && candAnalysis) {
        const plan = planTransition({
          fromTrack: current,
          toTrack: candidate,
          fromAnalysis: curAnalysis,
          toAnalysis: candAnalysis,
          config,
        });
        score = plan.compatibilityScore;
      } else {
        // Lightweight metadata scoring before full PCM decode finishes
        const bpmDiff = Math.abs((current.bpm || 100) - (candidate.bpm || 100));
        const genreBonus = evaluateGenreCompatibility(current.genre, candidate.genre) * 0.4;
        score = Math.max(20, 100 - bpmDiff * 1.4) * 0.6 + genreBonus;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    ordered.push(remaining.splice(bestIdx, 1)[0]);
    totalScore += bestScore;
    transitions++;
  }

  return {
    orderedTracks: ordered,
    avgCompatibility: transitions > 0 ? Math.round(totalScore / transitions) : 85,
  };
}

/**
 * Shuffle-aware intelligent next track picker: evaluates candidate tracks and picks
 * from the top harmonically/rhythmically compatible pool while preserving shuffle randomness.
 */
export function pickSmartShuffleNext(
  currentTrack: DJTrackSource,
  candidates: DJTrackSource[],
  analyses: Record<string, TrackAudioAnalysis>,
  config?: Partial<MixConfiguration>
): DJTrackSource | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const curAnalysis = analyses[currentTrack.id];
  const scored = candidates.map((cand) => {
    const candAnalysis = analyses[cand.id];
    let score = 60;
    if (curAnalysis && candAnalysis) {
      score = planTransition({
        fromTrack: currentTrack,
        toTrack: cand,
        fromAnalysis: curAnalysis,
        toAnalysis: candAnalysis,
        config,
      }).compatibilityScore;
    } else {
      const bpmDiff = Math.abs((currentTrack.bpm || 100) - (cand.bpm || 100));
      score = Math.max(20, 100 - bpmDiff * 1.3);
    }
    return { cand, score };
  });

  scored.sort((x, y) => y.score - x.score);
  // Pick randomly among the top 3 compatible tracks so shuffle remains surprising yet smoothly mixed
  const poolSize = Math.min(3, scored.length);
  const pickIdx = Math.floor(Math.random() * poolSize);
  return scored[pickIdx].cand;
}

