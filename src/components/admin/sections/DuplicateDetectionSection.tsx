'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  CopyCheck,
  Music,
  BookOpen,
  Video,
  FileText,
  Trash2,
  Play,
  Pause,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Clock,
  Layers,
  Check,
  X,
  Download,
  Star,
  CheckSquare,
  Square,
  ListChecks,
  BookmarkCheck,
  Bookmark,
  ShieldCheck,
  Undo2,
  Tag,
} from 'lucide-react';
import {
  DuplicateDetectionService,
  DuplicateGroup,
  DuplicateItemRecord,
  DuplicateMediaType,
  DuplicateStats,
  VariantType,
  KeptDuplicateRecord,
  detectVariantType,
  getVariantTypeBadge,
} from '@/lib/admin/DuplicateDetectionService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AdminRole } from '@/types/admin';

export interface DuplicateDetectionSectionProps {
  onNavigateToUnplayable?: () => void;
}

export const DuplicateDetectionSection: React.FC<DuplicateDetectionSectionProps> = ({
  onNavigateToUnplayable,
}) => {
  const { profile } = useAuth();

  // State
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [keptDuplicates, setKeptDuplicates] = useState<KeptDuplicateRecord[]>([]);
  const [stats, setStats] = useState<DuplicateStats>({
    totalClusters: 0,
    totalDuplicateItems: 0,
    songClusters: 0,
    audiobookClusters: 0,
    bookClusters: 0,
    videoClusters: 0,
    totalKeptVariants: 0,
    cleanScorePercentage: 100,
  });
  const [activeFilter, setActiveFilter] = useState<'all' | DuplicateMediaType | 'kept'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Multi-Selection State for Batch Operations (Keep or Delete)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteItems, setBatchDeleteItems] = useState<DuplicateItemRecord[]>([]);

  // Keep Duplicates (Remixes & Demos) Modal State
  const [isKeepModalOpen, setIsKeepModalOpen] = useState(false);
  const [keepModalItems, setKeepModalItems] = useState<
    { item: DuplicateItemRecord; variantType: VariantType; reason: string }[]
  >([]);
  const [isSavingKeep, setIsSavingKeep] = useState(false);

  // Active Audition State (Listen)
  const [activeAuditionItem, setActiveAuditionItem] = useState<DuplicateItemRecord | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Active Video Modal State (Watch)
  const [activeWatchItem, setActiveWatchItem] = useState<DuplicateItemRecord | null>(null);

  // Active Book / PDF Reader Modal State (Read)
  const [activeReadItem, setActiveReadItem] = useState<DuplicateItemRecord | null>(null);

  // Deletion Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<{
    item: DuplicateItemRecord;
    group: DuplicateGroup;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync / Scan duplicates
  const runScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const groups = DuplicateDetectionService.scanAllDuplicates();
      const currentStats = DuplicateDetectionService.getStats();
      const kept = DuplicateDetectionService.getKeptDuplicates();
      setDuplicateGroups(groups);
      setStats(currentStats);
      setKeptDuplicates(kept);
      setIsScanning(false);
    }, 250);
  };

  useEffect(() => {
    runScan();
    const unsub = DuplicateDetectionService.subscribe(() => {
      runScan();
    });
    return () => unsub();
  }, []);

  // HTML5 Audio playback control for live audition
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const handleDurationChange = () => setAudioDuration(audio.duration || 0);
    const handleEnded = () => setIsAudioPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [activeAuditionItem]);

  const handleListen = (item: DuplicateItemRecord) => {
    if (activeAuditionItem?.id === item.id) {
      if (isAudioPlaying) {
        audioRef.current?.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current?.play().catch(() => {});
        setIsAudioPlaying(true);
      }
      return;
    }

    setActiveAuditionItem(item);
    setIsAudioPlaying(true);
    setAudioCurrentTime(0);

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          console.warn('[DuplicateDetectionSection] Audition play interrupted:', err);
        });
      }
    }, 50);
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

  // Perform Real-Time Deletion
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const success = DuplicateDetectionService.deleteDuplicateItem(
      itemToDelete.item,
      adminActor,
      `Purged duplicate ${itemToDelete.item.mediaType} "${itemToDelete.item.title}" (${itemToDelete.item.id})`
    );

    if (success) {
      // If we are currently auditioning this deleted item, stop it
      if (activeAuditionItem?.id === itemToDelete.item.id) {
        audioRef.current?.pause();
        setActiveAuditionItem(null);
        setIsAudioPlaying(false);
      }
      setFeedbackMessage({
        type: 'success',
        text: `Successfully deleted duplicate ${itemToDelete.item.mediaType} "${itemToDelete.item.title}". Moved to 45-day Recovery Vault.`,
      });
      runScan();
    } else {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to delete duplicate item. Please verify administrator permissions.`,
      });
    }

    setIsDeleting(false);
    setItemToDelete(null);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Perform "Keep This & Delete Others"
  const handleKeepOneAndDeleteOthers = (group: DuplicateGroup, keepItem: DuplicateItemRecord) => {
    const countToDelete = group.items.length - 1;
    if (
      !confirm(
        `Are you sure you want to KEEP "${keepItem.title}" (${keepItem.id}) and PERMANENTLY DELETE all other ${countToDelete} duplicate copy/copies from the live catalog?`
      )
    ) {
      return;
    }

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const res = DuplicateDetectionService.keepItemAndDeleteOthers(group, keepItem.id, adminActor);
    setFeedbackMessage({
      type: 'success',
      text: `Retained primary master "${keepItem.title}" and purged ${res.deletedCount} redundant duplicate(s) from platform.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Collect all redundant duplicate songs across all groups (excluding primary/keep masters)
  const allDuplicateSongItems = useMemo(() => {
    return duplicateGroups
      .filter((g) => g.mediaType === 'song')
      .flatMap((g) => g.items.filter((i) => !i.isRecommendedKeep && i.id !== g.recommendedKeepId));
  }, [duplicateGroups]);

  const isAllDuplicateSongsSelected =
    allDuplicateSongItems.length > 0 &&
    allDuplicateSongItems.every((item) => selectedItemIds.has(item.id));

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAllDuplicateSongs = () => {
    if (isAllDuplicateSongsSelected) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        allDuplicateSongItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        allDuplicateSongItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  const handleSelectClusterDuplicates = (group: DuplicateGroup) => {
    const redundantItems = group.items.filter((i) => !i.isRecommendedKeep && i.id !== group.recommendedKeepId);
    const allInGroupSelected = redundantItems.length > 0 && redundantItems.every((i) => selectedItemIds.has(i.id));

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) {
        redundantItems.forEach((i) => next.delete(i.id));
      } else {
        redundantItems.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  const handleOpenBatchDeleteSelected = () => {
    const itemsToDelete = duplicateGroups
      .flatMap((g) => g.items)
      .filter((item) => selectedItemIds.has(item.id));
    if (itemsToDelete.length === 0) return;
    setBatchDeleteItems(itemsToDelete);
    setIsBatchDeleteModalOpen(true);
  };

  const handleOpenDeleteAllDuplicateSongs = () => {
    if (allDuplicateSongItems.length === 0) return;
    setBatchDeleteItems(allDuplicateSongItems);
    setIsBatchDeleteModalOpen(true);
  };

  const handleConfirmBatchDelete = () => {
    if (batchDeleteItems.length === 0) return;
    setIsBatchDeleting(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const res = DuplicateDetectionService.batchDeleteDuplicateItems(
      batchDeleteItems,
      adminActor,
      `Batch catalog deduplication: purged ${batchDeleteItems.length} duplicate songs in real time (retained primary masters)`
    );

    // If currently auditioning any deleted track, halt playback immediately
    if (activeAuditionItem && batchDeleteItems.some((i) => i.id === activeAuditionItem.id)) {
      audioRef.current?.pause();
      setActiveAuditionItem(null);
      setIsAudioPlaying(false);
    }

    setSelectedItemIds(new Set());
    setIsBatchDeleting(false);
    setIsBatchDeleteModalOpen(false);
    setBatchDeleteItems([]);

    setFeedbackMessage({
      type: 'success',
      text: `Successfully deleted all ${res.deletedCount} duplicate songs in real time! Master recordings remain safe and active.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  // Collect all detected remixes & demos among candidate duplicate items
  const allDetectedVariantItems = useMemo(() => {
    return duplicateGroups
      .flatMap((g) => g.items)
      .filter((i) => detectVariantType(i.title, i.secondaryText) !== 'master_variant');
  }, [duplicateGroups]);

  // Open Keep Modal for a single item
  const handleOpenSingleKeep = (item: DuplicateItemRecord) => {
    const vType = detectVariantType(item.title, item.secondaryText);
    setKeepModalItems([
      {
        item,
        variantType: vType,
        reason: `Authentic ${vType} version "${item.title}"`,
      },
    ]);
    setIsKeepModalOpen(true);
  };

  // Open Keep Modal for selected items
  const handleOpenBatchKeepSelected = () => {
    const items = duplicateGroups
      .flatMap((g) => g.items)
      .filter((item) => selectedItemIds.has(item.id));
    if (items.length === 0) return;

    setKeepModalItems(
      items.map((it) => {
        const vType = detectVariantType(it.title, it.secondaryText);
        return {
          item: it,
          variantType: vType,
          reason: `Authentic ${vType} version "${it.title}"`,
        };
      })
    );
    setIsKeepModalOpen(true);
  };

  // Auto-keep all detected remixes and demos
  const handleAutoKeepAllRemixesDemos = () => {
    if (allDetectedVariantItems.length === 0) {
      setFeedbackMessage({
        type: 'info',
        text: 'No unkept Remix or Demo variants detected in the current duplicate clusters.',
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    let count = 0;
    for (const it of allDetectedVariantItems) {
      const vType = detectVariantType(it.title, it.secondaryText);
      const ok = DuplicateDetectionService.keepDuplicateItem(
        it,
        vType,
        adminActor,
        `Auto-detected authentic ${vType} version "${it.title}"`
      );
      if (ok) count++;
    }

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      allDetectedVariantItems.forEach((it) => next.delete(it.id));
      return next;
    });

    setFeedbackMessage({
      type: 'success',
      text: `Successfully kept ${count} authentic Remix and Demo versions! They have been exempted from duplicate removal.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  // Keep all versions in a cluster
  const handleKeepCluster = (group: DuplicateGroup) => {
    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const res = DuplicateDetectionService.keepClusterDuplicates(group, adminActor);

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      group.items.forEach((it) => next.delete(it.id));
      return next;
    });

    setFeedbackMessage({
      type: 'success',
      text: `Kept all ${res.keptCount} versions in "${group.canonicalTitle}" as authentic master variants, remixes, or demos.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Confirm Keep Modal
  const handleConfirmKeepModal = () => {
    if (keepModalItems.length === 0) return;
    setIsSavingKeep(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    let keptCount = 0;
    for (const { item, variantType, reason } of keepModalItems) {
      const ok = DuplicateDetectionService.keepDuplicateItem(
        item,
        variantType,
        adminActor,
        reason || `Authentic ${variantType} version`
      );
      if (ok) keptCount++;
    }

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      keepModalItems.forEach(({ item }) => next.delete(item.id));
      return next;
    });

    setIsSavingKeep(false);
    setIsKeepModalOpen(false);
    setKeepModalItems([]);

    setFeedbackMessage({
      type: 'success',
      text: `Successfully saved ${keptCount} version(s) to platform! Marked as authentic Remixes / Demos and protected from deletion.`,
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 6000);
  };

  // Unkeep item (restore to scan)
  const handleUnkeepItem = (itemId: string, title: string) => {
    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    const ok = DuplicateDetectionService.unkeepDuplicateItem(itemId, adminActor);
    if (ok) {
      setFeedbackMessage({
        type: 'info',
        text: `Unmarked "${title}". Returned to candidate duplicate scanning.`,
      });
      runScan();
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // Clear all kept items
  const handleClearAllKept = () => {
    if (!confirm('Are you sure you want to clear ALL kept duplicate exemptions? All items will be re-evaluated in the next duplicate scan.')) {
      return;
    }

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: (profile?.role as AdminRole) || 'admin',
    };

    DuplicateDetectionService.clearAllKeptDuplicates(adminActor);
    setFeedbackMessage({
      type: 'info',
      text: 'All kept duplicate variant exemptions have been cleared.',
    });
    runScan();
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Filter groups
  const filteredGroups = duplicateGroups
    .filter((g) => activeFilter === 'all' || g.mediaType === activeFilter)
    .filter((g) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.canonicalTitle.toLowerCase().includes(q) ||
        g.canonicalCreator.toLowerCase().includes(q) ||
        g.items.some((i) => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      );
    });

  // Filter kept duplicates
  const filteredKeptDuplicates = useMemo(() => {
    return keptDuplicates.filter((k) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        k.title.toLowerCase().includes(q) ||
        k.creator.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q) ||
        (k.variantType && k.variantType.toLowerCase().includes(q)) ||
        (k.reason && k.reason.toLowerCase().includes(q))
      );
    });
  }, [keptDuplicates, searchQuery]);

  const handleListenKept = (item: KeptDuplicateRecord) => {
    handleListen({
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      creator: item.creator,
      secondaryText: item.secondaryText || item.albumTitle,
      coverUrl: item.coverUrl,
      mediaUrl: item.mediaUrl,
      duration: item.duration,
      playCountOrViews: item.playCountOrViews,
      isRecommendedKeep: true,
      rawItem: (item.rawItem || {}) as any,
    });
  };

  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getMediaBadge = (type: DuplicateMediaType) => {
    switch (type) {
      case 'song':
        return {
          label: 'Song Duplicate',
          icon: Music,
          badgeColor: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
        };
      case 'audiobook':
        return {
          label: 'Audiobook Duplicate',
          icon: BookOpen,
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
      case 'book':
        return {
          label: 'PDF Book Duplicate',
          icon: FileText,
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'video':
        return {
          label: 'Video Duplicate',
          icon: Video,
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden HTML5 Audio Element for Audition Player */}
      {activeAuditionItem && (
        <audio
          ref={audioRef}
          src={activeAuditionItem.mediaUrl}
          preload="auto"
          onEnded={() => setIsAudioPlaying(false)}
        />
      )}

      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-brand-gold/30 bg-gradient-to-r from-[#180e29]/95 via-[#0d0918]/90 to-[#08080c]/95 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-brand-gold/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/40 text-xs font-black uppercase tracking-wider">
                <CopyCheck className="w-4 h-4 text-brand-gold" />
                Autonomous Catalog Deduplication
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Real-Time Sync Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Catalog Duplicate Detective & Real-Time Remediation
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Detect and eliminate redundant copies of songs, audiobooks, PDF literature, and 4K videos across the platform.
              Listen to songs, read books, watch videos in real time, and purge duplicates permanently with 1-click safeguards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onNavigateToUnplayable && (
              <button
                onClick={onNavigateToUnplayable}
                className="px-4 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20 hover:scale-105 active:scale-95"
                title="Switch to Unplayable Songs Detective"
              >
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span>Unplayable Songs</span>
              </button>
            )}

            <button
              onClick={runScan}
              disabled={isScanning}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-gold via-amber-400 to-amber-600 hover:scale-105 active:scale-95 text-black font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(245,195,68,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Catalog...' : 'Re-Scan Catalog Now'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-6 mt-6 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Duplicate Clusters</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-brand-gold">{stats.totalClusters}</span>
              <span className="text-[10px] text-neutral-500 font-mono">groups</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Total Duplicate Items</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-red-400">{stats.totalDuplicateItems}</span>
              <span className="text-[10px] text-neutral-500 font-mono">records</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Song Clusters</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-amber-300">{stats.songClusters}</span>
              <span className="text-[10px] text-neutral-500 font-mono">music</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Audiobook Clusters</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-purple-300">{stats.audiobookClusters}</span>
              <span className="text-[10px] text-neutral-500 font-mono">spoken</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Book Clusters</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-rose-300">{stats.bookClusters}</span>
              <span className="text-[10px] text-neutral-500 font-mono">PDFs</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/25">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Kept (Remixes/Demos)</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-300">{stats.totalKeptVariants}</span>
              <span className="text-[10px] text-emerald-500 font-mono">preserved</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Catalog Clean Score</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-400">{stats.cleanScorePercentage}%</span>
              <span className="text-[10px] text-emerald-500 font-mono">clean</span>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Duplicate Song Remediation Command Hub */}
      {allDuplicateSongItems.length > 0 && (
        <div className="rounded-3xl glass-panel border border-amber-500/40 bg-gradient-to-r from-red-950/60 via-[#1a0f28]/90 to-black/80 p-5 sm:p-6 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-lg shadow-amber-500/10">
              <ListChecks className="w-6 h-6 text-brand-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">Batch Duplicate Song Remediation</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black border border-red-500/30 uppercase tracking-wider">
                  {allDuplicateSongItems.length} Redundant Duplicate Songs
                </span>
                {allDetectedVariantItems.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>{allDetectedVariantItems.length} Detected Remixes/Demos</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Select duplicates to keep as authentic Remixes & Demos, or purge redundant copies in real time. Primary master tracks remain active and safe.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Auto-Keep All Detected Remixes & Demos */}
            {allDetectedVariantItems.length > 0 && (
              <button
                type="button"
                onClick={handleAutoKeepAllRemixesDemos}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 hover:scale-105 active:scale-95"
                title="Automatically keep all detected remix and demo versions on platform"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>Auto-Keep ({allDetectedVariantItems.length}) Remixes/Demos</span>
              </button>
            )}

            {/* Keep Selected Button (if items are checked) */}
            {selectedItemIds.size > 0 && (
              <button
                type="button"
                onClick={handleOpenBatchKeepSelected}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                <span>Keep Selected ({selectedItemIds.size})</span>
              </button>
            )}

            {/* Select / Deselect All Duplicate Songs */}
            <button
              type="button"
              onClick={handleSelectAllDuplicateSongs}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                isAllDuplicateSongsSelected
                  ? 'bg-amber-400 text-black font-black shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
            >
              {isAllDuplicateSongsSelected ? (
                <CheckSquare className="w-4 h-4 text-black" />
              ) : (
                <Square className="w-4 h-4 text-neutral-400" />
              )}
              <span>
                {isAllDuplicateSongsSelected
                  ? `Deselect All (${allDuplicateSongItems.length})`
                  : `Select All (${allDuplicateSongItems.length})`}
              </span>
            </button>

            {/* Delete All Duplicate Songs at Once */}
            <button
              type="button"
              onClick={handleOpenDeleteAllDuplicateSongs}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-red-600/30 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All Duplicate Songs</span>
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

      {/* Selected Items Floating Action Bar */}
      {selectedItemIds.size > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900/95 via-[#1a1426]/95 to-black/95 border border-brand-gold/50 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/25 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0">
              <CheckSquare className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedItemIds.size} Duplicate Item{selectedItemIds.size === 1 ? '' : 's'} Selected</span>
                <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-brand-gold text-[10px] font-mono border border-amber-500/30">
                  Ready for Action
                </span>
              </p>
              <p className="text-[11px] text-neutral-300">
                Choose to KEEP as authentic Remixes & Demos, or PURGE redundant copies from the platform.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleOpenBatchKeepSelected}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Keep Selected ({selectedItemIds.size}) as Remixes/Demos</span>
            </button>
            <button
              type="button"
              onClick={handleOpenBatchDeleteSelected}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedItemIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Navigation Bar */}
      <div className="rounded-2xl glass-panel border border-white/10 bg-[#0c0a17]/95 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all' as const, label: 'All Media', count: duplicateGroups.length, icon: Layers },
            { id: 'song' as const, label: 'Songs', count: stats.songClusters, icon: Music },
            { id: 'audiobook' as const, label: 'Audiobooks', count: stats.audiobookClusters, icon: BookOpen },
            { id: 'book' as const, label: 'Books', count: stats.bookClusters, icon: FileText },
            { id: 'video' as const, label: 'Videos', count: stats.videoClusters, icon: Video },
            { id: 'kept' as const, label: 'Kept Variants (Remixes & Demos)', count: stats.totalKeptVariants, icon: BookmarkCheck },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? tab.id === 'kept'
                      ? 'bg-emerald-500 text-black shadow-lg font-black'
                      : 'bg-brand-gold text-black shadow-lg font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-black/20 text-black font-black' : 'bg-white/10 text-neutral-400'
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
            placeholder="Search by title, artist, author, or ID..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-black/60 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-brand-gold/60 focus:ring-1 focus:ring-brand-gold/30 transition-all"
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

      {/* Duplicate Groups List or Kept Variants View */}
      <div className="space-y-4">
        {activeFilter === 'kept' ? (
          /* Kept Variants View */
          <div className="space-y-4">
            {/* Kept Header Banner */}
            <div className="rounded-3xl glass-panel border border-emerald-500/30 bg-[#07170e]/80 backdrop-blur-xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                  <BookmarkCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">Kept Authentic Variants</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      {filteredKeptDuplicates.length} Protected
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 max-w-2xl mt-0.5">
                    Authentic remixes, studio demos, extended cuts, and live recordings preserved on the platform. These items are excluded from duplicate scanning and protected from accidental deletion.
                  </p>
                </div>
              </div>

              {filteredKeptDuplicates.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllKept}
                  className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 hover:scale-105 active:scale-95"
                  title="Clear all kept exemptions and return them to candidate duplicate scanning"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear All Exemptions</span>
                </button>
              )}
            </div>

            {/* Kept Items Cards */}
            {filteredKeptDuplicates.length === 0 ? (
              <div className="rounded-3xl glass-panel border border-white/10 bg-black/60 p-12 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl">
                  <BookmarkCheck className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-white">No Kept Variants Yet</h3>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    {searchQuery
                      ? 'No kept variants match your search filter.'
                      : 'When you identify authentic remixes, demos, extended mixes, or live versions in candidate duplicate clusters, click "Keep Version" or "Keep Selected as Remixes/Demos". They will appear here safely protected.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  Return to Duplicate Scan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredKeptDuplicates.map((item) => {
                  const isCurrentlyAuditioning = activeAuditionItem?.id === item.id && isAudioPlaying;
                  const vBadge = getVariantTypeBadge(item.variantType);
                  const badge = getMediaBadge(item.mediaType);
                  const BadgeIcon = badge.icon;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl p-4 border border-emerald-500/30 bg-[#0d1612]/90 backdrop-blur-xl shadow-lg transition-all flex flex-col justify-between space-y-3 relative hover:border-emerald-500/50"
                    >
                      {/* Top: Cover + Titles */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-emerald-500/20 shrink-0 shadow-md">
                            {item.coverUrl ? (
                              <Image
                                src={item.coverUrl}
                                alt={item.title}
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-emerald-500">
                                <BadgeIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${vBadge.color}`}>
                                <Tag className="w-2.5 h-2.5" />
                                <span>{vBadge.label}</span>
                              </span>

                              <span className="text-[10px] text-emerald-400 font-mono">
                                Kept {new Date(item.keptAt).toLocaleDateString()}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-white truncate" title={item.title}>
                              {item.title}
                            </h3>

                            <p className="text-xs text-neutral-300 truncate" title={item.creator}>
                              {item.creator}
                            </p>

                            <p className="text-[10px] text-neutral-500 font-mono truncate" title={item.id}>
                              ID: {item.id}
                            </p>
                          </div>
                        </div>

                        {/* Note & Reason */}
                        <div className="p-2.5 rounded-xl bg-black/50 border border-emerald-500/20 space-y-1 text-[11px]">
                          {item.reason && (
                            <p className="text-emerald-300 font-medium text-xs flex items-center gap-1.5">
                              <Bookmark className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{item.reason}</span>
                            </p>
                          )}
                          {item.secondaryText && (
                            <p className="text-neutral-400 truncate text-[10px]">{item.secondaryText}</p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-0.5">
                            <span>Duration: {formatTime(item.duration)}</span>
                            <span>By: {item.keptBy || 'Admin'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        {/* Listen (for songs & audiobooks) */}
                        {(item.mediaType === 'song' || item.mediaType === 'audiobook') && (
                          <button
                            type="button"
                            onClick={() => handleListenKept(item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                              isCurrentlyAuditioning
                                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={isCurrentlyAuditioning ? 'Pause Audition' : 'Listen to Audio in Real Time'}
                          >
                            {isCurrentlyAuditioning ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Auditioning</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Watch (for videos) */}
                        {item.mediaType === 'video' && (
                          <button
                            type="button"
                            onClick={() => setActiveWatchItem(item as unknown as DuplicateItemRecord)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Watch Video Cinema in Real Time"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Watch</span>
                          </button>
                        )}

                        {/* Read (for books) */}
                        {item.mediaType === 'book' && (
                          <button
                            type="button"
                            onClick={() => setActiveReadItem(item as unknown as DuplicateItemRecord)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Read PDF Book in Real Time"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Read</span>
                          </button>
                        )}

                        {/* Unmark Button */}
                        <button
                          type="button"
                          onClick={() => handleUnkeepItem(item.id, item.title)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                          title="Unmark this item as kept. Returns to candidate duplicate scanning."
                        >
                          <Undo2 className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Unmark (Return to Scan)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-3xl glass-panel border border-white/10 bg-black/60 p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white">Zero Duplicate Clusters Found</h3>
              <p className="text-xs sm:text-sm text-neutral-400">
                {searchQuery || activeFilter !== 'all'
                  ? 'No duplicate clusters match your current category and search filter.'
                  : 'Your entire platform catalog is 100% unique and clean across songs, audiobooks, books, and videos.'}
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
          filteredGroups.map((group, groupIdx) => {
            const badge = getMediaBadge(group.mediaType);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={group.groupId}
                className="rounded-3xl glass-panel border border-brand-gold/30 bg-[#0d0a1a]/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-4 hover:border-brand-gold/50 transition-all"
              >
                {/* Cluster Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${badge.badgeColor}`}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>

                      <span className="text-[11px] font-mono text-neutral-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {group.matchReason}
                      </span>

                      <span className="text-[11px] font-mono text-red-300 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 font-bold">
                        {group.items.length} Duplicate Copies
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 pt-1">
                      <span>{group.canonicalTitle}</span>
                      <span className="text-neutral-500 font-normal">•</span>
                      <span className="text-brand-gold font-semibold text-base">{group.canonicalCreator}</span>
                    </h2>
                  </div>

                  {/* Cluster Quick Action: Keep Recommended & Delete Others */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {group.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleSelectClusterDuplicates(group)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          group.items
                            .filter((i) => !i.isRecommendedKeep && i.id !== group.recommendedKeepId)
                            .every((i) => selectedItemIds.has(i.id))
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                        }`}
                        title="Toggle selection for all redundant duplicate copies in this cluster"
                      >
                        {group.items
                          .filter((i) => !i.isRecommendedKeep && i.id !== group.recommendedKeepId)
                          .every((i) => selectedItemIds.has(i.id)) ? (
                          <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span>Select Group Duplicates ({group.items.length - 1})</span>
                      </button>
                    )}

                    {/* Keep All in Group as Authentic Remixes/Demos */}
                    <button
                      type="button"
                      onClick={() => handleKeepCluster(group)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                      title="Keep all versions in this cluster as authentic remixes, demos, or master variants without deleting anything"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Keep All in Group (Remixes/Demos)</span>
                    </button>

                    {group.recommendedKeepId && (
                      <button
                        onClick={() => {
                          const keepItem = group.items.find((i) => i.id === group.recommendedKeepId) || group.items[0];
                          handleKeepOneAndDeleteOthers(group, keepItem);
                        }}
                        className="px-4 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                        title="Keep the recommended master and purge all other redundant copies"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Keep Primary (Delete {group.items.length - 1} Others)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items in this duplicate group */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((item) => {
                    const isCurrentlyAuditioning = activeAuditionItem?.id === item.id && isAudioPlaying;
                    const isSelected = selectedItemIds.has(item.id);
                    const isRedundant = !item.isRecommendedKeep && item.id !== group.recommendedKeepId;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3 relative ${
                          item.isRecommendedKeep
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : isSelected
                            ? 'bg-red-950/30 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.3)] ring-2 ring-red-500/70'
                            : 'bg-black/60 border-white/10 hover:border-red-500/40'
                        }`}
                      >
                        {/* Item Card Top: Cover + Titles */}
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            {/* Cover Artwork or Icon */}
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 shadow-md">
                              {item.coverUrl ? (
                                <Image
                                  src={item.coverUrl}
                                  alt={item.title}
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                  <BadgeIcon className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            {/* Item Meta */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.isRecommendedKeep ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                      <Star className="w-2.5 h-2.5 fill-current text-emerald-400" />
                                      <span>Primary / Keep</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                      <span>Duplicate Copy</span>
                                    </span>
                                  )}

                                  {detectVariantType(item.title, item.secondaryText) !== 'master_variant' && (
                                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${getVariantTypeBadge(detectVariantType(item.title, item.secondaryText)).color}`}>
                                      <Tag className="w-2.5 h-2.5" />
                                      <span>{getVariantTypeBadge(detectVariantType(item.title, item.secondaryText)).label}</span>
                                    </span>
                                  )}
                                </div>

                                {isRedundant && (
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectItem(item.id)}
                                    className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                                      isSelected
                                        ? 'bg-red-500/30 border-red-500 text-red-200 shadow-sm'
                                        : 'bg-white/5 border-white/10 hover:border-white/30 text-neutral-400 hover:text-white'
                                    }`}
                                    title={isSelected ? 'Deselect duplicate song' : 'Select duplicate song for batch deletion'}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-neutral-500" />
                                    )}
                                    <span>{isSelected ? 'Selected' : 'Select'}</span>
                                  </button>
                                )}
                              </div>

                              <h3 className="text-sm font-bold text-white truncate" title={item.title}>
                                {item.title}
                              </h3>

                              <p className="text-xs text-neutral-400 truncate" title={item.creator}>
                                {item.creator}
                              </p>

                              <p className="text-[10px] text-neutral-500 font-mono truncate" title={item.id}>
                                ID: {item.id}
                              </p>
                            </div>
                          </div>

                          {/* Secondary Metadata Info Box */}
                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1 text-[11px]">
                            {item.secondaryText && (
                              <p className="text-neutral-300 truncate font-medium">{item.secondaryText}</p>
                            )}
                            {item.fileDetails && (
                              <p className="text-neutral-400 font-mono text-[10px] truncate" title={item.fileDetails}>
                                {item.fileDetails}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-0.5">
                              <span>Duration: {formatTime(item.duration)}</span>
                              <span>Streams: {(item.playCountOrViews || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Real-Time Actions: Listen / Read / Watch / Delete */}
                        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* Action 1: Listen (for songs & audiobooks) */}
                            {(item.mediaType === 'song' || item.mediaType === 'audiobook') && (
                              <button
                                onClick={() => handleListen(item)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                  isCurrentlyAuditioning
                                    ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                }`}
                                title={isCurrentlyAuditioning ? 'Pause Audition' : 'Listen to Audio in Real Time'}
                              >
                                {isCurrentlyAuditioning ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                    <span>Auditioning</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                                    <span>Listen</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Action 2: Read (for PDF Books) */}
                            {item.mediaType === 'book' && (
                              <button
                                onClick={() => setActiveReadItem(item)}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Read PDF Book in Real Time"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Read</span>
                              </button>
                            )}

                            {/* Action 3: Watch (for Videos) */}
                            {item.mediaType === 'video' && (
                              <button
                                onClick={() => setActiveWatchItem(item)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Watch Video Cinema in Real Time"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Watch</span>
                              </button>
                            )}

                            {/* Action 4: Keep Duplicate Version as Remix/Demo */}
                            <button
                              type="button"
                              onClick={() => handleOpenSingleKeep(item)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                              title="Keep this duplicate on platform as a legitimate Remix, Demo, or Variant"
                            >
                              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Keep Version</span>
                            </button>
                          </div>

                          {/* Action 4: Delete Duplicate */}
                          <button
                            onClick={() => setItemToDelete({ item, group })}
                            className="p-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all cursor-pointer shadow-sm"
                            title={`Delete duplicate ${item.mediaType} "${item.title}" in real time`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Interactive Live Audition Player Bar (when listening to songs or audiobooks) */}
      {activeAuditionItem && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-8 sm:right-8 lg:left-72 z-50 rounded-2xl glass-panel border border-brand-gold/50 bg-[#0e0a1c]/95 backdrop-blur-2xl p-3.5 sm:p-4 shadow-[0_10px_40px_rgba(0,0,0,0.85)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black border border-white/20 shrink-0">
              {activeAuditionItem.coverUrl ? (
                <Image
                  src={activeAuditionItem.coverUrl}
                  alt={activeAuditionItem.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <Music className="w-6 h-6 m-auto text-brand-gold" />
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase">
                  Auditioning Audio
                </span>
                <span className="text-[10px] text-neutral-400 font-mono truncate">{activeAuditionItem.id}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate">{activeAuditionItem.title}</h4>
              <p className="text-[11px] text-neutral-400 truncate">{activeAuditionItem.creator}</p>
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
                  audioRef.current?.play().catch(() => {});
                  setIsAudioPlaying(true);
                }
              }}
              className="w-10 h-10 rounded-full bg-brand-gold text-black flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
                className="h-full bg-gradient-to-r from-brand-gold to-amber-400 rounded-full"
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
                setActiveAuditionItem(null);
                setIsAudioPlaying(false);
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white shrink-0"
              title="Close Audition Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Video Modal Cinema Viewport (Watch) */}
      {activeWatchItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl glass-panel border border-cyan-500/40 bg-black/95 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{activeWatchItem.title}</h3>
              </div>
              <button
                onClick={() => setActiveWatchItem(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 max-h-[75vh] flex items-center justify-center">
              <video
                src={activeWatchItem.mediaUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-auto max-h-[75vh] object-contain bg-black block"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Creator: <strong className="text-white">{activeWatchItem.creator}</strong></span>
              <span className="font-mono text-[11px]">Asset: {activeWatchItem.mediaUrl}</span>
            </div>
          </div>
        </div>
      )}

      {/* PDF Book Reader Modal (Read) */}
      {activeReadItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-5xl h-[85vh] rounded-3xl glass-panel border border-rose-500/40 bg-black/95 p-4 sm:p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">{activeReadItem.title}</h3>
                  <p className="text-xs text-neutral-400">By {activeReadItem.creator}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeReadItem.pdfUrl && (
                  <a
                    href={activeReadItem.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Fullscreen</span>
                  </a>
                )}
                <button
                  onClick={() => setActiveReadItem(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/10 bg-black">
              {activeReadItem.pdfUrl ? (
                <iframe
                  src={`${activeReadItem.pdfUrl}#toolbar=1&navpanes=1`}
                  title={activeReadItem.title}
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <FileText className="w-12 h-12 text-rose-400" />
                  <p className="text-sm text-neutral-300">
                    PDF Document URL: <span className="font-mono text-rose-300">{activeReadItem.mediaUrl}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Deletion Confirmation Modal */}
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
              <h3 className="text-lg font-bold text-white">Delete Duplicate {itemToDelete.item.mediaType}?</h3>
              <p className="text-xs text-neutral-300">
                Are you sure you want to delete <strong className="text-white">"{itemToDelete.item.title}"</strong> ({itemToDelete.item.id})?
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] text-neutral-400 space-y-1 font-mono">
              <p>Type: <span className="text-white uppercase">{itemToDelete.item.mediaType}</span></p>
              <p>Creator: <span className="text-white">{itemToDelete.item.creator}</span></p>
              <p className="truncate">URL: <span className="text-neutral-500">{itemToDelete.item.mediaUrl}</span></p>
              <p className="text-emerald-400 text-[10px] pt-1">
                Safeguard: Stored in 45-day Recovery Vault for safe restoration.
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
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:scale-105 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete in Real Time'}
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
                Delete All {batchDeleteItems.length} Duplicate Songs?
              </h3>
              <p className="text-xs text-neutral-300 max-w-sm mx-auto">
                You are about to permanently purge <strong className="text-white">{batchDeleteItems.length} redundant duplicate song{batchDeleteItems.length === 1 ? '' : 's'}</strong> from the live catalog simultaneously.
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
                      <p className="text-[10px] text-neutral-400 truncate">{item.creator} • {item.id}</p>
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
                <span>Primary Master Recordings Protected</span>
              </p>
              <p className="text-neutral-300 text-[10px] pl-5.5">
                The primary master version of each song will remain completely active and playable on the platform.
              </p>
              <p className="text-neutral-400 text-[10px] pl-5.5 pt-0.5">
                Safeguard: All deleted songs are archived in the 45-day Recovery Vault for safe restoration.
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

      {/* Keep Duplicate Versions Modal (Remixes & Demos) */}
      {isKeepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-2xl p-6 sm:p-7 rounded-3xl glass-panel border border-emerald-500/40 bg-gradient-to-b from-[#0a1a12] via-[#06120b] to-[#040906] shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Keep Duplicate Versions</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      {keepModalItems.length} Selected
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Remixes, demos, and alternate recordings are authentic versions. Mark them to preserve them on the platform.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsKeepModalOpen(false);
                  setKeepModalItems([]);
                }}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of items to classify and keep */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {keepModalItems.map((entry, idx) => {
                const currentBadge = getVariantTypeBadge(entry.variantType);
                return (
                  <div
                    key={entry.item.id}
                    className="p-3.5 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{entry.item.title}</span>
                          <span className={`text-[10px] px-2 py-0.2 rounded-full border font-bold uppercase ${currentBadge.color}`}>
                            {currentBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate">{entry.item.creator} • ID: {entry.item.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* Classification Dropdown */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                          Classification
                        </label>
                        <select
                          value={entry.variantType}
                          onChange={(e) => {
                            const newType = e.target.value as VariantType;
                            setKeepModalItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, variantType: newType } : it))
                            );
                          }}
                          className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400 font-medium cursor-pointer"
                        >
                          <option value="remix">Remix / Club Mix</option>
                          <option value="demo">Demo / Early Version</option>
                          <option value="extended">Extended / 12" Mix</option>
                          <option value="instrumental">Instrumental</option>
                          <option value="acapella">Acapella / Vocal Only</option>
                          <option value="live">Live Cut / Concert Recording</option>
                          <option value="alternate">Alternate Take / Mix</option>
                          <option value="master_variant">Master Recording Variant</option>
                        </select>
                      </div>

                      {/* Reason / Note Input */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                          Note / Reason
                        </label>
                        <input
                          type="text"
                          value={entry.reason}
                          onChange={(e) => {
                            const newReason = e.target.value;
                            setKeepModalItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, reason: newReason } : it))
                            );
                          }}
                          placeholder="e.g. Authentic 1981 Home Demo version"
                          className="w-full px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400 font-medium placeholder-neutral-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Informational callout */}
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1 shrink-0">
              <p className="font-bold flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Exempt from Future Duplicate Scans</span>
              </p>
              <p className="text-neutral-300 text-[10px]">
                Once saved, these versions will never appear in duplicate detection lists again. They will remain fully active and playable for all platform members.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsKeepModalOpen(false);
                  setKeepModalItems([]);
                }}
                disabled={isSavingKeep}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmKeepModal}
                disabled={isSavingKeep || keepModalItems.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:scale-105 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <BookmarkCheck className="w-4 h-4" />
                <span>{isSavingKeep ? 'Saving...' : `Confirm & Keep (${keepModalItems.length}) Version${keepModalItems.length === 1 ? '' : 's'}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

