'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Upload,
  Music,
  FolderPlus,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileAudio,
  Sparkles,
  Layers,
  Sliders,
  Radio,
  Disc,
  Disc3,
  Crown,
  Flame,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Clock,
  ArrowRight,
  ShieldCheck,
  Copy,
  Folder,
  Image as ImageIcon,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  FolderSync,
  Headphones,
  Volume2,
  VolumeX,
  Users,
  SlidersHorizontal,
  UserCheck,
  Mic2,
} from 'lucide-react';
import {
  OFFICIAL_CRATES,
  DIRECT_MUSIC_CRATE,
  UploadBatch,
  UploadItem,
  DuplicateAction,
  CrateDefinition,
  UploadFolderRecord,
} from '@/types/catalog';
import { Producer, Artist } from '@/types/media';
import { MOCK_ARTISTS } from '@/lib/mockData';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { MusicUploadService } from '@/lib/admin/MusicUploadService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MusicRecoveryService } from '@/lib/music/MusicRecoveryService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ChangeCoverArtModal } from '@/components/admin/modals/ChangeCoverArtModal';
import { CloudCatalogSyncBanner } from '@/components/admin/CloudCatalogSyncBanner';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { getAuthenticAudioUrl, getResilientAudioFallback } from '@/lib/music/authenticAudioMap';
import {
  captureDrop,
  scanDrop,
  scanFileList,
  summarizeScan,
  ScanSummary,
  FolderScanResult,
} from '@/lib/ingestion/folderScanner';

interface MusicUploadCenterSectionProps {
  onOpenApprovalSection?: (batchId: string) => void;
  onOpenRecoverySection?: () => void;
}

const AdminTrackCoverThumbnail: React.FC<{
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
      className="group relative w-8 h-8 rounded-lg overflow-hidden border border-white/20 hover:border-brand-gold bg-black/50 shrink-0 transition-all cursor-pointer block"
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
        <div className="w-full h-full flex flex-col items-center justify-center p-0.5 text-center bg-amber-500/20 text-amber-300">
          <Disc3 className="w-4 h-4 text-amber-400" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
      </div>
    </button>
  );
};

