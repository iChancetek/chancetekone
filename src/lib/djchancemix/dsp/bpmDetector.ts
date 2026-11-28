/**
 * DJChanceMix — Real-Time & Offline BPM Detection and Beat-Grid Tracker
 *
 * Uses multi-frame spectral/energy onset flux + lag autocorrelation with Gaussian
 * tempo preference and octave disambiguation to accurately identify BPM, beat phase,
 * beat timestamps, downbeats, and bar boundaries directly from raw PCM audio.
 */

export interface BpmAnalysisResult {
  bpm: number;
  bpmConfidence: number; // 0..1
  beatOffsetSec: number;
  barDurationSec: number;
  timeSignature: '4/4' | '3/4' | 'unknown';
  beatTimestamps: number[];
  downbeats: number[];
}

/**
 * Computes a high-sensitivity percussive Onset Detection Function (ODF)
 * from mono PCM samples by tracking positive energy & high-frequency transient deltas.
 */
function computeOnsetEnvelope(
  samples: Float32Array,
  sampleRate: number,
  hopSize: number,
  frameSize: number
): Float32Array {
  const numFrames = Math.max(0, Math.floor((samples.length - frameSize) / hopSize));
  const envelope = new Float32Array(numFrames);
  if (numFrames === 0) return envelope;

  let prevLowE = 0;
  let prevFullE = 0;

  // One-pole low-pass state for bass/kick isolation (~180 Hz)
  const rcLow = 1 / (2 * Math.PI * 180);
  const dt = 1 / sampleRate;
  const alphaLow = dt / (rcLow + dt);
  let lpState = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let lowEnergy = 0;
    let fullEnergy = 0;
    let diffEnergy = 0;
    let prevS = samples[start] || 0;

    for (let i = 0; i < frameSize; i++) {
      const s = samples[start + i];
      lpState += alphaLow * (s - lpState);
      lowEnergy += lpState * lpState;
      fullEnergy += s * s;
      const d = s - prevS;
      diffEnergy += d * d;
      prevS = s;
    }

    const lowRms = Math.sqrt(lowEnergy / frameSize);
    const fullRms = Math.sqrt(fullEnergy / frameSize);
    const highTransient = Math.sqrt(diffEnergy / frameSize);

    // Weighted percussive onset flux (kick punch + snare crack + full energy rise)
    const lowFlux = Math.max(0, lowRms - prevLowE);
    const fullFlux = Math.max(0, fullRms - prevFullE);
    envelope[f] = lowFlux * 1.85 + fullFlux * 1.15 + highTransient * 0.25;

    prevLowE = lowRms;
    prevFullE = fullRms;
  }

  // Adaptive local mean subtraction (half-wave rectified) to sharpen beat peaks
  const winRadius = 8;
  const sharpened = new Float32Array(numFrames);
  let maxVal = 0;
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - winRadius);
    const hi = Math.min(numFrames - 1, i + winRadius);
    for (let j = lo; j <= hi; j++) {
      sum += envelope[j];
      count++;
    }
    const mean = count > 0 ? sum / count : 0;
    const v = Math.max(0, envelope[i] - mean * 1.05);
    sharpened[i] = v;
    if (v > maxVal) maxVal = v;
  }

  if (maxVal > 1e-8) {
    for (let i = 0; i < numFrames; i++) {
      sharpened[i] /= maxVal;
    }
  }

  return sharpened;
}

/**
 * Analyzes mono PCM samples to detect BPM, tempo confidence, beat grid, and downbeats.
 */
