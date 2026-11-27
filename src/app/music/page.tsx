'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Music,
  Filter,
  Disc3,
  Play,
  Pause,
  Lock,
  Crown,
  Sparkles,
  ChevronRight,
  Flame,
  Disc,
  Layers,
  Sliders,
  Radio,
  Volume2,
  VolumeX,
  Shuffle,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Clock,
  X,
  ArrowLeft,
  ArrowUpDown,
} from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';
import { Track } from '@/types/media';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MediaCard } from '@/components/media/MediaCard';
import { PublicMusicCatalogSection } from '@/components/music/PublicMusicCatalogSection';
import { PublicPlaylistsShelf } from '@/components/home/PublicPlaylistsShelf';
import { AgenticDiscoveryDeck } from '@/components/ai/AgenticDiscoveryDeck';
import { MusicSortOption, MUSIC_SORT_OPTIONS, sortTracks } from '@/lib/music/trackSorting';

const GENRES = [
  'Genre',
  'Hip Hop',
  'R&B/Neo-Soul',
  'Country-Soul',
  'Afro-House & Beats',
  'House-Club',
  'Jazz & Blues',
  'Reggae-Dancehall',
  'Reggaeton',
  'Latin-Freestyle',
];

interface GenreArtworkInfo {
  name: string;
  artwork: string;
  video?: string;
  tagline: string;
  description: string;
  accent: string;
  badge: string;
  bpmRange: string;
  roots: string;
}

const GENRE_ARTWORKS: Record<string, GenreArtworkInfo> = {
  Genre: {
    name: 'The Algorithm of Timeless Music',
    artwork: '/images/genres/all-genres.jpg',
    video: '/videos/timeless_music_algorithm.mp4',
    tagline: 'ChanceTEK One Master Audio Catalog',
    description:
      'Explore authentic vinyl cuts, heavyweight rhythms, soulful chord progressions, and modern club anthems across the entire multi-genre sound spectrum.',
    accent: '#ffd700',
    badge: 'Timeless Music Archive',
    bpmRange: '84 - 174 BPM',
    roots: 'All Urban & Club Movements',
  },
  'Hip Hop': {
    name: 'Hip Hop',
    artwork: '/images/genres/hip-hop.jpg',
    tagline: 'SP-1200 Boom Bap & Street Turntablism',
    description:
      'Raw street culture, rhythmic vinyl scratching, heavy 12-bit kick drums, and unfiltered lyricism from the concrete trenches.',
    accent: '#c084fc',
    badge: 'Raw Street Heat',
    bpmRange: '90 - 132 BPM',
    roots: 'Bronx & Golden Era Heritage',
  },
  'R&B/Neo-Soul': {
    name: 'R&B / Neo-Soul',
    artwork: '/images/genres/rnb-neo-soul.jpg',
    tagline: 'Velvet Rhodes Chords & Tape Warmth',
    description:
      'Sultry electric pianos, emotive vocal harmonies, deep-pocket basslines, and late-night tape saturation crafted for genuine soul connection.',
    accent: '#e879f9',
    badge: 'Velvet Midnight Soul',
    bpmRange: '84 - 110 BPM',
    roots: 'Classic Motown & Quiet Storm',
  },
  'Country-Soul': {
    name: 'Country-Soul',
    artwork: '/images/genres/country-soul.jpg',
    tagline: 'Delta Blues, Slide Guitars & Southern Grit',
    description:
      'Acoustic slide licks, driving groove tempos, warm pedal steel tones, and down-home storytelling uniting Nashville soul with Memphis rhythm.',
    accent: '#f59e0b',
    badge: 'Delta Roots & Grit',
    bpmRange: '96 - 118 BPM',
    roots: 'Muscle Shoals & Delta Heritage',
  },
  'Afro-House & Beats': {
    name: 'Afro-House & Beats',
    artwork: '/images/genres/afro-house-beats.jpg',
    tagline: 'Ancestral Percussion & 3-Step Pulses',
    description:
      'Hypnotic djembe drums, deep log-drum basslines, energetic syncopation, and spiritual chants driving packed dancefloors from Lagos to worldwide.',
    accent: '#ef4444',
    badge: 'Ancestral Pulses',
    bpmRange: '120 - 128 BPM',
    roots: 'Lagos, Soweto & Global Afrobeats',
  },
  'House-Club': {
    name: 'House-Club',
    artwork: '/images/genres/house-club.jpg',
    tagline: 'Four-on-the-Floor & Peak-Time Energy',
    description:
      'Pumping 909 kicks, infectious synth stabs, hands-in-the-air builds, and underground warehouse anthems engineered for pure dancefloor euphoria.',
    accent: '#06b6d4',
    badge: 'Warehouse Peak Energy',
    bpmRange: '124 - 174 BPM',
    roots: 'Chicago, Detroit & UK Club Sound',
  },
  'Jazz & Blues': {
    name: 'Jazz & Blues',
    artwork: '/images/genres/jazz-blues.jpg',
    tagline: 'Smoky Brass, Blue Notes & Virtuosity',
    description:
      'Muted trumpet solos, expressive tenor sax lines, swinging upright bass, and dusty midnight speakeasy confessions for true vinyl collectors.',
    accent: '#3b82f6',
    badge: 'Speakeasy Virtuosity',
    bpmRange: '92 - 115 BPM',
    roots: 'Blue Note, Harlem & New Orleans',
  },
  'Reggae-Dancehall': {
    name: 'Reggae-Dancehall',
    artwork: '/images/genres/reggae-dancehall.jpg',
    tagline: 'Kingston Sound Clash & Dub Echoes',
    description:
      'Earthquake sub-bass, gunshot snare claps, dynamic toasting flows, and authentic one-drop riddims straight out of Jamaican sound system culture.',
    accent: '#22c55e',
    badge: 'Sound System Clash',
    bpmRange: '85 - 168 BPM',
    roots: 'Kingston Sound Systems & Dub Labs',
  },
  'Reggaeton': {
    name: 'Reggaeton',
    artwork: '/images/genres/reggaeton.jpg',
    tagline: 'San Juan Dembow & Tropical Pressure',
    description:
      'Heavyweight syncopated dembow riddims, snappy snares, urban Latin flows, and island heat tailored for block parties and dancehall clubs.',
    accent: '#f97316',
    badge: 'Dembow Pressure',
    bpmRange: '92 - 100 BPM',
    roots: 'San Juan Underground & Panama Roots',
  },
  'Latin-Freestyle': {
    name: 'Latin-Freestyle',
    artwork: '/images/genres/latin-freestyle.jpg',
    tagline: 'Miami 808 Synths & Electro Rhythms',
    description:
      'Punchy Roland TR-808 percussion, soaring vocal melodies, rapid synth arpeggios, and high-energy 80s/90s club freestyle rhythms.',
    accent: '#ec4899',
    badge: '808 Electro Rhythm',
    bpmRange: '124 - 132 BPM',
    roots: 'Miami Bass & NYC Latin Electro',
  },
};

