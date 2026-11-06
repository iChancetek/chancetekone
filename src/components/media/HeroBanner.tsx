'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Play,
  Pause,
  Sparkles,
  Video as VideoIcon,
  Disc3,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Share2,
  MessageSquare,
} from 'lucide-react';
import { Track } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAI } from '@/lib/ai/AIContext';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export interface ProjectBannerSlide {
  id: string;
  badge: string;
  narrationText: string;
  heading: string;
  description: string;
  bannerImage?: string;
  bannerAlt: string;
  aspectRatio: { width: number; height: number };
  track: Track;
  videoHref: string;
  videoUrl?: string;
  aiPrompt: string;
  projectHref: string;
}

const AUTOPLAY_INTERVAL = 6000;

export const HeroBanner: React.FC<{ track: Track; onOpenAI?: () => void }> = ({ track, onOpenAI }) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, pause } = usePlayer();
  const { openAI } = useAI();

  const slides: ProjectBannerSlide[] = [
    {
      id: 'return-of-the-break-beats',
      badge: 'Featured Upcoming Works',
      narrationText:
        'Featured Upcoming Works. The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artists and A Documentary Film.',
      heading: 'Featured Upcoming Works',
      description:
        'The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artist and A Documentary Film.',
      bannerImage: '/images/8_of_spades_works_banner.png',
      bannerAlt: '8 OF SPADES WORKS PRESENTS THE RETURN OF THE BREAK BEATS',
      aspectRatio: { width: 1024, height: 562 },
      track: track,
      videoHref: '/videos/video-1',
      aiPrompt: `Tell me about the breakbeat anthem "${track.title}" by ${track.artistName}, its BPM pocket, and sample origins!`,
      projectHref: '/projects#project-1',
    },
    {
      id: 'saturday-night-sunday-morning',
      badge: 'Featured Upcoming Works',
      narrationText: 'Featured Upcoming Works. Saturday Night, Sunday Morning... By Author, Kwame Thompson.',
      heading: 'Saturday Night, Sunday Morning... By Author, Kwame Thompson',
      description: '',
      bannerAlt: 'Saturday Night, Sunday Morning... By Author, Kwame Thompson',
      aspectRatio: { width: 1024, height: 576 },
      track: track,
      videoHref: '/videos',
      videoUrl: '/videos/Kwame Book Promo 1.mp4',
      aiPrompt: 'Tell me about Saturday Night, Sunday Morning... By Author, Kwame Thompson!',
      projectHref: '#',
    },
    {
      id: 'mi-vida-loca',
      badge: 'Featured Upcoming Works',
      narrationText: 'Featured Upcoming Works. Mi Vida Loca... By Author, Orlando Figueroa.',
      heading: 'Mi Vida Loca... By Author, Orlando Figueroa',
      description: '',
      bannerAlt: 'Mi Vida Loca... By Author, Orlando Figueroa',
      aspectRatio: { width: 720, height: 1280 },
      track: track,
      videoHref: '/audiobooks',
      videoUrl: '/videos/OrlandoFigueroa.mp4',
      aiPrompt: 'Tell me about Mi Vida Loca... By Author, Orlando Figueroa!',
      projectHref: '/audiobooks/audiobook-1793148157988-bnzl3',
    },
    {
      id: 'chancetek-graph-banner',
      badge: 'Featured Upcoming Works',
      narrationText:
        'Featured Upcoming Works. 8 OF SPADES WORKS PRESENTS ChanceTEK: Agentic AI, AI Security, Healthy Living, Intermittent Fasting, iSkylar, and The Fam... Famio by Chancellor @ ChanceTEK LLC.',
      heading: 'ChanceTEK: The Master Series',
      description:
        '8 OF SPADES WORKS PRESENTS: ChanceTEK — The Master Series. Featuring Agentic AI, AI Security, Healthy Living, Intermittent Fasting, iSkylar, and The Fam... Famio by Chancellor @ ChanceTEK LLC.',
      bannerImage: '/images/chancetek_banner.png',
      bannerAlt: '8 OF SPADES WORKS PRESENTS CHANCETEK THE SOUND THE SCIENCE THE FUTURE',
      aspectRatio: { width: 1024, height: 576 },
      track: track,
      videoHref: '/videos',
      aiPrompt:
        'Tell me about Chancellor @ ChanceTEK LLC, the ChanceTEK Project, Agentic AI, iSkylar, and Famio!',
      projectHref: '/projects#project-chancetek',
    },
    {
      id: 'the-bronx-heritage-archive',
      badge: 'Featured Upcoming Works',
      narrationText:
        'Featured Upcoming Works. 8 OF SPADES WORKS PRESENTS The Bronx Heritage Archive: Oral History and The Four Pillars of Hip-Hop. Documenting park jam sound systems and the golden era.',
      heading: 'The Bronx Heritage Archive',
      description:
        'A comprehensive historical preservation documenting The Bronx, park jam sound systems, and the genesis of hip-hop.',
      bannerImage: '/images/bronx_heritage_archive_banner.jpg',
      bannerAlt: '8 OF SPADES WORKS PRESENTS THE BRONX HERITAGE ARCHIVE',
      aspectRatio: { width: 1024, height: 576 },
      track: MusicCatalogService.getTrackById('track-2') || track,
      videoHref: '/videos/video-6',
      aiPrompt:
        'Tell me about The Bronx Heritage Archive, the park jam sound systems, and oral histories of hip-hop!',
      projectHref: '/projects#project-2',
    },
    {
      id: 'quantum-break-sequence',
      badge: 'Featured Upcoming Works',
      narrationText:
        'Featured Upcoming Works. 8 OF SPADES WORKS PRESENTS Quantum Break Sequence: Synthetic Syncopation for Cyber Undergrounds, engineered with modular synthesis and accelerated breaks.',
      heading: 'Quantum Break Sequence',
      description:
        'High-speed synthetic syncopation designed for underground cyber-arenas, electronic festivals, and late-night highway cruising.',
      bannerImage: '/images/quantum_break_sequence_banner.jpg',
      bannerAlt: '8 OF SPADES WORKS PRESENTS QUANTUM BREAK SEQUENCE',
      aspectRatio: { width: 1024, height: 576 },
      track: MusicCatalogService.getTrackById('track-3') || track,
      videoHref: '/videos/video-3',
      aiPrompt:
        'Tell me about Quantum Break Sequence by Cipher Voltage, modular synthesis, and cyber breakbeats!',
      projectHref: '/projects#project-3',
    },
    {
      id: 'velvet-horns-tape-saturation',
      badge: 'Featured Upcoming Works',
      narrationText:
        'Featured Upcoming Works. 8 OF SPADES WORKS PRESENTS Velvet Horns & Tape Saturation: Warm Tube Masters and 1970s Funk Grooves, recorded directly to reel-to-reel tape.',
      heading: 'Velvet Horns & Tape Saturation',
      description:
        'Warm reel-to-reel master tapes, dynamic brass solos, and undeniable pocket grooves from the heart of the vinyl revolution.',
      bannerImage: '/images/velvet_horns_tape_saturation_banner.jpg',
      bannerAlt: '8 OF SPADES WORKS PRESENTS VELVET HORNS & TAPE SATURATION',
      aspectRatio: { width: 1024, height: 576 },
      track: MusicCatalogService.getTrackById('track-4') || track,
      videoHref: '/videos/video-4',
      aiPrompt:
        'Tell me about Velvet Horns & Tape Saturation by Luna Brass & The Crate Queens, 1970s funk breaks, and tape saturation!',
      projectHref: '/projects#project-4',
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoSlideEnabled, setIsAutoSlideEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [discussionSlide, setDiscussionSlide] = useState<ProjectBannerSlide | null>(null);
  const [, setCommentRefresh] = useState(0);

  useEffect(() => {
    const unsub = SocialCommentService.subscribeAll(() => {
      setCommentRefresh((p) => p + 1);
    });
    return () => unsub();
  }, []);

  const getSlideCanonicalKey = useCallback((slide: ProjectBannerSlide) => {
    if (slide.id === 'mi-vida-loca') {
      return buildCanonicalContentKey('project', 'Mi Vida Loca', 'Orlando Figueroa');
    }
    if (slide.id === 'saturday-night-sunday-morning') {
      return buildCanonicalContentKey('project', 'Saturday Night, Sunday Morning', 'Kwame Thompson');
    }
    if (slide.id === 'return-of-the-break-beats') {
      return buildCanonicalContentKey('project', 'The Return Of The Break Beats', '8 Of Spades Works');
    }
    if (slide.id === 'chancetek-graph-banner') {
      return buildCanonicalContentKey('project', 'ChanceTEK The Master Series', 'Chancellor');
    }
    if (slide.id === 'the-bronx-heritage-archive') {
      return buildCanonicalContentKey('project', 'The Bronx Heritage Archive', '8 OF SPADES WORKS');
    }
    if (slide.id === 'quantum-break-sequence') {
      return buildCanonicalContentKey('project', 'Quantum Break Sequence', 'Cipher Voltage');
    }
    if (slide.id === 'velvet-horns-tape-saturation') {
      return buildCanonicalContentKey('project', 'Velvet Horns & Tape Saturation', 'Luna Brass & The Crate Queens');
    }
    return buildCanonicalContentKey('project', slide.heading, '8 OF SPADES WORKS');
  }, []);

  const currentSlide = slides[currentIndex];
  const isCurrentPlaying = currentTrack?.id === currentSlide.track.id && isPlaying;

  const nextSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setProgress(0);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [slides.length]);

  const goToSlide = (idx: number) => {
    if (idx === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(idx);
    setProgress(0);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const toggleAutoSlide = () => {
    setIsAutoSlideEnabled((prev) => !prev);
    setProgress(0);
  };

  // Automatic slideshow timer with progress tracking
  useEffect(() => {
    if (!isAutoSlideEnabled || isHovered || Boolean(discussionSlide)) return;

    const tick = 50;
    const step = (tick / AUTOPLAY_INTERVAL) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide();
          return 0;
        }
        return prev + step;
      });
    }, tick);

    return () => clearInterval(interval);
  }, [isAutoSlideEnabled, isHovered, nextSlide]);

  const handlePlayToggle = () => {
    if (currentTrack?.id === currentSlide.track.id) {
      togglePlay();
    } else {
      playTrack(currentSlide.track);
    }
  };

  const handleAskAI = () => {
    if (onOpenAI) {
      onOpenAI();
    } else {
      openAI(currentSlide.aiPrompt);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-3xl overflow-hidden glass-panel border border-brand-gold/30 p-6 sm:p-10 md:p-12 shadow-2xl bg-gradient-to-r from-[#180e29]/95 via-[#0d0918]/90 to-[#08080c]/95 group"
    >
      {/* Auto-Slide Progress Bar */}
      {isAutoSlideEnabled && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-white/5 overflow-hidden z-30 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-brand-gold via-amber-300 to-brand-neon transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Background Graphic Ambient Layer with smooth fade */}
      {currentSlide.bannerImage && (
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-2/3 opacity-25 pointer-events-none overflow-hidden transition-opacity duration-700">
          <Image
            key={`ambient-${currentSlide.id}`}
            src={currentSlide.bannerImage}
            alt={currentSlide.bannerAlt}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover object-center blur-lg scale-110 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c16] via-[#0c0c16]/85 to-transparent" />
        </div>
      )}

      {/* Top Carousel Navigation Controls & Project Counter */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] uppercase tracking-widest font-black text-brand-gold flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-brand-gold" />
            <span>Project {currentIndex + 1} of {slides.length}</span>
          </span>
          <span className="text-white/20">•</span>
          <span className="text-[11px] text-neutral-400 font-medium">
            {isAutoSlideEnabled
              ? isHovered
                ? 'Auto-slide paused (hovered)'
                : 'Auto-sliding'
              : 'Auto-slide stopped'}
          </span>
        </div>

        {/* Carousel Stop Option & Navigation Buttons */}
        <div className="flex items-center gap-2">
          {/* Explicit Stop / Resume Button */}
          <button
            onClick={toggleAutoSlide}
            aria-label={isAutoSlideEnabled ? 'Stop automatic slide' : 'Start automatic slide'}
            title={isAutoSlideEnabled ? 'Stop automatic slideshow' : 'Start automatic slideshow'}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${isAutoSlideEnabled
                ? 'bg-brand-gold/15 text-brand-gold border-brand-gold/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                : 'bg-white/10 text-neutral-300 border-white/20 hover:bg-brand-gold/20 hover:text-brand-gold hover:border-brand-gold/40'
              }`}
          >
            {isAutoSlideEnabled ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-gold"></span>
                </span>
                <span>Auto-Slide</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-neutral-300 border border-white/10 font-mono">
                  Stop
                </span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 fill-current text-brand-gold" />
                <span>Auto-Slide</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-gold/25 text-brand-gold font-mono">
                  Play
                </span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <button
              onClick={prevSlide}
              aria-label="Previous project banner"
              title="Previous project"
              className="p-1.5 rounded-full bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/40 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={nextSlide}
              aria-label="Next project banner"
              title="Next project"
              className="p-1.5 rounded-full bg-white/5 hover:bg-brand-gold/20 text-neutral-300 hover:text-brand-gold border border-white/10 hover:border-brand-gold/40 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide Content Area with Smooth Fade Transition */}
      <div
        className={`relative z-10 w-full max-w-4xl space-y-6 pt-4 transition-all duration-300 ${isTransitioning ? 'opacity-40 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
      >
        {/* Featured Upcoming Works Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentSlide.badge}</span>
            </div>
            <VoiceNarrationButton
              key={`narration-${currentSlide.id}`}
              text={currentSlide.narrationText}
              variant="dual"
            />
          </div>

          {currentSlide.projectHref && currentSlide.projectHref !== '#' ? (
            <Link
              href={currentSlide.projectHref}
              className="group/heading block focus:outline-none focus:ring-1 focus:ring-brand-gold rounded-xl"
              title={`View ${currentSlide.heading} in Projects`}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight group-hover/heading:text-brand-gold transition-colors flex items-center gap-2">
                <span>{currentSlide.heading}</span>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover/heading:opacity-100 group-hover/heading:translate-x-1 text-brand-gold transition-all" />
              </h2>
            </Link>
          ) : (
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{currentSlide.heading}</span>
            </h2>
          )}

          {currentSlide.description ? (
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              {currentSlide.description}
            </p>
          ) : null}
        </div>

        {/* Master Artwork / Video Banner */}
        <div className="relative max-w-full">
          {currentSlide.videoUrl ? (
            <div
              className="relative rounded-3xl border border-brand-gold/30 bg-black/95 shadow-2xl p-2 sm:p-3 flex items-center justify-center overflow-hidden w-full max-w-full mx-auto"
            >
              <video
                key={`video-${currentSlide.id}`}
                src={currentSlide.videoUrl}
                controls
                playsInline
                preload="metadata"
                onPlay={() => {
                  if (isPlaying) {
                    pause();
                  }
                  setIsAutoSlideEnabled(false);
                }}
                style={currentSlide.id === 'mi-vida-loca' ? undefined : { aspectRatio: '1112 / 830' }}
                className={`w-full h-auto ${currentSlide.id === 'mi-vida-loca' ? 'max-h-[82vh] rounded-2xl' : 'max-h-[70vh] rounded-xl'
                  } shadow-lg bg-black block object-contain`}
              />
            </div>
          ) : currentSlide.bannerImage ? (
            <Link
              href={currentSlide.projectHref}
              className="block group/banner cursor-pointer transition-transform duration-300 hover:scale-[1.015] focus:outline-none focus:ring-2 focus:ring-brand-gold/50 rounded-2xl relative"
              title={`View ${currentSlide.bannerAlt} in Projects`}
            >
              <Image
                key={`banner-${currentSlide.id}`}
                src={currentSlide.bannerImage}
                alt={currentSlide.bannerAlt}
                width={currentSlide.aspectRatio.width}
                height={currentSlide.aspectRatio.height}
                priority
                className="w-full max-w-[480px] sm:max-w-[620px] md:max-w-[720px] h-auto object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.95)] transition-all duration-300 group-hover/banner:drop-shadow-[0_20px_45px_rgba(245,195,68,0.35)]"
              />
            </Link>
          ) : null}
        </div>

        {/* Action Buttons & Slide Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlayToggle}
              aria-label={isCurrentPlaying ? `Pause ${currentSlide.track.title}` : `Play ${currentSlide.track.title}`}
              className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] font-black text-xs md:text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(245,195,68,0.6),0_4px_12px_rgba(0,0,0,0.5)] hover:shadow-[0_0_35px_rgba(245,195,68,0.9),0_6px_20px_rgba(0,0,0,0.6)] border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {isCurrentPlaying ? (
                <>
                  <Disc3 className="w-4 h-4 text-[#08080c] animate-spin" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#08080c] text-[#08080c] ml-0.5" />
                  <span>Play Track</span>
                </>
              )}
            </button>

            <Link
              href={currentSlide.videoHref}
              className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs md:text-sm transition-all shadow-md hover:scale-105 active:scale-95"
            >
              <VideoIcon className="w-4 h-4 text-red-400" />
              <span>Watch Video</span>
            </Link>

            <button
              onClick={handleAskAI}
              className="flex items-center gap-2 px-4 py-3.5 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-neon hover:text-white font-semibold text-xs transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
              title="Ask Break Beats AI about this project"
            >
              <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
              Ask AI
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-4 py-3.5 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs md:text-sm transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
              title={`Share ${currentSlide.heading} & text message`}
            >
              <Share2 className="w-4 h-4 text-brand-gold" />
              <span>Share</span>
            </button>

            {/* Project Emoji Reactions */}
            <ReactionButtons
              contentId={currentSlide.id}
              contentKey={getSlideCanonicalKey(currentSlide)}
              contentType="project"
              contentTitle={currentSlide.heading}
              contextLocation="Featured Upcoming Works Home Slide"
              variant="compact"
              showShare={false}
            />

            {/* Project Discussion Comments & Threads */}
            {(() => {
              const slideKey = getSlideCanonicalKey(currentSlide);
              const count = SocialCommentService.getCommentCount(currentSlide.id, slideKey);
              return (
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoSlideEnabled(false);
                    setDiscussionSlide(currentSlide);
                  }}
                  className="flex items-center gap-2 px-4 py-3.5 rounded-full bg-white/10 hover:bg-brand-gold/20 border border-white/15 hover:border-brand-gold/40 text-neutral-200 hover:text-brand-gold font-semibold text-xs md:text-sm transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                  title={`${count} Discussion Comments & Threads on ${currentSlide.heading}`}
                >
                  <MessageSquare className="w-4 h-4 text-brand-gold" />
                  <span className="font-mono font-bold text-brand-gold">{count}</span>
                  <span className="hidden sm:inline">Comments</span>
                </button>
              );
            })()}
          </div>

          {/* Slide Indicator Dots / Pills */}
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {slides.map((slide, idx) => (
              <button
                key={`dot-${slide.id}`}
                onClick={() => goToSlide(idx)}
                aria-label={`Jump to ${slide.bannerAlt}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${idx === currentIndex
                    ? 'w-7 h-2 bg-gradient-to-r from-brand-gold to-amber-400 shadow-[0_0_10px_rgba(245,195,68,0.7)]'
                    : 'w-2 h-2 bg-white/25 hover:bg-white/50'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={(() => {
            if (currentSlide.id === 'return-of-the-break-beats') {
              return {
                type: 'project',
                id: 'project-1',
                customTitle: 'The Return of the Break Beats',
                customCreator: '8 OF SPADES WORKS',
                customDescription: currentSlide.description || currentSlide.narrationText,
                customCoverUrl: '/images/return_of_the_break_beats_master.png',
              };
            }
            if (currentSlide.id === 'mi-vida-loca') {
              return {
                type: 'audiobook',
                id: 'audiobook-1793148157988-bnzl3',
                customTitle: 'Mi Vida Loca',
                customCreator: 'Author Orlando Figueroa',
                customDescription: currentSlide.narrationText,
                customCoverUrl: '/images/audiobooks/famio.jpg',
              };
            }
            if (currentSlide.id === 'saturday-night-sunday-morning') {
              return {
                type: 'audiobook',
                id: 'audiobook-kwame-thompson',
                customTitle: 'Saturday Night, Sunday Morning',
                customCreator: 'Author Kwame Thompson',
                customDescription: currentSlide.narrationText,
                customCoverUrl: '/images/genres/literature.jpg',
              };
            }
            if (currentSlide.id === 'chancetek-graph-banner') {
              return {
                type: 'project',
                id: 'project-chancetek',
                customTitle: 'ChanceTEK: The Master Series',
                customCreator: 'Chancellor @ ChanceTEK LLC',
                customDescription: currentSlide.description,
                customCoverUrl: '/images/chancetek_banner.png',
              };
            }
            return {
              type: 'project',
              id: currentSlide.id,
              customTitle: currentSlide.heading,
              customCreator: '8 OF SPADES WORKS',
              customDescription: currentSlide.description || currentSlide.narrationText,
              customCoverUrl: currentSlide.bannerImage || '/images/return_of_the_break_beats_master.png',
            };
          })()}
        />
      )}

      {discussionSlide && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionSlide)}
          onClose={() => {
            setDiscussionSlide(null);
            setIsAutoSlideEnabled(true);
          }}
          contentId={discussionSlide.id}
          contentKey={getSlideCanonicalKey(discussionSlide)}
          contentType="project"
          contentTitle={discussionSlide.heading}
          contentSubtitle={discussionSlide.description || discussionSlide.narrationText}
          coverUrl={discussionSlide.bannerImage || '/images/8_of_spades_works_banner.png'}
          badgeLabel={discussionSlide.badge || 'Featured Project'}
        />
      )}
    </div>
  );
};

