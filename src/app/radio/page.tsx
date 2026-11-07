'use client';

// ============================================================
// Radio Page — ChanceTEK One Agentic AI Radio
// Consistent with existing design: glass-panel, brand-gold, brand-purple
// ============================================================

import React, { useEffect, useCallback, useState } from 'react';
import {
  Radio,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Mic2,
  Zap,
  Music,
  Users,
  Activity,
} from 'lucide-react';
import { RadioProvider, useRadio } from '@/lib/radio/RadioContext';
import { RadioStationId, RadioStation, RadioStationState } from '@/types/radio';
import { RADIO_STATIONS } from '@/lib/radio/initialCatalog';

// ── Station Card ──────────────────────────────────────────────

function StationCard({
  station,
  stationState,
  isActive,
  onTuneIn,
  onTuneOut,
  onSkip,
  onSetVolume,
}: {
  station: RadioStation;
  stationState: RadioStationState;
  isActive: boolean;
  onTuneIn: () => void;
  onTuneOut: () => void;
  onSkip: () => void;
  onSetVolume: (vol: number) => void;
}) {
  const [localVolume, setLocalVolume] = useState(0.8);
  const { currentItem, playbackState, currentTime, currentDuration, upNext } = stationState;
  const isPlaying = isActive && (playbackState === 'playing' || playbackState === 'dj-intro');
  const isDjIntro = isActive && playbackState === 'dj-intro';

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress =
    currentDuration > 0 ? Math.min((currentTime / currentDuration) * 100, 100) : 0;

  const accentBorder = station.id === 'hip-hop' ? 'border-brand-gold/40' : 'border-brand-purple/40';
  const accentGlow   = station.id === 'hip-hop' ? 'shadow-brand-gold/20' : 'shadow-brand-purple/20';
  const accentBadge  = station.id === 'hip-hop'
    ? 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold'
    : 'bg-brand-purple/20 border-brand-purple/40 text-brand-purple';
  const accentBtn    = station.id === 'hip-hop'
    ? 'bg-brand-gold hover:bg-brand-gold/90 text-black'
    : 'bg-brand-purple hover:bg-brand-purple/90 text-white';

  return (
    <div
      className={`glass-panel rounded-3xl border ${accentBorder} ${isActive ? `shadow-lg ${accentGlow}` : ''} overflow-hidden transition-all duration-300`}
    >
      {/* Station banner */}
      <div className="relative h-36 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-transparent" />
        {/* Animated wave bars when playing */}
        {isPlaying && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1 items-end">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-white/40"
                style={{
                  height: `${8 + Math.sin(i * 0.8) * 8}px`,
                  animationName: 'radioBar',
                  animationDuration: `${0.6 + i * 0.07}s`,
                  animationDelay: `${i * 0.05}s`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                }}
              />
            ))}
          </div>
        )}
        <div className="relative text-center z-10 px-4">
          <Radio
            className={`w-8 h-8 mx-auto mb-2 ${station.id === 'hip-hop' ? 'text-brand-gold' : 'text-brand-purple'}`}
          />
          <h2 className="text-lg font-extrabold text-white">{station.name}</h2>
          <p className="text-xs text-neutral-400 mt-0.5">{station.tagline}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Live / genre badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider ${accentBadge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-current opacity-50'}`} />
            {isPlaying ? 'Live' : station.genre}
          </span>
          {isDjIntro && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-medium">
              <Mic2 className="w-3 h-3" /> DJ Intro
            </span>
          )}
        </div>

        {/* Now Playing */}
        {currentItem ? (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Now Playing</p>
            <p className="text-white font-semibold text-sm leading-tight truncate">
              {currentItem.song.title}
            </p>
            <p className="text-neutral-400 text-xs truncate">{currentItem.song.artist}</p>
            {currentItem.song.album && (
              <p className="text-neutral-500 text-xs truncate">{currentItem.song.album}</p>
            )}
            {/* Progress bar */}
            <div className="pt-1">
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${station.id === 'hip-hop' ? 'bg-brand-gold' : 'bg-brand-purple'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-600 mt-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(currentDuration || currentItem.song.duration)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Status</p>
            <p className="text-neutral-400 text-sm">Ready to broadcast</p>
          </div>
        )}

        {/* Up Next preview */}
        {upNext.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Up Next</p>
            {upNext.slice(0, 2).map((qi, i) => (
              <div key={qi.song.id + i} className="flex items-center gap-2 text-xs text-neutral-400">
                <Music className="w-3 h-3 shrink-0 opacity-50" />
                <span className="truncate">{qi.song.title}</span>
                <span className="text-neutral-600 shrink-0">— {qi.song.artist}</span>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2 pt-1">
          {isPlaying ? (
            <>
              <button
                id={`radio-pause-${station.id}`}
                onClick={onTuneOut}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold transition-all"
              >
                <Pause className="w-4 h-4" /> Stop
              </button>
              <button
                id={`radio-skip-${station.id}`}
                onClick={onSkip}
                className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
                title="Skip"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              id={`radio-play-${station.id}`}
              onClick={onTuneIn}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl ${accentBtn} text-sm font-semibold transition-all shadow-md hover:scale-105 active:scale-95`}
            >
              <Play className="w-4 h-4" /> Tune In
            </button>
          )}
        </div>

        {/* Volume Slider — visible whenever the station card is mounted */}
        <div className="flex items-center gap-2 pt-1">
          <button
            id={`radio-mute-${station.id}`}
            onClick={() => {
              const next = localVolume > 0 ? 0 : 0.8;
              setLocalVolume(next);
              onSetVolume(next);
            }}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors shrink-0"
            title={localVolume === 0 ? 'Unmute' : 'Mute'}
          >
            {localVolume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            id={`radio-volume-${station.id}`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={localVolume}
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              setLocalVolume(vol);
              onSetVolume(vol);
            }}
            className={`flex-1 h-1 rounded-full cursor-pointer ${
              station.id === 'hip-hop' ? 'accent-brand-gold' : 'accent-brand-purple'
            }`}
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          <span className="text-[10px] text-neutral-500 w-7 text-right shrink-0">
            {Math.round(localVolume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Agent Status Panel ────────────────────────────────────────

function AgentStatusPanel({ agents }: { agents: Record<string, { status: string; detail: string }> }) {
  const agentMeta: Record<string, { label: string; Icon: React.ElementType }> = {
    ingestion:    { label: 'Ingestion',    Icon: Zap },
    intelligence: { label: 'Intelligence', Icon: Activity },
    programming:  { label: 'Programming',  Icon: Music },
    dj:           { label: 'AI DJ',        Icon: Mic2 },
    broadcast:    { label: 'Broadcast',    Icon: Volume2 },
    analytics:    { label: 'Analytics',    Icon: Users },
  };

  return (
    <div className="glass-panel rounded-3xl border border-white/5 p-5 bg-white/5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-brand-gold" /> Agent Status
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(agentMeta).map(([key, { label, Icon }]) => {
          const a = agents[key];
          const status = a?.status ?? 'idle';
          const detail = a?.detail ?? 'Standby';
          return (
            <div key={key} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/5">
              <div className={`mt-0.5 p-1.5 rounded-xl ${status === 'running' ? 'bg-brand-gold/20' : 'bg-white/5'}`}>
                <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'text-brand-gold' : 'text-neutral-400'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[10px] text-neutral-500 truncate">{detail}</p>
                <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  status === 'running' ? 'text-brand-gold' :
                  status === 'error'   ? 'text-red-400' :
                                         'text-neutral-600'
                }`}>
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Radio UI ─────────────────────────────────────────────

function RadioPageInner() {
  const { state, activeStation, tuneIn, tuneOut, skip, setVolume } = useRadio();

  const handleTuneIn = useCallback(
    (stationId: RadioStationId) => {
      if (activeStation === stationId) {
        tuneOut(stationId);
      } else {
        tuneIn(stationId);
      }
    },
    [activeStation, tuneIn, tuneOut]
  );

  return (
    <div className="space-y-8 py-6">
      {/* Page Header */}
      <div className="border-b border-white/5 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider mb-2">
          <Radio className="w-3.5 h-3.5" />
          Agentic AI Radio
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          ChanceTEK One Radio
        </h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-xl">
          Two stations powered by a coordinated team of AI agents — autonomously programming,
          performing, and broadcasting around the clock.
        </p>
      </div>

      {/* Station Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {RADIO_STATIONS.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            stationState={state.stations[station.id]}
            isActive={activeStation === station.id}
            onTuneIn={() => handleTuneIn(station.id)}
            onTuneOut={() => tuneOut(station.id)}
            onSkip={() => skip(station.id)}
            onSetVolume={(vol) => setVolume(station.id, vol)}
          />
        ))}
      </div>

      {/* Agent Status */}
      <AgentStatusPanel agents={state.agents} />

      {/* About */}
      <div className="glass-panel rounded-3xl border border-white/5 p-5 bg-white/5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-gold" /> How It Works
        </h3>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Each radio station is managed by a coordinated network of six AI agents:{' '}
          <span className="text-white font-medium">Ingestion</span> validates and prepares music uploaded by our admin team,{' '}
          <span className="text-white font-medium">Intelligence</span> analyzes BPM, energy, and mood,{' '}
          <span className="text-white font-medium">Programming</span> builds dynamic playlists with diversity controls,{' '}
          <span className="text-white font-medium">AI DJ</span> writes and voices station intros,{' '}
          <span className="text-white font-medium">Broadcast</span> manages continuous audio with zero dead air, and{' '}
          <span className="text-white font-medium">Analytics</span> tracks all listener behavior in real time.
        </p>
        <p className="text-xs text-neutral-600">
          All music is owned and produced by ChanceTEK One. Only admin-approved tracks enter the rotation.
        </p>
      </div>
    </div>
  );
}

export default function RadioPage() {
  return (
    <RadioProvider>
      <RadioPageInner />
    </RadioProvider>
  );
}
