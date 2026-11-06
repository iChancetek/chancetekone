
'use client';

import React from 'react';
import Image from 'next/image';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  BookOpen,
  Volume2,
  Bookmark,
  CheckCircle2,
  Headphones,
  Video,
  FileText,
  ExternalLink,
  Download,
  Share2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Audiobook, AudiobookChapter } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ShareAudiobookModal } from '@/components/audiobook/ShareAudiobookModal';

function resolveAudiobookMediaUrl(url?: string): string {
  if (!url) return '';
  if (
    url.includes('1793148168438_OrlandoFigueroa') ||
    url.includes('audiobook-1793148157988-bnzl3') ||
    url.includes('OrlandoFigueroa')
  ) {
    return url.startsWith('http') ? url : '/videos/OrlandoFigueroa.mp4';
  }
  return url;
}

function isVideoMediaUrl(url?: string): boolean {
  if (!url) return false;
  const base = url.split('?')[0].toLowerCase();
  return base.endsWith('.mp4') || base.endsWith('.mov') || base.includes('/catalog/video/');
}

export const AudiobookPlayer: React.FC<{ audiobook: Audiobook }> = ({ audiobook }) => {
  const {
    currentAudiobook,
    currentChapter,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    setPlaybackRate,
    playAudiobookChapter,
    togglePlay,
    seek,
    requireStreamAuth,
  } = usePlayer();

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [isTheaterMode, setIsTheaterMode] = React.useState(false);

  const isCurrentBook = currentAudiobook?.id === audiobook.id;
  const activeChapter = isCurrentBook && currentChapter ? currentChapter : audiobook.chapters[0];
  const resolvedMediaUrl = resolveAudiobookMediaUrl(activeChapter?.audioUrl);
  const isPdfBook = Boolean(
    audiobook.pdfUrl ||
    audiobook.mediaFormat === 'pdf' ||
    resolvedMediaUrl.split('?')[0].toLowerCase().endsWith('.pdf') ||
    activeChapter?.pdfUrl
  );
  const pdfSourceUrl = audiobook.pdfUrl || activeChapter?.pdfUrl || resolvedMediaUrl;

  const isVideoChapter =
    !isPdfBook &&
    (audiobook.mediaFormat === 'video' || isVideoMediaUrl(resolvedMediaUrl));

  const isPortraitVideo =
    isVideoChapter &&
    (resolvedMediaUrl.includes('OrlandoFigueroa') ||
      resolvedMediaUrl.includes('bnzl3') ||
      audiobook.id === 'audiobook-1793148157988-bnzl3' ||
      audiobook.title.toLowerCase().includes('mi vida loca'));

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl bg-white/5 space-y-6">
      {/* Top Section: Cover or Video Viewport or PDF Preview + Metadata + Main Controls */}
      <div className={`flex flex-col ${isVideoChapter ? 'w-full gap-6' : 'md:flex-row items-center gap-6 md:gap-8'}`}>
        {isPdfBook ? (
          <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl border border-rose-500/30 flex-shrink-0 bg-gradient-to-br from-rose-950/40 via-black to-neutral-950 flex flex-col items-center justify-center p-4 text-center">
            <FileText className="w-12 h-12 text-rose-400 mb-2" />
            <span className="text-xs font-bold text-white line-clamp-2">{audiobook.title}</span>
            <span className="text-[10px] text-rose-300 font-mono mt-1">PDF Book Master</span>
          </div>
        ) : isVideoChapter ? (
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-brand-gold/40 w-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={resolvedMediaUrl}
              poster={audiobook.coverUrl ? audiobook.coverUrl : undefined}
              controls
              playsInline
              preload="metadata"
              onPlay={(e) => {
                if (!requireStreamAuth('watch video audiobook')) {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                  return;
                }
                setIsVideoPlaying(true);
              }}
              onPause={() => setIsVideoPlaying(false)}
              onEnded={() => setIsVideoPlaying(false)}
              className="w-full h-auto max-h-[85vh] object-contain bg-black block"
            />
          </div>
        ) : audiobook.coverUrl ? (
          <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0">
            <Image
              src={audiobook.coverUrl}
              alt={audiobook.title || 'Audiobook cover'}
              fill
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col items-center justify-center p-4 text-center">
            <BookOpen className="w-10 h-10 text-brand-gold/70 mb-2" />
            <span className="text-xs font-bold text-white line-clamp-2">{audiobook.title}</span>
            <span className="text-[10px] text-neutral-400 mt-1 line-clamp-1">{audiobook.author}</span>
          </div>
        )}

        <div
          className={
            isVideoChapter
              ? 'w-full pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4'
              : 'flex-1 text-center md:text-left space-y-2'
          }
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
            {isPdfBook ? (
              <FileText className="w-3 h-3 text-rose-400" />
            ) : isVideoChapter ? (
              <Video className="w-3 h-3" />
            ) : (
              <Headphones className="w-3 h-3" />
            )}
            {isPdfBook
              ? 'PDF Book Reader & Literature'
              : isVideoChapter
                ? 'Video Audiobook Cinema'
                : 'Audiobook Experience'}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">{audiobook.title}</h2>
          <p className="text-sm text-neutral-300">
            By <span className="text-brand-gold font-semibold">{audiobook.author}</span>
            {audiobook.narrator && !isPdfBook && (
              <>
                {' '}• Narrated by <span className="text-brand-neon">{audiobook.narrator}</span>
              </>
            )}
          </p>
          <p className="text-xs text-neutral-400 font-mono">
            {isPdfBook ? 'Format: PDF Document' : `Active: ${activeChapter?.title || 'Chapter 1'}`}
          </p>

          {/* Controls Bar or PDF Actions */}
          {isPdfBook ? (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <a
                href={pdfSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs flex items-center gap-1.5 shadow-xl hover:scale-105 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Fullscreen Reader</span>
              </a>
              <a
                href={pdfSourceUrl}
                download
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-white/10"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Book</span>
              </a>
              <button
                onClick={() => setShowShareModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                title="Share this audiobook"
              >
                <Share2 className="w-4 h-4 text-brand-gold" />
                <span>Share</span>
              </button>
            </div>
          ) : (
            <div className={`flex flex-wrap items-center justify-center ${isVideoChapter ? 'md:justify-end' : 'md:justify-start'} gap-3 pt-2`}>
              <button
                onClick={() => {
                  if (isVideoChapter && videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 15);
                  } else {
                    seek(Math.max(0, currentTime - 15));
                  }
                }}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-1 text-xs cursor-pointer"
                title="Rewind 15s"
              >
                <RotateCcw className="w-4 h-4" />
                <span>15s</span>
              </button>

              <button
                onClick={() => {
                  if (isVideoChapter && videoRef.current) {
                    if (videoRef.current.paused) {
                      videoRef.current.play().catch(() => { });
                    } else {
                      videoRef.current.pause();
                    }
                    return;
                  }
                  if (isCurrentBook && isPlaying) {
                    togglePlay();
                  } else {
                    playAudiobookChapter(audiobook, activeChapter);
                  }
                }}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
              >
                {(isVideoChapter ? isVideoPlaying : isCurrentBook && isPlaying) ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  if (isVideoChapter && videoRef.current) {
                    const maxDur = Number.isFinite(videoRef.current.duration)
                      ? videoRef.current.duration
                      : videoRef.current.currentTime + 30;
                    videoRef.current.currentTime = Math.min(maxDur, videoRef.current.currentTime + 30);
                  } else {
                    seek(Math.min(duration, currentTime + 30));
                  }
                }}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-1 text-xs cursor-pointer"
                title="Skip 30s"
              >
                <RotateCw className="w-4 h-4" />
                <span>30s</span>
              </button>

              {/* Speed Selector */}
              <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-200">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setPlaybackRate(rate);
                      if (videoRef.current) {
                        videoRef.current.playbackRate = rate;
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${playbackRate === rate ? 'bg-brand-purple text-white' : 'hover:text-brand-gold'
                      }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Share Audiobook Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                title="Share this audiobook"
              >
                <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                <span>Share</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Embedded PDF Viewer Viewport */}
      {isPdfBook && pdfSourceUrl && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-400" />
              <span>Interactive PDF Book Viewer</span>
            </h3>
            <span className="text-[10px] text-neutral-400 font-mono">
              Scroll & zoom to read online
            </span>
          </div>
          <div className="w-full h-[650px] rounded-2xl overflow-hidden border border-white/15 bg-black/95 shadow-2xl">
            <iframe
              src={`${pdfSourceUrl}#toolbar=1&navpanes=1`}
              title={audiobook.title}
              className="w-full h-full border-none"
            />
          </div>
        </div>
      )}

      {/* Progress Scrubber */}
      {isCurrentBook && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * duration);
            }}
            className="h-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer relative overflow-hidden"
          >
            <div
              className="h-full bg-gradient-to-r from-brand-purple to-brand-gold rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Chapter Selection Accordion */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-gold" />
          Table of Chapters ({audiobook.chapters.length})
        </h3>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {audiobook.chapters.map((ch) => {
            const isPlayingThisChapter = isCurrentBook && currentChapter?.id === ch.id;
            const isChVideo =
              audiobook.mediaFormat === 'video' || isVideoMediaUrl(ch.audioUrl);
            return (
              <div
                key={ch.id}
                onClick={() => {
                  if (isChVideo && videoRef.current) {
                    const nextUrl = resolveAudiobookMediaUrl(ch.audioUrl);
                    if (videoRef.current.src && !videoRef.current.src.endsWith(nextUrl)) {
                      videoRef.current.src = nextUrl;
                    }
                    videoRef.current.play().catch(() => { });
                    return;
                  }
                  playAudiobookChapter(audiobook, ch);
                }}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isPlayingThisChapter
                    ? 'bg-brand-purple/30 border border-brand-purple text-white shadow-md'
                    : 'bg-white/5 border border-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-brand-gold">0{ch.chapterIndex}</span>
                  <p className="text-xs font-semibold truncate">{ch.title}</p>
                  {isChVideo && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Video className="w-2.5 h-2.5" />
                      VIDEO
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-neutral-400">{formatTime(ch.duration)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {showShareModal && (
        <ShareAudiobookModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          audiobook={audiobook}
        />
      )}
    </div>
  );
};
