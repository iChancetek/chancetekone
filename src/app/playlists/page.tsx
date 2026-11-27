'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ListMusic,
  Plus,
  Play,
  Share2,
  Heart,
  Bookmark,
  Search,
  Music,
  Video,
  BookOpen,
  Layers,
  Sparkles,
  Lock,
  Globe,
  Clock,
  Radio,
  Flame,
  User,
  Edit,
  Trash2,
  Users,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { Playlist, PlaylistType, PlaylistFilter } from '@/types/playlist';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { CreatePlaylistModal } from '@/components/playlist/CreatePlaylistModal';
import { EditPlaylistModal } from '@/components/playlist/EditPlaylistModal';
import { SharePlaylistModal } from '@/components/playlist/SharePlaylistModal';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { FavoriteButton } from '@/components/social/FavoriteButton';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function PlaylistsPage() {
  const { profile, user, isAdmin } = useAuth();
  const { playPlaylist } = usePlayer();

  const [activeTab, setActiveTab] = useState<'all' | PlaylistType>('all');
  const [sectionScope, setSectionScope] = useState<'all' | 'public' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [sharedPlaylists, setSharedPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shareTargetPlaylist, setShareTargetPlaylist] = useState<Playlist | null>(null);
  const [editTargetPlaylist, setEditTargetPlaylist] = useState<Playlist | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPromptAction, setAuthPromptAction] = useState<string>('create');
  const [discussionPlaylist, setDiscussionPlaylist] = useState<Playlist | null>(null);
  const [isSyncingPublic, setIsSyncingPublic] = useState(false);
  const [, setCommentTick] = useState(0);

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
  const isAuthenticated = Boolean(profile || user || isAdmin);

  const refreshPlaylists = () => {
    const filter: PlaylistFilter = {
      type: activeTab,
      searchQuery,
      sortBy: 'recent',
    };

    if (currentUserId || currentEmail) {
      const userPls = PlaylistService.getUserPlaylists(currentUserId, currentEmail, {
        type: activeTab,
        searchQuery,
        sortBy: 'recent',
      });
      setUserPlaylists(userPls);

      const sharedPls = PlaylistService.getSharedPlaylists(currentUserId, currentEmail, {
        type: activeTab,
        searchQuery,
        sortBy: 'recent',
      });
      setSharedPlaylists(sharedPls);

      const savedPls = PlaylistService.getSavedPlaylists(currentUserId);
      setSavedPlaylists(savedPls);
    } else {
      setUserPlaylists([]);
      setSharedPlaylists([]);
      setSavedPlaylists([]);
    }

    // Show ALL public playlists created by platform members so every user can discover & play them
    const pub = PlaylistService.getPublicPlaylists(filter);
    setPublicPlaylists(pub);
  };

  useEffect(() => {
    refreshPlaylists();
    void PlaylistService.syncFromServer(true);
    const unsubscribe = PlaylistService.subscribe(() => {
      refreshPlaylists();
    });
    const onPlaylistsEvent = () => refreshPlaylists();
    window.addEventListener('playlists-updated', onPlaylistsEvent);
    window.addEventListener('storage', onPlaylistsEvent);
    const unsubComments = SocialCommentService.subscribeAll(() => {
      setCommentTick((t) => t + 1);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('playlists-updated', onPlaylistsEvent);
      window.removeEventListener('storage', onPlaylistsEvent);
      unsubComments();
    };
  }, [activeTab, searchQuery, currentUserId, currentEmail, isAdmin]);

  const handleCreateClick = () => {
    if (!isAuthenticated) {
      setAuthPromptAction('create');
      setShowAuthModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleSaveToggle = (e: React.MouseEvent, pl: Playlist) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setAuthPromptAction('save');
      setShowAuthModal(true);
      return;
    }
    PlaylistService.toggleSavePlaylist(pl.id, currentUserId);
    refreshPlaylists();
  };

  const handleLikeToggle = (e: React.MouseEvent, pl: Playlist) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setAuthPromptAction('like');
      setShowAuthModal(true);
      return;
    }
    PlaylistService.toggleLikePlaylist(pl.id, currentUserId);
    refreshPlaylists();
  };

  const handleShareClick = (e: React.MouseEvent, pl: Playlist) => {
    e.preventDefault();
    e.stopPropagation();
    setShareTargetPlaylist(pl);
  };

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
  };

  const getTypeIcon = (type: PlaylistType) => {
    switch (type) {
      case 'music': return Music;
      case 'video': return Video;
      case 'audiobook': return BookOpen;
      default: return Layers;
    }
  };

  const FILTER_TABS: Array<{ id: 'all' | PlaylistType; label: string; icon: any }> = [
    { id: 'all', label: 'All Playlists', icon: ListMusic },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'video', label: 'Videos', icon: Video },
    { id: 'audiobook', label: 'Audiobooks', icon: BookOpen },
    { id: 'mixed', label: 'Mixed Media', icon: Layers },
  ];

  return (
    <div className="space-y-10 py-6">
      {/* 1. Header Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-brand-purple/30 p-6 sm:p-10 shadow-2xl bg-gradient-to-r from-[#180e29]/95 via-[#0d0918]/90 to-[#08080c]/95">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              Member-Created Playlists
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Playlists
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Create your own private or public playlists, save them directly to your Playlists area &amp; Library, and explore real playlists created by platform members.
            </p>
          </div>

          <button
            onClick={handleCreateClick}
            className="self-start md:self-auto flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.55)] border-2 border-white/70 hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.85)] transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-black stroke-[3.5]" />
            <span className="font-extrabold tracking-wide text-black">+ Create Playlist</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${isActive
                  ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-md border border-brand-neon/40'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-gold' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search playlists by title or vibe..."
            className="w-full pl-9 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple transition-all"
          />
        </div>
      </div>

      {/* 2b. Scope Switcher: All / Public Member Playlists / My Playlists */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSectionScope('all')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border ${sectionScope === 'all'
              ? 'bg-brand-gold text-black border-brand-gold shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
            }`}
        >
          All Sections
        </button>
        <button
          type="button"
          onClick={() => setSectionScope('public')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border ${sectionScope === 'public'
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
            }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Public Playlists ({publicPlaylists.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSectionScope('mine')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border ${sectionScope === 'mine'
              ? 'bg-brand-purple text-white border-brand-neon shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
            }`}
        >
          <Radio className="w-3.5 h-3.5 text-brand-gold" />
          <span>My Playlists ({userPlaylists.length})</span>
        </button>
      </div>

      {/* 3. My Playlists Section (Authenticated) or Guest Intro */}
      {sectionScope !== 'public' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-brand-gold shrink-0" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                  My Playlists {isAuthenticated && `(${userPlaylists.length})`}
                </h2>
                <p className="text-xs text-neutral-400 font-medium">Keep your playlists Private or share them Publicly</p>
              </div>
            </div>
            {isAuthenticated && userPlaylists.length > 0 && (
              <button
                onClick={handleCreateClick}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-105 transition-all flex items-center gap-1.5 border border-white/50"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ New Playlist</span>
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="p-6 sm:p-8 rounded-3xl glass-card border border-brand-gold/30 bg-gradient-to-r from-brand-purple/20 via-brand-purple/10 to-transparent flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Build Your Personal Playlist
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 max-w-lg">
                  Sign in to create unlimited custom playlists, organize songs, videos, and audiobooks, and keep them private or public in your Library.
                </p>
              </div>
              <button
                onClick={() => {
                  setAuthPromptAction('create');
                  setShowAuthModal(true);
                }}
                className="px-7 py-3 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-white/50 transition-transform hover:scale-105 shrink-0"
              >
                Sign In to Create
              </button>
            </div>
          ) : userPlaylists.length === 0 ? (
            <div className="p-10 rounded-3xl glass-card border border-white/5 text-center space-y-3 bg-[#0d0d16]/70">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold/40 mx-auto flex items-center justify-center text-brand-gold shadow-md">
                <ListMusic className="w-6 h-6 text-brand-gold" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">Your playlists start here</h3>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto">
                Create a playlist for your favorite music, 4K studio videos, audiobooks, or a mixed session of all three.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] border-2 border-white/60 hover:scale-105 transition-transform cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Your First Playlist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {userPlaylists.map((pl) => {
                const TypeIcon = getTypeIcon(pl.type);
                const isDeleting = deleteConfirmId === pl.id;
                return (
                  <div
                    key={pl.id}
                    className="group glass-card p-4 rounded-3xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden border border-white/5 hover:border-brand-purple/40"
                  >
                    {/* Delete Confirmation Overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 space-y-3 animate-in fade-in duration-200">
                        <Trash2 className="w-6 h-6 text-red-400" />
                        <p className="text-xs font-bold text-white text-center">Delete "{pl.name}"?</p>
                        <p className="text-[10px] text-neutral-400 text-center">This action cannot be undone.</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (currentUserId || isAdmin) {
                                PlaylistService.deletePlaylist(pl.id, currentUserId, isAdmin, currentEmail);
                                setDeleteConfirmId(null);
                                refreshPlaylists();
                              }
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <Link href={`/playlists/${pl.id}`}>
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 border border-white/5 bg-black/50">
                        <Image
                          src={pl.coverUrl || '/images/studio_cover.jpg'}
                          alt={pl.name}
                          fill
                          unoptimized={Boolean(
                            pl.coverUrl &&
                              (pl.coverUrl.startsWith('data:') ||
                                pl.coverUrl.startsWith('blob:') ||
                                pl.coverUrl.startsWith('http') ||
                                pl.coverUrl.startsWith('/api/'))
                          )}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* 1-Tap Public/Private Visibility Toggle Badge */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!currentUserId && !isAdmin) return;
                            const nextVis = pl.visibility === 'public' ? 'private' : 'public';
                            const res = PlaylistService.updatePlaylist(
                              pl.id,
                              currentUserId || 'admin',
                              { visibility: nextVis },
                              isAdmin,
                              currentEmail
                            );
                            if (res.success && res.playlist) {
                              refreshPlaylists();
                              await PlaylistService.syncPlaylistNow(res.playlist);
                              refreshPlaylists();
                            }
                          }}
                          title={
                            pl.visibility === 'public'
                              ? 'Public on Platform — Tap to switch to Private'
                              : 'Private — Tap to publish Publicly for all users'
                          }
                          className={`absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-md backdrop-blur-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 transition-all cursor-pointer ${pl.visibility === 'public'
                              ? 'bg-emerald-950/85 hover:bg-emerald-900 text-emerald-300 border-emerald-400/50'
                              : 'bg-black/80 hover:bg-emerald-950/90 text-neutral-200 hover:text-emerald-300 border-white/15 hover:border-emerald-400/50'
                            }`}
                        >
                          {pl.visibility === 'private' ? (
                            <>
                              <Lock className="w-3 h-3 text-red-400" />
                              <span>Private · Make Public</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3 text-emerald-400" />
                              <span className="capitalize">{pl.visibility}</span>
                            </>
                          )}
                        </button>

                        {/* Type Badge */}
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-brand-purple/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-brand-neon/30 flex items-center gap-1">
                          <TypeIcon className="w-3 h-3 text-brand-gold" />
                          <span className="capitalize">{pl.type}</span>
                        </div>

                        {/* Hover Play Button */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              playPlaylist(pl);
                            }}
                            className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </Link>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/playlists/${pl.id}`} className="min-w-0">
                          <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                            {pl.name}
                          </h3>
                        </Link>
                        {/* Action icons */}
                        <div className="flex items-center gap-1 shrink-0">
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
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShareTargetPlaylist(pl);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-neon/20 text-neutral-300 hover:text-brand-neon transition-colors"
                            title="Share playlist or invite members"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditTargetPlaylist(pl);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold transition-colors"
                            title="Edit playlist"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirmId(pl.id);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                            title="Delete playlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-1">{pl.description || 'Personal member playlist'}</p>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                        <span className="text-brand-neon font-mono">{pl.itemCount} items</span>
                        <div className="flex items-center gap-1.5">
                          <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="My Playlists Section" variant="minimal" showShare={false} />
                          {(() => {
                            const plKey = buildCanonicalContentKey('playlist', pl.name);
                            const count = SocialCommentService.getCommentCount(pl.id, plKey);
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDiscussionPlaylist(pl);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-[10px] font-mono font-bold transition-all cursor-pointer"
                                title={`${count} Discussion Comments & Threads`}
                              >
                                <MessageSquare className="w-3 h-3 text-brand-gold" />
                                <span>{count}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3b. Shared With You Section (Authenticated) */}
      {sectionScope !== 'public' && profile && sharedPlaylists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-neon" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Shared with You ({sharedPlaylists.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {sharedPlaylists.map((pl) => {
              const TypeIcon = getTypeIcon(pl.type);
              return (
                <div
                  key={pl.id}
                  className="group glass-card p-4 rounded-3xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden border border-brand-neon/30 hover:border-brand-neon/70"
                >
                  <Link href={`/playlists/${pl.id}`}>
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 border border-white/5 bg-black/50">
                      <Image
                        src={pl.coverUrl || '/images/studio_cover.jpg'}
                        alt={pl.name}
                        fill
                        unoptimized={Boolean(
                          pl.coverUrl &&
                            (pl.coverUrl.startsWith('data:') ||
                              pl.coverUrl.startsWith('blob:') ||
                              pl.coverUrl.startsWith('http') ||
                              pl.coverUrl.startsWith('/api/'))
                        )}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Shared Badge */}
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-brand-neon/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-brand-neon border border-brand-neon/40 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>Shared</span>
                      </div>

                      {/* Type Badge */}
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-brand-purple/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-brand-neon/30 flex items-center gap-1">
                        <TypeIcon className="w-3 h-3 text-brand-gold" />
                        <span className="capitalize">{pl.type}</span>
                      </div>

                      {/* Hover Play Button */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            playPlaylist(pl);
                          }}
                          className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </Link>

                  <div className="space-y-1.5">
                    <Link href={`/playlists/${pl.id}`} className="min-w-0 block">
                      <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                        {pl.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-neutral-400 line-clamp-1">{pl.description || 'Shared member playlist'}</p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span className="text-brand-neon font-mono">{pl.itemCount} items</span>
                      <div className="flex items-center gap-1.5">
                        <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="Shared Playlists Section" variant="minimal" showShare={false} />
                        {(() => {
                          const plKey = buildCanonicalContentKey('playlist', pl.name);
                          const count = SocialCommentService.getCommentCount(pl.id, plKey);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDiscussionPlaylist(pl);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-[10px] font-mono font-bold transition-all cursor-pointer"
                              title={`${count} Discussion Comments & Threads`}
                            >
                              <MessageSquare className="w-3 h-3 text-brand-gold" />
                              <span>{count}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Public Member Playlists (Discoverable & playable by everyone on the platform) */}
      {sectionScope !== 'mine' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-gold" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Public Member Playlists ({publicPlaylists.length})
                </h2>
                <p className="text-xs text-neutral-400">
                  Public playlists created and shared by members of ChanceTEK One — open for anyone on the platform to play
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsSyncingPublic(true);
                try {
                  await PlaylistService.syncFromServer(true);
                  refreshPlaylists();
                } finally {
                  setIsSyncingPublic(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-xs font-bold text-neutral-200 hover:text-brand-gold transition-all cursor-pointer"
              title="Sync latest public playlists from all members"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPublic ? 'animate-spin text-brand-gold' : ''}`} />
              <span>{isSyncingPublic ? 'Syncing...' : 'Refresh Public'}</span>
            </button>
          </div>

          {publicPlaylists.length === 0 ? (
            <div className="p-8 rounded-3xl glass-card border border-white/5 text-center space-y-2 bg-[#0d0d16]/70">
              <Globe className="w-8 h-8 text-brand-gold/70 mx-auto" />
              <h3 className="text-sm sm:text-base font-bold text-white">No public playlists yet</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                When any member creates a playlist and selects <span className="text-emerald-400 font-semibold">Public</span>, it appears right here for everyone on the platform to discover and play.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {publicPlaylists.map((pl) => {
                const TypeIcon = getTypeIcon(pl.type);
                const isDeleting = deleteConfirmId === pl.id;
                const isDirectOwner = Boolean(
                  (currentUserId && pl.ownerId === currentUserId) ||
                  (profile?.id && pl.ownerId === profile.id) ||
                  (user?.uid && pl.ownerId === user.uid) ||
                  (currentEmail && pl.ownerEmail && currentEmail.toLowerCase() === pl.ownerEmail.toLowerCase())
                );
                const canManagePublic = Boolean(isDirectOwner || isAdmin);

                return (
                  <div
                    key={pl.id}
                    className="group glass-card p-4 rounded-3xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden border border-white/5 hover:border-brand-purple/40"
                  >
                    {/* Delete Confirmation Overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 space-y-3 animate-in fade-in duration-200">
                        <Trash2 className="w-6 h-6 text-red-400" />
                        <p className="text-xs font-bold text-white text-center">Delete &ldquo;{pl.name}&rdquo;?</p>
                        <p className="text-[10px] text-neutral-400 text-center">This action cannot be undone.</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (currentUserId || isAdmin) {
                                PlaylistService.deletePlaylist(pl.id, currentUserId, isAdmin, currentEmail);
                                setDeleteConfirmId(null);
                                refreshPlaylists();
                              }
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <Link href={`/playlists/${pl.id}`}>
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 border border-white/5 bg-black/50">
                        <Image
                          src={pl.coverUrl || '/images/studio_cover.jpg'}
                          alt={pl.name}
                          fill
                          unoptimized={Boolean(
                            pl.coverUrl &&
                            (pl.coverUrl.startsWith('data:') ||
                              pl.coverUrl.startsWith('blob:') ||
                              pl.coverUrl.startsWith('http') ||
                              pl.coverUrl.startsWith('/api/'))
                          )}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Public Badge */}
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-emerald-400" />
                          <span>{isDirectOwner ? 'Yours · Public' : 'Public'}</span>
                        </div>

                        {/* Type Badge */}
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-brand-gold border border-white/10 flex items-center gap-1">
                          <TypeIcon className="w-3 h-3 text-brand-neon" />
                          <span className="capitalize">{pl.type}</span>
                        </div>

                        {/* Always-accessible Play Button (visible on touch & hover) */}
                        <div className="absolute bottom-2.5 right-2.5 z-10">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              playPlaylist(pl);
                            }}
                            disabled={pl.items.length === 0}
                            title={pl.items.length === 0 ? 'Add tracks to play' : `Play ${pl.name}`}
                            className="w-11 h-11 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-[0_6px_22px_rgba(245,158,11,0.55)] hover:scale-110 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </Link>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/playlists/${pl.id}`} className="block min-w-0">
                          <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                            {pl.name}
                          </h3>
                        </Link>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
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
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShareTargetPlaylist(pl);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-neon/20 text-neutral-300 hover:text-brand-neon transition-colors"
                            title="Share playlist"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {canManagePublic && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditTargetPlaylist(pl);
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold transition-colors"
                                title="Edit playlist"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteConfirmId(pl.id);
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                                title="Delete playlist"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {pl.description || `${pl.itemCount} ${pl.itemCount === 1 ? 'item' : 'items'} · Public playlist`}
                      </p>

                      {/* Creator Row & Metadata */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-neutral-400">
                        <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                          <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 border border-brand-purple/40">
                            <Image
                              src={pl.ownerAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                              alt={pl.ownerName}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                          <span className="truncate text-neutral-300">{pl.ownerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-brand-neon font-mono text-[10px]">{pl.itemCount} items</span>
                          <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="Member Playlists Section" variant="minimal" showShare={false} />
                          {(() => {
                            const plKey = buildCanonicalContentKey('playlist', pl.name);
                            const count = SocialCommentService.getCommentCount(pl.id, plKey);
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDiscussionPlaylist(pl);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-[10px] font-mono font-bold transition-all cursor-pointer"
                                title={`${count} Discussion Comments & Threads`}
                              >
                                <MessageSquare className="w-3 h-3 text-brand-gold" />
                                <span>{count}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreatePlaylistModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newPl) => {
            refreshPlaylists();
          }}
        />
      )}

      {editTargetPlaylist && (
        <EditPlaylistModal
          isOpen={Boolean(editTargetPlaylist)}
          onClose={() => setEditTargetPlaylist(null)}
          playlist={editTargetPlaylist}
          onUpdated={(updated) => {
            setEditTargetPlaylist(null);
            refreshPlaylists();
          }}
          onDeleted={() => {
            setEditTargetPlaylist(null);
            refreshPlaylists();
          }}
        />
      )}

      {shareTargetPlaylist && (
        <SharePlaylistModal
          isOpen={Boolean(shareTargetPlaylist)}
          onClose={() => setShareTargetPlaylist(null)}
          playlist={shareTargetPlaylist}
          onUpdated={() => {
            refreshPlaylists();
          }}
        />
      )}

      {showAuthModal && (
        <AuthPromptModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title={
            authPromptAction === 'create'
              ? 'Create an account to build and manage your playlists'
              : 'Sign in to save this playlist to your library'
          }
          onSuccess={() => {
            setShowAuthModal(false);
            if (authPromptAction === 'create') {
              setShowCreateModal(true);
            }
          }}
        />
      )}
      {discussionPlaylist && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionPlaylist)}
          onClose={() => setDiscussionPlaylist(null)}
          contentId={discussionPlaylist.id}
          contentKey={buildCanonicalContentKey('playlist', discussionPlaylist.name)}
          contentType="playlist"
          contentTitle={discussionPlaylist.name}
          contentSubtitle={`Playlist by ${discussionPlaylist.ownerName} • ${discussionPlaylist.itemCount} items`}
          coverUrl={discussionPlaylist.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}
          badgeLabel="Playlist"
        />
      )}
    </div>
  );
}
