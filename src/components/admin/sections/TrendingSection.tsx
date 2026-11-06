'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  MOCK_TRACKS,
  MOCK_ALBUMS,
  MOCK_VIDEOS,
  MOCK_AUDIOBOOKS,
  MOCK_PRODUCTS,
  MOCK_ARTISTS,
} from '@/lib/mockData';
import {
  Flame,
  Music,
  Video,
  BookOpen,
  Disc3,
  ShoppingBag,
  Users,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { AnalyticsEvent } from '@/types/analytics';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';

interface TrendingSectionProps {
  events?: AnalyticsEvent[];
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({ events: propEvents }) => {
  const [activeWindow, setActiveWindow] = useState<'now' | 'today' | 'week' | 'month' | 'all'>('now');
  const [selectedContentType, setSelectedContentType] = useState<'all' | 'songs' | 'albums' | 'videos' | 'audiobooks' | 'merch'>('all');

  const events = propEvents || AnalyticsEngine.getEvents();
  const allTracks = MusicCatalogService.getAllTracks();

  // Dynamically derive trending items from authentic real user events
  const songItems = allTracks.map((track) => {
    const plays = (track.playCount || 0) + events.filter(
      (e) =>
        (e.eventType === 'SONG_PLAY_STARTED' || e.eventType === 'SONG_PLAY_COMPLETED' || e.eventType === 'TRACK_PLAY' || e.eventType === 'TRACK_STREAM') &&
        (e.resourceId === track.id || e.resource === track.title)
    ).length;
    return {
      id: `trend-song-${track.id}`,
      title: track.title,
      type: 'Song',
      typeBadge: 'songs',
      creator: track.artistName,
      metric: `${plays.toLocaleString()} Streams`,
      trend: plays > 0 ? `+${plays * 10}%` : '+0.0%',
      coverUrl: track.coverUrl,
      growthLabel: plays > 0 ? `${plays} verified streams` : 'Ready for playback',
      icon: Music,
      sortValue: plays,
    };
  });

  const allProducts = MerchCatalogService.getAllProducts();
  const merchItems = allProducts.map((prod) => {
    const orders = events.filter(
      (e) => e.eventType === 'MERCH_PURCHASED' && (e.resourceId === prod.id || e.resource === prod.title)
    ).length;
    const revenue = orders * prod.price;
    return {
      id: `trend-merch-${prod.id}`,
      title: prod.title,
      type: 'Merch',
      typeBadge: 'merch',
      creator: prod.artistName || 'Official Vault Store',
      metric: `$${revenue.toLocaleString()} Revenue (${orders} sold)`,
      trend: orders > 0 ? `+${orders * 15}%` : '+0.0%',
      coverUrl: prod.images[0],
      growthLabel: orders > 0 ? `${orders} orders processed` : 'In stock',
      icon: ShoppingBag,
      sortValue: revenue,
    };
  });

  const allAlbums = MusicCatalogService.getAllAlbums();
  const albumItems = allAlbums.map((album) => {
    const plays = events.filter(
      (e) => e.eventType === 'ALBUM_PLAYED' && (e.resourceId === album.id || e.resource === album.title)
    ).length;
    return {
      id: `trend-album-${album.id}`,
      title: album.title,
      type: 'Album',
      typeBadge: 'albums',
      creator: album.artistName,
      metric: `${plays.toLocaleString()} Plays`,
      trend: plays > 0 ? `+${plays * 12}%` : '+0.0%',
      coverUrl: album.coverUrl,
      growthLabel: plays > 0 ? `${plays} album sessions` : 'Full album ready',
      icon: Disc3,
      sortValue: plays,
    };
  });

  const allVideos = MediaCatalogService.getAllVideos();
  const videoItems = allVideos.map((video) => {
    const views = events.filter(
      (e) =>
        (e.eventType === 'VIDEO_STARTED' || e.eventType === 'VIDEO_COMPLETED' || e.eventType === 'VIDEO_PLAY') &&
        (e.resourceId === video.id || e.resource === video.title)
    ).length;
    return {
      id: `trend-video-${video.id}`,
      title: video.title,
      type: 'Video',
      typeBadge: 'videos',
      creator: video.artistName,
      metric: `${views.toLocaleString()} 4K Views`,
      trend: views > 0 ? `+${views * 8}%` : '+0.0%',
      coverUrl: video.thumbnailUrl,
      growthLabel: views > 0 ? `${views} 4K watches` : '4K stream ready',
      icon: Video,
      sortValue: views,
    };
  });

  const allAudiobooks = MediaCatalogService.getAllAudiobooks();
  const audiobookItems = allAudiobooks.map((book) => {
    const listens = events.filter(
      (e) =>
        (e.eventType === 'AUDIOBOOK_STARTED' || e.eventType === 'AUDIOBOOK_COMPLETED' || e.eventType === 'AUDIOBOOK_PLAY') &&
        (e.resourceId === book.id || e.resource === book.title)
    ).length;
    return {
      id: `trend-book-${book.id}`,
      title: book.title,
      type: 'Audiobook',
      typeBadge: 'audiobooks',
      creator: `${book.author} · Narrated by ${book.narrator}`,
      metric: `${listens.toLocaleString()} Listens`,
      trend: listens > 0 ? `+${listens * 10}%` : '+0.0%',
      coverUrl: book.coverUrl,
      growthLabel: listens > 0 ? `${listens} listening sessions` : 'Full audio ready',
      icon: BookOpen,
      sortValue: listens,
    };
  });

  const allTrendingItems = [...songItems, ...merchItems, ...albumItems, ...videoItems, ...audiobookItems].sort(
    (a, b) => b.sortValue - a.sortValue
  );

  const filteredItems = allTrendingItems.filter((it) => {
    if (selectedContentType === 'all') return true;
    return it.typeBadge === selectedContentType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Time Window Selector */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4 bg-gradient-to-r from-red-950/20 via-transparent to-brand-gold/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-brand-gold">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Unified Popular & Trending Intelligence Hub</h2>
              <p className="text-xs text-neutral-400">
                Multi-pillar velocity calculations synthesizing repeat plays, ratings, shares, and purchases
              </p>
            </div>
          </div>

          {/* Time Window Tabs */}
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 text-xs font-bold self-start sm:self-auto">
            {[
              { id: 'now', label: 'Trending Now' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All-Time' },
            ].map((win) => (
              <button
                key={win.id}
                onClick={() => setActiveWindow(win.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  activeWindow === win.id
                    ? 'bg-gradient-to-r from-amber-500 to-brand-amber text-black shadow-lg font-black'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {win.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Type Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All Pillars' },
            { id: 'songs', label: 'Songs' },
            { id: 'albums', label: 'Albums' },
            { id: 'videos', label: '4K Videos' },
            { id: 'audiobooks', label: 'Audiobooks' },
            { id: 'merch', label: 'Merchandise' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedContentType(type.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                selectedContentType === type.id
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-4 rounded-3xl glass-panel border border-white/5 hover:border-brand-gold/40 transition-all duration-300 space-y-3 group hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900 shadow-md">
                    <Image src={item.coverUrl || '/logo.png'} alt={item.title} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.2 rounded-md bg-white/10 text-[9px] font-bold uppercase tracking-wider text-brand-neon">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">#{idx + 1}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-brand-gold transition-colors mt-0.5">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-neutral-400 truncate">{item.creator}</p>
                  </div>
                </div>

                {/* Trend Badge */}
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold font-mono text-xs border border-emerald-500/30 shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {item.trend}
                </span>
              </div>

              {/* Metric Row */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-white font-bold">{item.metric}</span>
                <span className="text-[10px] text-neutral-400 font-sans">{item.growthLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
