'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, Heart, MoreHorizontal, Trash2, MessageSquare, Share2 } from 'lucide-react';
import { Track } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { MusicCatalogService, getDefaultCoverForTrack } from '@/lib/music/MusicCatalogService';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

interface TrackRowProps {
  track: Track;
  index: number;
  showCover?: boolean;
  onRemove?: (track: Track) => void;
  contextTracks?: Track[];
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  showCover = true,
  onRemove,
  contextTracks,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, likedTrackIds, toggleLikeTrack } = usePlayer();
  const [hasImgError, setHasImgError] = React.useState(false);
  const [showDiscussion, setShowDiscussion] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const canonicalKey = React.useMemo(
    () => buildCanonicalContentKey('song', track.title, track.artistName),
    [track.title, track.artistName]
  );
  const [commentCount, setCommentCount] = React.useState(() =>
    SocialCommentService.getCommentCount(track.id, canonicalKey)
  );

  React.useEffect(() => {
    const updateCount = () => {
      setCommentCount(SocialCommentService.getCommentCount(track.id, canonicalKey));
    };
    updateCount();
    const unsub1 = SocialCommentService.subscribe(track.id, updateCount);
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
  }, [track.id, canonicalKey]);

  const resolvedCover = hasImgError
    ? getDefaultCoverForTrack(track)
    : MusicCatalogService.resolveTrackCover(track);

  const isCurrent = currentTrack?.id === track.id;
  const isLiked = likedTrackIds.has(track.id);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handlePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else {
      if (contextTracks && contextTracks.length > 0) {
        playTrack(track, contextTracks);
      } else {
        playTrack(track);
      }
    }
  };

  return (
    <div
      onClick={() => handlePlay()}
      className={`group flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer touch-manipulation select-none ${
        isCurrent
          ? 'bg-brand-purple/20 border border-brand-purple/40 text-white shadow-inner'
          : 'hover:bg-white/5 active:bg-white/10 border border-transparent text-neutral-300'
      }`}
    >
      {/* Left: Index & Play Button & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Track Index & Play Indicator */}
        <div
          onClick={(e) => handlePlay(e)}
          className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-mono text-neutral-400 cursor-pointer"
        >
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-1 bg-brand-gold rounded-full animate-eq-1" />
              <span className="w-1 bg-brand-gold rounded-full animate-eq-2" />
              <span className="w-1 bg-brand-gold rounded-full animate-eq-3" />
            </div>
          ) : (
            <>
              {/* Show track index number on desktop when not hovered */}
              <span className="hidden sm:inline-block group-hover:hidden">{index + 1}</span>
              {/* On mobile devices (iPhones, Androids, Tablets), ALWAYS show the play button for immediate 1-tap playback */}
              <button
                type="button"
                aria-label={`Play ${track.title}`}
                className={`flex sm:hidden group-hover:!flex text-brand-gold hover:text-white transition-all transform active:scale-95 ${
                  isCurrent ? '!flex text-brand-gold' : ''
                }`}
              >
                {isCurrent && isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Album Artwork with direct tap-to-play */}
        {showCover && (
          <div
            onClick={(e) => handlePlay(e)}
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden shrink-0 shadow-md cursor-pointer group/cover"
            title="Tap to play"
          >
            <Image
              src={resolvedCover}
              alt={track.title}
              fill
              sizes="(max-width: 640px) 40px, 44px"
              className="object-cover transition-transform group-hover/cover:scale-105"
              unoptimized={Boolean(resolvedCover && (resolvedCover.startsWith('data:') || resolvedCover.startsWith('blob:')))}
              onError={() => setHasImgError(true)}
            />
            <div
              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
              }`}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4 text-brand-gold fill-current" />
              ) : (
                <Play className="w-4 h-4 text-brand-gold fill-current ml-0.5" />
              )}
            </div>
          </div>
        )}

        {/* Track Title and Artist Details */}
        <div className="min-w-0 pr-2 sm:pr-4 flex-1">
          <p
            onClick={(e) => handlePlay(e)}
            className="text-xs sm:text-sm font-semibold text-white group-hover:text-brand-gold truncate block transition-colors cursor-pointer"
            title={track.title}
          >
            {track.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:text-[11px] text-neutral-400">
            <Link
              href={`/artists/${track.artistId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-neutral-300 hover:text-white font-medium truncate transition-colors"
              title={`Artist: ${track.artistName}`}
            >
              {track.artistName}
            </Link>
            {track.albumTitle && (
              <span
                className="text-brand-gold/90 font-medium truncate hidden xs:flex items-center gap-1"
                title={`Album: ${track.albumTitle}`}
              >
                <span className="text-neutral-500">•</span>
                <span className="truncate">{track.albumTitle}</span>
              </span>
            )}
            {track.label && track.label !== track.artistName && track.label !== track.albumTitle && (
              <span className="text-[10px] text-neutral-400 font-mono truncate hidden md:inline" title={`Label: ${track.label}`}>
                • {track.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Album / Genre Info (Desktop Only) */}
      <div className="hidden md:flex flex-col justify-center flex-1 min-w-0 text-xs px-2">
        {track.albumTitle ? (
          <span
            className="text-neutral-200 font-medium truncate hover:text-white transition-colors"
            title={`Album: ${track.albumTitle}`}
          >
            {track.albumTitle}
          </span>
        ) : (
          <span className="text-neutral-400 truncate">{track.genre || 'Single'}</span>
        )}
        {track.genre && track.albumTitle && (
          <span className="text-[10px] text-neutral-400 font-mono truncate">{track.genre}</span>
        )}
      </div>

      {/* Right: Spoken TTS, BPM, Reactions, Discussion & Duration */}
      <div className="flex items-center gap-1.5 sm:gap-3 text-xs font-mono text-neutral-400 shrink-0">
        <VoiceNarrationButton
          text={`${track.title} by ${track.artistName}. ${track.bpm ? `Tempo: ${track.bpm} Beats Per Minute. ` : ''}${track.genre ? `Genre: ${track.genre}. ` : ''}${track.label ? `Label: ${track.label}.` : ''}`}
          variant="icon"
          className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity"
        />

        {track.bpm && <span className="hidden md:inline text-[10px] text-brand-gold/80">{track.bpm} BPM</span>}

        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 sm:gap-1.5">
          {/* Reaction emojis displayed on desktop viewports to prevent mobile horizontal overflow */}
          <div className="hidden sm:flex items-center">
            <ReactionButtons
              contentId={track.id}
              contentKey={canonicalKey}
              contentType="music"
              contentTitle={`${track.title} (${track.artistName})`}
              contextLocation="Track Row / Crate List"
              initialLikes={track.likeCount}
              variant="minimal"
              showShare={false}
            />
          </div>

          {/* Discussion trigger with comment count (Universal on both mobile & desktop) */}
          <button
            onClick={() => setShowDiscussion(true)}
            className="group/btn flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-brand-gold transition-all duration-200 cursor-pointer shadow-sm"
            title={`${commentCount} Discussion Comments & Threads`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-brand-gold transition-transform group-hover/btn:scale-110" />
            <span className="text-[10px] sm:text-[11px] font-mono font-bold">{commentCount}</span>
          </button>

          <button
            onClick={() => setShowShare(true)}
            className="hidden sm:flex p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Share track & text message"
          >
            <Share2 className="w-3.5 h-3.5 hover:text-brand-gold transition-colors" />
          </button>
        </div>

        <span className="w-9 sm:w-10 text-right text-[10px] sm:text-xs">{formatTime(track.duration)}</span>

        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(track);
            }}
            className="p-1 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove track to 45-day recovery vault"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDiscussion && (
        <UniversalDiscussionModal
          isOpen={showDiscussion}
          onClose={() => setShowDiscussion(false)}
          contentId={track.id}
          contentKey={canonicalKey}
          contentType="song"
          contentTitle={track.title}
          contentSubtitle={`${track.artistName} • ${track.albumTitle || track.genre || 'Single'}`}
          coverUrl={resolvedCover}
          badgeLabel="Song"
        />
      )}

      {showShare && (
        <UniversalShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          entity={{
            type: 'song',
            item: track,
          }}
        />
      )}
    </div>
  );
};
