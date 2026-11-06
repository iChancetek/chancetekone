'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, ArrowLeft } from 'lucide-react';
import { Album } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCard } from '@/components/media/MediaCard';

export default function AlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    const refresh = () => {
      setAlbums(MusicCatalogService.getAllAlbums());
    };
    refresh();
    const unsub = MusicCatalogService.subscribe(refresh);
    return () => unsub();
  }, []);

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
      <div className="flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>
      <div className="border-b border-white/5 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider mb-2">
          <Disc3 className="w-3.5 h-3.5" />
          Full Length Releases
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Albums, EPs, & New Releases</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Explore complete studio albums and curated collections across all 8 crates.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {albums.map((album) => (
          <MediaCard key={album.id} item={album} type="album" />
        ))}
      </div>
    </div>
  );
}
