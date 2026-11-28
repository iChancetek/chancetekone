/**
 * DJChanceMix — Core Product & Audio DSP Type Definitions
 * ChanceTEK One | A ChanceTEK Innovation
 */

export type MixMode =
  | 'automix'
  | 'smart-crossfade'
  | 'beatsync'
  | 'harmonic'
  | 'continuous'
  | 'original';

export type CrossfadeCurve = 'equal-power' | 'linear' | 'adaptive' | 'volume-aware';

export type SilenceSensitivity = 'low' | 'medium' | 'high';

export type TransitionType =
  | 'phrase-matched-crossfade'
  | 'beat-matched-blend'
  | 'harmonic-blend'
  | 'outro-to-intro'
  | 'instrumental-bridge'
  | 'vocal-safe-fade'
  | 'adaptive-crossfade'
  | 'gapless-cut'
  | 'direct';

export type HarmonicRelation =
  | 'perfect-match'
  | 'relative-major-minor'
  | 'adjacent-camelot'
  | 'energy-boost'
  | 'compatible-fifth'
  | 'incompatible'
  | 'unknown';

export type TrackSectionType = 'intro' | 'verse' | 'chorus' | 'breakdown' | 'bridge' | 'outro';

export interface TrackSection {
  type: TrackSectionType;
  startSec: number;
  endSec: number;
  avgEnergy: number; // 0..1
  vocalPresence: number; // 0..1
}

export interface ExtendedPause {
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface TrackAudioAnalysis {
  trackId: string;
  audioUrlHash: string;
  duration: number;
  sampleRate: number;
  analyzedAt: string;
  analysisStatus: 'idle' | 'analyzing' | 'ready' | 'fallback' | 'error';

  // Tempo & Rhythm
  bpm: number;
  bpmConfidence: number; // 0..1
  beatOffsetSec: number;
  barDurationSec: number;
  timeSignature: '4/4' | '3/4' | 'unknown';
  beatTimestamps: number[];
  downbeats: number[];

  // Harmony & Key
  musicalKey: string; // e.g. "A minor", "C major"
  keyRoot: string; // e.g. "A", "C#"
  keyMode: 'major' | 'minor';
  camelotCode: string; // e.g. "8A", "8B"
  keyConfidence: number; // 0..1
  chromaVector: number[]; // 12 normalized pitch classes C..B

  // Loudness & Dynamics
  integratedLufs: number; // e.g. -12.4
  truePeakDbfs: number; // e.g. -0.3
  dynamicRangeDb: number;
  recommendedGainDb: number; // clamped gain targeting -14 LUFS without clipping

  // Silence & Active Boundaries
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  activeStartSec: number;
  activeEndSec: number;
  extendedPauses: ExtendedPause[];

  // Structure, Energy, Vocal Activity & Waveform
  energyScore: number; // 0..100
  energyCurve: number[]; // 64 normalized bins (0..1)
  vocalActivityCurve: number[]; // 64 normalized bins (0..1)
  introVocalRisk: number; // 0..1
  outroVocalRisk: number; // 0..1
  sections: TrackSection[];
  suggestedCueInSec: number;
  suggestedMixOutSec: number;
  waveformPeaks: number[]; // 160 normalized amplitude peaks (0..1)
}

export interface MixConfiguration {
  userId?: string;
  defaultMode: MixMode;
  crossfadeDurationSec: number; // 2..20
  autoTransitionDuration: boolean;
  crossfadeCurve: CrossfadeCurve;
  maxTempoAdjustmentPercent: number; // 2..16 (default 8)
  allowPitchShift: boolean; // default false (pitch-preserving time stretching)
  harmonicMixingEnabled: boolean;
  silenceSensitivity: SilenceSensitivity;
  removeSilenceGaps: boolean;
  normalizationEnabled: boolean;
  targetLufs: number; // default -14
  eqBassSwapEnabled: boolean;
  vocalProtectionEnabled: boolean;
  updatedAt?: string;
}

export const DEFAULT_MIX_CONFIGURATION: MixConfiguration = {
  defaultMode: 'automix',
  crossfadeDurationSec: 8,
  autoTransitionDuration: true,
  crossfadeCurve: 'equal-power',
  maxTempoAdjustmentPercent: 8,
  allowPitchShift: false,
  harmonicMixingEnabled: true,
  silenceSensitivity: 'medium',
  removeSilenceGaps: true,
  normalizationEnabled: true,
  targetLufs: -14,
  eqBassSwapEnabled: true,
  vocalProtectionEnabled: true,
};

export interface PlaylistMixSettings {
  playlistId: string;
  userId?: string;
  autoMixEnabled: boolean;
  mixingMode: MixMode;
  shuffleAware: boolean;
  updatedAt: string;
}

export interface TransitionPlan {
  fromTrackId: string;
  toTrackId: string;
  mode: MixMode;
  compatibilityScore: number; // 0..100
  confidence: number; // 0..1
  transitionType: TransitionType;

