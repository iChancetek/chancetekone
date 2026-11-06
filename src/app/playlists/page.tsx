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
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function PlaylistsPage() {
  const { profile, user, isAdmin } = useAuth();
  const { playPlaylist } = usePlayer();

  const [activeTab, setActiveTab] = useState<'all' | PlaylistType>('all');
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
  const [, setCommentTick] = useState(0);

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
  const isAuthenticated = Boolean(profile || user || isAdmin);

  const refreshPlaylists = () => {
    const filter: PlaylistFilter = {
      type: activeTab,
      searchQuery,
      sortBy: 'popular',
    };
    const pub = PlaylistService.getPublicPlaylists(filter);
    setPublicPlaylists(pub);

    if (currentUserId || currentEmail) {
      const userPls = PlaylistService.getUserPlaylists(currentUserId, currentEmail, {
        type: activeTab,
        searchQuery,
      });
      setUserPlaylists(userPls);

      const sharedPls = PlaylistService.getSharedPlaylists(currentUserId, currentEmail, {
        type: activeTab,
        searchQuery,
      });
      setSharedPlaylists(sharedPls);

      const savedPls = PlaylistService.getSavedPlaylists(currentUserId);
      setSavedPlaylists(savedPls);
    } else {
      setUserPlaylists([]);
      setSharedPlaylists([]);
      setSavedPlaylists([]);
    }
  };

  useEffect(() => {
    refreshPlaylists();
    const unsubscribe = PlaylistService.subscribe(() => {
      refreshPlaylists();
    });
    const unsubComments = SocialCommentService.subscribeAll(() => {
      setCommentTick((t) => t + 1);
    });
    return () => {
      unsubscribe();
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
    { id: 'all', label: 'All Crates', icon: ListMusic },
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
              Next-Gen Playlist Engine
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Artists & Creators Playlists
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Explore Members Playlists By various Artist,Creators, DJs, Etc
              <br />
              Listen, Watch and Rank Your Favorite Playlists.
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
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                  isActive
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
            placeholder="Search crates by title or vibe..."
            className="w-full pl-9 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple transition-all"
          />
        </div>
      </div>

      {/* 3. My Playlists Section (Authenticated) or Guest Intro */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-brand-gold shrink-0" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                My Crates {profile && `(${userPlaylists.length})`}
              </h2>
              <p className="text-xs text-neutral-400 font-medium">Build Your Personal Playlist</p>
            </div>
          </div>
          {profile && userPlaylists.length > 0 && (
            <button
              onClick={handleCreateClick}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-105 transition-all flex items-center gap-1.5 border border-white/50"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ New Crate</span>
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
                Sign in to create unlimited custom playlists, organize tracks and 4K videos, and save crates to your library.
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
                        src={pl.coverUrl}
                        alt={pl.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Visibility Badge */}
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-neutral-200 border border-white/10 flex items-center gap-1">
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
                      <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShareTargetPlaylist(pl);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-neon/20 text-neutral-300 hover:text-brand-neon transition-colors"
                          title="Share crate or invite members"
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
                    <p className="text-xs text-neutral-400 line-clamp-1">{pl.description || 'Custom curated crate'}</p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span className="text-brand-neon font-mono">{pl.itemCount} items</span>
                      <div className="flex items-center gap-1.5">
                        <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="Personal Crates Section" variant="minimal" showShare={false} />
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

      {/* 3b. Shared With You Section (Authenticated) */}
      {profile && sharedPlaylists.length > 0 && (
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
                        src={pl.coverUrl}
                        alt={pl.name}
                        fill
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
                    <p className="text-xs text-neutral-400 line-clamp-1">{pl.description || 'Shared private crate'}</p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span className="text-brand-neon font-mono">{pl.itemCount} items</span>
                      <div className="flex items-center gap-1.5">
                        <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="Shared Crates Section" variant="minimal" showShare={false} />
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

      {/* 4. Featured & Community Public Crates */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-brand-gold animate-bounce" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Featured & Community Crates
          </h2>
        </div>

        {publicPlaylists.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-sm">
            No public playlists match your search criteria.
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
                        src={pl.coverUrl}
                        alt={pl.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Featured Ribbon */}
                      {pl.isFeatured && (
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-brand-gold text-black text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-current" />
                          <span>Master Crate</span>
                        </div>
                      )}

                      {/* Type Badge */}
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-brand-gold border border-white/10 flex items-center gap-1">
                        <TypeIcon className="w-3 h-3 text-brand-neon" />
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
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/playlists/${pl.id}`} className="block min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                          {pl.name}
                        </h3>
                      </Link>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShareTargetPlaylist(pl);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-neon/20 text-neutral-300 hover:text-brand-neon transition-colors"
                          title="Share crate or invite members"
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
                      {pl.description}
                    </p>

                    {/* Creator Row & Metadata */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-neutral-400">
                      <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                        <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0 border border-brand-purple/40">
                          <Image
                            src={pl.ownerAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                            alt={pl.ownerName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <span className="truncate text-neutral-300">{pl.ownerName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ReactionButtons contentId={pl.id} contentType="playlist" contentTitle={pl.name} contextLocation="Community Crates Section" variant="minimal" showShare={false} />
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
          contentSubtitle={`Curated Crate by ${discussionPlaylist.ownerName} • ${discussionPlaylist.itemCount} items`}
          coverUrl={discussionPlaylist.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}
          badgeLabel="Playlist"
        />
      )}
    </div>
  );
}
