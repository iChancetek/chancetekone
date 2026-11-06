'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Sparkles,
  Brain,
} from 'lucide-react';
import { Video } from '@/types/media';
import { ContextualAIRecommendations } from '@/components/ai/ContextualAIRecommendations';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { useAI } from '@/lib/ai/AIContext';
import { usePlayer } from '@/lib/player/PlayerContext';

export const VideoPlayer: React.FC<{ video: Video }> = ({ video }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { openAI } = useAI();
  // Pull master volume from the platform player so the global slider controls video too
  const { volume, isMuted, setVolume, toggleMute, requireStreamAuth } = usePlayer();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showAIInsights, setShowAIInsights] = useState(true);

  let controlsTimeout: NodeJS.Timeout;

  // Sync video element volume whenever the platform master volume or mute changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Reset when video prop changes
    setCurrentTime(0);
    setIsPlaying(false);
    v.currentTime = 0;
    v.load();

    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoadedMetadata = () => {
      if (v.duration && !isNaN(v.duration)) {
        setDuration(v.duration);
      }
    };
    const onPlay = () => {
      if (!requireStreamAuth('watch 4K video')) {
        v.pause();
        v.currentTime = 0;
        return;
      }
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, [video.id, video.videoUrl]);

  const togglePlay = () => {
    if (!requireStreamAuth('watch 4K video')) return;
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => {
        console.warn('Video playback error:', err);
      });
    }
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    // Update the platform master volume — keeps all audio in sync
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : newVol;
    }
  };

  const toggleMuteVideo = () => {
    toggleMute();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      videoRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const videoNarrative =
    video.description ||
    `${video.title} by ${video.artistName}. High-definition breakbeat visual production focusing on DJ culture, crate digging, and vintage hardware workflows.`;

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        onMouseMove={() => {
          setShowControls(true);
          clearTimeout(controlsTimeout);
          controlsTimeout = setTimeout(() => setShowControls(false), 3000);
        }}
        className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl group border border-white/10"
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={
            video.thumbnailUrl &&
            video.thumbnailUrl !== '/images/logo.png' &&
            video.thumbnailUrl !== '/images/8_of_spades_works_banner.png' &&
            video.thumbnailUrl !== '/images/the_lounge_ambient.jpg'
              ? video.thumbnailUrl
              : undefined
          }
          playsInline
          preload="auto"
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Format Badges */}
        {video.videoUrl?.toLowerCase().endsWith('.mp3') && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-brand-gold/40 text-brand-gold text-[10px] font-mono font-bold">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>Audio Master Track Cinema</span>
          </div>
        )}

        {video.videoUrl?.toLowerCase().endsWith('.mov') && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>Cinema Master (QuickTime .MOV)</span>
          </div>
        )}

        {/* Center Big Play Button when Paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
              <Play className="w-10 h-10 fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Floating Controls Overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Scrubber */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * duration);
            }}
            className="h-1.5 md:h-2 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer relative overflow-hidden mb-3 group"
          >
            <div
              className="h-full bg-gradient-to-r from-brand-purple to-brand-gold rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={togglePlay}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => seek(Math.max(0, currentTime - 10))}
                className="p-1.5 text-neutral-300 hover:text-white"
                title="Rewind 10s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                <button onClick={toggleMuteVideo} className="p-1.5 text-neutral-300 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-white/30 rounded-full accent-brand-gold cursor-pointer hidden sm:block"
                />
              </div>

              <span className="text-xs text-neutral-300 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Playback Speed selector */}
              <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg text-xs font-semibold text-neutral-200">
                {[1, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={`px-1.5 py-0.5 rounded ${
                      playbackRate === rate ? 'bg-brand-purple text-white' : 'hover:text-brand-gold'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Details & Narration Bar */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white">{video.title}</h2>
          <p className="text-xs text-neutral-300">{video.artistName} • {video.category}</p>
        </div>

        <div className="flex items-center gap-2">
          <VoiceNarrationButton
            text={videoNarrative}
            label="Narrate Summary"
            variant="pill"
            voice="nova"
          />

          <button
            onClick={() =>
              openAI(`Tell me about the production, music, and background of the video "${video.title}" by ${video.artistName}.`)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-neon/40 text-brand-neon hover:text-white text-xs font-semibold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            <span>Ask Break Beats AI</span>
          </button>
        </div>
      </div>

      {/* Autonomous Contextual AI Recommendations for this Video */}
      <ContextualAIRecommendations
        currentMedia={{
          id: video.id,
          type: 'video',
          title: video.title,
          artist: video.artistName,
          category: video.category,
        }}
      />
    </div>
  );
};
