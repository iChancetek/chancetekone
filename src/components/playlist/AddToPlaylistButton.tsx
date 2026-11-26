'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { MediaType } from '@/types/media';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AddToPlaylistModal } from './AddToPlaylistModal';

export interface AddToPlaylistButtonProps {
  mediaId: string;
  mediaType: MediaType | 'podcast';
  title: string;
  artistName: string;
  coverUrl?: string;
  duration?: number;
  audioUrl?: string;
  videoUrl?: string;
  genre?: string;
  variant?: 'icon' | 'overlay' | 'pill';
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export const AddToPlaylistButton: React.FC<AddToPlaylistButtonProps> = ({
  mediaId,
  mediaType,
  title,
  artistName,
  coverUrl = '/images/studio_cover.jpg',
  duration,
  audioUrl,
  videoUrl,
  genre,
  variant = 'icon',
  size = 'sm',
  label = 'Add to Playlist',
  className = '',
}) => {
  const { profile, user } = useAuth();
  const currentUserId = profile?.id || user?.uid || '';
  const currentUserEmail = (profile?.email || user?.email) || undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [playlistCount, setPlaylistCount] = useState(0);

  useEffect(() => {
    const syncState = () => {
      if (!currentUserId) {
        setPlaylistCount(0);
        return;
      }
      const pls = PlaylistService.getUserPlaylists(currentUserId, currentUserEmail);
      const count = pls.filter((p) => p.items.some((it) => it.mediaId === mediaId)).length;
      setPlaylistCount(count);
    };
    syncState();
    const unsub = PlaylistService.subscribe(syncState);
    return () => unsub();
  }, [currentUserId, currentUserEmail, mediaId]);

  const isInPlaylist = playlistCount > 0;

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  const tooltip = isInPlaylist
    ? `In ${playlistCount} ${playlistCount === 1 ? 'playlist' : 'playlists'} — Click + to add to another or create new`
    : `Add "${title}" to a playlist or create a new one`;

  const renderTrigger = () => {
    if (variant === 'overlay') {
      const btnSize = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';
      const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
      return (
        <button
          type="button"
          onClick={handleOpen}
          title={tooltip}
          aria-label={`Add ${title} to playlist`}
          className={`relative ${btnSize} rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer touch-manipulation border ${
            isInPlaylist
              ? 'bg-brand-gold text-black border-amber-200/80 shadow-[0_0_14px_rgba(245,195,68,0.55)]'
              : 'bg-black/80 hover:bg-brand-gold text-brand-gold hover:text-black border-brand-gold/45'
          } ${className}`}
        >
          <Plus className={`${iconSize} stroke-[3]`} />
          {isInPlaylist && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black" />
          )}
        </button>
      );
    }

    if (variant === 'pill') {
      const pad = size === 'md' ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[11px]';
      return (
        <button
          type="button"
          onClick={handleOpen}
          title={tooltip}
          aria-label={`Add ${title} to playlist`}
          className={`inline-flex items-center gap-1.5 ${pad} rounded-full font-bold transition-all shadow-md cursor-pointer touch-manipulation border ${
            isInPlaylist
              ? 'bg-brand-gold/25 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-black'
              : 'bg-brand-purple/25 hover:bg-brand-gold/25 border-brand-purple/50 hover:border-brand-gold text-white hover:text-brand-gold'
          } ${className}`}
        >
          <Plus className="w-4 h-4 stroke-[3] text-brand-gold shrink-0" />
          <span>{isInPlaylist ? `In Playlist (${playlistCount})` : label}</span>
        </button>
      );
    }

    // Default: 'icon'
    const btnSize = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';
    const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
    return (
      <button
        type="button"
        onClick={handleOpen}
        title={tooltip}
        aria-label={`Add ${title} to playlist`}
        className={`relative ${btnSize} rounded-full flex items-center justify-center transition-all cursor-pointer touch-manipulation border shrink-0 ${
          isInPlaylist
            ? 'bg-brand-gold/20 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-black'
            : 'bg-white/5 hover:bg-brand-gold/20 border-white/15 hover:border-brand-gold/60 text-neutral-200 hover:text-brand-gold'
        } ${className}`}
      >
        <Plus className={`${iconSize} stroke-[2.8]`} />
        {isInPlaylist && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
        )}
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}
      {isOpen && (
        <AddToPlaylistModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          mediaItem={{
            mediaId,
            mediaType,
            title,
            artistName,
            coverUrl,
            duration,
            audioUrl,
            videoUrl,
            genre,
          }}
        />
      )}
    </>
  );
};

