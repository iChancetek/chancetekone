'use client';

import React from 'react';
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
} from 'lucide-react';
import {
  DeckId,
  DeckSnapshot,
  MixConfiguration,
  MixerEngineSnapshot,
} from '@/types/djchancemix';
import { WaveformCanvas } from './WaveformCanvas';

interface DualDeckConsoleProps {
  snapshot: MixerEngineSnapshot;
  config: MixConfiguration;
  onSeekDeck: (deckId: DeckId, seconds: number) => void;
  onTempoChange: (deckId: DeckId, rate: number) => void;
  onDeckVolumeChange: (deckId: DeckId, volume: number) => void;
  onCrossfaderChange: (pos: number) => void;
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
  onSeekDeck,
  onTempoChange,
  onDeckVolumeChange,
  onCrossfaderChange,
  onTriggerMixNow,
}) => {
  const plan = snapshot.activeTransitionPlan;
  const maxPct = config.maxTempoAdjustmentPercent;
  const minRate = 1 - maxPct / 100;
  const maxRate = 1 + maxPct / 100;

  const renderDeck = (deckId: DeckId) => {
    const deck: DeckSnapshot = snapshot.decks[deckId];
    const isActive = snapshot.activeDeck === deckId;
    const isPlayingDeck = deck.status === 'playing' || deck.status === 'transitioning';
    const isDeckA = deckId === 'A';
    const accentText = isDeckA ? 'text-brand-gold' : 'text-cyan-300';
    const borderGlow = isActive
      ? isDeckA
        ? 'border-brand-gold/50 shadow-[0_0_30px_rgba(245,195,68,0.12)]'
        : 'border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
      : 'border-white/10';

    const tempoDeltaPct = Math.round((deck.playbackRate - 1) * 1000) / 10;

    return (
      <div
        key={deckId}
        className={`rounded-3xl p-4 sm:p-5 bg-[#0a0a14]/95 border transition-all space-y-4 ${borderGlow}`}
      >
        {/* Deck Header */}
        <div className="flex items-center justify-between gap-2">
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
                  : 'On Air'
                : deck.status === 'transitioning'
                ? 'Mixing In'
                : deck.track
                ? 'Cued Next'
                : 'Standby'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {deck.analysis?.analysisStatus === 'ready' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-bold">
                DSP Verified
              </span>
            )}
            {deck.analysis?.analysisStatus === 'fallback' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 font-bold">
                Adaptive
              </span>
            )}
            {Math.abs(deck.bassEqDb) > 0.5 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-purple/25 border border-brand-purple/50 text-brand-neon font-bold">
                Bass EQ {deck.bassEqDb.toFixed(0)} dB
              </span>
            )}
          </div>
        </div>

        {/* Platter + Track Metadata */}
        <div className="flex items-center gap-3.5">
          <div
            className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 shrink-0 bg-neutral-900 shadow-lg ${
              isDeckA ? 'border-brand-gold/60' : 'border-cyan-400/60'
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

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
              {deck.track?.title || 'Load a track or playlist'}
            </h4>
            <p className="text-xs text-neutral-400 truncate">
              {deck.track?.artistName || 'Deck ready for cueing'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className={`px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono font-bold ${accentText}`}>
                {deck.effectiveBpm ? `${deck.effectiveBpm} BPM` : deck.analysis?.bpm ? `${deck.analysis.bpm} BPM` : '-- BPM'}
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

      {/* Central Crossfader & Transition Telemetry Bridge */}
      <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-[#120d22]/95 via-[#0b0a15]/95 to-[#0a1420]/95 border border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Interactive Crossfader */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
              <span className="text-brand-gold">Deck A ({Math.round((1 - snapshot.crossfaderPosition) * 100)}%)</span>
              <span className="text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-neon" />
                <span>
                  {snapshot.transitionPhase === 'mixing'
                    ? `Blending · ${Math.round(snapshot.transitionProgress * 100)}%`
                    : `Crossfader · ${config.crossfadeCurve}`}
                </span>
              </span>
              <span className="text-cyan-300">Deck B ({Math.round(snapshot.crossfaderPosition * 100)}%)</span>
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

          {/* Master VU Meter + Mix Now CTA */}
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
                <span className="capitalize">
                  {plan.transitionType.replace(/-/g, ' ')}
                </span>
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
    </section>
  );
};