export function detectBpmAndBeatGrid(
  samples: Float32Array,
  sampleRate: number,
  options?: { hintBpm?: number; activeStartSec?: number; activeEndSec?: number }
): BpmAnalysisResult {
  const duration = samples.length / Math.max(1, sampleRate);
  if (samples.length < sampleRate * 2 || duration < 2) {
    const fallbackBpm = options?.hintBpm && options.hintBpm > 50 ? options.hintBpm : 100;
    return {
      bpm: fallbackBpm,
      bpmConfidence: 0.2,
      beatOffsetSec: 0,
      barDurationSec: (60 / fallbackBpm) * 4,
      timeSignature: 'unknown',
      beatTimestamps: [],
      downbeats: [],
    };
  }

  // Analyze up to a representative 90-second window from the musical core for speed + accuracy
  const activeStart = Math.max(0, options?.activeStartSec ?? 0);
  const activeEnd = Math.min(duration, options?.activeEndSec ?? duration);
  const activeDur = Math.max(2, activeEnd - activeStart);

  const maxWindowSec = 90;
  const windowStartSec =
    activeDur > maxWindowSec ? activeStart + (activeDur - maxWindowSec) * 0.3 : activeStart;
  const windowEndSec = Math.min(activeEnd, windowStartSec + maxWindowSec);
  const startSample = Math.floor(windowStartSec * sampleRate);
  const endSample = Math.min(samples.length, Math.floor(windowEndSec * sampleRate));
  const slice = samples.subarray(startSample, endSample);

  const hopSize = Math.max(256, Math.round(sampleRate * 0.0116)); // ~86 Hz onset rate
  const frameSize = hopSize * 2;
  const odfRate = sampleRate / hopSize;
  const odf = computeOnsetEnvelope(slice, sampleRate, hopSize, frameSize);

  // Check if signal is essentially flat/ambient (very few rhythmic transients)
  let odfEnergy = 0;
  let odfPeakCount = 0;
  for (let i = 1; i < odf.length - 1; i++) {
    odfEnergy += odf[i] * odf[i];
    if (odf[i] > 0.28 && odf[i] >= odf[i - 1] && odf[i] >= odf[i + 1]) {
      odfPeakCount++;
    }
  }
  const odfRms = Math.sqrt(odfEnergy / Math.max(1, odf.length));
  if (odfRms < 0.025 || odfPeakCount < 4) {
    const fallbackBpm = options?.hintBpm && options.hintBpm >= 60 ? options.hintBpm : 96;
    return {
      bpm: fallbackBpm,
      bpmConfidence: 0.18,
      beatOffsetSec: activeStart,
      barDurationSec: (60 / fallbackBpm) * 4,
      timeSignature: 'unknown',
      beatTimestamps: [],
      downbeats: [],
    };
  }

  // Evaluate autocorrelation over BPM range 68..176 (lag in ODF frames)
  const minBpm = 68;
  const maxBpm = 176;
  const minLag = Math.max(4, Math.floor((60 * odfRate) / maxBpm));
  const maxLag = Math.min(Math.floor(odf.length / 2) - 1, Math.ceil((60 * odfRate) / minBpm));

  const corrByLag = new Float32Array(maxLag + 1);
  let maxCorr = 0;
  let meanCorr = 0;
  let lagCount = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const len = odf.length - lag;
    for (let i = 0; i < len; i++) {
      sum += odf[i] * odf[i + lag];
    }
    const rawScore = len > 0 ? sum / len : 0;

    // Harmonic comb reinforcement (2x and 4x bar lags boost true tempo over spurious sub-pulses)
    let combBonus = 0;
    if (lag * 2 < odf.length - 1) {
      let s2 = 0;
      const len2 = odf.length - lag * 2;
      for (let i = 0; i < len2; i++) s2 += odf[i] * odf[i + lag * 2];
      combBonus += (s2 / Math.max(1, len2)) * 0.45;
    }

    const bpmAtLag = (60 * odfRate) / lag;
    // Soft perceptual tempo prior centered at 112 BPM (natural DJ range 75..155)
    const prior = 0.86 + 0.14 * Math.exp(-0.5 * Math.pow(Math.log2(bpmAtLag / 112) / 0.62, 2));

    const score = (rawScore + combBonus) * prior;
    corrByLag[lag] = score;
    meanCorr += score;
    lagCount++;
    if (score > maxCorr) maxCorr = score;
  }

  meanCorr /= Math.max(1, lagCount);

  // Pick best lag peak + parabolic interpolation for sub-frame BPM accuracy
  let bestLag = minLag;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corrByLag[lag] > bestScore) {
      bestScore = corrByLag[lag];
      bestLag = lag;
    }
  }

  // Octave disambiguation: compare bestLag vs half/double tempo
  const candidates: Array<{ lag: number; score: number }> = [{ lag: bestLag, score: bestScore }];
  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= minLag && halfLag <= maxLag) {
    candidates.push({ lag: halfLag, score: corrByLag[halfLag] });
  }
  const doubleLag = Math.round(bestLag * 2);
  if (doubleLag >= minLag && doubleLag <= maxLag) {
    candidates.push({ lag: doubleLag, score: corrByLag[doubleLag] });
  }

  let chosenLag = bestLag;
  for (const cand of candidates) {
    const candBpm = (60 * odfRate) / cand.lag;
    const chosenBpm = (60 * odfRate) / chosenLag;

    // If a strong metadata hint matches an octave candidate within ±3%, prefer the matching octave
    if (
      options?.hintBpm &&
      options.hintBpm >= 60 &&
      options.hintBpm <= 185 &&
      cand.score >= bestScore * 0.72
    ) {
      const distCand = Math.abs(candBpm - options.hintBpm) / options.hintBpm;
      const distChosen = Math.abs(chosenBpm - options.hintBpm) / options.hintBpm;
      if (distCand < 0.035 && distCand < distChosen) {
        chosenLag = cand.lag;
        continue;
      }
    }

    // Otherwise prefer the DJ sweet spot (82..152 BPM) if scores are within 12%
    const candInSweetSpot = candBpm >= 82 && candBpm <= 152;
    const chosenInSweetSpot = chosenBpm >= 82 && chosenBpm <= 152;
    if (candInSweetSpot && !chosenInSweetSpot && cand.score >= bestScore * 0.88) {
      chosenLag = cand.lag;
    }
  }

  // Parabolic interpolation around chosenLag
  let refinedLag = chosenLag;
  if (chosenLag > minLag && chosenLag < maxLag) {
    const y0 = corrByLag[chosenLag - 1];
    const y1 = corrByLag[chosenLag];
    const y2 = corrByLag[chosenLag + 1];
    const denom = 2 * (y0 - 2 * y1 + y2);
    if (Math.abs(denom) > 1e-10) {
      const delta = (y0 - y2) / denom;
      if (Math.abs(delta) < 1) {
        refinedLag = chosenLag + delta;
      }
    }
  }

  const rawBpm = (60 * odfRate) / refinedLag;
  const bpm = Math.round(Math.max(60, Math.min(185, rawBpm)) * 10) / 10;
  const beatPeriodSec = 60 / bpm;

  // Compute confidence from peak-to-mean ratio of autocorrelation
  const peakToMean = meanCorr > 1e-8 ? corrByLag[chosenLag] / meanCorr : 1;
  const rawConfidence = Math.max(0, Math.min(1, (peakToMean - 1.15) / 2.2));
  const bpmConfidence = Math.round(rawConfidence * 100) / 100;

  // Phase-lock beat offset by testing phase shifts across one beat period
  const beatPeriodFrames = beatPeriodSec * odfRate;
  const phaseSteps = Math.max(12, Math.round(beatPeriodFrames));
  let bestPhaseFrame = 0;
  let bestPhaseScore = -1;

  for (let p = 0; p < phaseSteps; p++) {
    let score = 0;
    let hits = 0;
    for (let pos = p; pos < odf.length; pos += beatPeriodFrames) {
      const idx = Math.round(pos);
      if (idx >= 0 && idx < odf.length) {
        score += odf[idx];
        // Include ±1 neighbor tolerance for human groove swing
        if (idx > 0) score += odf[idx - 1] * 0.35;
        if (idx < odf.length - 1) score += odf[idx + 1] * 0.35;
        hits++;
      }
    }
    const avg = hits > 0 ? score / hits : 0;
    if (avg > bestPhaseScore) {
      bestPhaseScore = avg;
      bestPhaseFrame = p;
    }
  }

  const firstBeatInWindowSec = windowStartSec + bestPhaseFrame / odfRate;
  // Project grid cleanly back to activeStart and forward to activeEnd
  let beatOffsetSec = firstBeatInWindowSec;
  while (beatOffsetSec - beatPeriodSec >= activeStart) {
    beatOffsetSec -= beatPeriodSec;
  }
  beatOffsetSec = Math.max(0, Math.round(beatOffsetSec * 1000) / 1000);

  // Build full beat timestamps across the song (capped neatly for storage)
  const beatTimestamps: number[] = [];
  for (let t = beatOffsetSec; t <= activeEnd; t += beatPeriodSec) {
    beatTimestamps.push(Math.round(t * 1000) / 1000);
  }

  // Detect downbeat phase (0, 1, 2, or 3 within 4/4 bar) by strongest beat energy
  const phaseBarScores = [0, 0, 0, 0];
  for (let i = 0; i < beatTimestamps.length; i++) {
    const relSec = beatTimestamps[i] - windowStartSec;
    const frameIdx = Math.round(relSec * odfRate);
    if (frameIdx >= 0 && frameIdx < odf.length) {
      phaseBarScores[i % 4] += odf[frameIdx];
    }
  }
  let downbeatPhase = 0;
  for (let k = 1; k < 4; k++) {
    if (phaseBarScores[k] > phaseBarScores[downbeatPhase]) {
      downbeatPhase = k;
    }
  }

  const downbeats: number[] = [];
  for (let i = downbeatPhase; i < beatTimestamps.length; i += 4) {
    downbeats.push(beatTimestamps[i]);
  }

  return {
    bpm,
    bpmConfidence,
    beatOffsetSec: downbeats[0] ?? beatOffsetSec,
    barDurationSec: Math.round(beatPeriodSec * 4 * 1000) / 1000,
    timeSignature: bpmConfidence >= 0.35 ? '4/4' : 'unknown',
    beatTimestamps,
    downbeats,
  };
}

