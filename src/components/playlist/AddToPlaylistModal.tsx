'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Plus, Check, ListMusic, Music, Video, BookOpen, Layers, Sparkles } from 'lucide-react';
import { Playlist } from '@/types/playlist';
import { MediaType } from '@/types/media';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { CreatePlaylistModal } from './CreatePlaylistModal';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItem: {
    mediaId: string;
    mediaType: MediaType;
    title: string;
    artistName: string;
    coverUrl: string;
    duration?: number;
  };
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  mediaItem,
}) => {
  const { profile } = useAuth();

  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!profile) {
        setShowAuthModal(true);
      } else {
        const pls = PlaylistService.getUserPlaylists(profile.id);
        setUserPlaylists(pls);

        // Check which playlists already contain this media
        const alreadyIn = new Set<string>();
        pls.forEach((p) => {
          if (p.items.some((it) => it.mediaId === mediaItem.mediaId && it.mediaType === mediaItem.mediaType)) {
            alreadyIn.add(p.id);
          }
        });
        setAddedPlaylistIds(alreadyIn);
      }
    }
  }, [isOpen, profile, mediaItem.mediaId, mediaItem.mediaType]);

  if (!isOpen) return null;

  if (!profile) {
    return (
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={onClose}
        title="Sign in to save this to your playlist"
        description="Build your personal crates, save breakbeat gems, and organize your favorite audio and video sessions."
        onSuccess={() => {
          setShowAuthModal(false);
        }}
      />
    );
  }

  const handleToggleAdd = (playlist: Playlist) => {
    if (addedPlaylistIds.has(playlist.id)) {
      // Remove
      const item = playlist.items.find((it) => it.mediaId === mediaItem.mediaId && it.mediaType === mediaItem.mediaType);
      if (item) {
        PlaylistService.removeItemFromPlaylist(playlist.id, profile.id, item.id);
        setAddedPlaylistIds((prev) => {
          const next = new Set(prev);
          next.delete(playlist.id);
          return next;
        });
      }
    } else {
      // Add
      const res = PlaylistService.addItemToPlaylist(playlist.id, profile.id, {
        mediaId: mediaItem.mediaId,
        mediaType: mediaItem.mediaType,
      });
      if (res.success) {
        setAddedPlaylistIds((prev) => new Set(prev).add(playlist.id));
        setMessage(`Added to "${playlist.name}"`);
        setTimeout(() => setMessage(null), 2500);
      } else {
        setMessage(res.error || 'Failed to add item');
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  const handlePlaylistCreated = (newPl: Playlist) => {
    setUserPlaylists((prev) => [newPl, ...prev]);
    setAddedPlaylistIds((prev) => new Set(prev).add(newPl.id));
    setMessage(`Created and added to "${newPl.name}"`);
    setTimeout(() => setMessage(null), 2500);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'music': return Music;
      case 'video': return Video;
      case 'audiobook': return BookOpen;
      default: return Layers;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl border border-brand-purple/40 space-y-5 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0">
                <Image src={mediaItem.coverUrl} alt={mediaItem.title} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-brand-gold uppercase tracking-wider">
                  Add to Crate Playlist
                </p>
                <h3 className="text-sm font-bold text-white truncate max-w-[200px]">
                  {mediaItem.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                  {mediaItem.artistName}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Toast */}
          {message && (
            <div className="p-2.5 rounded-xl bg-brand-purple/30 border border-brand-purple/50 text-xs text-white text-center font-medium animate-in fade-in">
              {message}
            </div>
          )}

          {/* Create New Playlist Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] border-2 border-white/50 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,158,11,0.8)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5 text-black stroke-[3.5]" />
            <span>+ Create New Playlist & Add</span>
          </button>

          {/* Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
            {userPlaylists.length === 0 ? (
              <div className="text-center py-8 space-y-2 text-neutral-400">
                <ListMusic className="w-8 h-8 mx-auto text-neutral-400 opacity-60" />
                <p className="text-xs">You have no playlists yet.</p>
                <p className="text-[11px] text-neutral-400">Click above to create your first breakbeat crate!</p>
              </div>
            ) : (
              userPlaylists.map((pl) => {
                const isAdded = addedPlaylistIds.has(pl.id);
                const Icon = getIconForType(pl.type);
                const isCompatible = pl.type === 'mixed' || pl.type === mediaItem.mediaType;

                return (
                  <button
                    key={pl.id}
                    onClick={() => handleToggleAdd(pl)}
                    disabled={!isCompatible}
                    className={`w-full p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-left ${
                      isAdded
                        ? 'bg-brand-purple/30 border-brand-gold text-white'
                        : isCompatible
                        ? 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                        : 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <Image src={pl.coverUrl} alt={pl.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-white">{pl.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Icon className="w-3 h-3 text-brand-gold" />
                            <span className="capitalize">{pl.type}</span>
                          </span>
                          <span>·</span>
                          <span>{pl.itemCount} items</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isAdded
                          ? 'bg-brand-gold text-black'
                          : 'border border-white/20 text-transparent hover:border-white/40'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
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
          initialMediaItem={{
            mediaId: mediaItem.mediaId,
            mediaType: mediaItem.mediaType,
          }}
        />
      )}
    </>
  );
};
