'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Sparkles, Music, Video as VideoIcon, BookOpen, Users, ShoppingBag, ListMusic, Play, Globe } from 'lucide-react';
import { MOCK_ARTISTS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_PRODUCTS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';
import { MediaCard } from '@/components/media/MediaCard';
import { TrackRow } from '@/components/media/TrackRow';
import { Track, Artist } from '@/types/media';
import { Playlist } from '@/types/playlist';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { playPlaylist } = usePlayer();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'music' | 'playlists' | 'videos' | 'audiobooks' | 'artists' | 'merch'>('all');
  const [catalogTracks, setCatalogTracks] = useState<Track[]>(() => MusicCatalogService.getAllTracks());
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>(() => PlaylistService.getPublicPlaylists({ sortBy: 'recent' }));

  useEffect(() => {
    setCatalogTracks(MusicCatalogService.getAllTracks());
    const unsub = MusicCatalogService.subscribe(() => {
      setCatalogTracks(MusicCatalogService.getAllTracks());
    });
    const syncPl = () => setPublicPlaylists(PlaylistService.getPublicPlaylists({ sortBy: 'recent' }));
    syncPl();
    void PlaylistService.syncFromServer(false);
    const unsubPl = PlaylistService.subscribe(syncPl);
    return () => {
      unsub();
      unsubPl();
    };
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Aggregate dynamic artists from catalog tracks alongside known artists
  const allArtists = useMemo<Artist[]>(() => {
    const artistMap = new Map<string, Artist>();
    MOCK_ARTISTS.forEach((a) => {
      artistMap.set(a.name.toLowerCase().trim(), a);
    });
    catalogTracks.forEach((t) => {
      const name = (t.artistName || '').trim();
      const lower = name.toLowerCase();
      if (name && !artistMap.has(lower)) {
        artistMap.set(lower, {
          id: `artist-${lower.replace(/[^a-z0-9]/g, '-')}`,
          name,
          bio: `Artist on ChanceTEK One`,
          avatarUrl: t.coverUrl || t.albumCoverUrl || '/images/studio_cover.jpg',
          bannerUrl: t.albumCoverUrl || t.coverUrl || '/images/studio_cover.jpg',
          genres: [t.genre || 'Music'],
          verified: t.audioStatus === 'verified',
          followerCount: 0,
          popularTrackIds: [t.id],
        });
      }
    });
    return Array.from(artistMap.values());
  }, [catalogTracks]);

  // Search matching across all categories
  const matchedTracks = useMemo(
    () => filterAndRankTracks(catalogTracks, query),
    [catalogTracks, query]
  );

  const matchedArtists = useMemo(
    () => allArtists.filter((a) => matchesGenericMediaSearch(a, query)),
    [allArtists, query]
  );

  const allVideos = useMemo(() => {
    const list = MediaCatalogService.getAllVideos();
    return list.length > 0 ? list : MOCK_VIDEOS;
  }, []);

  const matchedVideos = useMemo(
    () => allVideos.filter((v) => matchesGenericMediaSearch(v, query)),
    [allVideos, query]
  );

  const allAudiobooks = useMemo(() => {
    const list = MediaCatalogService.getAllAudiobooks();
    return list.length > 0 ? list : MOCK_AUDIOBOOKS;
  }, []);

  const matchedAudiobooks = useMemo(
    () => allAudiobooks.filter((ab) => matchesGenericMediaSearch(ab, query)),
    [allAudiobooks, query]
  );

  const matchedPlaylists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return publicPlaylists;
    return publicPlaylists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.ownerName || '').toLowerCase().includes(q)
    );
  }, [publicPlaylists, query]);

  const matchedProducts = useMemo(
    () => MOCK_PRODUCTS.filter((p) => matchesGenericMediaSearch(p, query)),
    [query]
  );

  const totalMatches =
    matchedTracks.length +
    matchedPlaylists.length +
    matchedArtists.length +
    matchedVideos.length +
    matchedAudiobooks.length +
    matchedProducts.length;

  return (
    <div className="space-y-8 py-6 max-w-6xl mx-auto">
      {/* Search Input Box */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4 bg-white/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-gold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-brand-neon" />
          Universal AI-Powered Search
        </div>

        <div className="relative flex items-center">
          <SearchIcon className="w-5 h-5 text-neutral-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by song, artist, video, audiobook, vinyl, or natural language prompt..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-black/40 border border-white/10 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-2">
          {[
            { id: 'all', label: `All (${totalMatches})` },
            { id: 'music', label: `Tracks (${matchedTracks.length})`, icon: Music },
            { id: 'playlists', label: `Playlists (${matchedPlaylists.length})`, icon: ListMusic },
            { id: 'artists', label: `Artists (${matchedArtists.length})`, icon: Users },
            { id: 'videos', label: `Videos (${matchedVideos.length})`, icon: VideoIcon },
            { id: 'audiobooks', label: `Audiobooks (${matchedAudiobooks.length})`, icon: BookOpen },
            { id: 'merch', label: `Merch (${matchedProducts.length})`, icon: ShoppingBag },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === tab.id
                ? 'bg-brand-purple text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      {totalMatches === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-white/5 space-y-2">
          <p className="text-base font-bold text-white">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-neutral-400">
            Try searching for &ldquo;Hip Hop&rdquo;, &ldquo;R&amp;B&rdquo;, &ldquo;audiobook&rdquo;, or &ldquo;hoodie&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tracks Section */}
          {(activeTab === 'all' || activeTab === 'music') && matchedTracks.length > 0 && (
            <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Tracks</h3>
              <div className="divide-y divide-white/5">
                {matchedTracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Public Playlists Section */}
          {(activeTab === 'all' || activeTab === 'playlists') && matchedPlaylists.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                <span>Public Member Playlists</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {matchedPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="group glass-card p-3 rounded-2xl border border-white/5 hover:border-brand-gold/40 transition-all flex flex-col justify-between"
                  >
                    <Link href={`/playlists/${pl.id}`} className="block">
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 border border-white/10 bg-black/50">
                        <Image
                          src={pl.coverUrl || '/images/studio_cover.jpg'}
                          alt={pl.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            playPlaylist(pl);
                          }}
                          disabled={pl.items.length === 0}
                          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform disabled:opacity-40 cursor-pointer"
                          aria-label={`Play ${pl.name}`}
                        >
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </button>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold truncate">
                        {pl.name}
                      </h4>
                    </Link>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
                      <span className="truncate">By {pl.ownerName}</span>
                      <span className="text-brand-neon font-mono shrink-0">{pl.itemCount} items</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Artists Section */}
          {(activeTab === 'all' || activeTab === 'artists') && matchedArtists.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-neon">Artists & DJs</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {matchedArtists.map((artist) => (
                  <MediaCard key={artist.id} item={artist} type="artist" />
                ))}
              </div>
            </section>
          )}

          {/* Videos Section */}
          {(activeTab === 'all' || activeTab === 'videos') && matchedVideos.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">Videos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {matchedVideos.map((video) => (
                  <MediaCard key={video.id} item={video} type="video" />
                ))}
              </div>
            </section>
          )}

          {/* Audiobooks Section */}
          {(activeTab === 'all' || activeTab === 'audiobooks') && matchedAudiobooks.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Audiobooks</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {matchedAudiobooks.map((ab) => (
                  <MediaCard key={ab.id} item={ab} type="audiobook" />
                ))}
              </div>
            </section>
          )}

          {/* Merch Section */}
          {(activeTab === 'all' || activeTab === 'merch') && matchedProducts.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-amber">Official Merchandise</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {matchedProducts.map((prod) => (
                  <MediaCard key={prod.id} item={prod as any} type="album" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading Search Engine...</div>}>
      <SearchContent />
    </Suspense>
  );
}
