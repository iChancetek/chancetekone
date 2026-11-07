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
  Play,
  Headphones,
  ShieldCheck,
} from 'lucide-react';
import { HeroBanner } from '@/components/media/HeroBanner';
import { TrackRow } from '@/components/media/TrackRow';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Track } from '@/types/media';

export default function HomePage() {
  const [tracks, setTracks] = React.useState<Track[]>(() => MusicCatalogService.getSSRBaselineTracks());
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const sync = () => setTracks(MusicCatalogService.getAllTracks());
    sync();
    const unsub = MusicCatalogService.subscribe(sync);
    return () => {
      unsub();
    };
  }, []);

  const featuredTrack = tracks[0] || MOCK_TRACKS[0];
  const trendingTracks = tracks.slice(0, 5);

  return (
    <div className="relative py-6 min-h-screen">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover opacity-50 brightness-95 saturate-125 transition-opacity duration-1000"
          src="/videos/8ofSW1.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/45 via-neutral-950/55 to-neutral-950/65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-neutral-950/20 to-neutral-950/55" />
      </div>

      <div className="relative z-10 space-y-8 sm:space-y-10">
        {/* Top Music Licensing Certification Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-2.5 rounded-2xl bg-neutral-950/85 border border-brand-gold/40 backdrop-blur-xl shadow-[0_0_25px_rgba(245,158,11,0.2)]">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-1.5 rounded-xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold shrink-0 shadow-inner">
              <ShieldCheck className="w-4 h-4 text-brand-gold" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-brand-gold tracking-wide uppercase">
                Music Curated by ASCAP & BMI Publishing
              </span>
              <span className="text-neutral-500 hidden md:inline">•</span>
              <span className="text-xs text-neutral-300 hidden md:inline">
                Discover independent artists, producers, and fresh sounds
              </span>
            </div>
          </div>
          <Link
            href="/music"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-xs font-bold text-neutral-200 hover:text-white border border-white/10 hover:border-brand-gold/40 transition-all shrink-0 cursor-pointer shadow-sm"
          >
            <span>The Lounge & Music Catalog</span>
            <ChevronRight className="w-3.5 h-3.5 text-brand-gold" />
          </Link>
        </div>

        <HeroBanner track={featuredTrack} />

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-gradient-to-r from-brand-purple/20 via-neutral-950/80 to-brand-gold/10 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Digital Arts & Entertainment Platform</span>
                </div>
                <VoiceNarrationButton
                  text="Introducing an advance cultural and sonic system for Independent Artists & Creators. Using Digital Arts, Entertainment, Music and Videos, Streaming 4K Cultural Documentaries, Narrated Audiobooks and Podcasts. The Platform will also Introduce DJ Playlists, Online Radio, A.I Crate Digging, Music Downloads, Apps, Merchandise and More."
                  variant="dual"
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Introducing an advance cultural and sonic system for Independent Artists & Creators
              </h2>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                Using Digital Arts, Entertainment, Music and Videos, Streaming 4K Cultural Documentaries, Narrated Audiobooks and Podcasts. The Platform will also Introduce DJ Playlists, Online Radio, A.I Crate Digging, Music Downloads, Apps, Merchandise and More.
              </p>
            </div>
            <div className="flex sm:flex-col gap-2.5 shrink-0">
              <Link
                href="/learn-more"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all"
              >
                <span>Read Manifesto</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all border border-white/10"
              >
                <span>Support Center</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-brand-amber" />
              <h3 className="text-base sm:text-lg font-bold text-white">Trending Breakbeat Anthems</h3>
            </div>
            <Link
              href="/music"
              className="text-xs font-semibold text-brand-gold hover:underline"
            >
              View Top 50
            </Link>
          </div>

          <div className="divide-y divide-white/5">
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

        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Platform & Editorial Pages
            </h2>
            <span className="text-xs text-brand-gold font-medium">ChanceTEKone</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Link
              href="/about"
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-brand-gold/60 bg-neutral-900/40 transition-all hover:scale-[1.02] space-y-3 group"
            >
              <div className="p-2 rounded-xl bg-brand-gold/20 text-brand-gold w-fit">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-brand-gold transition-colors">
                About Platform
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                The Story of ChanceTEKone. Analog ethos, hardware grain, and cultural mission.
              </p>
              <span className="text-xs font-semibold text-brand-gold flex items-center gap-1 pt-1">
                Explore Story <ChevronRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/learn-more"
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-brand-gold/50 bg-neutral-900/40 transition-all hover:scale-[1.02] space-y-3 group"
            >
              <div className="p-2 rounded-xl bg-brand-gold/20 text-brand-gold w-fit">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-brand-gold transition-colors">
                Learn More
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                The Manifesto of the Break. Lineage, 12-bit SP-1200 lore, and cultural evolution.
              </p>
              <span className="text-xs font-semibold text-brand-gold flex items-center gap-1 pt-1">
                Read More <ChevronRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/support"
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-brand-neon/50 bg-neutral-900/40 transition-all hover:scale-[1.02] space-y-3 group"
            >
              <div className="p-2 rounded-xl bg-brand-neon/20 text-brand-neon w-fit">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-brand-neon transition-colors">
                Support Center
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Crate Concierge, PWA offline guide, vinyl tracking, and direct email contacts.
              </p>
              <span className="text-xs font-semibold text-brand-neon flex items-center gap-1 pt-1">
                Get Help <ChevronRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/terms"
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-brand-purple/50 bg-neutral-900/40 transition-all hover:scale-[1.02] space-y-3 group"
            >
              <div className="p-2 rounded-xl bg-brand-purple/20 text-brand-purple w-fit">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-brand-purple transition-colors">
                Terms of Service
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Platform covenants, master sample rights, and non-commercial streaming guidelines.
              </p>
              <span className="text-xs font-semibold text-brand-purple flex items-center gap-1 pt-1">
                View Terms <ChevronRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              href="/privacy"
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-emerald-500/50 bg-neutral-900/40 transition-all hover:scale-[1.02] space-y-3 group"
            >
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 w-fit">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                Privacy Policy
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Global privacy standards, AI memory vault isolation, and data sovereignty.
              </p>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 pt-1">
                Read Policy <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
