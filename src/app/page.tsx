'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Flame,
  BookOpen,
  HelpCircle,
  Scale,
  Lock,
  ChevronRight,
  Compass,
  Video as VideoIcon,
  Headphones,
  ShieldCheck,
  Music,
  Radio,
  ListMusic,
  Users,
  ShoppingBag,
  Mic,
  ArrowUpRight,
} from 'lucide-react';
import { HeroBanner } from '@/components/media/HeroBanner';
import { TrackRow } from '@/components/media/TrackRow';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { RecentlyPlayedSection } from '@/components/home/RecentlyPlayedSection';
import { AgenticDiscoveryDeck } from '@/components/ai/AgenticDiscoveryDeck';
import { BrandLogo, PLATFORM_SLOGAN } from '@/components/brand/BrandLogo';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Track } from '@/types/media';

const QUICK_DESTINATIONS = [
  { label: 'Music', sub: 'Timeless Music', href: '/music', icon: Music, glow: 'from-brand-gold/25 to-amber-500/10', iconColor: 'text-brand-gold' },
  { label: '4K Cinema', sub: 'Visual Vault', href: '/videos', icon: VideoIcon, glow: 'from-rose-500/25 to-red-500/10', iconColor: 'text-rose-400' },
  { label: 'Audiobooks', sub: 'Spoken Works', href: '/audiobooks', icon: BookOpen, glow: 'from-brand-purple/25 to-fuchsia-500/10', iconColor: 'text-brand-neon' },
  { label: 'Podcasts', sub: 'Studio Talks', href: '/podcasts', icon: Mic, glow: 'from-cyan-500/25 to-sky-500/10', iconColor: 'text-cyan-400' },
  { label: 'Live Radio', sub: '24/7 AI DJs', href: '/radio', icon: Radio, glow: 'from-emerald-500/25 to-teal-500/10', iconColor: 'text-emerald-400' },
  { label: 'Playlists', sub: 'Curated Sets', href: '/playlists', icon: ListMusic, glow: 'from-indigo-500/25 to-violet-500/10', iconColor: 'text-indigo-400' },
  { label: 'Artists', sub: 'Creators', href: '/artists', icon: Users, glow: 'from-amber-400/25 to-orange-500/10', iconColor: 'text-amber-300' },
  { label: 'Vinyl & Merch', sub: 'Collector Drop', href: '/merch', icon: ShoppingBag, glow: 'from-pink-500/25 to-purple-500/10', iconColor: 'text-pink-400' },
];

