'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { SongAnalyticsRecord, AlbumAnalyticsRecord } from '@/types/analytics';
import { Track, Album, Producer } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { useAuth } from '@/lib/auth/AuthContext';
import { BarRankingChart, RankingItem } from '../charts/BarRankingChart';
import { PlatformMusicCatalogSection } from './PlatformMusicCatalogSection';
import {
  ConfirmDeletionModal,
  DeletableItem,
} from '../modals/ConfirmDeletionModal';
import {
  Music,
  Disc3,
  Sliders,
  Play,
  RotateCcw,
  SkipForward,
  Star,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Clock,
  X,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface MusicAnalyticsSectionProps {
  songs: SongAnalyticsRecord[];
  albums: AlbumAnalyticsRecord[];
}

export const MusicAnalyticsSection: React.FC<MusicAnalyticsSectionProps> = ({ songs, albums }) => {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState<'songs' | 'albums' | 'producers' | 'analytics'>('songs');

  // Live Catalogs State
  const [liveTracks, setLiveTracks] = useState<Track[]>([]);
  const [liveAlbums, setLiveAlbums] = useState<Album[]>([]);
  const [liveProducers, setLiveProducers] = useState<Producer[]>([]);

  // Search & Filter State
  const [songSearch, setSongSearch] = useState('');
  const [albumSearch, setAlbumSearch] = useState('');
  const [producerSearch, setProducerSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'plays' | 'completionRate' | 'replays' | 'skips' | 'rating' | 'trendPercent'>('plays');
  const [songLimit, setSongLimit] = useState<10 | 25 | 50 | 100>(10);

  // Removal Modal State
  const [itemToRemove, setItemToRemove] = useState<DeletableItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sync Live Catalogs
  const syncCatalogs = () => {
    setLiveTracks(MusicCatalogService.getAllTracks());
    setLiveAlbums(MusicCatalogService.getAllAlbums());
    setLiveProducers(ProducerCatalogService.getAllProducers());
  };

  useEffect(() => {
    syncCatalogs();
    const unsubMusic = MusicCatalogService.subscribe(syncCatalogs);
    const unsubProducers = ProducerCatalogService.subscribe(syncCatalogs);

    window.addEventListener('catalog-updated', syncCatalogs);
    window.addEventListener('producers-updated', syncCatalogs);

    return () => {
      unsubMusic();
      unsubProducers();
      window.removeEventListener('catalog-updated', syncCatalogs);
      window.removeEventListener('producers-updated', syncCatalogs);
    };
  }, []);

  const handleConfirmRemoval = (reason: string, options?: { removeAssociatedTracks?: boolean }) => {
    if (!itemToRemove) return;

    const adminActor = {
      id: profile?.id || 'admin-usr',
      name: profile?.name || profile?.email || 'Platform Administrator',
      role: 'admin' as const,
      email: profile?.email,
    };

    const effectiveReason = reason.trim() || 'Deleted from live environment via Admin Dashboard';

    if (itemToRemove.type === 'song') {
      const success = MusicCatalogService.removeTrack(itemToRemove.id, adminActor, effectiveReason);
      if (success) {
        setFeedbackMessage(`Song "${itemToRemove.title}" deleted from live platform and moved to 45-day Recovery Vault.`);
      }
    } else if (itemToRemove.type === 'album') {
      const count = MusicCatalogService.removeAlbum(itemToRemove.title, adminActor, effectiveReason);
      setFeedbackMessage(`Album "${itemToRemove.title}" and ${count} track(s) deleted from live platform and moved to 45-day Recovery Vault.`);
    } else if (itemToRemove.type === 'producer') {
      const success = ProducerCatalogService.removeProducer(
        itemToRemove.id,
        adminActor,
        effectiveReason,
        options?.removeAssociatedTracks ?? true
      );
      if (success) {
        setFeedbackMessage(`Producer "${itemToRemove.title}" deleted from live environment.`);
      }
    }

    syncCatalogs();
    setItemToRemove(null);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Filtered live songs
  const filteredLiveTracks = liveTracks.filter((t) => {
    if (!t) return false;
    const q = String(songSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      String(t.title || '').toLowerCase().includes(q) ||
      String(t.artistName || '').toLowerCase().includes(q) ||
      String(t.albumTitle || '').toLowerCase().includes(q) ||
      String(t.genre || '').toLowerCase().includes(q)
    );
  });

  // Filtered live albums
  const filteredLiveAlbums = liveAlbums.filter((a) => {
    if (!a) return false;
    const q = String(albumSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      String(a.title || '').toLowerCase().includes(q) ||
      String(a.artistName || '').toLowerCase().includes(q) ||
      String(a.genre || '').toLowerCase().includes(q)
    );
  });

  // Filtered live producers
  const filteredLiveProducers = liveProducers.filter((p) => {
    if (!p) return false;
    const q = String(producerSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.handle || '').toLowerCase().includes(q) ||
      String(p.role || '').toLowerCase().includes(q) ||
      String(p.label || '').toLowerCase().includes(q)
    );
  });

  // Existing Analytics data
  const genres = ['all', ...Array.from(new Set(songs.map((s) => s.genre)))];
  const filteredSongsAnalytics = songs
    .filter((s) => {
      const q = String(songSearch || '').toLowerCase().trim();
      const matchSearch =
        !q ||
        String(s.title || '').toLowerCase().includes(q) ||
        String(s.artist || '').toLowerCase().includes(q);
      const matchGenre = selectedGenre === 'all' || s.genre === selectedGenre;
      return matchSearch && matchGenre;
    })
    .sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number))
    .slice(0, songLimit);

  const topSongRankingItems: RankingItem[] = songs.slice(0, 5).map((s, idx) => ({
    id: s.id,
    rank: idx + 1,
    title: s.title,
    subtitle: `${s.artist} • ${s.genre}`,
    coverUrl: s.coverUrl,
    value: s.plays,
    displayValue: s.plays >= 1000 ? `${(s.plays / 1000).toFixed(1)}k plays` : `${s.plays.toLocaleString()} plays`,
    trendPercent: s.trendPercent,
    secondaryMetric: `${s.completionRate}% completion`,
  }));

  const topAlbumRankingItems: RankingItem[] = albums.slice(0, 5).map((a, idx) => ({
    id: a.id,
    rank: idx + 1,
    title: a.title,
    subtitle: `${a.artist} • ${a.trackCount} Tracks`,
    coverUrl: a.coverUrl,
    value: a.plays,
    displayValue: a.plays >= 1000 ? `${(a.plays / 1000).toFixed(1)}k plays` : `${a.plays.toLocaleString()} plays`,
    trendPercent: a.trendPercent,
    secondaryMetric: `${a.totalPurchases} purchases`,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl glass-panel border border-white/5 bg-white/5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubTab('songs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'songs'
                ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Platform Catalog (Artist & Album Format)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveTracks.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('albums')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'albums'
                ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span>Live Albums</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveAlbums.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('producers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'producers'
                ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Live Producers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveProducers.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'analytics'
                ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Streaming Analytics</span>
          </button>
        </div>

        <div className="text-[11px] text-neutral-400 font-mono pr-2">
          Admin Removal Authority • Quarantined to 45-Day Recovery Vault
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PLATFORM MUSIC CATALOG (ARTIST & GROUPED ALBUM FORMAT)                */}
      {/* ========================================================================= */}
      {subTab === 'songs' && (
        <PlatformMusicCatalogSection onTotalCountChange={() => syncCatalogs()} />
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE ALBUMS MANAGEMENT                                                 */}
      {/* ========================================================================= */}
      {subTab === 'albums' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-brand-gold" />
                Live Albums Directory & Removal Console
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage live studio albums and full releases. Removing an album moves all its tracks into the 45-Day Recovery Vault.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search live album, artist..."
                value={albumSearch}
                onChange={(e) => setAlbumSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLiveAlbums.map((album) => (
              <div
                key={album.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-brand-gold/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shrink-0">
                    <Image src={album.coverUrl} alt={album.title} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-brand-gold transition-colors">
                      {album.title}
                    </h4>
                    <p className="text-xs text-neutral-300 truncate">{album.artistName}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      {album.trackIds?.length || 0} Tracks • {album.releaseYear || 2026}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Genre: <span className="text-neutral-200">{album.genre || 'Music'}</span>
                  </span>

                  <button
                    onClick={() =>
                      setItemToRemove({
                        type: 'album',
                        id: album.id,
                        title: album.title,
                        subtitle: `${album.artistName} • ${album.genre || 'Music'}`,
                        coverUrl: album.coverUrl,
                        trackCount: album.trackIds?.length || 0,
                        meta: `${album.trackIds?.length || 0} Tracks • Release ${album.releaseYear || 2026}`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete album from live platform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Album</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LIVE PRODUCERS MANAGEMENT                                              */}
      {/* ========================================================================= */}
      {subTab === 'producers' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-gold" />
                Live Producers Roster & Removal Console
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage featured sound engineers, crate beatmakers, and producers live in the platform.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search live producer, handle..."
                value={producerSearch}
                onChange={(e) => setProducerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLiveProducers.map((producer) => (
              <div
                key={producer.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-brand-gold/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/10 bg-neutral-900 shrink-0">
                    <Image src={producer.avatarUrl} alt={producer.name} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-brand-gold transition-colors">
                      {producer.name}
                    </h4>
                    <p className="text-xs text-brand-neon truncate">{producer.handle}</p>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {producer.role} • {producer.label}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-neutral-300">
                  <p className="text-[11px] text-neutral-400 line-clamp-2">{producer.bio}</p>
                  <p className="text-[10px] font-mono text-neutral-400 pt-1">
                    Signature BPM: <span className="text-brand-gold">{producer.signatureBpmRange}</span> • {producer.credits?.length || 0} Credits
                  </p>
                </div>

                <div className="border-t border-white/5 pt-3 flex justify-end">
                  <button
                    onClick={() =>
                      setItemToRemove({
                        type: 'producer',
                        id: producer.id,
                        title: producer.name,
                        subtitle: `${producer.handle} • ${producer.role}`,
                        coverUrl: producer.avatarUrl,
                        meta: `Signature BPM: ${producer.signatureBpmRange} • ${producer.credits?.length || 0} Credits`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete producer from live roster"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Producer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STREAMING ANALYTICS & LEADERBOARD                                      */}
      {/* ========================================================================= */}
      {subTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarRankingChart
              title="Most-Played Tracks (Top 5 Leaderboard)"
              subtitle="Real-time highest velocity breakbeat and mastercut anthems"
              items={topSongRankingItems}
              icon={Music}
              barColor="from-brand-purple via-brand-neon to-brand-gold"
            />

            <BarRankingChart
              title="Top Albums & Vault Releases"
              subtitle="Album streaming performance, unique listeners, and full playthroughs"
              items={topAlbumRankingItems}
              icon={Disc3}
              barColor="from-brand-gold via-brand-amber to-brand-purple"
            />
          </div>

          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-brand-gold" />
                  Song Analytics & Track Intelligence Table
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Breakdown of skips, replays, completion rates, listener retention, and purchasing behavior
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400 font-semibold">View Limit:</span>
                <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                  {([10, 25, 50, 100] as const).map((lim) => (
                    <button
                      key={lim}
                      onClick={() => setSongLimit(lim)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        songLimit === lim ? 'bg-brand-gold text-black shadow' : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      Top {lim}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search song title, artist..."
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none"
                >
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g === 'all' ? 'All Genres' : g}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none font-semibold"
                >
                  <option value="plays">Sort by Total Plays</option>
                  <option value="completionRate">Sort by Completion Rate</option>
                  <option value="replays">Sort by Replays</option>
                  <option value="skips">Sort by Skips</option>
                  <option value="rating">Sort by Rating</option>
                  <option value="trendPercent">Sort by Growth Trend</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Track / Artist</th>
                    <th className="py-3 px-3 text-right">Plays</th>
                    <th className="py-3 px-3 text-right">Unique</th>
                    <th className="py-3 px-3 text-right">Completion</th>
                    <th className="py-3 px-3 text-right">Replays</th>
                    <th className="py-3 px-3 text-right">Skips</th>
                    <th className="py-3 px-3 text-right">Rating</th>
                    <th className="py-3 px-3 text-right">Purchases</th>
                    <th className="py-3 px-3 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredSongsAnalytics.map((s, idx) => {
                    const isUp = s.trendPercent > 0;
                    return (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-2 text-neutral-400 font-bold">#{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                              <Image src={s.coverUrl} alt={s.title} fill className="object-cover" />
                            </div>
                            <div className="min-w-0 font-sans">
                              <p className="font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                                {s.title}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {s.artist} • {s.genre} • {s.bpm} BPM
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-white">{s.plays.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-neutral-300">
                          {s.uniqueListeners.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-emerald-400 font-bold">{s.completionRate}%</span>
                        </td>
                        <td className="py-3 px-3 text-right text-purple-300">{s.replays.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-red-300">{s.skips.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-brand-gold font-bold flex items-center justify-end gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          {s.rating.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-300">{s.purchases.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isUp ? '+' : ''}
                            {s.trendPercent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      <ConfirmDeletionModal
        isOpen={Boolean(itemToRemove)}
        item={itemToRemove}
        onClose={() => setItemToRemove(null)}
        onConfirm={handleConfirmRemoval}
      />
    </div>
  );
};
