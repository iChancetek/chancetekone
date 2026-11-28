/**
 * DJChanceMix — Real-Time Dual-Deck Web Audio Mixing Engine (Pro Edition)
 *
 * Independent Deck A & Deck B playback channels with:
 * - Web Audio API signal graph:
 *   MediaElementSource -> LUFS Normalize Gain -> Bass-Swap LowShelf EQ -> Trim Gain -> Crossfade Gain
 *   -> Master Bus -> DJ Color Sweep Filter (LPF/HPF) -> Brickwall True-Peak Limiter (-1.0 dBTP) -> Analyser -> Output
 * - Pitch-preserving time stretching (`preservesPitch = true`) with configurable ±% tempo sync & smooth tempo restoration
 * - Equal-power, Linear, Adaptive S-Curve, and Volume-Aware crossfade curves
 * - Low-end bass EQ swap during beat-matched transitions
 * - Strict anti-duplicate guard on automatic deck loading (never auto-loads the same song onto both decks; only manual load allows it)
 * - Continuous full-playlist auto-mixing with fallback transition planning so songs ALWAYS mix seamlessly from Track 1 to Track N
 * - Manual independent Deck A / Deck B track loading, Play/Pause, Cue, BPM Sync, and DJ Filter Sweep
 * - Mobile-thermal safe (zero idle animation loops when paused/hidden)
 */

import {
  CrossfadeCurve,
  DeckId,
  DeckSnapshot,
  DEFAULT_MIX_CONFIGURATION,
  DJTrackSource,
  MixConfiguration,
  MixerEngineSnapshot,
  MixMode,
  TrackAudioAnalysis,
  TransitionPhase,
  TransitionPlan,
} from '@/types/djchancemix';
import { hashAudioReference, resolveAuthorizedPlayableUrl } from './audioSourceProvider';
import { buildFallbackAnalysis, TrackAnalyzerService } from './analyzerService';
import { planTransition } from './transitionIntelligence';
import { reportClientAiMetric } from '@/lib/telemetry/wyresClient';

interface DeckChannel {
  id: DeckId;
  audio: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode | null;
  normGainNode: GainNode | null;
  bassEqNode: BiquadFilterNode | null;
  xfadeGainNode: GainNode | null;
  trimGainNode: GainNode | null;
  track: DJTrackSource | null;
  analysis: TrackAudioAnalysis | null;
  status: DeckSnapshot['status'];
  volume: number;
  gainApplied: number;
  bassEqDb: number;
  error: string | null;
  loadedSrc: string;
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Evaluates crossfade gain pair (outGain, inGain) for progress p in [0, 1].
 */
export function computeCrossfadeGains(
  progress: number,
  curve: CrossfadeCurve,
  loudnessDeltaDb = 0
): { outGain: number; inGain: number } {
  const p = Math.max(0, Math.min(1, progress));
  switch (curve) {
    case 'linear':
      return { outGain: 1 - p, inGain: p };

    case 'adaptive': {
      const s = p * p * (3 - 2 * p);
      return {
        outGain: Math.cos(s * Math.PI * 0.5),
        inGain: Math.sin(s * Math.PI * 0.5),
      };
    }

    case 'volume-aware': {
      const eqOut = Math.cos(p * Math.PI * 0.5);
      const eqIn = Math.sin(p * Math.PI * 0.5);
      const comp = Math.max(-0.15, Math.min(0.15, loudnessDeltaDb * 0.015));
      return {
        outGain: Math.max(0, Math.min(1, eqOut * (1 + comp * p))),
        inGain: Math.max(0, Math.min(1, eqIn * (1 - comp * (1 - p)))),
      };
    }

    case 'equal-power':
    default:
      return {
        outGain: Math.cos(p * Math.PI * 0.5),
        inGain: Math.sin(p * Math.PI * 0.5),
      };
  }
}

function setPreservesPitch(audio: HTMLAudioElement, preserve: boolean) {
  const el = audio as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  if ('preservesPitch' in el) el.preservesPitch = preserve;
  if ('mozPreservesPitch' in el) el.mozPreservesPitch = preserve;
  if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = preserve;
}

const ZERO_SPECTRUM = new Array<number>(16).fill(0);

export class DualDeckMixerEngine {
  private audioCtx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private djFilterNode: BiquadFilterNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserTimeData: Uint8Array<ArrayBuffer> | null = null;
  private analyserFreqData: Uint8Array<ArrayBuffer> | null = null;
  private webAudioActive = false;

  private decks: Record<DeckId, DeckChannel>;
  private activeDeckId: DeckId = 'A';
  private config: MixConfiguration = { ...DEFAULT_MIX_CONFIGURATION };
  private masterVolume = 0.9;
  private isMuted = false;
  private crossfaderPosition = 0; // 0 = full Deck A, 1 = full Deck B
  private manualCrossfaderOverride = false;
  private djFilterAmount = 0; // -1 = low-pass, 0 = bypass, +1 = high-pass

  private transitionPhase: TransitionPhase = 'idle';
  private transitionProgress = 0;
  private activePlan: TransitionPlan | null = null;
  private transitionStartedAtMs = 0;
  private transitionInitialRateB = 1;
  private transitionInFlight = false;
  /** BeatSync: gently glides the promoted deck from its locked tempo back to natural 1.0x after the blend */
  private tempoGlide: { deckId: DeckId; fromRate: number; startedAtMs: number; durationMs: number } | null = null;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(snap: MixerEngineSnapshot) => void>();
  private onRequestNextTrack?: (currentActiveTrackId?: string) => DJTrackSource | null;
  private onTrackAdvanced?: (newActiveTrack: DJTrackSource) => void;
  private onBeforePlayExternalPause?: () => void;

  constructor() {
    this.decks = {
      A: this.createDeckChannel('A'),
      B: this.createDeckChannel('B'),
    };
  }

