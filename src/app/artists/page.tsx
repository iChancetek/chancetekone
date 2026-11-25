'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { MOCK_ARTISTS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Artist, Track } from '@/types/media';
import { MediaCard } from '@/components/media/MediaCard';
import { SimpleSortOption, ARTIST_SORT_OPTIONS, sortArtists } from '@/lib/music/trackSorting';

export default function ArtistsPage() {
  const router = useRouter();
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [sortBy, setSortBy] = useState<SimpleSortOption>('newest');

  const loadCombinedArtists = (tracks: Track[]): Artist[] => {
    const map = new Map<string, Artist>();
    MOCK_ARTISTS.forEach((a) => map.set(a.id, a));
    tracks.forEach((t) => {
      if (t.artistId && !map.has(t.artistId)) {
        map.set(t.artistId, {
          id: t.artistId,
          name: t.artistName,
          label: t.label || 'ChanceTEK One',
          bio: `Featured artist on ChanceTEK One.`,
          avatarUrl: t.coverUrl || '/images/studio_cover.jpg',
          bannerUrl: t.coverUrl || '/images/genres/all-genres.jpg',
          genres: [t.genre || 'R&B / Soul'],
          followerCount: 0,
          popularTrackIds: [t.id],
          verified: true,
        });
      }
    });
    return Array.from(map.values());
  };

  const [artists, setArtists] = useState<Artist[]>(MOCK_ARTISTS);

  useEffect(() => {
    const refresh = () => {
      const tracks = MusicCatalogService.getAllTracks();
      setAllTracks(tracks);
      setArtists(loadCombinedArtists(tracks));
    };
    refresh();
    const unsub = MusicCatalogService.subscribe(refresh);
    return () => unsub();
  }, []);

  const sortedArtists = useMemo(
    () => sortArtists(artists, allTracks, sortBy),
    [artists, allTracks, sortBy]
  );

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/music');
    }
  };

  return (
    <div className="space-y-8 py-6 animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>

        <div className="relative flex items-center">
          <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold absolute left-3 pointer-events-none" />
          <select
            aria-label="Sort artists"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SimpleSortOption)}
            className="pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-brand-gold/30 text-neutral-100 text-xs font-semibold focus:border-brand-gold focus:outline-none cursor-pointer"
          >
            {ARTIST_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="specular-edge relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-brand-gold/12 via-[#0c0c16]/90 to-[#080810]/95">
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-gold/15 blur-[100px]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-gold/15 border border-brand-gold/35 text-brand-gold text-[11px] font-bold uppercase tracking-[0.14em] mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>Creators &amp; DJs</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold studio-heading-gradient tracking-tight">
            Featured Artists
          </h1>
          <p className="text-sm text-neutral-300/90 mt-2">
            Explore verified independent artists, sonic architects, and master DJs across the ChanceTEK One ecosystem.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {sortedArtists.map((artist) => (
          <MediaCard key={artist.id} item={artist} type="artist" />
        ))}
      </div>
    </div>
  );
}
