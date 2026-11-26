'use client';

import React, { useEffect, useRef, useState } from 'react';

const GENERIC_COVER_PATTERNS = [
  '/images/studio_cover.jpg',
  '/images/logo.png',
  '/images/chancetekone_banner.png',
  '/images/the_lounge_ambient.jpg',
  '/images/chancetekone_logo',
  '/images/chancetekone_icon',
];

export function isGenericVideoCover(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const lower = url.toLowerCase().trim();
  return GENERIC_COVER_PATTERNS.some((p) => lower.includes(p));
}

export function buildVideoFrameSrc(videoUrl?: string | null, seekSeconds = 1.5): string {
  if (!videoUrl) return '';
  const trimmed = videoUrl.trim();
  if (!trimmed) return '';
  // Preserve blob:/data: URLs as-is without encoding
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const [withoutHash, existingHash] = trimmed.split('#');
  // Avoid double-encoding already encoded URLs
  let safeBase = withoutHash;
  try {
    safeBase = encodeURI(decodeURI(withoutHash));
  } catch {
    safeBase = encodeURI(withoutHash);
  }
  if (existingHash && existingHash.startsWith('t=')) {
    return `${safeBase}#${existingHash}`;
  }
  return `${safeBase}#t=${seekSeconds}`;
}

interface VideoThumbnailProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isHovered?: boolean;
  /** Prefer live video frame over thumbnailUrl whenever thumbnailUrl is generic or always when true */
  preferVideoFrame?: boolean;
}

/**
 * Renders the actual frame thumbnail from a video file (avoiding generic studio_cover.jpg art).
 * Automatically seeks past black intro frames (t = 1.5s or 20% of duration) once metadata loads
 * and supports smooth hover preview playback when `videoRef` + `isHovered` are provided.
 */
export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  videoUrl,
  thumbnailUrl,
  alt,
  className = 'w-full h-full object-cover',
  videoRef: externalRef,
  isHovered = false,
  preferVideoFrame = true,
}) => {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const elRef = externalRef || internalRef;
  const [videoFailed, setVideoFailed] = useState(false);

  const hasCustomThumbnail = Boolean(thumbnailUrl && !isGenericVideoCover(thumbnailUrl));
  const canRenderVideo = Boolean(videoUrl && !videoFailed);
  const frameSrc = buildVideoFrameSrc(videoUrl, 1.5);

  useEffect(() => {
    setVideoFailed(false);
  }, [videoUrl]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget;
    if (!isHovered && el.duration && Number.isFinite(el.duration) && el.duration > 0.4) {
      const targetTime = Math.min(1.5, Math.max(0.25, el.duration * 0.22));
      if (Math.abs(el.currentTime - targetTime) > 0.15) {
        try {
          el.currentTime = targetTime;
        } catch {
          // ignore seek restriction on streaming sources
        }
      }
    }
  };

  if (canRenderVideo && (preferVideoFrame || !hasCustomThumbnail)) {
    return (
      <video
        ref={elRef}
        src={frameSrc}
        poster={hasCustomThumbnail ? thumbnailUrl! : undefined}
        muted
        loop
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setVideoFailed(true)}
        aria-label={alt}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hasCustomThumbnail ? thumbnailUrl! : '/images/studio_cover.jpg'}
      alt={alt}
      className={className}
    />
  );
};

