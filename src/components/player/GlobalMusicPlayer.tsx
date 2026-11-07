'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  Heart,
  ListPlus,
  ListMusic,
  Disc3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Brain,
  X,
  GripVertical,
  MessageSquare,
} from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAI } from '@/lib/ai/AIContext';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { ContextualAIRecommendations } from '@/components/ai/ContextualAIRecommendations';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { SampleGenealogyModal } from '@/components/ai/SampleGenealogyModal';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export const GlobalMusicPlayer: React.FC = () => {
  const { openAI } = useAI();
  const [showAIPocket, setShowAIPocket] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    isPlayerCollapsed,
    isPlayerVisible,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    playNext,
    playPrev,
    openFullScreen,
    likedTrackIds,
    toggleLikeTrack,
    togglePlayerCollapse,
    expandPlayer,
    collapsePlayer,
    closePlayer,
    openPlayer,
  } = usePlayer();

  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const canonicalTrackKey = React.useMemo(() => {
    return currentTrack ? buildCanonicalContentKey('song', currentTrack.title, currentTrack.artistName) : '';
  }, [currentTrack]);
  const [trackCommentCount, setTrackCommentCount] = useState(0);

  useEffect(() => {
    if (!currentTrack) return;
    const update = () => {
      setTrackCommentCount(SocialCommentService.getCommentCount(currentTrack.id, canonicalTrackKey));
    };
    update();
    const unsub1 = SocialCommentService.subscribe(currentTrack.id, update);
    let unsub2: (() => void) | undefined;
    if (canonicalTrackKey) {
      unsub2 = SocialCommentService.subscribe(canonicalTrackKey, update);
    }
    const unsubAll = SocialCommentService.subscribeAll(update);
    return () => {
      unsub1();
      if (unsub2) unsub2();
      unsubAll();
    };
  }, [currentTrack, canonicalTrackKey]);

  // Floating Draggable Position for Collapsed Player
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);
  const hasMovedRef = useRef(false);

  // Initialize position on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && dragPosition === null) {
      const isMobile = window.innerWidth < 768;
      const initialX = isMobile ? 16 : 288;
      const initialY = Math.max(20, window.innerHeight - (isMobile ? 140 : 90));
      setDragPosition({ x: initialX, y: initialY });
    }
  }, [dragPosition]);

  // Keep player inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!dragPosition) return;
      const pillWidth = dragRef.current?.offsetWidth || 280;
      const pillHeight = dragRef.current?.offsetHeight || 56;
      const maxX = Math.max(10, window.innerWidth - pillWidth - 10);
      const maxY = Math.max(10, window.innerHeight - pillHeight - 10);
      setDragPosition((prev) => {
        if (!prev) return prev;
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(10, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dragPosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    if (!dragPosition) return;
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: dragPosition.x,
      startPosY: dragPosition.y,
    };
    hasMovedRef.current = false;
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;

    if (Math.hypot(deltaX, deltaY) > 3) {
      hasMovedRef.current = true;
    }

    const pillWidth = dragRef.current?.offsetWidth || 280;
    const pillHeight = dragRef.current?.offsetHeight || 56;
    const maxX = Math.max(10, window.innerWidth - pillWidth - 10);
    const maxY = Math.max(10, window.innerHeight - pillHeight - 10);

    const newX = Math.min(Math.max(10, pointerStartRef.current.startPosX + deltaX), maxX);
    const newY = Math.min(Math.max(10, pointerStartRef.current.startPosY + deltaY), maxY);

    setDragPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerStartRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      pointerStartRef.current = null;
      setIsDragging(false);
    }
  };

  if (!currentTrack || !isPlayerVisible) return null;

  const isLiked = likedTrackIds.has(currentTrack.id);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const linerNotesText =
    currentTrack.lyrics ||
    `${currentTrack.title} by ${currentTrack.artistName}. Authentic breakbeat cut at ${currentTrack.bpm || 120} BPM.`;

  // COLLAPSED MINI-PILL PLAYER (DRAGGABLE TO ANY SCREEN POSITION)
  if (isPlayerCollapsed) {
    const isTopHalf = dragPosition && typeof window !== 'undefined' ? dragPosition.y < window.innerHeight / 2 : false;

    return (
      <div
        ref={dragRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          left: dragPosition ? `${dragPosition.x}px` : undefined,
          top: dragPosition ? `${dragPosition.y}px` : undefined,
          touchAction: 'none',
        }}
        className={`fixed z-40 select-none cursor-grab active:cursor-grabbing transition-shadow duration-200 animate-in fade-in slide-in-from-bottom-2 ${
          !dragPosition ? 'bottom-20 md:bottom-6 left-4 md:left-72' : ''
        }`}
      >
        <div
          className={`flex items-center gap-2 p-1.5 pr-3 rounded-full bg-[#0c0c16]/95 backdrop-blur-xl border transition-all group shadow-2xl ${
            isDragging
              ? 'border-brand-gold shadow-[0_0_25px_rgba(245,195,68,0.5)] scale-[1.03]'
              : 'border-brand-purple/40 hover:border-brand-neon/60 shadow-[0_10px_30px_rgba(0,0,0,0.7)]'
          }`}
        >
          {/* Drag Handle Icon */}
          <div
            className="p-1 text-neutral-500 hover:text-brand-gold transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing"
            title="Drag to reposition player anywhere on screen"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Spinning Mini Vinyl Artwork */}
          <div
            onClick={(e) => {
              if (hasMovedRef.current) return;
              expandPlayer();
            }}
            className="relative w-9 h-9 rounded-full overflow-hidden cursor-pointer flex-shrink-0 border border-brand-gold/40 shadow-inner group-hover:scale-105 transition-transform"
            title="Click to expand music player"
          >
            <Image
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              fill
              sizes="36px"
              className={`object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronUp className="w-4 h-4 text-brand-gold" />
            </div>
          </div>

          {/* Track Summary */}
          <div
            onClick={(e) => {
              if (hasMovedRef.current) return;
              expandPlayer();
            }}
            className="cursor-pointer max-w-[130px] sm:max-w-[200px] min-w-0"
            title={`${currentTrack.title} — ${currentTrack.artistName}${currentTrack.albumTitle ? ` • ${currentTrack.albumTitle}` : ''}`}
          >
            <p className="text-xs font-bold text-white truncate group-hover:text-brand-gold transition-colors">
              {currentTrack.title}
            </p>
            <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
              <span className="truncate">{currentTrack.artistName}</span>
              {currentTrack.albumTitle && (
                <span className="text-brand-gold/80 font-medium truncate hidden sm:inline" title={`Album: ${currentTrack.albumTitle}`}>
                  • {currentTrack.albumTitle}
                </span>
              )}
              {currentTrack.bpm && (
                <span className="text-[9px] text-brand-neon font-mono shrink-0">· {currentTrack.bpm} BPM</span>
              )}
            </p>
          </div>

          {/* Quick Controls */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current text-black" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-black ml-0.5" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Repeat Option on Collapsed Player */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRepeat();
              }}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-brand-gold bg-brand-gold/15'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'Repeat All' : 'Repeat Current Track'}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAIPocket(!showAIPocket);
              }}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showAIPocket
                  ? 'bg-brand-gold text-black'
                  : 'bg-brand-purple/30 text-brand-gold hover:text-white'
              }`}
              title="Toggle AI Recommendations"
            >
              <Brain className="w-3.5 h-3.5" />
            </button>

            {/* Discussion & Threads Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDiscussionModal(true);
              }}
              className="relative p-1.5 rounded-full text-neutral-400 hover:text-brand-gold hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
              title={`${trackCommentCount} Discussion Threads & Comments`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
              <span className="text-[10px] font-mono font-bold text-neutral-300">
                {trackCommentCount}
              </span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                expandPlayer();
              }}
              className="p-1.5 rounded-full text-neutral-400 hover:text-brand-gold transition-colors ml-0.5 cursor-pointer"
              title="Expand Full Music Player"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Close Music Player Option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePlayer();
              }}
              className="p-1.5 rounded-full text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-colors ml-0.5 cursor-pointer"
              title="Close Music Player from screen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* AI Crate Pocket Popover (When in collapsed mode, adaptive direction) */}
        {showAIPocket && (
          <div
            className={`absolute ${
              isTopHalf ? 'top-16' : 'bottom-16'
            } left-0 w-[90vw] sm:w-[460px] max-h-[65vh] overflow-y-auto rounded-3xl glass-panel border border-brand-purple/50 shadow-2xl p-2 bg-[#0c0a18]/98 animate-in fade-in slide-in-from-bottom-2 z-50`}
          >
            <div className="flex justify-end p-1">
              <button
                onClick={() => setShowAIPocket(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ContextualAIRecommendations
              currentMedia={{
                id: currentTrack.id,
                type: 'track',
                title: currentTrack.title,
                artist: currentTrack.artistName,
                genre: currentTrack.genre,
                bpm: currentTrack.bpm,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // EXPANDED FULL-WIDTH BAR PLAYER
  return (
    <>
      {/* Floating AI Recommendations Tray */}
      {showAIPocket && (
        <div className="fixed bottom-24 right-4 md:right-8 z-40 w-[95vw] sm:w-[500px] max-h-[72vh] overflow-y-auto rounded-3xl glass-panel border border-brand-purple/50 shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-2 bg-[#0d0a1a]/98 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-bold text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-brand-neon" />
              Autonomous AI Crate Recommendations
            </span>
            <button
              onClick={() => setShowAIPocket(false)}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-1">
            <ContextualAIRecommendations
              currentMedia={{
                id: currentTrack.id,
                type: 'track',
                title: currentTrack.title,
                artist: currentTrack.artistName,
                genre: currentTrack.genre,
                bpm: currentTrack.bpm,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Bottom Docked Player (Elevated above MobileNav on mobile viewports) */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 h-20 md:h-24 glass-panel border-t border-white/10 z-40 px-2 sm:px-4 md:px-8 flex items-center justify-between gap-1.5 sm:gap-3 md:gap-4 bg-[#08080c]/95 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] overflow-hidden max-w-full touch-manipulation">
        {/* Left: Artwork, Track Info, Like & Add to Playlist */}
        <div className="flex items-center gap-2 md:gap-4 w-auto sm:w-1/3 md:w-1/4 min-w-0 max-w-[42%] sm:max-w-none">
          <div
            onClick={openFullScreen}
            className="relative w-10 h-10 sm:w-11 sm:h-11 md:w-14 md:h-14 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer border border-white/10 shadow-md group"
            title="Open Full Screen Player"
          >
            <Image
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              fill
              sizes="(max-width: 768px) 44px, 56px"
              className={`object-cover transition-transform group-hover:scale-105 ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div
            className="min-w-0 flex-1"
            title={`${currentTrack.title} — ${currentTrack.artistName}${currentTrack.albumTitle ? ` • ${currentTrack.albumTitle}` : ''}`}
          >
            <p
              onClick={openFullScreen}
              className="text-xs md:text-sm font-bold text-white truncate cursor-pointer hover:text-brand-gold transition-colors"
            >
              {currentTrack.title}
            </p>
            <p className="text-[10px] md:text-xs text-neutral-400 truncate flex items-center gap-1.5">
              <span className="font-medium text-neutral-300 truncate" title={`Artist: ${currentTrack.artistName}`}>
                {currentTrack.artistName}
              </span>
              {currentTrack.albumTitle && (
                <span className="text-brand-gold/85 font-medium truncate hidden sm:inline" title={`Album: ${currentTrack.albumTitle}`}>
                  • {currentTrack.albumTitle}
                </span>
              )}
              {currentTrack.bpm && (
                <span className="text-[9px] text-brand-neon font-mono font-bold shrink-0">
                  • {currentTrack.bpm} BPM
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleLikeTrack(currentTrack.id)}
              className={`p-1.5 rounded-full transition-colors ${
                isLiked ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white'
              }`}
              title="Like"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => setShowPlaylistModal(true)}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 transition-colors hidden sm:block"
              title="Add to Playlist"
            >
              <ListPlus className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSampleModal(true)}
              className="p-1.5 rounded-full text-brand-gold hover:text-white hover:bg-brand-purple/30 transition-colors"
              title="Inspect Sample DNA & Break Genealogy (Sample Detective)"
            >
              <Disc3 className="w-4 h-4 animate-spin-slow" />
            </button>

            <VoiceNarrationButton
              text={linerNotesText}
              variant="icon"
              voice="onyx"
              className="hidden lg:flex"
            />
          </div>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1 md:gap-2 flex-1 max-w-xl min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-5">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full text-xs transition-colors hidden sm:block ${
                isShuffled ? 'text-brand-gold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={playPrev}
              className="p-1 sm:p-1.5 rounded-full text-neutral-300 hover:text-white transition-colors"
              title="Previous"
            >
              <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" />
              ) : (
                <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black ml-0.5" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-1 sm:p-1.5 rounded-full text-neutral-300 hover:text-white transition-colors"
              title="Next"
            >
              <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer hidden sm:block ${
                repeatMode !== 'off' ? 'text-brand-gold bg-brand-gold/15' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'Repeat All' : 'Repeat Current Track'}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <Repeat className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
            </button>
          </div>

          {/* Scrubber Bar */}
          <div className="w-full flex items-center gap-2 text-[10px] md:text-xs text-neutral-400 font-mono">
            <span className="w-7 sm:w-8 text-right text-[9px] sm:text-[10px] md:text-xs shrink-0">{formatTime(currentTime)}</span>
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seek(pos * duration);
              }}
              className="flex-1 h-1.5 md:h-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer relative overflow-hidden group"
            >
              <div
                className="h-full bg-gradient-to-r from-brand-purple to-brand-gold rounded-full relative"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="w-7 sm:w-8 text-[9px] sm:text-[10px] md:text-xs shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: AI Pocket, Volume, Collapse & Expand */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 md:gap-3 shrink-0">
          {/* Discussion & Community Threads Trigger */}
          <button
            onClick={() => setShowDiscussionModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-brand-purple/30 text-neutral-300 hover:text-brand-gold transition-all border border-white/10 cursor-pointer shadow-sm"
            title="Open Discussion Threads & Community Comments"
          >
            <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-xs font-bold hidden xl:inline">Discuss</span>
            <span className="px-1.5 py-0.2 rounded-full bg-brand-gold text-black text-[10px] font-black font-mono">
              {trackCommentCount}
            </span>
          </button>

          {/* Autonomous AI Recommendations Trigger */}
          <button
            onClick={() => setShowAIPocket(!showAIPocket)}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm ${
              showAIPocket
                ? 'bg-brand-gold text-black border-brand-gold'
                : 'bg-brand-purple/30 hover:bg-brand-purple/50 text-brand-gold border-brand-purple/50 hover:text-white'
            }`}
            title="Open Autonomous AI Crate Recommendations"
          >
            <Brain className="w-3.5 h-3.5 text-brand-neon" />
            <span className="hidden xl:inline">AI Pocket</span>
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-full accent-brand-gold cursor-pointer"
            />
          </div>

          {/* Ask AI Assistant Trigger */}
          <button
            onClick={() =>
              openAI(
                `Tell me about "${currentTrack.title}" by ${currentTrack.artistName}, its BPM, and similar breakbeats!`
              )
            }
            className="hidden sm:flex p-1.5 sm:p-2 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 text-brand-neon hover:text-white transition-all border border-brand-purple/40"
            title="Ask ChanceTEK One AI about this track"
          >
            <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
          </button>

          {/* Collapse Button to Free Up Screen Room */}
          <button
            onClick={collapsePlayer}
            className="p-2 rounded-full bg-white/5 hover:bg-brand-purple/30 text-neutral-300 hover:text-brand-gold transition-all border border-white/5"
            title="Collapse Music Player (Create more screen room)"
          >
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={openFullScreen}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Full Screen Immersive Player"
          >
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Close Music Player Option */}
          <button
            onClick={closePlayer}
            className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-all border border-white/5 cursor-pointer"
            title="Close Music Player from screen"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {showPlaylistModal && currentTrack && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={{
            mediaId: currentTrack.id,
            mediaType: 'music',
            title: currentTrack.title,
            artistName: currentTrack.artistName,
            coverUrl: currentTrack.coverUrl,
            duration: currentTrack.duration,
          }}
        />
      )}

      {/* Sample Detective & Break Genealogist Modal */}
      {showSampleModal && currentTrack && (
        <SampleGenealogyModal
          track={currentTrack}
          isOpen={showSampleModal}
          onClose={() => setShowSampleModal(false)}
        />
      )}

      {/* Track Discussion & Threads Modal */}
      {showDiscussionModal && currentTrack && (
        <UniversalDiscussionModal
          isOpen={showDiscussionModal}
          onClose={() => setShowDiscussionModal(false)}
          contentId={currentTrack.id}
          contentKey={canonicalTrackKey}
          contentType="song"
          contentTitle={currentTrack.title}
          contentSubtitle={`${currentTrack.artistName} • ${currentTrack.albumTitle || currentTrack.genre || 'Single'}`}
          coverUrl={currentTrack.coverUrl}
          badgeLabel="Song"
        />
      )}
    </>
  );
};
