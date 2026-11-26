'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { FavoritesService, FavoriteCategory } from '@/lib/favorites/FavoritesService';
import { useAuth } from '@/lib/auth/AuthContext';

interface FavoriteButtonProps {
  id: string;
  category: FavoriteCategory;
  title?: string;
  subtitle?: string;
  coverUrl?: string;
  genre?: string;
  artistName?: string;
  duration?: number;
  url?: string;
  variant?: 'icon' | 'pill' | 'overlay';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  id,
  category,
  title,
  subtitle,
  coverUrl,
  genre,
  artistName,
  duration,
  url,
  variant = 'icon',
  size = 'sm',
  showLabel = false,
  className = '',
}) => {
  const { profile, user } = useAuth();
  const userId = profile?.id || user?.uid || 'guest';

  const [favorited, setFavorited] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      setFavorited(FavoritesService.isFavorite(id, userId, category));
    };
    sync();
    const unsub = FavoritesService.subscribeAll(sync);
    return () => unsub();
  }, [id, userId, category]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = FavoritesService.toggleFavorite(
      {
        id,
        category,
        metadata: {
          title,
          subtitle,
          coverUrl,
          genre,
          artistName,
          duration,
          url,
        },
      },
      userId
    );
    setFavorited(next);
  };

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={favorited ? 'Remove from Favorites (Library)' : 'Add to Favorites (Library)'}
        aria-label={favorited ? `Remove ${title || 'item'} from Favorites` : `Add ${title || 'item'} to Favorites`}
        className={`flex items-center justify-center rounded-full backdrop-blur-md border transition-all duration-200 cursor-pointer shadow-lg active:scale-90 ${size === 'md' ? 'w-9 h-9' : 'w-8 h-8'
          } ${favorited
            ? 'bg-red-500 text-white border-red-300/80 shadow-[0_0_16px_rgba(239,68,68,0.55)] scale-105'
            : 'bg-black/65 hover:bg-black/85 text-white border-white/25 hover:border-red-400/70 hover:text-red-400'
          } ${className}`}
      >
        <Heart className={`${iconSize} ${favorited ? 'fill-current' : ''}`} />
      </button>
    );
  }

  if (variant === 'pill' || showLabel) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={favorited ? 'Saved in Library Favorites' : 'Save to Library Favorites'}
        aria-label={favorited ? `Remove ${title || 'item'} from Favorites` : `Add ${title || 'item'} to Favorites`}
        className={`inline-flex items-center gap-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 border ${size === 'md' ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[11px]'
          } ${favorited
            ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-[0_0_14px_rgba(239,68,68,0.25)]'
            : 'bg-white/5 hover:bg-red-500/15 border-white/15 hover:border-red-400/50 text-neutral-200 hover:text-red-400'
          } ${className}`}
      >
        <Heart className={`${iconSize} ${favorited ? 'fill-current text-red-500' : ''}`} />
        <span>{favorited ? 'Favorited' : 'Favorite'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={favorited ? 'Remove from Favorites' : 'Add to Favorites'}
      aria-label={favorited ? `Remove ${title || 'item'} from Favorites` : `Add ${title || 'item'} to Favorites`}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer active:scale-90 border ${size === 'md' ? 'w-9 h-9' : 'w-8 h-8'
        } ${favorited
          ? 'bg-red-500/20 border-red-500/50 text-red-500'
          : 'bg-white/5 hover:bg-red-500/15 border-white/10 hover:border-red-400/40 text-neutral-300 hover:text-red-400'
        } ${className}`}
    >
      <Heart className={`${iconSize} ${favorited ? 'fill-current' : ''}`} />
    </button>
  );
};

