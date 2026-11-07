'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
  Filter,
  Search,
  Check,
  X,
  RotateCcw,
  Sliders,
  Disc3,
  Copy,
  Clock,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  Play,
  Pause,
  Upload,
  Image as ImageIcon,
  Ban,
  Trash2,
  FolderX,
  Folder,
  ExternalLink,
  Headphones,
  Tag,
} from 'lucide-react';
import {
  UploadBatch,
  UploadItem,
  DuplicateAction,
  OFFICIAL_CRATES,
  DIRECT_MUSIC_CRATE,
  CrateDefinition,
  UploadAlbumGroupRecord,
} from '@/types/catalog';
import { MusicUploadService } from '@/lib/admin/MusicUploadService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { getAuthenticAudioUrl, getResilientAudioFallback } from '@/lib/music/authenticAudioMap';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { ChangeCoverArtModal } from '@/components/admin/modals/ChangeCoverArtModal';
import { ViewDistributionAgreementsModal } from '@/components/admin/modals/ViewDistributionAgreementsModal';
import { PLATFORM_STANDARD_GENRES, classifyGenre } from '@/lib/music/genreClassifier';

interface ApprovalReviewSectionProps {
  initialBatchId?: string;
}

const ReviewTrackCoverThumbnail: React.FC<{
  item: UploadItem;
  onEdit: (item: UploadItem) => void;
}> = ({ item, onEdit }) => {
  const [currentCover, setCurrentCover] = useState<string | undefined>(item.coverUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentCover(item.coverUrl);
    setHasError(false);
  }, [item.coverUrl]);

  const handleImageError = () => {
    const authentic = MusicCatalogService.getAuthenticCoverForTrack(item.artist, item.album, item.title);
    if (authentic && authentic !== currentCover) {
      setCurrentCover(authentic);
      item.coverUrl = authentic;
      MusicUploadService.updateItemMetadata(item.batchId, item.id, { coverUrl: authentic });
      return;
    }
    setHasError(true);
  };

  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-white/20 hover:border-brand-gold bg-black/60 shrink-0 transition-all cursor-pointer block"
      title="Click to add or change cover art"
    >
      {currentCover && !hasError ? (
        <Image
          src={currentCover}
          alt={item.title || 'Cover'}
          fill
          className="object-cover group-hover:scale-110 transition-transform"
          unoptimized
          onError={handleImageError}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-amber-500/10 text-amber-300">
          <Disc3 className="w-5 h-5 text-amber-400 mb-0.5" />
          <span className="text-[8px] font-black leading-tight uppercase">Artwork Missing</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-brand-gold" />
      </div>
    </button>
  );
};