export default function HomePage() {
  const [tracks, setTracks] = React.useState<Track[]>(() => MusicCatalogService.getSSRBaselineTracks());

  React.useEffect(() => {
    const sync = () => setTracks(MusicCatalogService.getAllTracks());
    sync();
    const unsub = MusicCatalogService.subscribe(sync);
    return () => {
      unsub();
    };
  }, []);

  const featuredTrack = tracks[0] || MusicCatalogService.getSSRBaselineTracks()[0];
  const trendingTracks = tracks.slice(0, 5);

  return (
    <div className="relative py-5 sm:py-7 min-h-screen">
      {/* Clean Futuristic Spatial Light Field (desktop only to keep mobile PWA GPU fast & responsive) */}
      <div className="hidden md:block pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[920px] h-[420px] rounded-full bg-gradient-to-b from-brand-purple/18 via-indigo-600/10 to-transparent blur-[130px] animate-aurora-slow" />
        <div className="absolute top-[28%] right-[-10%] w-[520px] h-[520px] rounded-full bg-brand-gold/[0.08] blur-[140px] animate-aurora-reverse" />
        <div className="absolute bottom-[-10%] left-[-8%] w-[520px] h-[420px] rounded-full bg-cyan-500/[0.06] blur-[140px]" />
      </div>

      <div className="relative z-10 space-y-7 sm:space-y-9">
        {/* Top Music Licensing & Discovery Ribbon */}
        <div className="specular-edge flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-[#0c0c16]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_-14px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <BrandLogo variant="compact" showSlogan={false} />
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-white tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="gold-gradient-text uppercase tracking-wide">
                  {PLATFORM_SLOGAN}
                </span>
              </span>
              <span className="text-white/20 hidden md:inline">•</span>
              <span className="text-xs text-neutral-300/90 hidden md:inline">
                Music Curated by ASCAP &amp; BMI Publishing
              </span>
            </div>
          </div>

          <Link
            href="/music"
            data-solid-cta="true"
            className="shimmer-cta inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-brand-gold text-xs font-bold text-white hover:text-[#050509] border border-white/15 hover:border-brand-gold transition-all duration-300 shrink-0 cursor-pointer shadow-sm"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>The Algorithm of Timeless Music</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Dynamic Quick-Navigate Streaming Strip */}
        <section aria-label="Explore Streaming Hubs" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                Explore The Ecosystem
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 hidden sm:inline">
              Instant access across music, cinema, books &amp; live radio
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {QUICK_DESTINATIONS.map((dest) => {
              const Icon = dest.icon;
              return (
                <Link
                  key={dest.href}
                  href={dest.href}
                  className="group relative rounded-2xl p-3 bg-[#0e0e18]/75 hover:bg-[#161626]/95 border border-white/[0.07] hover:border-white/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${dest.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                  <div className="relative z-10 flex items-center sm:flex-col sm:items-start gap-2.5 sm:gap-2">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 group-hover:scale-110 group-hover:border-white/20 flex items-center justify-center transition-all duration-300 shrink-0">
                      <Icon className={`w-4 h-4 ${dest.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-[13px] font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                        {dest.label}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {dest.sub}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured Spatial Premiere Stage */}
        <HeroBanner track={featuredTrack} />

        {/* Recently Played Across Music, Audiobooks, Podcasts & 4K Videos */}
        <RecentlyPlayedSection />

        {/* Agentic AI Recommendations — New & Similar Content Across All Media */}
        <AgenticDiscoveryDeck mode="all" />

        {/* Cultural & Sonic System Spotlight Card */}
        <section className="specular-edge relative overflow-hidden glass-panel p-6 sm:p-9 rounded-3xl bg-gradient-to-br from-[#141026]/90 via-[#0c0c16]/90 to-[#120f1c]/90 space-y-5">
          <div className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-brand-gold/12 blur-[90px]" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 w-72 h-72 rounded-full bg-brand-purple/15 blur-[90px]" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-[11px] font-bold uppercase tracking-[0.14em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Digital Arts &amp; Entertainment Platform</span>
                </div>
                <VoiceNarrationButton
                  text="Introducing an advance cultural and sonic system for Independent Artists & Creators. Using Digital Arts, Entertainment, Music and Videos, Streaming 4K Cultural Documentaries, Narrated Audiobooks and Podcasts. The Platform will also Introduce DJ Playlists, Online Radio, ChanceTEK One Music Discovery, Music Downloads, Apps, Merchandise and More."
                  variant="dual"
                />
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold studio-heading-gradient tracking-tight leading-[1.15]">
                Introducing an advance cultural and sonic system for Independent Artists &amp; Creators
              </h2>
              <p className="text-sm sm:text-base text-neutral-300/90 leading-relaxed">
                Using Digital Arts, Entertainment, Music and Videos, Streaming 4K Cultural Documentaries, Narrated Audiobooks and Podcasts. The Platform will also Introduce DJ Playlists, Online Radio, ChanceTEK One Music Discovery, Music Downloads, Apps, Merchandise and More.
              </p>
            </div>

            <div className="flex flex-row lg:flex-col gap-3 shrink-0">
              <Link
                href="/learn-more"
                className="shimmer-cta inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#f7cf62] via-brand-gold to-amber-500 text-[#050509] font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-[0_8px_30px_rgba(245,195,68,0.35)] hover:shadow-[0_12px_36px_rgba(245,195,68,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-all"
              >
                <span>Read Manifesto</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold text-xs sm:text-sm transition-all border border-white/15 hover:border-white/25"
              >
                <span>Support Center</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Trending Studio Anthems Deck */}
        <section className="glass-panel p-5 sm:p-7 rounded-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-amber/25 to-brand-gold/10 border border-brand-gold/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,159,28,0.2)]">
                <Flame className="w-5 h-5 text-brand-amber" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Trending Timeless Music
                </h3>
                <p className="text-xs text-neutral-400">
                  Instant hi-res playback • Click any track to stream
                </p>
              </div>
            </div>

            <Link
              href="/music"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-xs font-bold text-brand-gold transition-all"
            >
              <span>View Top 50</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="hidden md:grid grid-cols-[1fr_1fr_auto] items-center px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <span className="pl-9">Title &amp; Artist</span>
            <span className="px-2">Album &amp; Genre</span>
            <span className="pr-2">Tempo &amp; Actions</span>
          </div>

          <div className="space-y-1">
            {trendingTracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                contextTracks={trendingTracks}
              />
            ))}
          </div>
        </section>

        {/* Platform & Editorial Pages Bento Grid */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Platform &amp; Editorial Pages
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Culture, sonic manifesto, concierge support, and creator governance
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] text-brand-gold font-semibold">
              ChanceTEK One
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Link
              href="/about"
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/25 text-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-brand-gold transition-colors">
                  About Platform
                </h3>
                <p className="text-xs text-neutral-300/90 leading-relaxed">
                  The Story of ChanceTEK One. Analog ethos, hardware grain, and cultural mission.
                </p>
              </div>
              <span className="text-xs font-bold text-brand-gold flex items-center gap-1 pt-1">
                <span>Explore Story</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/learn-more"
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-brand-gold transition-colors">
                  Learn More
                </h3>
                <p className="text-xs text-neutral-300/90 leading-relaxed">
                  The Manifesto of the Break. Lineage, 12-bit SP-1200 lore, and cultural evolution.
                </p>
              </div>
              <span className="text-xs font-bold text-brand-gold flex items-center gap-1 pt-1">
                <span>Read More</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/support"
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-neon/15 border border-brand-neon/25 text-brand-neon flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-brand-neon transition-colors">
                  Support Center
                </h3>
                <p className="text-xs text-neutral-300/90 leading-relaxed">
                  Platform Concierge, PWA offline guide, vinyl tracking, and direct email contacts.
                </p>
              </div>
              <span className="text-xs font-bold text-brand-neon flex items-center gap-1 pt-1">
                <span>Get Help</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/terms"
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-purple/15 border border-brand-purple/25 text-brand-purple flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-brand-neon transition-colors">
                  Terms of Service
                </h3>
                <p className="text-xs text-neutral-300/90 leading-relaxed">
                  Platform covenants, master sample rights, and non-commercial streaming guidelines.
                </p>
              </div>
              <span className="text-xs font-bold text-brand-neon flex items-center gap-1 pt-1">
                <span>View Terms</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/privacy"
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </h3>
                <p className="text-xs text-neutral-300/90 leading-relaxed">
                  Global privacy standards, AI memory vault isolation, and data sovereignty.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 pt-1">
                <span>Read Policy</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