export const MusicUploadCenterSection: React.FC<MusicUploadCenterSectionProps> = ({
  onOpenApprovalSection,
  onOpenRecoverySection,
}) => {
  const { profile } = useAuth();
  const { playTrack, currentTrack, isPlaying, pause, resume, currentTime, duration, seek } = usePlayer();
  const [listeningItemId, setListeningItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileObjectsMapRef = useRef<Map<string, File>>(new Map());

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

    // 1. Direct file object from memory if available (by unambiguous identifiers first)
    let localUrl: string | undefined;
    const fileObj =
      MusicUploadService.getFile(item.id) ||
      (item.scanFileId ? MusicUploadService.getFile(item.scanFileId) : undefined) ||
      (item.relativePath ? MusicUploadService.getFile(item.relativePath) : undefined) ||
      fileObjectsMapRef.current.get(item.id) ||
      (item.relativePath ? fileObjectsMapRef.current.get(item.relativePath) : undefined) ||
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

  const handleListenToAll = () => {
    if (items.length === 0) return;
    handleListenToUpload(items[0]);
  };

  // Dynamic Crates Architecture
  const [crates, setCrates] = useState<CrateDefinition[]>(() => MusicCatalogService.getOfficialCrates());

  // Batches and Active Selection
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string>('');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [recoveryCount, setRecoveryCount] = useState<number>(0);
  const [batchFolders, setBatchFolders] = useState<UploadFolderRecord[]>([]);

  // Multi-Folder Scan & Pre-Upload Summary Modal
  const [pendingScan, setPendingScan] = useState<FolderScanResult<File> | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ folders: number; files: number; path: string } | null>(null);
  const [showFolderStatus, setShowFolderStatus] = useState<boolean>(false);

  // Table pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Form State for Batch Creation & Destination Targeting
  const [destinationMode, setDestinationMode] = useState<'crate' | 'artist' | 'producer'>('crate');
  const [selectedCrateId, setSelectedCrateId] = useState<string>('direct-music-library');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newArtistName, setNewArtistName] = useState('ChanceTEK One');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Artist & Producer Targeting State
  const [selectedArtistId, setSelectedArtistId] = useState<string>('artist-1');
  const [selectedArtistName, setSelectedArtistName] = useState<string>('ChanceTEK One');
  const [artistFilterSearch, setArtistFilterSearch] = useState<string>('');

  const [selectedProducerId, setSelectedProducerId] = useState<string>('producer-1');
  const [selectedProducerName, setSelectedProducerName] = useState<string>('Chancellor');
  const [producerFilterSearch, setProducerFilterSearch] = useState<string>('');

  const [allProducers, setAllProducers] = useState<Producer[]>(() => ProducerCatalogService.getAllProducers());
  const [allArtists, setAllArtists] = useState<Artist[]>(() => {
    const map = new Map<string, Artist>();
    MOCK_ARTISTS.forEach((a) => map.set(a.id, a));
    const tracks = MusicCatalogService.getAllTracks();
    tracks.forEach((t) => {
      if (t.artistId && !map.has(t.artistId)) {
        map.set(t.artistId, {
          id: t.artistId,
          name: t.artistName,
          label: t.label || 'ChanceTEK One',
          bio: `Featured artist on ChanceTEK One.`,
          avatarUrl: t.coverUrl || '/images/logo.png',
          bannerUrl: t.coverUrl || '/images/the_lounge_ambient.jpg',
          genres: [t.genre || 'R&B / Soul'],
          followerCount: 0,
          popularTrackIds: [t.id],
          verified: true,
        });
      }
    });
    return Array.from(map.values());
  });

  const handleSelectArtist = (artistId: string, artistName: string) => {
    setSelectedArtistId(artistId);
    setSelectedArtistName(artistName);
    setNewArtistName(artistName);
  };

  const handleSelectProducer = (producerId: string, producerName: string) => {
    setSelectedProducerId(producerId);
    setSelectedProducerName(producerName);
  };

  // UI state
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<UploadItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editCrateId, setEditCrateId] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');

  // Standalone Cover Art Modals
  const [trackForCoverEdit, setTrackForCoverEdit] = useState<UploadItem | null>(null);
  const [isBatchCoverModalOpen, setIsBatchCoverModalOpen] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPublishingBatch, setIsPublishingBatch] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to service updates
  useEffect(() => {
    const refreshData = () => {
      setCrates(MusicCatalogService.getOfficialCrates());
      const allBatches = MusicUploadService.getBatches();
      setBatches(allBatches);
      if (allBatches.length > 0 && !activeBatchId) {
        setActiveBatchId(allBatches[0].id);
        setItems(MusicUploadService.getBatchItems(allBatches[0].id));
        setBatchFolders(MusicUploadService.getBatchFolders(allBatches[0].id));
      } else if (activeBatchId) {
        setItems(MusicUploadService.getBatchItems(activeBatchId));
        setBatchFolders(MusicUploadService.getBatchFolders(activeBatchId));
      }
      setRecoveryCount(MusicRecoveryService.getRecoveryCount());
    };

    refreshData();
    const unsubUpload = MusicUploadService.subscribe(refreshData);
    const unsubCatalog = MusicCatalogService.subscribe(refreshData);
    const unsubRecovery = MusicRecoveryService.subscribe(refreshData);

    return () => {
      unsubUpload();
      unsubCatalog();
      unsubRecovery();
    };
  }, [activeBatchId]);

  const activeBatch = batches.find((b) => b.id === activeBatchId);
  const foldersInCrate = MusicCatalogService.getFoldersByCrate(selectedCrateId);

  // Handler: Selecting destination (Crate or Direct Music Area)
  const handleSelectCrate = (crateId: string) => {
    setSelectedCrateId(crateId);
    setSelectedFolderId('');
    const match = batches.find(
      (b) => b.crateId === crateId && b.status !== 'published' && b.status !== 'approved'
    );
    if (match) {
      setActiveBatchId(match.id);
    } else {
      setActiveBatchId('');
    }
  };

  // Handler: Create new batch
  const handleCreateNewBatch = () => {
    const crate = MusicCatalogService.getCrateById(selectedCrateId) || DIRECT_MUSIC_CRATE;
    const batchName =
      destinationMode === 'artist'
        ? `Artist: ${selectedArtistName} Collection`
        : destinationMode === 'producer'
        ? `Producer: ${selectedProducerName} Studio Batch`
        : `${crate.name} Ingestion Batch`;

    const batch = MusicUploadService.createBatch(
      selectedCrateId,
      selectedFolderId || undefined,
      batchName,
      profile?.email || 'antgreene@chancetekone.com',
      profile?.id || 'usr-antgreene',
      {
        destinationType: destinationMode,
        artistId: destinationMode === 'artist' ? selectedArtistId : undefined,
        artistName: destinationMode === 'artist' ? selectedArtistName : undefined,
        producerId: destinationMode === 'producer' ? selectedProducerId : undefined,
        producerName: destinationMode === 'producer' ? selectedProducerName : undefined,
      }
    );
    setActiveBatchId(batch.id);
    showToast(
      `Created new upload batch for ${
        destinationMode === 'artist'
          ? selectedArtistName
          : destinationMode === 'producer'
          ? selectedProducerName
          : crate.name
      }`
    );
  };

  // Handler: Create new folder/collection inside crate
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const folder = MusicCatalogService.createFolder(
      selectedCrateId,
      newFolderName.trim(),
      newArtistName.trim(),
      newFolderDesc.trim()
    );

    setSelectedFolderId(folder.id);
    setIsCreateFolderOpen(false);
    setNewFolderName('');
    showToast(`Created folder "${folder.name}" in crate!`);
  };

  // Handler: Native File Browser Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((f) => fileObjectsMapRef.current.set(f.name, f));

    let targetBatch =
      activeBatch && activeBatch.crateId === selectedCrateId && activeBatch.status !== 'published' && activeBatch.status !== 'approved'
        ? activeBatch
        : undefined;

    if (!targetBatch) {
      const targetCrateDef = MusicCatalogService.getCrateById(selectedCrateId) || DIRECT_MUSIC_CRATE;
      const batchName =
        destinationMode === 'artist'
          ? `Artist: ${selectedArtistName} Ingestion`
          : destinationMode === 'producer'
          ? `Producer: ${selectedProducerName} Studio Batch`
          : `${targetCrateDef.name} Ingestion Batch`;

      targetBatch = MusicUploadService.createBatch(
        selectedCrateId,
        selectedFolderId || undefined,
        batchName,
        profile?.email || 'antgreene@chancetekone.com',
        profile?.id || 'usr-antgreene',
        {
          destinationType: destinationMode,
          artistId: destinationMode === 'artist' ? selectedArtistId : undefined,
          artistName: destinationMode === 'artist' ? selectedArtistName : undefined,
          producerId: destinationMode === 'producer' ? selectedProducerId : undefined,
          producerName: destinationMode === 'producer' ? selectedProducerName : undefined,
        }
      );
      setActiveBatchId(targetBatch.id);
    }

    const updated = await MusicUploadService.addFilesToBatch(targetBatch.id, files);
    setItems(MusicUploadService.getBatchItems(targetBatch.id));
    showToast(`Added ${files.length} files to batch queue. Ready to process.`);
    e.target.value = '';
  };

  // Handler: Native Folder Picker (supports webkitdirectory for multi-folder music collections)
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    rawFiles.forEach((f) => {
      fileObjectsMapRef.current.set(f.name, f);
      if (f.webkitRelativePath) {
        fileObjectsMapRef.current.set(f.webkitRelativePath, f);
        fileObjectsMapRef.current.set(f.webkitRelativePath.replace(/\\/g, '/'), f);
      }
    });

    setIsScanning(true);
    setScanProgress({ folders: 1, files: rawFiles.length, path: 'Parsing folder list...' });
    try {
      const scanResult = scanFileList(rawFiles);
      if (scanResult.audioFileCount === 0) {
        showToast('No supported audio files found in selected folder(s).');
        return;
      }
      const summary = summarizeScan(scanResult);
      setPendingScan(scanResult);
      setScanSummary(summary);
    } catch (err: any) {
      showToast(`Folder scan error: ${err.message || String(err)}`);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
      e.target.value = '';
    }
  };

  // Handler: Drag and Drop (Synchronous capture + recursive multi-root scan up to 300 folders)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // CRITICAL: captureDrop must run synchronously inside drop handler before any await!
    const capture = captureDrop(e.dataTransfer);
    if (capture.roots.length === 0 && capture.looseFiles.length === 0) {
      showToast('No files or folders found in drop.');
      return;
    }

    capture.looseFiles.forEach((f) => fileObjectsMapRef.current.set(f.name, f));

    setIsScanning(true);
    setScanProgress({ folders: 0, files: 0, path: 'Scanning dropped folders...' });

    try {
      const scanResult = await scanDrop(capture, {
        onProgress: (p) => {
          setScanProgress({
            folders: p.foldersDiscovered,
            files: p.filesDiscovered,
            path: p.currentPath,
          });
        },
      });

      if (scanResult.audioFileCount === 0) {
        showToast('No supported audio tracks found in dropped folder(s).');
        return;
      }

      scanResult.files.forEach((sf) => {
        if (sf.file instanceof File) {
          fileObjectsMapRef.current.set(sf.name, sf.file);
          if (sf.relativePath) {
            fileObjectsMapRef.current.set(sf.relativePath, sf.file);
            fileObjectsMapRef.current.set(sf.relativePath.replace(/\\/g, '/'), sf.file);
          }
          if (sf.id) {
            fileObjectsMapRef.current.set(sf.id, sf.file);
          }
        }
      });

      const summary = summarizeScan(scanResult);
      setPendingScan(scanResult);
      setScanSummary(summary);
    } catch (err: any) {
      showToast(`Drop scan error: ${err.message || String(err)}`);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Pre-Upload Summary Modal Confirmation: Ingest scanned files into active/new batch
  const handleConfirmScan = async () => {
    if (!pendingScan) return;

    const targetCrateDef = MusicCatalogService.getCrateById(selectedCrateId) || DIRECT_MUSIC_CRATE;
    let targetBatch =
      activeBatch && activeBatch.crateId === selectedCrateId && activeBatch.status !== 'published' && activeBatch.status !== 'approved'
        ? activeBatch
        : undefined;

    if (!targetBatch) {
      const firstRootName = pendingScan.folders.find((f) => f.depth === 0)?.name;
      const batchName =
        destinationMode === 'artist'
          ? `Artist: ${selectedArtistName} (${firstRootName || 'Scanned Ingestion'})`
          : destinationMode === 'producer'
          ? `Producer: ${selectedProducerName} (${firstRootName || 'Scanned Ingestion'})`
          : firstRootName
          ? `${firstRootName} (${targetCrateDef.name} Ingestion)`
          : `${targetCrateDef.name} Ingestion Batch`;

      targetBatch = MusicUploadService.createBatch(
        selectedCrateId,
        selectedFolderId || undefined,
        batchName,
        profile?.email || 'antgreene@chancetekone.com',
        profile?.id || 'usr-antgreene',
        {
          destinationType: destinationMode,
          artistId: destinationMode === 'artist' ? selectedArtistId : undefined,
          artistName: destinationMode === 'artist' ? selectedArtistName : undefined,
          producerId: destinationMode === 'producer' ? selectedProducerId : undefined,
          producerName: destinationMode === 'producer' ? selectedProducerName : undefined,
        }
      );
      setActiveBatchId(targetBatch.id);
    }

    await MusicUploadService.addScannedFilesToBatch(targetBatch.id, pendingScan);
    setBatchFolders(MusicUploadService.getBatchFolders(targetBatch.id));
    setItems(MusicUploadService.getBatchItems(targetBatch.id));

    showToast(
      `Ingested ${pendingScan.audioFileCount} tracks! Click "Process All Files" to extract authentic ID3 artwork & publish live.`
    );

    setPendingScan(null);
    setScanSummary(null);
  };

  const handleCancelScan = () => {
    setPendingScan(null);
    setScanSummary(null);
  };

  // Handler: Start / Resume processing
  const handleStartProcessing = () => {
    if (!activeBatch) return;
    MusicUploadService.startProcessingBatch(activeBatch.id, fileObjectsMapRef.current);
    showToast('Processing tracks, extracting authentic cover art, and publishing live to platform.');
  };

  const handleSmartResume = async () => {
    if (!activeBatch) return;
    const res = await MusicUploadService.smartResumeBatch(activeBatch.id, fileObjectsMapRef.current);
    showToast(`Smart Resume: Resuming ${res.resumedCount} files (skipped ${res.skippedCompletedCount} completed).`);
  };

  const handlePause = () => {
    if (!activeBatch) return;
    MusicUploadService.pauseBatch(activeBatch.id);
    showToast('Batch processing paused.');
  };

  const [isEnrichingArtwork, setIsEnrichingArtwork] = useState<boolean>(false);

  const handleAiEnrichArtwork = async () => {
    if (!activeBatchId) return;
    setIsEnrichingArtwork(true);
    showToast('Agentic AI: Searching internet via Tavily for authentic cover art...');
    try {
      const { enrichedCount } = await MusicUploadService.enrichBatchMissingArtworkWithAI(activeBatchId);
      setItems(MusicUploadService.getBatchItems(activeBatchId));
      setBatchFolders(MusicUploadService.getBatchFolders(activeBatchId));
      showToast(`Agentic AI complete: Attached authentic cover art to ${enrichedCount} MP3s, albums & folders!`);
    } catch (err: any) {
      showToast(`AI Cover Art search error: ${err.message || 'Error'}`);
    } finally {
      setIsEnrichingArtwork(false);
    }
  };

  // Simulation loader presets
  const handleLoadSimulationBatch = (count: number) => {
    const batch = MusicUploadService.createSimulationBatch(count, selectedCrateId);
    setActiveBatchId(batch.id);
    showToast(`Loaded ${count}-track simulation batch for ${batch.crateId}.`);
  };

  // Metadata Edit Save
  const handleSaveMetadataEdit = () => {
    if (!activeBatch || !selectedItemForEdit) return;
    MusicUploadService.updateItemMetadata(activeBatch.id, selectedItemForEdit.id, {
      title: editTitle.trim(),
      artist: editArtist.trim(),
      album: editAlbum.trim(),
      crateId: editCrateId,
      crateName: (MusicCatalogService.getCrateById(editCrateId) || DIRECT_MUSIC_CRATE).name,
      coverUrl: editCoverUrl.trim() || undefined,
    });
    setSelectedItemForEdit(null);
    showToast('Updated track metadata & cover art.');
  };

  const openEditModal = (item: UploadItem) => {
    setSelectedItemForEdit(item);
    setEditTitle(item.title);
    setEditArtist(item.artist);
    setEditAlbum(item.album);
    setEditCrateId(item.crateId);
    setEditCoverUrl(item.coverUrl || '');
  };

  const handlePublishFromUploadCenter = async () => {
    if (!activeBatchId) return;
    setIsPublishingBatch(true);
    try {
      const count = await MusicUploadService.publishApprovedTracks(activeBatchId, true);
      const targetCrateName =
        activeBatch?.crateName ||
        (activeBatch?.crateId ? MusicCatalogService.getCrateById(activeBatch.crateId)?.name : 'Music Area') ||
        'Live Platform';
      showToast(`Successfully published ${count} tracks live to "${targetCrateName}"! All tracks are live on the platform.`);
    } catch (err: any) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishingBatch(false);
    }
  };

  // Calculate Progress Stats
  const totalFiles = activeBatch?.totalFiles || 0;
  const completedFiles = activeBatch?.completedFiles || 0;
  const needsApprovalFiles = activeBatch?.needsApprovalFiles || 0;
  const failedFiles = activeBatch?.failedFiles || 0;
  const skippedFiles = activeBatch?.skippedFiles || 0;
  const remainingFiles = Math.max(0, totalFiles - completedFiles - skippedFiles);
  const overallPercentage = totalFiles > 0 ? Math.round(((completedFiles + needsApprovalFiles) / totalFiles) * 100) : 0;

  // Filter items
  const filteredItems = items.filter((it) => {
    const matchesSearch =
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || it.uploadStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet text-white text-xs font-bold shadow-2xl border border-white/20 animate-in fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
          <span>{toastMessage}</span>
        </div>
      )}


      {/* Real-time Shared Cloud Catalog Sync Banner */}
      <CloudCatalogSyncBanner />

      {/* Target Crate & Folder Configuration Grid */}
      {/* Target Destination & Folder Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Target Destination Selector */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-brand-gold" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                1. Select Target Destination
              </h3>
            </div>

            {/* Destination Mode Switcher Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() => setDestinationMode('crate')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  destinationMode === 'crate'
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Disc3 className="w-3.5 h-3.5" />
                <span>Crates & Library</span>
              </button>

              <button
                type="button"
                onClick={() => setDestinationMode('artist')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  destinationMode === 'artist'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Artist Areas</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/30 font-mono">
                  {allArtists.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDestinationMode('producer')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  destinationMode === 'producer'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Producers</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/30 font-mono">
                  {allProducers.length}
                </span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* MODE 1: OFFICIAL CRATES & GENERAL MUSIC AREA                     */}
          {/* ================================================================= */}
          {destinationMode === 'crate' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Option: Upload Directly to Music Area */}
              <button
                type="button"
                onClick={() => handleSelectCrate('direct-music-library')}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer ${
                  selectedCrateId === 'direct-music-library'
                    ? 'bg-brand-purple/20 border-brand-purple shadow-[0_0_20px_rgba(168,85,247,0.35)] scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:border-brand-purple/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-black text-white">Upload Directly to Music Area</p>
                      <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40 text-[9px] font-black uppercase tracking-wider">
                        General Catalog
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 truncate">
                      Upload directly to the main Music Area (/music) — playable platform-wide without binding to a specific crate.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-brand-purple">
                  <span>{selectedCrateId === 'direct-music-library' ? 'Selected' : 'Select'}</span>
                  <CheckCircle2 className={`w-4 h-4 ${selectedCrateId === 'direct-music-library' ? 'opacity-100 text-brand-purple' : 'opacity-30'}`} />
                </div>
              </button>

              {/* 8 Official Crates Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {crates.map((crate) => {
                  const isSelected = selectedCrateId === crate.id;
                  return (
                    <button
                      key={crate.id}
                      onClick={() => handleSelectCrate(crate.id)}
                      className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[90px] cursor-pointer ${
                        isSelected
                          ? 'bg-brand-gold/15 border-brand-gold shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]'
                          : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: crate.accentColor }}
                        />
                        <span className="text-[10px] font-bold text-neutral-400">{crate.badge}</span>
                      </div>
                      <div>
                        <p className="text-xs font-black text-white truncate">{crate.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{crate.bpmRange}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODE 2: FEATURED ARTIST SPOTLIGHT DESTINATION                     */}
          {/* ================================================================= */}
          {destinationMode === 'artist' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200">Artist Area Destination Active</span>
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Uploaded tracks are bound to this artist, indexed on their profile (<span className="text-purple-300 font-mono">/artists/[id]</span>), and populated in their live discography.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                  <UserCheck className="w-4 h-4 text-purple-400" />
                  <span>Target: {selectedArtistName}</span>
                </div>
              </div>

              {/* Search & Custom Artist Form */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search artist or enter new artist name..."
                    value={artistFilterSearch}
                    onChange={(e) => setArtistFilterSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-purple-400 focus:outline-none"
                  />
                </div>
                {artistFilterSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const customName = artistFilterSearch.trim();
                      const slug = customName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      handleSelectArtist(`artist-${slug || 'custom'}`, customName);
                      showToast(`Selected "${customName}" as ingestion target!`);
                    }}
                    className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 cursor-pointer"
                  >
                    Set &quot;{artistFilterSearch.trim()}&quot; as Target
                  </button>
                )}
              </div>

              {/* Artist Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {allArtists
                  .filter((a) => a.name.toLowerCase().includes(artistFilterSearch.toLowerCase()))
                  .map((artist) => {
                    const isSelected = selectedArtistId === artist.id || selectedArtistName === artist.name;
                    return (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => handleSelectArtist(artist.id, artist.name)}
                        className={`p-2.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/25 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.35)] scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:border-purple-500/40 hover:bg-white/10'
                        }`}
                      >
                        <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/20 bg-neutral-900 shrink-0">
                          <Image src={artist.avatarUrl} alt={artist.name} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{artist.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{artist.label || 'Artist'}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODE 3: PRODUCERS & BEAT-MAKERS DESTINATION                       */}
          {/* ================================================================= */}
          {destinationMode === 'producer' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-200">Producer Destination Active</span>
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Uploaded tracks are tagged with production credits and showcased in Key Productions on <span className="text-amber-300 font-mono">/producers</span>.
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Target: {selectedProducerName}</span>
                </div>
              </div>

              {/* Search & Custom Producer Form */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search producer or enter new producer name..."
                    value={producerFilterSearch}
                    onChange={(e) => setProducerFilterSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>
                {producerFilterSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const customName = producerFilterSearch.trim();
                      const slug = customName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      handleSelectProducer(`producer-${slug || 'custom'}`, customName);
                      showToast(`Selected "${customName}" as producer target!`);
                    }}
                    className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/30 cursor-pointer"
                  >
                    Set &quot;{producerFilterSearch.trim()}&quot; as Target
                  </button>
                )}
              </div>

              {/* Producer Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {allProducers
                  .filter((p) => p.name.toLowerCase().includes(producerFilterSearch.toLowerCase()))
                  .map((producer) => {
                    const isSelected = selectedProducerId === producer.id || selectedProducerName === producer.name;
                    return (
                      <button
                        key={producer.id}
                        type="button"
                        onClick={() => handleSelectProducer(producer.id, producer.name)}
                        className={`p-2.5 rounded-2xl border text-left transition-all duration-200 flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600/25 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:border-amber-500/40 hover:bg-white/10'
                        }`}
                      >
                        <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/20 bg-neutral-900 shrink-0">
                          <Image src={producer.avatarUrl} alt={producer.name} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{producer.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate font-mono">{producer.role || 'Producer'}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Collection / Folder / Destination Summary */}
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-neon" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  2. Collection & Placement
                </h3>
              </div>
              <button
                onClick={() => setIsCreateFolderOpen(true)}
                className="text-xs text-brand-gold hover:underline font-bold flex items-center gap-1"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 block">
                Target Pipeline
              </span>
              <p className="text-white font-bold flex items-center gap-1.5">
                {destinationMode === 'artist' ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Artist: {selectedArtistName}</span>
                  </>
                ) : destinationMode === 'producer' ? (
                  <>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Producer: {selectedProducerName}</span>
                  </>
                ) : (
                  <>
                    <Disc3 className="w-3.5 h-3.5 text-brand-gold" />
                    <span>
                      {selectedCrateId === 'direct-music-library'
                        ? 'General Music Area'
                        : crates.find((c) => c.id === selectedCrateId)?.name || 'Crate'}
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-neutral-400">
                {destinationMode === 'artist'
                  ? 'Tracks will appear on /artists/[id]'
                  : destinationMode === 'producer'
                  ? 'Tracks tagged with producer credits'
                  : 'Tracks cataloged in selected crate'}
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono font-bold text-neutral-400 block mb-1">
                Sub-Folder / Grouping
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#140f24] border border-white/10 text-white text-xs font-semibold focus:outline-none"
              >
                <option value="">Root Crate / Auto-group by Artist & Album</option>
                {foldersInCrate.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.artistName}) — {f.trackCount} tracks
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateNewBatch}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-[1.02] active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>
              Create Batch for{' '}
              {destinationMode === 'artist'
                ? selectedArtistName
                : destinationMode === 'producer'
                ? selectedProducerName
                : 'Crate'}
            </span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDrop}
        className={`p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all text-center space-y-4 ${
          isDragOver
            ? 'border-brand-gold bg-brand-gold/10 scale-[1.01]'
            : 'border-white/15 bg-white/5 hover:border-brand-gold/50 hover:bg-white/10'
        }`}
      >
        <div className="w-16 h-16 rounded-3xl bg-brand-gold/10 border border-brand-gold/40 flex items-center justify-center text-brand-gold mx-auto shadow-xl">
          <Upload className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-black text-white">
            Drag and Drop Multiple Music Folders or MP3s Here
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            Drop entire artist and album folders or individual MP3 tracks. Agentic AI automatically extracts embedded ID3 cover art pictures for every MP3, detects companion folder artwork (<code className="text-brand-gold">Folder.jpg</code>, <code className="text-brand-gold">cover.jpg</code>), and populates album metadata.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.m4a,.wav,.flac,.aac,.ogg,.wma,.aiff,.aif,.opus,.alac,.weba"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileAudio className="w-4 h-4" />
            <span>Select Music Files</span>
          </button>

          {/* Directory Picker for Entire Music Folders */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            accept="audio/*,.mp3,.m4a,.wav,.flac,.aac,.ogg,.wma,.aiff,.aif,.opus,.alac,.weba,image/*"
            className="hidden"
            onChange={handleFolderChange}
          />
          <button
            onClick={() => folderInputRef.current?.click()}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-brand-purple via-brand-violet to-brand-neon text-white font-black text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Folder className="w-4 h-4 text-brand-gold" />
            <span>Upload Music Folders (Multiple)</span>
          </button>
        </div>
      </div>

      {/* Live Upload Progress Section (Exact Specification) */}
      {activeBatch && (
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#120a22]/90 shadow-2xl space-y-5">
          {/* Header Progress Counter */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                  Active Batch: {activeBatch.name}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Uploading Music: {completedFiles + needsApprovalFiles} / {totalFiles} tracks
                  <span className="text-brand-neon ml-2">({overallPercentage}% complete)</span>
                </h3>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-white/5 border-white/10 text-neutral-300">
                  Status: {activeBatch.status}
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden relative border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-brand-purple via-brand-violet to-brand-gold transition-all duration-300"
                style={{ width: `${Math.min(100, overallPercentage)}%` }}
              />
            </div>

            {/* Progress Details Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-neutral-300 pt-1">
              <div>
                Current:{' '}
                <span className="text-brand-gold font-bold">
                  {items.find((it) => it.uploadStatus === 'processing' || it.uploadStatus === 'uploading')?.fileName ||
                    items[0]?.fileName ||
                    'Ready to start'}
                </span>
              </div>
              <div>
                Remaining:{' '}
                <span className="text-white font-bold">{remainingFiles} tracks</span>
              </div>
            </div>
          </div>

          {/* Detailed Counter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] uppercase font-bold text-neutral-400">Selected</p>
              <p className="text-lg font-black text-white">{totalFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] uppercase font-bold text-neutral-400">Total Size</p>
              <p className="text-lg font-black text-white">
                {(activeBatch.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-emerald-400">Needs Review</p>
              <p className="text-lg font-black text-emerald-300">{needsApprovalFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-blue-400">Approved</p>
              <p className="text-lg font-black text-blue-300">{activeBatch.approvedFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-amber-400">Duplicates/Skipped</p>
              <p className="text-lg font-black text-amber-300">{skippedFiles}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-1">
              <p className="text-[10px] uppercase font-bold text-red-400">Failed</p>
              <p className="text-lg font-black text-red-300">{failedFiles}</p>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {activeBatch.status === 'processing' || activeBatch.status === 'uploading' ? (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Batch</span>
                </button>
              ) : (
                <button
                  onClick={handleStartProcessing}
                  disabled={totalFiles === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-105 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Process All Files</span>
                </button>
              )}

              {/* Smart Resume Button */}
              <button
                onClick={handleSmartResume}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase flex items-center gap-1.5 transition-all"
                title="Only processes pending/failed items without re-uploading completed tracks"
              >
                <RotateCcw className="w-3.5 h-3.5 text-brand-neon" />
                <span>Smart Resume</span>
              </button>

              {/* Batch Cover Art Changer */}
              <button
                onClick={() => setIsBatchCoverModalOpen(true)}
                disabled={totalFiles === 0}
                className="px-4 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/40 text-brand-gold font-bold text-xs uppercase flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Apply cover art to all tracks in this batch at once"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Set Batch Cover Art</span>
              </button>

              {/* Agentic AI Tavily Cover Art Finder Button */}
              <button
                onClick={handleAiEnrichArtwork}
                disabled={totalFiles === 0 || isEnrichingArtwork}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold hover:opacity-90 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                title="Search the web with Tavily and attach authentic cover art to MP3s, albums, and folders"
              >
                <Sparkles className="w-3.5 h-3.5 fill-black" />
                <span>{isEnrichingArtwork ? 'AI Searching Tavily...' : 'AI Find Missing Covers (Tavily)'}</span>
              </button>

              {/* Option to Audition / Listen to Entire Upload Batch */}
              {items.length > 0 && (
                <button
                  onClick={handleListenToAll}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold/25 via-amber-500/20 to-brand-gold/25 hover:from-brand-gold hover:to-amber-400 hover:text-black border border-brand-gold/40 text-brand-gold font-bold text-xs uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="Audition all uploaded tracks in this batch directly"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Listen to Batch</span>
                </button>
              )}

              {/* Folder Status Breakdown Toggle */}
              {batchFolders.length > 0 && (
                <button
                  onClick={() => setShowFolderStatus(!showFolderStatus)}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold uppercase flex items-center gap-1.5 transition-all ${
                    showFolderStatus
                      ? 'bg-brand-purple text-white border-brand-purple shadow-lg'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-neutral-300'
                  }`}
                  title="View folder ingestion status and failure isolation"
                >
                  <FolderSync className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Folders ({batchFolders.length})</span>
                </button>
              )}

              {/* Retry Failed Items */}
              {failedFiles > 0 && (
                <button
                  onClick={async () => {
                    if (!activeBatch) return;
                    const retried = await MusicUploadService.retryFailedItems(activeBatch.id);
                    showToast(`Retrying ${retried} failed items...`);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs uppercase flex items-center gap-1.5 transition-all"
                  title="Retry all failed files in this batch"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                  <span>Retry Failed ({failedFiles})</span>
                </button>
              )}
            </div>

            {/* Direct Publish from Upload Center */}
            {activeBatch.totalFiles > 0 && activeBatch.status !== 'published' && (
              <button
                onClick={handlePublishFromUploadCenter}
                disabled={isPublishingBatch}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:scale-105 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                title="Immediately publish all processed tracks from this batch to live catalog"
              >
                <UploadCloud className="w-4 h-4 stroke-[3]" />
                <span>
                  {isPublishingBatch
                    ? 'Publishing...'
                    : `Publish Approved to Live Platform (${activeBatch.approvedFiles || activeBatch.needsApprovalFiles || activeBatch.totalFiles})`}
                </span>
              </button>
            )}

            {activeBatch.status === 'published' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs uppercase flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Batch Published Live ({activeBatch.completedFiles || activeBatch.totalFiles})</span>
                </div>
                <button
                  onClick={handlePublishFromUploadCenter}
                  disabled={isPublishingBatch}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber hover:scale-105 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                  title="Force re-sync all tracks in this batch to Cloud Firestore & Storage"
                >
                  <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                  <span>{isPublishingBatch ? 'Syncing...' : 'Re-Sync Batch to Cloud'}</span>
                </button>
              </div>
            )}

            {/* Jump to Approval Review Center */}
            <button
              onClick={() => onOpenApprovalSection && onOpenApprovalSection(activeBatch.id)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber hover:scale-105 text-black font-black text-xs uppercase shadow-xl transition-all flex items-center gap-2"
            >
              <span>Open Human Approval Center</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Collapsible Folder Status Breakdown Drawer */}
          {showFolderStatus && batchFolders.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-brand-gold" />
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">
                    Multi-Folder Ingestion Status ({batchFolders.length} Folders)
                  </h4>
                </div>
                <span className="text-[11px] text-neutral-400">
                  Isolated failures allow healthy folders to proceed without blocking the batch.
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {batchFolders.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                      f.status === 'error' || f.failedFiles > 0
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : f.status === 'scanned'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold truncate text-[11px] text-white" title={f.path}>
                        {f.path || f.rootFolder || 'Root'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shrink-0 ${
                          f.status === 'error' || f.failedFiles > 0
                            ? 'bg-red-500/30 text-red-300'
                            : f.status === 'scanned'
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'bg-white/10 text-neutral-400'
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Depth: {f.depth}</span>
                      <span>{f.audioCount} audio files</span>
                      {f.failedFiles > 0 && <span className="text-red-400 font-bold">{f.failedFiles} failed</span>}
                    </div>
                    {f.errors.length > 0 && (
                      <p className="text-[10px] text-red-400 truncate" title={f.errors.join('; ')}>
                        {f.errors[0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Audio Monitor & Agent Verification Deck */}
      {(() => {
        const activeListeningItem = items.find((i) => i.id === listeningItemId) || (currentTrack && items.find((i) => i.id === currentTrack.id));
        if (!activeListeningItem) return null;

        return (
          <div className="p-5 rounded-3xl bg-gradient-to-r from-brand-gold/15 via-black/85 to-brand-gold/10 border-2 border-brand-gold/40 shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-neutral-900 border border-brand-gold/40 shrink-0 shadow-lg group">
                  <Image
                    src={activeListeningItem.coverUrl || '/images/logo.png'}
                    alt={activeListeningItem.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <button
                      onClick={() => handleListenToUpload(activeListeningItem)}
                      className="w-10 h-10 rounded-full bg-brand-gold text-black flex items-center justify-center hover:scale-110 transition-transform shadow-md cursor-pointer"
                      title={isPlaying ? 'Pause' : 'Resume'}
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Agent Verified: Authentic Audio Match
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-[10px] font-bold flex items-center gap-1">
                      <Headphones className="w-3 h-3" />
                      Auditioning Upload
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {activeListeningItem.fileName}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white tracking-wide">
                    {activeListeningItem.title}{' '}
                    <span className="text-neutral-400 font-medium text-sm">
                      by <strong className="text-brand-gold">{activeListeningItem.artist}</strong>
                    </span>
                  </h3>

                  <p className="text-xs text-neutral-300">
                    Crate: <span className="text-white font-semibold">{activeListeningItem.crateId}</span> • Genre: <span className="text-white font-semibold">{activeListeningItem.genre || 'R&B / Soul'}</span>
                  </p>
                </div>
              </div>

              {/* Real-time Equalizer Waveform & Audio Transport Controls */}
              <div className="flex items-center gap-4 self-end md:self-center">
                {/* Visualizer bars */}
                <div className="flex items-end gap-1 h-8 px-3 py-1 bg-black/50 rounded-xl border border-white/10">
                  {[0.4, 0.8, 0.6, 1.0, 0.5, 0.9, 0.7, 0.3, 0.85, 0.65].map((scale, i) => (
                    <span
                      key={i}
                      className={`w-1 bg-brand-gold rounded-full transition-all duration-150 ${
                        isPlaying ? 'animate-pulse' : 'opacity-40'
                      }`}
                      style={{
                        height: isPlaying ? `${Math.max(20, scale * 100)}%` : '30%',
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>

                {/* Scrubber / Time Info */}
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs font-mono font-bold text-brand-gold">
                    {formatTime(currentTime)} / {formatTime(duration || activeListeningItem.durationSeconds || 180)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || activeListeningItem.durationSeconds || 180}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-32 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-brand-gold"
                  />
                </div>

                {/* Dismiss Monitor Button */}
                <button
                  onClick={() => {
                    pause();
                    setListeningItemId(null);
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Close Live Audio Monitor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Upload Items Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white">
              Batch Files & Extracted Metadata ({filteredItems.length} items)
            </h3>
            <p className="text-xs text-neutral-400">
              Inspect extracted MP3 ID3 tags, artwork, AI confidence, and duplicate flags.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tracks or files..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="needs_approval">Needs Approval</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="skipped">Skipped / Duplicates</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase tracking-wider">
                <th className="pb-3 pl-2">Track & File</th>
                <th className="pb-3">Crate & Album</th>
                <th className="pb-3">Audio Specs</th>
                <th className="pb-3">Artwork</th>
                <th className="pb-3">AI Recommendation</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pagedItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  {/* Track & File */}
                  <td className="py-3 pl-2 max-w-[220px]">
                    <p className="font-extrabold text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-brand-gold truncate">{item.artist}</p>
                    <p className="text-[10px] text-neutral-500 font-mono truncate">{item.fileName}</p>
                  </td>

                  {/* Crate & Album */}
                  <td className="py-3 max-w-[180px]">
                    <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-neon font-bold text-[10px] border border-brand-purple/30">
                      {item.crateName}
                    </span>
                    <p className="text-[11px] text-neutral-300 truncate mt-1">{item.album}</p>
                  </td>

                  {/* Audio Specs */}
                  <td className="py-3 font-mono text-[11px] text-neutral-300 whitespace-nowrap">
                    <div>{item.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${String(item.durationSeconds % 60).padStart(2, '0')}` : '--:--'}</div>
                    <div className="text-[10px] text-neutral-500">{item.bitrateKbps || 320} kbps • {item.format || 'MP3'}</div>
                  </td>

                  {/* Artwork */}
                  <td className="py-3">
                    <AdminTrackCoverThumbnail item={item} onEdit={setTrackForCoverEdit} />
                  </td>

                  {/* AI Recommendation */}
                  <td className="py-3 max-w-[200px]">
                    {item.aiRecommendation ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-[11px]">
                            {item.aiRecommendation.confidencePercent}% Confident
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 line-clamp-1">
                          {item.aiRecommendation.reasoning}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-neutral-500">Pending AI Ingestion</span>
                    )}

                    {/* Duplicate Warning */}
                    {item.duplicateInfo?.isDuplicate && (
                      <div className="mt-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Duplicate ({item.duplicateInfo.matchType})</span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        item.uploadStatus === 'published'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : item.uploadStatus === 'approved'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : item.uploadStatus === 'needs_approval'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : item.uploadStatus === 'processing'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          : item.uploadStatus === 'failed'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-white/10 text-neutral-400 border-white/10'
                      }`}
                    >
                      {item.uploadStatus.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 pr-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleListenToUpload(item)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[10px] border flex items-center gap-1.5 cursor-pointer transition-all ${
                          listeningItemId === item.id && isPlaying
                            ? 'bg-brand-gold text-black border-brand-gold shadow-lg shadow-brand-gold/30 animate-pulse'
                            : 'bg-brand-gold/15 hover:bg-brand-gold hover:text-black text-brand-gold border-brand-gold/30'
                        }`}
                        title="Listen to authentic uploaded MP3"
                      >
                        {listeningItemId === item.id && isPlaying ? (
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
                            <Headphones className="w-3 h-3 fill-current" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setTrackForCoverEdit(item)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-brand-purple hover:text-white border border-white/10 text-neutral-300 font-bold text-[10px] flex items-center gap-1 transition-all"
                        title="Change cover art"
                      >
                        <ImageIcon className="w-3 h-3 text-brand-gold" />
                        <span>Cover</span>
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold text-[10px]"
                        title="Edit metadata"
                      >
                        Edit
                      </button>
                      {item.uploadStatus === 'needs_approval' && (
                        <button
                          onClick={() => activeBatch && MusicUploadService.approveTrack(activeBatch.id, item.id)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 font-bold text-[10px] border border-emerald-500/30"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-neutral-400 text-xs">
              No files in batch queue. Drag & drop MP3s or select files above.
            </div>
          )}

          {/* Pagination Controls */}
          {filteredItems.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-neutral-400">
              <div>
                Showing{' '}
                <span className="text-white font-bold font-mono">
                  {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredItems.length)}
                </span>{' '}
                of <span className="text-white font-bold font-mono">{filteredItems.length}</span> tracks
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-bold transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="px-3 py-1.5 rounded-xl bg-white/10 text-brand-gold font-bold font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-bold transition-all"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mass Ingestion Architecture Banner & Test Presets (Moved to Bottom) */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-gradient-to-r from-[#170e2a] via-[#100a1e] to-[#0a0712] shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-extrabold uppercase tracking-wider">
              <Upload className="w-3.5 h-3.5" />
              Multi-Folder Ingestion Architecture · Up to 300 Folders & High-Volume Audio per Batch
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Admin Music Upload Center
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-3xl leading-relaxed">
              Industrial-grade music ingestion pipeline for administrators and Agentic AI agents. Features multi-folder recursive parsing (up to 300 folders per batch), automated ID3 metadata extraction, authentic companion artwork detection without cross-album contamination, multi-signal duplicate prevention, and Smart Resume.
            </p>
          </div>

          {/* Quick Simulation Presets & Recovery Vault */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenRecoverySection && (
              <button
                onClick={onOpenRecoverySection}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                title="View quarantined music in 45-day recovery vault"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>45-Day Recovery Vault ({recoveryCount})</span>
              </button>
            )}
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Test Presets:
            </span>
            <button
              onClick={() => handleLoadSimulationBatch(10)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
            >
              10 Tracks
            </button>
            <button
              onClick={() => handleLoadSimulationBatch(50)}
              className="px-3 py-1.5 rounded-xl bg-brand-gold/10 hover:bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-bold transition-all"
            >
              50 Tracks
            </button>
            <button
              onClick={() => handleLoadSimulationBatch(100)}
              className="px-3 py-1.5 rounded-xl bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-purple/50 text-brand-neon text-xs font-bold transition-all"
            >
              100 Tracks
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create Folder in Crate */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md p-6 rounded-3xl glass-panel border border-brand-purple/50 bg-[#120a22] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white">Create New Album / Collection</h3>
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Collection / Album Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SP-1200 Concrete Mastercuts"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Artist Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ChanceTEK One"
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Tell listeners what makes this collection special..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet text-white font-extrabold text-xs uppercase shadow-lg"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Track Metadata */}
      {selectedItemForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-gold/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Edit Track Metadata</h3>
                <p className="text-[11px] text-neutral-400 font-mono">{selectedItemForEdit.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForEdit(null)}
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
                    {DIRECT_MUSIC_CRATE.name} ({DIRECT_MUSIC_CRATE.subtitle})
                  </option>
                  {crates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.subtitle})
                    </option>
                  ))}
                </select>
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
                onClick={() => setSelectedItemForEdit(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetadataEdit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase shadow-lg"
              >
                Save Changes
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
            if (activeBatch) {
              MusicUploadService.updateItemMetadata(activeBatch.id, trackForCoverEdit.id, {
                coverUrl: newCoverUrl,
              });
              showToast(`Cover art updated for "${trackForCoverEdit.title}"!`);
            }
            setTrackForCoverEdit(null);
          }}
        />
      )}

      {/* Modal: Set Batch Cover Art for all files */}
      {isBatchCoverModalOpen && activeBatch && (
        <ChangeCoverArtModal
          isOpen={isBatchCoverModalOpen}
          onClose={() => setIsBatchCoverModalOpen(false)}
          title={`Batch Cover Art — ${activeBatch.name}`}
          subtitle={`Apply this artwork to all ${items.length} tracks in this upload batch`}
          currentCoverUrl={items[0]?.coverUrl}
          crateDefaultUrl={(MusicCatalogService.getCrateById(activeBatch.crateId) || DIRECT_MUSIC_CRATE).artworkUrl}
          onSave={(newCoverUrl) => {
            MusicUploadService.setBatchCover(activeBatch.id, newCoverUrl);
            showToast(`Applied cover art to all ${items.length} tracks in batch!`);
            setIsBatchCoverModalOpen(false);
          }}
        />
      )}

      {/* Scanning Progress Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-brand-gold/40 bg-[#120a22] shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-brand-gold/10 border border-brand-gold/40 flex items-center justify-center mx-auto text-brand-gold shadow-xl">
              <FolderSync className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Scanning Music Folders...</h3>
              <p className="text-xs text-neutral-300">
                Recursively traversing folders, counting audio tracks, and detecting companion artwork.
              </p>
            </div>
            {scanProgress && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-neutral-300">
                  <span>Folders Discovered:</span>
                  <span className="text-brand-gold font-bold">{scanProgress.folders}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span>Files Discovered:</span>
                  <span className="text-white font-bold">{scanProgress.files}</span>
                </div>
                {scanProgress.path && (
                  <div className="text-[10px] text-neutral-400 truncate text-left pt-1 border-t border-white/5">
                    {scanProgress.path}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-neutral-400">
              Preserving folder structures and isolating failures up to 300 folders.
            </p>
          </div>
        </div>
      )}

      {/* Pre-Upload Ingestion Summary Modal (Spec §2 Requirement) */}
      {pendingScan && scanSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-2xl p-6 sm:p-8 rounded-3xl glass-panel border border-brand-purple/50 bg-[#120a22] shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-brand-purple/20 text-brand-neon border border-brand-purple/40 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3 h-3" />
                  Pre-Upload Ingestion Verification
                </div>
                <h3 className="text-xl font-black text-white">Multi-Folder Ingestion Summary</h3>
                <p className="text-xs text-neutral-400">
                  Review the 8 key metrics below before files enter the active upload queue.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelScan}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Banner: 300 Folder Safety Limit Overflow */}
            {scanSummary.overflowFolders.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">300-Folder Safety Limit Exceeded</p>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    {scanSummary.overflowFolders.length} folder(s) exceeded the maximum limit of 300 folders per batch and were trimmed to guarantee browser stability. You can ingest remaining folders in subsequent batches.
                  </p>
                </div>
              </div>
            )}

            {/* Empty Folders Info Alert */}
            {scanSummary.foldersEmpty > 0 && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-2.5">
                <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-[11px]">
                  {scanSummary.foldersEmpty} folder(s) contain no supported audio tracks (.mp3) and will be skipped.
                </span>
              </div>
            )}

            {/* 8 Core Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400">1. Total Folders</p>
                <p className="text-xl font-black text-white">{scanSummary.foldersScanned || pendingScan.folders.length}</p>
                <p className="text-[9px] text-neutral-500">Selected / Discovered</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <p className="text-[10px] uppercase font-bold text-emerald-400">2. Valid Tracks</p>
                <p className="text-xl font-black text-emerald-300">{scanSummary.audioFilesDiscovered}</p>
                <p className="text-[9px] text-emerald-500/80">Audio (.mp3) files</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400">3. Est. Batch Size</p>
                <p className="text-xl font-black text-white">
                  {(scanSummary.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
                </p>
                <p className="text-[9px] text-neutral-500">Payload volume</p>
              </div>
              <div className="p-3 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 space-y-1">
                <p className="text-[10px] uppercase font-bold text-brand-gold">4. Companion Covers</p>
                <p className="text-xl font-black text-brand-gold">{pendingScan.imageFileCount}</p>
                <p className="text-[9px] text-brand-gold/70">Folder.jpg / cover.png</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400">5. Max Depth</p>
                <p className="text-xl font-black text-white">
                  Lvl {pendingScan.folders.reduce((max, f) => Math.max(max, f.depth), 0)}
                </p>
                <p className="text-[9px] text-neutral-500">Nesting hierarchy</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400">6. Empty Folders</p>
                <p className="text-xl font-black text-neutral-300">{scanSummary.foldersEmpty}</p>
                <p className="text-[9px] text-neutral-500">0 audio tracks</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-neutral-400">7. Non-Audio Files</p>
                <p className="text-xl font-black text-neutral-300">{scanSummary.unsupportedFiles}</p>
                <p className="text-[9px] text-neutral-500">Docs / logs omitted</p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <p className="text-[10px] uppercase font-bold text-purple-400">8. 300 Limit Status</p>
                <p className="text-sm font-black text-purple-300 mt-1">
                  {scanSummary.overflowFolders.length > 0 ? `Overflow (+${scanSummary.overflowFolders.length})` : 'Compliant (≤300)'}
                </p>
                <p className="text-[9px] text-purple-400/70">Safe memory boundary</p>
              </div>
            </div>

            {/* Folder Structure Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                <span>Folder Structure Preview</span>
                <span className="text-[11px] text-neutral-500">
                  Showing top {Math.min(10, pendingScan.folders.length)} of {pendingScan.folders.length} folders
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 p-3 space-y-1.5 divide-y divide-white/5 text-xs font-mono">
                {pendingScan.folders.slice(0, 10).map((f) => (
                  <div key={f.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-neutral-300">
                    <span className="truncate" title={f.path}>
                      {' '.repeat(f.depth * 2)}📁 {f.path || f.rootFolder || 'Root'}
                    </span>
                    <span className="text-brand-gold font-bold shrink-0">{f.audioCount} tracks</span>
                  </div>
                ))}
                {pendingScan.folders.length > 10 && (
                  <div className="pt-1.5 text-center text-neutral-500 text-[11px]">
                    ...and {pendingScan.folders.length - 10} additional folders
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleCancelScan}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmScan}
                disabled={scanSummary.audioFilesDiscovered === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon hover:scale-105 text-black font-black text-xs uppercase tracking-wider shadow-xl transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Ingest ({scanSummary.audioFilesDiscovered} Tracks)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
