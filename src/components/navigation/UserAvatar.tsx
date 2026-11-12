'use client';

import React, { useState, useEffect } from 'react';
import { Video as VideoIcon } from 'lucide-react';

export interface UserAvatarProps {
  avatarUrl?: string | null;
  videoUrl?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showVideo?: boolean;
  borderClassName?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-3xl',
};

const PIXEL_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  '2xl': 112,
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  videoUrl,
  name,
  size = 'md',
  className = '',
  showVideo = true,
  borderClassName,
  badge,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const cleanVideoUrl = typeof videoUrl === 'string' && videoUrl.trim() ? videoUrl.trim() : null;
  const cleanAvatarUrl = typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null;

  // Reset error states whenever media URL props change so newly saved/hydrated media renders immediately
  useEffect(() => {
    setImageError(false);
  }, [cleanAvatarUrl]);

  useEffect(() => {
    setVideoError(false);
  }, [cleanVideoUrl]);

  const initial = (name || 'Member').trim().charAt(0).toUpperCase() || 'M';
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  const defaultBorder = borderClassName !== undefined
    ? borderClassName
    : 'border border-brand-purple/40 shadow-sm';

  const hasVideo = Boolean(cleanVideoUrl && showVideo && !videoError);
  const hasImage = Boolean(cleanAvatarUrl && !imageError);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-full overflow-hidden shrink-0 select-none ${sizeClasses} ${defaultBorder} ${
        onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      } ${className}`}
    >
      {hasVideo ? (
        <video
          key={cleanVideoUrl!}
          src={cleanVideoUrl!}
          poster={
            cleanAvatarUrl && !imageError && cleanAvatarUrl !== '/images/logo.png'
              ? cleanAvatarUrl
              : undefined
          }
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={(e) => {
            e.currentTarget.play().catch(() => {});
          }}
          onError={() => setVideoError(true)}
          className="w-full h-full object-cover"
        />
      ) : hasImage ? (
        // Standard img tag handles data URLs, blob URLs, and remote URLs seamlessly
        // without Next.js domain whitelist restriction issues
        <img
          key={cleanAvatarUrl!}
          src={cleanAvatarUrl!}
          alt={name || 'User Avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-black text-brand-gold bg-gradient-to-tr from-[#1a102a] via-[#100a1c] to-[#251540] border border-brand-gold/30">
          <span>{initial}</span>
        </div>
      )}

      {/* Video Indicator Icon for larger sizes */}
      {hasVideo && (size === 'lg' || size === 'xl' || size === '2xl') && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-black/70 border border-brand-gold/60 text-brand-gold">
          <VideoIcon className="w-2.5 h-2.5" />
        </div>
      )}

      {badge && <div className="absolute bottom-0 right-0">{badge}</div>}
    </div>
  );
};