  // Component Sub-Scores (0..100)
  bpmCompatibility: number;
  keyCompatibility: number;
  harmonicRelation: HarmonicRelation;
  energyCompatibility: number;
  genreCompatibility: number;
  vocalOverlapRisk: number; // 0..100 (lower is better)
  beatAlignmentQuality: number;
  transitionPointQuality: number;

  // Execution Parameters
  beatSyncEnabled: boolean;
  tempoAdjustmentPercent: number; // signed % change applied to incoming track during blend
  targetPlaybackRate: number; // e.g. 1.02
  preservePitch: boolean;
  mixOutSec: number; // position in Track A where transition begins
  cueInSec: number; // position in Track B where Track B starts
  transitionDurationSec: number;
  crossfadeCurve: CrossfadeCurve;
  eqSweepEnabled: boolean;

  // Explainability
  rationale: string;
  warnings: string[];
  computedAt: string;
}

export type DeckId = 'A' | 'B';

export interface DJTrackSource {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  genre: string;
  bpm?: number;
  crateId?: string;
  sourceType: 'catalog' | 'indexeddb' | 'local-file' | 'authorized-stream';
  localFile?: File;
}

export interface DeckSnapshot {
  deckId: DeckId;
  track: DJTrackSource | null;
  analysis: TrackAudioAnalysis | null;
  status: 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'transitioning' | 'error';
  currentTime: number;
  duration: number;
  volume: number; // 0..1 deck trim
  gainApplied: number; // live crossfade+norm gain 0..1.5
  playbackRate: number;
  effectiveBpm: number | null;
  bassEqDb: number;
  error?: string | null;
}

export type TransitionPhase = 'idle' | 'preparing' | 'armed' | 'mixing' | 'completing';

export interface MixerEngineSnapshot {
  activeDeck: DeckId;
  nextDeck: DeckId;
  decks: Record<DeckId, DeckSnapshot>;
  isPlaying: boolean;
  masterVolume: number; // 0..1
  isMuted: boolean;
  crossfaderPosition: number; // 0 = full Deck A, 1 = full Deck B
  transitionPhase: TransitionPhase;
  transitionProgress: number; // 0..1
  secondsUntilTransition: number | null;
  activeTransitionPlan: TransitionPlan | null;
  mode: MixMode;
  webAudioActive: boolean;
  vuLevel: number; // 0..1 live master RMS
  limitingActive: boolean;
  /** DJ Color Filter sweep: -1 = deep low-pass, 0 = clean flat bypass, +1 = airy high-pass */
  djFilterAmount: number;
  /** Live 16-band master frequency bars (0..1) while actively playing */
  spectrumBands: number[];
}

export const MIX_MODE_META: Record<
  MixMode,
  {
    label: string;
    shortLabel: string;
    tagline: string;
    description: string;
  }
> = {
  automix: {
    label: 'AutoMix',
    shortLabel: 'AutoMix',
    tagline: 'Full AI DJ Intelligence',
    description:
      'Automatically blends BPM beat-matching, Camelot harmonic alignment, phrase transition points, vocal protection, and adaptive crossfading.',
  },
  'smart-crossfade': {
    label: 'Smart Crossfade',
    shortLabel: 'Smart Fade',
    tagline: 'Clean Smooth Blends',
    description:
      'Executes smooth volume-aware crossfades at optimal outro/intro points without altering tempo or forcing beat sync.',
  },
  beatsync: {
    label: 'BeatSync',
    shortLabel: 'BeatSync',
    tagline: 'Club Tempo & Beat Lock',
    description:
      'Prioritizes tempo synchronization, beat-grid phase locking, and low-end bass EQ swaps for seamless club-style DJ transitions.',
  },
  harmonic: {
    label: 'Harmonic Mix',
    shortLabel: 'Harmonic',
    tagline: 'Camelot Key Blending',
    description:
      'Prioritizes musical key compatibility and extended harmonic transitions between compatible Camelot keys while preventing clashes.',
  },
  continuous: {
    label: 'Continuous Play',
    shortLabel: 'Continuous',
    tagline: 'Zero Dead Air',
    description:
      'Eliminates unnecessary trailing and leading silence between tracks, upgrading to gentle blends when songs align cleanly.',
  },
  original: {
    label: 'Original Playback',
    shortLabel: 'Original',
    tagline: 'Unmodified Studio Master',
    description:
      'Plays every recording start-to-finish with zero crossfade, tempo changes, or automatic transitions.',
  },
};

