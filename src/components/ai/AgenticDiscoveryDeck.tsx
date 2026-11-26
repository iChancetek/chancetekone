'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Music,
  BookOpen,
  Mic,
  Video as VideoIcon,
  Shuffle,
  Radio,
  ArrowUpRight,
} from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { HistoryService, HistoryEntry, resolveHistoryUserId } from '@/lib/history/HistoryService';
import { FavoritesService, FavoriteItem, FavoriteCategory } from '@/lib/favorites/FavoritesService';
import { FavoriteButton } from '@/components/social/FavoriteButton';
import { AddToPlaylistButton } from '@/components/playlist/AddToPlaylistButton';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';
import { Track, Audiobook, PodcastEpisode, Video } from '@/types/media';

export interface AgenticDiscoveryDeckProps {
  mode: 'all' | 'music' | 'audiobook' | 'podcast';
  title?: string;
  subtitle?: string;
  className?: string;
}

interface UnifiedRecItem {
  id: string;
  mediaType: 'music' | 'audiobook' | 'podcast' | 'video';
  favoriteCategory: FavoriteCategory;
  title: string;
  subtitle: string;
  coverUrl: string;
  genre: string;
  reason: string;
  badge: string;
  href: string;
  score: number;
  raw: Track | Audiobook | PodcastEpisode | Video;
}

