'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Music,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Volume2,
  VolumeX,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Layers,
  X,
  CheckSquare,
  Square,
  ListChecks,
  ShieldAlert,
  FileWarning,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  UnplayableAudioDetectionService,
  UnplayableTrackRecord,
  UnplayableReasonCode,
  UnplayableStats,
} from '@/lib/admin/UnplayableAudioDetectionService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AdminRole } from '@/types/admin';

export interface UnplayableAudioSectionProps {
  onNavigateToDuplicates?: () => void;
}

export const UnplayableAudioSection: React.FC<UnplayableAudioSectionProps> = ({
  onNavigateToDuplicates,
}) => {
  const { profile } = useAuth();

  // State
  const [unplayableTracks, setUnplayableTracks] = useState<UnplayableTrackRecord[]>([]);
  const [stats, setStats] = useState<UnplayableStats>({
    totalUnplayable: 0,
    server404Count: 0,
    missingAudioCount: 0,
    localBlobCount: 0,
    playbackErrorCount: 0,
    crossArtistMismatchCount: 0,
    catalogHealthScore: 100,
  });
  const [activeFilter, setActiveFilter] = useState<'all' | UnplayableReasonCode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Multi-Selection State for Batch Removal
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteItems, setBatchDeleteItems] = useState<UnplayableTrackRecord[]>([]);

  // Single Item Deletion Modal
  const [itemToDelete, setItemToDelete] = useState<UnplayableTrackRecord | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Interactive Audition & Test Playback State (Confirm songs are playing before deleting)
  const [activeTestItem, setActiveTestItem] = useState<UnplayableTrackRecord | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [testPlayStatus, setTestPlayStatus] = useState<'idle' | 'testing' | 'playing' | 'error'>('idle');
  const [testPlayErrorMessage, setTestPlayErrorMessage] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Run scan
  const runScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const items = UnplayableAudioDetectionService.scanUnplayableTracks();
      const currentStats = UnplayableAudioDetectionService.getStats();
      setUnplayableTracks(items);
      setStats(currentStats);
      setIsScanning(false);
    }, 200);
  };

  useEffect(() => {
    runScan();
    const unsub = UnplayableAudioDetectionService.subscribe(() => {
      runScan();
    });
    return () => unsub();
  }, []);

  // HTML5 Audio Event Listeners for Test Playback
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const handleDurationChange = () => setAudioDuration(audio.duration || 0);
    const handlePlay = () => {
      setIsAudioPlaying(true);
      setTestPlayStatus('playing');
    };
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => setIsAudioPlaying(false);
    const handleError = () => {
      setIsAudioPlaying(false);
      setTestPlayStatus('error');
      const errCode = audio.error ? audio.error.code : 0;
      let errText = 'Audio playback failed to load';
      if (errCode === 4) errText = 'HTML5 Media Error: Format not supported or 404 Source Not Found';
      else if (errCode === 2) errText = 'Network Error: Failed to fetch audio stream';
      else if (errCode === 3) errText = 'Decode Error: Audio stream corrupted';
      setTestPlayErrorMessage(errText);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [activeTestItem]);

  // Test Play Trigger
  const handleTestPlay = (track: UnplayableTrackRecord) => {
    if (activeTestItem?.id === track.id) {
      if (isAudioPlaying) {
        audioRef.current?.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current?.play().catch((err) => {
          setTestPlayStatus('error');
          setTestPlayErrorMessage(err?.message || 'Playback blocked or failed');
        });
      }
      return;
    }

    setActiveTestItem(track);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setTestPlayStatus('testing');
    setTestPlayErrorMessage('');

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current
          .play()
          .then(() => {
            setIsAudioPlaying(true);
            setTestPlayStatus('playing');
          })
          .catch((err) => {
            setIsAudioPlaying(false);
            setTestPlayStatus('error');
            setTestPlayErrorMessage(err?.message || 'Audio playback failed (404 Not Found or unsupported source)');
          });
      }
    }, 60);
  };

  const handleSeekAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPos = (e.clientX - rect.left) / rect.width;
    const newTime = clickPos * audioDuration;
    audioRef.current.currentTime = newTime;
    setAudioCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Mark song as confirmed playable (removes it from unplayable list)
  const handleMarkConfirmedPlayable = (trackId: string) => {
    UnplayableAudioDetectionService.markConfirmedPlayable(trackId);
    if (activeTestItem?.id === trackId) {
      audioRef.current?.pause();
      setActiveTestItem(null);
      setIsAudioPlaying(false);
    }
    setFeedbackMessage({
      type: 'success',
      text: `Song confirmed working! Verified playable status saved for this track.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Multi-Selection Logic
  const toggleSelectItem = (trackId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const isAllSelected =
    unplayableTracks.length > 0 && unplayableTracks.every((t) => selectedItemIds.has(t.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(unplayableTracks.map((t) => t.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  // Open Batch Delete
  const handleOpenBatchDeleteSelected = () => {
    const selected = unplayableTracks.filter((t) => selectedItemIds.has(t.id));
    if (selected.length === 0) return;
    setBatchDeleteItems(selected);
    setIsBatchDeleteModalOpen(true);
  };

  const handleOpenDeleteAll = () => {
    if (unplayableTracks.length === 0) return;
    setBatchDeleteItems(unplayableTracks);
    setIsBatchDeleteModalOpen(true);
  };

  // Execute Batch Deletion in Real Time
  const handleConfirmBatchDelete = () => {
    if (batchDeleteItems.length === 0) return;
    setIsBatchDeleting(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const res = UnplayableAudioDetectionService.batchDeleteUnplayableTracks(
      batchDeleteItems,
      adminActor,
      `Purged ${batchDeleteItems.length} unplayable songs with dead/missing audio sources in real time`
    );

    if (activeTestItem && batchDeleteItems.some((t) => t.id === activeTestItem.id)) {
      audioRef.current?.pause();
      setActiveTestItem(null);
      setIsAudioPlaying(false);
    }

    setSelectedItemIds(new Set());
    setIsBatchDeleting(false);
    setIsBatchDeleteModalOpen(false);
    setBatchDeleteItems([]);

    setFeedbackMessage({
      type: 'success',
      text: `Successfully purged ${res.deletedCount} unplayable song(s) from the platform in real time! Safely stored in 45-day Recovery Vault.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  // Execute Single Item Deletion
  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    setIsDeletingSingle(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const success = UnplayableAudioDetectionService.deleteUnplayableTrack(
      itemToDelete.id,
      adminActor,
      `Purged unplayable track "${itemToDelete.title}" (${itemToDelete.id}) — ${itemToDelete.reasonTitle}`
    );

    if (success) {
      if (activeTestItem?.id === itemToDelete.id) {
        audioRef.current?.pause();
        setActiveTestItem(null);
        setIsAudioPlaying(false);
      }
      setFeedbackMessage({
        type: 'success',
        text: `Successfully purged unplayable song "${itemToDelete.title}". Moved to 45-day Recovery Vault.`,
      });
      runScan();
    } else {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to delete unplayable song. Please verify administrator permissions.`,
      });
    }

    setIsDeletingSingle(false);
    setItemToDelete(null);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Filter unplayable tracks
  const filteredTracks = useMemo(() => {
    return unplayableTracks
      .filter((t) => activeFilter === 'all' || t.reasonCode === activeFilter)
      .filter((t) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.artistName.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          (t.audioUrl && t.audioUrl.toLowerCase().includes(q))
        );
      });
  }, [unplayableTracks, activeFilter, searchQuery]);

  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getReasonBadge = (code: UnplayableReasonCode) => {
    switch (code) {
      case 'SERVER_404_NOT_FOUND':
        return {
          label: '404 File Missing',
          color: 'bg-red-500/20 text-red-300 border-red-500/40',
        };
      case 'MISSING_AUDIO_URL':
        return {
          label: 'Missing Audio URL',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'LOCAL_BLOB_UNSTREAMABLE':
        return {
          label: 'Local Blob (Non-Streamable)',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'INDEXEDDB_UNSTREAMABLE':
        return {
          label: 'Client IndexedDB Only',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        };
      case 'PLAYBACK_MEDIA_ERROR':
        return {
          label: 'Playback Failure Logged',
          color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        };
      case 'CROSS_ARTIST_MISMATCH':
        return {
          label: 'Cross-Artist Collision',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden HTML5 Audio Element for Test Playback */}
      {activeTestItem && (
        <audio
          ref={audioRef}
          src={activeTestItem.audioUrl}
          preload="auto"
          onEnded={() => setIsAudioPlaying(false)}
        />
      )}

      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-red-500/40 bg-gradient-to-r from-[#240c1e]/95 via-[#14081c]/90 to-[#08080c]/95 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-red-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Unplayable Music & Dead Streams Detector
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Real-Time Health Engine Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Detect & Purge Unplayable Songs Across Platform
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Detect every track that visitors and mobile users are unable to play—including 404 missing files, client-only blobs, and broken sources.
              Listen to and confirm whether songs are playing in real time before deleting. Select individual tracks or purge them all at once.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onNavigateToDuplicates && (
              <button
                onClick={onNavigateToDuplicates}
                className="px-4 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 text-amber-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95"
                title="Switch to Duplicate Detective"
              >
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Duplicate Detective</span>
              </button>
            )}

            <button
              onClick={runScan}
              disabled={isScanning}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-600 hover:scale-105 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Audio Streams...' : 'Re-Scan Catalog Now'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Unplayable Songs</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-red-400">{stats.totalUnplayable}</span>
              <span className="text-[10px] text-neutral-500 font-mono">broken</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">404 File Missing</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-rose-400">{stats.server404Count}</span>
              <span className="text-[10px] text-neutral-500 font-mono">missing</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Missing Audio URL</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-amber-300">{stats.missingAudioCount}</span>
              <span className="text-[10px] text-neutral-500 font-mono">empty</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Client-Only Blobs</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-orange-400">{stats.localBlobCount}</span>
              <span className="text-[10px] text-neutral-500 font-mono">local</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Playback Errors</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-yellow-300">{stats.playbackErrorCount}</span>
              <span className="text-[10px] text-neutral-500 font-mono">logged</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Catalog Playable Score</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-400">{stats.catalogHealthScore}%</span>
              <span className="text-[10px] text-emerald-500 font-mono">healthy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Remediation Command Hub (when unplayable songs exist) */}
      {unplayableTracks.length > 0 && (
        <div className="rounded-3xl glass-panel border border-red-500/50 bg-gradient-to-r from-red-950/70 via-[#1e0a24]/90 to-black/80 p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-300 shrink-0 shadow-lg shadow-red-500/10">
              <ListChecks className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">Batch Unplayable Song Removal</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black border border-red-500/30 uppercase tracking-wider">
                  {unplayableTracks.length} Broken Tracks Detected
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Select all unplayable songs with 1 click and purge them all at once. All purged records are archived in the 45-day Recovery Vault.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Select / Deselect All */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                isAllSelected
                  ? 'bg-red-500 text-white font-black shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-white" />
              ) : (
                <Square className="w-4 h-4 text-neutral-400" />
              )}
              <span>
                {isAllSelected
                  ? `Deselect All (${unplayableTracks.length})`
                  : `Select All Unplayable Songs (${unplayableTracks.length})`}
              </span>
            </button>

            {/* Delete All Unplayable Songs at Once */}
            <button
              type="button"
              onClick={handleOpenDeleteAll}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-red-600/30 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Unplayable Songs at Once</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Selected Items Action Bar */}
      {selectedItemIds.size > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-black/90 border border-red-500/60 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/25 border border-red-500/50 flex items-center justify-center text-red-300 shrink-0">
              <CheckSquare className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedItemIds.size} Unplayable Song{selectedItemIds.size === 1 ? '' : 's'} Selected</span>
                <span className="px-2 py-0.2 rounded-full bg-red-500/30 text-red-200 text-[10px] font-mono border border-red-500/40">
                  Ready for Real-Time Purge
                </span>
              </p>
              <p className="text-[11px] text-neutral-300">
                Purging removes these broken entries from user streams; preserved in 45-day Recovery Vault.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleOpenBatchDeleteSelected}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedItemIds.size}) at Once</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : feedbackMessage.type === 'error'
              ? 'bg-red-500/15 border-red-500/40 text-red-200'
              : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Navigation Bar */}
      <div className="rounded-2xl glass-panel border border-white/10 bg-[#0c0a17]/95 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all' as const, label: 'All Broken Songs', count: unplayableTracks.length, icon: Layers },
            { id: 'SERVER_404_NOT_FOUND' as const, label: '404 File Missing', count: stats.server404Count, icon: FileWarning },
            { id: 'MISSING_AUDIO_URL' as const, label: 'Missing URL', count: stats.missingAudioCount, icon: AlertTriangle },
            { id: 'LOCAL_BLOB_UNSTREAMABLE' as const, label: 'Client Blob Only', count: stats.localBlobCount, icon: Radio },
            { id: 'PLAYBACK_MEDIA_ERROR' as const, label: 'Playback Errors', count: stats.playbackErrorCount, icon: VolumeX },
            { id: 'CROSS_ARTIST_MISMATCH' as const, label: 'Cross-Artist Collisions', count: stats.crossArtistMismatchCount, icon: Music },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-red-500 text-white shadow-lg font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-black/30 text-white font-black' : 'bg-white/10 text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[240px] sm:min-w-[320px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search broken tracks by title, artist, ID, or URL..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-black/60 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Unplayable Songs List */}
      <div className="space-y-3">
        {filteredTracks.length === 0 ? (
          <div className="rounded-3xl glass-panel border border-white/10 bg-black/60 p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white">Zero Unplayable Songs Found</h3>
              <p className="text-xs sm:text-sm text-neutral-400">
                {searchQuery || activeFilter !== 'all'
                  ? 'No unplayable songs match your current filter and search query.'
                  : 'All songs across the entire catalog have verified audio streams and are 100% playable for all platform visitors.'}
              </p>
            </div>
            {(searchQuery || activeFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTracks.map((track) => {
              const isSelected = selectedItemIds.has(track.id);
              const isTestingThis = activeTestItem?.id === track.id;
              const badge = getReasonBadge(track.reasonCode);

              return (
                <div
                  key={track.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3 relative ${
                    isSelected
                      ? 'bg-red-950/35 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/80'
                      : isTestingThis && isAudioPlaying
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'bg-black/60 border-white/10 hover:border-red-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Cover + Meta + Checkbox */}
                    <div className="flex items-start gap-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 shadow-md">
                        {track.coverUrl ? (
                          <Image
                            src={track.coverUrl}
                            alt={track.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Music className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${badge.color}`}
                          >
                            {badge.label}
                          </span>

                          {/* Multi-Select Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(track.id)}
                            className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                              isSelected
                                ? 'bg-red-500/30 border-red-500 text-red-200 shadow-sm'
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-neutral-400 hover:text-white'
                            }`}
                            title={isSelected ? 'Deselect song' : 'Select song for batch removal'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                            <span>{isSelected ? 'Selected' : 'Select'}</span>
                          </button>
                        </div>

                        <h3 className="text-sm font-bold text-white truncate" title={track.title}>
                          {track.title}
                        </h3>

                        <p className="text-xs text-neutral-400 truncate" title={track.artistName}>
                          {track.artistName}
                        </p>

                        <p className="text-[10px] text-neutral-500 font-mono truncate" title={track.id}>
                          ID: {track.id}
                        </p>
                      </div>
                    </div>

                    {/* Diagnostic Info Box */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 text-[11px]">
                      <p className="text-red-300 font-medium leading-tight">
                        {track.reasonDescription}
                      </p>
                      {track.audioUrl ? (
                        <p className="text-neutral-500 font-mono text-[10px] truncate" title={track.audioUrl}>
                          Source: {track.audioUrl}
                        </p>
                      ) : (
                        <p className="text-neutral-500 font-mono text-[10px] italic">
                          Source: None (Empty Audio URL)
                        </p>
                      )}
                    </div>

                    {/* Live Test Playback Status Indicator */}
                    {isTestingThis && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs font-mono space-y-1.5 animate-in fade-in ${
                          testPlayStatus === 'playing'
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                            : testPlayStatus === 'error'
                            ? 'bg-red-950/40 border-red-500/50 text-red-200'
                            : 'bg-white/5 border-white/10 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            {testPlayStatus === 'playing' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span>Audible & Playing!</span>
                              </>
                            ) : testPlayStatus === 'error' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                <span>Confirmed Broken / 404</span>
                              </>
                            ) : (
                              <span>Testing audio stream...</span>
                            )}
                          </span>

                          {testPlayStatus === 'playing' && (
                            <button
                              type="button"
                              onClick={() => handleMarkConfirmedPlayable(track.id)}
                              className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                              title="Admin confirms this song plays correctly; mark as verified playable"
                            >
                              Confirm Working
                            </button>
                          )}
                        </div>

                        {testPlayErrorMessage && (
                          <p className="text-[10px] text-red-400 break-words font-normal">
                            {testPlayErrorMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Row: Test Play / Confirm Audio vs Delete */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestPlay(track)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                        isTestingThis && isAudioPlaying
                          ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.6)] animate-pulse'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                      }`}
                      title={isTestingThis && isAudioPlaying ? 'Pause Test Playback' : 'Test Play Stream to Confirm if Song Plays'}
                    >
                      {isTestingThis && isAudioPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Testing (Playing)</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                          <span>Test Play (Confirm)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(track)}
                      className="p-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all cursor-pointer shadow-sm"
                      title={`Delete unplayable song "${track.title}" in real time`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Interactive Live Audio Test Deck Bar */}
      {activeTestItem && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-8 sm:right-8 lg:left-72 z-50 rounded-2xl glass-panel border border-red-500/50 bg-[#120818]/95 backdrop-blur-2xl p-3.5 sm:p-4 shadow-[0_10px_40px_rgba(0,0,0,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black border border-white/20 shrink-0">
              {activeTestItem.coverUrl ? (
                <Image
                  src={activeTestItem.coverUrl}
                  alt={activeTestItem.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <Music className="w-6 h-6 m-auto text-brand-gold" />
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.2 rounded-full border text-[9px] font-black uppercase ${
                    testPlayStatus === 'playing'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : testPlayStatus === 'error'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                  }`}
                >
                  {testPlayStatus === 'playing'
                    ? 'Audible & Playing'
                    : testPlayStatus === 'error'
                    ? 'Unplayable / 404 Error'
                    : 'Probing Stream'}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono truncate">{activeTestItem.id}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">{activeTestItem.title}</h4>
              <p className="text-[11px] text-neutral-400 truncate">{activeTestItem.artistName}</p>
            </div>
          </div>

          {/* Time Scrubber & Controls */}
          <div className="flex-1 max-w-xl flex items-center gap-3">
            <button
              onClick={() => {
                if (isAudioPlaying) {
                  audioRef.current?.pause();
                  setIsAudioPlaying(false);
                } else {
                  audioRef.current?.play().catch((err) => {
                    setTestPlayStatus('error');
                    setTestPlayErrorMessage(err?.message || 'Playback blocked or failed');
                  });
                }
              }}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isAudioPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <span className="text-[10px] font-mono text-neutral-400 shrink-0">{formatTime(audioCurrentTime)}</span>

            <div
              onClick={handleSeekAudio}
              className="flex-1 h-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer relative overflow-hidden"
            >
              <div
                className={`h-full rounded-full ${
                  testPlayStatus === 'playing'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-red-500 to-rose-400'
                }`}
                style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
              />
            </div>

            <span className="text-[10px] font-mono text-neutral-400 shrink-0">{formatTime(audioDuration)}</span>

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white shrink-0"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                audioRef.current?.pause();
                setActiveTestItem(null);
                setIsAudioPlaying(false);
                setTestPlayStatus('idle');
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white shrink-0"
              title="Close Test Deck"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Single Item Deletion Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/40 bg-gradient-to-b from-[#1a0a1a] to-[#0c050c] shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                Confirm Real-Time Deletion
              </span>
              <h3 className="text-lg font-bold text-white">Delete Unplayable Song?</h3>
              <p className="text-xs text-neutral-300">
                Are you sure you want to delete <strong className="text-white">"{itemToDelete.title}"</strong> ({itemToDelete.id})?
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] text-neutral-400 space-y-1 font-mono">
              <p>Artist: <span className="text-white">{itemToDelete.artistName}</span></p>
              <p>Issue: <span className="text-red-400">{itemToDelete.reasonTitle}</span></p>
              <p className="truncate">Source: <span className="text-neutral-500">{itemToDelete.audioUrl || 'None'}</span></p>
              <p className="text-emerald-400 text-[10px] pt-1">
                Safeguard: Preserved in 45-day Recovery Vault for safe restoration.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isDeletingSingle}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:scale-105 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingSingle ? 'Deleting...' : 'Delete in Real Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Deletion Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl glass-panel border border-red-500/50 bg-gradient-to-b from-[#1c0a1a] via-[#120512] to-[#0a030a] shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-3xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto shadow-2xl">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                Batch Real-Time Deletion
              </span>
              <h3 className="text-xl font-black text-white tracking-tight">
                Delete All {batchDeleteItems.length} Unplayable Songs?
              </h3>
              <p className="text-xs text-neutral-300 max-w-sm mx-auto">
                You are about to permanently purge <strong className="text-white">{batchDeleteItems.length} unplayable song{batchDeleteItems.length === 1 ? '' : 's'}</strong> with broken or missing audio streams simultaneously.
              </p>
            </div>

            {/* List of items being deleted */}
            <div className="rounded-2xl bg-black/60 border border-white/10 p-3 max-h-56 overflow-y-auto space-y-2 no-scrollbar">
              {batchDeleteItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-neutral-500 font-mono text-[10px] w-5 text-right">{idx + 1}.</span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{item.artistName} • {item.reasonTitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-red-400 shrink-0 uppercase px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                    Purging
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>45-Day Recovery Vault Active</span>
              </p>
              <p className="text-neutral-300 text-[10px] pl-5.5">
                Every deleted song is safely archived in the 45-day Recovery Vault and can be restored at any time.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBatchDeleteModalOpen(false);
                  setBatchDeleteItems([]);
                }}
                disabled={isBatchDeleting}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={isBatchDeleting}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:scale-105 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-red-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBatchDeleting ? 'Purging in Real Time...' : `Confirm & Delete All (${batchDeleteItems.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
