'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  ListMusic,
  Sparkles,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Upload,
  Check,
  Search,
  Edit3,
  Eye,
  X,
  FolderPlus,
  Disc3,
  Radio,
  Zap,
  Lock,
} from 'lucide-react';
import { Playlist } from '@/types/playlist';
import {
  DeckId,
  DJTrackSource,
  MixConfiguration,
  PlaylistMixSettings,
  TrackAudioAnalysis,
} from '@/types/djchancemix';
import { planTransition } from '@/lib/djchancemix/transitionIntelligence';

interface MixQueuePanelProps {
  playlists: Playlist[];
  activePlaylistId: string | null;
  activePlaylistName: string;
  activePlaylistOwnerName?: string;
  canManageActivePlaylist: boolean;
  playlistMixSettings: PlaylistMixSettings | null;
  queue: DJTrackSource[];
  activeTrackId: string | null;
  nextTrackId: string | null;
  analyses: Record<string, TrackAudioAnalysis>;
  config: MixConfiguration;
  catalogTracks: DJTrackSource[];
  onSelectPlaylist: (playlistId: string) => void;
  onMixPlaylistNow: (playlistId: string | null) => void;
  onSelectAllCatalog: () => void;
  onTogglePlaylistAutoMix: (enabled: boolean) => void;
  onOpenCreatePlaylistModal: () => void;
  onOpenEditPlaylistModal: (tab: 'songs' | 'view' | 'details') => void;
  onOptimizeDjFlow: () => void;
  onPlayTrackAt: (index: number) => void;
  onManualLoadToDeck: (deckId: DeckId, track: DJTrackSource) => void;
  onCueNextTrack: (track: DJTrackSource) => void;
  onMoveTrack: (index: number, direction: 'up' | 'down') => void;
  onRemoveTrack: (index: number) => void;
  onAddCatalogTrack: (track: DJTrackSource) => void;
  onImportLocalFiles: (files: FileList) => void;
  importNotice: string | null;
}

