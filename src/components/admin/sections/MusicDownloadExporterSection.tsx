'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { useAuth, isSuperUserEmail } from '@/lib/auth/AuthContext';
import {
  MusicExportAgent,
  MusicExportAgentSnapshot,
  ExportFolderLayout,
  TrackExportStatus,
} from '@/lib/admin/MusicExportAgent';
import { MusicSortOption, MUSIC_SORT_OPTIONS, sortTracks } from '@/lib/music/trackSorting';
import { matchesTrackSearch } from '@/lib/search/universalSearch';
import {
  Download,
  FolderOpen,
  HardDrive,
  Cloud,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Bot,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ArrowUpDown,
  Image as ImageIcon,
  FileJson,
  Music,
  Lock,
  Terminal,
  CheckSquare,
  Square as EmptySquare,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

function getStatusPill(status?: TrackExportStatus) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    case 'resolving':
      return {
        label: 'Resolving',
        cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      };
    case 'embedding':
      return {
        label: 'Embedding Art',
        cls: 'bg-brand-purple/25 text-brand-neon border-brand-purple/50',
      };
    case 'writing':
      return {
        label: 'Writing',
        cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    case 'retrying':
      return {
        label: 'Auto-Retrying',
        cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      };
    case 'failed':
      return {
        label: 'Failed',
        cls: 'bg-red-500/20 text-red-300 border-red-500/40',
      };
    case 'queued':
      return {
        label: 'Queued',
        cls: 'bg-white/10 text-neutral-300 border-white/15',
      };
    default:
      return null;
  }
}

