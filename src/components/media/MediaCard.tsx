'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, BookOpen, Video as VideoIcon, Disc3, Sparkles, ListPlus, FileText, Share2, MessageSquare } from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';
import { Track, Album, Artist, Video, Audiobook, MediaType } from '@/types/media';
import { MusicCatalogService, getDefaultCoverForTrack } from '@/lib/music/MusicCatalogService';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

interface MediaCardProps {
  item: Track | Album | Artist | Video | Audiobook;
  type: 'track' | 'album' | 'artist' | 'video' | 'audiobook';
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, type }) => {
  const { playTrack } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);

  const isTrack = type === 'track';
  const isAlbum = type === 'album';
  const isArtist = type === 'artist';
  const isVideo = type === 'video';
  const isAudiobook = type === 'audiobook';
  const isPlayableMedia = isTrack || isVideo || isAudiobook;
  const [hasImgError, setHasImgError] = useState(false);

  const canonicalKey = React.useMemo(() => {
    if (isTrack) {
      const t = item as Track;
      return buildCanonicalContentKey('song', t.title, t.artistName);
    }
    if (isAlbum) {
      const a = item as Album;
      return buildCanonicalContentKey('album', a.title, a.artistName);
    }
    if (isArtist) {
      const art = item as Artist;
      return buildCanonicalContentKey('artist', art.name);
    }
    if (isVideo) {
      const v = item as Video;
      return buildCanonicalContentKey('video', v.title, v.artistName);
    }
    if (isAudiobook) {
      const ab = item as Audiobook;
      return buildCanonicalContentKey('audiobook', ab.title, ab.author);
    }
    return '';
  }, [item, isTrack, isAlbum, isArtist, isVideo, isAudiobook]);

  const [commentCount, setCommentCount] = useState(() =>
    SocialCommentService.getCommentCount(item.id, canonicalKey)
  );

  React.useEffect(() => {
    const updateCount = () => {
      setCommentCount(SocialCommentService.getCommentCount(item.id, canonicalKey));
    };
    updateCount();
    const unsub1 = SocialCommentService.subscribe(item.id, updateCount);
    let unsub2: (() => void) | undefined;
    if (canonicalKey) {
      unsub2 = SocialCommentService.subscribe(canonicalKey, updateCount);
    }
    const unsubAll = SocialCommentService.subscribeAll(updateCount);
    return () => {
      unsub1();
      if (unsub2) unsub2();
      unsubAll();
    };
  }, [item.id, canonicalKey]);

  const rawAudiobookUrl = isAudiobook ? (item as Audiobook).chapters?.[0]?.audioUrl || '' : '';
  const resolvedAudiobookUrl = rawAudiobookUrl.includes('1793148168438_OrlandoFigueroa')
    ? '/videos/OrlandoFigueroa.mp4'
    : rawAudiobookUrl;
  const baseAudiobookUrl = resolvedAudiobookUrl.split('?')[0].toLowerCase();

  const isPdfBook =
    isAudiobook &&
    Boolean(
      (item as Audiobook).pdfUrl ||
      (item as Audiobook).mediaFormat === 'pdf' ||
      baseAudiobookUrl.endsWith('.pdf') ||
      (item as Audiobook).chapters?.[0]?.pdfUrl
    );

  const isVideoAudiobook =
    isAudiobook &&
    !isPdfBook &&
    Boolean(
      (item as Audiobook).mediaFormat === 'video' ||
      baseAudiobookUrl.endsWith('.mp4') ||
      baseAudiobookUrl.endsWith('.mov') ||
      baseAudiobookUrl.includes('/catalog/video/')
    );

  const videoUrlForCard = isVideo
    ? (item as Video).videoUrl
    : isVideoAudiobook
      ? resolvedAudiobookUrl
      : '';

  const getImage = () => {
    if (isArtist) return (item as Artist).avatarUrl || '/images/logo.png';
    if (isVideo) return (item as Video).thumbnailUrl || '';
    if (isAudiobook) return (item as Audiobook).coverUrl || '';
    if (hasImgError) return getDefaultCoverForTrack(item as any);

    if (isAlbum) {
      return MusicCatalogService.resolveAlbumCover(item as any);
    }
    return MusicCatalogService.resolveTrackCover(item as any);
  };

  const resolvedCover = getImage();
  const isBannerLike =
    Boolean(resolvedCover) &&
    (resolvedCover.includes('banner') ||
      resolvedCover.includes('chancetek') ||
      resolvedCover.includes('genres') ||
      resolvedCover.includes('8_of_spades_works'));

  const getHref = () => {
    switch (type) {
      case 'track': return `/music/${item.id}`;
      case 'album': return `/albums/${item.id}`;
      case 'artist': return `/artists/${item.id}`;
      case 'video': return `/videos/${item.id}`;
      case 'audiobook': return `/audiobooks/${item.id}`;
    }
  };

  const getTitle = () => {
    if (isArtist) return (item as Artist).name;
    return (item as any).title;
  };

  const getSubtitle = () => {
    if (isArtist) return (item as Artist).genres.join(', ');
    if (isAudiobook) return `By ${(item as Audiobook).author}`;
    if (isVideo) return (item as Video).artistName;
    if (isAlbum) return (item as Album).artistName;
    if (isTrack) return (item as Track).artistName;
    return (item as any).artistName || (item as any).genre;
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTrack) {
      playTrack(item as Track);
    } else if (isAlbum) {
      const albumTracks = MusicCatalogService.getAlbumTracks(item.id);
      if (albumTracks.length > 0) {
        playTrack(albumTracks[0], albumTracks.slice(1));
      }
    }
  };

  const handleAddToPlaylistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlaylistModal(true);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if ((isVideo || isVideoAudiobook) && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if ((isVideo || isVideoAudiobook) && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getMediaItemForModal = () => {
    const mediaType: MediaType = isTrack ? 'music' : isVideo ? 'video' : 'audiobook';
    return {
      mediaId: item.id,
      mediaType,
      title: getTitle(),
      artistName: getSubtitle(),
      coverUrl: getImage(),
      duration: (item as any).duration,
    };
  };

  return (
    <>
      <Link
        href={getHref()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group glass-card p-3 rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden block"
      >
        {/* Thumbnail Container */}
        <div
          className={`relative w-full rounded-xl overflow-hidden mb-3 border border-white/5 bg-black/60 ${isVideo || isVideoAudiobook ? 'aspect-video' : 'aspect-square'
            } ${isArtist ? 'rounded-full' : ''}`}
        >
          {isVideo || (isVideoAudiobook && !resolvedCover) ? (
            <>
              {/* Real Video Player with Hover Auto-Play */}
              <video
                ref={videoRef}
                src={videoUrlForCard}
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Duration Pill */}
              {(item as any).duration > 0 && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-neutral-200 border border-white/10">
                  {formatDuration((item as any).duration)}
                </div>
              )}

              {/* Hover Play Indicator */}
              <div
                className={`absolute inset-0 bg-black/30 transition-opacity duration-300 flex items-center justify-center ${isHovered ? 'opacity-0' : 'opacity-100'
                  }`}
              >
                <div className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl border border-white/20">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>

              {/* Live Playing Wave Indicator on Hover */}
              {isHovered && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-brand-gold/40 flex items-center gap-1 text-[9px] font-bold text-brand-gold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-ping" />
                  Live Preview
                </div>
              )}
            </>
          ) : isPdfBook ? (
            <div className="relative w-full h-full bg-gradient-to-br from-rose-950/60 via-neutral-950 to-black p-4 flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase tracking-wider mb-1">
                PDF Book
              </span>
              <p className="text-xs font-bold text-white line-clamp-2 px-1">{getTitle()}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{getSubtitle()}</p>
            </div>
          ) : !resolvedCover ? (
            <div className="relative w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-4 flex flex-col items-center justify-center text-center">
              <BookOpen className="w-10 h-10 text-brand-gold/70 mb-2 group-hover:scale-110 transition-transform" />
              <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[9px] font-bold uppercase tracking-wider mb-1">
                Audiobook
              </span>
              <p className="text-xs font-bold text-white line-clamp-2 px-1">{getTitle()}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{getSubtitle()}</p>
            </div>
          ) : (
            <>
              {isBannerLike ? (
                <div className="relative w-full h-full bg-black/80 flex items-center justify-center">
                  {/* Ambient Blurred Background to prevent letterbox dead space */}
                  <Image
                    src={getImage()}
                    alt=""
                    fill
                    className="object-cover blur-xl opacity-40 scale-125 pointer-events-none"
                    unoptimized={Boolean(getImage() && (getImage().startsWith('data:') || getImage().startsWith('blob:')))}
                  />
                  {/* Crisp Uncropped Foreground (Preserves ChanceTEK graph, Break Beats typography & hardware) */}
                  <Image
                    src={resolvedCover}
                    alt={getTitle()}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-contain p-1.5 transition-transform duration-500 group-hover:scale-105"
                    priority={isAlbum}
                    unoptimized={Boolean(resolvedCover && (resolvedCover.startsWith('data:') || resolvedCover.startsWith('blob:')))}
                    onError={() => setHasImgError(true)}
                  />
                </div>
              ) : (
                <Image
                  src={resolvedCover}
                  alt={getTitle()}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized={Boolean(resolvedCover && (resolvedCover.startsWith('data:') || resolvedCover.startsWith('blob:')))}
                  onError={() => setHasImgError(true)}
                />
              )}

              {/* Hover Play Button Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                {isTrack || isAlbum ? (
                  <button
                    onClick={handlePlayClick}
                    className="w-12 h-12 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer"
                    title={isAlbum ? 'Play Album' : 'Play Track'}
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                ) : isAudiobook ? (
                  <div className="w-12 h-12 rounded-full bg-brand-purple/90 text-white flex items-center justify-center shadow-2xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center">
                    <Disc3 className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Type Badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-brand-gold border border-white/10">
                {type}
              </div>

              {/* Direct Comment & Thread Badge on Thumbnail */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDiscussion(true);
                }}
                className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md text-[10px] font-mono font-bold text-neutral-300 hover:text-brand-gold border border-white/15 hover:border-brand-gold/40 flex items-center gap-1.5 shadow-lg transition-all duration-200 z-10 cursor-pointer"
                title={`${commentCount} Discussion Comments & Threads`}
              >
                <MessageSquare className="w-3 h-3 text-brand-gold" />
                <span>{commentCount}</span>
              </button>
            </>
          )}

          {/* Add to Playlist Quick Button */}
          {isPlayableMedia && (
            <button
              onClick={handleAddToPlaylistClick}
              className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/70 hover:bg-brand-purple text-neutral-300 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-all shadow-md cursor-pointer"
              title="Add to Playlist"
            >
              <ListPlus className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Universal Share Quick Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowShareModal(true);
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-brand-gold text-neutral-300 hover:text-black border border-white/10 opacity-0 group-hover:opacity-100 transition-all shadow-md z-10 cursor-pointer"
            title={`Share ${type}`}
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metadata */}
        <div className="space-y-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h4
              className="text-xs md:text-sm font-semibold text-white truncate group-hover:text-brand-gold transition-colors flex-1"
              title={getTitle()}
            >
              {getTitle()}
            </h4>
          </div>
          <div className="flex items-center justify-between gap-1 text-[11px] text-neutral-400">
            <p className="truncate flex-1 font-medium hover:text-white transition-colors" title={`Artist: ${getSubtitle()}`}>
              {getSubtitle()}
            </p>
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0 flex items-center gap-1">
              <ReactionButtons
                contentId={item.id}
                contentKey={canonicalKey}
                contentType={type}
                contentTitle={getTitle()}
                contextLocation="Explore / Feed Card"
                initialLikes={(item as any).likeCount}
                variant="minimal"
                showShare={false}
              />

              <button
                onClick={() => setShowDiscussion(true)}
                className="px-1.5 py-0.5 rounded-full text-neutral-300 hover:text-brand-gold bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold"
                title={`${commentCount} Discussion Comments & Threads`}
              >
                <MessageSquare className="w-3 h-3 text-brand-gold" />
                <span>{commentCount}</span>
              </button>
            </div>
          </div>
          {isTrack && (item as Track).albumTitle && (
            <p
              className="text-[10px] text-brand-gold/90 font-medium truncate"
              title={`Album: ${(item as Track).albumTitle}`}
            >
              <span className="text-neutral-500 font-mono">LP:</span> {(item as Track).albumTitle}
            </p>
          )}
          {(item as any).label && (item as any).label !== getSubtitle() && (item as any).label !== (item as Track)?.albumTitle && (
            <p className="text-[10px] font-semibold text-neutral-400 truncate tracking-wide" title={`Label: ${(item as any).label}`}>
              {(item as any).label}
            </p>
          )}
        </div>
      </Link>

      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={getMediaItemForModal()}
        />
      )}

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: (type === 'track' ? 'song' : type) as any,
            item,
          }}
        />
      )}

      {showDiscussion && (
        <UniversalDiscussionModal
          isOpen={showDiscussion}
          onClose={() => setShowDiscussion(false)}
          contentId={item.id}
          contentKey={canonicalKey}
          contentType={type}
          contentTitle={getTitle()}
          contentSubtitle={getSubtitle()}
          coverUrl={resolvedCover || getImage()}
          badgeLabel={type}
        />
      )}
    </>
  );
};