interface MemberCrate {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MEMBERS_ONLY_CRATES: MemberCrate[] = [
  {
    id: 'slow-jams',
    name: 'Slow Jams',
    subtitle: 'Late-Night Quiet Storm, 80s & 90s Soul',
    badge: 'VIP Master',
    icon: Flame,
  },
  {
    id: 'disco',
    name: 'Disco',
    subtitle: 'Studio 54 Classics & 12" Extended Mixes',
    badge: 'Club Vault',
    icon: Sparkles,
  },
  {
    id: 'oldschool-rnb-soul',
    name: 'Timeless R&B | Soul Music',
    subtitle: 'Motown, Stax & Rare 70s Collector Vinyl',
    badge: 'Analog Reel',
    icon: Disc3,
  },
  {
    id: 'golden-era-hip-hop',
    name: 'Golden Era Hip Hop',
    subtitle: '90-96 BPM Boom Bap & SP-1200 Heat',
    badge: '12-Bit Vintage',
    icon: Crown,
  },
  {
    id: 'break-beats-samples',
    name: 'Classic Drums & Samples',
    subtitle: 'Open Drum Solos, Chops & Funk Loops',
    badge: 'Rare Drums',
    icon: Disc,
  },
  {
    id: 'discographys',
    name: 'Discographys',
    subtitle: 'Full Artist Archives & Unreleased B-Sides',
    badge: 'Complete Vault',
    icon: Layers,
  },
  {
    id: 'stems',
    name: 'Stems',
    subtitle: 'Isolated Multitracks: Drums, Bass, Vocals',
    badge: 'Studio Stems',
    icon: Sliders,
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    subtitle: 'White Labels, Promos & Soundboard Sessions',
    badge: 'Exclusive Archive',
    icon: Radio,
  },
];

import { useAuth } from '@/lib/auth/AuthContext';
import { OFFICIAL_CRATES } from '@/types/catalog';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { isTrackMatchingGenre } from '@/lib/music/genreClassifier';
const getCrateIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Flame':
      return Flame;
    case 'Sparkles':
      return Sparkles;
    case 'Disc3':
      return Disc3;
    case 'Crown':
      return Crown;
    case 'Disc':
      return Disc;
    case 'Layers':
      return Layers;
    case 'Sliders':
      return Sliders;
    case 'Radio':
      return Radio;
    default:
      return Disc3;
  }
};