function tokenize(text?: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export const AgenticDiscoveryDeck: React.FC<AgenticDiscoveryDeckProps> = ({
  mode,
  title,
  subtitle,
  className = '',
}) => {
  const {
    currentTrack,
    currentAudiobook,
    isPlaying,
    playTrack,
    playRandom,
    togglePlay,
    openVideoModal,
    playAudiobookChapter,
  } = usePlayer();
  const { profile, user, isAdmin } = useAuth();
  const userId = resolveHistoryUserId(profile, user, isAdmin);
  const secondaryUserId = user?.uid && user.uid !== userId ? user.uid : undefined;

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [catalogTick, setCatalogTick] = useState(0);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'music' | 'audiobook' | 'podcast' | 'video'>('all');

  useEffect(() => {
    const syncHistory = () => setHistory(HistoryService.getMergedHistory(userId, secondaryUserId));
    const syncFavs = () => setFavorites(FavoritesService.getMergedFavorites(userId));
    const syncCatalog = () => setCatalogTick((t) => t + 1);

    syncHistory();
    syncFavs();

    const unsubHist = HistoryService.subscribeAll(syncHistory);
    const unsubFavs = FavoritesService.subscribeAll(syncFavs);
    const unsubMusic = MusicCatalogService.subscribe(syncCatalog);
    const unsubMedia = MediaCatalogService.subscribe(syncCatalog);

    window.addEventListener('history-updated', syncHistory);
    window.addEventListener('catalog-updated', syncCatalog);
    window.addEventListener('media-catalog-updated', syncCatalog);

    return () => {
      unsubHist();
      unsubFavs();
      unsubMusic();
      unsubMedia();
      window.removeEventListener('history-updated', syncHistory);
      window.removeEventListener('catalog-updated', syncCatalog);
      window.removeEventListener('media-catalog-updated', syncCatalog);
    };
  }, [userId, secondaryUserId]);

  // Build real-time listener taste profile from active playback, streaming history & favorites
  const tasteProfile = useMemo(() => {
    const genreWeights = new Map<string, number>();
    const creatorWeights = new Map<string, number>();
    const keywordWeights = new Map<string, number>();
    const playedIds = new Set<string>();
    const bpmSamples: number[] = [];

    const addWeight = (map: Map<string, number>, key?: string, weight = 1) => {
      if (!key) return;
      const norm = key.toLowerCase().trim();
      if (!norm) return;
      map.set(norm, (map.get(norm) || 0) + weight);
    };

    // 1. Live active stream (highest weight)
    if (currentTrack) {
      playedIds.add(currentTrack.id);
      addWeight(genreWeights, currentTrack.genre, 6);
      addWeight(creatorWeights, currentTrack.artistName, 5);
      tokenize(currentTrack.title).forEach((w) => addWeight(keywordWeights, w, 2));
      if (currentTrack.bpm) bpmSamples.push(currentTrack.bpm);
    }
    if (currentAudiobook) {
      playedIds.add(currentAudiobook.id);
      addWeight(genreWeights, (currentAudiobook as any).category || (currentAudiobook as any).genre || 'Audiobook', 6);
      addWeight(creatorWeights, currentAudiobook.author, 5);
      tokenize(`${currentAudiobook.title} ${currentAudiobook.description}`).forEach((w) =>
        addWeight(keywordWeights, w, 2)
      );
    }

    // 2. Streaming history (decaying recency weight)
    history.slice(0, 25).forEach((entry, idx) => {
      playedIds.add(entry.mediaId);
      const decay = Math.max(1, 4 - Math.floor(idx / 6));
      addWeight(genreWeights, entry.genre, decay * 1.5);
      addWeight(creatorWeights, entry.artistName || entry.subtitle, decay * 1.2);
      tokenize(`${entry.title} ${entry.subtitle}`).forEach((w) => addWeight(keywordWeights, w, 1));
      if (entry.bpm) bpmSamples.push(entry.bpm);
    });

    // 3. Favorites (strong enduring affinity)
    favorites.slice(0, 30).forEach((fav) => {
      addWeight(genreWeights, fav.metadata?.genre, 3);
      addWeight(creatorWeights, fav.metadata?.artistName || fav.metadata?.subtitle, 3);
      tokenize(fav.metadata?.title).forEach((w) => addWeight(keywordWeights, w, 1.5));
    });

    const avgBpm =
      bpmSamples.length > 0 ? Math.round(bpmSamples.reduce((a, b) => a + b, 0) / bpmSamples.length) : 104;

    const topGenres = Array.from(genreWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    const topCreators = Array.from(creatorWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    return {
      genreWeights,
      creatorWeights,
      keywordWeights,
      playedIds,
      avgBpm,
      topGenres,
      topCreators,
      signalCount: history.length + favorites.length + (currentTrack ? 1 : 0),
    };
  }, [currentTrack, currentAudiobook, history, favorites]);

  const recommendations = useMemo<UnifiedRecItem[]>(() => {
    void catalogTick;
    const results: UnifiedRecItem[] = [];
    const jitter = (id: string) => {
      if (refreshSeed === 0) return 0;
      let h = refreshSeed * 31;
      for (let i = 0; i < id.length; i++) {
        h = (h * 37 + id.charCodeAt(i)) % 997;
      }
      return (h % 100) / 14;
    };

    const scoreSignals = (
      id: string,
      genre?: string,
      creator?: string,
      text?: string,
      bpm?: number,
      fallbackReason = 'New Discovery For You'
    ) => {
      let score = 1 + jitter(id);
      const reasons: string[] = [];

      const gNorm = (genre || '').toLowerCase().trim();
      const cNorm = (creator || '').toLowerCase().trim();

      const gScore = gNorm ? tasteProfile.genreWeights.get(gNorm) || 0 : 0;
      if (gScore > 0) {
        score += gScore * 2.4;
        reasons.push(`Similar ${genre} vibe`);
      }

      const cScore = cNorm ? tasteProfile.creatorWeights.get(cNorm) || 0 : 0;
      if (cScore > 0) {
        score += cScore * 2.8;
        reasons.push(`More like ${creator}`);
      }

      if (bpm && tasteProfile.signalCount > 0) {
        const diff = Math.abs(bpm - tasteProfile.avgBpm);
        if (diff <= 10) {
          score += 5 - diff * 0.3;
          reasons.push(`${bpm} BPM match`);
        }
      }

      const words = tokenize(text);
      let kwHits = 0;
      words.forEach((w) => {
        const wWeight = tasteProfile.keywordWeights.get(w);
        if (wWeight) kwHits += wWeight;
      });
      if (kwHits > 0) {
        score += Math.min(6, kwHits * 0.8);
      }

      const isNewToUser = !tasteProfile.playedIds.has(id);
      if (isNewToUser) {
        score += 3.5;
      }

      const reason =
        reasons.length > 0
          ? isNewToUser
            ? `${reasons[0]} · New to you`
            : reasons[0]
          : isNewToUser
            ? fallbackReason
            : 'In Your Rotation';

      return { score, reason, isNewToUser };
    };

    // Music tracks
    if (mode === 'all' || mode === 'music') {
      const tracks = MusicCatalogService.getAllTracks().filter((t) => t.id !== currentTrack?.id);
      const scoredTracks = tracks.map((t) => {
        const { score, reason, isNewToUser } = scoreSignals(
          t.id,
          t.genre,
          t.artistName,
          `${t.title} ${t.albumTitle || ''}`,
          t.bpm,
          'Fresh Music Pick'
        );
        return {
          id: t.id,
          mediaType: 'music' as const,
          favoriteCategory: 'music' as FavoriteCategory,
          title: t.title,
          subtitle: t.artistName,
          coverUrl: MusicCatalogService.resolveTrackCover(t),
          genre: t.genre || 'Music',
          reason,
          badge: isNewToUser ? 'New For You' : 'Similar Sound',
          href: `/music/${t.id}`,
          score,
          raw: t,
        };
      });
      scoredTracks.sort((a, b) => b.score - a.score);
      results.push(...scoredTracks.slice(0, mode === 'music' ? 8 : 4));
    }

    // Audiobooks
    if (mode === 'all' || mode === 'audiobook') {
      const books = MediaCatalogService.getAllAudiobooks().filter((b) => b.id !== currentAudiobook?.id);
      const scoredBooks = books.map((b) => {
        const bookGenre = (b as any).category || (b as any).genre || 'Audiobook';
        const { score, reason, isNewToUser } = scoreSignals(
          b.id,
          bookGenre,
          b.author,
          `${b.title} ${b.description}`,
          undefined,
          'Recommended Listen'
        );
        return {
          id: b.id,
          mediaType: 'audiobook' as const,
          favoriteCategory: 'audiobooks' as FavoriteCategory,
          title: b.title,
          subtitle: `By ${b.author}`,
          coverUrl: b.coverUrl || '/images/studio_cover.jpg',
          genre: bookGenre,
          reason,
          badge: isNewToUser ? 'New Story' : 'Similar Topic',
          href: `/audiobooks/${b.id}`,
          score,
          raw: b,
        };
      });
      scoredBooks.sort((a, b) => b.score - a.score);
      results.push(...scoredBooks.slice(0, mode === 'audiobook' ? 6 : 2));
    }

    // Podcasts
    if (mode === 'all' || mode === 'podcast') {
      const pods = MediaCatalogService.getAllPodcasts().filter((p) => p.id !== currentTrack?.id);
      const scoredPods = pods.map((p) => {
        const { score, reason, isNewToUser } = scoreSignals(
          p.id,
          p.category,
          p.host,
          `${p.title} ${p.showTitle} ${p.description}`,
          undefined,
          'Trending Broadcast'
        );
        return {
          id: p.id,
          mediaType: 'podcast' as const,
          favoriteCategory: 'podcasts' as FavoriteCategory,
          title: p.title,
          subtitle: `${p.showTitle} • ${p.host}`,
          coverUrl: p.coverUrl || '/images/studio_cover.jpg',
          genre: p.category || 'Podcast',
          reason,
          badge: isNewToUser ? 'Fresh Episode' : 'Similar Show',
          href: `/podcasts/${p.id}`,
          score,
          raw: p,
        };
      });
      scoredPods.sort((a, b) => b.score - a.score);
      results.push(...scoredPods.slice(0, mode === 'podcast' ? 6 : 2));
    }

    // Videos (Home cross-media discovery)
    if (mode === 'all') {
      const vids = MediaCatalogService.getAllVideos();
      const scoredVids = vids.map((v) => {
        const { score, reason, isNewToUser } = scoreSignals(
          v.id,
          v.category,
          v.artistName,
          `${v.title} ${v.description}`,
          undefined,
          '4K Cinema Pick'
        );
        return {
          id: v.id,
          mediaType: 'video' as const,
          favoriteCategory: 'videos' as FavoriteCategory,
          title: v.title,
          subtitle: v.artistName,
          coverUrl: v.thumbnailUrl || '/images/studio_cover.jpg',
          genre: v.category || '4K Video',
          reason,
          badge: isNewToUser ? 'Watch Next' : 'Similar Visual',
          href: `/videos/${v.id}`,
          score,
          raw: v,
        };
      });
      scoredVids.sort((a, b) => b.score - a.score);
      results.push(...scoredVids.slice(0, 2));
    }

    return results;
  }, [mode, catalogTick, refreshSeed, currentTrack?.id, currentAudiobook?.id, tasteProfile]);

  const visibleItems = useMemo(() => {
    if (mode !== 'all' || activeFilter === 'all') return recommendations;
    return recommendations.filter((r) => r.mediaType === activeFilter);
  }, [mode, activeFilter, recommendations]);

  const handlePlayItem = (item: UnifiedRecItem) => {
    if (item.mediaType === 'music') {
      const track = item.raw as Track;
      if (currentTrack?.id === track.id) {
        togglePlay();
      } else {
        const recTracks = recommendations
          .filter((r) => r.mediaType === 'music')
          .map((r) => r.raw as Track);
        playTrack(track, recTracks);
      }
      return;
    }

    if (item.mediaType === 'video') {
      openVideoModal(item.raw as Video);
      return;
    }

    if (item.mediaType === 'audiobook') {
      const book = item.raw as Audiobook;
      if (book.chapters && book.chapters.length > 0 && book.chapters[0].audioUrl) {
        playAudiobookChapter(book, book.chapters[0]);
      }
      return;
    }

    if (item.mediaType === 'podcast') {
      const ep = item.raw as PodcastEpisode;
      const isVid =
        ep.mediaType === 'video' ||
        ep.mediaUrl.toLowerCase().endsWith('.mp4') ||
        ep.mediaUrl.toLowerCase().endsWith('.mov');
      if (isVid) {
        openVideoModal({
          id: ep.id,
          title: ep.title,
          artistId: 'podcast-creator',
          artistName: ep.host,
          videoUrl: ep.mediaUrl,
          thumbnailUrl: ep.coverUrl,
          duration: ep.duration,
          views: ep.playCount,
          likeCount: ep.likeCount,
          dislikeCount: 0,
          commentCount: 0,
          description: ep.description,
          category: ep.category,
          releaseDate: ep.releaseDate,
        });
      } else {
        playTrack({
          id: ep.id,
          title: ep.title,
          artistId: 'podcast-host',
          artistName: `${ep.showTitle} • ${ep.host}`,
          albumTitle: ep.showTitle,
          audioUrl: ep.mediaUrl,
          coverUrl: ep.coverUrl,
          duration: ep.duration,
          genre: ep.category || 'Podcast',
          playCount: ep.playCount,
          likeCount: ep.likeCount,
          dislikeCount: 0,
          commentCount: 0,
        });
      }
    }
  };

  if (recommendations.length === 0) return null;

  const defaultHeading =
    mode === 'music'
      ? 'ChanceTEK One Music Companion'
      : mode === 'audiobook'
        ? 'ChanceTEK One Audiobook Guide'
        : mode === 'podcast'
          ? 'ChanceTEK One Podcast Scout'
          : 'ChanceTEK One — Recommended For You';

  const defaultSubheading =
    currentTrack && isPlaying
      ? `Actively tracking "${currentTrack.title}" by ${currentTrack.artistName} to surface similar & fresh picks`
      : tasteProfile.signalCount > 0
        ? `Learning from your ${history.length} recent streams & ${favorites.length} favorites to recommend new & similar content`
        : 'Autonomous AI discovery engine ready to learn your taste as you stream';

  const musicRecsOnly = recommendations.filter((r) => r.mediaType === 'music').map((r) => r.raw as Track);

  return (
    <section
      className={`specular-edge relative overflow-hidden glass-panel rounded-3xl p-5 sm:p-7 border border-brand-purple/35 bg-gradient-to-br from-[#160f2b]/92 via-[#0d0a1a]/92 to-[#090812]/95 shadow-2xl space-y-5 ${className}`}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-purple/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-brand-gold/10 blur-[90px]" />

      {/* Header */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-purple via-violet-600 to-brand-gold flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(157,78,221,0.45)] border border-white/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                <span>Live ChanceTEK One</span>
              </span>
              {currentTrack && isPlaying && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span className="truncate max-w-[180px]">Tracking: {currentTrack.title}</span>
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              {title || defaultHeading}
            </h2>
            <p className="text-xs text-neutral-300/90 leading-relaxed max-w-2xl">
              {subtitle || defaultSubheading}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {musicRecsOnly.length > 1 && (mode === 'music' || mode === 'all') && (
            <button
              type="button"
              onClick={() => playRandom(musicRecsOnly)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-gold hover:bg-amber-400 text-black text-xs font-extrabold uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
              title="Play AI Recommended Songs in Random Order"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Play Random Mix</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setRefreshSeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-neutral-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
            title="Generate fresh ChanceTEK One suggestions"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-gold" />
            <span>Refresh Picks</span>
          </button>
        </div>
      </div>

      {/* Mode Filter Tabs for Home (all) */}
      {mode === 'all' && (
        <div className="relative z-10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Recommendations', icon: Sparkles },
            { id: 'music', label: 'Music', icon: Music },
            { id: 'audiobook', label: 'Audiobooks', icon: BookOpen },
            { id: 'podcast', label: 'Podcasts', icon: Mic },
            { id: 'video', label: '4K Videos', icon: VideoIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${active
                    ? 'bg-brand-gold text-black border-brand-gold shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Recommendations Grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {visibleItems.map((item) => {
          const isActivePlaying = currentTrack?.id === item.id && isPlaying;
          const TypeIcon =
            item.mediaType === 'music'
              ? Music
              : item.mediaType === 'audiobook'
                ? BookOpen
                : item.mediaType === 'podcast'
                  ? Mic
                  : VideoIcon;

          return (
            <div
              key={`${item.mediaType}-${item.id}`}
              className="group relative rounded-2xl p-3.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-brand-gold/50 transition-all duration-200 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div
                  onClick={() => handlePlayItem(item)}
                  className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black/50 cursor-pointer"
                >
                  {item.mediaType === 'video' ? (
                    <VideoThumbnail
                      videoUrl={(item.raw as Video).videoUrl}
                      thumbnailUrl={item.coverUrl}
                      alt={item.title}
                      preferVideoFrame={true}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Image
                      src={item.coverUrl || '/images/studio_cover.jpg'}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {isActivePlaying ? (
                      <Pause className="w-5 h-5 text-brand-gold fill-current" />
                    ) : (
                      <Play className="w-5 h-5 text-brand-gold fill-current ml-0.5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple/25 border border-brand-purple/40 text-brand-neon text-[9px] font-extrabold uppercase tracking-wider">
                      <TypeIcon className="w-2.5 h-2.5" />
                      <span>{item.badge}</span>
                    </span>
                  </div>
                  <Link
                    href={item.href}
                    className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold truncate block transition-colors"
                    title={item.title}
                  >
                    {item.title}
                  </Link>
                  <p className="text-[11px] text-neutral-400 truncate">{item.subtitle}</p>
                </div>
              </div>

              {/* AI Reasoning & Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                <span className="text-[10px] text-brand-gold/90 font-semibold truncate flex items-center gap-1">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.reason}</span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <AddToPlaylistButton
                    mediaId={item.id}
                    mediaType={item.mediaType}
                    title={item.title}
                    artistName={item.subtitle}
                    coverUrl={item.coverUrl}
                    duration={(item.raw as any)?.duration}
                    audioUrl={
                      item.mediaType === 'music'
                        ? (item.raw as Track).audioUrl
                        : item.mediaType === 'podcast'
                          ? (item.raw as PodcastEpisode).mediaUrl
                          : item.mediaType === 'audiobook'
                            ? (item.raw as Audiobook).chapters?.[0]?.audioUrl
                            : undefined
                    }
                    videoUrl={
                      item.mediaType === 'video'
                        ? (item.raw as Video).videoUrl
                        : item.mediaType === 'podcast' && (item.raw as PodcastEpisode).mediaType === 'video'
                          ? (item.raw as PodcastEpisode).mediaUrl
                          : undefined
                    }
                    genre={item.genre}
                    variant="icon"
                    size="sm"
                  />
                  <FavoriteButton
                    id={item.id}
                    category={item.favoriteCategory}
                    title={item.title}
                    subtitle={item.subtitle}
                    coverUrl={item.coverUrl}
                    genre={item.genre}
                    url={item.href}
                    variant="icon"
                    size="sm"
                  />
                  {item.mediaType === 'audiobook' ? (
                    <Link
                      href={item.href}
                      className="w-8 h-8 rounded-full bg-brand-gold text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md"
                      title="Open Audiobook"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlayItem(item)}
                      className="w-8 h-8 rounded-full bg-brand-gold text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md cursor-pointer"
                      title={isActivePlaying ? 'Pause' : 'Play'}
                    >
                      {isActivePlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
