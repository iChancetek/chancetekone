'use client';

import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import Image from 'next/image';
import { Track } from '@/types/media';
import { MusicCatalogService, isGenericOrVirtualAlbum } from '@/lib/music/MusicCatalogService';
import { useAuth } from '@/lib/auth/AuthContext';
import { DIRECT_MUSIC_CRATE } from '@/types/catalog';
import { isTrackMatchingGenre, isGenericOrInvalidGenre } from '@/lib/music/genreClassifier';
import { matchesTrackSearch } from '@/lib/search/universalSearch';
import { PlatformChangeCoverArtModal } from '../modals/PlatformChangeCoverArtModal';
import { EditTrackMetadataModal } from '../modals/EditTrackMetadataModal';
import { ConfirmDeletionModal, DeletableItem } from '../modals/ConfirmDeletionModal';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  Music,
  Disc3,
  User,
  Search,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Trash2,
  FileEdit,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  Radio,
  Layers,
  X,
  Activity,
  ListFilter,
  Check,
  Archive,
} from 'lucide-react';

interface PlatformMusicCatalogSectionProps {
  onTotalCountChange?: (count: number) => void;
}

interface AlbumGroup {
  albumTitle: string;
  coverUrl: string;
  releaseYear?: number;
  genre?: string;
  tracks: Track[];
}

interface ArtistGroup {
  artistName: string;
  avatarUrl: string;
  totalSongs: number;
  totalAlbums: number;
  albums: AlbumGroup[];
}