export const ApprovalReviewSection: React.FC<ApprovalReviewSectionProps> = ({
  initialBatchId,
}) => {
  const { profile } = useAuth();
  const { playTrack, currentTrack, isPlaying, pause, resume } = usePlayer();
  const [listeningItemId, setListeningItemId] = useState<string | null>(null);

  const handleListenToUpload = async (item: UploadItem) => {
    if ((listeningItemId === item.id || currentTrack?.id === item.id) && isPlaying) {
      pause();
      return;
    }
    if ((listeningItemId === item.id || currentTrack?.id === item.id) && !isPlaying && currentTrack) {
      resume();
      return;
    }

    setListeningItemId(item.id);

    // 1. In-memory file object (by unambiguous identifiers)
    let localUrl: string | undefined;
    const fileObj =
      MusicUploadService.getFile(item.id) ||
      (item.scanFileId ? MusicUploadService.getFile(item.scanFileId) : undefined) ||
      (item.relativePath ? MusicUploadService.getFile(item.relativePath) : undefined) ||
      MusicUploadService.getFile(item.fileName);

    if (fileObj) {
      try {
        localUrl = URL.createObjectURL(fileObj);
      } catch {}
    }

    if (!localUrl) {
      // 2. Local IndexedDB Blob (exact item id or scanFileId only)
      let blobUrl = await AudioStorageService.getAudioUrl(item.id);
      if (!blobUrl && item.scanFileId) {
        blobUrl = await AudioStorageService.getAudioUrl(item.scanFileId);
      }
      if (!blobUrl) {
        const found = await AudioStorageService.findAudioByTrack({
          id: item.id,
          title: item.title,
          artistName: item.artist,
        });
        if (found?.url) blobUrl = found.url;
      }
      if (blobUrl) {
        localUrl = blobUrl;
      }
    }

    const effectiveAudioUrl =
      localUrl ||
      item.previewAudioUrl ||
      getAuthenticAudioUrl({
        id: item.id,
        title: item.title,
        artistName: item.artist,
        fileName: item.fileName,
      }) ||
      getResilientAudioFallback({
        artistName: item.artist,
        title: item.title,
        genre: item.genre,
        crateId: item.crateId,
      });

    MusicCatalogService.unremoveTrack(item.id, item.title, item.artist);

    playTrack({
      id: item.id,
      title: item.title,
      artistId: 'artist-1',
      artistName: item.artist,
      audioUrl: effectiveAudioUrl,
      coverUrl: item.coverUrl || '/images/logo.png',
      duration: item.durationSeconds || 180,
      genre: item.genre || 'R&B / Soul',
      bpm: 94,
      albumTitle: item.album,
      playCount: 0,
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
    });
  };

  const handleListenToBatch = () => {
    if (items.length === 0) return;
    const target = items.find((it) => it.id === listeningItemId) || items[0];
    handleListenToUpload(target);
  };

  const [crates, setCrates] = useState<CrateDefinition[]>(() => MusicCatalogService.getOfficialCrates());
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [albumGroups, setAlbumGroups] = useState<UploadAlbumGroupRecord[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishedAlert, setPublishedAlert] = useState<string | null>(null);

  // Denial & Removal State
  const [songToDeny, setSongToDeny] = useState<UploadItem | null>(null);
  const [albumToDeny, setAlbumToDeny] = useState<{ title: string; count: number; tracks: UploadItem[] } | null>(null);
  const [isBulkDenyOpen, setIsBulkDenyOpen] = useState<boolean>(false);
  const [denyReason, setDenyReason] = useState<string>('');
  const [denySuccessMessage, setDenySuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [itemToEdit, setItemToEdit] = useState<UploadItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editCrateId, setEditCrateId] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editGenre, setEditGenre] = useState('');

  // Standalone Cover Art & Genre Modals
  const [trackForCoverEdit, setTrackForCoverEdit] = useState<UploadItem | null>(null);
  const [isBulkCoverModalOpen, setIsBulkCoverModalOpen] = useState(false);
  const [isBulkGenreModalOpen, setIsBulkGenreModalOpen] = useState(false);
  const [selectedBulkGenre, setSelectedBulkGenre] = useState<string>(PLATFORM_STANDARD_GENRES[0]);
  const [customBulkGenre, setCustomBulkGenre] = useState('');
  const [genreSuccessMessage, setGenreSuccessMessage] = useState<string | null>(null);
  const [isAgreementsModalOpen, setIsAgreementsModalOpen] = useState(false);

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
      setItems(MusicUploadService.getBatchItems(initialBatchId));
      setAlbumGroups(MusicUploadService.getBatchAlbumGroups(initialBatchId));
    }
  }, [initialBatchId]);

  useEffect(() => {
    const refreshData = () => {
      setCrates(MusicCatalogService.getOfficialCrates());
      const allBatches = MusicUploadService.getBatches();
      setBatches(allBatches);
      const currentValidBatchId = allBatches.some((b) => b.id === selectedBatchId)
        ? selectedBatchId
        : '';
      const effectiveBatchId =
        currentValidBatchId || initialBatchId || (allBatches.length > 0 ? allBatches[0].id : '');
      if (effectiveBatchId !== selectedBatchId) {
        setSelectedBatchId(effectiveBatchId);
      }
      if (effectiveBatchId) {
        setItems(MusicUploadService.getBatchItems(effectiveBatchId));
        setAlbumGroups(MusicUploadService.getBatchAlbumGroups(effectiveBatchId));
      } else {
        setItems([]);
        setAlbumGroups([]);
      }
    };

    refreshData();
    const unsubUpload = MusicUploadService.subscribe(refreshData);
    const unsubCatalog = MusicCatalogService.subscribe(refreshData);
    return () => {
      unsubUpload();
      unsubCatalog();
    };
  }, [selectedBatchId, initialBatchId]);

  useEffect(() => {
    if (selectedBatchId) {
      setItems(MusicUploadService.getBatchItems(selectedBatchId));
      setAlbumGroups(MusicUploadService.getBatchAlbumGroups(selectedBatchId));
    }
  }, [selectedBatchId]);

  const handleConfirmAlbumGroup = (groupId: string) => {
    if (!selectedBatchId) return;
    MusicUploadService.confirmAlbumGroup(selectedBatchId, groupId);
    setAlbumGroups(MusicUploadService.getBatchAlbumGroups(selectedBatchId));
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
  };

  const handleResolveArtwork = async (
    itemId: string,
    action: 'accept_current' | 'use_album_cover' | 'upload_new',
    newCoverUrl?: string
  ) => {
    if (!selectedBatchId) return;
    await MusicUploadService.resolveArtwork(selectedBatchId, itemId, {
      action,
      newCoverUrl,
      actorEmail: profile?.email || 'antgreene@chancetekone.com',
      actorId: profile?.id || 'usr-antgreene',
    });
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
    setAlbumGroups(MusicUploadService.getBatchAlbumGroups(selectedBatchId));
  };

  const handleResolveTrackAlbum = (itemId: string, suggestedAlbum: string) => {
    if (!selectedBatchId) return;
    MusicUploadService.resolveTrackAlbum(selectedBatchId, itemId, suggestedAlbum);
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
    setAlbumGroups(MusicUploadService.getBatchAlbumGroups(selectedBatchId));
  };

  const [isEnrichingArtwork, setIsEnrichingArtwork] = useState<boolean>(false);

  const handleAiEnrichArtwork = async () => {
    if (!selectedBatchId) return;
    setIsEnrichingArtwork(true);
    setPublishedAlert('Agentic AI: Searching the internet via Tavily for authentic cover art...');
    try {
      const { enrichedCount } = await MusicUploadService.enrichBatchMissingArtworkWithAI(selectedBatchId);
      setItems(MusicUploadService.getBatchItems(selectedBatchId));
      setAlbumGroups(MusicUploadService.getBatchAlbumGroups(selectedBatchId));
      setPublishedAlert(`Agentic AI finished: Attached authentic cover art to ${enrichedCount} MP3s, albums & folders!`);
    } catch (err: any) {
      setPublishedAlert(`AI Cover Art search error: ${err.message || 'Error'}`);
    } finally {
      setIsEnrichingArtwork(false);
    }
  };

  const activeBatch = batches.find((b) => b.id === selectedBatchId);
  const approvedCount = items.filter((it) => it.uploadStatus === 'approved').length;
  const needsApprovalCount = items.filter((it) => it.uploadStatus === 'needs_approval').length;
  const publishedCount = items.filter((it) => it.uploadStatus === 'published').length;
  const isBatchFullyPublished =
    items.length > 0 && needsApprovalCount === 0 && approvedCount === 0 && publishedCount === items.length;
  const hasPendingItems = needsApprovalCount > 0 || approvedCount > 0;

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.fileName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'needs_approval') return item.uploadStatus === 'needs_approval';
    if (filterType === 'approved') return item.uploadStatus === 'approved';
    if (filterType === 'needs_album_review') return item.albumGroupStatus === 'needs_review' || (item.albumReviewFlags && item.albumReviewFlags.length > 0);
    if (filterType === 'needs_artwork_review') return item.artworkVerification?.status === 'needs_review' || item.artworkStatus === 'missing';
    if (filterType === 'duplicates') return item.duplicateInfo?.isDuplicate;
    if (filterType === 'missing_artwork') return item.artworkStatus === 'missing';
    if (filterType === 'published') return item.uploadStatus === 'published';

    return true;
  });

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  // Actions
  const handleApproveSingle = async (itemId: string) => {
    if (!selectedBatchId) return;
    await MusicUploadService.approveTrack(selectedBatchId, itemId);
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
  };

  const handleRejectSingle = (itemId: string) => {
    if (!selectedBatchId) return;
    MusicUploadService.rejectTrack(selectedBatchId, itemId, 'Declined by Administrator');
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
  };

  // Denial & Purge Handlers
  const handleConfirmDenySong = async () => {
    if (!selectedBatchId || !songToDeny) return;
    const actor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Administrator',
      email: profile?.email || 'admin@chancetekone.com',
    };
    await MusicUploadService.denyAndRemoveTrack(
      selectedBatchId,
      songToDeny.id,
      actor,
      denyReason.trim() || 'Denied and removed by Administrator'
    );
    setDenySuccessMessage(`Denied and removed "${songToDeny.title}" by ${songToDeny.artist} from upload.`);
    setSongToDeny(null);
    setDenyReason('');
    setTimeout(() => setDenySuccessMessage(null), 4500);
  };

  const handleConfirmDenyAlbum = async () => {
    if (!selectedBatchId || !albumToDeny) return;
    const actor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Administrator',
      email: profile?.email || 'admin@chancetekone.com',
    };
    const count = await MusicUploadService.denyAndRemoveAlbum(
      selectedBatchId,
      albumToDeny.title,
      actor,
      denyReason.trim() || `Album "${albumToDeny.title}" denied and removed by Administrator`
    );
    setDenySuccessMessage(`Denied and purged entire album "${albumToDeny.title}" (${count} songs) from upload.`);
    setAlbumToDeny(null);
    setDenyReason('');
    setTimeout(() => setDenySuccessMessage(null), 4500);
  };

  const handleConfirmDenySelected = async () => {
    if (!selectedBatchId || selectedItemIds.size === 0) return;
    const actor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Administrator',
      email: profile?.email || 'admin@chancetekone.com',
    };
    const count = await MusicUploadService.denyAndRemoveSelected(
      selectedBatchId,
      Array.from(selectedItemIds),
      actor,
      denyReason.trim() || 'Selected tracks denied and removed by Administrator'
    );
    setSelectedItemIds(new Set());
    setDenySuccessMessage(`Denied and removed ${count} selected tracks from upload batch.`);
    setIsBulkDenyOpen(false);
    setDenyReason('');
    setTimeout(() => setDenySuccessMessage(null), 4500);
  };

  const handleArchiveCurrentBatch = () => {
    if (!selectedBatchId) return;
    const batchName = activeBatch?.name || 'Batch';
    if (
      confirm(
        `Archive and clear "${batchName}" from the review queue?\n\n(All tracks already published will remain permanently active and playable in the live catalog).`
      )
    ) {
      MusicUploadService.archiveBatch(selectedBatchId, profile?.email, profile?.id);
      const remaining = batches.filter((b) => b.id !== selectedBatchId);
      if (remaining.length > 0) {
        setSelectedBatchId(remaining[0].id);
        setItems(MusicUploadService.getBatchItems(remaining[0].id));
        setAlbumGroups(MusicUploadService.getBatchAlbumGroups(remaining[0].id));
      } else {
        setSelectedBatchId('');
        setItems([]);
        setAlbumGroups([]);
      }
      setDenySuccessMessage(`Archived and cleared "${batchName}" from staging workspace.`);
      setTimeout(() => setDenySuccessMessage(null), 4500);
    }
  };

  const handleRetractTrack = (item: UploadItem) => {
    if (!selectedBatchId) return;
    if (
      !confirm(
        `Retract and unpublish "${item.title}" from the live catalog?\n\nThis will remove the song from /music and archive it.`
      )
    ) {
      return;
    }
    MusicUploadService.denyAndRemoveTrack(
      selectedBatchId,
      item.id,
      {
        id: profile?.id || 'usr-admin',
        email: profile?.email || 'admin@chancetekone.com',
        name: profile?.name || profile?.email || 'Administrator',
      },
      'Retracted and unpublished from live platform by Administrator'
    );
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
    setDenySuccessMessage(`Retracted "${item.title}" from live catalog.`);
    setTimeout(() => setDenySuccessMessage(null), 4500);
  };

  const handlePlayAlbumPreview = (albumTracks: UploadItem[]) => {
    if (albumTracks.length === 0) return;
    const formatted = albumTracks.map((it) => ({
      id: it.id,
      title: it.title,
      artistId: 'artist-1',
      artistName: it.artist,
      audioUrl: it.previewAudioUrl || `/audio/uploads/${it.fileName}`,
      coverUrl: it.coverUrl || '/images/logo.png',
      duration: it.durationSeconds || 180,
      genre: it.genre || 'Hip Hop',
      bpm: 94,
      albumTitle: it.album,
      playCount: 0,
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
    }));
    playTrack(formatted[0], formatted.slice(1));
  };

  // Group items by detected album/collection
  const detectedAlbums = React.useMemo(() => {
    const map = new Map<string, UploadItem[]>();
    items.forEach((it) => {
      const alb = (it.album || it.folderName || '').trim();
      if (alb && alb !== 'Master Crate Vault' && alb !== 'Vault Cuts' && alb !== 'Single Release') {
        if (!map.has(alb)) map.set(alb, []);
        map.get(alb)!.push(it);
      }
    });
    return Array.from(map.entries()).map(([title, albumTracks]) => {
      const authenticCover =
        albumTracks.find((t) => t.coverUrl && !t.coverUrl.includes('images.unsplash.com'))?.coverUrl ||
        albumTracks.find((t) => t.coverUrl)?.coverUrl ||
        albumTracks[0]?.coverUrl;
      return {
        title,
        artist: albumTracks[0]?.artist || 'ChanceTEKone',
        coverUrl: authenticCover,
        tracks: albumTracks,
        count: albumTracks.length,
      };
    });
  }, [items]);

  const handleApproveSelected = async () => {
    if (!selectedBatchId || selectedItemIds.size === 0) return;
    await MusicUploadService.approveSelectedTracks(selectedBatchId, Array.from(selectedItemIds));
    setSelectedItemIds(new Set());
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
  };

  const handleApproveAll = async () => {
    if (!selectedBatchId) return;
    await MusicUploadService.approveSelectedTracks(selectedBatchId);
    setSelectedItemIds(new Set());
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
  };

  const handleStartProcessing = () => {
    if (!selectedBatchId) return;
    MusicUploadService.startProcessingBatch(selectedBatchId);
  };

  const handleSmartResume = async () => {
    if (!selectedBatchId) return;
    await MusicUploadService.smartResumeBatch(selectedBatchId);
  };

  const handlePause = () => {
    if (!selectedBatchId) return;
    MusicUploadService.pauseBatch(selectedBatchId);
  };

  const handlePublishBatch = async (autoApprove: boolean = true) => {
    if (!selectedBatchId) return;
    setIsPublishing(true);
    try {
      const count = await MusicUploadService.publishApprovedTracks(selectedBatchId, autoApprove);
      const targetCrateName =
        activeBatch?.crateName ||
        (activeBatch?.crateId ? MusicCatalogService.getCrateById(activeBatch.crateId)?.name : 'Music Area') ||
        'Live Platform';
      setPublishedAlert(`Successfully published ${count} tracks live to "${targetCrateName}"! All tracks are now live and playable across the platform.`);
      setItems(MusicUploadService.getBatchItems(selectedBatchId));
      setBatches(MusicUploadService.getBatches());
      setTimeout(() => setPublishedAlert(null), 7000);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishSelected = async () => {
    if (!selectedBatchId || selectedItemIds.size === 0) return;
    setIsPublishing(true);
    try {
      const count = await MusicUploadService.publishSelectedTracks(selectedBatchId, Array.from(selectedItemIds));
      const targetCrateName =
        activeBatch?.crateName ||
        (activeBatch?.crateId ? MusicCatalogService.getCrateById(activeBatch.crateId)?.name : 'Music Area') ||
        'Live Platform';
      setPublishedAlert(`Successfully published ${count} selected tracks live to "${targetCrateName}"!`);
      setSelectedItemIds(new Set());
      setItems(MusicUploadService.getBatchItems(selectedBatchId));
      setBatches(MusicUploadService.getBatches());
      setTimeout(() => setPublishedAlert(null), 7000);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDuplicateAction = (itemId: string, action: DuplicateAction) => {
    if (!selectedBatchId) return;
    MusicUploadService.resolveDuplicate(selectedBatchId, itemId, action);
  };

  const openEditModal = (item: UploadItem) => {
    setItemToEdit(item);
    setEditTitle(item.title);
    setEditArtist(item.artist);
    setEditAlbum(item.album);
    setEditCrateId(item.crateId);
    setEditCoverUrl(item.coverUrl || '');
    setEditGenre(
      item.genre ||
        classifyGenre({
          artist: item.artist,
          title: item.title,
          album: item.album,
          crateId: item.crateId,
          crateName: item.crateName,
        })
    );
  };

  const handleSaveEdit = () => {
    if (!selectedBatchId || !itemToEdit) return;
    const finalGenre =
      editGenre.trim() ||
      classifyGenre({
        artist: editArtist.trim(),
        title: editTitle.trim(),
        album: editAlbum.trim(),
        crateId: editCrateId,
      });

    MusicUploadService.updateItemMetadata(selectedBatchId, itemToEdit.id, {
      title: editTitle.trim(),
      artist: editArtist.trim(),
      album: editAlbum.trim(),
      crateId: editCrateId,
      crateName: (MusicCatalogService.getCrateById(editCrateId) || DIRECT_MUSIC_CRATE).name,
      coverUrl: editCoverUrl.trim() || undefined,
      genre: finalGenre,
    });
    setItemToEdit(null);
  };

  const handleApplyBulkGenre = () => {
    if (!selectedBatchId) return;
    const finalGenre =
      (selectedBulkGenre === 'Custom' ? customBulkGenre.trim() : selectedBulkGenre) || 'R&B / Neo-Soul';
    const targetIds = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : undefined;
    const updatedCount = MusicUploadService.updateBatchGenre(selectedBatchId, finalGenre, targetIds);
    setItems(MusicUploadService.getBatchItems(selectedBatchId));
    setIsBulkGenreModalOpen(false);
    setCustomBulkGenre('');
    setGenreSuccessMessage(`Assigned genre "${finalGenre}" to ${updatedCount} tracks.`);
    setTimeout(() => setGenreSuccessMessage(null), 4000);
  };

  if (batches.length === 0 || !activeBatch) {
    return (
      <div className="space-y-6">
        {publishedAlert && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex items-center justify-between">
            <span>{publishedAlert}</span>
            <a href="/music" className="px-3.5 py-1.5 rounded-xl bg-emerald-400 text-black font-black text-xs uppercase">
              View in /music
            </a>
          </div>
        )}
        {denySuccessMessage && (
          <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold shadow-2xl">
            {denySuccessMessage}
          </div>
        )}
        <div className="p-8 sm:p-12 rounded-3xl glass-panel border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-black text-white">Ingestion Queue is Clear</h2>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              There are no music batches currently pending approval or ingestion. All uploaded tracks have been published live to the platform or archived from the staging queue.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="/music"
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:scale-105 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
            >
              <span>Explore Live Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Published Banner Notification */}
      {publishedAlert && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-extrabold text-white">{publishedAlert}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/music"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1 shadow-md"
            >
              <span>View in /music</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            {activeBatch?.crateId && activeBatch.crateId !== 'direct-music-library' && (
              <a
                href={`/music/crate/${activeBatch.crateId}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-all"
              >
                <span>View In Crate</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Deny & Removal Notification Banner */}
      {denySuccessMessage && (
        <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold shadow-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400 shrink-0" />
            <span>{denySuccessMessage}</span>
          </div>
          <span className="text-[11px] text-red-300 uppercase tracking-wider font-mono">
            Ingestion Gate Purged
          </span>
        </div>
      )}

      {/* Genre Update Notification Banner */}
      {genreSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-extrabold text-white">{genreSuccessMessage}</span>
          </div>
          <span className="text-[11px] text-emerald-300 uppercase tracking-wider font-mono">
            Genre Classified
          </span>
        </div>
      )}

      {/* Fully Published & Live Celebration / Action Banner */}
      {isBatchFullyPublished && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#0d1f18] to-[#07130e] border border-emerald-500/40 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                Ingestion Gate Completed · All Tracks Live
              </div>
              <h3 className="text-lg font-black text-white">
                Batch &ldquo;{activeBatch?.name}&rdquo; is 100% Published Live ({publishedCount} Tracks)
              </h3>
              <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
                All tracks in this ingestion batch have been approved, metadata-indexed, and published to the live platform. They are now actively playing in the music library. You can clear this batch from the review queue so your workspace stays organized.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            <a
              href="/music"
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg"
            >
              <span>View in /music</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={handleArchiveCurrentBatch}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              title="Clear this completed batch from the review queue"
            >
              <FolderX className="w-3.5 h-3.5 text-neutral-300" />
              <span>Clear from Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-gradient-to-r from-[#170e28] via-[#100a1c] to-[#0a0712] shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Human-in-the-Loop Review Center · Mandatory Publishing Gate
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AI Ingestion & Human Approval Workspace
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-3xl leading-relaxed">
              Every uploaded track requires administrator verification before going live to consumers. Review AI crate recommendations, normalize metadata, resolve duplicate flags, and authorize final publishing.
            </p>
          </div>

          {/* Batch Selector Dropdown */}
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Select Batch:
            </span>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="p-2.5 rounded-2xl bg-[#140e24] border border-white/15 text-white font-bold text-xs focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.totalFiles} tracks) — {b.status}
                </option>
              ))}
            </select>
            {isBatchFullyPublished && (
              <button
                onClick={handleArchiveCurrentBatch}
                className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs uppercase transition-all flex items-center gap-1.5 shrink-0"
                title="Archive and clear this completed batch from staging queue"
              >
                <FolderX className="w-3.5 h-3.5 text-neutral-300" />
                <span>Clear from Queue</span>
              </button>
            )}

            <button
              onClick={() => setIsAgreementsModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/30 text-brand-gold font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
              title="Review signed Artist & Creator Distribution Agreements"
            >
              <FileCheck className="w-3.5 h-3.5 text-brand-gold" />
              <span>Creator Agreements</span>
            </button>
          </div>
        </div>

        {/* Batch Stats KPI Cards */}
        {activeBatch && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] uppercase font-bold text-neutral-400">Total in Batch</p>
              <p className="text-lg font-black text-white">{activeBatch.totalFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-purple-300">Needs Approval</p>
              <p className="text-lg font-black text-purple-200">{activeBatch.needsApprovalFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-blue-300">Approved (Ready)</p>
              <p className="text-lg font-black text-blue-200">{activeBatch.approvedFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-amber-300">Duplicate Warnings</p>
              <p className="text-lg font-black text-amber-200">
                {items.filter((it) => it.duplicateInfo?.isDuplicate).length}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-pink-300">Artwork Missing</p>
              <p className="text-lg font-black text-pink-200">
                {items.filter((it) => it.artworkStatus === 'missing').length}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-emerald-300">Published Live</p>
              <p className="text-lg font-black text-emerald-200">
                {items.filter((it) => it.uploadStatus === 'published').length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Controls Bar */}
      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent flex flex-col gap-4 shadow-xl">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Tracks', count: items.length },
            { id: 'needs_approval', label: 'Needs Approval', count: needsApprovalCount },
            {
              id: 'needs_album_review',
              label: 'Album Group Review',
              count: items.filter(
                (it) => it.albumGroupStatus === 'needs_review' || (it.albumReviewFlags && it.albumReviewFlags.length > 0)
              ).length,
            },
            {
              id: 'needs_artwork_review',
              label: 'Artwork Review',
              count: items.filter((it) => it.artworkVerification?.status === 'needs_review').length,
            },
            { id: 'approved', label: 'Approved', count: approvedCount },
            {
              id: 'duplicates',
              label: 'Duplicate Warnings',
              count: items.filter((it) => it.duplicateInfo?.isDuplicate).length,
            },
            {
              id: 'missing_artwork',
              label: 'Missing Artwork',
              count: items.filter((it) => it.artworkStatus === 'missing').length,
            },
            { id: 'published', label: 'Published Live', count: publishedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterType === tab.id
                  ? 'bg-brand-purple text-white shadow-lg'
                  : 'bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  filterType === tab.id ? 'bg-white/20 text-white' : 'bg-white/10 text-neutral-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Global Batch Action Buttons — grouped by workflow step */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full">
          {/* Step 1: Select & Approve */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                <span className="text-brand-gold mr-1.5">1</span>Select &amp; Approve
              </p>
              {isBatchFullyPublished && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> All Approved
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white font-bold text-xs"
              >
                {selectedItemIds.size === filteredItems.length && filteredItems.length > 0
                  ? 'Deselect All'
                  : `Select All (${filteredItems.length})`}
              </button>

              <button
                onClick={handleListenToBatch}
                className="px-3.5 py-2 rounded-xl bg-brand-gold/20 hover:bg-brand-gold hover:text-black border border-brand-gold/40 text-brand-gold font-bold text-xs flex items-center gap-1.5 transition-all"
                title="Audition batch audio playback"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Listen to Batch</span>
              </button>

              {selectedItemIds.size > 0 && (
                <>
                  <button
                    onClick={handleApproveSelected}
                    className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 font-extrabold text-xs uppercase transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Selected ({selectedItemIds.size})</span>
                  </button>

                  <button
                    onClick={handlePublishSelected}
                    disabled={isPublishing}
                    className="px-4 py-2 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-500/50 text-emerald-200 font-extrabold text-xs uppercase transition-all flex items-center gap-1.5"
                    title="Immediately approve and publish selected tracks to live catalog"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Publish Selected ({selectedItemIds.size})</span>
                  </button>

                  <button
                    onClick={() => {
                      setDenyReason('');
                      setIsBulkDenyOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-200 font-extrabold text-xs uppercase transition-all flex items-center gap-1.5"
                    title="Deny and remove selected tracks from upload batch"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Deny Selected ({selectedItemIds.size})</span>
                  </button>
                </>
              )}

              {needsApprovalCount > 0 && (
                <button
                  onClick={handleApproveAll}
                  className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 font-extrabold text-xs uppercase transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve All Remaining ({needsApprovalCount})</span>
                </button>
              )}

              {isBatchFullyPublished && selectedItemIds.size === 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Tracks Approved</span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Process & Prepare */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                <span className="text-brand-gold mr-1.5">2</span>Process &amp; Prepare
              </p>
              {isBatchFullyPublished && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Processed
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Process All Files / Pause Batch */}
              {activeBatch?.status === 'processing' || activeBatch?.status === 'uploading' ? (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase flex items-center gap-1.5 transition-all"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Batch</span>
                </button>
              ) : isBatchFullyPublished ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Audio &amp; Metadata Processed</span>
                </div>
              ) : (
                <button
                  onClick={handleStartProcessing}
                  disabled={items.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-105 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Process All Files</span>
                </button>
              )}

              {/* 2. Smart Resume (only when not fully published) */}
              {!isBatchFullyPublished && (
                <button
                  onClick={handleSmartResume}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase flex items-center gap-1.5 transition-all"
                  title="Only processes pending/failed items without re-uploading completed tracks"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-brand-neon" />
                  <span>Smart Resume</span>
                </button>
              )}

              {/* 3. Set Batch Cover Art */}
              <button
                onClick={() => setIsBulkCoverModalOpen(true)}
                disabled={items.length === 0}
                className="px-4 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/40 text-brand-gold font-bold text-xs uppercase flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Batch set or replace cover art"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{selectedItemIds.size > 0 ? `Set Art (${selectedItemIds.size})` : 'Set Batch Cover Art'}</span>
              </button>

              {/* 3.5 Set Batch Genre */}
              <button
                onClick={() => {
                  setSelectedBulkGenre(PLATFORM_STANDARD_GENRES[0]);
                  setCustomBulkGenre('');
                  setIsBulkGenreModalOpen(true);
                }}
                disabled={items.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Batch assign or standardize genre across batch or selected tracks"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{selectedItemIds.size > 0 ? `Set Genre (${selectedItemIds.size})` : 'Set Batch Genre'}</span>
              </button>

              {/* 4. Agentic AI Tavily Cover Search */}
              <button
                onClick={handleAiEnrichArtwork}
                disabled={items.length === 0 || isEnrichingArtwork}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold hover:opacity-95 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                title="Search the web with Tavily and attach authentic cover art to MP3s, albums, and folders"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span>{isEnrichingArtwork ? 'AI Searching Tavily...' : 'AI Find Missing Covers (Tavily)'}</span>
              </button>
            </div>
          </div>

          {/* Step 3: Go Live */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/80">
                <span className="text-brand-gold mr-1.5">3</span>Go Live
              </p>
              {isBatchFullyPublished && (
                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase">
                  <CheckCircle2 className="w-3 h-3" /> Live
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* If batch is fully published */}
              {isBatchFullyPublished ? (
                <>
                  <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-extrabold text-xs uppercase flex items-center gap-2 shadow-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Batch Published Live ({publishedCount} Tracks)</span>
                  </div>
                  <a
                    href="/music"
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md"
                  >
                    <span>View in /music</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleArchiveCurrentBatch}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs uppercase transition-all flex items-center gap-1.5"
                    title="Archive and clear this completed batch from staging workspace"
                  >
                    <FolderX className="w-3.5 h-3.5 text-neutral-300" />
                    <span>Clear from Queue</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Publish Approved to Live Platform */}
                  {hasPendingItems ? (
                    <button
                      onClick={() => handlePublishBatch(true)}
                      disabled={isPublishing || (approvedCount === 0 && needsApprovalCount === 0)}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:scale-105 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2 disabled:opacity-40"
                      title="Publish approved tracks to live platform catalog"
                    >
                      <UploadCloud className="w-4 h-4 stroke-[3]" />
                      <span>
                        {isPublishing
                          ? 'Publishing...'
                          : `Publish Approved to Live Platform (${approvedCount > 0 ? approvedCount : needsApprovalCount})`}
                      </span>
                    </button>
                  ) : null}

                  {publishedCount > 0 && (
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{publishedCount} Live</span>
                    </div>
                  )}

                  {/* If batch is empty */}
                  {items.length === 0 && (
                    <button
                      disabled
                      className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 font-bold text-xs uppercase cursor-not-allowed flex items-center gap-2"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>No Tracks in Batch</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detected Album Collections & Agentic AI Groupings in this Batch */}
      {(albumGroups.length > 0 || detectedAlbums.length > 0) && (
        <div className="p-5 sm:p-6 rounded-3xl glass-panel border border-brand-purple/30 bg-gradient-to-r from-purple-950/30 via-[#120a1f] to-purple-950/20 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-brand-gold" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Agentic AI Album Groupings & Collections ({albumGroups.length || detectedAlbums.length})
              </h3>
            </div>
            <span className="text-[11px] text-neutral-400">
              Metadata-first album grouping with confidence scoring, compilation tagging, and failure isolation.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {albumGroups.length > 0
              ? albumGroups.map((alb) => {
                  const albumTracks = items.filter((it) => alb.trackIds.includes(it.id));
                  const isAlbumFullyPublished =
                    albumTracks.length > 0 && albumTracks.every((t) => t.uploadStatus === 'published');
                  const cover =
                    alb.artworkUrl ||
                    MusicCatalogService.getAuthenticCoverForTrack(alb.albumArtist, alb.title) ||
                    albumTracks.find((t) => t.coverUrl && !t.coverUrl.includes('images.unsplash.com'))?.coverUrl ||
                    albumTracks[0]?.coverUrl;
                  const isConfirmed = alb.status === 'confirmed' || alb.humanConfirmed;

                  return (
                    <div
                      key={alb.id}
                      className={`p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col justify-between gap-3 ${
                        isAlbumFullyPublished || isConfirmed
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : alb.status === 'needs_review'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-white/5 border-white/10 hover:border-brand-purple/40'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="relative w-16 h-16 rounded-xl shadow-lg overflow-hidden border border-white/15 bg-black shrink-0">
                          {cover ? (
                            <Image src={cover} alt={alb.title} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Disc3 className="w-5 h-5 text-neutral-500" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-black text-white truncate" title={alb.title}>
                              {alb.title || 'Untitled Album'}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                isAlbumFullyPublished
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : isConfirmed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : alb.status === 'needs_review'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              }`}
                            >
                              {isAlbumFullyPublished
                                ? 'Published Live'
                                : isConfirmed
                                ? 'Confirmed'
                                : alb.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-gold truncate">{alb.albumArtist || 'Various Artists'}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400">
                            <span className="font-mono">{alb.trackIds.length} tracks</span>
                            <span>•</span>
                            <span className="text-brand-neon font-bold">{alb.confidence}% AI Confidence</span>
                            {alb.isCompilation && (
                              <span className="px-1.5 py-0.2 rounded bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-[9px] font-bold">
                                Compilation
                              </span>
                            )}
                          </div>
                          {alb.flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {alb.flags.map((fl) => (
                                <span key={fl} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                  {fl}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                        {!isConfirmed && !isAlbumFullyPublished && (
                          <button
                            onClick={() => handleConfirmAlbumGroup(alb.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                            title="Confirm this album grouping and metadata"
                          >
                            <Check className="w-3 h-3" />
                            <span>Confirm Group</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePlayAlbumPreview(albumTracks)}
                          disabled={albumTracks.length === 0}
                          className="px-2.5 py-1 rounded-lg bg-brand-gold/15 hover:bg-brand-gold hover:text-black text-brand-gold text-[10px] font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                          title={`Play all ${albumTracks.length} tracks`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play</span>
                        </button>
                        {isAlbumFullyPublished ? (
                          <a
                            href="/music"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                            title="View album live in /music"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Live in /music</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setAlbumToDeny({ title: alb.title, count: albumTracks.length, tracks: albumTracks });
                              setDenyReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-600 hover:text-white text-red-300 text-[10px] font-black uppercase border border-red-500/30 flex items-center gap-1 transition-all"
                            title={`Deny whole album "${alb.title}" and remove from batch`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>Deny</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              : detectedAlbums.map((alb) => {
                  const isAlbPublished =
                    alb.tracks.length > 0 && alb.tracks.every((t) => t.uploadStatus === 'published');
                  return (
                    <div
                      key={alb.title}
                      className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-purple/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/15 bg-black shrink-0">
                          {alb.coverUrl ? (
                            <Image src={alb.coverUrl} alt={alb.title} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Disc3 className="w-5 h-5 text-neutral-500" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-black text-white truncate">{alb.title}</p>
                          <p className="text-[11px] text-brand-gold truncate">{alb.artist}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                            <span>{alb.count} {alb.count === 1 ? 'song' : 'songs'}</span>
                            {isAlbPublished && (
                              <span className="text-emerald-400 font-bold">• Published Live</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => handlePlayAlbumPreview(alb.tracks)}
                          className="px-2.5 py-1 rounded-lg bg-brand-gold/15 hover:bg-brand-gold hover:text-black text-brand-gold text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                          title={`Play all ${alb.count} songs sequentially`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Album</span>
                        </button>
                        {isAlbPublished ? (
                          <a
                            href="/music"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                            title="View album in live catalog"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Live in /music</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setAlbumToDeny({ title: alb.title, count: alb.count, tracks: alb.tracks });
                              setDenyReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-600 hover:text-white text-red-300 text-[10px] font-black uppercase border border-red-500/30 flex items-center gap-1 transition-all"
                            title={`Deny whole album "${alb.title}" and remove all ${alb.count} songs`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>Deny Album</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* Review Item Cards Grid */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const isSelected = selectedItemIds.has(item.id);
          const isDup = item.duplicateInfo?.isDuplicate;
          return (
            <div
              key={item.id}
              className={`p-4 sm:p-5 rounded-3xl glass-panel border transition-all ${
                isSelected
                  ? 'border-brand-purple bg-brand-purple/10 shadow-lg'
                  : isDup
                  ? 'border-red-500/40 bg-red-950/20'
                  : item.uploadStatus === 'approved'
                  ? 'border-blue-500/30 bg-blue-950/15'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Checkbox + Artwork + Track Details */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(item.id)}
                    className="w-4 h-4 rounded mt-1 sm:mt-0 accent-brand-purple cursor-pointer"
                  />

                  {/* Artwork Preview */}
                  <ReviewTrackCoverThumbnail item={item} onEdit={setTrackForCoverEdit} />

                  {/* Track Info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">{item.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-neutral-300">
                        {item.artist}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-purple/30 text-brand-neon border border-brand-purple/40">
                        {item.crateName}
                      </span>
                      {item.genre && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{item.genre}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-400">
                      Album: <span className="text-neutral-200 font-semibold">{item.album}</span> • Duration:{' '}
                      <span className="text-neutral-200 font-mono">
                        {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, '0')}
                      </span>{' '}
                      • {item.bitrateKbps || 320} kbps
                    </p>

                    {/* AI Confidence & Reasoning */}
                    {item.aiRecommendation && (
                      <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-brand-gold" />
                          <span>AI: {item.aiRecommendation.confidencePercent}% Confidence</span>
                        </span>
                        <span className="text-neutral-400 truncate max-w-md">
                          {item.aiRecommendation.reasoning}
                        </span>
                      </div>
                    )}

                    {/* Album Grouping Confidence & Resolution */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {item.albumGroupStatus && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.albumGroupStatus === 'confirmed'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : item.albumGroupStatus === 'needs_review'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          Album: {item.albumGroupStatus.replace('_', ' ')}
                          {item.albumGroupConfidence ? ` (${item.albumGroupConfidence}%)` : ''}
                        </span>
                      )}

                      {/* Suggested Album Resolution */}
                      {item.suggestedAlbum && (!item.album || item.album === 'Single Release' || item.album === 'Vault Cuts') && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-brand-gold font-bold">
                            Suggested: &ldquo;{item.suggestedAlbum}&rdquo;
                          </span>
                          <button
                            onClick={() => handleResolveTrackAlbum(item.id, item.suggestedAlbum!)}
                            className="px-2 py-0.5 rounded-md bg-brand-gold/20 hover:bg-brand-gold/35 text-brand-gold font-bold text-[9px] border border-brand-gold/40 flex items-center gap-1 transition-all"
                            title="Accept suggested album name for this track"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Accept</span>
                          </button>
                        </div>
                      )}

                      {/* Review Flags */}
                      {item.albumReviewFlags && item.albumReviewFlags.length > 0 && (
                        <>
                          {item.albumReviewFlags.map((flag) => (
                            <span
                              key={flag}
                              className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            >
                              {flag}
                            </span>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Artwork Verification & Resolution Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {item.artworkVerification ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            item.artworkVerification.status === 'verified'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : item.artworkVerification.status === 'needs_review'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                          }`}
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>
                            Artwork: {item.artworkVerification.status.replace('_', ' ')} (
                            {item.artworkVerification.source})
                          </span>
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.hasEmbeddedArtwork
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                          }`}
                        >
                          {item.hasEmbeddedArtwork ? 'Embedded Artwork' : 'No Embedded Artwork'}
                        </span>
                      )}

                      {item.artworkVerification?.distinctFromAlbum && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-brand-neon border border-purple-500/40">
                          Distinct Single Cover (Preserved)
                        </span>
                      )}

                      {/* Quick Resolution Actions if Artwork Needs Review */}
                      {item.artworkVerification?.status === 'needs_review' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleResolveArtwork(item.id, 'accept_current')}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 transition-all"
                            title="Accept current cover art"
                          >
                            Accept Art
                          </button>
                          {item.albumCoverUrl && (
                            <button
                              onClick={() => handleResolveArtwork(item.id, 'use_album_cover')}
                              className="px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 font-bold text-[10px] border border-blue-500/30 transition-all"
                              title="Use companion album cover"
                            >
                              Use Album Art
                            </button>
                          )}
                          <button
                            onClick={() => setTrackForCoverEdit(item)}
                            className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition-all"
                          >
                            Upload Art
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions & Status */}
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {/* Status Tag */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1 ${
                      item.uploadStatus === 'published'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : item.uploadStatus === 'approved'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : item.uploadStatus === 'needs_approval'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : item.uploadStatus === 'skipped'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-white/10 text-neutral-400 border-white/10'
                    }`}
                  >
                    {item.uploadStatus === 'published' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    <span>{item.uploadStatus === 'published' ? 'Published Live' : item.uploadStatus.replace('_', ' ')}</span>
                  </span>

                  <button
                    onClick={() => handleListenToUpload(item)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs border flex items-center gap-1.5 cursor-pointer transition-all ${
                      (listeningItemId === item.id || currentTrack?.id === item.id) && isPlaying
                        ? 'bg-brand-gold text-black border-brand-gold shadow-lg shadow-brand-gold/30 animate-pulse'
                        : 'bg-brand-gold/15 hover:bg-brand-gold hover:text-black text-brand-gold border-brand-gold/30'
                    }`}
                    title="Listen to authentic uploaded MP3"
                  >
                    {(listeningItemId === item.id || currentTrack?.id === item.id) && isPlaying ? (
                      <>
                        <span className="flex items-center gap-0.5">
                          <span className="w-1 h-2.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1.5 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-3 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Headphones className="w-3.5 h-3.5 fill-current" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setTrackForCoverEdit(item)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple hover:text-white border border-white/10 text-neutral-300 font-bold text-xs flex items-center gap-1 transition-all"
                    title="Change track cover art"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Cover</span>
                  </button>

                  <button
                    onClick={() => openEditModal(item)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white font-bold text-xs"
                  >
                    Edit
                  </button>

                  {item.uploadStatus === 'published' ? (
                    <>
                      <a
                        href={item.publishedTrackId ? `/music/${item.publishedTrackId}` : '/music'}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        title="View track live in consumer catalog"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View in /music</span>
                      </a>
                      <button
                        onClick={() => handleRetractTrack(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-neutral-400 font-bold text-xs transition-all"
                        title="Retract and unpublish track from live catalog"
                      >
                        Retract Live
                      </button>
                    </>
                  ) : (
                    <>
                      {item.uploadStatus !== 'approved' && (
                        <button
                          onClick={() => handleApproveSingle(item.id)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-extrabold text-xs uppercase flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleRejectSingle(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-neutral-200 font-bold text-xs"
                        title="Mark status as rejected"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => {
                          setSongToDeny(item);
                          setDenyReason('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-600 hover:text-white border border-red-500/30 text-red-300 font-bold text-xs flex items-center gap-1 transition-all"
                        title="Deny upload and permanently remove this song"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Deny & Remove</span>
                      </button>

                      {item.album && item.album !== 'Master Crate Vault' && item.album !== 'Vault Cuts' && item.album !== 'Single Release' && (
                        <button
                          onClick={() => {
                            const albumTracks = items.filter(
                              (it) => (it.album || '').toLowerCase().trim() === (item.album || '').toLowerCase().trim()
                            );
                            setAlbumToDeny({ title: item.album, count: albumTracks.length, tracks: albumTracks });
                            setDenyReason('');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 font-bold text-[11px] flex items-center gap-1 transition-all"
                          title={`Deny whole album "${item.album}" and remove all songs`}
                        >
                          <FolderX className="w-3.5 h-3.5" />
                          <span>Deny Album</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Duplicate Callout Warning (Requirement 9) */}
              {isDup && (
                <div className="mt-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Duplicate detected: {item.duplicateInfo?.existingArtist} — {item.duplicateInfo?.existingTitle}</span>
                    </div>
                    <p className="text-[11px] text-neutral-300">
                      Existing location: <strong className="text-white">{item.duplicateInfo?.existingCrateName}</strong> / {item.duplicateInfo?.existingAlbum} ({item.duplicateInfo?.matchType} match)
                    </p>
                  </div>

                  {/* Resolution Choices */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDuplicateAction(item.id, 'skip')}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px]"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleDuplicateAction(item.id, 'replace')}
                      className="px-2.5 py-1 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-red-200 font-bold text-[11px]"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => handleDuplicateAction(item.id, 'keep_both')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 font-bold text-[11px]"
                    >
                      Keep Both
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 text-neutral-400 text-xs">
            No tracks found matching current filter.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {itemToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-purple/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Administrator Track Review & Edit</h3>
                <p className="text-[11px] text-neutral-400 font-mono">{itemToEdit.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setItemToEdit(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 space-y-1">
                <label className="font-bold text-neutral-300">Track Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="font-bold text-neutral-300">Target Crate</label>
                <select
                  value={editCrateId}
                  onChange={(e) => setEditCrateId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#140f24] border border-white/10 text-white font-semibold focus:outline-none"
                >
                  <option value={DIRECT_MUSIC_CRATE.id}>
                    {DIRECT_MUSIC_CRATE.name} — {DIRECT_MUSIC_CRATE.subtitle}
                  </option>
                  {crates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.subtitle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genre Selector */}
              <div className="col-span-2 space-y-1">
                <label className="font-bold text-neutral-300 flex items-center justify-between text-xs">
                  <span>Music Genre</span>
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono">
                    Auto-Classified
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={PLATFORM_STANDARD_GENRES.includes(editGenre as any) ? editGenre : 'Custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'Custom') {
                        setEditGenre(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-[#140f24] border border-white/10 text-white font-semibold focus:outline-none text-xs"
                  >
                    {PLATFORM_STANDARD_GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value="Custom">Custom Genre...</option>
                  </select>
                  <input
                    type="text"
                    value={editGenre}
                    onChange={(e) => setEditGenre(e.target.value)}
                    placeholder="Enter or customize genre"
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Cover Art In-Modal Editor */}
              <div className="col-span-2 space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                <label className="font-bold text-neutral-300 block text-xs">Track Cover Art</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-brand-gold/60 bg-black/60 shrink-0">
                    {editCoverUrl ? (
                      <Image src={editCoverUrl} alt="Cover Preview" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500">
                        <Disc3 className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Image URL or choose file below..."
                      value={editCoverUrl}
                      onChange={(e) => setEditCoverUrl(e.target.value)}
                      className="w-full p-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-[11px] focus:outline-none focus:border-brand-gold/50"
                    />
                    <div className="flex items-center gap-2">
                      <label className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-neutral-200 font-bold text-[10px] cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3 text-brand-gold" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setEditCoverUrl(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const crate = MusicCatalogService.getCrateById(editCrateId) || DIRECT_MUSIC_CRATE;
                          setEditCoverUrl(crate.artworkUrl);
                        }}
                        className="px-2 py-0.5 rounded-md bg-brand-gold/15 hover:bg-brand-gold/25 text-brand-gold font-bold text-[10px] border border-brand-gold/30 flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Crate Art</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setItemToEdit(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase shadow-lg"
              >
                Save & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Single Track Cover Art */}
      {trackForCoverEdit && (
        <ChangeCoverArtModal
          isOpen={Boolean(trackForCoverEdit)}
          onClose={() => setTrackForCoverEdit(null)}
          title={`Update Cover Art — ${trackForCoverEdit.title}`}
          subtitle={`${trackForCoverEdit.artist} • ${trackForCoverEdit.fileName}`}
          currentCoverUrl={trackForCoverEdit.coverUrl}
          crateDefaultUrl={(MusicCatalogService.getCrateById(trackForCoverEdit.crateId) || DIRECT_MUSIC_CRATE).artworkUrl}
          onSave={(newCoverUrl) => {
            if (selectedBatchId) {
              MusicUploadService.updateItemMetadata(selectedBatchId, trackForCoverEdit.id, {
                coverUrl: newCoverUrl,
              });
            }
            setTrackForCoverEdit(null);
          }}
        />
      )}

      {/* Modal: Set Bulk / Batch Cover Art for selected or all files */}
      {isBulkCoverModalOpen && selectedBatchId && (
        <ChangeCoverArtModal
          isOpen={isBulkCoverModalOpen}
          onClose={() => setIsBulkCoverModalOpen(false)}
          title={
            selectedItemIds.size > 0
              ? `Set Artwork for ${selectedItemIds.size} Selected Tracks`
              : `Batch Cover Art — ${activeBatch?.name || 'Current Batch'}`
          }
          subtitle={
            selectedItemIds.size > 0
              ? `Applying this artwork to ${selectedItemIds.size} selected tracks`
              : `Applying this artwork to all ${items.length} tracks in this batch`
          }
          currentCoverUrl={items[0]?.coverUrl}
          crateDefaultUrl={(MusicCatalogService.getCrateById(activeBatch?.crateId || '') || DIRECT_MUSIC_CRATE).artworkUrl}
          onSave={(newCoverUrl) => {
            if (selectedItemIds.size > 0) {
              selectedItemIds.forEach((id) => {
                MusicUploadService.updateItemMetadata(selectedBatchId, id, { coverUrl: newCoverUrl });
              });
            } else {
              MusicUploadService.setBatchCover(selectedBatchId, newCoverUrl);
            }
            setIsBulkCoverModalOpen(false);
          }}
        />
      )}

      {/* Modal: Set Bulk / Batch Genre for selected or all files */}
      {isBulkGenreModalOpen && selectedBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-emerald-500/40 bg-[#0d1713] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {selectedItemIds.size > 0
                      ? `Assign Genre (${selectedItemIds.size} Selected)`
                      : `Set Batch Genre`}
                  </h3>
                  <p className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                    {selectedItemIds.size > 0
                      ? `Applying to ${selectedItemIds.size} tracks`
                      : `Applying to all ${items.length} tracks in this batch`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkGenreModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Choose Standard Platform Genre</label>
                <select
                  value={selectedBulkGenre}
                  onChange={(e) => setSelectedBulkGenre(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#13221b] border border-emerald-500/30 text-white font-semibold focus:outline-none text-xs"
                >
                  {PLATFORM_STANDARD_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="Custom">Custom Genre...</option>
                </select>
              </div>

              {selectedBulkGenre === 'Custom' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-xs font-bold text-neutral-300">Enter Custom Genre</label>
                  <input
                    type="text"
                    value={customBulkGenre}
                    onChange={(e) => setCustomBulkGenre(e.target.value)}
                    placeholder="e.g., Funk, Neo-Soul, Deep House..."
                    className="w-full p-2.5 rounded-xl bg-black/60 border border-emerald-500/30 text-white font-semibold focus:outline-none text-xs"
                    autoFocus
                  />
                </div>
              )}

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Assigning this genre ensures tracks are correctly matched and organized across platform genre feeds, crates, and consumer exploration filters.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsBulkGenreModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkGenre}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-extrabold text-xs uppercase shadow-lg hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Apply Genre</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deny & Remove Single Song */}
      {songToDeny && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a12] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Deny & Remove Track</h3>
                  <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">
                    Permanent Purge from Upload Batch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSongToDeny(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/20 bg-black shrink-0">
                {songToDeny.coverUrl ? (
                  <Image src={songToDeny.coverUrl} alt={songToDeny.title} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Disc3 className="w-6 h-6 text-neutral-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <h4 className="text-sm font-extrabold text-white truncate">{songToDeny.title}</h4>
                <p className="text-xs text-brand-gold truncate">{songToDeny.artist}</p>
                <p className="text-[11px] text-neutral-400 truncate">
                  Album: {songToDeny.album} • {songToDeny.fileName}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">Permanent Upload Denial Action</p>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  This track will be permanently removed from this ingestion batch and deleted from the upload staging storage. It will not be published to consumers.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-300">
                Denial Reason / Policy Note (Logged in Audit Trail)
              </label>
              <input
                type="text"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="e.g., Audio corruption, copyright restriction, duplicate file, policy violation..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSongToDeny(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDenySong}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase shadow-lg shadow-red-900/30 flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Deny & Remove Track</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deny & Remove Whole Album */}
      {albumToDeny && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a12] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <FolderX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Deny & Remove Whole Album</h3>
                  <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">
                    Purging {albumToDeny.count} {albumToDeny.count === 1 ? 'Track' : 'Tracks'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlbumToDeny(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-brand-gold uppercase tracking-wider block">Album Collection</span>
                  <h4 className="text-base font-black text-white">{albumToDeny.title}</h4>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-300 border border-red-500/30">
                  {albumToDeny.count} songs included
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Tracks in album: {albumToDeny.tracks.map((t) => t.title).join(', ')}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">Whole Album Purge Confirmation</p>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  Are you sure you want to deny upload for the entire album "{albumToDeny.title}"? All {albumToDeny.count} tracks in this collection will be removed from the ingestion gate and staging storage immediately.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-300">
                Denial Reason / Policy Violation
              </label>
              <input
                type="text"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="e.g., Incomplete album release, duplicate catalog entry, artist unverified..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAlbumToDeny(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDenyAlbum}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase shadow-lg shadow-red-900/30 flex items-center gap-1.5"
              >
                <FolderX className="w-3.5 h-3.5" />
                <span>Confirm Deny & Remove Whole Album</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deny & Remove Selected Tracks */}
      {isBulkDenyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a12] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Deny & Remove Selected Tracks</h3>
                  <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">
                    {selectedItemIds.size} Selected Tracks
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDenyOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">Bulk Denial Warning</p>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  You are about to deny and permanently remove {selectedItemIds.size} tracks from this batch. They will not be uploaded or published.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-300">
                Denial Reason / Policy Note
              </label>
              <input
                type="text"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="e.g., Bulk decline by administrator..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsBulkDenyOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDenySelected}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase shadow-lg shadow-red-900/30 flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Deny Selected ({selectedItemIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executed Artist/Creator Distribution Agreements Modal */}
      <ViewDistributionAgreementsModal
        isOpen={isAgreementsModalOpen}
        onClose={() => setIsAgreementsModalOpen(false)}
      />
    </div>
  );
};
