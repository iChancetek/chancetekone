'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Disc3,
  Activity,
  Music2,
  Sliders,
  Sparkles,
  Volume2,
  Zap,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Play,
  Pause,
  FolderOpen,
  Search,
  X,
  RefreshCw,
  Waves,
} from 'lucide-react';
import {
  DeckId,
  DeckSnapshot,
  DJTrackSource,
  MixConfiguration,
  MixerEngineSnapshot,
} from '@/types/djchancemix';
import { WaveformCanvas } from './WaveformCanvas';

interface DualDeckConsoleProps {
  snapshot: MixerEngineSnapshot;
  config: MixConfiguration;
  availableTracks: DJTrackSource[];
  onSeekDeck: (deckId: DeckId, seconds: number) => void;
  onTempoChange: (deckId: DeckId, rate: number) => void;
  onDeckVolumeChange: (deckId: DeckId, volume: number) => void;
  onToggleDeckPlay: (deckId: DeckId) => void;
  onSyncDeckBpm: (deckId: DeckId) => void;
  onManualLoadDeck: (deckId: DeckId, track: DJTrackSource) => void;
  onCrossfaderChange: (pos: number) => void;
  onDjFilterChange: (amount: number) => void;
  onTriggerMixNow: () => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DualDeckConsole: React.FC<DualDeckConsoleProps> = ({
  snapshot,
  config,
  availableTracks,
  onSeekDeck,
  onTempoChange,
  onDeckVolumeChange,
  onToggleDeckPlay,
  onSyncDeckBpm,
  onManualLoadDeck,
  onCrossfaderChange,
  onDjFilterChange,
  onTriggerMixNow,
}) => {
  const [pickerDeck, setPickerDeck] = useState<DeckId | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const plan = snapshot.activeTransitionPlan;
  const maxPct = config.maxTempoAdjustmentPercent;
  const minRate = 1 - maxPct / 100;
  const maxRate = 1 + maxPct / 100;

  const filteredPickerTracks = useMemo(() => {
    if (!pickerDeck) return [];
    const q = pickerQuery.trim().toLowerCase();
    return availableTracks
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.artistName.toLowerCase().includes(q) ||
          (t.genre || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [pickerDeck, pickerQuery, availableTracks]);

  const filterLabel =
    Math.abs(snapshot.djFilterAmount) < 0.04
      ? 'Clean Flat'
      : snapshot.djFilterAmount < 0
      ? `LPF ${Math.round(Math.abs(snapshot.djFilterAmount) * 100)}%`
      : `HPF ${Math.round(snapshot.djFilterAmount * 100)}%`;

  const renderDeck = (deckId: DeckId) => {
    const deck: DeckSnapshot = snapshot.decks[deckId];
    const isActive = snapshot.activeDeck === deckId;
    const isPlayingDeck = deck.status === 'playing' || deck.status === 'transitioning';
    const isDeckA = deckId === 'A';
    const accentText = isDeckA ? 'text-brand-gold' : 'text-cyan-300';
    const borderGlow = isActive
      ? isDeckA
        ? 'border-brand-gold/55 shadow-[0_0_32px_rgba(245,195,68,0.16)]'
        : 'border-cyan-400/55 shadow-[0_0_32px_rgba(34,211,238,0.16)]'
      : deck.status === 'transitioning'
      ? 'border-fuchsia-400/55 shadow-[0_0_32px_rgba(232,121,249,0.2)]'
      : 'border-white/10';

    const tempoDeltaPct = Math.round((deck.playbackRate - 1) * 1000) / 10;
    const hotCues = (deck.analysis?.sections || []).slice(0, 5);

    return (
      <div
        key={deckId}
        className={`rounded-3xl p-4 sm:p-5 bg-[#0a0a14]/95 border transition-all space-y-3.5 ${borderGlow}`}
      >
        {/* Deck Header + Manual Load Button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                isDeckA
                  ? 'bg-brand-gold/15 text-brand-gold border-brand-gold/40'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40'
              }`}
            >
              Deck {deckId}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              {isActive
                ? deck.status === 'transitioning'
                  ? 'Mixing Out'
                  : isPlayingDeck
                  ? 'On Air'
                  : 'Loaded'
                : deck.status === 'transitioning'
                ? 'Mixing In'
                : deck.track
                ? 'Cued Next'
                : 'Empty'}
            </span>
            {deck.analysis?.analysisStatus === 'ready' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[9px] font-bold">
                DSP
              </span>
            )}
            {Math.abs(deck.bassEqDb) > 0.5 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-purple/25 border border-brand-purple/50 text-brand-neon font-mono text-[9px] font-bold">
                EQ {deck.bassEqDb.toFixed(0)}dB
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSyncDeckBpm(deckId)}
              disabled={!deck.track}
              className="px-2.5 py-1 rounded-xl bg-brand-purple/25 hover:bg-brand-purple/45 border border-brand-purple/50 text-[10px] font-extrabold text-white flex items-center gap-1 transition-all disabled:opacity-35 cursor-pointer"
              title={`Beat-sync Deck ${deckId} BPM to the opposite deck`}
            >
              <RefreshCw className="w-3 h-3 text-brand-gold" />
              <span>SYNC</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerQuery('');
                setPickerDeck(deckId);
              }}
              className={`px-2.5 py-1 rounded-xl border text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                isDeckA
                  ? 'bg-brand-gold/15 hover:bg-brand-gold/30 border-brand-gold/40 text-brand-gold'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/30 border-cyan-400/40 text-cyan-200'
              }`}
              title={`Manually choose any song to load onto Deck ${deckId}`}
            >
              <FolderOpen className="w-3 h-3" />
              <span>Load {deckId}</span>
            </button>
          </div>
        </div>

        {/* Platter + Track Metadata + Independent Play/Cue */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 bg-neutral-900 shadow-lg ${
                isDeckA ? 'border-brand-gold/65' : 'border-cyan-400/65'
              } ${isPlayingDeck ? 'animate-spin-slow' : ''}`}
            >
              {deck.track ? (
                <Image
                  src={deck.track.coverUrl || '/images/studio_cover.jpg'}
                  alt={deck.track.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                  <Disc3 className="w-8 h-8" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 rounded-full bg-[#090910] border border-white/30" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggleDeckPlay(deckId)}
              disabled={!deck.track}
              className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg border border-black/50 transition-transform hover:scale-110 disabled:opacity-30 cursor-pointer ${
                isDeckA ? 'bg-brand-gold text-black' : 'bg-cyan-400 text-black'
              }`}
              title={isPlayingDeck ? `Pause Deck ${deckId}` : `Play Deck ${deckId}`}
            >
              {isPlayingDeck ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
              {deck.track?.title || `Click "Load ${deckId}" to add a song`}
            </h4>
            <p className="text-xs text-neutral-400 truncate">
              {deck.track?.artistName || 'Manual or automatic DJ cueing ready'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span
                className={`px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono font-bold ${accentText}`}
              >
                {deck.effectiveBpm
                  ? `${deck.effectiveBpm} BPM`
                  : deck.analysis?.bpm
                  ? `${deck.analysis.bpm} BPM`
                  : '-- BPM'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 border border-brand-purple/40 text-[11px] font-mono font-bold text-white">
                {deck.analysis?.camelotCode || '--'} · {deck.analysis?.musicalKey || 'Analyzing'}
              </span>
              {deck.analysis && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-300">
                  {deck.analysis.integratedLufs} LUFS · E{deck.analysis.energyScore}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Waveform + Beat Grid Canvas */}
        <div className="space-y-1.5">
          <WaveformCanvas
            analysis={deck.analysis}
            currentTime={deck.currentTime}
            duration={deck.duration}
            accentColor={isDeckA ? '#f5c344' : '#22d3ee'}
            secondaryColor={isDeckA ? 'rgba(245, 195, 68, 0.34)' : 'rgba(34, 211, 238, 0.34)'}
            mixOutSec={isActive ? plan?.mixOutSec ?? deck.analysis?.suggestedMixOutSec : null}
            cueInSec={!isActive ? plan?.cueInSec ?? deck.analysis?.suggestedCueInSec : null}
            transitionDurationSec={plan?.transitionDurationSec || 0}
            isActiveDeck={isActive}
            onSeek={(sec) => onSeekDeck(deckId, sec)}
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
            <span>{formatTime(deck.currentTime)}</span>
            <span className="text-neutral-500">
              {isActive && plan?.mixOutSec
                ? `Mix-Out ${formatTime(plan.mixOutSec)}`
                : !isActive && plan?.cueInSec !== undefined
                ? `Cue-In ${formatTime(plan.cueInSec)}`
                : deck.analysis?.timeSignature || '4/4'}
            </span>
            <span>-{formatTime(Math.max(0, deck.duration - deck.currentTime))}</span>
          </div>
        </div>

        {/* Hot Cue Section Pads (Real DSP-Detected Sections) */}
        {hotCues.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 shrink-0">
              Cues:
            </span>
            {hotCues.map((sec, idx) => (
              <button
                key={`${sec.type}-${idx}`}
                type="button"
                onClick={() => onSeekDeck(deckId, sec.startSec)}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-brand-gold/20 border border-white/10 hover:border-brand-gold/40 text-[10px] font-bold uppercase text-neutral-300 hover:text-brand-gold transition-all shrink-0 cursor-pointer"
                title={`Jump to ${sec.type} at ${formatTime(sec.startSec)}`}
              >
                {sec.type} {formatTime(sec.startSec)}
              </button>
            ))}
          </div>
        )}

        {/* Per-Deck Tempo & Trim Faders */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-neutral-400 uppercase">Tempo</span>
              <div className="flex items-center gap-1">
                <span className={`font-bold ${tempoDeltaPct !== 0 ? accentText : 'text-neutral-300'}`}>
                  {tempoDeltaPct > 0 ? '+' : ''}
                  {tempoDeltaPct.toFixed(1)}%
                </span>
                {tempoDeltaPct !== 0 && (
                  <button
                    type="button"
                    onClick={() => onTempoChange(deckId, 1.0)}
                    className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
                    title="Reset tempo to natural 0%"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={minRate}
              max={maxRate}
              step={0.005}
              value={deck.playbackRate}
              onChange={(e) => onTempoChange(deckId, parseFloat(e.target.value))}
              className="w-full accent-brand-gold cursor-pointer h-1.5"
              aria-label={`Deck ${deckId} tempo slider`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-neutral-400 uppercase flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                Gain
              </span>
              <span className="text-neutral-300 font-bold">{Math.round(deck.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={deck.volume}
              onChange={(e) => onDeckVolumeChange(deckId, parseFloat(e.target.value))}
              className="w-full accent-brand-purple cursor-pointer h-1.5"
              aria-label={`Deck ${deckId} volume`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      {/* Dual Decks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderDeck('A')}
        {renderDeck('B')}
      </div>

      {/* Central Pro DJ Mixer Bridge: Live Spectrum + Filter Sweep + Crossfader + Telemetry */}
      <div
        className={`rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-[#120d22]/95 via-[#0b0a15]/95 to-[#0a1420]/95 border transition-all space-y-4 ${
          snapshot.transitionPhase === 'mixing'
            ? 'border-brand-gold/60 shadow-[0_0_40px_rgba(245,195,68,0.18)]'
            : 'border-white/10'
        }`}
      >
        {/* Live 16-Band Spectrum Visualizer + Active Mix Beam */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-end gap-1 h-9 flex-1 max-w-md px-2 py-1 rounded-xl bg-black/50 border border-white/5">
            {snapshot.spectrumBands.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t-sm transition-all duration-75"
                style={{
                  height: `${Math.max(10, Math.round(val * 100))}%`,
                  background:
                    idx < 5
                      ? 'linear-gradient(to top, #7c3aed, #f5c344)'
                      : idx < 11
                      ? 'linear-gradient(to top, #f59e0b, #fde047)'
                      : 'linear-gradient(to top, #06b6d4, #67e8f9)',
                  opacity: snapshot.isPlaying ? 0.92 : 0.22,
                }}
              />
            ))}
          </div>

          {/* Club Color Filter Sweep Control (LPF <-> HPF) */}
          <div className="flex items-center gap-3 min-w-[220px] sm:w-64">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-neutral-400 uppercase flex items-center gap-1">
                  <Waves className="w-3 h-3 text-cyan-300" />
                  DJ Filter
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-cyan-300 font-bold">{filterLabel}</span>
                  {Math.abs(snapshot.djFilterAmount) >= 0.04 && (
                    <button
                      type="button"
                      onClick={() => onDjFilterChange(0)}
                      className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
                      title="Reset DJ Filter to flat"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={snapshot.djFilterAmount}
                onChange={(e) => onDjFilterChange(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-cyan-400 cursor-pointer"
                aria-label="Master DJ Color Filter Sweep"
              />
            </div>
          </div>
        </div>

        {/* Interactive Crossfader + VU Meter + Mix Now CTA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
              <span className="text-brand-gold">
                Deck A ({Math.round((1 - snapshot.crossfaderPosition) * 100)}%)
              </span>
              <span className="text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-neon" />
                <span>
                  {snapshot.transitionPhase === 'mixing'
                    ? `Blending Live · ${Math.round(snapshot.transitionProgress * 100)}%`
                    : `Crossfader · ${config.crossfadeCurve}`}
                </span>
              </span>
              <span className="text-cyan-300">
                Deck B ({Math.round(snapshot.crossfaderPosition * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={snapshot.crossfaderPosition}
              onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
              className="w-full h-2 accent-brand-gold cursor-pointer"
              aria-label="DJ Crossfader Deck A to Deck B"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="w-28 space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  OUTPUT
                </span>
                <span className={snapshot.limitingActive ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                  {snapshot.limitingActive ? 'LIMIT' : '-1 dBTP'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/70 border border-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-brand-gold to-rose-500 transition-all duration-75"
                  style={{ width: `${Math.round(snapshot.vuLevel * 100)}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onTriggerMixNow}
              disabled={
                !snapshot.decks[snapshot.nextDeck].track || snapshot.transitionPhase === 'mixing'
              }
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,195,68,0.35)] hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{snapshot.transitionPhase === 'mixing' ? 'Mixing...' : 'Mix Now'}</span>
            </button>
          </div>
        </div>

        {/* AI Transition Intelligence Readout */}
        {plan && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span className="capitalize">{plan.transitionType.replace(/-/g, ' ')}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-mono text-[10px]">
                  {plan.compatibilityScore}% Match
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-mono text-[10px]">
                  {plan.transitionDurationSec}s Blend
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-neutral-300">
                  BPM {plan.bpmCompatibility}%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-neutral-300">
                  Key {plan.keyCompatibility}%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-neutral-300">
                  Energy {plan.energyCompatibility}%
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    plan.vocalOverlapRisk >= 62
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  Vocal Risk {plan.vocalOverlapRisk}%
                </span>
                <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 text-brand-neon">
                  Conf {Math.round(plan.confidence * 100)}%
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed flex items-start gap-2">
              <Music2 className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
              <span>{plan.rationale}</span>
            </p>

            {plan.warnings.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.warnings.map((w, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{w}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-mono pt-1 border-t border-white/5">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                {plan.preservePitch ? 'Pitch-Preserving Time Stretch' : 'Turntable Pitch Shift Enabled'}
              </span>
              <span>·</span>
              <span>{snapshot.webAudioActive ? 'Web Audio 32-bit DSP Active' : 'Dual-Deck Stream Mode'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Deck Track Picker Modal */}
      {pickerDeck && (
        <div
          className="fixed inset-0 z-[9996] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPickerDeck(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl p-5 sm:p-6 bg-[#0d0a1a] border border-brand-gold/40 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-base font-black text-white">
                  Manually Load Song to Deck {pickerDeck}
                </h4>
                <p className="text-xs text-neutral-400">
                  Pick any song from your playlist, catalog, or local files to drop onto Deck {pickerDeck}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerDeck(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search title, artist, or genre..."
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredPickerTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => {
                    onManualLoadDeck(pickerDeck, track);
                    setPickerDeck(null);
                  }}
                  className="w-full p-2.5 rounded-2xl bg-white/[0.03] hover:bg-brand-gold/15 border border-white/5 hover:border-brand-gold/40 flex items-center justify-between gap-3 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                      <Image src={track.coverUrl} alt={track.title} fill unoptimized className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {track.artistName} · {track.genre}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase shrink-0 ${
                      pickerDeck === 'A'
                        ? 'bg-brand-gold text-black'
                        : 'bg-cyan-400 text-black'
                    }`}
                  >
                    Load {pickerDeck}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