export const PlatformMusicCatalogSection: React.FC<PlatformMusicCatalogSectionProps> = ({
  onTotalCountChange,
}) => {
  const { profile } = useAuth();

  // Live Catalog State
  const [liveTracks, setLiveTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedCrate, setSelectedCrate] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Accordion Expand/Collapse State
  const [expandedArtists, setExpandedArtists] = useState<Record<string, boolean>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Record<string, boolean>>({});

  // Modals State
  const [coverModalTrack, setCoverModalTrack] = useState<Track | null>(null);
  const [coverModalAlbum, setCoverModalAlbum] = useState<string | undefined>(undefined);
  const [isAlbumCoverMode, setIsAlbumCoverMode] = useState<boolean>(false);
  const [metadataModalTrack, setMetadataModalTrack] = useState<Track | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);

  // Feedback Toast with optional Undo action
  const [toastState, setToastState] = useState<{ message: string; onUndo?: () => void } | null>(null);

  // Inline Audio Audition Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync Live Catalog
  const syncCatalog = () => {
    const tracks = MusicCatalogService.getAllTracks();
    setLiveTracks(tracks);
    if (onTotalCountChange) {
      onTotalCountChange(tracks.length);
    }
  };

  useEffect(() => {
    syncCatalog();
    const unsub = MusicCatalogService.subscribe(syncCatalog);
    window.addEventListener('catalog-updated', syncCatalog);

    return () => {
      unsub();
      window.removeEventListener('catalog-updated', syncCatalog);
    };
  }, []);

  // Show Toast with optional Undo
  const showToast = (msg: string, onUndo?: () => void) => {
    setToastState({ message: msg, onUndo });
    setTimeout(() => {
      setToastState((prev) => (prev?.message === msg ? null : prev));
    }, 6500);
  };

  // Helper to format date
  const formatAddedDate = (t: Track): string => {
    if (!t) return 'Oct 24, 2026';
    if (t.uploadedAt) {
      try {
        const d = new Date(t.uploadedAt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        // fall through
      }
    }
    const idStr = String(t.id || '');
    const match = idStr.match(/(\d{10,13})/);
    if (match) {
      const ts = parseInt(match[1], 10);
      const ms = ts < 10000000000 ? ts * 1000 : ts;
      try {
        const d = new Date(ms);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        // fall through
      }
    }
    return 'Oct 24, 2026';
  };

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!Array.isArray(liveTracks)) return [];
    return liveTracks.filter((t) => {
      if (!t) return false;
      const matchSearch = matchesTrackSearch(t, deferredSearchQuery);

      const matchGenre =
        selectedGenre === 'all' ||
        isTrackMatchingGenre(t.genre, selectedGenre, t.crateId, t.artistName, t.title);

      const matchCrate =
        selectedCrate === 'all' ||
        (selectedCrate === 'direct-music-library'
          ? !t.crateId || t.crateId === 'direct-music-library'
          : t.crateId === selectedCrate || t.crateName === selectedCrate);

      return matchSearch && matchGenre && matchCrate;
    });
  }, [liveTracks, deferredSearchQuery, selectedGenre, selectedCrate]);

  // Group tracks by Artist, then by Album
  const artistGroups = useMemo(() => {
    const map = new Map<string, { artistName: string; tracks: Track[] }>();

    filteredTracks.forEach((t) => {
      if (!t) return;
      const artist = String(t.artistName || 'Unknown Artist').trim();
      if (!map.has(artist)) {
        map.set(artist, { artistName: artist, tracks: [] });
      }
      map.get(artist)!.tracks.push(t);
    });

    const groups: ArtistGroup[] = [];

    map.forEach((value, artistName) => {
      // Group this artist's tracks by album
      const albumMap = new Map<string, Track[]>();
      value.tracks.forEach((t) => {
        if (!t) return;
        const album = String(t.albumTitle || 'Singles & Vault Cuts').trim();
        if (!albumMap.has(album)) {
          albumMap.set(album, []);
        }
        albumMap.get(album)!.push(t);
      });

      const albums: AlbumGroup[] = [];
      albumMap.forEach((albumTracks, albumTitle) => {
        // Sort tracks inside album by trackNumber or title
        albumTracks.sort((a, b) => {
          if (a.trackNumber && b.trackNumber) return Number(a.trackNumber) - Number(b.trackNumber);
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

        const firstTrack = albumTracks[0];
        albums.push({
          albumTitle,
          coverUrl: firstTrack?.coverUrl || '/images/chancetekone_banner.png',
          releaseYear: Number(firstTrack?.releaseYear) || 2026,
          genre: String(firstTrack?.genre || 'R&B / Soul'),
          tracks: albumTracks,
        });
      });

      // Sort albums alphabetically, but keep Singles & Vault Cuts at end if multiple
      albums.sort((a, b) => {
        if (a.albumTitle === 'Singles & Vault Cuts') return 1;
        if (b.albumTitle === 'Singles & Vault Cuts') return -1;
        return String(a.albumTitle || '').localeCompare(String(b.albumTitle || ''));
      });

      // Pick avatar from first album
      const avatarUrl = albums[0]?.coverUrl || '/images/chancetekone_banner.png';

      groups.push({
        artistName,
        avatarUrl,
        totalSongs: value.tracks.length,
        totalAlbums: albums.length,
        albums,
      });
    });

    // Sort artists alphabetically
    groups.sort((a, b) => String(a.artistName || '').localeCompare(String(b.artistName || '')));
    return groups;
  }, [filteredTracks]);

  // Total metrics
  const totalSongsCount = liveTracks.length;
  const totalArtistsCount = new Set(liveTracks.map((t) => String(t?.artistName || '').toLowerCase().trim())).size;
  const totalAlbumsCount = new Set(
    liveTracks.map((t) => `${String(t?.artistName || '').toLowerCase().trim()}:::${String(t?.albumTitle || '').toLowerCase().trim()}`)
  ).size;

  // Available genres
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    liveTracks.forEach((t) => {
      if (t && t.genre && !isGenericOrInvalidGenre(String(t.genre))) {
        set.add(String(t.genre).trim());
      }
    });
    return Array.from(set).sort();
  }, [liveTracks]);

  // Official & Custom Crates
  const officialCrates = useMemo(() => {
    return MusicCatalogService.getOfficialCrates();
  }, [liveTracks]);

  // Expand / Collapse Toggles
  const toggleArtist = (artistName: string) => {
    setExpandedArtists((prev) => ({
      ...prev,
      [artistName]: prev[artistName] === false ? true : prev[artistName] === true ? false : false,
    }));
  };

  const toggleAlbum = (albumKey: string) => {
    setExpandedAlbums((prev) => ({
      ...prev,
      [albumKey]: prev[albumKey] === false ? true : prev[albumKey] === true ? false : false,
    }));
  };

  const expandAll = () => {
    const artists: Record<string, boolean> = {};
    const albums: Record<string, boolean> = {};
    artistGroups.forEach((group) => {
      artists[group.artistName] = true;
      group.albums.forEach((album) => {
        albums[`${group.artistName}:::${album.albumTitle}`] = true;
      });
    });
    setExpandedArtists(artists);
    setExpandedAlbums(albums);
  };

  const collapseAll = () => {
    const artists: Record<string, boolean> = {};
    const albums: Record<string, boolean> = {};
    artistGroups.forEach((group) => {
      artists[group.artistName] = false;
      group.albums.forEach((album) => {
        albums[`${group.artistName}:::${album.albumTitle}`] = false;
      });
    });
    setExpandedArtists(artists);
    setExpandedAlbums(albums);
  };

  // Audio Playback Engine
  const playTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    // New track selected
    setCurrentTrack(track);
    setIsPlaying(true);

    if (audioRef.current) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('[PlatformMusicCatalog] Audio play error:', err);
      });
    }
  };

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  // Real-time Delete Execution
  const handleConfirmRemoval = (reason: string) => {
    if (!itemToDelete) return;

    const adminActor = {
      id: profile?.id || 'admin-usr',
      name: profile?.name || profile?.email || 'Platform Administrator',
      role: 'admin' as const,
      email: profile?.email,
    };

    const effectiveReason = reason.trim() || 'Deleted from live platform via Admin Music Catalog';

    if (itemToDelete.type === 'song') {
      const success = MusicCatalogService.removeTrack(
        itemToDelete.id,
        adminActor,
        effectiveReason,
        { exactIdOnly: true }
      );
      if (success) {
        showToast(
          `Song "${itemToDelete.title}" deleted in real time and safely quarantined to 45-day Recovery Vault.`
        );
        if (currentTrack?.id === itemToDelete.id) {
          audioRef.current?.pause();
          setCurrentTrack(null);
          setIsPlaying(false);
        }
      }
    } else if (itemToDelete.type === 'album') {
      const count = MusicCatalogService.removeAlbum(
        itemToDelete.title,
        adminActor,
        effectiveReason
      );
      showToast(
        `Album "${itemToDelete.title}" and ${count} track(s) deleted in real time and archived in 45-day Recovery Vault.`
      );
      if (
        currentTrack?.albumTitle &&
        itemToDelete?.title &&
        String(currentTrack.albumTitle).toLowerCase().trim() === String(itemToDelete.title).toLowerCase().trim()
      ) {
        audioRef.current?.pause();
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    }

    setItemToDelete(null);
    syncCatalog();
  };

  const adminActor = {
    id: profile?.id || 'admin-usr',
    name: profile?.name || profile?.email || 'Platform Administrator',
  };

  const handleQuickCrateChange = (track: Track, newCrateId: string) => {
    const targetCrate =
      newCrateId === 'direct-music-library'
        ? DIRECT_MUSIC_CRATE
        : MusicCatalogService.getCrateById(newCrateId) || MusicCatalogService.getCrateBySlug(newCrateId);
    const newCrateName =
      targetCrate?.name || (newCrateId === 'direct-music-library' ? 'Direct Music Library' : newCrateId);
    const success = MusicCatalogService.updateTrack(
      track.id,
      { crateId: newCrateId, crateName: newCrateName, customCrate: true },
      adminActor
    );
    if (success) {
      showToast(`Moved "${track.title}" to ${newCrateName} in real time.`);
    }
  };

  return (
    <ErrorBoundary
      title="Platform Music Catalog Search Interrupted"
      description="A rendering error occurred while searching or filtering the music catalog. Click below to reset your search and reload the live catalog."
      onReset={() => {
        setSearchQuery('');
        setSelectedGenre('all');
        setSelectedCrate('all');
        syncCatalog();
      }}
    >
      <div className="space-y-6 animate-in fade-in duration-300 pb-28">
      {/* Hidden Audio Element for Audition */}
      <audio ref={audioRef} preload="metadata" />

      {/* Real-time Toast Feedback with Undo Support */}
      {toastState && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastState.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {toastState.onUndo && (
              <button
                type="button"
                onClick={() => {
                  toastState.onUndo?.();
                  setToastState(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-emerald-400/50 cursor-pointer shadow-sm"
                title="Undo this change and revert to previous artwork"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            )}
            <button
              onClick={() => setToastState(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE METRICS & CONTROL CENTER BANNER                               */}
      {/* ========================================================================= */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-gradient-to-r from-brand-purple/20 via-black/40 to-brand-gold/10 relative overflow-hidden shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Real-time Live Badge */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold shadow-lg shadow-brand-gold/10">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                  Platform Music Catalog
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Real-Time Live Sync
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Full catalog discography grouped by Artist & Album • Listen, change artwork, edit metadata & delete in real time
                </p>
              </div>
            </div>

            {/* Total Counters Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-brand-gold" />
                <span>
                  Total Songs: <strong className="text-brand-gold">{totalSongsCount}</strong>
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-brand-purple" />
                <span>
                  Total Artists: <strong className="text-white">{totalArtistsCount}</strong>
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs flex items-center gap-2">
                <Disc3 className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Total Albums: <strong className="text-white">{totalAlbumsCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Accordion Toggles & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Expand all artists and albums"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expand All</span>
            </button>

            <button
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Collapse all artists and albums"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Collapse All</span>
            </button>

            <div className="h-6 w-px bg-white/10 mx-1" />

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Artist & Album Grouped</span>
              </button>

              <button
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'flat'
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Flat List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
            <input
              type="text"
              placeholder="Search song, artist, album, crate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-xs placeholder:text-neutral-500 focus:border-brand-gold focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Genre Filter */}
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="flex-1 sm:w-44 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-neutral-200 text-xs focus:border-brand-gold focus:outline-none"
            >
              <option value="all">All Genres</option>
              {availableGenres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Crate Filter */}
            <select
              value={selectedCrate}
              onChange={(e) => setSelectedCrate(e.target.value)}
              className="flex-1 sm:w-48 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-neutral-200 text-xs focus:border-brand-gold focus:outline-none"
            >
              <option value="all">All Crates</option>
              <option value="direct-music-library">📦 Direct Music Library</option>
              {officialCrates
                .filter((c) => c.id !== 'direct-music-library')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    🗃️ {c.name}
                  </option>
                ))}
            </select>

            <span className="text-[11px] text-neutral-400 font-mono whitespace-nowrap hidden lg:inline">
              Showing {filteredTracks.length} of {totalSongsCount}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GROUPED ARTIST & ALBUM FORMAT                                          */}
      {/* ========================================================================= */}
      {viewMode === 'grouped' ? (
        <div className="space-y-6">
          {artistGroups.length === 0 ? (
            <div className="p-12 rounded-3xl glass-panel border border-white/5 text-center space-y-3">
              <Music className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No songs found</h3>
              <p className="text-xs text-neutral-400">
                Try adjusting your search query or genre filter.
              </p>
            </div>
          ) : (
            artistGroups.map((artist) => {
              const isArtistExpanded = expandedArtists[artist.artistName] !== false;

              return (
                <div
                  key={artist.artistName}
                  className="rounded-3xl glass-panel border border-white/10 bg-white/[0.02] overflow-hidden transition-all shadow-xl hover:border-brand-purple/30"
                >
                  {/* Artist Header Banner */}
                  <div
                    onClick={() => toggleArtist(artist.artistName)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.04] transition-colors border-b border-white/5 select-none"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Artist Avatar */}
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-brand-purple/50 shrink-0 bg-neutral-900 shadow-lg">
                        <Image
                          src={artist.avatarUrl}
                          alt={artist.artistName}
                          fill
                          className="object-cover"
                          unoptimized={Boolean(artist.avatarUrl && (artist.avatarUrl.startsWith('data:') || artist.avatarUrl.startsWith('blob:')))}
                          onError={(e) => {
                            (e.target as any).src = '/images/chancetekone_banner.png';
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight">
                            {artist.artistName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                            Artist
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>
                            <strong className="text-brand-gold">{artist.totalSongs}</strong> Track
                            {artist.totalSongs === 1 ? '' : 's'}
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-white">{artist.totalAlbums}</strong> Album
                            {artist.totalAlbums === 1 ? '' : 's'} / Releases
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                        {isArtistExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Albums Container */}
                  {isArtistExpanded && (
                    <div className="p-4 sm:p-6 space-y-6 bg-black/20 animate-in fade-in duration-200">
                      {artist.albums.map((album) => {
                        const albumKey = `${artist.artistName}:::${album.albumTitle}`;
                        const isAlbumExpanded = expandedAlbums[albumKey] !== false;
                        const isVirtualAlbum = isGenericOrVirtualAlbum(album.albumTitle);
                        const hasCustomAlbumArt = !isVirtualAlbum && MusicCatalogService.hasAlbumCustomCover(album.albumTitle, artist.artistName);

                        return (
                          <div
                            key={albumKey}
                            className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-brand-gold/30 shadow-md"
                          >
                            {/* Album Header Bar */}
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-white/[0.04] to-transparent">
                              <div
                                onClick={() => toggleAlbum(albumKey)}
                                className="flex items-center gap-3.5 cursor-pointer select-none min-w-0"
                              >
                                {/* Album Jacket Cover with Hover "Change Art" */}
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900 group shadow-md">
                                  <Image
                                    src={album.coverUrl}
                                    alt={album.albumTitle}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    unoptimized={Boolean(album.coverUrl && (album.coverUrl.startsWith('data:') || album.coverUrl.startsWith('blob:')))}
                                    onError={(e) => {
                                      (e.target as any).src = '/images/chancetekone_banner.png';
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCoverModalTrack(album.tracks[0]);
                                      setCoverModalAlbum(album.albumTitle);
                                      setIsAlbumCoverMode(!isVirtualAlbum);
                                    }}
                                    className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-bold gap-0.5 cursor-pointer"
                                    title={isVirtualAlbum ? "Change artwork for this track" : "Change album artwork for all tracks"}
                                  >
                                    <ImageIcon className="w-4 h-4 text-brand-gold" />
                                    <span>Change Art</span>
                                  </button>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-white text-sm sm:text-base truncate">
                                      {album.albumTitle}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-neutral-300 border border-white/15">
                                      {album.releaseYear || 2026}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                                    <span className="text-brand-gold font-semibold">
                                      {album.tracks.length} Song{album.tracks.length === 1 ? '' : 's'}
                                    </span>
                                    <span>•</span>
                                    <span className="text-neutral-300">{album.genre}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Album Level Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isVirtualAlbum ? (
                                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono bg-white/5 text-neutral-400 border border-white/10" title="Singles Vault cuts are managed as individual tracks">
                                    Singles Vault
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCoverModalTrack(album.tracks[0]);
                                        setCoverModalAlbum(album.albumTitle);
                                        setIsAlbumCoverMode(true);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-brand-gold text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                      title="Change artwork for this album and its songs"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Change Album Art</span>
                                    </button>

                                    {hasCustomAlbumArt && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const prevCover = album.coverUrl;
                                          const success = MusicCatalogService.revertAlbumCover(
                                            album.albumTitle,
                                            artist.artistName,
                                            adminActor
                                          );
                                          if (success) {
                                            syncCatalog();
                                            showToast(
                                              `Reverted album "${album.albumTitle}" back to authentic original artwork.`,
                                              () => {
                                                if (prevCover) {
                                                  MusicCatalogService.updateAlbumCover(
                                                    album.albumTitle,
                                                    prevCover,
                                                    adminActor,
                                                    { artistName: artist.artistName }
                                                  );
                                                  syncCatalog();
                                                }
                                              }
                                            );
                                          }
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Revert album back to authentic original studio cover art"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="hidden sm:inline">Revert Art</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setItemToDelete({
                                          type: 'album',
                                          id: albumKey,
                                          title: album.albumTitle,
                                          subtitle: `${artist.artistName} • ${album.tracks.length} Tracks`,
                                          coverUrl: album.coverUrl,
                                          meta: `${album.genre} • Release Year ${album.releaseYear || 2026}`,
                                          trackCount: album.tracks.length,
                                        });
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                      title="Delete album and all its tracks from platform"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Delete Album</span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => toggleAlbum(albumKey)}
                                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
                                >
                                  {isAlbumExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Songs Table inside this Album */}
                            {isAlbumExpanded && (
                              <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px] bg-white/[0.01]">
                                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                                      <th className="py-2.5 px-3">Song Title & Details</th>
                                      <th className="py-2.5 px-3">Added Date</th>
                                      <th className="py-2.5 px-3">Genre / Crate</th>
                                      <th className="py-2.5 px-3 text-right">Length</th>
                                      <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 font-mono">
                                    {album.tracks.map((track, trackIdx) => {
                                      const isCurrentActive = currentTrack?.id === track.id;
                                      const isCurrentPlaying = isCurrentActive && isPlaying;
                                      const addedDateStr = formatAddedDate(track);

                                      return (
                                        <tr
                                          key={track.id}
                                          className={`hover:bg-white/5 transition-colors group ${
                                            isCurrentActive ? 'bg-brand-gold/10' : ''
                                          }`}
                                        >
                                          {/* Track # & Play Button */}
                                          <td className="py-3 px-3 text-center">
                                            <button
                                              onClick={() => playTrack(track)}
                                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                                isCurrentPlaying
                                                  ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/30 scale-105'
                                                  : 'bg-white/5 group-hover:bg-brand-gold group-hover:text-black text-neutral-400'
                                              }`}
                                              title={isCurrentPlaying ? 'Pause song' : 'Listen to song'}
                                            >
                                              {isCurrentPlaying ? (
                                                <Pause className="w-3.5 h-3.5 fill-current" />
                                              ) : (
                                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                              )}
                                            </button>
                                          </td>

                                          {/* Title, Artist, & Live Waveform Indicator */}
                                          <td className="py-3 px-3">
                                            <div className="flex items-center gap-3">
                                              {/* Mini Cover with quick change trigger */}
                                              <div
                                                onClick={() => {
                                                  setCoverModalTrack(track);
                                                  setCoverModalAlbum(album.albumTitle);
                                                  setIsAlbumCoverMode(false);
                                                }}
                                                className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900 cursor-pointer group/art"
                                                title="Click to change cover art"
                                              >
                                                <Image
                                                  src={track.coverUrl}
                                                  alt={track.title}
                                                  fill
                                                  className="object-cover"
                                                  unoptimized={Boolean(track.coverUrl && (track.coverUrl.startsWith('data:') || track.coverUrl.startsWith('blob:')))}
                                                  onError={(e) => {
                                                    (e.target as any).src = '/images/chancetekone_banner.png';
                                                  }}
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                                                  <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                                                </div>
                                              </div>

                                              <div className="min-w-0 font-sans">
                                                <div className="flex items-center gap-2">
                                                  <p
                                                    className={`font-bold truncate text-xs sm:text-sm ${
                                                      isCurrentActive
                                                        ? 'text-brand-gold font-extrabold'
                                                        : 'text-white group-hover:text-brand-gold'
                                                    } transition-colors`}
                                                  >
                                                    {track.title}
                                                  </p>

                                                  {/* Animated equalizer bars when playing */}
                                                  {isCurrentPlaying && (
                                                    <span className="flex items-center gap-0.5 h-3 shrink-0">
                                                      <span className="w-0.5 h-full bg-brand-gold animate-pulse rounded-full" />
                                                      <span className="w-0.5 h-2 bg-brand-gold animate-bounce rounded-full delay-75" />
                                                      <span className="w-0.5 h-3 bg-brand-gold animate-pulse rounded-full delay-150" />
                                                    </span>
                                                  )}
                                                </div>

                                                <p className="text-[10px] text-neutral-400 truncate">
                                                  {track.artistName} {track.bpm ? `• ${track.bpm} BPM` : ''}
                                                </p>
                                              </div>
                                            </div>
                                          </td>

                                          {/* Added Date Display */}
                                          <td className="py-3 px-3 text-neutral-300 font-mono text-[11px] whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                                              <span>{addedDateStr}</span>
                                            </div>
                                          </td>

                                          {/* Genre / Crate */}
                                          <td className="py-3 px-3">
                                            <div className="flex flex-col gap-1 items-start font-sans">
                                              <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 text-[10px] border border-white/10 whitespace-nowrap">
                                                {track.genre}
                                              </span>
                                              <div className="relative group/crate inline-flex items-center">
                                                <select
                                                  value={track.crateId || 'direct-music-library'}
                                                  onChange={(e) => handleQuickCrateChange(track, e.target.value)}
                                                  className="text-[9px] font-mono py-0.5 pl-2 pr-4 rounded-md bg-brand-gold/10 text-brand-gold border border-brand-gold/30 hover:border-brand-gold cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                                                  title="Change Crate in Real Time"
                                                >
                                                  <option value="direct-music-library" className="bg-[#1b122c] text-white">
                                                    📦 Direct Music Library
                                                  </option>
                                                  {officialCrates
                                                    .filter((c) => c.id !== 'direct-music-library')
                                                    .map((c) => (
                                                      <option key={c.id} value={c.id} className="bg-[#1b122c] text-white">
                                                        🗃️ {c.name}
                                                      </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-2.5 h-2.5 text-brand-gold absolute right-1 pointer-events-none opacity-60" />
                                              </div>
                                            </div>
                                          </td>

                                          {/* Duration */}
                                          <td className="py-3 px-3 text-right text-neutral-400 font-mono whitespace-nowrap">
                                            {Math.floor((track.duration || 180) / 60)}:
                                            {String((track.duration || 180) % 60).padStart(2, '0')}
                                          </td>

                                          {/* Real-time Actions: Listen, Change Art, Edit Metadata, Delete */}
                                          <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5 font-sans">
                                              {/* 1. Listen Action */}
                                              <button
                                                type="button"
                                                onClick={() => playTrack(track)}
                                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                  isCurrentPlaying
                                                    ? 'bg-brand-gold text-black border-brand-gold shadow-md'
                                                    : 'bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border-white/10'
                                                }`}
                                                title={isCurrentPlaying ? 'Pause song' : 'Listen to song'}
                                              >
                                                {isCurrentPlaying ? (
                                                  <Pause className="w-3.5 h-3.5" />
                                                ) : (
                                                  <Play className="w-3.5 h-3.5" />
                                                )}
                                                <span>{isCurrentPlaying ? 'Playing' : 'Listen'}</span>
                                              </button>

                                              {/* 2. Change Cover Art */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCoverModalTrack(track);
                                                  setCoverModalAlbum(album.albumTitle);
                                                  setIsAlbumCoverMode(false);
                                                }}
                                                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple/20 text-neutral-300 hover:text-brand-purple border border-white/10 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                                title="Change cover artwork for this song"
                                              >
                                                <ImageIcon className="w-3.5 h-3.5 text-brand-purple" />
                                                <span className="hidden md:inline">Cover Art</span>
                                              </button>

                                              {/* Revert Custom Cover Art */}
                                              {MusicCatalogService.hasCustomCover(track) && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const prevCover = track.coverUrl;
                                                    const success = MusicCatalogService.revertTrackCover(track.id, adminActor);
                                                    if (success) {
                                                      syncCatalog();
                                                      showToast(
                                                        `Reverted "${track.title}" back to authentic original artwork.`,
                                                        () => {
                                                          if (prevCover) {
                                                            MusicCatalogService.updateTrackCover(
                                                              track.id,
                                                              prevCover,
                                                              adminActor
                                                            );
                                                            syncCatalog();
                                                          }
                                                        }
                                                      );
                                                    }
                                                  }}
                                                  className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                                  title="Revert this song back to authentic original studio cover art"
                                                >
                                                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                                  <span className="hidden md:inline">Revert</span>
                                                </button>
                                              )}

                                              {/* 3. Edit Metadata & Description */}
                                              <button
                                                type="button"
                                                onClick={() => setMetadataModalTrack(track)}
                                                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-400 border border-white/10 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                                title="Edit song title, artist, album, genre, BPM, and descriptions"
                                              >
                                                <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                                                <span className="hidden md:inline">Edit Info</span>
                                              </button>

                                              {/* 4. Delete From Platform */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setItemToDelete({
                                                    type: 'song',
                                                    id: track.id,
                                                    title: track.title,
                                                    subtitle: `${track.artistName} • ${track.albumTitle || 'Single'}`,
                                                    coverUrl: track.coverUrl,
                                                    meta: `${track.genre} • Added: ${addedDateStr}`,
                                                  })
                                                }
                                                className="px-2.5 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                                                title="Permanently remove from live platform"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span className="hidden md:inline">Delete</span>
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* FLAT LIST VIEW (Alternative presentation)                                 */
        /* ========================================================================= */
        <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-4">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Song / Artist</th>
                  <th className="py-3 px-3">Album</th>
                  <th className="py-3 px-3">Added Date</th>
                  <th className="py-3 px-3">Genre / Crate</th>
                  <th className="py-3 px-3 text-right">Duration</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filteredTracks.map((t, idx) => {
                  if (!t) return null;
                  const isCurrentActive = currentTrack?.id === t.id;
                  const isCurrentPlaying = isCurrentActive && isPlaying;
                  const addedDateStr = formatAddedDate(t);

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-white/5 transition-colors group ${
                        isCurrentActive ? 'bg-brand-gold/10' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => playTrack(t)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isCurrentPlaying
                              ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/30'
                              : 'bg-white/5 group-hover:bg-brand-gold group-hover:text-black text-neutral-400'
                          }`}
                        >
                          {isCurrentPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => {
                              setCoverModalTrack(t);
                              setCoverModalAlbum(t.albumTitle);
                              setIsAlbumCoverMode(false);
                            }}
                            className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900 cursor-pointer"
                          >
                            <Image
                              src={t.coverUrl}
                              alt={t.title}
                              fill
                              className="object-cover"
                              unoptimized={Boolean(t.coverUrl && (t.coverUrl.startsWith('data:') || t.coverUrl.startsWith('blob:')))}
                              onError={(e) => {
                                (e.target as any).src = '/images/chancetekone_banner.png';
                              }}
                            />
                          </div>
                          <div className="min-w-0 font-sans">
                            <p className="font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                              {t.title}
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {t.artistName} {t.bpm ? `• ${t.bpm} BPM` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-neutral-300 font-sans">{t.albumTitle || 'Single'}</td>
                      <td className="py-3 px-3 text-neutral-300 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                          <span>{addedDateStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start font-sans">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 text-[10px] border border-white/10">
                            {t.genre}
                          </span>
                          <div className="relative group/crate inline-flex items-center">
                            <select
                              value={t.crateId || 'direct-music-library'}
                              onChange={(e) => handleQuickCrateChange(t, e.target.value)}
                              className="text-[9px] font-mono py-0.5 pl-2 pr-4 rounded-md bg-brand-gold/10 text-brand-gold border border-brand-gold/30 hover:border-brand-gold cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-brand-gold transition-colors"
                              title="Change Crate in Real Time"
                            >
                              <option value="direct-music-library" className="bg-[#1b122c] text-white">
                                📦 Direct Music Library
                              </option>
                              {officialCrates
                                .filter((c) => c.id !== 'direct-music-library')
                                .map((c) => (
                                  <option key={c.id} value={c.id} className="bg-[#1b122c] text-white">
                                    🗃️ {c.name}
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 text-brand-gold absolute right-1 pointer-events-none opacity-60" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-neutral-400">
                        {Math.floor((t.duration || 180) / 60)}:
                        {String((t.duration || 180) % 60).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => playTrack(t)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border border-white/10 text-xs font-semibold flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCoverModalTrack(t);
                              setCoverModalAlbum(t.albumTitle);
                              setIsAlbumCoverMode(false);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple/20 text-neutral-300 hover:text-brand-purple border border-white/10 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Change cover artwork"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-brand-purple" />
                            <span>Art</span>
                          </button>

                          {MusicCatalogService.hasCustomCover(t) && (
                            <button
                              type="button"
                              onClick={() => {
                                const prevCover = t.coverUrl;
                                const success = MusicCatalogService.revertTrackCover(t.id, adminActor);
                                if (success) {
                                  syncCatalog();
                                  showToast(
                                    `Reverted "${t.title}" back to authentic original artwork.`,
                                    () => {
                                      if (prevCover) {
                                        MusicCatalogService.updateTrackCover(
                                          t.id,
                                          prevCover,
                                          adminActor
                                        );
                                        syncCatalog();
                                      }
                                    }
                                  );
                                }
                              }}
                              className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Revert back to authentic original artwork"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              <span>Revert</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setMetadataModalTrack(t)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-400 border border-white/10 text-xs font-semibold flex items-center gap-1"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setItemToDelete({
                                type: 'song',
                                id: t.id,
                                title: t.title,
                                subtitle: `${t.artistName} • ${t.albumTitle || 'Single'}`,
                                coverUrl: t.coverUrl,
                                meta: `${t.genre} • Added: ${addedDateStr}`,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PERSISTENT INLINE AUDITION PLAYER DECK                                  */}
      {/* ========================================================================= */}
      {currentTrack && (
        <div className="fixed bottom-4 left-4 right-4 md:left-72 md:right-8 z-40 p-4 rounded-3xl bg-[#120a1f]/95 backdrop-blur-xl border border-brand-purple/50 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-3.5 min-w-0 w-full md:w-1/3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900 shadow-md">
                <Image
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  fill
                  className="object-cover"
                  unoptimized={Boolean(currentTrack.coverUrl && (currentTrack.coverUrl.startsWith('data:') || currentTrack.coverUrl.startsWith('blob:')))}
                  onError={(e) => {
                    (e.target as any).src = '/images/chancetekone_banner.png';
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-white text-sm truncate">
                    {currentTrack.title}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                    Live Audition
                  </span>
                </div>
                <p className="text-xs text-neutral-300 truncate">
                  {currentTrack.artistName} •{' '}
                  <span className="text-neutral-400">{currentTrack.albumTitle || 'Single'}</span>
                </p>
              </div>
            </div>

            {/* Transport & Scrubber */}
            <div className="flex flex-col items-center gap-1.5 w-full md:w-1/2">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                    }
                  }}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                  title="Restart track"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => playTrack(currentTrack)}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-brand-gold to-amber-500 text-black flex items-center justify-center shadow-lg shadow-brand-gold/30 hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                {/* Animated Equalizer Waveform */}
                <div className="flex items-center gap-1 h-5 px-2">
                  {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8, 0.5].map((scale, i) => (
                    <span
                      key={i}
                      className={`w-0.5 bg-brand-gold rounded-full transition-all duration-150 ${
                        isPlaying ? 'animate-pulse' : 'opacity-40'
                      }`}
                      style={{
                        height: isPlaying ? `${Math.max(4, scale * 20)}px` : '4px',
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Progress Slider */}
              <div className="w-full flex items-center gap-2 font-mono text-[10px] text-neutral-400">
                <span className="w-8 text-right">
                  {Math.floor(currentTime / 60)}:
                  {String(Math.floor(currentTime % 60)).padStart(2, '0')}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || currentTrack.duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-brand-gold h-1 bg-white/20 rounded-full cursor-pointer"
                />
                <span className="w-8">
                  {Math.floor((duration || currentTrack.duration || 0) / 60)}:
                  {String(Math.floor((duration || currentTrack.duration || 0) % 60)).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Volume & Close */}
            <div className="flex items-center justify-end gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-brand-gold" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 accent-brand-gold h-1 bg-white/20 rounded-full cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  audioRef.current?.pause();
                  setCurrentTrack(null);
                  setIsPlaying(false);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS: COVER ART, METADATA, & REMOVAL                                  */}
      {/* ========================================================================= */}
      <PlatformChangeCoverArtModal
        isOpen={Boolean(coverModalTrack)}
        onClose={() => {
          setCoverModalTrack(null);
          setCoverModalAlbum(undefined);
          setIsAlbumCoverMode(false);
        }}
        track={coverModalTrack}
        albumTitle={coverModalAlbum}
        isAlbumMode={isAlbumCoverMode}
        onSuccess={(msg, onUndo) => showToast(msg, onUndo)}
        adminActor={adminActor}
      />

      <EditTrackMetadataModal
        isOpen={Boolean(metadataModalTrack)}
        onClose={() => setMetadataModalTrack(null)}
        track={metadataModalTrack}
        onSuccess={(msg) => showToast(msg)}
        adminActor={adminActor}
      />

      <ConfirmDeletionModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmRemoval}
        item={itemToDelete}
      />
    </div>
    </ErrorBoundary>
  );
};

