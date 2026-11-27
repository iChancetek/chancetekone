'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X,
  Plus,
  Check,
  ListMusic,
  Music,
  Video,
  BookOpen,
  Layers,
  Globe,
  Lock,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { Playlist, PlaylistType, PlaylistVisibility } from '@/types/playlist';
import { MediaType } from '@/types/media';
import { PlaylistService, PlaylistMediaInput } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { CreatePlaylistModal } from './CreatePlaylistModal';

export interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: {
    mediaId: string;
    mediaType: MediaType | 'podcast';
    title: string;
    artistName: string;
    coverUrl?: string;
    duration?: number;
    audioUrl?: string;
    videoUrl?: string;
    genre?: string;
  };
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  mediaItem,
}) => {
  const { profile, user, isAdmin } = useAuth();
  const currentUserId = profile?.id || user?.uid || '';
  const currentUserEmail = (profile?.email || user?.email) || undefined;

  const [mounted, setMounted] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState<PlaylistVisibility>(
    profile?.defaultPlaylistVisibility || 'private'
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncUserPlaylists = () => {
    if (!currentUserId) return;
    const pls = PlaylistService.getUserPlaylists(currentUserId, currentUserEmail);
    setUserPlaylists(pls);
    const alreadyIn = new Set<string>();
    pls.forEach((p) => {
      if (p.items.some((it) => it.mediaId === mediaItem.mediaId)) {
        alreadyIn.add(p.id);
      }
    });
    setAddedPlaylistIds(alreadyIn);
    if (pls.length === 0) {
      setShowQuickCreate(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNewPlaylistVisibility(profile?.defaultPlaylistVisibility || 'private');
      if (!currentUserId) {
        setShowAuthModal(true);
      } else {
        setShowAuthModal(false);
        syncUserPlaylists();
      }
    } else {
      setShowQuickCreate(false);
      setNewPlaylistName('');
      setMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUserId, currentUserEmail, mediaItem.mediaId, mediaItem.mediaType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showCreateModal) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showCreateModal, onClose]);

  if (!isOpen || !mounted) return null;

  const mediaPayload: PlaylistMediaInput = {
    mediaId: mediaItem.mediaId,
    mediaType: mediaItem.mediaType,
    title: mediaItem.title,
    artistName: mediaItem.artistName,
    coverUrl: mediaItem.coverUrl || '/images/studio_cover.jpg',
    duration: mediaItem.duration,
    audioUrl: mediaItem.audioUrl,
    videoUrl: mediaItem.videoUrl,
    genre: mediaItem.genre,
  };

  if (!currentUserId) {
    return createPortal(
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="relative z-[9990]"
      >
        <AuthPromptModal
          isOpen={showAuthModal}
          onClose={onClose}
          title="Sign in to save this to your playlist"
          description="Create personal private or public playlists and add any song, video, audiobook, or podcast."
          onSuccess={() => {
            setShowAuthModal(false);
          }}
        />
      </div>,
      document.body
    );
  }

  const showToast = (text: string, ms = 2600) => {
    setMessage(text);
    setTimeout(() => {
      setMessage((curr) => (curr === text ? null : curr));
    }, ms);
  };

  const handleToggleAdd = (playlist: Playlist) => {
    if (addedPlaylistIds.has(playlist.id)) {
      const item = playlist.items.find((it) => it.mediaId === mediaItem.mediaId);
      if (item) {
        PlaylistService.removeItemFromPlaylist(
          playlist.id,
          currentUserId,
          item.id,
          isAdmin,
          currentUserEmail
        );
        syncUserPlaylists();
        showToast(`Removed from "${playlist.name}"`);
      }
    } else {
      const res = PlaylistService.addItemToPlaylist(
        playlist.id,
        currentUserId,
        mediaPayload,
        isAdmin,
        currentUserEmail
      );
      if (res.success) {
        syncUserPlaylists();
        showToast(`Added to "${playlist.name}"`);
      } else {
        showToast(res.error || 'Failed to add item', 3000);
      }
    }
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;

    const inferredType: PlaylistType =
      mediaItem.mediaType === 'podcast' ? 'mixed' : mediaItem.mediaType;

    const newPl = PlaylistService.createPlaylist({
      ownerId: currentUserId,
      ownerName: profile?.name || user?.displayName || (isAdmin ? 'Administrator' : 'Platform Member'),
      ownerEmail: currentUserEmail,
      ownerAvatarUrl: profile?.avatarUrl || user?.photoURL || undefined,
      name: trimmed,
      description: '',
      type: inferredType,
      visibility: newPlaylistVisibility,
      coverUrl: mediaItem.coverUrl || undefined,
      initialItems: [mediaPayload],
    });

    setNewPlaylistName('');
    setShowQuickCreate(false);
    syncUserPlaylists();
    showToast(
      newPlaylistVisibility === 'public'
        ? `Published "${newPl.name}" publicly & added "${mediaItem.title}"!`
        : `Created "${newPl.name}" & added "${mediaItem.title}"!`
    );
    await PlaylistService.syncPlaylistNow(newPl);
  };

  const handlePlaylistCreated = (newPl: Playlist) => {
    // Guarantee the item is inside the newly created playlist
    if (!newPl.items.some((it) => it.mediaId === mediaItem.mediaId)) {
      PlaylistService.addItemToPlaylist(
        newPl.id,
        currentUserId,
        mediaPayload,
        isAdmin,
        currentUserEmail
      );
    }
    syncUserPlaylists();
    showToast(`Created "${newPl.name}" & added "${mediaItem.title}"!`);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'music':
        return Music;
      case 'video':
        return Video;
      case 'audiobook':
        return BookOpen;
      default:
        return Layers;
    }
  };

  const coverSrc = mediaItem.coverUrl || '/images/studio_cover.jpg';

  const modalNode = (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md glass-panel p-5 sm:p-6 rounded-3xl border border-brand-purple/40 space-y-4 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.9)] max-h-[88vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-neutral-900">
                <Image
                  src={coverSrc}
                  alt={mediaItem.title}
                  fill
                  className="object-cover"
                  unoptimized={
                    coverSrc.startsWith('data:') ||
                    coverSrc.startsWith('blob:') ||
                    coverSrc.startsWith('http')
                  }
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-brand-gold uppercase tracking-wider">
                  Add to Playlist
                </p>
                <h3 className="text-sm font-bold text-white truncate max-w-[230px]">
                  {mediaItem.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate max-w-[230px]">
                  {mediaItem.artistName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Toast */}
          {message && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-xs text-emerald-100 text-center font-semibold animate-in fade-in flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="truncate">{message}</span>
            </div>
          )}

          {/* Create New Playlist Section (1-step inline OR full customizer) */}
          {!showQuickCreate ? (
            <button
              type="button"
              onClick={() => setShowQuickCreate(true)}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.45)] border-2 border-white/50 hover:scale-[1.01] hover:shadow-[0_0_32px_rgba(245,158,11,0.75)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-black stroke-[3.2]" />
              <span>Create New Playlist</span>
            </button>
          ) : (
            <form
              onSubmit={handleQuickCreateSubmit}
              className="p-3.5 rounded-2xl bg-brand-purple/15 border border-brand-gold/45 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  New Playlist (Auto-Adds This Item)
                </span>
                {userPlaylists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(false)}
                    className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <input
                type="text"
                required
                maxLength={80}
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter new playlist name..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
              />

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewPlaylistVisibility('private')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                      newPlaylistVisibility === 'private'
                        ? 'bg-brand-purple/40 border-brand-gold text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPlaylistVisibility('public')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                      newPlaylistVisibility === 'public'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Public
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Create &amp; Add</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full pt-1.5 border-t border-white/10 text-[11px] text-neutral-300 hover:text-brand-gold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>More options (cover art, description, share with members)</span>
              </button>
            </form>
          )}

          {/* Existing Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">
              Your Existing Playlists ({userPlaylists.length})
            </p>
            {userPlaylists.length === 0 ? (
              <div className="text-center py-6 space-y-2 text-neutral-400">
                <ListMusic className="w-8 h-8 mx-auto text-neutral-400 opacity-60" />
                <p className="text-xs">No playlists yet.</p>
                <p className="text-[11px] text-neutral-400">
                  Name your new playlist above and this item will be added automatically!
                </p>
              </div>
            ) : (
              userPlaylists.map((pl) => {
                const isAdded = addedPlaylistIds.has(pl.id);
                const Icon = getIconForType(pl.type);

                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleToggleAdd(pl)}
                    className={`w-full p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer ${
                      isAdded
                        ? 'bg-brand-purple/30 border-brand-gold text-white'
                        : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:border-brand-gold/40 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-neutral-900">
                        <Image
                          src={pl.coverUrl || '/images/studio_cover.jpg'}
                          alt={pl.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-white">{pl.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Icon className="w-3 h-3 text-brand-gold" />
                            <span className="capitalize">{pl.type}</span>
                          </span>
                          <span>·</span>
                          <span>
                            {pl.itemCount} {pl.itemCount === 1 ? 'item' : 'items'}
                          </span>
                          <span>·</span>
                          <span className="capitalize">{pl.visibility}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isAdded
                          ? 'bg-brand-gold text-black'
                          : 'border border-white/25 text-neutral-300 hover:border-brand-gold hover:text-brand-gold'
                      }`}
                    >
                      {isAdded ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreatePlaylistModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handlePlaylistCreated}
          initialMediaItem={mediaPayload}
        />
      )}
    </>
  );

  return createPortal(modalNode, document.body);
};
