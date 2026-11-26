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
      id: 'mi-vida-loca',
      badge: 'Featured Upcoming Works',
      narrationText: 'Featured Upcoming Works. Mi Vida Loca... By Author, Orlando Figueroa.',
      heading: 'Mi Vida Loca... By Author, Orlando Figueroa',
      description: '',
      bannerAlt: 'Mi Vida Loca... By Author, Orlando Figueroa',
      aspectRatio: { width: 720, height: 1280 },
      track: track,
      videoHref: '/audiobooks',
      videoUrl: '/videos/OrlandoFigueroa.mp4#t=0.5',
      aiPrompt: 'Tell me about Mi Vida Loca... By Author, Orlando Figueroa!',
      projectHref: '/audiobooks/audiobook-1793148157988-bnzl3',
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
      videoUrl: '/videos/Kwame Book Promo 1.mp4#t=0.5',
      aiPrompt: 'Tell me about Saturday Night, Sunday Morning... By Author, Kwame Thompson!',
      projectHref: '#',
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoSlideEnabled, setIsAutoSlideEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
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
    return buildCanonicalContentKey('project', slide.heading, 'ChanceTEK One');
  }, []);

  const currentSlide = slides[currentIndex];
  const isCurrentPlaying = currentTrack?.id === currentSlide.track.id && isPlaying;

  const nextSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [slides.length]);

  const goToSlide = (idx: number) => {
    if (idx === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(idx);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const toggleAutoSlide = () => {
    setIsAutoSlideEnabled((prev) => !prev);
  };

  // Automatic slideshow timer — single setTimeout per slide (ZERO 50ms React re-render loop)
  useEffect(() => {
    if (!isAutoSlideEnabled || isHovered || Boolean(discussionSlide)) return;

    const timer = setTimeout(() => {
      nextSlide();
    }, AUTOPLAY_INTERVAL);

    return () => clearTimeout(timer);
  }, [isAutoSlideEnabled, isHovered, discussionSlide, currentIndex, nextSlide]);

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
      className="specular-edge relative rounded-[28px] overflow-hidden glass-panel p-5 sm:p-8 md:p-10 bg-gradient-to-br from-[#140e24]/95 via-[#0b0a14]/95 to-[#06060b]/98 group"
    >
      {/* Subtle Ambient Stage Glows */}
      <div className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full bg-brand-purple/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-brand-gold/12 blur-[110px]" />

      {/* Auto-Slide Progress Bar (pure GPU CSS animation — zero JS timer re-renders) */}
      {isAutoSlideEnabled && !isHovered && !discussionSlide && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.06] overflow-hidden z-30 pointer-events-none">
          <div
            key={`progress-${currentIndex}`}
            className="h-full w-full origin-left bg-gradient-to-r from-brand-purple via-brand-gold to-cyan-400 shadow-[0_0_12px_rgba(245,195,68,0.8)] animate-hero-progress"
            style={{ animationDuration: `${AUTOPLAY_INTERVAL}ms` }}
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
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a14] via-[#0a0a14]/85 to-transparent" />
        </div>
      )}

      {/* Top Carousel Navigation Controls & Project Counter */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] uppercase tracking-[0.14em] font-bold text-brand-gold">
            <FolderKanban className="w-3.5 h-3.5 text-brand-gold" />
            <span>Premiere {currentIndex + 1} / {slides.length}</span>
          </span>
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline">
            {isAutoSlideEnabled
              ? isHovered
                ? 'Paused on hover'
                : 'Auto-advancing stage'
              : 'Manual control'}
          </span>
        </div>

        {/* Carousel Stop Option & Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoSlide}
            aria-label={isAutoSlideEnabled ? 'Stop automatic slide' : 'Start automatic slide'}
            title={isAutoSlideEnabled ? 'Stop automatic slideshow' : 'Start automatic slideshow'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${isAutoSlideEnabled
              ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/30 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/35'
              : 'bg-white/[0.06] text-neutral-300 border-white/15 hover:bg-brand-gold/15 hover:text-brand-gold hover:border-brand-gold/35'
              }`}
          >
            {isAutoSlideEnabled ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-gold"></span>
                </span>
                <span>Auto-Slide</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/50 text-neutral-300 border border-white/10 font-mono">
                  Stop
                </span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 fill-current text-brand-gold" />
                <span>Auto-Slide</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-mono">
                  Play
                </span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
            <button
              onClick={prevSlide}
              aria-label="Previous project banner"
              title="Previous project"
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/15 text-neutral-200 hover:text-brand-gold border border-white/10 hover:border-brand-gold/40 flex items-center justify-center transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={nextSlide}
              aria-label="Next project banner"
              title="Next project"
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/15 text-neutral-200 hover:text-brand-gold border border-white/10 hover:border-brand-gold/40 flex items-center justify-center transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide Content Area with Smooth Fade Transition */}
      <div
        className={`relative z-10 w-full space-y-6 pt-5 transition-all duration-300 ${isTransitioning ? 'opacity-40 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
      >
        {/* Featured Upcoming Works Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              data-badge-solid="true"
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-brand-gold/15 to-brand-purple/15 border border-brand-gold/30 text-brand-gold text-[11px] font-bold uppercase tracking-[0.14em]"
            >
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold studio-heading-gradient tracking-tight group-hover/heading:text-brand-gold transition-colors flex items-center gap-2">
                <span>{currentSlide.heading}</span>
                <ChevronRight className="w-6 h-6 opacity-0 group-hover/heading:opacity-100 group-hover/heading:translate-x-1 text-brand-gold transition-all shrink-0" />
              </h2>
            </Link>
          ) : (
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold studio-heading-gradient tracking-tight flex items-center gap-2">
              <span>{currentSlide.heading}</span>
            </h2>
          )}

          {currentSlide.description ? (
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              {currentSlide.description}
            </p>
          ) : null}
        </div>

        {/* Master Artwork / Video Banner — Full-frame uncropped display (head to street) */}
        <div className="relative w-full">
          {currentSlide.videoUrl ? (
            <div
              className={`relative rounded-2xl sm:rounded-3xl border border-white/15 bg-black shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] p-0 overflow-hidden w-full ring-1 ring-brand-gold/15 flex items-center justify-center ${
                currentSlide.id === 'mi-vida-loca'
                  ? 'min-h-[420px] h-[72vh] sm:h-[78vh] max-h-[820px]'
                  : 'aspect-[1112/830] max-h-[72vh]'
              }`}
            >
              {currentSlide.id === 'mi-vida-loca' && (
                /* Soft ambient side fill so portrait 9:16 video displays 100% uncropped (legs, street & skyline) */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/images/video-thumbs/OrlandoFigueroa.jpg"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-45"
                />
              )}
              <video
                key={`video-${currentSlide.id}`}
                src={currentSlide.videoUrl}
                poster={
                  currentSlide.id === 'mi-vida-loca'
                    ? '/images/video-thumbs/OrlandoFigueroa.jpg'
                    : currentSlide.id === 'saturday-night-sunday-morning'
                      ? '/images/video-thumbs/Kwame_Book_Promo_1.jpg'
                      : undefined
                }
                controls
                playsInline
                preload="metadata"
                onPlay={() => {
                  if (isPlaying) {
                    pause();
                  }
                  setIsAutoSlideEnabled(false);
                }}
                className="relative z-10 w-full h-full object-contain block"
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
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              onClick={handlePlayToggle}
              aria-label={isCurrentPlaying ? `Pause ${currentSlide.track.title}` : `Play ${currentSlide.track.title}`}
              className="shimmer-cta flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#f7cf62] via-brand-gold to-amber-500 text-[#050509] font-extrabold text-xs md:text-sm uppercase tracking-wider shadow-[0_8px_28px_rgba(245,195,68,0.4)] hover:shadow-[0_12px_36px_rgba(245,195,68,0.65)] hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {isCurrentPlaying ? (
                <>
                  <Disc3 className="w-4 h-4 text-[#050509] animate-spin" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#050509] text-[#050509] ml-0.5" />
                  <span>Play Track</span>
                </>
              )}
            </button>

            <Link
              href={currentSlide.videoHref}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-white font-semibold text-xs md:text-sm transition-all hover:scale-[1.03] active:scale-95"
            >
              <VideoIcon className="w-4 h-4 text-rose-400" />
              <span>Watch Video</span>
            </Link>

            <button
              onClick={handleAskAI}
              className="flex items-center gap-2 px-4 py-3 rounded-full bg-brand-purple/20 hover:bg-brand-purple/35 border border-brand-purple/40 text-brand-neon hover:text-white font-semibold text-xs md:text-sm transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
              title="Ask ChanceTEK One AI about this project"
            >
              <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
              <span>Ask AI</span>
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/[0.06] hover:bg-brand-gold/20 border border-white/15 hover:border-brand-gold/40 text-neutral-100 hover:text-brand-gold font-semibold text-xs md:text-sm transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
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
                  className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/[0.06] hover:bg-brand-gold/15 border border-white/15 hover:border-brand-gold/40 text-neutral-200 hover:text-brand-gold font-semibold text-xs md:text-sm transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
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
                  ? 'w-8 h-2 bg-gradient-to-r from-brand-gold to-amber-400 shadow-[0_0_12px_rgba(245,195,68,0.75)]'
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
            if (currentSlide.id === 'mi-vida-loca') {
              return {
                type: 'audiobook',
                id: 'audiobook-1793148157988-bnzl3',
                customTitle: 'Mi Vida Loca... By Author, Orlando Figueroa',
                customCreator: 'Author Orlando Figueroa',
                customDescription: currentSlide.narrationText,
                customCoverUrl: '/images/video-thumbs/OrlandoFigueroa_share.jpg',
              };
            }
            if (currentSlide.id === 'saturday-night-sunday-morning') {
              return {
                type: 'audiobook',
                id: 'audiobook-kwame-thompson',
                customTitle: 'Saturday Night, Sunday Morning... By Author, Kwame Thompson',
                customCreator: 'Author Kwame Thompson',
                customDescription: currentSlide.narrationText,
                customCoverUrl: '/images/video-thumbs/Kwame_Book_Promo_1.jpg',
              };
            }
            return {
              type: 'project',
              id: currentSlide.id,
              customTitle: currentSlide.heading,
              customCreator: 'ChanceTEK One',
              customDescription: currentSlide.description || currentSlide.narrationText,
              customCoverUrl: currentSlide.bannerImage || '/images/studio_cover.jpg',
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
          coverUrl={discussionSlide.bannerImage || '/images/studio_cover.jpg'}
          badgeLabel={discussionSlide.badge || 'Featured Project'}
        />
      )}
    </div>
  );
};