export const MusicDownloadExporterSection: React.FC = () => {
  const { profile, user, isSuperUser } = useAuth();
  const actorEmail = profile?.email || user?.email || '';
  const isSuperAdmin = Boolean(isSuperUser || isSuperUserEmail(actorEmail));

  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [sortBy, setSortBy] = useState<MusicSortOption>('newest');

  // Destination folder & packaging configuration
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [directoryLabel, setDirectoryLabel] = useState<string>('');
  const [folderLayout, setFolderLayout] = useState<ExportFolderLayout>('artist-album');
  const [embedId3CoverArt, setEmbedId3CoverArt] = useState(true);
  const [writeSidecarCoverArt, setWriteSidecarCoverArt] = useState(true);
  const [writeManifestJson, setWriteManifestJson] = useState(true);
  const [pickerNotice, setPickerNotice] = useState<string | null>(null);

  // Live Autonomous Agent Snapshot
  const [agentSnap, setAgentSnap] = useState<MusicExportAgentSnapshot>(() =>
    MusicExportAgent.getSnapshot()
  );
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const supportsDirectoryPicker =
    typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';

  useEffect(() => {
    const refresh = () => {
      setTracks(MusicCatalogService.getAllTracks());
    };
    refresh();
    const unsubCatalog = MusicCatalogService.subscribe(refresh);
    const unsubAgent = MusicExportAgent.subscribe(setAgentSnap);
    return () => {
      unsubCatalog();
      unsubAgent();
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [agentSnap.logs.length]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      if (t.genre) set.add(t.genre);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const matched = tracks.filter((t) => {
      if (genreFilter !== 'all' && t.genre !== genreFilter) return false;
      return matchesTrackSearch(t, searchQuery);
    });
    return sortTracks(matched, sortBy);
  }, [tracks, genreFilter, searchQuery, sortBy]);

  // Strict Super Admin Gate
  if (!isSuperAdmin) {
    return (
      <div className="p-10 rounded-3xl glass-panel border border-red-500/40 bg-red-950/20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-white">Super Administrator Access Only</h2>
        <p className="text-sm text-neutral-300 max-w-lg mx-auto">
          The Autonomous Platform Music Export Agent is restricted exclusively to authorized Super
          Administrators. Standard administrator and member accounts cannot export platform masters.
        </p>
      </div>
    );
  }

  const isBusy =
    agentSnap.phase === 'planning' ||
    agentSnap.phase === 'running' ||
    agentSnap.phase === 'paused' ||
    agentSnap.phase === 'verifying';

  const handleChooseFolder = async () => {
    setPickerNotice(null);
    if (!supportsDirectoryPicker) {
      setPickerNotice(
        'Your current browser does not expose the native folder picker API. The Autonomous Agent will automatically export files with embedded cover art to your browser Downloads folder instead (Chrome, Edge, or Brave enable direct Local & Cloud Drive folder selection).'
      );
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker({
        id: 'chancetek-one-music-export',
        mode: 'readwrite',
        startIn: 'music',
      });
      setDirectoryHandle(handle);
      setDirectoryLabel(handle.name || 'Selected Destination Folder');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setPickerNotice(err?.message || 'Could not open destination folder picker.');
      }
    }
  };

  const toggleTrackSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredTracks.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const launchAutonomousExport = async (mode: 'all' | 'selected') => {
    const targetTracks =
      mode === 'all' ? tracks : tracks.filter((t) => selectedIds.has(t.id));
    if (targetTracks.length === 0) return;

    let activeHandle = directoryHandle;
    let activeLabel = directoryLabel;

    // Prompt Super Admin to pick target computer/cloud-drive folder if none chosen yet
    if (!activeHandle && supportsDirectoryPicker) {
      try {
        activeHandle = await (window as any).showDirectoryPicker({
          id: 'chancetek-one-music-export',
          mode: 'readwrite',
          startIn: 'music',
        });
        activeLabel = activeHandle.name || 'Selected Destination Folder';
        setDirectoryHandle(activeHandle);
        setDirectoryLabel(activeLabel);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return; // User cancelled folder selection cleanly
        }
      }
    }

    await MusicExportAgent.startExport({
      tracks: targetTracks,
      directoryHandle: activeHandle,
      directoryLabel: activeLabel || 'Browser Downloads Folder',
      folderLayout,
      embedId3CoverArt,
      writeSidecarCoverArt,
      writeManifestJson,
      actor: {
        id: profile?.id || user?.uid || 'super-admin',
        name: profile?.name || 'Super Administrator',
        email: actorEmail,
      },
    });
  };

  const progressPercent =
    agentSnap.totalTracks > 0
      ? Math.round(((agentSnap.completedCount + agentSnap.failedCount) / agentSnap.totalTracks) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Autonomous Agent Hero Header */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl glass-panel border border-brand-gold/40 bg-gradient-to-br from-[#1b122c]/95 via-[#110a1f]/95 to-[#090612]/95 shadow-2xl space-y-5">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand-gold/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/50 text-brand-gold text-[11px] font-black uppercase tracking-wider">
                <Bot className="w-3.5 h-3.5" />
                Autonomous Export Agent
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/25 border border-brand-purple/50 text-brand-neon text-[11px] font-black uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                Super Admin Only
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Read-Only Safe · Zero Tracks Removed
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Download Platform Music
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-3xl leading-relaxed">
              Autonomously export all platform music or selected songs — with exact cover art
              embedded directly inside ID3v2.3 tags and optional sidecar artwork — straight into any
              chosen folder on your computer, external drive, or synced cloud drive (OneDrive, Google
              Drive, iCloud Drive, Dropbox). Platform catalog files are strictly read-only and never
              removed or modified.
            </p>
          </div>

          {/* Primary Autonomous Launch Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isBusy || tracks.length === 0}
              onClick={() => launchAutonomousExport('all')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Export All Platform Music ({tracks.length})</span>
            </button>

            <button
              type="button"
              disabled={isBusy || selectedIds.size === 0}
              onClick={() => launchAutonomousExport('selected')}
              className="px-5 py-3 rounded-2xl bg-brand-purple hover:bg-brand-violet text-white font-black text-xs uppercase tracking-wider border border-brand-neon/40 shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Export Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>

        {/* 2. Destination Folder & Autonomous Packaging Settings */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Destination Picker */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-brand-gold" />
                Destination Folder (Computer / Cloud Drive)
              </span>
              <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                <HardDrive className="w-3 h-3" />
                <Cloud className="w-3 h-3" />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-200 truncate font-mono">
              {directoryLabel ? `📁 ${directoryLabel}` : 'No folder chosen yet (prompted on launch)'}
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={handleChooseFolder}
              className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-brand-gold/20 border border-white/15 hover:border-brand-gold/50 text-white hover:text-brand-gold text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4 text-brand-gold" />
              <span>{directoryHandle ? 'Change Destination Folder' : 'Choose Local or Cloud Drive Folder'}</span>
            </button>

            {pickerNotice && (
              <p className="text-[11px] text-amber-300 leading-snug">{pickerNotice}</p>
            )}
          </div>

          {/* Folder Organization */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <span className="text-xs font-extrabold text-white block">
              Folder Organization Structure
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                {
                  id: 'artist-album' as const,
                  label: 'Artist / Album / Track.mp3',
                  desc: 'Recommended library hierarchy',
                },
                {
                  id: 'artist' as const,
                  label: 'Artist / Track.mp3',
                  desc: 'Grouped by artist folder',
                },
                {
                  id: 'flat' as const,
                  label: 'Flat Folder (Artist - Track.mp3)',
                  desc: 'All songs in one chosen folder',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setFolderLayout(opt.id)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    folderLayout === opt.id
                      ? 'bg-brand-gold/15 border-brand-gold/60 text-white'
                      : 'bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.07]'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-neutral-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cover Art & Integrity Packaging */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <span className="text-xs font-extrabold text-white block">
              Cover Art & Integrity Verification
            </span>

            <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={embedId3CoverArt}
                disabled={isBusy}
                onChange={(e) => setEmbedId3CoverArt(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div className="text-xs">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                  Embed Cover Art in MP3 (ID3v2.3 APIC)
                </p>
                <p className="text-[10px] text-neutral-400">
                  Attaches song artwork & tags directly inside each exported audio file
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={writeSidecarCoverArt}
                disabled={isBusy}
                onChange={(e) => setWriteSidecarCoverArt(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div className="text-xs">
                <p className="font-bold text-white">Save Paired cover.jpg Artwork</p>
                <p className="text-[10px] text-neutral-400">
                  Saves high-res cover image alongside audio in each exported folder
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={writeManifestJson}
                disabled={isBusy}
                onChange={(e) => setWriteManifestJson(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div className="text-xs">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <FileJson className="w-3.5 h-3.5 text-brand-neon" />
                  Write SHA-256 Export Manifest
                </p>
                <p className="text-[10px] text-neutral-400">
                  Logs checksums, file sizes, and cover art verification per track
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Autonomous Agent Live Control & Telemetry Deck */}
      {(agentSnap.phase !== 'idle' || agentSnap.logs.length > 0) && (
        <div className="p-6 rounded-3xl glass-panel border border-brand-purple/40 bg-[#0d0919]/95 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-purple/25 border border-brand-purple/50 flex items-center justify-center text-brand-gold">
                {agentSnap.phase === 'running' || agentSnap.phase === 'planning' || agentSnap.phase === 'verifying' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : agentSnap.phase === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Terminal className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Autonomous Agent Telemetry</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-white/10 text-brand-gold border border-brand-gold/30">
                    {agentSnap.phase}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 truncate max-w-xl">
                  {agentSnap.currentTrackTitle
                    ? `Active: ${agentSnap.currentTrackTitle}`
                    : agentSnap.currentAction}
                </p>
              </div>
            </div>

            {/* Live Pause / Resume / Cancel / Retry Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {agentSnap.phase === 'running' && (
                <button
                  type="button"
                  onClick={() => MusicExportAgent.pause()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              )}

              {agentSnap.phase === 'paused' && (
                <button
                  type="button"
                  onClick={() => MusicExportAgent.resume()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              )}

              {isBusy && (
                <button
                  type="button"
                  onClick={() => MusicExportAgent.cancel()}
                  className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}

              {!isBusy && agentSnap.failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => MusicExportAgent.retryFailed()}
                  className="px-3.5 py-2 rounded-xl bg-brand-gold text-black text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Failed ({agentSnap.failedCount})
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar + Live KPIs */}
          <div className="space-y-2.5">
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-purple via-brand-gold to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase">Progress</p>
                <p className="font-black text-white">
                  {agentSnap.completedCount}/{agentSnap.totalTracks} ({progressPercent}%)
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase">Covers Attached</p>
                <p className="font-black text-brand-gold">{agentSnap.coversEmbeddedCount}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase">Data Written</p>
                <p className="font-black text-emerald-300">
                  {formatBytes(agentSnap.totalBytesWritten)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase">Auto-Retries</p>
                <p className="font-black text-amber-300">{agentSnap.retriedCount}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase">Failed</p>
                <p className={`font-black ${agentSnap.failedCount > 0 ? 'text-red-400' : 'text-neutral-300'}`}>
                  {agentSnap.failedCount}
                </p>
              </div>
            </div>
          </div>

          {/* Live Log Console */}
          <div
            ref={logContainerRef}
            className="h-44 overflow-y-auto rounded-2xl bg-black/70 border border-white/10 p-3 font-mono text-[11px] space-y-1"
          >
            {agentSnap.logs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-neutral-500 shrink-0">[{entry.timestamp}]</span>
                <span
                  className={`uppercase font-bold shrink-0 w-14 ${
                    entry.level === 'done' || entry.level === 'verify'
                      ? 'text-emerald-400'
                      : entry.level === 'error'
                      ? 'text-red-400'
                      : entry.level === 'warn' || entry.level === 'retry'
                      ? 'text-amber-400'
                      : entry.level === 'id3' || entry.level === 'art'
                      ? 'text-brand-neon'
                      : 'text-sky-400'
                  }`}
                >
                  {entry.level}
                </span>
                <span className="text-neutral-200 break-words">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Song Selection Catalog Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-brand-gold" />
              Select Platform Songs to Export ({filteredTracks.length} shown · {selectedIds.size} selected)
            </h3>
            <p className="text-xs text-neutral-400">
              Choose individual songs or export the full catalog — newly uploaded music appears at the top by default
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-xs font-bold text-neutral-200 hover:text-brand-gold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select All Filtered
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <EmptySquare className="w-3.5 h-3.5" />
              Clear Selection
            </button>
          </div>
        </div>

        {/* Search, Sort & Genre Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists, albums..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="relative flex items-center w-full sm:w-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold absolute left-3 pointer-events-none" />
            <select
              aria-label="Sort export catalog"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as MusicSortOption)}
              className="w-full sm:w-52 pl-8 pr-3 py-2.5 rounded-xl bg-black/40 border border-brand-gold/30 text-neutral-100 text-xs font-semibold focus:border-brand-gold focus:outline-none cursor-pointer"
            >
              {MUSIC_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <select
            aria-label="Filter export genre"
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-neutral-200 text-xs focus:border-brand-gold focus:outline-none cursor-pointer"
          >
            <option value="all">All Genres</option>
            {availableGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Tracks Table */}
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#120d22] z-10 border-b border-white/10 text-[10px] uppercase font-mono text-neutral-400">
              <tr>
                <th className="py-3 px-3 w-10 text-center">Sel</th>
                <th className="py-3 px-3">Song & Cover Art</th>
                <th className="py-3 px-3">Artist</th>
                <th className="py-3 px-3">Album</th>
                <th className="py-3 px-3">Genre</th>
                <th className="py-3 px-3 text-right">Agent Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTracks.map((track) => {
                const isSelected = selectedIds.has(track.id);
                const rec = agentSnap.records[track.id];
                const pill = getStatusPill(rec?.status);
                const cover = MusicCatalogService.resolveTrackCover(track);

                return (
                  <tr
                    key={track.id}
                    onClick={() => !isBusy && toggleTrackSelection(track.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-brand-gold/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isBusy}
                        onChange={() => toggleTrackSelection(track.id)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-neutral-900">
                          <Image
                            src={cover}
                            alt={track.title}
                            fill
                            className="object-cover"
                            unoptimized={
                              cover.startsWith('http') ||
                              cover.startsWith('data:') ||
                              cover.startsWith('blob:')
                            }
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{track.title}</p>
                          {rec?.destinationPath && (
                            <p className="text-[10px] text-emerald-300 font-mono truncate">
                              ✓ {rec.destinationPath}
                            </p>
                          )}
                          {rec?.error && (
                            <p className="text-[10px] text-red-400 truncate">{rec.error}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-200 font-medium">{track.artistName}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{track.albumTitle || 'Single'}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-neutral-300">
                        {track.genre}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {pill ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${pill.cls}`}
                        >
                          {rec?.status === 'verified' && <CheckCircle2 className="w-3 h-3" />}
                          {rec?.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                          {pill.label}
                          {rec?.bytesWritten ? ` · ${formatBytes(rec.bytesWritten)}` : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500 font-mono">Ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

