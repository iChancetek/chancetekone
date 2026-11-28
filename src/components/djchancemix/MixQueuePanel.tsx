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
  Save,
  X,
  FolderPlus,
  Disc3,
  Radio,
} from 'lucide-react';
import { Playlist } from '@/types/playlist';
import {
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
  canManageActivePlaylist: boolean;
  playlistMixSettings: PlaylistMixSettings | null;
  queue: DJTrackSource[];
  activeTrackId: string | null;
  nextTrackId: string | null;
  analyses: Record<string, TrackAudioAnalysis>;
  config: MixConfiguration;
  catalogTracks: DJTrackSource[];
  onSelectPlaylist: (playlistId: string) => void;
  onSelectAllCatalog: () => void;
  onTogglePlaylistAutoMix: (enabled: boolean) => void;
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (newName: string) => void;
  onDeletePlaylist: () => void;
  onSaveQueueAsPlaylist: (name: string) => void;
  onOptimizeDjFlow: () => void;
  onPlayTrackAt: (index: number) => void;
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
  canManageActivePlaylist,
  playlistMixSettings,
  queue,
  activeTrackId,
  nextTrackId,
  analyses,
  config,
  catalogTracks,
  onSelectPlaylist,
  onSelectAllCatalog,
  onTogglePlaylistAutoMix,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onSaveQueueAsPlaylist,
  onOptimizeDjFlow,
  onPlayTrackAt,
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
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(activePlaylistName);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeTrack = queue.find((t) => t.id === activeTrackId) || null;
  const activeAnalysis = activeTrack ? analyses[activeTrack.id] : null;

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
    .slice(0, 30);

  return (
    <section className="rounded-3xl p-5 sm:p-6 bg-[#0a0a14]/95 border border-white/10 space-y-5">
      {/* Header & Playlist Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ListMusic className="w-5 h-5 text-brand-gold" />
            {isRenaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameDraft.trim()) {
                    onRenamePlaylist(renameDraft.trim());
                    setIsRenaming(false);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 border border-brand-gold/50 text-sm font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-lg bg-brand-gold text-black cursor-pointer"
                  title="Save name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="p-1.5 rounded-lg bg-white/10 text-neutral-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <h3 className="text-lg font-extrabold text-white">{activePlaylistName}</h3>
            )}

            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-brand-neon">
              {queue.length} tracks
            </span>

            {activePlaylistId && playlistMixSettings && (
              <button
                type="button"
                onClick={() => onTogglePlaylistAutoMix(!playlistMixSettings.autoMixEnabled)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                  playlistMixSettings.autoMixEnabled
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : 'bg-white/5 border-white/15 text-neutral-400'
                }`}
                title="Enable or disable AutoMix for this specific playlist"
              >
                Playlist AutoMix: {playlistMixSettings.autoMixEnabled ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            Harmonic & BPM scores update automatically as tracks finish DSP analysis.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setShowAddDrawer((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-brand-gold" />
            <span>Add Tracks</span>
          </button>

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

          <button
            type="button"
            onClick={() => {
              setNewPlaylistName('');
              setShowNewPlaylistInput((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-200 cursor-pointer"
            title="Create or save playlist"
          >
            <FolderPlus className="w-3.5 h-3.5 text-brand-gold" />
            <span>Save / New</span>
          </button>

          {activePlaylistId && canManageActivePlaylist && (
            <>
              <button
                type="button"
                onClick={() => {
                  setRenameDraft(activePlaylistName);
                  setIsRenaming(true);
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-brand-gold cursor-pointer"
                title="Rename playlist"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-neutral-400 hover:text-red-400 cursor-pointer"
                title="Delete playlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Bar */}
      {confirmDelete && activePlaylistId && (
        <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-red-200 font-semibold">
            Delete playlist &ldquo;{activePlaylistName}&rdquo;? Tracks stay safe in the catalog.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDeletePlaylist();
                setConfirmDelete(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* Save / Create New Playlist Inline Bar */}
      {showNewPlaylistInput && (
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-brand-gold/30 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Name your DJ mix playlist..."
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
          />
          <button
            type="button"
            disabled={!newPlaylistName.trim()}
            onClick={() => {
              onSaveQueueAsPlaylist(newPlaylistName.trim());
              setNewPlaylistName('');
              setShowNewPlaylistInput(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-gold text-black text-xs font-black disabled:opacity-40 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Current Queue</span>
          </button>
          <button
            type="button"
            disabled={!newPlaylistName.trim()}
            onClick={() => {
              onCreatePlaylist(newPlaylistName.trim());
              setNewPlaylistName('');
              setShowNewPlaylistInput(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Empty</span>
          </button>
        </div>
      )}

      {importNotice && (
        <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-200">
          {importNotice}
        </div>
      )}

      {/* Playlist Pills Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={onSelectAllCatalog}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all cursor-pointer ${
            activePlaylistId === null
              ? 'bg-brand-gold text-black border-brand-gold shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
          }`}
        >
          ChanceTEK Studio Mix ({catalogTracks.length})
        </button>

        {playlists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => onSelectPlaylist(pl.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
              activePlaylistId === pl.id
                ? 'bg-brand-purple text-white border-brand-gold shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
            }`}
          >
            <span>{pl.name}</span>
            <span className="text-[10px] opacity-75 font-mono">({pl.itemCount})</span>
          </button>
        ))}
      </div>

      {/* Add Tracks Catalog Browser Drawer */}
      {showAddDrawer && (
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
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onAddCatalogTrack(track)}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${
                    inQueue
                      ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
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
                  <span className="shrink-0 p-1 rounded-lg bg-white/10">
                    {inQueue ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Plus className="w-3.5 h-3.5 text-brand-gold" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mix Queue Track List */}
      {queue.length === 0 ? (
        <div className="py-12 text-center space-y-2 text-neutral-400">
          <Disc3 className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm font-bold text-white">Your DJ mix queue is empty</p>
          <p className="text-xs">
            Select a playlist above, click <span className="text-brand-gold font-semibold">Add Tracks</span>, or import authorized local audio files.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[460px] overflow-y-auto pr-1">
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
                className={`py-2.5 px-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                  isCurrent
                    ? 'bg-brand-gold/10 border border-brand-gold/30'
                    : isNext
                    ? 'bg-cyan-500/10 border border-cyan-400/25'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onPlayTrackAt(idx)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-brand-gold text-black shadow-md'
                        : 'bg-white/5 hover:bg-brand-gold hover:text-black text-neutral-300'
                    }`}
                    title={`Play ${track.title}`}
                  >
                    {isCurrent ? <Radio className="w-4 h-4 animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
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
                <div className="hidden sm:flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
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
                      title="Harmonic + BPM transition compatibility with currently playing song"
                    >
                      {compatScore}%
                    </span>
                  )}
                </div>

                {/* Queue Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {!isCurrent && !isNext && (
                    <button
                      type="button"
                      onClick={() => onCueNextTrack(track)}
                      className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-200 text-[10px] font-bold cursor-pointer"
                      title="Override and cue as next transition track"
                    >
                      Cue Next
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onMoveTrack(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-25 cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveTrack(idx, 'down')}
                    disabled={idx === queue.length - 1}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-25 cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveTrack(idx)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

