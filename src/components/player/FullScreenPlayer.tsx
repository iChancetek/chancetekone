'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Sparkles,
  ListMusic,
  FileText,
  Radio,
  ListPlus,
  Brain,
  Disc3,
  Mic2,
  MessageSquare,
} from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { ContextualAIRecommendations } from '@/components/ai/ContextualAIRecommendations';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { SampleGenealogyCard } from '@/components/ai/SampleGenealogyCard';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

/** Apple-Music-style lyrics that follow playback. Uses [mm:ss.xx] LRC tags when present, else paces lines across the track. */
const LiveLyrics: React.FC<{
  lyrics?: string;
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
}> = ({ lyrics, currentTime, duration, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const lines = useMemo(() => {
    const raw = (lyrics || '').split(/\r?\n/);
    const tag = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s*/;
    const parsed = raw
      .map((l) => {
        const m = l.match(tag);
        return { text: l.replace(tag, '').trim(), time: m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : null };
      })
      .filter((l) => l.text.length > 0);
    const synced = parsed.length > 0 && parsed.every((l) => l.time !== null);
    if (synced) return { items: parsed.map((l) => ({ text: l.text, time: l.time as number })), synced: true };
    const total = duration > 0 ? duration : 180;
    const start = Math.min(8, total * 0.05);
    const step = (total - start - 5) / Math.max(parsed.length, 1);
    return {
      items: parsed.map((l, i) => ({ text: l.text, time: start + i * step })),
      synced: false,
    };
  }, [lyrics, duration]);

  let active = -1;
  lines.items.forEach((l, i) => {
    if (currentTime >= l.time) active = i;
  });

  useEffect(() => {
    const el = lineRefs.current[active];
    const box = containerRef.current;
    if (el && box) {
      box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    }
  }, [active]);

  if (lines.items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-neutral-400">
        <FileText className="w-8 h-8 text-neutral-500" />
        <p className="text-sm font-semibold text-white">No lyrics available</p>
        <p className="text-xs">Lyrics haven&apos;t been added for this track yet.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto no-scrollbar py-24 px-2 scroll-smooth">
      {!lines.synced && (
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-6">Auto-paced lyrics</p>
      )}
      {lines.items.map((l, i) => (
        <button
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          onClick={() => onSeek(l.time)}
          className={`block w-full text-left py-1.5 font-extrabold leading-tight transition-all duration-500 origin-left cursor-pointer ${
            i === active
              ? 'text-white text-2xl sm:text-3xl scale-100 opacity-100'
              : i < active
              ? 'text-white/30 text-xl sm:text-2xl blur-[0.5px] hover:text-white/60'
              : 'text-white/45 text-xl sm:text-2xl blur-[0.5px] hover:text-white/70'
          }`}
        >
          {l.text}
        </button>
      ))}
    </div>
  );
};

export const FullScreenPlayer: React.FC<{ onAskAI?: (prompt: string) => void }> = ({ onAskAI }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    isFullScreenOpen,
    closeFullScreen,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    playNext,
    playPrev,
    queue,
    likedTrackIds,
    toggleLikeTrack,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'live-lyrics' | 'lyrics' | 'queue' | 'ai-crate' | 'sample-dna'>('sample-dna');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);

  const canonicalKey = React.useMemo(() => {
    return currentTrack ? buildCanonicalContentKey('song', currentTrack.title, currentTrack.artistName) : '';
  }, [currentTrack]);
  const [trackCommentCount, setTrackCommentCount] = useState(0);

  useEffect(() => {
    if (!currentTrack) return;
    const update = () => {
      setTrackCommentCount(SocialCommentService.getCommentCount(currentTrack.id, canonicalKey));
    };
    update();
    const unsub1 = SocialCommentService.subscribe(currentTrack.id, update);
    let unsub2: (() => void) | undefined;
    if (canonicalKey) {
      unsub2 = SocialCommentService.subscribe(canonicalKey, update);
    }
    const unsubAll = SocialCommentService.subscribeAll(update);
    return () => {
      unsub1();
      if (unsub2) unsub2();
      unsubAll();
    };
  }, [currentTrack, canonicalKey]);

  if (!isFullScreenOpen || !currentTrack) return null;

  const isLiked = likedTrackIds.has(currentTrack.id);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const linerNotesText =
    currentTrack.lyrics ||
    `${currentTrack.title} by ${currentTrack.artistName}. Engineered with authentic syncopated drum breaks at ${currentTrack.bpm || 120} BPM. Analog bassline and classic sampler grit crafted for elite DJ sets.`;

  return (
    <div className="fixed inset-0 z-[80] bg-[#08080c]/98 backdrop-blur-3xl flex flex-col justify-between p-4 sm:p-6 md:p-10 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      {/* Background Ambient Glow derived from Cover Art */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none blur-[140px] bg-gradient-to-tr from-brand-purple via-brand-violet to-brand-amber"
      />

      {/* Top Bar with Title & Close */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-brand-gold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse text-brand-neon" />
          Immersive Breakbeat Master Player
        </div>

        <button
          onClick={closeFullScreen}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Center Layout: Left (Artwork + Info) | Right (Lyrics / Queue / AI Crate) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center my-auto max-w-7xl mx-auto w-full py-4">
        {/* Left: Large Artwork with Vinyl Effect (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center text-center">
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/15 group">
            <Image
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              fill
              className={`object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-purple/20 via-transparent to-brand-gold/20 pointer-events-none" />
          </div>

          <div className="mt-6 space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight" title={currentTrack.title}>
              {currentTrack.title}
            </h1>
            <p className="text-base sm:text-lg text-brand-gold font-medium" title={`Artist: ${currentTrack.artistName}`}>
              {currentTrack.artistName}
            </p>
            {currentTrack.albumTitle && (
              <p className="text-xs sm:text-sm text-neutral-300 font-medium" title={`Album: ${currentTrack.albumTitle}`}>
                <span className="text-neutral-500 font-mono">Album:</span>{' '}
                <span className="text-white font-semibold">{currentTrack.albumTitle}</span>
                {currentTrack.bpm ? ` • ${currentTrack.bpm} BPM` : ''}
              </p>
            )}
            {currentTrack.label && currentTrack.label !== currentTrack.artistName && currentTrack.label !== currentTrack.albumTitle && (
              <p className="text-xs font-bold text-brand-neon tracking-wide" title={`Label: ${currentTrack.label}`}>
                {currentTrack.label}
              </p>
            )}
          </div>

          {/* AI Quick Action */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => {
                if (onAskAI) {
                  closeFullScreen();
                  onAskAI(`Tell me about the drum breaks, genre history, and sample roots of "${currentTrack.title}" by ${currentTrack.artistName}.`);
                }
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-neon/40 text-brand-neon hover:text-white text-xs font-semibold shadow-lg transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
              Ask Break Beats AI
            </button>

            <VoiceNarrationButton
              text={linerNotesText}
              label="Narrate Liner Notes"
              variant="pill"
              voice="onyx"
            />
          </div>
        </div>

        {/* Right: AI Crate Recommendations / Lyrics / Queue (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-[460px] glass-panel rounded-3xl p-4 sm:p-6 border border-white/10 shadow-2xl bg-white/5 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 shrink-0 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('live-lyrics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'live-lyrics'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Follow the lyrics as the song plays"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>
            <button
              onClick={() => setActiveTab('sample-dna')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sample-dna'
                  ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black shadow-md border border-brand-gold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5 text-black animate-spin-slow" />
              <span>Sample DNA</span>
              <span className="text-[9px] px-1 rounded bg-black text-brand-gold font-extrabold">ORIGINS</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-crate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ai-crate'
                  ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-md border border-brand-purple/50'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-brand-neon" />
              <span>AI Crate Pocket</span>
              <span className="text-[9px] px-1 rounded bg-brand-gold text-black font-extrabold">LIVE</span>
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Liner Notes</span>
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'queue'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Up Next ({queue.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className={`flex-1 pr-1 ${activeTab === 'live-lyrics' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'}`}>
            {activeTab === 'live-lyrics' && (
              <LiveLyrics
                key={currentTrack.id}
                lyrics={currentTrack.lyrics}
                currentTime={currentTime}
                duration={duration}
                onSeek={seek}
              />
            )}

            {activeTab === 'sample-dna' && (
              <SampleGenealogyCard track={currentTrack} />
            )}

            {activeTab === 'ai-crate' && (
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
            )}

            {activeTab === 'lyrics' && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                    Breakbeat Anatomy & Liner Notes
                  </span>
                  <VoiceNarrationButton
                    text={linerNotesText}
                    label="Read Aloud"
                    variant="badge"
                    voice="onyx"
                  />
                </div>
                <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-line font-medium">
                  {currentTrack.lyrics || (
                    <div className="space-y-3">
                      <p className="font-semibold text-white">
                        Instrumental Breakbeat Masterwork
                      </p>
                      <p className="text-xs text-neutral-300">
                        {currentTrack.title} is constructed around heavy kick-snare patterns, dynamic hi-hat shuffles, and harmonic bass hooks tailored for breakbeat and hip-hop sessions.
                      </p>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-brand-gold font-mono space-y-1">
                        <p>• Tempo: {currentTrack.bpm || 120} BPM</p>
                        <p>• Producer / Label: {currentTrack.label || 'ChanceTEKone'}</p>
                        <p>• Mixing Lane: Harmonic Flow ± 4 BPM</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="space-y-2">
                {queue.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-12">Queue is empty</p>
                ) : (
                  queue.map((track, i) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-neutral-400 w-4">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{track.artistName}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-neutral-400">{formatTime(track.duration)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-10 max-w-3xl mx-auto w-full space-y-3 pt-2">
        {/* Scrubber */}
        <div className="flex items-center gap-3 text-xs text-neutral-300 font-mono">
          <span>{formatTime(currentTime)}</span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * duration);
            }}
            className="flex-1 h-2 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer relative overflow-hidden"
          >
            <div
              className="h-full bg-gradient-to-r from-brand-purple via-brand-gold to-brand-amber rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleLikeTrack(currentTrack.id)}
              className={`p-3 rounded-full transition-colors ${
                isLiked ? 'text-red-500 bg-red-500/10' : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
              title="Like track"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => setShowPlaylistModal(true)}
              className="p-3 rounded-full bg-white/5 hover:bg-brand-purple/30 text-neutral-400 hover:text-white transition-colors"
              title="Add track to playlist"
            >
              <ListPlus className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowDiscussion(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 hover:bg-brand-purple/30 text-neutral-300 hover:text-brand-gold transition-colors cursor-pointer border border-white/10"
              title={`${trackCommentCount} Discussion Threads & Community Comments`}
            >
              <MessageSquare className="w-5 h-5 text-brand-gold" />
              <span className="font-mono text-xs font-bold">{trackCommentCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-colors ${
                isShuffled ? 'text-brand-gold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button onClick={playPrev} className="p-3 text-white hover:text-brand-gold transition-colors">
              <SkipBack className="w-7 h-7" />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            <button onClick={playNext} className="p-3 text-white hover:text-brand-gold transition-colors">
              <SkipForward className="w-7 h-7" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-2 rounded-full transition-colors ${
                repeatMode !== 'off' ? 'text-brand-gold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="p-2 text-neutral-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 h-1 bg-white/20 rounded-full accent-brand-gold cursor-pointer hidden sm:block"
            />
          </div>
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

      {showDiscussion && currentTrack && (
        <UniversalDiscussionModal
          isOpen={showDiscussion}
          onClose={() => setShowDiscussion(false)}
          contentId={currentTrack.id}
          contentKey={canonicalKey}
          contentType="song"
          contentTitle={currentTrack.title}
          contentSubtitle={`${currentTrack.artistName} • ${currentTrack.albumTitle || currentTrack.genre || 'Single'}`}
          coverUrl={currentTrack.coverUrl}
          badgeLabel="Song"
        />
      )}
    </div>
  );
};
