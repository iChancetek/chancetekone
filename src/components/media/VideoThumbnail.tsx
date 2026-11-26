'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  isGenericVideoThumbnailUrl,
  resolveAuthenticVideoThumbnail,
} from '@/lib/media/videoThumbnailMap';

export function isGenericVideoCover(url?: string | null): boolean {
  return isGenericVideoThumbnailUrl(url);
}

export function buildVideoFrameSrc(videoUrl?: string | null, seekSeconds = 1.5): string {
  if (!videoUrl) return '';
  const trimmed = videoUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const [withoutHash, existingHash] = trimmed.split('#');
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
  videoId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isHovered?: boolean;
  /** Prefer live video frame when no static extracted video thumbnail exists */
  preferVideoFrame?: boolean;
}

/**
 * Displays the authentic video frame thumbnail for any video (just like YouTube).
 * 1. If a real extracted JPEG thumbnail exists (`/images/video-thumbs/...` or non-generic uploaded poster),
 *    renders an instant, zero-overhead `<img>` (keeping iPhone & Android PWAs silky-smooth 60fps!) and
 *    smoothly switches to `<video>` only during desktop hover preview.
 * 2. If no static extracted thumbnail exists yet (e.g. a brand-new external video), lazily activates
 *    `<video preload="metadata">` via IntersectionObserver to render its real frame at t=1.5s.
 */
export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  videoId,
  videoUrl,
  thumbnailUrl,
  alt,
  className = 'w-full h-full object-cover',
  videoRef: externalRef,
  isHovered = false,
  preferVideoFrame = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const elRef = externalRef || internalRef;
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);

  const authenticThumb = resolveAuthenticVideoThumbnail(videoId, videoUrl, thumbnailUrl);
  const hasAuthenticStaticThumb = Boolean(authenticThumb && !imgFailed);
  const canRenderVideo = Boolean(videoUrl && !videoFailed);
  const frameSrc = buildVideoFrameSrc(videoUrl, 1.5);

  useEffect(() => {
    setVideoFailed(false);
    setImgFailed(false);
  }, [videoUrl, thumbnailUrl]);

  // Only observe viewport when we actually need a live <video> element for frame extraction
  useEffect(() => {
    if (hasAuthenticStaticThumb && !isHovered) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px', threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasAuthenticStaticThumb, isHovered]);

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

  // Fast path: real extracted JPEG thumbnail exists and user isn't hovering for desktop preview
  if (hasAuthenticStaticThumb && (!isHovered || !canRenderVideo)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={authenticThumb}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        className={className}
      />
    );
  }

  // Hover preview or fallback live frame extraction for newly uploaded videos without static JPEG
  if (canRenderVideo && (isHovered || preferVideoFrame || !hasAuthenticStaticThumb)) {
    return (
      <div ref={containerRef} className="w-full h-full bg-[#080810] relative">
        {isNearViewport || isHovered ? (
          <video
            ref={elRef}
            src={frameSrc}
            poster={hasAuthenticStaticThumb ? authenticThumb : undefined}
            muted
            loop
            autoPlay={isHovered}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => setVideoFailed(true)}
            aria-label={alt}
            className={`pointer-events-none ${className}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#141024] via-[#0a0a12] to-[#050509]" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hasAuthenticStaticThumb ? authenticThumb : '/images/video-thumbs/video-1.jpg'}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
};