  private createDeckChannel(id: DeckId): DeckChannel {
    const audio =
      typeof window !== 'undefined' ? new Audio() : ({} as HTMLAudioElement);
    if (typeof window !== 'undefined') {
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      setPreservesPitch(audio, true);
      audio.addEventListener('ended', () => this.handleDeckEnded(id));
      audio.addEventListener('error', () => this.handleDeckError(id));
      audio.addEventListener('loadedmetadata', () => {
        if (id === this.activeDeckId) {
          this.recomputeTransitionPlan();
          this.emit();
        }
      });
    }

    return {
      id,
      audio,
      sourceNode: null,
      normGainNode: null,
      bassEqNode: null,
      xfadeGainNode: null,
      trimGainNode: null,
      track: null,
      analysis: null,
      status: 'empty',
      volume: 1,
      gainApplied: id === 'A' ? 1 : 0,
      bassEqDb: 0,
      error: null,
      loadedSrc: '',
    };
  }

  /**
   * Initializes Web Audio DSP graph inside a user gesture (required by iOS Safari & Chrome).
   */
  private ensureWebAudioGraph(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.audioCtx && this.webAudioActive) {
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => {});
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;
      this.audioCtx = new AudioCtx();

      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = this.isMuted ? 0 : this.masterVolume;

      // Master DJ Club Filter Sweep (allpass at 0, lowpass when < 0, highpass when > 0)
      this.djFilterNode = this.audioCtx.createBiquadFilter();
      this.djFilterNode.type = 'allpass';
      this.djFilterNode.frequency.value = 1000;
      this.djFilterNode.Q.value = 1.2;

      // Brickwall True-Peak Limiter (-1.0 dB threshold, 20:1 ratio)
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -1.0;
      this.limiterNode.knee.value = 0;
      this.limiterNode.ratio.value = 20;
      this.limiterNode.attack.value = 0.002;
      this.limiterNode.release.value = 0.08;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.analyserTimeData = new Uint8Array(new ArrayBuffer(this.analyserNode.frequencyBinCount));
      this.analyserFreqData = new Uint8Array(new ArrayBuffer(this.analyserNode.frequencyBinCount));

      this.masterGainNode.connect(this.djFilterNode);
      this.djFilterNode.connect(this.limiterNode);
      this.limiterNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      for (const id of ['A', 'B'] as DeckId[]) {
        const ch = this.decks[id];
        ch.sourceNode = this.audioCtx.createMediaElementSource(ch.audio);
        ch.normGainNode = this.audioCtx.createGain();
        ch.bassEqNode = this.audioCtx.createBiquadFilter();
        ch.bassEqNode.type = 'lowshelf';
        ch.bassEqNode.frequency.value = 140;
        ch.bassEqNode.gain.value = 0;
        ch.trimGainNode = this.audioCtx.createGain();
        ch.trimGainNode.gain.value = ch.volume;
        ch.xfadeGainNode = this.audioCtx.createGain();
        ch.xfadeGainNode.gain.value = id === this.activeDeckId ? 1 : 0;

        ch.sourceNode.connect(ch.normGainNode);
        ch.normGainNode.connect(ch.bassEqNode);
        ch.bassEqNode.connect(ch.trimGainNode);
        ch.trimGainNode.connect(ch.xfadeGainNode);
        ch.xfadeGainNode.connect(this.masterGainNode);
      }

