'use client';

import React, { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Shuffle,
  Heart,
  Bookmark,
  Share2,
  Edit,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Clock,
  Globe,
  Lock,
  Link as LinkIcon,
  Music,
  Video as VideoIcon,
  BookOpen,
  Layers,
  Sparkles,
  Search,
  Check,
  ChevronLeft,
  Flame,
  Radio,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { Playlist, PlaylistItem, PlaylistType } from '@/types/playlist';
import { MediaType, Track, Video, Audiobook } from '@/types/media';
import { CommentSection } from '@/components/comments/CommentSection';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';
import { EditPlaylistModal } from '@/components/playlist/EditPlaylistModal';
import { SharePlaylistModal } from '@/components/playlist/SharePlaylistModal';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { ReactionButtons } from '@/components/social/ReactionButtons';

export default function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { profile, user, isAdmin } = useAuth();
  const { playPlaylist, playTrack, playAudiobookChapter } = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawer State
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add content catalog search state
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogType, setCatalogType] = useState<MediaType>('music');
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
  const canManage = Boolean(isOwner || isAdmin);

  const loadPlaylist = () => {
    const res = PlaylistService.getPlaylistById(resolvedParams.id, currentUserId, currentEmail, isAdmin);
    if (res.playlist) {
      setPlaylist(res.playlist);
      const isDirectOwner = Boolean(
        (currentUserId && res.playlist.ownerId === currentUserId) ||
        (profile?.id && res.playlist.ownerId === profile.id) ||
        (user?.uid && res.playlist.ownerId === user.uid) ||
        (currentEmail && res.playlist.ownerEmail && currentEmail.toLowerCase() === res.playlist.ownerEmail.toLowerCase())
      );
      setIsOwner(isDirectOwner);
      setIsSaved(res.isSaved);
      setIsLiked(res.isLiked);
      setError(null);
    } else {
      setError(res.error || 'Playlist not found');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPlaylist();
    const unsubscribe = PlaylistService.subscribe(() => {
      loadPlaylist();
    });
    return () => unsubscribe();
  }, [resolvedParams.id, currentUserId, currentEmail, isAdmin]);

  const handlePlayAll = () => {
    if (playlist && playlist.items.length > 0) {
      playPlaylist(playlist, 0, false);
    }
  };

  const handleShuffle = () => {
    if (playlist && playlist.items.length > 0) {
      playPlaylist(playlist, 0, true);
    }
  };

  const handlePlayItem = (item: PlaylistItem, index: number) => {
    if (!playlist) return;
    playPlaylist(playlist, index, false);
  };

  const handleToggleLike = () => {
    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }
    if (!playlist) return;
    const liked = PlaylistService.toggleLikePlaylist(playlist.id, currentUserId);
    setIsLiked(liked);
    loadPlaylist();
  };

  const handleToggleSave = () => {
    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }
    if (!playlist) return;
    const saved = PlaylistService.toggleSavePlaylist(playlist.id, currentUserId);
    setIsSaved(saved);
    loadPlaylist();
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!playlist || !currentUserId) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= playlist.items.length) return;

    const newItems = [...playlist.items];
    const temp = newItems[index];
    newItems[index] = newItems[newIdx];
    newItems[newIdx] = temp;

    const itemIds = newItems.map((it) => it.id);
    const res = PlaylistService.reorderPlaylistItems(playlist.id, currentUserId, itemIds, isAdmin, currentEmail);
    if (res.success && res.items) {
      setPlaylist({ ...playlist, items: res.items });
    }
  };

  const handleRemoveItem = (itemId: string) => {
    if (!playlist || !currentUserId) return;
    const res = PlaylistService.removeItemFromPlaylist(playlist.id, currentUserId, itemId, isAdmin, currentEmail);
    if (res.success) {
      loadPlaylist();
    }
  };

  const handleAddMedia = (mediaId: string, mediaType: MediaType) => {
    if (!playlist || !currentUserId) return;
    const res = PlaylistService.addItemToPlaylist(
      playlist.id,
      currentUserId,
      {
        mediaId,
        mediaType,
      },
      isAdmin,
      currentEmail
    );
    if (res.success) {
      setJustAddedIds((prev) => new Set(prev).add(mediaId));
      setTimeout(() => {
        setJustAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
      }, 2500);
      loadPlaylist();
    }
  };

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'music': return Music;
      case 'video': return VideoIcon;
      case 'audiobook': return BookOpen;
      default: return Layers;
    }
  };

  // Filter catalog items for adding
  const getFilteredCatalog = () => {
    if (catalogType === 'music') {
      return filterAndRankTracks(MusicCatalogService.getAllTracks(), catalogQuery);
    }
    if (catalogType === 'video') {
      const allVideos = MediaCatalogService.getAllVideos();
      const list = allVideos.length > 0 ? allVideos : MOCK_VIDEOS;
      return list.filter((v) => matchesGenericMediaSearch(v, catalogQuery));
    }
    if (catalogType === 'audiobook') {
      const allBooks = MediaCatalogService.getAllAudiobooks();
      const list = allBooks.length > 0 ? allBooks : MOCK_AUDIOBOOKS;
      return list.filter((b) => matchesGenericMediaSearch(b, catalogQuery));
    }
    return [];
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <Sparkles className="w-8 h-8 mx-auto text-brand-gold animate-spin-slow" />
        <p className="text-sm text-neutral-400">Loading crate master sequence...</p>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">{error || 'Playlist Not Found'}</h2>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          This playlist may have been made private by its creator or deleted.
        </p>
        <Link
          href="/playlists"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Playlists
        </Link>
      </div>
    );
  }

  const TypeIcon = getTypeIcon(playlist.type);

  return (
    <div className="space-y-8 py-6">
      {/* Back Button */}
      <button
        onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/playlists'))}
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
        title="Return to Previous Page"
      >
        <ChevronLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
        <span>Back</span>
      </button>

      {/* 1. Header Hero Card */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-brand-purple/30 p-6 sm:p-10 shadow-2xl bg-gradient-to-r from-[#180e29]/95 via-[#0d0918]/90 to-[#08080c]/95">
        <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
          {/* Cover Art */}
          <div className="relative w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 rounded-3xl overflow-hidden shadow-2xl border border-white/15 shrink-0 bg-black/60">
            <Image
              src={playlist.coverUrl}
              alt={playlist.name}
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Details */}
          <div className="flex-1 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-widest">
                <TypeIcon className="w-3.5 h-3.5" />
                <span className="capitalize">{playlist.type} Crate</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-neutral-300 text-xs font-semibold">
                {playlist.visibility === 'private' ? (
                  <>
                    <Lock className="w-3 h-3 text-red-400" />
                    <span>Private</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span className="capitalize">{playlist.visibility}</span>
                  </>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {playlist.name}
            </h1>

            {playlist.description && (
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
                {playlist.description}
              </p>
            )}

            {/* Creator Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300 pt-1">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-brand-gold/50">
                  <Image
                    src={playlist.ownerAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                    alt={playlist.ownerName}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="font-bold text-white">{playlist.ownerName}</span>
              </div>

              <span>•</span>
              <span className="font-mono text-brand-neon">{playlist.itemCount} items</span>

              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                <span>{formatDuration(playlist.totalDuration)}</span>
              </span>

              {playlist.stats.plays > 0 && (
                <>
                  <span>•</span>
                  <span>{playlist.stats.plays.toLocaleString()} plays</span>
                </>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handlePlayAll}
                disabled={playlist.items.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-transform disabled:opacity-40"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                Play All
              </button>

              <button
                onClick={handleShuffle}
                disabled={playlist.items.length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs transition-all hover:scale-105 disabled:opacity-40"
                title="Shuffle Crate"
              >
                <Shuffle className="w-4 h-4 text-brand-gold" />
                Shuffle
              </button>

              <button
                onClick={handleToggleSave}
                className={`p-3 rounded-full border transition-all ${
                  isSaved
                    ? 'bg-brand-gold text-black border-brand-gold'
                    : 'bg-white/5 border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
                title={isSaved ? 'Saved to your library' : 'Save playlist to library'}
              >
                <Bookmark className="w-4 h-4" />
              </button>

              {(() => {
                const plKey = buildCanonicalContentKey('playlist', playlist.name);
                const count = SocialCommentService.getCommentCount(playlist.id, plKey);
                return (
                  <>
                    <ReactionButtons
                      contentId={playlist.id}
                      contentKey={plKey}
                      contentType="playlist"
                      contentTitle={playlist.name}
                      contextLocation="Crate / Playlist Page"
                      initialLikes={playlist.stats.likes}
                      showShare={false}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const elem = document.getElementById('playlist-comments-section');
                        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-neutral-200 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer shadow-sm"
                      title={`${count} Discussion Comments & Threads`}
                    >
                      <MessageSquare className="w-4 h-4 text-brand-gold" />
                      <span className="font-mono text-brand-gold font-black">{count}</span>
                      <span className="hidden sm:inline">Threads</span>
                    </button>
                  </>
                );
              })()}

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Share playlist or invite members"
              >
                <Share2 className="w-4 h-4 text-brand-neon" />
                <span>Share & Members</span>
                {playlist.sharedWith && playlist.sharedWith.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-brand-neon/20 text-brand-neon font-mono text-[10px]">
                    {playlist.sharedWith.length}
                  </span>
                )}
              </button>

              {canManage && (
                <>
                  <button
                    onClick={() => setShowAddDrawer(!showAddDrawer)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-neon/40 text-brand-neon hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showAddDrawer ? 'Close Search' : 'Add Content'}</span>
                  </button>

                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold transition-all cursor-pointer shadow-sm hover:border-brand-gold/50"
                    title="Edit Crate Name, Artwork, & Privacy"
                  >
                    <Edit className="w-4 h-4 text-brand-gold" />
                    <span>Edit Crate</span>
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/60 text-red-300 hover:text-red-200 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Delete this playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Crate</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Add Content Search Drawer (For Playlist Owner & Admins) */}
      {canManage && showAddDrawer && (
        <div className="p-6 rounded-3xl glass-panel border border-brand-neon/40 space-y-4 bg-[#0d0918]/95 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                Add Media from Crate Catalog
              </h3>
              <p className="text-xs text-neutral-400">
                Search songs, 4K videos, and audiobooks to append to this crate.
              </p>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setCatalogType('music')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  catalogType === 'music' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Music
              </button>
              <button
                onClick={() => setCatalogType('video')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  catalogType === 'video' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Videos
              </button>
              <button
                onClick={() => setCatalogType('audiobook')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  catalogType === 'audiobook' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Books
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder={`Search ${catalogType} catalog by title or artist...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
            {getFilteredCatalog().map((item: any) => {
              const inPlaylist = playlist.items.some((it) => it.mediaId === item.id);
              const wasJustAdded = justAddedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-purple/30 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <Image
                        src={item.coverUrl || item.thumbnailUrl || '/images/logo.png'}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {item.artistName || item.author}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddMedia(item.id, catalogType)}
                    disabled={inPlaylist}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                      inPlaylist
                        ? 'bg-white/10 text-neutral-400 cursor-default'
                        : wasJustAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gradient-to-r from-brand-gold to-brand-amber text-black hover:scale-105'
                    }`}
                  >
                    {inPlaylist ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : wasJustAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Playlist Items List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Sequence ({playlist.items.length})
          </h2>
          {canManage && playlist.items.length > 1 && (
            <p className="text-xs text-neutral-400">
              Use arrow buttons to adjust crate order.
            </p>
          )}
        </div>

        {playlist.items.length === 0 ? (
          <div className="p-12 rounded-3xl glass-card border border-white/5 text-center space-y-3">
            <Layers className="w-10 h-10 mx-auto text-neutral-500" />
            <h3 className="text-base font-bold text-white">This playlist is empty</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Add your favorite breakbeat tracks, videos, and audiobook masterclasses to start listening.
            </p>
            {canManage && (
              <button
                onClick={() => setShowAddDrawer(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform"
              >
                <Plus className="w-4 h-4" />
                Add Media Now
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.items.map((item, index) => {
              const ItemTypeIcon = getTypeIcon(item.mediaType);

              return (
                <div
                  key={item.id}
                  className="group p-3 rounded-2xl glass-card border border-white/5 hover:border-brand-purple/40 flex items-center justify-between gap-3 sm:gap-4 transition-all bg-[#0d0d16]/70 hover:bg-[#141224]"
                >
                  {/* Left: Position / Play button & Thumbnail */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-6 text-center shrink-0">
                      <span className="text-xs font-mono text-neutral-400 group-hover:hidden">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => handlePlayItem(item, index)}
                        className="hidden group-hover:flex w-6 h-6 rounded-full bg-brand-gold text-black items-center justify-center mx-auto hover:scale-110 transition-transform"
                        title="Play item"
                      >
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </button>
                    </div>

                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/50">
                      <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
                      <div className="absolute top-1 left-1 px-1 rounded bg-black/70 backdrop-blur-sm text-[8px] font-bold uppercase text-brand-gold">
                        {item.mediaType}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span className="truncate">{item.artistName}</span>
                        {item.bpm && (
                          <span className="text-brand-neon font-mono">· {item.bpm} BPM</span>
                        )}
                        {item.genre && (
                          <span className="hidden sm:inline text-neutral-400">· {item.genre}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration & Reorder/Remove Controls */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="text-xs font-mono text-neutral-400 w-12 text-right">
                      {formatDuration(item.duration)}
                    </span>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveItem(index, 'down')}
                          disabled={index === playlist.items.length - 1}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                          title="Remove from playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Community Comments & Discussion Threads */}
      <CommentSection
        contentId={playlist.id}
        contentType="playlist"
        contentTitle={playlist.name}
      />

      {/* Modals */}
      {showDeleteConfirm && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl border border-red-500/40 bg-gradient-to-b from-[#1c0d16]/98 to-[#0a070c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.9)] space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Permanently delete "{playlist.name}"?</h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  This crate will be permanently deleted and removed from your library and community catalogs.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  PlaylistService.deletePlaylist(playlist.id, currentUserId, isAdmin, currentEmail);
                  setShowDeleteConfirm(false);
                  router.push('/playlists');
                }}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community Comments & Discussion Threads */}
      <div id="playlist-comments-section" className="pt-4">
        <CommentSection
          contentId={playlist.id}
          contentKey={buildCanonicalContentKey('playlist', playlist.name)}
          contentType="playlist"
          contentTitle={playlist.name}
        />
      </div>

      {showEditModal && (
        <EditPlaylistModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          playlist={playlist}
          onUpdated={(updated) => setPlaylist(updated)}
          onDeleted={() => {
            router.push('/playlists');
          }}
        />
      )}

      {showShareModal && (
        <SharePlaylistModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          playlist={playlist}
          onUpdated={(updated) => setPlaylist(updated)}
        />
      )}

      {showAuthModal && (
        <AuthPromptModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            loadPlaylist();
          }}
        />
      )}
    </div>
  );
}
