'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowLeft } from 'lucide-react';
import { MOCK_ARTISTS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Artist } from '@/types/media';
import { MediaCard } from '@/components/media/MediaCard';

export default function ArtistsPage() {
  const router = useRouter();

  const loadCombinedArtists = (): Artist[] => {
    const map = new Map<string, Artist>();
    MOCK_ARTISTS.forEach((a) => map.set(a.id, a));
    const tracks = MusicCatalogService.getAllTracks();
    tracks.forEach((t) => {
      if (t.artistId && !map.has(t.artistId)) {
        map.set(t.artistId, {
          id: t.artistId,
          name: t.artistName,
          label: t.label || '8 OF SPADES WORKS',
          bio: `Featured artist on 8 OF SPADES WORKS.`,
          avatarUrl: t.coverUrl || '/images/logo.png',
          bannerUrl: t.coverUrl || '/images/the_lounge_ambient.jpg',
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
    const refresh = () => setArtists(loadCombinedArtists());
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
          <Users className="w-3.5 h-3.5" />
          Creators & DJs
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Featured Artists</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {artists.map((artist) => (
          <MediaCard key={artist.id} item={artist} type="artist" />
        ))}
      </div>
    </div>
  );
}