      this.webAudioActive = true;
      this.applyDjFilter(this.djFilterAmount);
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn('[DJChanceMix] Web Audio graph fallback to dual HTMLAudioElement mixing:', err);
      this.webAudioActive = false;
      return false;
    }
  }

  public setCallbacks(cbs: {
    onRequestNextTrack?: (currentActiveTrackId?: string) => DJTrackSource | null;
    onTrackAdvanced?: (track: DJTrackSource) => void;
    onBeforePlayExternalPause?: () => void;
  }) {
    this.onRequestNextTrack = cbs.onRequestNextTrack;
    this.onTrackAdvanced = cbs.onTrackAdvanced;
    this.onBeforePlayExternalPause = cbs.onBeforePlayExternalPause;
  }

  public subscribe(listener: (snap: MixerEngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public updateConfig(next: Partial<MixConfiguration>) {
    this.config = { ...this.config, ...next };
    for (const id of ['A', 'B'] as DeckId[]) {
      const ch = this.decks[id];
      setPreservesPitch(ch.audio, !this.config.allowPitchShift);
      this.applyNormalizationToDeck(ch);
    }
    this.recomputeTransitionPlan();
    this.emit();
  }

  public setMode(mode: MixMode) {
    const prevMode = this.config.defaultMode;
    this.config = { ...this.config, defaultMode: mode };

    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    const mixing = this.transitionPhase === 'mixing' || this.transitionInFlight;

    // Original Playback = unmodified studio master: natural tempo, no loudness gain, flat filter
    if (mode === 'original' && !mixing) {
      this.tempoGlide = null;
      active.audio.playbackRate = 1.0;
      next.audio.playbackRate = 1.0;
      if (Math.abs(this.djFilterAmount) > 0.001) {
        this.djFilterAmount = 0;
        this.applyDjFilter(0);
      }
    }

    // Re-apply (or bypass) loudness normalization for the new mode
    this.applyNormalizationToDeck(active);
    this.applyNormalizationToDeck(next);

    const plan = this.recomputeTransitionPlan();

    // Pre-sync / release the cued deck's tempo so the mode change is immediately visible on the decks
    if (!mixing && next.track && next.audio.paused) {
      if (mode === 'beatsync' && plan?.beatSyncEnabled) {
        setPreservesPitch(next.audio, plan.preservePitch);
        next.audio.playbackRate = plan.targetPlaybackRate;
      } else if (prevMode === 'beatsync' || mode === 'original') {
        next.audio.playbackRate = 1.0;
      }
    }

    this.emit();
  }

  public getConfig(): MixConfiguration {
    return { ...this.config };
  }

  private getNextDeckId(): DeckId {
    return this.activeDeckId === 'A' ? 'B' : 'A';
  }

  private applyNormalizationToDeck(ch: DeckChannel) {
    const linear =
      this.config.normalizationEnabled && this.config.defaultMode !== 'original' && ch.analysis
        ? dbToLinear(ch.analysis.recommendedGainDb || 0)
        : 1.0;

    if (this.webAudioActive && ch.normGainNode && this.audioCtx) {
      ch.normGainNode.gain.setTargetAtTime(linear, this.audioCtx.currentTime, 0.04);
    }
  }

  private applyDeckGainAndEq(ch: DeckChannel, xfadeGain: number, bassEqDb = 0) {
    ch.gainApplied = Math.max(0, Math.min(1.5, xfadeGain));
    ch.bassEqDb = bassEqDb;

    if (this.webAudioActive && ch.xfadeGainNode && ch.bassEqNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      ch.xfadeGainNode.gain.setTargetAtTime(ch.gainApplied, now, 0.025);
      ch.bassEqNode.gain.setTargetAtTime(bassEqDb, now, 0.04);
    } else {
      const normScale =
        this.config.normalizationEnabled && this.config.defaultMode !== 'original' && ch.analysis
          ? Math.min(1, dbToLinear(ch.analysis.recommendedGainDb || 0))
          : 1;
      const effectiveVol = this.isMuted
        ? 0
        : Math.max(0, Math.min(1, ch.gainApplied * ch.volume * this.masterVolume * normScale));
      try {
        ch.audio.volume = effectiveVol;
      } catch {
        // ignore read-only audio.volume on iOS
      }
    }
  }

  /**
   * Real-time DJ Color Filter Sweep (-1 = deep Low-Pass, 0 = Clean Bypass, +1 = airy High-Pass).
   */
  public setDjFilter(amount: number) {
    const clamped = Math.max(-1, Math.min(1, Math.round(amount * 100) / 100));
    this.djFilterAmount = clamped;
    this.applyDjFilter(clamped);
    this.emit();
  }

  private applyDjFilter(amount: number) {
    if (!this.webAudioActive || !this.djFilterNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (Math.abs(amount) < 0.04) {
      this.djFilterNode.type = 'allpass';
      this.djFilterNode.frequency.setTargetAtTime(1000, now, 0.03);
      this.djFilterNode.Q.setTargetAtTime(0.7, now, 0.03);
    } else if (amount < 0) {
      // Low-pass sweep: 14,000 Hz down to 220 Hz exponentially
      const depth = Math.abs(amount);
      const freq = 14000 * Math.pow(220 / 14000, depth);
      this.djFilterNode.type = 'lowpass';
      this.djFilterNode.frequency.setTargetAtTime(freq, now, 0.03);
      this.djFilterNode.Q.setTargetAtTime(1.4 + depth * 2.4, now, 0.03);
    } else {
      // High-pass sweep: 60 Hz up to 3,800 Hz exponentially
      const depth = amount;
      const freq = 60 * Math.pow(3800 / 60, depth);
      this.djFilterNode.type = 'highpass';
      this.djFilterNode.frequency.setTargetAtTime(freq, now, 0.03);
      this.djFilterNode.Q.setTargetAtTime(1.4 + depth * 2.4, now, 0.03);
    }
  }

  /**
   * Loads a track into a specific deck (active or standby) and runs async DSP analysis.
   */
  public async loadTrackOnDeck(
    deckId: DeckId,
    track: DJTrackSource,
    options?: { autoplay?: boolean; seekToSec?: number; manual?: boolean }
  ): Promise<void> {
    const ch = this.decks[deckId];
    if (this.tempoGlide?.deckId === deckId) this.tempoGlide = null;
    ch.track = track;
    ch.status = 'loading';
    ch.error = null;
    ch.analysis = TrackAnalyzerService.getCached(track.id);
    this.emit();

    try {
      const playableUrl = await resolveAuthorizedPlayableUrl(track);
      if (ch.track?.id !== track.id) return;

      if (ch.loadedSrc !== playableUrl) {
        ch.audio.pause();
        ch.audio.src = playableUrl;
        ch.audio.load();
        ch.loadedSrc = playableUrl;
      }

      setPreservesPitch(ch.audio, !this.config.allowPitchShift);
      ch.audio.playbackRate = 1.0;

      // Kick off real PCM DSP analysis in parallel (or hit IndexedDB/server cache immediately)
      void TrackAnalyzerService.analyzeTrack(track, {
        targetLufs: this.config.targetLufs,
        silenceSensitivity: this.config.silenceSensitivity,
      }).then((analysis) => {
        if (ch.track?.id !== track.id) return;
        ch.analysis = analysis;
        this.applyNormalizationToDeck(ch);
        this.recomputeTransitionPlan();
        this.emit();
      });

      ch.status = 'ready';

      if (options?.autoplay) {
        this.ensureWebAudioGraph();
        this.onBeforePlayExternalPause?.();

        const other = this.decks[deckId === 'A' ? 'B' : 'A'];
        if (!options.manual) {
          other.audio.pause();
          if (other.track) other.status = 'ready';
          this.activeDeckId = deckId;
          this.transitionPhase = 'idle';
          this.transitionProgress = 0;
          this.transitionInFlight = false;
          this.manualCrossfaderOverride = false;
          this.crossfaderPosition = deckId === 'A' ? 0 : 1;
          this.applyDeckGainAndEq(ch, 1, 0);
          this.applyDeckGainAndEq(other, 0, 0);
        } else {
          // Manual deck play: ensure audible gain if crossfader wasn't set to this deck
          const desiredGain =
            deckId === 'A' ? Math.max(0.5, 1 - this.crossfaderPosition) : Math.max(0.5, this.crossfaderPosition);
          if (other.audio.paused) {
            this.activeDeckId = deckId;
            this.crossfaderPosition = deckId === 'A' ? 0 : 1;
            this.applyDeckGainAndEq(ch, 1, 0);
            this.applyDeckGainAndEq(other, 0, 0);
          } else {
            this.applyDeckGainAndEq(ch, desiredGain, 0);
          }
        }

        this.applyNormalizationToDeck(ch);

        const startOffset =
          typeof options.seekToSec === 'number'
            ? options.seekToSec
            : this.config.removeSilenceGaps &&
              this.config.defaultMode !== 'original' &&
              ch.analysis?.activeStartSec
            ? ch.analysis.activeStartSec
            : 0;
        if (startOffset > 0.1) {
          try {
            ch.audio.currentTime = startOffset;
          } catch {}
        }

        await ch.audio.play();
        ch.status = 'playing';
        this.startSchedulerLoop();
      }

      this.recomputeTransitionPlan();
      this.emit();
    } catch (err: any) {
      ch.status = 'error';
      ch.error = err?.message || 'Unable to load authorized audio stream';
      this.emit();
    }
  }

  /**
   * Manually loads ANY track onto Deck A or Deck B (explicit DJ action — allowed even if same track as other deck).
   */
  public async manualLoadTrackToDeck(
    deckId: DeckId,
    track: DJTrackSource,
    autoplay = false
  ): Promise<void> {
    await this.loadTrackOnDeck(deckId, track, { autoplay, manual: true });
    this.recomputeTransitionPlan();
    this.emit();
  }

  /**
   * Independent manual Play/Pause toggle for Deck A or Deck B.
   */
  public async toggleDeckPlay(deckId: DeckId): Promise<void> {
    const ch = this.decks[deckId];
    if (!ch.track) return;
    this.ensureWebAudioGraph();

    if (!ch.audio.paused) {
      ch.audio.pause();
      ch.status = 'paused';
      if (this.decks.A.audio.paused && this.decks.B.audio.paused) {
        this.stopSchedulerLoop();
      }
    } else {
      this.onBeforePlayExternalPause?.();
      const other = this.decks[deckId === 'A' ? 'B' : 'A'];
      if (other.audio.paused) {
        this.activeDeckId = deckId;
        this.crossfaderPosition = deckId === 'A' ? 0 : 1;
        this.applyDeckGainAndEq(ch, 1, 0);
        this.applyDeckGainAndEq(other, 0, 0);
      } else if (ch.gainApplied < 0.05) {
        // Bring crossfader to center blend so user immediately hears the manually started deck
        this.crossfaderPosition = 0.5;
        this.manualCrossfaderOverride = true;
        const { outGain: gA, inGain: gB } = computeCrossfadeGains(0.5, this.config.crossfadeCurve);
        this.applyDeckGainAndEq(this.decks.A, gA, this.decks.A.bassEqDb);
        this.applyDeckGainAndEq(this.decks.B, gB, this.decks.B.bassEqDb);
      }
      this.applyNormalizationToDeck(ch);
      await ch.audio.play();
      ch.status = 'playing';
      this.startSchedulerLoop();
    }
    this.emit();
  }

  /**
   * 1-Click BPM Sync: locks `deckId` playback tempo to match the opposite deck's effective BPM
   * within safe pitch-preserving bounds.
   */
  public syncDeckBpmToOther(deckId: DeckId): { ok: boolean; rate: number; message: string } {
    const targetDeck = this.decks[deckId];
    const sourceDeck = this.decks[deckId === 'A' ? 'B' : 'A'];
    const targetBpm = targetDeck.analysis?.bpm || targetDeck.track?.bpm;
    const sourceBpm =
      (sourceDeck.analysis?.bpm || sourceDeck.track?.bpm || 0) * (sourceDeck.audio.playbackRate || 1);

    if (!targetBpm || !sourceBpm) {
      return { ok: false, rate: 1, message: 'Load and analyze tracks on both decks to sync BPM.' };
    }

    const rawRate = sourceBpm / targetBpm;
    const maxDelta = this.config.maxTempoAdjustmentPercent / 100;
    const clampedRate = Math.max(1 - maxDelta, Math.min(1 + maxDelta, rawRate));
    setPreservesPitch(targetDeck.audio, !this.config.allowPitchShift);
    targetDeck.audio.playbackRate = Math.round(clampedRate * 1000) / 1000;
    this.emit();

    const pct = Math.round((clampedRate - 1) * 1000) / 10;
    const capped = Math.abs(rawRate - clampedRate) > 0.005;
    return {
      ok: true,
      rate: targetDeck.audio.playbackRate,
      message: capped
        ? `Deck ${deckId} synced as close as safe limit (${pct > 0 ? '+' : ''}${pct}%).`
        : `Deck ${deckId} BPM locked to Deck ${sourceDeck.id} (${Math.round(sourceBpm * 10) / 10} BPM, ${pct > 0 ? '+' : ''}${pct}%).`,
    };
  }

  /**
   * Starts playing a track immediately on the active deck and preloads a DISTINCT next track on the standby deck.
   */
  public async playTrack(track: DJTrackSource, upcomingTrack?: DJTrackSource | null): Promise<void> {
    const deckId = this.activeDeckId;
    await this.loadTrackOnDeck(deckId, track, { autoplay: true });
    const nextCandidate =
      upcomingTrack && upcomingTrack.id !== track.id
        ? upcomingTrack
        : this.onRequestNextTrack
        ? this.onRequestNextTrack(track.id)
        : null;
    await this.preloadNextTrack(nextCandidate, { allowDuplicateOfActive: false });
  }

  /**
   * Preloads and analyzes the upcoming track into the standby deck.
   * STRICT ANTI-DUPLICATE GUARD: automatic preloading NEVER loads the exact same song currently on the active deck.
   */
  public async preloadNextTrack(
    track: DJTrackSource | null,
    options?: { allowDuplicateOfActive?: boolean }
  ): Promise<void> {
    const nextId = this.getNextDeckId();
    const nextCh = this.decks[nextId];
    const activeCh = this.decks[this.activeDeckId];

    // Guard against automatic duplicate-song loading across Deck A & Deck B
    if (
      track &&
      !options?.allowDuplicateOfActive &&
      activeCh.track &&
      track.id === activeCh.track.id
    ) {
      nextCh.audio.pause();
      nextCh.track = null;
      nextCh.analysis = null;
      nextCh.status = 'empty';
      nextCh.loadedSrc = '';
      this.activePlan = null;
      this.transitionPhase = 'idle';
      this.emit();
      return;
    }

    if (!track) {
      nextCh.audio.pause();
      nextCh.track = null;
      nextCh.analysis = null;
      nextCh.status = 'empty';
      nextCh.loadedSrc = '';
      this.activePlan = null;
      this.transitionPhase = 'idle';
      this.emit();
      return;
    }

    if (nextCh.track?.id === track.id && nextCh.status !== 'empty' && nextCh.status !== 'error') {
      this.recomputeTransitionPlan();
      this.emit();
      return;
    }

    this.transitionPhase = 'preparing';
    this.emit();
    await this.loadTrackOnDeck(nextId, track, { autoplay: false });
  }

  /**
   * Builds or retrieves a usable TrackAudioAnalysis (falls back gracefully if PCM decode is still in progress).
   */
  private getEffectiveAnalysis(ch: DeckChannel): TrackAudioAnalysis | null {
    if (!ch.track) return null;
    if (ch.analysis) return ch.analysis;
    const liveDur =
      Number.isFinite(ch.audio.duration) && ch.audio.duration > 2
        ? ch.audio.duration
        : ch.track.duration || 180;
    return buildFallbackAnalysis(
      { ...ch.track, duration: liveDur },
      hashAudioReference(ch.track.id, ch.track.audioUrl)
    );
  }

  /**
   * Recomputes the TransitionPlan between the active deck and standby deck.
   * Uses live audio element duration so mixOutSec ALWAYS fires accurately even if metadata duration differed.
   */
  public recomputeTransitionPlan(): TransitionPlan | null {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track || !next.track) {
      this.activePlan = null;
      if (this.transitionPhase !== 'mixing') {
        this.transitionPhase = 'idle';
      }
      return null;
    }

    const activeAnalysis = this.getEffectiveAnalysis(active);
    const nextAnalysis = this.getEffectiveAnalysis(next);
    if (!activeAnalysis || !nextAnalysis) return null;

    // Anchor duration strictly to live decoded audio duration when available
    const realDurA =
      Number.isFinite(active.audio.duration) && active.audio.duration > 4
        ? active.audio.duration
        : activeAnalysis.duration || active.track.duration || 180;
    const realDurB =
      Number.isFinite(next.audio.duration) && next.audio.duration > 4
        ? next.audio.duration
        : nextAnalysis.duration || next.track.duration || 180;

    const syncedA: TrackAudioAnalysis = {
      ...activeAnalysis,
      duration: realDurA,
      activeEndSec: Math.min(realDurA, activeAnalysis.activeEndSec || realDurA),
    };
    const syncedB: TrackAudioAnalysis = {
      ...nextAnalysis,
      duration: realDurB,
      activeEndSec: Math.min(realDurB, nextAnalysis.activeEndSec || realDurB),
    };

    const plan = planTransition({
      fromTrack: { ...active.track, duration: realDurA },
      toTrack: { ...next.track, duration: realDurB },
      fromAnalysis: syncedA,
      toAnalysis: syncedB,
      config: this.config,
    });
    this.activePlan = plan;
    if (this.transitionPhase !== 'mixing') {
      this.transitionPhase = 'armed';
    }
    return plan;
  }

  /**
   * Manually triggers the intelligent transition immediately ("Mix Now" button).
   */
  public async triggerTransitionNow(): Promise<void> {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track || !next.track) return;
    if (this.transitionPhase === 'mixing' || this.transitionInFlight) return;

    this.recomputeTransitionPlan();
    await this.beginTransition(true);
  }

  private async beginTransition(manualTrigger = false): Promise<void> {
    if (this.transitionInFlight || this.transitionPhase === 'mixing') return;
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track || !next.track) return;

    this.transitionInFlight = true;
    try {
      this.ensureWebAudioGraph();
      const plan = this.activePlan || this.recomputeTransitionPlan();

      // Original mode or zero-duration cut (unless user explicitly pressed Mix Now!)
      if (!plan || (plan.transitionDurationSec <= 0.05 && !manualTrigger)) {
        await this.completeTransitionImmediate();
        return;
      }

      // If user pressed Mix Now while in Original mode, perform a clean 4s studio crossfade
      const effectivePlan: TransitionPlan =
        plan.transitionDurationSec <= 0.05 && manualTrigger
          ? { ...plan, transitionDurationSec: 4, transitionType: 'outro-to-intro' }
          : plan;

      this.activePlan = effectivePlan;
      this.transitionPhase = 'mixing';
      this.transitionProgress = 0;
      this.transitionStartedAtMs = Date.now();
      this.manualCrossfaderOverride = false;

      // Ensure outgoing deck is playing if Mix Now was triggered while paused
      if (active.audio.paused) {
        await active.audio.play().catch(() => {});
      }

      // Ensure incoming deck has its src resolved
      if (!next.loadedSrc) {
        const playableUrl = await resolveAuthorizedPlayableUrl(next.track);
        next.audio.src = playableUrl;
        next.audio.load();
        next.loadedSrc = playableUrl;
      }

      // Configure Deck B tempo sync (pitch-preserving by default) & Cue-In offset
      setPreservesPitch(next.audio, effectivePlan.preservePitch);
      const startRate = effectivePlan.beatSyncEnabled ? effectivePlan.targetPlaybackRate : 1.0;
      this.transitionInitialRateB = startRate;
      next.audio.playbackRate = startRate;

      let cueStart = effectivePlan.cueInSec || 0;
      if (effectivePlan.beatSyncEnabled && active.analysis?.bpm && next.analysis?.bpm) {
        const beatPeriodA = 60 / active.analysis.bpm;
        const offsetA = active.analysis.beatOffsetSec || 0;
        const curPosA = active.audio.currentTime || 0;
        const phaseInBeatA = (((curPosA - offsetA) % beatPeriodA) + beatPeriodA) % beatPeriodA;
        const beatPeriodB = 60 / next.analysis.bpm;
        const phaseOffsetB = (phaseInBeatA / beatPeriodA) * beatPeriodB;
        if (Number.isFinite(phaseOffsetB) && phaseOffsetB >= 0 && phaseOffsetB < beatPeriodB) {
          cueStart = Math.max(0, cueStart + phaseOffsetB * 0.5);
        }
      }

      try {
        next.audio.currentTime = Math.max(0, cueStart);
      } catch {}

      this.applyNormalizationToDeck(next);
      this.applyDeckGainAndEq(next, 0.001, effectivePlan.eqSweepEnabled ? -10 : 0);

      await next.audio.play();
      active.status = 'transitioning';
      next.status = 'transitioning';
      this.startSchedulerLoop();

      reportClientAiMetric({
        name: `djchancemix:transition:${effectivePlan.transitionType}`,
        runType: 'agent',
        provider: 'chancetek-agent',
        model: 'djchancemix-automix-v1',
        category: 'agentic_agent',
        feature: 'djchancemix-transition',
        input: {
          fromTrack: active.track.title,
          toTrack: next.track.title,
          mode: effectivePlan.mode,
          manualTrigger,
        },
        output: {
          compatibilityScore: effectivePlan.compatibilityScore,
          confidence: effectivePlan.confidence,
          transitionType: effectivePlan.transitionType,
          beatSyncEnabled: effectivePlan.beatSyncEnabled,
          tempoAdjustmentPercent: effectivePlan.tempoAdjustmentPercent,
          harmonicRelation: effectivePlan.harmonicRelation,
          transitionDurationSec: effectivePlan.transitionDurationSec,
          eqSweepEnabled: effectivePlan.eqSweepEnabled,
        },
        tags: ['djchancemix', effectivePlan.mode, effectivePlan.transitionType],
      });

      this.emit();
    } catch (err) {
      console.warn('[DJChanceMix] Transition launch recovered via direct handover:', err);
      this.transitionPhase = 'idle';
      this.transitionInFlight = false;
      await this.completeTransitionImmediate();
    }
  }

  private finishTransition() {
    const oldActive = this.decks[this.activeDeckId];
    const newActiveId = this.getNextDeckId();
    const newActive = this.decks[newActiveId];

    // Release outgoing deck cleanly
    oldActive.audio.pause();
    oldActive.audio.playbackRate = 1.0;
    this.applyDeckGainAndEq(oldActive, 0, 0);
    oldActive.status = oldActive.track ? 'ready' : 'empty';

    // Promote incoming deck to full active playback.
    // BeatSync holds the club tempo lock and glides back to natural 1.0x over the next 16 seconds;
    // every other mode has already ramped back during the blend.
    const plannedLock = this.activePlan;
    const lockedRate = newActive.audio.playbackRate || 1;
    if (plannedLock?.mode === 'beatsync' && plannedLock.beatSyncEnabled && Math.abs(lockedRate - 1) > 0.002) {
      this.tempoGlide = { deckId: newActiveId, fromRate: lockedRate, startedAtMs: Date.now(), durationMs: 16000 };
    } else {
      this.tempoGlide = null;
      newActive.audio.playbackRate = 1.0;
    }
    this.applyDeckGainAndEq(newActive, 1, 0);
    newActive.status = 'playing';

    this.activeDeckId = newActiveId;
    this.crossfaderPosition = newActiveId === 'A' ? 0 : 1;
    this.transitionPhase = 'idle';
    this.transitionProgress = 0;
    this.transitionInFlight = false;
    this.activePlan = null;

    const promotedTrack = newActive.track;
    if (promotedTrack) {
      // Advance queue cursor synchronously FIRST
      this.onTrackAdvanced?.(promotedTrack);
    }

    // Immediately preload & analyze the NEXT distinct track in the playlist!
    if (this.onRequestNextTrack) {
      const upcoming = this.onRequestNextTrack(promotedTrack?.id);
      void this.preloadNextTrack(upcoming, { allowDuplicateOfActive: false });
    }

    this.emit();
  }

  private async completeTransitionImmediate() {
    const oldActive = this.decks[this.activeDeckId];
    const newActiveId = this.getNextDeckId();
    const newActive = this.decks[newActiveId];
    if (!newActive.track) {
      this.transitionInFlight = false;
      return;
    }

    oldActive.audio.pause();
    oldActive.audio.playbackRate = 1.0;
    this.applyDeckGainAndEq(oldActive, 0, 0);
    oldActive.status = 'ready';
    this.tempoGlide = null;

    this.activeDeckId = newActiveId;
    this.crossfaderPosition = newActiveId === 'A' ? 0 : 1;
    this.transitionPhase = 'idle';
    this.transitionProgress = 0;
    this.transitionInFlight = false;
    this.activePlan = null;

    newActive.audio.playbackRate = 1.0;
    try {
      newActive.audio.currentTime =
        this.config.removeSilenceGaps &&
        this.config.defaultMode !== 'original' &&
        newActive.analysis?.activeStartSec
          ? newActive.analysis.activeStartSec
          : 0;
    } catch {}
    this.applyNormalizationToDeck(newActive);
    this.applyDeckGainAndEq(newActive, 1, 0);
    try {
      await newActive.audio.play();
      newActive.status = 'playing';
      this.startSchedulerLoop();
    } catch {}

    const promotedTrack = newActive.track;
    if (promotedTrack) {
      this.onTrackAdvanced?.(promotedTrack);
    }
    if (this.onRequestNextTrack) {
      void this.preloadNextTrack(this.onRequestNextTrack(promotedTrack?.id), {
        allowDuplicateOfActive: false,
      });
    }
    this.emit();
  }

  private handleDeckEnded(deckId: DeckId) {
    if (deckId !== this.activeDeckId) return;
    if (this.transitionPhase === 'mixing') {
      this.finishTransition();
      return;
    }
    const next = this.decks[this.getNextDeckId()];
    if (next.track) {
      void this.completeTransitionImmediate();
    } else if (this.onRequestNextTrack) {
      const upcoming = this.onRequestNextTrack(this.decks[deckId].track?.id);
      if (upcoming) {
        void this.playTrack(upcoming);
      } else {
        this.decks[deckId].status = 'paused';
        this.stopSchedulerLoop();
        this.emit();
      }
    } else {
      this.decks[deckId].status = 'paused';
      this.stopSchedulerLoop();
      this.emit();
    }
  }

  private handleDeckError(deckId: DeckId) {
    const ch = this.decks[deckId];
    if (!ch.track) return;
    ch.status = 'error';
    ch.error = 'Playback interrupted — advancing to next track cleanly.';
    if (deckId === this.activeDeckId) {
      const next = this.decks[this.getNextDeckId()];
      if (next.track) {
        void this.completeTransitionImmediate();
      }
    }
    this.emit();
  }

  private startSchedulerLoop() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => this.onTick(), 65);
  }

  private stopSchedulerLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private onTick() {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];

    const isAnyPlaying = !active.audio.paused || !next.audio.paused;
    if (!isAnyPlaying) {
      this.stopSchedulerLoop();
      this.emit();
      return;
    }

    // 0. Post-BeatSync tempo glide back to natural 1.0x
    if (this.tempoGlide) {
      const glideDeck = this.decks[this.tempoGlide.deckId];
      const p = Math.min(1, (Date.now() - this.tempoGlide.startedAtMs) / this.tempoGlide.durationMs);
      const rate = this.tempoGlide.fromRate + (1 - this.tempoGlide.fromRate) * p;
      glideDeck.audio.playbackRate = Math.round(rate * 10000) / 10000;
      if (p >= 1 || this.transitionPhase === 'mixing') {
        if (this.transitionPhase !== 'mixing') glideDeck.audio.playbackRate = 1.0;
        this.tempoGlide = null;
      }
    }

    // 1. Active transition execution
    if (this.transitionPhase === 'mixing' && this.activePlan) {
      const elapsedSec = (Date.now() - this.transitionStartedAtMs) / 1000;
      const dur = Math.max(0.5, this.activePlan.transitionDurationSec);
      const progress = Math.min(1, elapsedSec / dur);
      this.transitionProgress = progress;

      if (!this.manualCrossfaderOverride) {
        this.crossfaderPosition = this.activeDeckId === 'A' ? progress : 1 - progress;
      }

      const lufsDelta =
        (next.analysis?.integratedLufs ?? -14) - (active.analysis?.integratedLufs ?? -14);
      const { outGain, inGain } = computeCrossfadeGains(
        progress,
        this.activePlan.crossfadeCurve,
        lufsDelta
      );

      let outBassDb = 0;
      let inBassDb = 0;
      if (this.activePlan.eqSweepEnabled) {
        if (progress < 0.5) {
          outBassDb = -progress * 8;
          inBassDb = -10 + progress * 12;
        } else {
          outBassDb = -4 - (progress - 0.5) * 16;
          inBassDb = -4 + (progress - 0.5) * 8;
        }
      }

      this.applyDeckGainAndEq(active, outGain, outBassDb);
      this.applyDeckGainAndEq(next, inGain, inBassDb);

      // Tempo handling during the blend:
      // - BeatSync: hold the incoming deck locked to the outgoing BPM for the WHOLE blend (glides back afterwards)
      // - AutoMix / Harmonic: smoothly return Deck B to natural 1.0x over the second half
      if (this.activePlan.beatSyncEnabled && this.activePlan.mode !== 'beatsync' && progress > 0.55) {
        const rampP = (progress - 0.55) / 0.45;
        const rate = this.transitionInitialRateB + (1.0 - this.transitionInitialRateB) * rampP;
        next.audio.playbackRate = Math.round(rate * 10000) / 10000;
      }

      if (progress >= 1 || active.audio.ended) {
        this.finishTransition();
        return;
      }

      this.emit();
      return;
    }

    // 2. Armed transition monitor: fire smoothly whenever active track reaches mixOutSec!
    const curTime = active.audio.currentTime || 0;
    const dur =
      Number.isFinite(active.audio.duration) && active.audio.duration > 4
        ? active.audio.duration
        : active.analysis?.duration || active.track?.duration || 0;

    if (
      this.config.defaultMode !== 'original' &&
      !this.transitionInFlight &&
      next.track &&
      next.status !== 'error' &&
      dur > 6
    ) {
      const plan = this.activePlan || this.recomputeTransitionPlan();
      if (plan && plan.transitionDurationSec > 0.1) {
        // Clamp triggerTime cleanly against actual live duration so transition NEVER misses!
        const triggerTime = Math.max(
          2,
          Math.min(dur - Math.min(plan.transitionDurationSec, dur * 0.3), plan.mixOutSec)
        );
        if (curTime >= triggerTime) {
          void this.beginTransition(false);
          return;
        }
      }
    }

    this.emit();
  }

  // ── Manual Transport & Mixer Controls ────────────────────────────────

  public async togglePlay(): Promise<void> {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track) return;

    this.ensureWebAudioGraph();
    if (!active.audio.paused) {
      active.audio.pause();
      active.status = 'paused';
      if (this.transitionPhase === 'mixing') {
        next.audio.pause();
        next.status = 'paused';
      }
      this.stopSchedulerLoop();
    } else {
      this.onBeforePlayExternalPause?.();
      await active.audio.play();
      active.status = this.transitionPhase === 'mixing' ? 'transitioning' : 'playing';
      if (this.transitionPhase === 'mixing' && next.track) {
        await next.audio.play().catch(() => {});
        next.status = 'transitioning';
      }
      this.startSchedulerLoop();
    }
    this.emit();
  }

  public pauseAll(): void {
    this.decks.A.audio.pause();
    this.decks.B.audio.pause();
    if (this.decks.A.track && this.decks.A.status === 'playing') this.decks.A.status = 'paused';
    if (this.decks.B.track && this.decks.B.status === 'playing') this.decks.B.status = 'paused';
    this.stopSchedulerLoop();
    this.emit();
  }

  public seekDeck(deckId: DeckId, seconds: number) {
    const ch = this.decks[deckId];
    if (!ch.track) return;
    const dur = Number.isFinite(ch.audio.duration) ? ch.audio.duration : ch.track.duration || 0;
    const clamped = Math.max(0, Math.min(dur > 0 ? dur - 0.1 : seconds, seconds));
    try {
      ch.audio.currentTime = clamped;
    } catch {}
    this.emit();
  }

  public setDeckTempoRate(deckId: DeckId, rate: number) {
    const ch = this.decks[deckId];
    if (this.tempoGlide?.deckId === deckId) this.tempoGlide = null;
    const maxDelta = this.config.maxTempoAdjustmentPercent / 100;
    const clamped = Math.max(1 - maxDelta, Math.min(1 + maxDelta, rate));
    setPreservesPitch(ch.audio, !this.config.allowPitchShift);
    ch.audio.playbackRate = Math.round(clamped * 1000) / 1000;
    this.emit();
  }

  public setDeckVolume(deckId: DeckId, volume: number) {
    const ch = this.decks[deckId];
    ch.volume = Math.max(0, Math.min(1, volume));
    if (this.webAudioActive && ch.trimGainNode && this.audioCtx) {
      ch.trimGainNode.gain.setTargetAtTime(ch.volume, this.audioCtx.currentTime, 0.02);
    } else {
      this.applyDeckGainAndEq(ch, ch.gainApplied, ch.bassEqDb);
    }
    this.emit();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterVolume > 0) this.isMuted = false;
    if (this.webAudioActive && this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.audioCtx.currentTime,
        0.02
      );
    } else {
      this.applyDeckGainAndEq(this.decks.A, this.decks.A.gainApplied, this.decks.A.bassEqDb);
      this.applyDeckGainAndEq(this.decks.B, this.decks.B.gainApplied, this.decks.B.bassEqDb);
    }
    this.emit();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.webAudioActive && this.masterGainNode && this.audioCtx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.audioCtx.currentTime,
        0.02
      );
    } else {
      this.applyDeckGainAndEq(this.decks.A, this.decks.A.gainApplied, this.decks.A.bassEqDb);
      this.applyDeckGainAndEq(this.decks.B, this.decks.B.gainApplied, this.decks.B.bassEqDb);
    }
    this.emit();
  }

  public setCrossfader(pos: number) {
    const clamped = Math.max(0, Math.min(1, pos));
    this.crossfaderPosition = clamped;
    this.manualCrossfaderOverride = true;

    const { outGain: gainA, inGain: gainB } = computeCrossfadeGains(clamped, this.config.crossfadeCurve);
    this.applyDeckGainAndEq(this.decks.A, gainA, this.decks.A.bassEqDb);
    this.applyDeckGainAndEq(this.decks.B, gainB, this.decks.B.bassEqDb);

    if (clamped > 0.08 && this.decks.B.track && this.decks.B.audio.paused && !this.decks.A.audio.paused) {
      void this.decks.B.audio.play().catch(() => {});
      this.decks.B.status = 'playing';
    } else if (clamped < 0.92 && this.decks.A.track && this.decks.A.audio.paused && !this.decks.B.audio.paused) {
      void this.decks.A.audio.play().catch(() => {});
      this.decks.A.status = 'playing';
    }

    this.emit();
  }

  public dispose() {
    this.stopSchedulerLoop();
    this.decks.A.audio.pause();
    this.decks.B.audio.pause();
    this.listeners.clear();
  }

  // ── Snapshot Computation ─────────────────────────────────────────────

  private computeLiveMeters(): { vu: number; spectrum: number[] } {
    if (
      !this.webAudioActive ||
      !this.analyserNode ||
      !this.analyserTimeData ||
      !this.analyserFreqData ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      return { vu: 0, spectrum: ZERO_SPECTRUM };
    }

    this.analyserNode.getByteTimeDomainData(this.analyserTimeData);
    let sumSq = 0;
    for (let i = 0; i < this.analyserTimeData.length; i++) {
      const v = (this.analyserTimeData[i] - 128) / 128;
      sumSq += v * v;
    }
    const vu = Math.min(1, Math.round(Math.sqrt(sumSq / this.analyserTimeData.length) * 2.6 * 100) / 100);

    this.analyserNode.getByteFrequencyData(this.analyserFreqData);
    const binCount = this.analyserFreqData.length;
    const bands = new Array<number>(16).fill(0);
    // Use lower 75% of bins (audible musical spectrum) grouped into 16 bars
    const usableBins = Math.max(16, Math.floor(binCount * 0.72));
    const step = Math.max(1, Math.floor(usableBins / 16));
    for (let b = 0; b < 16; b++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += this.analyserFreqData[Math.min(binCount - 1, b * step + j)];
      }
      bands[b] = Math.min(1, Math.round((sum / (step * 255)) * 100) / 100);
    }

    return { vu, spectrum: bands };
  }

  public getSnapshot(): MixerEngineSnapshot {
    const buildDeckSnap = (ch: DeckChannel): DeckSnapshot => {
      const dur =
        Number.isFinite(ch.audio?.duration) && ch.audio.duration > 0
          ? ch.audio.duration
          : ch.analysis?.duration || ch.track?.duration || 0;
      const curTime = Number.isFinite(ch.audio?.currentTime) ? ch.audio.currentTime : 0;
      const rate = Number.isFinite(ch.audio?.playbackRate) ? ch.audio.playbackRate : 1;
      const baseBpm = ch.analysis?.bpm || ch.track?.bpm || null;
      return {
        deckId: ch.id,
        track: ch.track,
        analysis: ch.analysis,
        status: ch.status,
        currentTime: curTime,
        duration: dur,
        volume: ch.volume,
        gainApplied: ch.gainApplied,
        playbackRate: rate,
        effectiveBpm: baseBpm ? Math.round(baseBpm * rate * 10) / 10 : null,
        bassEqDb: ch.bassEqDb,
        error: ch.error,
      };
    };

    const deckASnap = buildDeckSnap(this.decks.A);
    const deckBSnap = buildDeckSnap(this.decks.B);
    const activeSnap = this.activeDeckId === 'A' ? deckASnap : deckBSnap;

    let secondsUntilTransition: number | null = null;
    if (
      this.transitionPhase === 'armed' &&
      this.activePlan &&
      this.activePlan.transitionDurationSec > 0 &&
      this.config.defaultMode !== 'original'
    ) {
      secondsUntilTransition = Math.max(
        0,
        Math.round((this.activePlan.mixOutSec - activeSnap.currentTime) * 10) / 10
      );
    }

    const isPlaying =
      deckASnap.status === 'playing' ||
      deckBSnap.status === 'playing' ||
      deckASnap.status === 'transitioning' ||
      deckBSnap.status === 'transitioning' ||
      this.transitionPhase === 'mixing';

    const limitingActive = Boolean(
      this.limiterNode && typeof this.limiterNode.reduction === 'number' && this.limiterNode.reduction < -0.5
    );
    const meters = isPlaying ? this.computeLiveMeters() : { vu: 0, spectrum: ZERO_SPECTRUM };

    return {
      activeDeck: this.activeDeckId,
      nextDeck: this.getNextDeckId(),
      decks: { A: deckASnap, B: deckBSnap },
      isPlaying,
      masterVolume: this.masterVolume,
      isMuted: this.isMuted,
      crossfaderPosition: this.crossfaderPosition,
      transitionPhase: this.transitionPhase,
      transitionProgress: this.transitionProgress,
      secondsUntilTransition,
      activeTransitionPlan: this.activePlan,
      mode: this.config.defaultMode,
      webAudioActive: this.webAudioActive,
      vuLevel: meters.vu,
      limitingActive,
      djFilterAmount: this.djFilterAmount,
      spectrumBands: meters.spectrum,
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}

let sharedEngine: DualDeckMixerEngine | null = null;
export function getSharedDJMixerEngine(): DualDeckMixerEngine {
  if (!sharedEngine) {
    sharedEngine = new DualDeckMixerEngine();
  }
  return sharedEngine;
}
