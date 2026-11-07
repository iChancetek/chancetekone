'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Library,
  Heart,
  ArrowLeft,
  History,
  ListMusic,
  Video as VideoIcon,
  BookOpen,
  Sparkles,
  Play,
  Trash2,
  Clock,
  Music,
  LogIn,
  Users,
  Sliders,
  FolderKanban,
  Disc3,
  ArrowRight,
  Plus,
  CheckCircle2,
  Globe,
  Lock,
  Share2,
  Edit,
  RotateCcw,
} from 'lucide-react';
import { CreatePlaylistModal } from '@/components/playlist/CreatePlaylistModal';
import { EditPlaylistModal } from '@/components/playlist/EditPlaylistModal';
import { SharePlaylistModal } from '@/components/playlist/SharePlaylistModal';
import {
  MOCK_TRACKS,
  MOCK_ALBUMS,
  MOCK_VIDEOS,
  MOCK_AUDIOBOOKS,
  MOCK_ARTISTS,
  MOCK_PRODUCERS,
  MOCK_PROJECTS,
} from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { TrackRow } from '@/components/media/TrackRow';
import { MediaCard } from '@/components/media/MediaCard';
import { HistoryService, HistoryEntry } from '@/lib/history/HistoryService';
import { FavoritesService, FavoriteItem } from '@/lib/favorites/FavoritesService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { Playlist } from '@/types/playlist';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { AuthModal } from '@/components/auth/AuthModal';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

