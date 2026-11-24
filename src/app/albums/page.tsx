'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { Album, Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCard } from '@/components/media/MediaCard';
import { MusicSortOption, ALBUM_SORT_OPTIONS, sortAlbums } from '@/lib/music/trackSorting';

export default function AlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [sortBy, setSortBy] = useState<MusicSortOption>('newest');

  useEffect(() => {
    const refresh = () => {
      setAlbums(MusicCatalogService.getAllAlbums());
      setAllTracks(MusicCatalogService.getAllTracks());
    };
    refresh();
    const unsub = MusicCatalogService.subscribe(refresh);
    return () => unsub();
  }, []);

  const sortedAlbums = useMemo(
    () => sortAlbums(albums, allTracks, sortBy),
    [albums, allTracks, sortBy]
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
            aria-label="Sort albums"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MusicSortOption)}
            className="pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-brand-gold/30 text-neutral-100 text-xs font-semibold focus:border-brand-gold focus:outline-none cursor-pointer"
          >
            {ALBUM_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="specular-edge relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-brand-gold/12 via-[#0c0c16]/90 to-[#080810]/95">
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-purple/20 blur-[100px]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-gold/15 border border-brand-gold/35 text-brand-gold text-[11px] font-bold uppercase tracking-[0.14em] mb-3">
            <Disc3 className="w-3.5 h-3.5" />
            <span>Full Length Releases</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold studio-heading-gradient tracking-tight">
            Albums, EPs, &amp; New Releases
          </h1>
          <p className="text-sm text-neutral-300/90 mt-2">
            Explore complete studio albums and curated collections across all 8 crates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {sortedAlbums.map((album) => (
          <MediaCard key={album.id} item={album} type="album" />
        ))}
      </div>
    </div>
  );
}