export const MixQueuePanel: React.FC<MixQueuePanelProps> = ({
  playlists,
  activePlaylistId,
  activePlaylistName,
  activePlaylistOwnerName,
  canManageActivePlaylist,
  playlistMixSettings,
  queue,
  activeTrackId,
  nextTrackId,
  analyses,
  config,
  catalogTracks,
  onSelectPlaylist,
  onMixPlaylistNow,
  onSelectAllCatalog,
  onTogglePlaylistAutoMix,
  onOpenCreatePlaylistModal,
  onOpenEditPlaylistModal,
  onOptimizeDjFlow,
  onPlayTrackAt,
  onManualLoadToDeck,
  onCueNextTrack,
  onMoveTrack,
  onRemoveTrack,
  onAddCatalogTrack,
  onImportLocalFiles,
  importNotice,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const activeTrack = queue.find((t) => t.id === activeTrackId) || null;
  const activeAnalysis = activeTrack ? analyses[activeTrack.id] : null;
  const isEditingAllowedOnQueue = !activePlaylistId || canManageActivePlaylist;

  const filteredCatalog = catalogTracks
    .filter((t) => {
      const q = catalogSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artistName.toLowerCase().includes(q) ||
        (t.genre || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 36);

  return (
    <section className="rounded-3xl p-5 sm:p-6 bg-[#0a0a14]/95 border border-white/10 space-y-5">
      {/* Header & Playlist Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ListMusic className="w-5 h-5 text-brand-gold" />
            <h3 className="text-lg font-extrabold text-white">{activePlaylistName}</h3>

            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-brand-neon">
              {queue.length} {queue.length === 1 ? 'song' : 'songs'}
            </span>

            {activePlaylistId && !canManageActivePlaylist && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/15 text-[10px] font-bold text-neutral-300">
                <Lock className="w-3 h-3 text-neutral-400" />
                <span>Owned by {activePlaylistOwnerName || 'Member'} · View &amp; Mix Only</span>
              </span>
            )}

            {activePlaylistId && playlistMixSettings && (
              <button
                type="button"
                onClick={() => onTogglePlaylistAutoMix(!playlistMixSettings.autoMixEnabled)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                  playlistMixSettings.autoMixEnabled
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : 'bg-white/5 border-white/15 text-neutral-400'
                }`}
                title="Enable or disable AutoMix for this playlist"
              >
                AutoMix: {playlistMixSettings.autoMixEnabled ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            Select any playlist and hit <span className="text-brand-gold font-semibold">Mix Playlist Now</span> to play &amp; auto-mix every song continuously, or load tracks manually to Deck A / Deck B.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onMixPlaylistNow(activePlaylistId)}
            disabled={queue.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_18px_rgba(245,195,68,0.35)] hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Mix Playlist Now</span>
          </button>

          <button
            type="button"
            onClick={onOptimizeDjFlow}
            disabled={queue.length < 3}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-fuchsia-600 text-white text-xs font-extrabold shadow-lg hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            title="Reorder queue for optimal Camelot key & BPM flow"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span>AI DJ Flow</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreatePlaylistModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Create Playlist</span>
          </button>

          {activePlaylistId && (
            <button
              type="button"
              onClick={() => onOpenEditPlaylistModal('view')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-cyan-200 text-xs font-bold cursor-pointer"
              title="View all songs in this playlist"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Songs</span>
            </button>
          )}

          {activePlaylistId && canManageActivePlaylist && (
            <button
              type="button"
              onClick={() => onOpenEditPlaylistModal('songs')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/40 text-brand-gold text-xs font-extrabold cursor-pointer"
              title="Owner-only: rearrange, delete, and add songs in this playlist"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Songs</span>
            </button>
          )}

          {isEditingAllowedOnQueue && (
            <button
              type="button"
              onClick={() => setShowAddDrawer((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-brand-gold" />
              <span>Add Songs</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-cyan-300 cursor-pointer"
            title="Import legally authorized local MP3, WAV, AAC, or FLAC files (stays private in browser)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Local Audio</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onImportLocalFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {importNotice && (
        <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-200">
          {importNotice}
        </div>
      )}

      {/* Playlists Switcher with 1-Click "Mix Now" on Every Playlist */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <div
          className={`inline-flex items-center rounded-full border shrink-0 transition-all overflow-hidden ${
            activePlaylistId === null
              ? 'bg-brand-gold/20 border-brand-gold text-white shadow-md'
              : 'bg-white/5 border-white/10 text-neutral-300'
          }`}
        >
          <button
            type="button"
            onClick={onSelectAllCatalog}
            className="px-3.5 py-1.5 text-xs font-bold hover:text-white cursor-pointer"
          >
            ChanceTEK Studio Mix ({catalogTracks.length})
          </button>
          <button
            type="button"
            onClick={() => onMixPlaylistNow(null)}
            className="px-2.5 py-1.5 bg-brand-gold text-black text-[10px] font-black uppercase flex items-center gap-1 hover:brightness-110 cursor-pointer"
            title="Start mixing Studio Mix immediately"
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>Mix</span>
          </button>
        </div>

        {playlists.map((pl) => {
          const isSelected = activePlaylistId === pl.id;
          return (
            <div
              key={pl.id}
              className={`inline-flex items-center rounded-full border shrink-0 transition-all overflow-hidden ${
                isSelected
                  ? 'bg-brand-purple/40 border-brand-gold text-white shadow-md'
                  : 'bg-white/5 border-white/10 text-neutral-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="px-3.5 py-1.5 text-xs font-bold hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <span>{pl.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({pl.itemCount})</span>
              </button>
              <button
                type="button"
                onClick={() => onMixPlaylistNow(pl.id)}
                disabled={pl.itemCount === 0}
                className="px-2.5 py-1.5 bg-gradient-to-r from-brand-gold to-amber-500 text-black text-[10px] font-black uppercase flex items-center gap-1 hover:brightness-110 disabled:opacity-40 cursor-pointer"
                title={`Start playing and auto-mixing "${pl.name}" right now`}
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>Mix</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Tracks Catalog Browser Drawer (Owner / Local Session Queue Only) */}
      {showAddDrawer && isEditingAllowedOnQueue && (
        <div className="p-4 rounded-2xl bg-black/50 border border-brand-purple/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search ChanceTEK One catalog to add to mix..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddDrawer(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredCatalog.map((track) => {
              const inQueue = queue.some((q) => q.id === track.id);
              return (
                <div
                  key={track.id}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    inQueue
                      ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-neutral-900">
                      <Image src={track.coverUrl} alt={track.title} fill unoptimized className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{track.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {track.artistName} · {track.genre}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onManualLoadToDeck('A', track)}
                      className="px-1.5 py-1 rounded bg-brand-gold/20 hover:bg-brand-gold text-brand-gold hover:text-black text-[10px] font-black cursor-pointer"
                      title="Load onto Deck A"
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => onManualLoadToDeck('B', track)}
                      className="px-1.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-400 text-cyan-300 hover:text-black text-[10px] font-black cursor-pointer"
                      title="Load onto Deck B"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddCatalogTrack(track)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-brand-gold hover:text-black cursor-pointer"
                      title="Add to playlist / mix queue"
                    >
                      {inQueue ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Plus className="w-3.5 h-3.5 text-brand-gold" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mix Queue Track List */}
      {queue.length === 0 ? (
        <div className="py-12 text-center space-y-3 text-neutral-400">
          <Disc3 className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm font-bold text-white">Your DJ mix queue is empty</p>
          <p className="text-xs">
            Create a playlist, pick one above, add tracks, or import authorized local audio files.
          </p>
          <button
            type="button"
            onClick={onOpenCreatePlaylistModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Create New Playlist to Mix</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto pr-1">
          {queue.map((track, idx) => {
            const isCurrent = track.id === activeTrackId;
            const isNext = track.id === nextTrackId;
            const analysis = analyses[track.id];

            let compatScore: number | null = null;
            if (!isCurrent && activeTrack && activeAnalysis && analysis) {
              compatScore = planTransition({
                fromTrack: activeTrack,
                toTrack: track,
                fromAnalysis: activeAnalysis,
                toAnalysis: analysis,
                config,
              }).compatibilityScore;
            }

            return (
              <div
                key={`${track.id}-${idx}`}
                className={`py-2.5 px-2.5 rounded-2xl flex items-center justify-between gap-2.5 transition-all ${
                  isCurrent
                    ? 'bg-brand-gold/10 border border-brand-gold/30'
                    : isNext
                    ? 'bg-cyan-500/10 border border-cyan-400/25'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <span className="w-5 text-center text-[11px] font-mono text-neutral-500 shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPlayTrackAt(idx)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-brand-gold text-black shadow-md'
                        : 'bg-white/5 hover:bg-brand-gold hover:text-black text-neutral-300'
                    }`}
                    title={`Play & mix from "${track.title}"`}
                  >
                    {isCurrent ? (
                      <Radio className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-neutral-900">
                    <Image src={track.coverUrl} alt={track.title} fill unoptimized className="object-cover" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-brand-gold' : 'text-white'}`}>
                        {track.title}
                      </p>
                      {isNext && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[9px] font-black uppercase shrink-0">
                          Up Next
                        </span>
                      )}
                      {track.sourceType === 'local-file' && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 text-[9px] font-mono shrink-0">
                          LOCAL
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {track.artistName} · {track.genre}
                    </p>
                  </div>
                </div>

                {/* Musical Telemetry Badges */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-neutral-200">
                    {analysis ? `${analysis.bpm} BPM` : track.bpm ? `${track.bpm} BPM` : '…'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-brand-purple/20 border border-brand-purple/40 text-white">
                    {analysis?.camelotCode || '—'}
                  </span>
                  {compatScore !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${
                        compatScore >= 82
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : compatScore >= 65
                          ? 'bg-brand-gold/20 text-brand-gold'
                          : 'bg-white/10 text-neutral-400'
                      }`}
                    >
                      {compatScore}%
                    </span>
                  )}
                </div>

                {/* Manual Deck A / B Load + Queue Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onManualLoadToDeck('A', track)}
                    className="px-2 py-1 rounded-lg bg-brand-gold/15 hover:bg-brand-gold border border-brand-gold/35 text-brand-gold hover:text-black text-[10px] font-black transition-all cursor-pointer"
                    title={`Manually load "${track.title}" onto Deck A`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => onManualLoadToDeck('B', track)}
                    className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-400 border border-cyan-400/35 text-cyan-300 hover:text-black text-[10px] font-black transition-all cursor-pointer"
                    title={`Manually load "${track.title}" onto Deck B`}
                  >
                    B
                  </button>

                  {!isCurrent && !isNext && (
                    <button
                      type="button"
                      onClick={() => onCueNextTrack(track)}
                      className="hidden sm:inline-flex px-2 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/25 border border-white/10 hover:border-cyan-400/40 text-neutral-200 hover:text-cyan-200 text-[10px] font-bold cursor-pointer"
                      title="Override and cue as next transition track"
                    >
                      Next
                    </button>
                  )}

                  {isEditingAllowedOnQueue && (
                    <>
                      <button
                        type="button"
                        onClick={() => onMoveTrack(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move song up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveTrack(idx, 'down')}
                        disabled={idx === queue.length - 1}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move song down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveTrack(idx)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 cursor-pointer"
                        title="Remove song"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