export default function MusicPage() {
  const router = useRouter();
  const { playTrack, playRandom, pause, currentTrack, isPlaying, isShuffled } = usePlayer();
  const { profile, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('Genre');
  const [sortBy, setSortBy] = useState<MusicSortOption>('newest');
  const [allCatalogTracks, setAllCatalogTracks] = useState<Track[]>(() => MusicCatalogService.getSSRBaselineTracks());
  const [crates, setCrates] = useState(() => MusicCatalogService.getSSRBaselineCrates());

  const [trackToRemove, setTrackToRemove] = useState<Track | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');

  // Video sound toggle controls for the Music page hero & Algorithm of Timeless Music videos
  const heroVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const genreVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isHeroVideoUnmuted, setIsHeroVideoUnmuted] = useState(false);
  const [isGenreVideoUnmuted, setIsGenreVideoUnmuted] = useState(false);

  const toggleHeroVideoAudio = () => {
    const vid = heroVideoRef.current;
    if (!vid) return;
    const nextUnmuted = !isHeroVideoUnmuted;
    if (nextUnmuted) {
      pause();
      if (genreVideoRef.current) {
        genreVideoRef.current.muted = true;
      }
      setIsGenreVideoUnmuted(false);
      vid.muted = false;
      vid.volume = 1;
      vid.play().catch(() => { });
    } else {
      vid.muted = true;
    }
    setIsHeroVideoUnmuted(nextUnmuted);
  };

  const toggleGenreVideoAudio = () => {
    const vid = genreVideoRef.current;
    if (!vid) return;
    const nextUnmuted = !isGenreVideoUnmuted;
    if (nextUnmuted) {
      pause();
      if (heroVideoRef.current) {
        heroVideoRef.current.muted = true;
      }
      setIsHeroVideoUnmuted(false);
      vid.muted = false;
      vid.volume = 1;
      vid.play().catch(() => { });
    } else {
      vid.muted = true;
    }
    setIsGenreVideoUnmuted(nextUnmuted);
  };

  // Mobile Thermal & Battery Protection:
  // Never run TWO simultaneous hardware H.264 video decoders on iPhone/Android!
  // Only decode a video when it is visible in viewport, tab is active, and (on mobile) music isn't playing.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;
    const heroVisibleRef = { current: false };
    const genreVisibleRef = { current: false };

    const reconcilePlayback = () => {
      const heroVid = heroVideoRef.current;
      const genreVid = genreVideoRef.current;
      const docHidden = document.hidden;
      const mobile = isMobileViewport();

      // When tab is hidden, pause all decorative videos immediately
      if (docHidden) {
        heroVid?.pause();
        genreVid?.pause();
        return;
      }

      // If user explicitly unmuted one video, keep ONLY that one playing when visible
      if (isHeroVideoUnmuted && heroVid) {
        genreVid?.pause();
        if (heroVisibleRef.current) heroVid.play().catch(() => {});
        else heroVid.pause();
        return;
      }
      if (isGenreVideoUnmuted && genreVid) {
        heroVid?.pause();
        if (genreVisibleRef.current) genreVid.play().catch(() => {});
        else genreVid.pause();
        return;
      }

      // On mobile while music is actively streaming, shut down muted decorative decoders to keep device cool
      if (mobile && isPlaying) {
        heroVid?.pause();
        genreVid?.pause();
        return;
      }

      // Mutual exclusion: decode at most ONE visible muted video at a time
      if (heroVisibleRef.current && heroVid) {
        genreVid?.pause();
        heroVid.play().catch(() => {});
      } else if (genreVisibleRef.current && genreVid) {
        heroVid?.pause();
        genreVid.play().catch(() => {});
      } else {
        heroVid?.pause();
        genreVid?.pause();
      }
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.target === heroVideoRef.current) {
                  heroVisibleRef.current = entry.isIntersecting;
                } else if (entry.target === genreVideoRef.current) {
                  genreVisibleRef.current = entry.isIntersecting;
                }
              });
              reconcilePlayback();
            },
            { threshold: 0.25 }
          )
        : null;

    if (observer) {
      if (heroVideoRef.current) observer.observe(heroVideoRef.current);
      if (genreVideoRef.current) observer.observe(genreVideoRef.current);
    }

    document.addEventListener('visibilitychange', reconcilePlayback);
    reconcilePlayback();

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', reconcilePlayback);
      heroVideoRef.current?.pause();
      genreVideoRef.current?.pause();
    };
  }, [isPlaying, isHeroVideoUnmuted, isGenreVideoUnmuted, selectedGenre]);

  React.useEffect(() => {
    setMounted(true);
    const syncTracks = () => {
      setAllCatalogTracks(MusicCatalogService.getAllTracks());
      setCrates(MusicCatalogService.getOfficialCrates());
    };

    syncTracks();
    const unsub = MusicCatalogService.subscribe(syncTracks);

    return () => {
      unsub();
    };
  }, []);

  const handleConfirmRemoveTrack = () => {
    if (!trackToRemove) return;
    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';
    MusicCatalogService.removeTrack(trackToRemove.id, { id: adminId, name: adminName }, removeReason.trim() || undefined);
    setTrackToRemove(null);
    setRemoveReason('');
  };

  const activeGenreMeta = GENRE_ARTWORKS[selectedGenre] || GENRE_ARTWORKS['Genre'];

  const filteredTracks = React.useMemo(() => {
    const genreMatched =
      selectedGenre === 'Genre'
        ? allCatalogTracks
        : allCatalogTracks.filter((t) =>
          isTrackMatchingGenre(t.genre, selectedGenre, t.crateId, t.artistName, t.title)
        );
    return sortTracks(genreMatched, sortBy);
  }, [allCatalogTracks, selectedGenre, sortBy]);

  const isGenrePlaying =
    isPlaying &&
    currentTrack &&
    filteredTracks.some((t) => t.id === currentTrack.id);

  const handlePlayGenre = () => {
    if (filteredTracks.length > 0) {
      playTrack(filteredTracks[0], filteredTracks);
    }
  };

  const handleMemberCrateClick = (crateName: string) => {
    const isMember = Boolean(profile || isAdmin);

    const crateObj =
      crates.find(
        (c) =>
          c.name.toLowerCase() === crateName.toLowerCase() ||
          c.id === crateName.toLowerCase() ||
          c.slug === crateName.toLowerCase()
      ) ||
      OFFICIAL_CRATES.find(
        (c) =>
          c.name.toLowerCase() === crateName.toLowerCase() ||
          c.id === crateName.toLowerCase()
      );

    if (isMember && crateObj) {
      router.push(`/music/crate/${crateObj.slug || crateObj.id}`);
    } else {
      router.push(`/membership?crate=${encodeURIComponent(crateName)}`);
    }
  };

  return (
    <div className="space-y-8 py-6 animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/'))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* 1. Music Area Hero Video Showcase */}
      <div
        data-cinema-dark="true"
        className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.85)] group"
      >
        {/* Full-Bleed 16:9 HD Brand Video (100% unobstructed) */}
        <div className="relative w-full aspect-video max-h-[540px] bg-black overflow-hidden">
          <video
            ref={heroVideoRef}
            loop
            muted={!isHeroVideoUnmuted}
            playsInline
            preload="metadata"
            poster="/images/genres/all-genres.jpg"
            className="w-full h-full object-cover object-center block"
          >
            <source src="/videos/chancetekone1.mp4" type="video/mp4" />
          </video>

          {/* Listen / Mute Video Audio Pill */}
          <button
            type="button"
            onClick={toggleHeroVideoAudio}
            className={`absolute bottom-3.5 right-3.5 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wider backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl border ${isHeroVideoUnmuted
              ? 'bg-brand-gold text-black border-amber-200 hover:scale-105'
              : 'bg-black/75 hover:bg-brand-gold text-white hover:text-black border-white/25 hover:border-brand-gold'
              }`}
            title={isHeroVideoUnmuted ? 'Mute Video Audio' : 'Listen to Video Audio'}
            aria-label={isHeroVideoUnmuted ? 'Mute Video Audio' : 'Listen to Video Audio'}
          >
            {isHeroVideoUnmuted ? (
              <>
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>Listening · Mute</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span>Listen to Video</span>
              </>
            )}
          </button>
        </div>

        {/* Clean Licensing Bar directly beneath the video */}
        <div className="relative z-10 flex flex-wrap items-center justify-center sm:justify-between gap-2 px-4 sm:px-6 py-3 bg-[#08080e]/95 border-t border-white/10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-gold/15 border border-brand-gold/50 text-brand-gold text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-gold shrink-0" />
            <span>Music Curated by ASCAP &amp; BMI Publishing</span>
          </div>

          <button
            type="button"
            onClick={toggleHeroVideoAudio}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${isHeroVideoUnmuted
              ? 'bg-brand-gold/20 border-brand-gold/60 text-brand-gold'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
              }`}
          >
            {isHeroVideoUnmuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isHeroVideoUnmuted ? 'Video Audio On' : 'Listen to Video'}</span>
          </button>
        </div>
      </div>

      {/* 2. Genres Bar — Directly below the Hero Video */}
      <div className="glass-panel px-3 sm:px-4 py-3 sm:py-3.5 rounded-3xl border border-white/10 bg-gradient-to-r from-[#140e24]/90 via-[#0e0a1a]/85 to-[#08080f]/90 shadow-xl space-y-2">
        {selectedGenre !== 'Genre' && (
          <div className="flex items-center justify-end px-1">
            <button
              onClick={() => setSelectedGenre('Genre')}
              className="text-xs text-brand-gold hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Reset to All Genres
            </button>
          </div>
        )}

        {/* Horizontally scrollable pill rail on mobile/tablet so full genre labels never truncate to 2 letters; full-width row on desktop */}
        <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 lg:justify-between lg:gap-1.5">
          {GENRES.map((g) => {
            const isSelected = selectedGenre === g;
            return (
              <button
                key={g}
                data-genre-pill="true"
                data-genre-active={isSelected ? 'true' : undefined}
                onClick={() => setSelectedGenre(g)}
                title={g}
                className={`shrink-0 lg:flex-1 lg:min-w-0 flex items-center justify-center text-center px-3.5 sm:px-4 lg:px-2 py-2 rounded-xl text-xs lg:text-[11px] xl:text-xs font-bold tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer ${isSelected
                  ? 'bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-brand-gold z-10'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 hover:border-brand-gold/40'
                  }`}
              >
                {g === 'Genre' && (
                  <Disc3 className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isSelected ? 'text-black' : 'text-brand-gold'}`} />
                )}
                <span className="lg:truncate">{g}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2b. Dynamic Genre Artwork Showcase Banner (Directly associated with the active genre selection) */}
      <div
        data-genre-banner="true"
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#120a1f] via-[#090610] to-[#040208] shadow-[0_12px_45px_rgba(0,0,0,0.65)] group"
      >
        {/* Lightweight ambient backdrop image (avoids double-decoding a blurred 1080p video on mobile GPUs) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Image
            src={activeGenreMeta.artwork}
            alt={activeGenreMeta.name}
            fill
            priority
            className="object-cover object-center opacity-30 md:opacity-35 scale-105 group-hover:scale-110 transition-transform duration-700 filter blur-sm md:blur-[2px]"
          />
          {/* Multi-layered directional vignette to ensure pristine text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#08050e] via-[#08050e]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08050e] via-transparent to-[#08050e]/60" />
          <div
            className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ backgroundColor: activeGenreMeta.accent }}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left Details */}
          <div className="space-y-3.5 max-w-2xl">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm border"
                style={{
                  backgroundColor: `${activeGenreMeta.accent}20`,
                  borderColor: `${activeGenreMeta.accent}60`,
                  color: activeGenreMeta.accent,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {activeGenreMeta.badge}
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-[11px] font-semibold">
                <Flame className="w-3 h-3 text-brand-gold" />
                {activeGenreMeta.bpmRange}
              </span>

              <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline-block">
                • {activeGenreMeta.roots}
              </span>
            </div>

            {/* Title & Tagline */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                {activeGenreMeta.name}
              </h2>
              <p
                className="text-xs sm:text-sm font-bold tracking-wide"
                style={{ color: activeGenreMeta.accent }}
              >
                {activeGenreMeta.tagline}
              </p>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl">
              {activeGenreMeta.description}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-solid-cta="true"
                onClick={handlePlayGenre}
                disabled={filteredTracks.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-lg transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isGenrePlaying
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ffd700 0%, #f59e0b 50%, #fbbf24 100%)',
                  color: '#000000',
                  boxShadow: `0 0 20px ${activeGenreMeta.accent}60`,
                }}
              >
                {isGenrePlaying ? (
                  <>
                    <Volume2 className="w-4 h-4 text-black animate-pulse" />
                    <span>Playing</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => playRandom(filteredTracks)}
                disabled={filteredTracks.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border ${isShuffled && isGenrePlaying
                  ? 'bg-brand-purple text-white border-brand-neon shadow-[0_0_20px_rgba(157,78,221,0.55)]'
                  : 'bg-white/10 hover:bg-brand-purple/40 text-white border-white/20 hover:border-brand-neon/60'
                  }`}
                title="Play music in a randomized order"
              >
                <Shuffle className="w-4 h-4 text-brand-gold" />
                <span>Random</span>
              </button>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300">
                <Disc className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
                <span className="font-bold text-white">{filteredTracks.length}</span>
                <span className="text-neutral-400">tracks</span>
              </div>
            </div>
          </div>

          {/* Right Column: Framed Genre Artwork / Video Showcase Card */}
          <div className="relative shrink-0 w-full md:w-auto self-center md:self-auto flex flex-col items-center">
            <div
              className="relative group/art w-full sm:w-96 md:w-[440px] lg:w-[480px] aspect-[16/9] rounded-2xl overflow-hidden border-2 bg-black shadow-[0_12px_40px_rgba(0,0,0,0.9)] transition-all duration-300 hover:scale-[1.02]"
              style={{ borderColor: `${activeGenreMeta.accent}90` }}
            >
              {activeGenreMeta.video ? (
                <>
                  <video
                    ref={genreVideoRef}
                    key={activeGenreMeta.video}
                    loop
                    muted={!isGenreVideoUnmuted}
                    playsInline
                    preload="metadata"
                    poster={activeGenreMeta.artwork}
                    className="object-cover object-center w-full h-full block"
                  >
                    <source src={activeGenreMeta.video} type="video/mp4" />
                  </video>
                  <button
                    type="button"
                    onClick={toggleGenreVideoAudio}
                    className={`absolute bottom-2.5 right-2.5 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md transition-all cursor-pointer shadow-lg border ${isGenreVideoUnmuted
                      ? 'bg-brand-gold text-black border-amber-200'
                      : 'bg-black/75 hover:bg-brand-gold text-white hover:text-black border-white/25'
                      }`}
                    title={isGenreVideoUnmuted ? 'Mute Video' : 'Listen to Video'}
                  >
                    {isGenreVideoUnmuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                        <span>Mute</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <Image
                  src={activeGenreMeta.artwork}
                  alt={`${activeGenreMeta.name} Artwork`}
                  fill
                  priority
                  className="object-cover object-center w-full h-full"
                />
              )}
            </div>
            <span className="text-[11px] text-neutral-400 mt-2.5 font-medium tracking-wide">
              Selected Genre: <span className="text-white font-bold">{selectedGenre === 'Genre' ? 'All Movements' : selectedGenre}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2c. ChanceTEK One Music Companion — Tracks streaming history & suggests similar & new songs */}
      <AgenticDiscoveryDeck mode="music" />

      {/* 2d. Public Member Playlists Created by Platform Users */}
      <PublicPlaylistsShelf />

      {/* 3. Featured Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Featured Releases
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {selectedGenre === 'Genre'
                ? sortBy === 'newest'
                  ? 'Newest Uploaded First · Standard & Public Stream'
                  : `Sorted by ${MUSIC_SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Custom'}`
                : `Featuring authentic ${selectedGenre} records`}
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold absolute left-3 pointer-events-none" />
              <select
                aria-label="Sort featured releases"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as MusicSortOption)}
                className="pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-brand-gold/30 text-neutral-100 text-xs font-semibold focus:border-brand-gold focus:outline-none cursor-pointer"
              >
                {MUSIC_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredTracks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredTracks.map((track) => (
              <MediaCard key={track.id} item={track} type="track" />
            ))}
          </div>
        ) : (
          <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center space-y-3">
            <Music className="w-8 h-8 text-neutral-500 mx-auto" />
            <p className="text-sm font-semibold text-neutral-300">
              No tracks found matching &ldquo;{selectedGenre}&rdquo;
            </p>
            <button
              onClick={() => setSelectedGenre('Genre')}
              className="px-4 py-2 rounded-full bg-brand-gold text-black text-xs font-bold hover:scale-105 transition-all cursor-pointer"
            >
              View All Tracks
            </button>
          </div>
        )}
      </div>

      {/* 4. Members Only Collections Section */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 glass-panel border border-brand-gold/40 bg-gradient-to-br from-[#1c122e]/95 via-[#120a1f]/90 to-[#0a0712]/95 shadow-[0_10px_40px_rgba(0,0,0,0.6)] space-y-6">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Section Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/50 text-brand-gold text-xs font-black uppercase tracking-widest">
              <Crown className="w-3.5 h-3.5" />
              <span>VIP Studio Archive · One Subscription Includes All Collections</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Members Only Collections</span>
              <Lock className="w-5 h-5 text-brand-gold inline-block" />
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Unlock exclusive collector archives, rare multi-tracks, and high-fidelity masters. A single subscription membership includes full, unlimited access to all 8 collections — no individual purchases needed.
            </p>
          </div>

          <Link
            href="/membership"
            className="self-start md:self-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.45)] hover:scale-105 transition-all shrink-0 cursor-pointer"
          >
            <span>Subscribe &amp; Unlock All</span>
            <ChevronRight className="w-4 h-4 text-black stroke-[3]" />
          </Link>
        </div>

        {/* 8 Members Only Collections Cards Grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {crates.map((crate) => {
            const Icon = getCrateIcon(crate.iconName);
            return (
              <button
                key={crate.id}
                onClick={() => handleMemberCrateClick(crate.name)}
                className="group relative text-left p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-gold/60 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(245,158,11,0.25)] flex flex-col justify-between min-h-[145px] cursor-pointer"
              >
                {/* Top Row: Icon + Lock Badge */}
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-brand-gold/40 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
                    <Lock className="w-3 h-3 text-brand-gold" />
                    <span>All Included</span>
                  </div>
                </div>

                {/* Bottom Row: Name + Subtitle + CTA */}
                <div className="space-y-1 pt-3">
                  <h3 className="text-sm font-black text-white group-hover:text-brand-gold transition-colors">
                    {crate.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400 line-clamp-1 leading-snug">
                    {crate.subtitle}
                  </p>
                  <div className="pt-2 flex items-center gap-1.5 text-[10px] font-black text-brand-gold uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                    <span>Subscribe — Unlocks All</span>
                    <ChevronRight className="w-3 h-3 stroke-[3]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Reassurance Footer */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-gold shrink-0" />
            <span>All 8 Members Only Collections are included with your subscription membership.</span>
          </div>
          <Link
            href="/membership"
            className="text-brand-gold font-bold hover:underline shrink-0"
          >
            See Subscription Plans &rarr;
          </Link>
        </div>
      </section>

      {/* 5. Platform Music Catalog: Artist & Grouped Album Format (Play, Share & Add to Playlist) */}
      <PublicMusicCatalogSection
        tracks={allCatalogTracks}
        selectedGenre={selectedGenre}
        onSelectGenre={(g) => setSelectedGenre(g)}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Modal: Admin Remove Track to 45-Day Recovery Vault */}
      {trackToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a15] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-extrabold text-white">Quarantine Track to Recovery Vault</h3>
              </div>
              <button
                onClick={() => {
                  setTrackToRemove(null);
                  setRemoveReason('');
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={trackToRemove.coverUrl || '/images/default-cover.jpg'}
                  alt={trackToRemove.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm truncate">{trackToRemove.title}</p>
                <p className="text-xs text-brand-gold truncate">{trackToRemove.artistName}</p>
                <p className="text-[11px] text-neutral-400 truncate">{trackToRemove.albumTitle || 'Vault Cuts'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                45-Day Recovery Policy
              </p>
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                As an authorized administrator, removing this track places it into the 45-day Recovery Vault. An immutable audit record with your name and timestamp will be logged.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-neutral-300">Reason for Removal (Logged to Audit Trail)</label>
              <input
                type="text"
                placeholder="e.g. Licensing update, master replacement, audio edit..."
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/60"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setTrackToRemove(null);
                  setRemoveReason('');
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveTrack}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quarantine Track</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
