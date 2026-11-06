'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Disc3,
  Play,
  Volume2,
  Lock,
  Crown,
  ChevronLeft,
  Sparkles,
  Flame,
  Radio,
  Sliders,
  Disc,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { OFFICIAL_CRATES } from '@/types/catalog';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { TrackRow } from '@/components/media/TrackRow';
import { MediaCard } from '@/components/media/MediaCard';

export default function CrateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { profile, isAdmin } = useAuth();

  const isMember = Boolean(
    isAdmin ||
    profile?.role === 'admin' ||
    profile?.role === 'creator' ||
    (profile as any)?.membershipStatus === 'active'
  );

  const resolveCrate = React.useCallback(() => {
    return (
      MusicCatalogService.getCrateBySlug(slug) ||
      MusicCatalogService.getCrateById(slug) ||
      OFFICIAL_CRATES.find((c) => c.slug === slug || c.id === slug) ||
      OFFICIAL_CRATES[0]
    );
  }, [slug]);

  const [crate, setCrate] = React.useState(
    () => OFFICIAL_CRATES.find((c) => c.slug === slug || c.id === slug) || OFFICIAL_CRATES[0]
  );
  const [tracks, setTracks] = React.useState< ReturnType<typeof MusicCatalogService.getTracksByCrate> >([]);

  React.useEffect(() => {
    const refresh = () => {
      const liveCrate = resolveCrate();
      setCrate(liveCrate);
      setTracks(MusicCatalogService.getTracksByCrate(liveCrate.id));
    };

    refresh();
    const unsub = MusicCatalogService.subscribe(refresh);
    window.addEventListener('catalog-updated', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      unsub();
      window.removeEventListener('catalog-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [slug, resolveCrate]);

  const isCratePlaying =
    isPlaying && currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks.slice(1));
    }
  };

  return (
    <div className="space-y-10 py-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/music'))}
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
        title="Return to Previous Page"
      >
        <ChevronLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
        <span>Back to The Crates & Diggin Vault</span>
      </button>

      {/* Apple Music Inspired Hero Showcase Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#180e28] via-[#0f091a] to-[#08050e] shadow-2xl p-6 sm:p-10">
        {/* Glow backdrop */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: crate.accentColor }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* Large Artwork */}
          <div
            className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 shadow-2xl shrink-0 bg-black/80 flex items-center justify-center group"
            style={{ borderColor: `${crate.accentColor}80` }}
          >
            <Image
              src={crate.artworkUrl}
              alt={crate.name}
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Details */}
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm"
                style={{
                  backgroundColor: `${crate.accentColor}25`,
                  borderColor: `${crate.accentColor}70`,
                  color: crate.accentColor,
                }}
              >
                Official Crate Archive
              </span>
              <span className="px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-xs font-extrabold uppercase tracking-wider">
                {crate.badge}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 text-neutral-300 border border-white/10 text-xs font-mono font-bold">
                {crate.bpmRange}
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                {crate.name}
              </h1>
              <p className="text-sm sm:text-base font-semibold text-brand-gold">
                {crate.subtitle}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl leading-relaxed">
              {crate.description}
            </p>

            {/* Play Actions & Membership Badge */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:scale-105 transition-all"
              >
                {isCratePlaying ? (
                  <>
                    <Volume2 className="w-4 h-4 text-black animate-pulse" />
                    <span>Now Playing {crate.name}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                    <span>Play Crate Anthems</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-neutral-300">
                <Disc className="w-4 h-4 text-brand-gold animate-spin-slow" />
                <span className="font-bold text-white">{tracks.length}</span>
                <span>tracks in crate</span>
              </div>
            </div>

            {/* Member all-inclusive callout */}
            <div className="pt-1 flex items-center justify-center md:justify-start gap-2 text-xs text-neutral-300">
              <Crown className="w-4 h-4 text-brand-gold" />
              <span>
                One membership includes full, unlimited access to all 8 crates.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="space-y-4 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Crate Track Listing ({tracks.length})
            </h3>
            <p className="text-xs text-neutral-400">
              High-definition masters and newly published additions
            </p>
          </div>

          {!isMember && (
            <Link
              href={`/membership?crate=${encodeURIComponent(crate.name)}`}
              className="px-4 py-2 rounded-full bg-brand-gold text-black font-extrabold text-xs uppercase flex items-center gap-1.5 self-start sm:self-auto hover:scale-105 transition-all shadow-md"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Subscribe for Full 24-bit Stream</span>
            </Link>
          )}
        </div>

        <div className="divide-y divide-white/5">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} showCover={true} />
          ))}
        </div>
      </div>
    </div>
  );
}
