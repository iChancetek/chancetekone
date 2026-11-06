'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ShareTrackModal } from '@/components/media/ShareTrackModal';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { isTrackMatchingGenre, PLATFORM_STANDARD_GENRES } from '@/lib/music/genreClassifier';
import { matchesTrackSearch } from '@/lib/search/universalSearch';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  Music,
  Disc3,
  User,
  Search,
  Play,
  Pause,
  Share2,
  ListPlus,
  Calendar,
  Layers,
  ListFilter,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Disc,
  MessageSquare,
} from 'lucide-react';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';
import { ReactionButtons } from '@/components/social/ReactionButtons';

interface PublicMusicCatalogSectionProps {
  tracks: Track[];
  selectedGenre?: string;
  onSelectGenre?: (genre: string) => void;
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

export const PublicMusicCatalogSection: React.FC<PublicMusicCatalogSectionProps> = ({
  tracks,
  selectedGenre = 'Genre',
  onSelectGenre,
}) => {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [internalGenre, setInternalGenre] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Accordion Expand/Collapse State
  const [expandedArtists, setExpandedArtists] = useState<Record<string, boolean>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Record<string, boolean>>({});

  // Modals state
  const [shareTrackTarget, setShareTrackTarget] = useState<Track | null>(null);
  const [playlistTrackTarget, setPlaylistTrackTarget] = useState<Track | null>(null);
  const [discussionTarget, setDiscussionTarget] = useState<{
    id: string;
    key?: string;
    type: any;
    title: string;
    subtitle?: string;
    coverUrl?: string;
    badge: string;
  } | null>(null);
  const [, setCommentsTick] = useState(0);

  React.useEffect(() => {
    const unsub = SocialCommentService.subscribeAll(() => {
      setCommentsTick((t) => t + 1);
    });
    return () => unsub();
  }, []);

  // Helper to format date
  const formatAddedDate = (t: Track): string => {
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
    if (!Array.isArray(tracks)) return [];
    return tracks.filter((t) => {
      if (!t) return false;
      const matchSearch = matchesTrackSearch(t, searchQuery);

      const effectiveGenre = internalGenre !== 'all' ? internalGenre : selectedGenre;
      const matchGenre = isTrackMatchingGenre(
        t.genre,
        effectiveGenre,
        t.crateId,
        t.artistName,
        t.title
      );

      return matchSearch && matchGenre;
    });
  }, [tracks, searchQuery, internalGenre, selectedGenre]);

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
        albumTracks.sort((a, b) => {
          if (a.trackNumber && b.trackNumber) return Number(a.trackNumber) - Number(b.trackNumber);
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

        const firstTrack = albumTracks[0];
        const albumCover = MusicCatalogService.resolveAlbumCover({
          title: albumTitle,
          artistName,
          coverUrl: firstTrack.coverUrl,
          genre: firstTrack.genre,
        });
        albums.push({
          albumTitle,
          coverUrl: albumCover,
          releaseYear: Number(firstTrack.releaseYear) || 2026,
          genre: String(firstTrack.genre || 'R&B / Soul'),
          tracks: albumTracks,
        });
      });

      albums.sort((a, b) => {
        if (a.albumTitle === 'Singles & Vault Cuts') return 1;
        if (b.albumTitle === 'Singles & Vault Cuts') return -1;
        return String(a.albumTitle || '').localeCompare(String(b.albumTitle || ''));
      });

      const avatarUrl = albums[0]?.coverUrl || '/images/8_of_spades_works_banner.png';

