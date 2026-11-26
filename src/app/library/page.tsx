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
  Mic,
  Sparkles,
  Play,
  Trash2,
  Clock,
  Music,
  Users,
  Sliders,
  FolderKanban,
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
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { TrackRow } from '@/components/media/TrackRow';
import { MediaCard } from '@/components/media/MediaCard';
import { HistoryService, HistoryEntry } from '@/lib/history/HistoryService';
import { FavoritesService, FavoriteItem } from '@/lib/favorites/FavoritesService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { Playlist } from '@/types/playlist';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { FavoriteButton } from '@/components/social/FavoriteButton';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { AuthModal } from '@/components/auth/AuthModal';
import { PodcastEpisode } from '@/types/media';

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
  | 'all'
  | 'music'
  | 'playlists'
  | 'audiobooks'
  | 'podcasts'
  | 'videos'
  | 'artists'
  | 'producers'
  | 'projects'
  | 'history';

function normalizeInitialTab(raw: string | null): LibraryTabKey {
  if (!raw || raw === 'liked' || raw === 'favorites') return 'all';
  const valid: LibraryTabKey[] = [
    'all',
    'music',
    'playlists',
    'audiobooks',
    'podcasts',
    'videos',
    'artists',
    'producers',
    'projects',
    'history',
  ];
  return valid.includes(raw as LibraryTabKey) ? (raw as LibraryTabKey) : 'all';
}

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = normalizeInitialTab(searchParams.get('tab'));

  const [activeTab, setActiveTab] = useState<LibraryTabKey>(initialTab);
  const { likedTrackIds, playTrack, openVideoModal, playAudiobookChapter } = usePlayer();
  const { profile, user, isAdmin, updateUserProfile } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [editPlaylistTarget, setEditPlaylistTarget] = useState<Playlist | null>(null);
  const [sharePlaylistTarget, setSharePlaylistTarget] = useState<Playlist | null>(null);
  const [deletePlaylistId, setDeletePlaylistId] = useState<string | null>(null);
  const [, setCatalogVersion] = useState(0);

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : 'guest');
  const isAuthenticated = Boolean(profile || user || isAdmin);

  useEffect(() => {
    setActiveTab(normalizeInitialTab(searchParams.get('tab')));
  }, [searchParams]);

  const handleResetEntireLibrary = () => {
    if (confirm('Clear all favorited items and playback history from your Library?')) {
      FavoritesService.clearFavorites(currentUserId);
      setFavorites([]);
      HistoryService.clearHistory(currentUserId);
      setHistory([]);
    }
  };

  // Load merged History (works for signed-in users AND guests)
  useEffect(() => {
    const syncHistory = () => {
      setHistory(HistoryService.getMergedHistory(currentUserId));
    };
    syncHistory();
    const unsub = HistoryService.subscribeAll(syncHistory);
    return () => unsub();
  }, [currentUserId]);

  // Load merged Favorites & Member Playlists
  useEffect(() => {
    const syncFavorites = () => {
      setFavorites(FavoritesService.getMergedFavorites(currentUserId));
    };
    syncFavorites();
    const unsubFavorites = FavoritesService.subscribeAll(syncFavorites);

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
    const onPlaylistsEvent = () => loadPlaylists();
    window.addEventListener('playlists-updated', onPlaylistsEvent);

    return () => {
      unsubFavorites();
      unsubPlaylists();
      window.removeEventListener('playlists-updated', onPlaylistsEvent);
    };
  }, [currentUserId, currentEmail, isAdmin]);

  // Sync live catalogs
  useEffect(() => {
    const syncCatalog = () => setCatalogVersion((v) => v + 1);
    const unsubMusic = MusicCatalogService.subscribe(syncCatalog);
    const unsubMedia = MediaCatalogService.subscribe(syncCatalog);
    window.addEventListener('catalog-updated', syncCatalog);
    window.addEventListener('media-catalog-updated', syncCatalog);
    window.addEventListener('storage', syncCatalog);
    return () => {
      unsubMusic();
      unsubMedia();
      window.removeEventListener('catalog-updated', syncCatalog);
      window.removeEventListener('media-catalog-updated', syncCatalog);
      window.removeEventListener('storage', syncCatalog);
    };
  }, []);

  // Derive real favorited catalog items across ALL content categories
  const musicFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'music').map((f) => f.id)
  );
  likedTrackIds.forEach((id) => musicFavoriteIds.add(id));
  const favoriteTracks = MusicCatalogService.getAllTracks().filter((t) => musicFavoriteIds.has(t.id));

  const albumFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'albums' || f.category === 'music').map((f) => f.id)
  );
  const favoriteAlbums = MusicCatalogService.getAllAlbums().filter((a) => albumFavoriteIds.has(a.id));

  const videoFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'videos').map((f) => f.id)
  );
  const allLiveVideos = MediaCatalogService.getAllVideos();
  const favoriteVideos = (allLiveVideos.length > 0 ? allLiveVideos : MOCK_VIDEOS).filter((v) =>
    videoFavoriteIds.has(v.id)
  );

  const audiobookFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'audiobooks').map((f) => f.id)
  );
  const allLiveBooks = MediaCatalogService.getAllAudiobooks();
  const favoriteAudiobooks = (allLiveBooks.length > 0 ? allLiveBooks : MOCK_AUDIOBOOKS).filter((b) =>
    audiobookFavoriteIds.has(b.id)
  );

  const podcastFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'podcasts').map((f) => f.id)
  );
  const favoritePodcasts: PodcastEpisode[] = MediaCatalogService.getAllPodcasts().filter((p) =>
    podcastFavoriteIds.has(p.id)
  );

  const playlistFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'playlists').map((f) => f.id)
  );
  const allLibraryPlaylists = userPlaylists.slice();
  playlistFavoriteIds.forEach((plId) => {
    if (!allLibraryPlaylists.some((p) => p.id === plId)) {
      const found = PlaylistService.getPlaylistById(plId, currentUserId, currentEmail, isAdmin);
      if (found?.playlist) allLibraryPlaylists.push(found.playlist);
    }
  });

  const artistFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'artists').map((f) => f.id)
  );
  const favoriteArtists = (() => {
    const matched = MOCK_ARTISTS.filter((a) => artistFavoriteIds.has(a.id));
    const matchedIds = new Set(matched.map((a) => a.id));
    // Also support dynamic catalog artists favorited via MediaCard or Artist page
    favorites
      .filter((f) => f.category === 'artists' && !matchedIds.has(f.id))
      .forEach((f) => {
        matched.push({
          id: f.id,
          name: f.metadata?.title || 'Artist',
          avatarUrl: f.metadata?.coverUrl || '/images/studio_cover.jpg',
          bio: f.metadata?.subtitle || 'Featured ChanceTEK One Artist',
          genres: f.metadata?.genre ? [f.metadata.genre] : ['Music'],
          verified: true,
          monthlyListeners: 0,
        } as any);
      });
    return matched;
  })();

  const producerFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'producers').map((f) => f.id)
  );
  const allProducers = ProducerCatalogService.getAllProducers();
  const favoriteProducers = (allProducers.length > 0 ? allProducers : MOCK_PRODUCERS).filter((p) =>
    producerFavoriteIds.has(p.id)
  );

  const projectFavoriteIds = new Set(
    favorites.filter((f) => f.category === 'projects').map((f) => f.id)
  );
  const favoriteProjects = MOCK_PROJECTS.filter((p) => projectFavoriteIds.has(p.id));

  const totalFavoritesCount =
    favoriteTracks.length +
    favoriteAlbums.length +
    favoriteVideos.length +
    favoriteAudiobooks.length +
    favoritePodcasts.length +
    favoriteArtists.length +
    favoriteProducers.length +
    favoriteProjects.length +
    allLibraryPlaylists.length;

  const handlePlayPodcast = (ep: PodcastEpisode) => {
    const isVideo =
      ep.mediaType === 'video' ||
      ep.mediaUrl.toLowerCase().endsWith('.mp4') ||
      ep.mediaUrl.toLowerCase().endsWith('.mov');
    if (isVideo) {
      openVideoModal({
        id: ep.id,
        title: ep.title,
        artistId: 'podcast-creator',
        artistName: ep.host,
        videoUrl: ep.mediaUrl,
        thumbnailUrl: ep.coverUrl,
        duration: ep.duration,
        views: ep.playCount,
        likeCount: ep.likeCount,
        dislikeCount: 0,
        commentCount: 0,
        description: ep.description,
        category: ep.category,
        releaseDate: ep.releaseDate,
      });
      return;
    }
    playTrack({
      id: ep.id,
      title: ep.title,
      artistId: 'podcast-host',
      artistName: `${ep.showTitle} • ${ep.host}`,
      albumTitle: ep.showTitle,
      audioUrl: ep.mediaUrl,
      coverUrl: ep.coverUrl,
      duration: ep.duration,
      genre: ep.category || 'Podcast',
      playCount: ep.playCount,
      likeCount: ep.likeCount,
      dislikeCount: 0,
      commentCount: 0,
    });
  };

  const handlePlayHistoryItem = (entry: HistoryEntry) => {
    if (entry.mediaType === 'video') {
      const vid =
        allLiveVideos.find((v) => v.id === entry.mediaId) ||
        MOCK_VIDEOS.find((v) => v.id === entry.mediaId) || {
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
      const book =
        allLiveBooks.find((b) => b.id === entry.mediaId) ||
        MOCK_AUDIOBOOKS.find((b) => b.id === entry.mediaId);
      if (book && book.chapters[0]) {
        playAudiobookChapter(book, book.chapters[0]);
      } else {
        router.push(`/audiobooks/${entry.mediaId}`);
      }
    } else if (entry.mediaType === 'podcast') {
      const pod = MediaCatalogService.getAllPodcasts().find((p) => p.id === entry.mediaId);
      if (pod) {
        handlePlayPodcast(pod);
      } else {
        playTrack({
          id: entry.mediaId,
          title: entry.title,
          artistId: 'podcast-host',
          artistName: entry.subtitle,
          audioUrl: entry.audioUrl || '',
          coverUrl: entry.coverUrl,
          duration: entry.duration,
          genre: entry.genre || 'Podcast',
          playCount: 0,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
        });
      }
    } else {
      const trk =
        MusicCatalogService.getTrackById(entry.mediaId) ||
        MOCK_TRACKS.find((t) => t.id === entry.mediaId) || {
          id: entry.mediaId,
          title: entry.title,
          artistId: 'artist-1',
          artistName: entry.subtitle,
          audioUrl: entry.audioUrl || '',
          coverUrl: entry.coverUrl,
          duration: entry.duration,
          genre: entry.genre || 'Music',
          bpm: entry.bpm || 110,
          playCount: 0,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
        };
      playTrack(trk);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your listening and watch history?')) {
      HistoryService.clearHistory(currentUserId);
      setHistory([]);
    }
  };

  const tabsConfig: Array<{ id: LibraryTabKey; label: string; count: number; icon: any }> = [
    { id: 'all', label: 'All Favorites', count: totalFavoritesCount, icon: Heart },
    { id: 'music', label: 'Music & Albums', count: favoriteTracks.length + favoriteAlbums.length, icon: Music },
    { id: 'playlists', label: 'Playlists', count: allLibraryPlaylists.length, icon: ListMusic },
    { id: 'audiobooks', label: 'Audiobooks', count: favoriteAudiobooks.length, icon: BookOpen },
    { id: 'podcasts', label: 'Podcasts', count: favoritePodcasts.length, icon: Mic },
    { id: 'videos', label: 'Videos', count: favoriteVideos.length, icon: VideoIcon },
    { id: 'artists', label: 'Artists', count: favoriteArtists.length, icon: Users },
    { id: 'producers', label: 'Producers', count: favoriteProducers.length, icon: Sliders },
    { id: 'projects', label: 'Projects', count: favoriteProjects.length, icon: FolderKanban },
    { id: 'history', label: 'History', count: history.length, icon: History },
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon text-xs font-semibold uppercase tracking-wider">
                <Library className="w-3.5 h-3.5" />
                <span>{profile ? `${profile.name}'s Personal Collection` : 'Personal Collection'}</span>
              </div>
              {profile && (
                <button
                  type="button"
                  onClick={() => updateUserProfile({ isLibraryPublic: !profile.isLibraryPublic })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                    profile.isLibraryPublic
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-white/5 border-white/15 text-neutral-300 hover:border-brand-gold/40 hover:text-brand-gold'
                  }`}
                  title={
                    profile.isLibraryPublic
                      ? 'Your Library is Public — click to make Private'
                      : 'Your Library is Private — click to make Public'
                  }
                >
                  {profile.isLibraryPublic ? (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Public Library</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private Library · Make Public</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Library</h1>
            <p className="text-sm text-neutral-400 mt-1">
              All your favorite songs, albums, artists, audiobooks, podcasts, 4K videos, playlists, and playback history in one place.
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
                <span>Clear Library</span>
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
                onClick={() => setActiveTab(tab.id)}
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

      {/* 0. All Favorites Unified Overview */}
      {activeTab === 'all' && (
        <div className="space-y-8">
          {totalFavoritesCount === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center space-y-4 bg-white/5">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Your Library is ready for your favorites</h3>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
                Tap the Favorite heart button on any song, album, artist, audiobook, podcast, 4K video, or playlist across ChanceTEK One and it will automatically appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Playlists Summary */}
              {allLibraryPlaylists.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                      <ListMusic className="w-4 h-4" />
                      Your Playlists ({allLibraryPlaylists.length})
                    </h3>
                    <button
                      onClick={() => setActiveTab('playlists')}
                      className="text-xs text-brand-gold hover:underline font-bold cursor-pointer"
                    >
                      Manage Playlists &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {allLibraryPlaylists.slice(0, 6).map((pl) => (
                      <Link
                        key={pl.id}
                        href={`/playlists/${pl.id}`}
                        className="group p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 transition-all flex items-center gap-3.5"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <Image src={pl.coverUrl || '/images/studio_cover.jpg'} alt={pl.name} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white group-hover:text-brand-gold truncate">{pl.name}</h4>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {pl.items.length} items · <span className="capitalize">{pl.visibility}</span>
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Tracks */}
              {favoriteTracks.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      Favorite Songs ({favoriteTracks.length})
                    </h3>
                    <button
                      onClick={() => setActiveTab('music')}
                      className="text-xs text-brand-gold hover:underline font-bold cursor-pointer"
                    >
                      View All &rarr;
                    </button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {favoriteTracks.slice(0, 8).map((track, i) => (
                      <TrackRow key={track.id} track={track} index={i} contextTracks={favoriteTracks} />
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Albums */}
              {favoriteAlbums.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Music className="w-4 h-4" />
                    Favorite Albums ({favoriteAlbums.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoriteAlbums.map((album) => (
                      <MediaCard key={album.id} item={album} type="album" />
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Audiobooks */}
              {favoriteAudiobooks.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 border-b border-white/5 pb-3">
                    <BookOpen className="w-4 h-4" />
                    Favorite Audiobooks ({favoriteAudiobooks.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoriteAudiobooks.map((book) => (
                      <MediaCard key={book.id} item={book} type="audiobook" />
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Podcasts */}
              {favoritePodcasts.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Mic className="w-4 h-4" />
                    Favorite Podcasts ({favoritePodcasts.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {favoritePodcasts.map((ep) => (
                      <div
                        key={ep.id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-gold/40 transition-all flex items-center gap-3.5"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <Image src={ep.coverUrl} alt={ep.title} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/podcasts/${ep.id}`} className="text-sm font-bold text-white hover:text-brand-gold truncate block">
                            {ep.title}
                          </Link>
                          <p className="text-[11px] text-neutral-400 truncate">{ep.showTitle} • {ep.host}</p>
                        </div>
                        <button
                          onClick={() => handlePlayPodcast(ep)}
                          className="p-2 rounded-full bg-brand-gold text-black hover:scale-105 transition-transform cursor-pointer shrink-0"
                          title="Play Podcast"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Videos */}
              {favoriteVideos.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2 border-b border-white/5 pb-3">
                    <VideoIcon className="w-4 h-4" />
                    Favorite 4K Videos ({favoriteVideos.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {favoriteVideos.map((vid) => (
                      <MediaCard key={vid.id} item={vid} type="video" />
                    ))}
                  </div>
                </section>
              )}

              {/* Favorite Artists */}
              {favoriteArtists.length > 0 && (
                <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 border-b border-white/5 pb-3">
                    <Users className="w-4 h-4" />
                    Favorite Artists ({favoriteArtists.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {favoriteArtists.map((artist) => (
                      <MediaCard key={artist.id} item={artist} type="artist" />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* 1. Favorite Music & Albums Tab */}
      {activeTab === 'music' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                <Music className="w-4 h-4" />
                Favorite Songs &amp; Albums ({favoriteTracks.length + favoriteAlbums.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every song and album you favorited across ChanceTEK One.
              </p>
            </div>
            <Link href="/music" className="text-xs text-brand-gold hover:underline font-bold flex items-center gap-1">
              <span>Explore Music</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteTracks.length === 0 && favoriteAlbums.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 text-brand-neon mx-auto flex items-center justify-center">
                <Music className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No favorite music yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Tap the Favorite heart button on any song or album to keep it in your Library.
              </p>
              <Link
                href="/music"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gold text-black font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Browse Music</span>
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
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Favorited Songs</h4>
                  <div className="divide-y divide-white/5">
                    {favoriteTracks.map((track, i) => (
                      <TrackRow key={track.id} track={track} index={i} contextTracks={favoriteTracks} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <ListMusic className="w-4 h-4" />
                Playlists ({allLibraryPlaylists.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                All playlists you created, saved, or favorited — private or public.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthModalOpen(true);
                  else setShowCreatePlaylistModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Playlist</span>
              </button>
              <Link href="/playlists" className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1">
                <span>All Playlists</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {allLibraryPlaylists.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
                <ListMusic className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">No playlists in your Library yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Create your own private or public playlists of music, videos, and audiobooks.
              </p>
              <button
                onClick={() => {
                  if (!isAuthenticated) setIsAuthModalOpen(true);
                  else setShowCreatePlaylistModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gold text-black font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Playlist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {allLibraryPlaylists.map((pl) => {
                const isDeleting = deletePlaylistId === pl.id;
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
                    {isDeleting && (
                      <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 space-y-2 text-center animate-in fade-in">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <p className="text-xs font-bold text-white">Delete &ldquo;{pl.name}&rdquo;?</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setDeletePlaylistId(null)}
                            className="px-3 py-1 rounded-full text-xs text-neutral-300 hover:text-white bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (currentUserId !== 'guest' || isAdmin) {
                                PlaylistService.deletePlaylist(pl.id, currentUserId, isAdmin, currentEmail);
                                setDeletePlaylistId(null);
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
                        src={pl.coverUrl || '/images/studio_cover.jpg'}
                        alt={pl.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
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
                      <p className="text-xs text-neutral-400 truncate">{pl.description || `By ${pl.ownerName}`}</p>
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
                        <FavoriteButton
                          id={pl.id}
                          category="playlists"
                          title={pl.name}
                          subtitle={`Playlist by ${pl.ownerName}`}
                          coverUrl={pl.coverUrl}
                          url={`/playlists/${pl.id}`}
                          variant="icon"
                          size="sm"
                        />
                        <button
                          onClick={() => setSharePlaylistTarget(pl)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
                          title="Share playlist"
                        >
                          <Share2 className="w-3.5 h-3.5 text-brand-neon" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => setEditPlaylistTarget(pl)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all cursor-pointer"
                              title="Edit playlist"
                            >
                              <Edit className="w-3.5 h-3.5 text-brand-gold" />
                            </button>
                            <button
                              onClick={() => setDeletePlaylistId(pl.id)}
                              className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                              title="Delete playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Favorite Audiobooks Tab */}
      {activeTab === 'audiobooks' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Favorite Audiobooks ({favoriteAudiobooks.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Spoken audiobooks and literature you have favorited.
              </p>
            </div>
            <Link href="/audiobooks" className="text-xs text-blue-400 hover:underline font-bold flex items-center gap-1">
              <span>Explore Audiobooks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteAudiobooks.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-blue-400 mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite audiobooks yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Tap Favorite on any audiobook to save it directly into your Library.
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

      {/* 4. Favorite Podcasts Tab */}
      {activeTab === 'podcasts' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Favorite Podcasts ({favoritePodcasts.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Podcast episodes and spoken broadcasts you favorited.
              </p>
            </div>
            <Link href="/podcasts" className="text-xs text-cyan-400 hover:underline font-bold flex items-center gap-1">
              <span>Explore Podcasts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoritePodcasts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Mic className="w-8 h-8 text-cyan-400 mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite podcasts yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Tap the Favorite heart on any podcast episode to save it to your Library.
              </p>
              <Link
                href="/podcasts"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>Browse Podcasts</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favoritePodcasts.map((ep) => (
                <div
                  key={ep.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-gold/50 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <Image src={ep.coverUrl} alt={ep.title} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-brand-neon uppercase tracking-wider truncate">{ep.showTitle}</p>
                      <Link href={`/podcasts/${ep.id}`} className="text-sm font-bold text-white hover:text-brand-gold line-clamp-2">
                        {ep.title}
                      </Link>
                      <p className="text-[11px] text-neutral-400 truncate">Host: {ep.host}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      onClick={() => handlePlayPodcast(ep)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-gold text-black text-xs font-extrabold cursor-pointer hover:scale-105 transition-transform"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </button>
                    <FavoriteButton
                      id={ep.id}
                      category="podcasts"
                      title={ep.title}
                      subtitle={`${ep.showTitle} • ${ep.host}`}
                      coverUrl={ep.coverUrl}
                      variant="icon"
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Favorite Videos Tab */}
      {activeTab === 'videos' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <VideoIcon className="w-4 h-4" />
                Favorite 4K Videos ({favoriteVideos.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                4K videos and documentaries saved to your Library.
              </p>
            </div>
            <Link href="/videos" className="text-xs text-rose-400 hover:underline font-bold flex items-center gap-1">
              <span>Explore 4K Videos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteVideos.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <VideoIcon className="w-8 h-8 text-rose-400 mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite videos yet</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Tap the Favorite heart on any 4K video to pin it into your Library.
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

      {/* 6. Favorite Artists Tab */}
      {activeTab === 'artists' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Favorite Artists ({favoriteArtists.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Artists and creators you have favorited.
              </p>
            </div>
            <Link href="/artists" className="text-xs text-purple-400 hover:underline font-bold flex items-center gap-1">
              <span>Explore Artists</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteArtists.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="w-8 h-8 text-purple-400 mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite artists saved</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Tap Favorite on any artist card or profile page to follow them in your Library.
              </p>
              <Link
                href="/artists"
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/artists/${artist.id}`}>
                          <h4 className="text-base font-bold text-white hover:text-brand-gold truncate transition-colors">
                            {artist.name}
                          </h4>
                        </Link>
                        {artist.verified && <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />}
                      </div>
                      <p className="text-xs text-brand-neon font-mono truncate">{(artist.genres || []).slice(0, 2).join(' • ')}</p>
                    </div>
                    <FavoriteButton id={artist.id} category="artists" title={artist.name} coverUrl={artist.avatarUrl} variant="icon" size="sm" />
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2">{artist.bio}</p>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link href={`/artists/${artist.id}`} className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1">
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

      {/* 7. Favorite Producers Tab */}
      {activeTab === 'producers' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-neon flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Favorite Producers ({favoriteProducers.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Producers, beatmakers, and sonic architects you favorited.
              </p>
            </div>
            <Link href="/producers" className="text-xs text-brand-neon hover:underline font-bold flex items-center gap-1">
              <span>Browse Producers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteProducers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Sliders className="w-8 h-8 text-brand-neon mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite producers saved</h4>
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
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-white truncate">{producer.name}</h4>
                      <p className="text-xs text-brand-neon font-mono">{producer.signatureBpmRange}</p>
                      <p className="text-[11px] text-neutral-400">{producer.role}</p>
                    </div>
                    <FavoriteButton id={producer.id} category="producers" title={producer.name} coverUrl={producer.avatarUrl} variant="icon" size="sm" />
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link href="/producers" className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1">
                      <span>View Directory</span>
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

      {/* 8. Favorite Projects Tab */}
      {activeTab === 'projects' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-amber flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Favorite Projects ({favoriteProjects.length})
              </h3>
            </div>
            <Link href="/projects" className="text-xs text-brand-amber hover:underline font-bold flex items-center gap-1">
              <span>Explore Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteProjects.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FolderKanban className="w-8 h-8 text-brand-amber mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite projects saved</h4>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                <span>View Projects</span>
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
                    <Image src={proj.coverUrl || '/images/studio_cover.jpg'} alt={proj.title} fill className="object-cover" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-bold text-white">{proj.title}</h4>
                      <p className="text-xs text-brand-neon font-medium">{proj.subtitle}</p>
                    </div>
                    <FavoriteButton id={proj.id} category="projects" title={proj.title} coverUrl={proj.coverUrl} variant="icon" size="sm" />
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Link href={`/projects#${proj.id}`} className="text-xs text-brand-gold font-bold hover:underline flex items-center gap-1">
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

      {/* 9. Listening & Watch History Tab */}
      {activeTab === 'history' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-neon">
                Recently Played History ({history.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Music, audiobooks, podcasts, and 4K videos you recently played.
              </p>
            </div>

            {history.length > 0 && (
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

          {history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Clock className="w-8 h-8 text-neutral-500 mx-auto" />
              <p className="text-xs text-neutral-400">
                No listening or watch history recorded yet.
              </p>
              <p className="text-[11px] text-neutral-500">
                Play any song, audiobook, podcast, or 4K video to start tracking your session history.
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
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/10 bg-neutral-900">
                      {item.mediaType === 'video' && item.videoUrl ? (
                        <VideoThumbnail
                          videoUrl={item.videoUrl}
                          thumbnailUrl={item.coverUrl}
                          alt={item.title}
                          preferVideoFrame={true}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Image
                          src={item.coverUrl || '/images/studio_cover.jpg'}
                          alt={item.title}
                          fill
                          sizes="48px"
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>

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
                              : item.mediaType === 'podcast'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-brand-purple/20 text-brand-neon border border-brand-purple/40'
                          }`}
                        >
                          {item.mediaType === 'video'
                            ? 'Video'
                            : item.mediaType === 'audiobook'
                            ? 'Audiobook'
                            : item.mediaType === 'podcast'
                            ? 'Podcast'
                            : 'Music'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-neutral-400 shrink-0">
                    <span className="hidden sm:inline-flex text-[11px] text-neutral-500 items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-gold/70" />
                      {formatRelativeTime(item.playedAt)}
                    </span>
                    {item.duration > 0 && <span>{formatDuration(item.duration)}</span>}
                    <FavoriteButton
                      id={item.mediaId}
                      category={
                        item.mediaType === 'video'
                          ? 'videos'
                          : item.mediaType === 'audiobook'
                          ? 'audiobooks'
                          : item.mediaType === 'podcast'
                          ? 'podcasts'
                          : 'music'
                      }
                      title={item.title}
                      subtitle={item.subtitle}
                      coverUrl={item.coverUrl}
                      variant="icon"
                      size="sm"
                    />
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

      {showCreatePlaylistModal && (
        <CreatePlaylistModal
          isOpen={showCreatePlaylistModal}
          onClose={() => setShowCreatePlaylistModal(false)}
          onCreated={(newPl) => {
            setUserPlaylists((prev) => [newPl, ...prev]);
          }}
        />
      )}

      {editPlaylistTarget && (
        <EditPlaylistModal
          isOpen={Boolean(editPlaylistTarget)}
          onClose={() => setEditPlaylistTarget(null)}
          playlist={editPlaylistTarget}
          onUpdated={(updated) => {
            setUserPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditPlaylistTarget(null);
          }}
          onDeleted={() => {
            setUserPlaylists((prev) => prev.filter((p) => p.id !== editPlaylistTarget.id));
            setEditPlaylistTarget(null);
          }}
        />
      )}

      {sharePlaylistTarget && (
        <SharePlaylistModal
          isOpen={Boolean(sharePlaylistTarget)}
          onClose={() => setSharePlaylistTarget(null)}
          playlist={sharePlaylistTarget}
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
