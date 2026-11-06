'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Bot,
  ShieldCheck,
  Cpu,
  HeartPulse,
  Radio,
  ArrowRight,
  Headphones,
  Maximize,
  X,
} from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';

export default function AdvertisementPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sohoVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isSohoModalOpen, setIsSohoModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(45);
  const [hasInteracted, setHasInteracted] = useState(false);
  const { pause: pauseGlobalMusic, isPlaying: isGlobalMusicPlaying } = usePlayer();

  // Setup HTML5 audio listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);



  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (isGlobalMusicPlaying) {
        pauseGlobalMusic();
      }
      if (videoRef.current && !videoRef.current.muted) {
        videoRef.current.muted = true;
        setIsVideoMuted(true);
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setHasInteracted(true);
      });
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleStopAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const restartAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    if (isGlobalMusicPlaying) pauseGlobalMusic();
    if (videoRef.current && !videoRef.current.muted) {
      videoRef.current.muted = true;
      setIsVideoMuted(true);
    }
    audioRef.current.play().then(() => {
      setIsPlaying(true);
      setHasInteracted(true);
    });
  };

  const toggleVideoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsVideoPlaying(true));
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsVideoMuted(nextMuted);

    // If unmuting video audio, pause the voice ad and global music so they don't overlap
    if (!nextMuted) {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (isGlobalMusicPlaying) {
        pauseGlobalMusic();
      }
    }
  };

  const handleVideoFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    }
  };

  const openSohoModal = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    if (isGlobalMusicPlaying) {
      pauseGlobalMusic();
    }
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
    setIsSohoModalOpen(true);
  };

  const closeSohoModal = () => {
    if (sohoVideoRef.current) {
      sohoVideoRef.current.pause();
    }
    setIsSohoModalOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSohoModalOpen) {
        closeSohoModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSohoModalOpen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-10 py-6 min-h-screen relative">
      {/* Hidden Audio Element pointing to public/audio/voice_ad.mp3 */}
      <audio ref={audioRef} src="/audio/voice_ad.mp3" preload="auto" />

      {/* 1. Interactive Audio Status Banner */}
      <div
        className={`p-4 rounded-3xl border transition-all duration-300 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 ${
          isPlaying
            ? 'bg-gradient-to-r from-emerald-950/80 via-[#130f24] to-[#0a0614] border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
            : 'bg-gradient-to-r from-brand-purple/20 via-[#100b1e] to-[#08050e] border-brand-gold/40'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              isPlaying
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold'
            }`}
          >
            {isPlaying ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <Headphones className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isPlaying
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-brand-gold/20 text-brand-gold border-brand-gold/40'
                }`}
              >
                {isPlaying ? 'Voice Ad Broadcast Active' : 'Voice Ad Audio Ready'}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline-block">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">
              {isPlaying
                ? 'Now Streaming: 8 OF SPADES WORKS Radio Ad Bulletin'
                : '8 OF SPADES WORKS Radio Ad Bulletin'}
            </p>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePlay}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/20'
                : 'bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-105'
            }`}
            title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Ad</span>
              </>
            )}
          </button>

          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleStopAudio}
            className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all cursor-pointer"
            title="Turn Audio Off"
          >
            Turn Audio Off
          </button>

          <button
            onClick={restartAudio}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Replay from Beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Hero Section: ChanceTEK, Your AI Solutions Partner for the Agentic Future */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-12 glass-panel border border-brand-gold/40 bg-gradient-to-br from-[#1a102b]/95 via-[#0e081c]/90 to-[#06040c]/95 shadow-[0_15px_50px_rgba(0,0,0,0.8)] space-y-8">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Narrative */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/50 text-brand-gold text-xs font-black uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Enterprise AI Solutions Partner</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                ChanceTEK, Your AI Solutions Partner for the Agentic Future
              </h1>
              <p className="text-base sm:text-lg font-bold text-brand-neon">
                Architecting Autonomous Multi-Agent Intelligence, Zero-Trust AI Cybersecurity, & Advanced Computational Systems.
              </p>
            </div>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              At ChanceTEK LLC, we empower forward-thinking organizations, enterprises, and visionary creators to command the new era of agentic intelligence. From autonomous agent orchestration and neural audio pipelines to precision cellular health computation, ChanceTEK delivers the foundational architecture for what comes next.
            </p>

            {/* Core Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-brand-neon" />
                Autonomous Agents
              </span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                AI Security & Guardrails
              </span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                Cellular Health & Fasting
              </span>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-brand-gold" />
                iSkylar Neural Engine
              </span>
            </div>

            {/* CTAs */}
            <div className="pt-3 flex flex-wrap items-center gap-3">
              <a
                href="https://ichancetek.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:scale-105 transition-all cursor-pointer"
                title="Connect with ChanceTEK at iChanceTEK.com"
              >
                <span>Visit iChanceTEK.com</span>
                <ExternalLink className="w-4 h-4 stroke-[3]" />
              </a>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openSohoModal();
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 hover:border-brand-gold/60 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md hover:scale-105"
                title="Watch ChanceTEK Soho HQ Video"
              >
                <Play className="w-4 h-4 fill-current text-brand-gold" />
                <span>Watch ChanceTEK Soho HQ Video</span>
              </button>

              <Link
                href="/projects#project-chancetek"
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all"
              >
                <span>View ChanceTEK Project</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Hero Video Card: ChanceTEK447.mp4 */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div
              className="group relative w-full aspect-[16/9] rounded-3xl overflow-hidden border-2 border-brand-gold/60 shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              {/* HTML5 Video */}
              <video
                ref={videoRef}
                src="/videos/ChanceTEK447.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
              />

              {/* Ambient Vignette & Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />

              {/* Center Play Overlay when Video is Paused */}
              {!isVideoPlaying && (
                <button
                  onClick={toggleVideoPlay}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-brand-gold/90 hover:bg-brand-gold text-black flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.8)] transition-transform hover:scale-110 cursor-pointer pointer-events-auto z-10"
                  title="Play Video"
                >
                  <Play className="w-7 h-7 fill-current ml-1" />
                </button>
              )}

              {/* Bottom Video Info & Custom Controls */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-auto gap-2">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-brand-gold uppercase tracking-wider truncate">
                      Chancellor — Founder & CEO
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-300 font-medium truncate">
                    ChanceTEK LLC · Agentic AI & Intelligent Media
                  </p>
                </div>

                {/* Video Control Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={toggleVideoMute}
                    className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer shadow-md ${
                      !isVideoMuted
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : 'bg-black/70 hover:bg-black/90 text-white border-white/20'
                    }`}
                    title={isVideoMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
                  >
                    {!isVideoMuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound On</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-neutral-300" />
                        <span>Unmute</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={toggleVideoPlay}
                    className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer"
                    title={isVideoPlaying ? 'Pause Video' : 'Play Video'}
                  >
                    {isVideoPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  <button
                    onClick={handleVideoFullscreen}
                    className="p-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Bottom Call to Action */}
      <section className="relative overflow-hidden rounded-3xl p-8 sm:p-10 text-center glass-panel border border-brand-gold/40 bg-gradient-to-r from-[#170e28] via-[#10091c] to-[#0a0512] shadow-2xl space-y-5">
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Ready to Build the Agentic Future?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300">
            Connect directly with Chancellor and the ChanceTEK engineering team at <strong>iChanceTEK.com</strong> to architect your agentic AI solution today.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="https://ichancetek.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:scale-105 transition-all cursor-pointer"
          >
            <span>Visit iChanceTEK.com Now</span>
            <ExternalLink className="w-4 h-4 stroke-[3]" />
          </a>

          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all"
          >
            <span>Explore 8 OF SPADES Works Projects</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 5. Floating Audio Dock (Persistent at bottom right for easy access to turn audio off anytime) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-24 md:bottom-28 right-4 sm:right-6 z-40 max-w-sm rounded-2xl glass-panel p-3 border border-brand-gold/50 bg-[#0d0917]/95 shadow-[0_10px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={togglePlay}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
              isPlaying
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : 'bg-brand-gold text-black hover:scale-105'
            }`}
            title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white truncate">
              {isPlaying ? 'Ad Playing' : 'Ad Paused'}
            </p>
            <p className="text-[10px] text-neutral-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleStopAudio}
            className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-[10px] font-bold uppercase transition-colors"
            title="Turn Audio Off"
          >
            Audio Off
          </button>
        </div>
      </div>

      {/* 6. ChanceTEK Soho HQ Video Modal */}
      {isSohoModalOpen && (
        <div
          onClick={closeSohoModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-3xl overflow-hidden border border-brand-gold/50 bg-[#0d091a] shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#170f2b] to-[#0a0614]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-pulse" />
                <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                  ChanceTEK Soho HQ · Official Video
                </h3>
              </div>

              <button
                onClick={closeSohoModal}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Close Video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-[16/9] w-full bg-black">
              <video
                ref={sohoVideoRef}
                src="/videos/ChanceTEK_SohoHQ.mp4"
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 bg-[#0a0614]">
              <blockquote className="text-xs sm:text-sm text-neutral-200 italic">
                &ldquo;Just make it exist first, you can make it extraordinary later.&rdquo; — <strong className="text-brand-gold not-italic">ChanceTEK</strong>
              </blockquote>

              <a
                href="https://ichancetek.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform shrink-0 cursor-pointer"
              >
                <span>Visit iChanceTEK.com</span>
                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