type LibraryTabKey =
  | 'music'
  | 'videos'
  | 'playlists'
  | 'artists'
  | 'producers'
  | 'projects'
  | 'audiobooks'
  | 'history';

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as LibraryTabKey) || 'music';

  const [activeTab, setActiveTab] = useState<LibraryTabKey>(initialTab);
  const { likedTrackIds, playTrack, openVideoModal, playAudiobookChapter } = usePlayer();
  const { profile, user, isAdmin } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showCreateCrateModal, setShowCreateCrateModal] = useState(false);
  const [editCrateTarget, setEditCrateTarget] = useState<Playlist | null>(null);
  const [shareCrateTarget, setShareCrateTarget] = useState<Playlist | null>(null);
  const [deleteCrateId, setDeleteCrateId] = useState<string | null>(null);

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : 'guest');
  const isAuthenticated = Boolean(profile || user || isAdmin);

  const handleResetEntireLibrary = () => {
    if (confirm('Clear all favorited items and playback history from your library?')) {
      FavoritesService.clearFavorites(currentUserId);
      setFavorites([]);
      if (profile?.id) {
        HistoryService.clearHistory(profile.id);
        setHistory([]);
      }
    }
  };

  // Load user data & subscriptions
  useEffect(() => {
    // 1. History
    if (profile?.id) {
      setHistory(HistoryService.getHistory(profile.id));
      const unsubHistory = HistoryService.subscribe(profile.id, (updated) => {
        setHistory(updated);
      });
      return () => unsubHistory();
    } else {
      setHistory([]);
    }
  }, [profile?.id]);

  useEffect(() => {
    // 2. Favorites
    setFavorites(FavoritesService.getFavorites(currentUserId));
    const unsubFavorites = FavoritesService.subscribe(currentUserId, (updated) => {
      setFavorites(updated);
    });

    // 3. Playlists (owned + saved)
    const loadPlaylists = () => {
      if (currentUserId !== 'guest' || currentEmail || isAdmin) {
        const owned = PlaylistService.getUserPlaylists(currentUserId, currentEmail);
        const saved = PlaylistService.getSavedPlaylists(currentUserId);
        const combined = [...owned];
        saved.forEach((s) => {
          if (!combined.some((p) => p.id === s.id)) {
            combined.push(s);
          }
        });
        setUserPlaylists(combined);
      } else {
        setUserPlaylists([]);
      }
    };
    loadPlaylists();
    const unsubPlaylists = PlaylistService.subscribe(loadPlaylists);

    return () => {
      unsubFavorites();
      unsubPlaylists();
    };
  }, [currentUserId, currentEmail, isAdmin]);

  const [, setCatalogVersion] = useState(0);

  useEffect(() => {
    const syncCatalog = () => setCatalogVersion((v) => v + 1);
    const unsub = MusicCatalogService.subscribe(syncCatalog);
    window.addEventListener('catalog-updated', syncCatalog);
    window.addEventListener('storage', syncCatalog);
    return () => {
      unsub();
      window.removeEventListener('catalog-updated', syncCatalog);
      window.removeEventListener('storage', syncCatalog);
    };
  }, []);

  // Derive actual favorited catalog items (strictly real - zero synthetic data)
  const musicFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'music').map((f) => f.id)
  );
  // Also include tracks liked via player context
  likedTrackIds.forEach((id) => musicFavoriteIds.add(id));
  const favoriteTracks = MusicCatalogService.getAllTracks().filter((t) => musicFavoriteIds.has(t.id));
  const favoriteAlbums = MusicCatalogService.getAllAlbums().filter((a) => musicFavoriteIds.has(a.id));

  const videoFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'videos').map((f) => f.id)
  );
  const favoriteVideos = MOCK_VIDEOS.filter((v) => videoFavoriteIds.has(v.id));

  const playlistFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'playlists').map((f) => f.id)
  );
  const allFavoritePlaylists = userPlaylists.slice();
  playlistFavoriteIds.forEach((plId) => {
    if (!allFavoritePlaylists.some((p) => p.id === plId)) {
      const found = PlaylistService.getPlaylistById(plId);
      if (found?.playlist) allFavoritePlaylists.push(found.playlist);
    }
  });

  const artistFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'artists').map((f) => f.id)
  );
  const favoriteArtists = MOCK_ARTISTS.filter((a) => artistFavoriteIds.has(a.id));

  const producerFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'producers').map((f) => f.id)
  );
  const favoriteProducers = MOCK_PRODUCERS.filter((p) => producerFavoriteIds.has(p.id));

  const projectFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'projects').map((f) => f.id)
  );
  const favoriteProjects = MOCK_PROJECTS.filter((p) => projectFavoriteIds.has(p.id));

  const audiobookFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'audiobooks').map((f) => f.id)
  );
  const favoriteAudiobooks = MOCK_AUDIOBOOKS.filter((b) => audiobookFavoriteIds.has(b.id));

  const handlePlayHistoryItem = (entry: HistoryEntry) => {
    if (entry.mediaType === 'video') {
      const vid = MOCK_VIDEOS.find((v) => v.id === entry.mediaId) || {
        id: entry.mediaId,
        title: entry.title,
        artistId: 'artist-1',
        artistName: entry.subtitle,
        videoUrl: entry.videoUrl || '/videos/FatherTime4K.mp4',
        thumbnailUrl: entry.coverUrl,
        duration: entry.duration,
        views: 0,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
        description: 'Playback from history',
        category: '4K Video',
        releaseDate: '2026-03-01',
      };
      openVideoModal(vid);
    } else if (entry.mediaType === 'audiobook') {
      const book = MOCK_AUDIOBOOKS.find((b) => b.id === entry.mediaId);
      if (book && book.chapters[0]) {
        playAudiobookChapter(book, book.chapters[0]);
      }
    } else {
      const trk = MusicCatalogService.getTrackById(entry.mediaId) || MOCK_TRACKS.find((t) => t.id === entry.mediaId) || {
        id: entry.mediaId,
        title: entry.title,
        artistId: 'artist-1',
        artistName: entry.subtitle,
        audioUrl: entry.audioUrl || '/audio/Fort Apache.mp3',
        coverUrl: entry.coverUrl,
        duration: entry.duration,
        genre: 'Breakbeat',
        bpm: 130,
        playCount: 0,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
      };
      playTrack(trk);
    }
  };

  const handleClearHistory = () => {
    if (profile?.id && confirm('Are you sure you want to clear your listening and watch history?')) {
      HistoryService.clearHistory(profile.id);
    }
  };

  const tabsConfig = [
    { id: 'music', label: 'Favorite Music', count: favoriteTracks.length + favoriteAlbums.length, icon: Music },
    { id: 'videos', label: 'Favorite Videos', count: favoriteVideos.length, icon: VideoIcon },
    { id: 'playlists', label: 'Saved Crates', count: allFavoritePlaylists.length, icon: ListMusic },
    { id: 'artists', label: 'Artists', count: favoriteArtists.length, icon: Users },
    { id: 'producers', label: 'Producers', count: favoriteProducers.length, icon: Sliders },
    { id: 'projects', label: 'Projects', count: favoriteProjects.length, icon: FolderKanban },
    { id: 'audiobooks', label: 'Audiobookshelf', count: favoriteAudiobooks.length, icon: BookOpen },
    { id: 'history', label: 'Listening & Watch History', count: history.length, icon: History },
  ];

  return (
    <div className="space-y-8 py-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/music'))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon text-xs font-semibold uppercase tracking-wider mb-2">
              <Library className="w-3.5 h-3.5" />
              Personal Space
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Your Crate Library</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Your personal vault for all favorited music, 4K videos, curated crates, master producers, artists, projects, and cross-format playback history.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/studio"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-amber-600 text-black text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 fill-black" />
              <span>Creator Studio</span>
            </Link>

            {(favorites.length > 0 || history.length > 0) && (
              <button
                onClick={handleResetEntireLibrary}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
                title="Clear all favorited items and playback history"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clean Library</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pt-5 no-scrollbar">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as LibraryTabKey)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-black/20 text-black font-extrabold' : 'bg-white/10 text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Favorite Music Tab */}
      {activeTab === 'music' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                <Music className="w-4 h-4" />
                Favorite Tracks & Albums ({favoriteTracks.length + favoriteAlbums.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every track and album you liked with ❤️ or 🔥 across the platform.
              </p>
            </div>
            <Link
              href="/music"
              className="text-xs text-brand-gold hover:underline font-bold flex items-center gap-1"
            >
              <span>Explore Music Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteTracks.length === 0 && favoriteAlbums.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 text-brand-neon mx-auto flex items-center justify-center">
                <Music className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite tracks in your crate yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Explore the big beat music catalog and tap the ❤️ Heart or 🔥 Fire reaction on any song to store it here.
              </p>
              <Link
                href="/music"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gold text-black font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Browse Music Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {favoriteAlbums.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Favorited Albums</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoriteAlbums.map((album) => (
                      <MediaCard key={album.id} item={album} type="album" />
                    ))}
                  </div>
                </div>
              )}

              {favoriteTracks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Favorited Tracks</h4>
                  <div className="divide-y divide-white/5">
                    {favoriteTracks.map((track, i) => (
                      <TrackRow key={track.id} track={track} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Favorite Videos Tab */}
      {activeTab === 'videos' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <VideoIcon className="w-4 h-4" />
                Favorite 4K Videos ({favoriteVideos.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cinematic 4K videos you have liked or saved to your personal library.
              </p>
            </div>
            <Link
              href="/videos"
              className="text-xs text-rose-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>Explore 4K Videos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteVideos.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center">
                <VideoIcon className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite videos yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Watch 4K videos in the video theater and tap the ❤️ Heart or 🔥 Fire reaction to pin them directly into your personal crate.
              </p>
              <Link
                href="/videos"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Browse 4K Videos</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {favoriteVideos.map((video) => (
                <MediaCard key={video.id} item={video} type="video" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Saved Crates & Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <ListMusic className="w-4 h-4" />
                Saved Crates & Playlists ({allFavoritePlaylists.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Your custom created crates, shared playlists, and favorited collections.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthModalOpen(true);
                  else setShowCreateCrateModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Crate</span>
              </button>
              <Link
                href="/playlists"
                className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>Explore Public Crates</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {allFavoritePlaylists.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
                <ListMusic className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No saved crates in your library</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Create a custom playlist of mixed music and videos, or save community crates to keep them in your personal rotation.
              </p>
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthModalOpen(true);
                  else setShowCreateCrateModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gold text-black font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Crate</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {allFavoritePlaylists.map((pl) => {
                const isDeleting = deleteCrateId === pl.id;
                const isOwner = Boolean(
                  (profile?.id && pl.ownerId === profile.id) ||
                  (user?.uid && pl.ownerId === user.uid) ||
                  (currentEmail && pl.ownerEmail && currentEmail.toLowerCase() === pl.ownerEmail.toLowerCase())
                );
                const canManage = Boolean(isOwner || isAdmin);
                return (
                  <div
                    key={pl.id}
                    className="group relative glass-panel rounded-2xl p-4 border border-white/10 hover:border-brand-gold/50 transition-all flex flex-col justify-between space-y-3 bg-white/5"
                  >
                    {/* Delete Confirmation Overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 space-y-2 text-center animate-in fade-in">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <p className="text-xs font-bold text-white">Delete "{pl.name}"?</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setDeleteCrateId(null)}
                            className="px-3 py-1 rounded-full text-xs text-neutral-300 hover:text-white bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (currentUserId !== 'guest' || isAdmin) {
                                PlaylistService.deletePlaylist(pl.id, currentUserId, isAdmin, currentEmail);
                                setDeleteCrateId(null);
                                setUserPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
                              }
                            }}
                            className="px-3 py-1 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-900 shadow-md">
                      <Image
                        src={pl.coverUrl || '/images/logo.png'}
                        alt={pl.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Visibility Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 flex items-center gap-1">
                        {pl.visibility === 'private' ? (
                          <>
                            <Lock className="w-3 h-3 text-red-400" />
                            <span>Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 text-emerald-400" />
                            <span className="capitalize">{pl.visibility}</span>
                          </>
                        )}
                      </div>

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Link
                          href={`/playlists/${pl.id}`}
                          className="p-3 rounded-full bg-brand-gold text-black shadow-lg hover:scale-110 transition-transform"
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/playlists/${pl.id}`} className="hover:text-brand-gold transition-colors min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{pl.name}</h4>
                        </Link>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono shrink-0">
                          {pl.items.length} items
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{pl.description || `Curated by ${pl.ownerName}`}</p>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/playlists/${pl.id}`}
                          className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>

                        <button
                          onClick={() => setShareCrateTarget(pl)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
                          title="Share crate or manage members"
                        >
                          <Share2 className="w-3.5 h-3.5 text-brand-neon" />
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => setEditCrateTarget(pl)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
                              title="Edit crate settings"
                            >
                              <Edit className="w-3.5 h-3.5 text-brand-gold" />
                            </button>
                            <button
                              onClick={() => setDeleteCrateId(pl.id)}
                              className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                              title="Delete crate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <ReactionButtons
                        contentId={pl.id}
                        contentType="playlist"
                        variant="compact"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Favorite Artists Tab */}
      {activeTab === 'artists' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Favorite Artists ({favoriteArtists.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Artists and vocalists you have liked or followed.
              </p>
            </div>
            <Link
              href="/artists/artist-1"
              className="text-xs text-purple-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>Explore Artists</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteArtists.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite artists saved</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Visit artist profile pages and hit ❤️ or 🔥 to keep tabs on your favorite performers and beatmasters.
              </p>
              <Link
                href="/artists/artist-1"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Discover Artists</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {favoriteArtists.map((artist) => (
                <div
                  key={artist.id}
                  className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 hover:border-purple-500/40 transition-all bg-white/5"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-brand-gold shrink-0">
                      <Image src={artist.avatarUrl} alt={artist.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/artists/${artist.id}`}>
                          <h4 className="text-base font-bold text-white hover:text-brand-gold truncate transition-colors">
                            {artist.name}
                          </h4>
                        </Link>
                        {artist.verified && <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />}
                      </div>
                      <p className="text-xs text-brand-neon font-mono truncate">{artist.genres.slice(0, 2).join(' • ')}</p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 line-clamp-2">{artist.bio}</p>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link
                      href={`/artists/${artist.id}`}
                      className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <ReactionButtons contentId={artist.id} contentType="artist" variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Favorite Producers Tab */}
      {activeTab === 'producers' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-neon flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Favorite Producers & Beatmakers ({favoriteProducers.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                The hardware samplers, tape engineers, and sonic architects you favorited.
              </p>
            </div>
            <Link
              href="/producers"
              className="text-xs text-brand-neon hover:underline font-bold flex items-center gap-1"
            >
              <span>Browse All Producers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteProducers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-neon/20 border border-brand-neon/40 text-brand-neon mx-auto flex items-center justify-center">
                <Sliders className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite producers saved</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Explore the Producers directory to see the hardware rigs, signature BPM pockets, and SP-1200 sample masters, and tap ❤️ or 🔥 to save them.
              </p>
              <Link
                href="/producers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-purple text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Meet the Producers</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {favoriteProducers.map((producer) => (
                <div
                  key={producer.id}
                  className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 hover:border-brand-neon/40 transition-all bg-white/5"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-gold/40 shrink-0">
                      <Image src={producer.avatarUrl} alt={producer.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-white truncate">{producer.name}</h4>
                      <p className="text-xs text-brand-neon font-mono">{producer.signatureBpmRange}</p>
                      <p className="text-[11px] text-neutral-400">{producer.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {producer.gearSetup.slice(0, 3).map((gear, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-[10px] font-mono text-neutral-300">
                        {gear}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link
                      href="/producers"
                      className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1"
                    >
                      <span>View in Directory</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <ReactionButtons contentId={producer.id} contentType="producer" variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Favorite Projects Tab */}
      {activeTab === 'projects' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-amber flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Favorite Production Projects ({favoriteProjects.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Full-length album projects, historical anthologies, and box sets you favorited.
              </p>
            </div>
            <Link
              href="/projects"
              className="text-xs text-brand-amber hover:underline font-bold flex items-center gap-1"
            >
              <span>Explore Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteProjects.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-brand-amber mx-auto flex items-center justify-center">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite projects saved</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Explore the complete production catalog with deep tape documentation, vinyl pressings, and sample lineages, and hit ❤️ or 🔥 to save them here.
              </p>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>View Projects Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {favoriteProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 hover:border-brand-gold/40 transition-all bg-white/5"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-neutral-900">
                    <Image
                      src={proj.coverUrl || '/images/chancetekone_banner.png'}
                      alt={proj.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{proj.title}</h4>
                    <p className="text-xs text-brand-neon font-medium">{proj.subtitle}</p>
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{proj.description}</p>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link
                      href={`/projects#${proj.id}`}
                      className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Explore Project</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <ReactionButtons contentId={proj.id} contentType="project" variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. Favorite Audiobooks Tab */}
      {activeTab === 'audiobooks' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Audiobookshelf ({favoriteAudiobooks.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Spoken audiobooks and technical guides you have saved to your personal shelf.
              </p>
            </div>
            <Link
              href="/audiobooks"
              className="text-xs text-blue-400 hover:underline font-bold flex items-center gap-1"
            >
              <span>Explore Audiobooks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteAudiobooks.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 mx-auto flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Your audiobookshelf is empty</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Visit the audiobooks collection and tap ❤️ or 🔥 on technical guides, Agentic AI, and health narratives to add them to your shelf.
              </p>
              <Link
                href="/audiobooks"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Browse Audiobooks</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {favoriteAudiobooks.map((audiobook) => (
                <MediaCard key={audiobook.id} item={audiobook} type="audiobook" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Real Listening & Watching History */}
      {activeTab === 'history' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-neon">
                Listening & Watching History
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Tracks you streamed and 4K videos you watched while signed in.
              </p>
            </div>

            {profile && history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-300 border border-white/5 hover:border-red-500/30 text-xs font-semibold transition-all cursor-pointer"
                title="Clear your history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {!profile ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon mx-auto flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sign in to track your playback history</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Signed-in listeners have their complete listening sessions and 4K video history preserved across all your devices.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gold text-black font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In or Create Account</span>
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Clock className="w-8 h-8 text-neutral-500 mx-auto" />
              <p className="text-xs text-neutral-400">
                No listening or video watching history recorded yet.
              </p>
              <p className="text-[11px] text-neutral-500">
                Play any track from the Music catalog or watch a 4K video to start logging your personal stream history.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePlayHistoryItem(item)}
                  className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Media Cover */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/10 bg-neutral-900">
                      <Image
                        src={item.coverUrl || '/images/logo.png'}
                        alt={item.title}
                        fill
                        sizes="48px"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs md:text-sm font-semibold text-white group-hover:text-brand-gold truncate transition-colors">
                          {item.title}
                        </h4>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                            item.mediaType === 'video'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : item.mediaType === 'audiobook'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-brand-purple/20 text-brand-neon border border-brand-purple/40'
                          }`}
                        >
                          {item.mediaType === 'video' ? '🎬 Video' : item.mediaType === 'audiobook' ? '📖 Audiobook' : '🎵 Music'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  {/* Played Time & Duration */}
                  <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 shrink-0">
                    <span className="hidden sm:inline text-[11px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-gold/70" />
                      {formatRelativeTime(item.playedAt)}
                    </span>
                    {item.duration > 0 && <span>{formatDuration(item.duration)}</span>}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayHistoryItem(item);
                      }}
                      className="p-1.5 rounded-full bg-brand-gold text-black opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-md"
                      title="Play"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAuthModalOpen && (
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      )}

      {showCreateCrateModal && (
        <CreatePlaylistModal
          isOpen={showCreateCrateModal}
          onClose={() => setShowCreateCrateModal(false)}
          onCreated={(newPl) => {
            setUserPlaylists((prev) => [newPl, ...prev]);
          }}
        />
      )}

      {editCrateTarget && (
        <EditPlaylistModal
          isOpen={Boolean(editCrateTarget)}
          onClose={() => setEditCrateTarget(null)}
          playlist={editCrateTarget}
          onUpdated={(updated) => {
            setUserPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditCrateTarget(null);
          }}
          onDeleted={() => {
            setUserPlaylists((prev) => prev.filter((p) => p.id !== editCrateTarget.id));
            setEditCrateTarget(null);
          }}
        />
      )}

      {shareCrateTarget && (
        <SharePlaylistModal
          isOpen={Boolean(shareCrateTarget)}
          onClose={() => setShareCrateTarget(null)}
          playlist={shareCrateTarget}
          onUpdated={(updated) => {
            setUserPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading Library...</div>}>
      <LibraryContent />
    </Suspense>
  );
}