      groups.push({
        artistName,
        avatarUrl,
        totalSongs: value.tracks.length,
        totalAlbums: albums.length,
        albums,
      });
    });

    groups.sort((a, b) => String(a.artistName || '').localeCompare(String(b.artistName || '')));
    return groups;
  }, [filteredTracks]);

  // Total metrics
  const totalSongsCount = tracks.length;
  const totalArtistsCount = new Set(tracks.map((t) => String(t?.artistName || '').toLowerCase().trim())).size;
  const totalAlbumsCount = new Set(
    tracks.map((t) => `${String(t?.artistName || '').toLowerCase().trim()}:::${String(t?.albumTitle || '').toLowerCase().trim()}`)
  ).size;

  // Available genres
  const availableGenres = useMemo(() => {
    return Array.from(PLATFORM_STANDARD_GENRES);
  }, []);

  // Expand / Collapse
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

  // Play handler
  const handlePlaySong = (track: Track, albumTracks?: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, albumTracks || filteredTracks);
    }
  };

  return (
    <ErrorBoundary
      title="Music Catalog Search Interrupted"
      description="A temporary rendering issue occurred while searching or filtering the music catalog. Reset your search to view the full library."
      onReset={() => {
        setSearchQuery('');
        setInternalGenre('all');
      }}
    >
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* ========================================================================= */}
        {/* 1. CATALOG METRICS & CONTROLS TOOLBAR                                     */}
        {/* ========================================================================= */}
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-gradient-to-r from-[#170e28]/95 via-[#0e091a]/95 to-[#080511]/95 shadow-xl space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
            {/* Title & Counters */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center text-brand-gold shadow-lg shadow-brand-gold/10">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    The Lounge Discography
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
                      Artist & Album Format
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Stream authentic studio albums, share tracks, and add songs directly to your personal crates & playlists
                  </p>
                </div>
              </div>

              {/* Metrics Pills */}
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
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Expand all artists and albums"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>

              <button
                onClick={collapseAll}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Collapse all artists and albums"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>

              <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'grouped'
                      ? 'bg-brand-gold text-black shadow-md'
                      : 'text-neutral-400 hover:text-white'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Artist & Album Grouped</span>
                </button>

                <button
                  onClick={() => setViewMode('flat')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'flat'
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

          {/* Search & Filter Inputs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={internalGenre}
                onChange={(e) => {
                  setInternalGenre(e.target.value);
                  if (onSelectGenre) onSelectGenre(e.target.value);
                }}
                className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-neutral-200 text-xs focus:border-brand-gold focus:outline-none"
              >
                <option value="all">All Genres & Crates</option>
                {availableGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <span className="text-[11px] text-neutral-400 font-mono whitespace-nowrap hidden sm:inline">
                Showing {filteredTracks.length} of {totalSongsCount}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. ARTIST & GROUPED ALBUM FORMAT                                          */}
        {/* ========================================================================= */}
        {viewMode === 'grouped' ? (
          <div className="space-y-6">
            {artistGroups.length === 0 ? (
              <div className="p-12 rounded-3xl glass-panel border border-white/5 text-center space-y-3">
                <Music className="w-12 h-12 text-neutral-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No songs found</h3>
                <p className="text-xs text-neutral-400">
                  Try adjusting your search query or crate filter.
                </p>
              </div>
            ) : (
              artistGroups.map((artist) => {
                const isArtistExpanded = expandedArtists[artist.artistName] !== false;

                return (
                  <div
                    key={artist.artistName}
                    className="rounded-3xl glass-panel border border-white/10 bg-white/[0.02] overflow-hidden transition-all shadow-xl hover:border-brand-gold/30"
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
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight">
                              {artist.artistName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                              Artist Discography
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
                      <div className="p-4 sm:p-6 space-y-6 bg-black/25 animate-in fade-in duration-200">
                        {artist.albums.map((album) => {
                          const albumKey = `${artist.artistName}:::${album.albumTitle}`;
                          const isAlbumExpanded = expandedAlbums[albumKey] !== false;
                          const isAlbumPlaying =
                            isPlaying &&
                            currentTrack &&
                            album.tracks.some((t) => t.id === currentTrack.id);

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
                                  {/* Album Jacket Cover */}
                                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900 shadow-md group">
                                    <Image
                                      src={album.coverUrl}
                                      alt={album.albumTitle}
                                      fill
                                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                                      unoptimized={Boolean(album.coverUrl && (album.coverUrl.startsWith('data:') || album.coverUrl.startsWith('blob:')))}
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Disc className="w-5 h-5 text-brand-gold animate-spin-slow" />
                                    </div>
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
                                  {(() => {
                                    const canonicalAlbumKey = buildCanonicalContentKey('album', album.albumTitle, artist.artistName);
                                    const albumId = `album-${album.albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                                    const albumCommentCount = SocialCommentService.getCommentCount(albumId, canonicalAlbumKey);
                                    return (
                                      <>
                                        <ReactionButtons
                                          contentId={albumId}
                                          contentKey={canonicalAlbumKey}
                                          contentType="album"
                                          contentTitle={`${album.albumTitle} (${artist.artistName})`}
                                          contextLocation="The Lounge Discography - Album Header"
                                          variant="compact"
                                          showShare={false}
                                        />

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDiscussionTarget({
                                              id: albumId,
                                              key: canonicalAlbumKey,
                                              type: 'album',
                                              title: album.albumTitle,
                                              subtitle: `Album collection by ${artist.artistName} • ${album.tracks.length} tracks`,
                                              coverUrl: album.coverUrl,
                                              badge: 'Album',
                                            })
                                          }
                                          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                          title={`${albumCommentCount} Comments & Threads on ${album.albumTitle}`}
                                        >
                                          <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                                          <span className="font-mono font-bold text-[11px]">{albumCommentCount}</span>
                                          <span className="hidden sm:inline text-[11px]">Discuss</span>
                                        </button>
                                      </>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() => handlePlaySong(album.tracks[0], album.tracks)}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-gold/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    title="Play all songs in this album"
                                  >
                                    {isAlbumPlaying ? (
                                      <>
                                        <Pause className="w-3.5 h-3.5 fill-black" />
                                        <span>Playing Album</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                                        <span>Play Album</span>
                                      </>
                                    )}
                                  </button>

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
                                            className={`hover:bg-white/5 transition-colors group ${isCurrentActive ? 'bg-brand-gold/10' : ''
                                              }`}
                                          >
                                            {/* Track # & Play Button */}
                                            <td className="py-3 px-3 text-center">
                                              <button
                                                onClick={() => handlePlaySong(track, album.tracks)}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isCurrentPlaying
                                                    ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/30 scale-105'
                                                    : 'bg-white/5 group-hover:bg-brand-gold group-hover:text-black text-neutral-400'
                                                  }`}
                                                title={isCurrentPlaying ? 'Pause song' : 'Play song'}
                                              >
                                                {isCurrentPlaying ? (
                                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                                ) : (
                                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                                )}
                                              </button>
                                            </td>

                                            {/* Title, Artist, & Live Equalizer Waveform */}
                                            <td className="py-3 px-3">
                                              <div className="flex items-center gap-3">
                                                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                                                  <Image
                                                    src={track.coverUrl || album.coverUrl}
                                                    alt={track.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized={Boolean((track.coverUrl || album.coverUrl) && ((track.coverUrl || album.coverUrl).startsWith('data:') || (track.coverUrl || album.coverUrl).startsWith('blob:')))}
                                                  />
                                                </div>

                                                <div className="min-w-0 font-sans">
                                                  <div className="flex items-center gap-2">
                                                    <p
                                                      onClick={() => handlePlaySong(track, album.tracks)}
                                                      className={`font-bold truncate text-xs sm:text-sm cursor-pointer ${isCurrentActive
                                                          ? 'text-brand-gold font-extrabold'
                                                          : 'text-white group-hover:text-brand-gold'
                                                        } transition-colors`}
                                                    >
                                                      {track.title}
                                                    </p>

                                                    {/* Animated equalizer bars when active */}
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
                                              <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 text-[10px] border border-white/10 whitespace-nowrap font-sans">
                                                {track.genre}
                                              </span>
                                            </td>

                                            {/* Duration */}
                                            <td className="py-3 px-3 text-right text-neutral-400 font-mono whitespace-nowrap">
                                              {Math.floor((track.duration || 180) / 60)}:
                                              {String((track.duration || 180) % 60).padStart(2, '0')}
                                            </td>

                                            {/* Actions: Play, Share, Add to Playlist */}
                                            <td className="py-3 px-3 text-right whitespace-nowrap">
                                              <div className="flex items-center justify-end gap-1.5 font-sans">
                                                {/* 1. Play Song */}
                                                <button
                                                  type="button"
                                                  onClick={() => handlePlaySong(track, album.tracks)}
                                                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${isCurrentPlaying
                                                      ? 'bg-brand-gold text-black border-brand-gold shadow-md'
                                                      : 'bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border-white/10'
                                                    }`}
                                                  title={isCurrentPlaying ? 'Pause song' : 'Play song'}
                                                >
                                                  {isCurrentPlaying ? (
                                                    <Pause className="w-3.5 h-3.5" />
                                                  ) : (
                                                    <Play className="w-3.5 h-3.5" />
                                                  )}
                                                  <span>{isCurrentPlaying ? 'Playing' : 'Play'}</span>
                                                </button>

                                                {/* 2. Share Track */}
                                                <button
                                                  type="button"
                                                  onClick={() => setShareTrackTarget(track)}
                                                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                                  title="Share this song to social media or copy link"
                                                >
                                                  <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                                                  <span className="hidden md:inline">Share</span>
                                                </button>

                                                {/* 3. Add to Playlist */}
                                                <button
                                                  type="button"
                                                  onClick={() => setPlaylistTrackTarget(track)}
                                                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple/20 text-neutral-300 hover:text-brand-purple border border-white/10 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                                  title="Add this song to your custom crates & playlists"
                                                >
                                                  <ListPlus className="w-3.5 h-3.5 text-brand-purple" />
                                                  <span className="hidden md:inline">Add to Playlist</span>
                                                </button>

                                                {/* 4. Emoji Reactions & Discussion Comments */}
                                                {(() => {
                                                  const trackKey = buildCanonicalContentKey('song', track.title, track.artistName);
                                                  const count = SocialCommentService.getCommentCount(track.id, trackKey);
                                                  return (
                                                    <>
                                                      <ReactionButtons
                                                        contentId={track.id}
                                                        contentKey={trackKey}
                                                        contentType="music"
                                                        contentTitle={`${track.title} (${track.artistName})`}
                                                        contextLocation="The Lounge Discography - Grouped Table"
                                                        initialLikes={track.likeCount}
                                                        variant="minimal"
                                                        showShare={false}
                                                      />

                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setDiscussionTarget({
                                                            id: track.id,
                                                            key: trackKey,
                                                            type: 'song',
                                                            title: track.title,
                                                            subtitle: `${track.artistName} • ${album.albumTitle}`,
                                                            coverUrl: track.coverUrl || album.coverUrl,
                                                            badge: 'Song',
                                                          })
                                                        }
                                                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                                        title={`${count} Discussion Comments & Threads on ${track.title}`}
                                                      >
                                                        <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                                                        <span className="font-mono font-bold text-[11px]">{count}</span>
                                                        <span className="hidden xl:inline text-[11px]">Discuss</span>
                                                      </button>
                                                    </>
                                                  );
                                                })()}
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
                        className={`hover:bg-white/5 transition-colors group ${isCurrentActive ? 'bg-brand-gold/10' : ''
                          }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handlePlaySong(t, filteredTracks)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isCurrentPlaying
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
                            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                              <Image
                                src={t.coverUrl}
                                alt={t.title}
                                fill
                                className="object-cover"
                                unoptimized={Boolean(t.coverUrl && (t.coverUrl.startsWith('data:') || t.coverUrl.startsWith('blob:')))}
                              />
                            </div>
                            <div className="min-w-0 font-sans">
                              <p
                                onClick={() => handlePlaySong(t, filteredTracks)}
                                className="font-bold text-white truncate group-hover:text-brand-gold transition-colors cursor-pointer"
                              >
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
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 text-[10px] border border-white/10 font-sans">
                            {t.genre}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-neutral-400">
                          {Math.floor((t.duration || 180) / 60)}:
                          {String((t.duration || 180) % 60).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePlaySong(t, filteredTracks)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border border-white/10 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Play</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setShareTrackTarget(t)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                              <span>Share</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPlaylistTrackTarget(t)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple/20 text-neutral-300 hover:text-brand-purple border border-white/10 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <ListPlus className="w-3.5 h-3.5 text-brand-purple" />
                              <span>Add</span>
                            </button>

                            {/* Flat list emojis & discussion */}
                            {(() => {
                              const trackKey = buildCanonicalContentKey('song', t.title, t.artistName);
                              const count = SocialCommentService.getCommentCount(t.id, trackKey);
                              return (
                                <>
                                  <ReactionButtons
                                    contentId={t.id}
                                    contentKey={trackKey}
                                    contentType="music"
                                    contentTitle={`${t.title} (${t.artistName})`}
                                    contextLocation="The Lounge Discography - Flat Table"
                                    initialLikes={t.likeCount}
                                    variant="minimal"
                                    showShare={false}
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDiscussionTarget({
                                        id: t.id,
                                        key: trackKey,
                                        type: 'song',
                                        title: t.title,
                                        subtitle: `${t.artistName} • ${t.albumTitle || 'Single'}`,
                                        coverUrl: t.coverUrl,
                                        badge: 'Song',
                                      })
                                    }
                                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                    title={`${count} Discussion Comments & Threads on ${t.title}`}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                                    <span className="font-mono font-bold text-[11px]">{count}</span>
                                    <span className="hidden xl:inline text-[11px]">Discuss</span>
                                  </button>
                                </>
                              );
                            })()}
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
        {/* 3. MODALS: SHARE TRACK & ADD TO PLAYLIST & DISCUSSION                      */}
        {/* ========================================================================= */}
        <ShareTrackModal
          isOpen={Boolean(shareTrackTarget)}
          onClose={() => setShareTrackTarget(null)}
          track={shareTrackTarget}
        />

        {playlistTrackTarget && (
          <AddToPlaylistModal
            isOpen={Boolean(playlistTrackTarget)}
            onClose={() => setPlaylistTrackTarget(null)}
            mediaItem={{
              mediaId: playlistTrackTarget.id,
              mediaType: 'music',
              title: playlistTrackTarget.title,
              artistName: playlistTrackTarget.artistName,
              coverUrl: playlistTrackTarget.coverUrl || '/images/8_of_spades_works_banner.png',
              duration: playlistTrackTarget.duration,
            }}
          />
        )}

        {discussionTarget && (
          <UniversalDiscussionModal
            isOpen={Boolean(discussionTarget)}
            onClose={() => setDiscussionTarget(null)}
            contentId={discussionTarget.id}
            contentKey={discussionTarget.key}
            contentType={discussionTarget.type}
            contentTitle={discussionTarget.title}
            contentSubtitle={discussionTarget.subtitle}
            coverUrl={discussionTarget.coverUrl}
            badgeLabel={discussionTarget.badge}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

