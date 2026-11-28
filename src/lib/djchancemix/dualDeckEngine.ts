/**
 * DJChanceMix — Real-Time Dual-Deck Web Audio Mixing Engine
 *
 * Independent Deck A & Deck B playback channels with:
 * - Web Audio API signal graph (MediaElementSource -> LUFS Normalize Gain -> Bass-Swap EQ -> Crossfade Gain -> Master Bus -> Brickwall True-Peak Limiter -> Analyser -> Output)
 * - Pitch-preserving time stretching (`preservesPitch = true`) with configurable ±% tempo sync & smooth tempo restoration
 * - Equal-power, Linear, Adaptive S-Curve, and Volume-Aware crossfade curves
 * - Low-end bass EQ swap during beat-matched transitions
 * - Automatic lookahead preloading, analysis, transition scheduling, and graceful CORS fallback
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
import { resolveAuthorizedPlayableUrl } from './audioSourceProvider';
import { TrackAnalyzerService } from './analyzerService';
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
      // Smooth Hermite S-curve with gentle center overlap
      const s = p * p * (3 - 2 * p);
      return {
        outGain: Math.cos(s * Math.PI * 0.5),
        inGain: Math.sin(s * Math.PI * 0.5),
      };
    }

    case 'volume-aware': {
      // Compensates for loudness contrast between outgoing & incoming tracks to avoid dip/spike
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

export class DualDeckMixerEngine {
  private audioCtx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private webAudioActive = false;

  private decks: Record<DeckId, DeckChannel>;
  private activeDeckId: DeckId = 'A';
  private config: MixConfiguration = { ...DEFAULT_MIX_CONFIGURATION };
  private masterVolume = 0.9;
  private isMuted = false;
  private crossfaderPosition = 0; // 0 = full Deck A, 1 = full Deck B
  private manualCrossfaderOverride = false;

  private transitionPhase: TransitionPhase = 'idle';
  private transitionProgress = 0;
  private activePlan: TransitionPlan | null = null;
  private transitionStartedAtMs = 0;
  private transitionInitialRateB = 1;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(snap: MixerEngineSnapshot) => void>();
  private onRequestNextTrack?: () => DJTrackSource | null;
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

      // Master bus -> Brickwall True-Peak Limiter (-1.0 dB threshold, 20:1 ratio) -> Analyser -> Output
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.value = this.isMuted ? 0 : this.masterVolume;

      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -1.0;
      this.limiterNode.knee.value = 0;
      this.limiterNode.ratio.value = 20;
      this.limiterNode.attack.value = 0.002;
      this.limiterNode.release.value = 0.08;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.analyserData = new Uint8Array(new ArrayBuffer(this.analyserNode.frequencyBinCount));

      this.masterGainNode.connect(this.limiterNode);
      this.limiterNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      // Wire both Deck A and Deck B channels independently
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
    onRequestNextTrack?: () => DJTrackSource | null;
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
    // Apply normalization & pitch preservation immediately without interrupting playback
    for (const id of ['A', 'B'] as DeckId[]) {
      const ch = this.decks[id];
      setPreservesPitch(ch.audio, !this.config.allowPitchShift);
      this.applyNormalizationToDeck(ch);
    }
    this.recomputeTransitionPlan();
    this.emit();
  }

  public setMode(mode: MixMode) {
    this.config = { ...this.config, defaultMode: mode };
    this.recomputeTransitionPlan();
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
      this.config.normalizationEnabled && ch.analysis
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
        this.config.normalizationEnabled && ch.analysis
          ? Math.min(1, dbToLinear(ch.analysis.recommendedGainDb || 0))
          : 1;
      const effectiveVol = this.isMuted
        ? 0
        : Math.max(0, Math.min(1, ch.gainApplied * ch.volume * this.masterVolume * normScale));
      try {
        ch.audio.volume = effectiveVol;
      } catch {
        // ignore iOS read-only audio.volume restriction when WebAudio unavailable
      }
    }
  }

  /**
   * Loads a track into a specific deck (active or next) and runs async DSP analysis.
   */
  public async loadTrackOnDeck(
    deckId: DeckId,
    track: DJTrackSource,
    options?: { autoplay?: boolean; seekToSec?: number }
  ): Promise<void> {
    const ch = this.decks[deckId];
    ch.track = track;
    ch.status = 'loading';
    ch.error = null;
    ch.analysis = TrackAnalyzerService.getCached(track.id);
    this.emit();

    try {
      const playableUrl = await resolveAuthorizedPlayableUrl(track);
      if (ch.track?.id !== track.id) return; // superseded

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

        // Pause the other deck cleanly when starting a fresh manual selection
        const other = this.decks[deckId === 'A' ? 'B' : 'A'];
        other.audio.pause();
        if (other.track) other.status = 'ready';
        this.activeDeckId = deckId;
        this.transitionPhase = 'idle';
        this.transitionProgress = 0;
        this.manualCrossfaderOverride = false;
        this.crossfaderPosition = deckId === 'A' ? 0 : 1;

        this.applyDeckGainAndEq(ch, 1, 0);
        this.applyDeckGainAndEq(other, 0, 0);
        this.applyNormalizationToDeck(ch);

        // Trim leading dead silence if enabled and analysis is already cached
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
          } catch {
            // metadata may not be loaded yet; harmless
          }
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
   * Starts playing a track immediately on the active deck and preloads the next track on the companion deck.
   */
  public async playTrack(track: DJTrackSource, upcomingTrack?: DJTrackSource | null): Promise<void> {
    const deckId = this.activeDeckId;
    await this.loadTrackOnDeck(deckId, track, { autoplay: true });
    if (upcomingTrack && upcomingTrack.id !== track.id) {
      void this.preloadNextTrack(upcomingTrack);
    } else if (!upcomingTrack && this.onRequestNextTrack) {
      const next = this.onRequestNextTrack();
      if (next && next.id !== track.id) {
        void this.preloadNextTrack(next);
      }
    }
  }

  /**
   * Preloads and analyzes the upcoming track into the standby deck.
   */
  public async preloadNextTrack(track: DJTrackSource | null): Promise<void> {
    const nextId = this.getNextDeckId();
    const nextCh = this.decks[nextId];

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
   * Recomputes the TransitionPlan between the active deck and standby deck.
   */
  public recomputeTransitionPlan(): TransitionPlan | null {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track || !next.track || !active.analysis || !next.analysis) {
      this.activePlan = null;
      if (this.transitionPhase !== 'mixing') {
        this.transitionPhase = next.track ? 'preparing' : 'idle';
      }
      return null;
    }

    const plan = planTransition({
      fromTrack: active.track,
      toTrack: next.track,
      fromAnalysis: active.analysis,
      toAnalysis: next.analysis,
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
    if (this.transitionPhase === 'mixing') return;

    if (!this.activePlan) {
      this.recomputeTransitionPlan();
    }
    await this.beginTransition(true);
  }

  private async beginTransition(manualTrigger = false): Promise<void> {
    const active = this.decks[this.activeDeckId];
    const next = this.decks[this.getNextDeckId()];
    if (!active.track || !next.track) return;

    this.ensureWebAudioGraph();

    const plan =
      this.activePlan ||
      (active.analysis && next.analysis
        ? planTransition({
            fromTrack: active.track,
            toTrack: next.track,
            fromAnalysis: active.analysis,
            toAnalysis: next.analysis,
            config: this.config,
          })
        : null);

    // Original mode or zero-duration cut
    if (!plan || plan.transitionDurationSec <= 0.05) {
      await this.completeTransitionImmediate();
      return;
    }

    this.activePlan = plan;
    this.transitionPhase = 'mixing';
    this.transitionProgress = 0;
    this.transitionStartedAtMs = Date.now();
    this.manualCrossfaderOverride = false;

    // Configure Deck B tempo sync (pitch-preserving by default!) & Cue-In offset
    setPreservesPitch(next.audio, plan.preservePitch);
    const startRate = plan.beatSyncEnabled ? plan.targetPlaybackRate : 1.0;
    this.transitionInitialRateB = startRate;
    next.audio.playbackRate = startRate;

    // Beat-phase alignment: align Deck B cueInSec cleanly onto Deck A's rhythm phase
    let cueStart = plan.cueInSec || 0;
    if (plan.beatSyncEnabled && active.analysis?.bpm && next.analysis?.bpm) {
      const beatPeriodA = 60 / active.analysis.bpm;
      const offsetA = active.analysis.beatOffsetSec || 0;
      const curPosA = active.audio.currentTime || 0;
      const phaseInBeatA = (((curPosA - offsetA) % beatPeriodA) + beatPeriodA) % beatPeriodA;
      // Nudge Deck B into the exact beat phase (max half beat)
      const beatPeriodB = 60 / next.analysis.bpm;
      const phaseOffsetB = (phaseInBeatA / beatPeriodA) * beatPeriodB;
      if (Number.isFinite(phaseOffsetB) && phaseOffsetB >= 0 && phaseOffsetB < beatPeriodB) {
        cueStart = Math.max(0, cueStart + phaseOffsetB * 0.5);
      }
    }

    try {
      next.audio.currentTime = Math.max(0, cueStart);
    } catch {
      // ignore
    }

    this.applyNormalizationToDeck(next);
    this.applyDeckGainAndEq(next, 0.001, plan.eqSweepEnabled ? -10 : 0);

    try {
      await next.audio.play();
      active.status = 'transitioning';
      next.status = 'transitioning';
    } catch (err: any) {
      console.warn('[DJChanceMix] Incoming deck play failed during transition:', err);
      this.transitionPhase = 'idle';
      return;
    }

    // Emit non-blocking transition telemetry to Wyres outside real-time DSP ticks
    reportClientAiMetric({
      name: `djchancemix:transition:${plan.transitionType}`,
      runType: 'agent',
      provider: 'chancetek-agent',
      model: 'djchancemix-automix-v1',
      category: 'agentic_agent',
      feature: 'djchancemix-transition',
      input: {
        fromTrack: active.track.title,
        toTrack: next.track.title,
        mode: plan.mode,
        manualTrigger,
      },
      output: {
        compatibilityScore: plan.compatibilityScore,
        confidence: plan.confidence,
        transitionType: plan.transitionType,
        beatSyncEnabled: plan.beatSyncEnabled,
        tempoAdjustmentPercent: plan.tempoAdjustmentPercent,
        harmonicRelation: plan.harmonicRelation,
        transitionDurationSec: plan.transitionDurationSec,
        eqSweepEnabled: plan.eqSweepEnabled,
      },
      tags: ['djchancemix', plan.mode, plan.transitionType],
    });

    this.emit();
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

    // Promote incoming deck to full active playback at 1.0x natural tempo
    newActive.audio.playbackRate = 1.0;
    this.applyDeckGainAndEq(newActive, 1, 0);
    newActive.status = 'playing';

    this.activeDeckId = newActiveId;
    this.crossfaderPosition = newActiveId === 'A' ? 0 : 1;
    this.transitionPhase = 'idle';
    this.transitionProgress = 0;
    this.activePlan = null;

    if (newActive.track) {
      this.onTrackAdvanced?.(newActive.track);
    }

    // Immediately preload & analyze the NEXT upcoming track in queue
    if (this.onRequestNextTrack) {
      const upcoming = this.onRequestNextTrack();
      void this.preloadNextTrack(upcoming);
    }

    this.emit();
  }

  private async completeTransitionImmediate() {
    const oldActive = this.decks[this.activeDeckId];
    const newActiveId = this.getNextDeckId();
    const newActive = this.decks[newActiveId];
    if (!newActive.track) return;

    oldActive.audio.pause();
    this.applyDeckGainAndEq(oldActive, 0, 0);
    oldActive.status = 'ready';

    this.activeDeckId = newActiveId;
    this.crossfaderPosition = newActiveId === 'A' ? 0 : 1;
    this.transitionPhase = 'idle';
    this.transitionProgress = 0;
    this.activePlan = null;

    newActive.audio.playbackRate = 1.0;
    try {
      newActive.audio.currentTime =
        this.config.removeSilenceGaps && this.config.defaultMode !== 'original' && newActive.analysis?.activeStartSec
          ? newActive.analysis.activeStartSec
          : 0;
    } catch {}
    this.applyNormalizationToDeck(newActive);
    this.applyDeckGainAndEq(newActive, 1, 0);
    try {
      await newActive.audio.play();
      newActive.status = 'playing';
    } catch {}

    if (newActive.track) {
      this.onTrackAdvanced?.(newActive.track);
    }
    if (this.onRequestNextTrack) {
      void this.preloadNextTrack(this.onRequestNextTrack());
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
    ch.error = 'Playback interrupted — recovering cleanly.';
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
    // 65ms cadence (~15Hz): ultra-smooth crossfades & waveforms while remaining mobile thermal-safe
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

      // Bass EQ swap at transition midpoint so overlapping kicks never muddy
      let outBassDb = 0;
      let inBassDb = 0;
      if (this.activePlan.eqSweepEnabled) {
        if (progress < 0.5) {
          outBassDb = -progress * 8; // 0 -> -4 dB
          inBassDb = -10 + progress * 12; // -10 -> -4 dB
        } else {
          outBassDb = -4 - (progress - 0.5) * 16; // -4 -> -12 dB
          inBassDb = -4 + (progress - 0.5) * 8; // -4 -> 0 dB
        }
      }

      this.applyDeckGainAndEq(active, outGain, outBassDb);
      this.applyDeckGainAndEq(next, inGain, inBassDb);

      // Smoothly return Deck B from synced tempo back to natural 1.0x over second half
      if (this.activePlan.beatSyncEnabled && progress > 0.55) {
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

    // 2. Armed transition monitor: detect when active track hits `mixOutSec`
    const curTime = active.audio.currentTime || 0;
    const dur = Number.isFinite(active.audio.duration) && active.audio.duration > 0
      ? active.audio.duration
      : active.track?.duration || 0;

    if (
      this.config.defaultMode !== 'original' &&
      next.track &&
      next.status === 'ready' &&
      dur > 6
    ) {
      const plan = this.activePlan || this.recomputeTransitionPlan();
      if (plan && plan.transitionDurationSec > 0.1) {
        const triggerTime = Math.min(dur - 1.5, plan.mixOutSec);
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

  /**
   * Manual DJ Crossfader control (0 = full Deck A, 0.5 = blend, 1 = full Deck B).
   */
  public setCrossfader(pos: number) {
    const clamped = Math.max(0, Math.min(1, pos));
    this.crossfaderPosition = clamped;
    this.manualCrossfaderOverride = true;

    const { outGain: gainA, inGain: gainB } = computeCrossfadeGains(clamped, this.config.crossfadeCurve);
    this.applyDeckGainAndEq(this.decks.A, gainA, this.decks.A.bassEqDb);
    this.applyDeckGainAndEq(this.decks.B, gainB, this.decks.B.bassEqDb);

    // If user drags crossfader onto a cued standby deck while active deck is playing, start standby deck!
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

  private computeLiveVu(): number {
    if (
      !this.webAudioActive ||
      !this.analyserNode ||
      !this.analyserData ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      return 0;
    }
    this.analyserNode.getByteTimeDomainData(this.analyserData);
    let sumSq = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = (this.analyserData[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / this.analyserData.length);
    return Math.min(1, Math.round(rms * 2.6 * 100) / 100);
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
      activeSnap.status === 'playing' ||
      activeSnap.status === 'transitioning' ||
      this.transitionPhase === 'mixing';

    const limitingActive = Boolean(
      this.limiterNode && typeof this.limiterNode.reduction === 'number' && this.limiterNode.reduction < -0.5
    );

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
      vuLevel: isPlaying ? this.computeLiveVu() : 0,
      limitingActive,
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}

// Singleton shared instance so DJChanceMix state persists smoothly across interactions
let sharedEngine: DualDeckMixerEngine | null = null;
export function getSharedDJMixerEngine(): DualDeckMixerEngine {
  if (!sharedEngine) {
    sharedEngine = new DualDeckMixerEngine();
  }
  return sharedEngine;
}

