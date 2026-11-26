'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  History,
  Play,
  Music,
  BookOpen,
  Mic,
  Video as VideoIcon,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { HistoryService, HistoryEntry } from '@/lib/history/HistoryService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { FavoriteButton } from '@/components/social/FavoriteButton';
import { AddToPlaylistButton } from '@/components/playlist/AddToPlaylistButton';
import { VideoThumbnail } from '@/components/media/VideoThumbnail';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export const RecentlyPlayedSection: React.FC = () => {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { playTrack, openVideoModal, playAudiobookChapter } = usePlayer();
  const userId = profile?.id || user?.uid || 'guest';

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'music' | 'audiobook' | 'podcast' | 'video'>('all');

  useEffect(() => {
    const sync = () => {
      setEntries(HistoryService.getMergedHistory(userId));
    };
    sync();
    const unsub = HistoryService.subscribeAll(sync);
    return () => unsub();
  }, [userId]);

  const filteredEntries = useMemo(() => {
    const list = filter === 'all' ? entries : entries.filter((e) => e.mediaType === filter);
    return list.slice(0, 8);
  }, [entries, filter]);

  const handleResumeEntry = (entry: HistoryEntry) => {
    if (entry.mediaType === 'video') {
      const liveVid = MediaCatalogService.getAllVideos().find((v) => v.id === entry.mediaId);
      if (liveVid) {
        openVideoModal(liveVid);
      } else {
        openVideoModal({
          id: entry.mediaId,
          title: entry.title,
          artistId: 'artist-1',
          artistName: entry.subtitle,
          videoUrl: entry.videoUrl || '/videos/FatherTime4K.mp4',
          thumbnailUrl: entry.coverUrl,
          duration: entry.duration,
          views: 0,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
          description: '',
          category: entry.genre || '4K Video',
          releaseDate: '2026-01-01',
        });
      }
      return;
    }

    if (entry.mediaType === 'audiobook') {
      const book = MediaCatalogService.getAllAudiobooks().find((b) => b.id === entry.mediaId);
      if (book && book.chapters?.[0]?.audioUrl) {
        playAudiobookChapter(book, book.chapters[0]);
      } else {
        router.push(entry.href || `/audiobooks/${entry.mediaId}`);
      }
      return;
    }

    if (entry.mediaType === 'podcast') {
      const pod = MediaCatalogService.getAllPodcasts().find((p) => p.id === entry.mediaId);
      if (pod) {
        playTrack({
          id: pod.id,
          title: pod.title,
          artistId: 'podcast-host',
          artistName: `${pod.showTitle} • ${pod.host}`,
          albumTitle: pod.showTitle,
          audioUrl: pod.mediaUrl,
          coverUrl: pod.coverUrl,
          duration: pod.duration,
          genre: pod.category || 'Podcast',
          playCount: pod.playCount,
          likeCount: pod.likeCount,
          dislikeCount: 0,
          commentCount: 0,
        });
        return;
      }
    }

    const trk = MusicCatalogService.getTrackById(entry.mediaId);
    if (trk) {
      playTrack(trk);
    } else if (entry.audioUrl) {
      playTrack({
        id: entry.mediaId,
        title: entry.title,
        artistId: entry.mediaType === 'podcast' ? 'podcast-host' : 'artist-1',
        artistName: entry.subtitle,
        audioUrl: entry.audioUrl,
        coverUrl: entry.coverUrl,
        duration: entry.duration,
        genre: entry.genre || 'Music',
        bpm: entry.bpm,
        playCount: 0,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
      });
    }
  };

  return (
    <section className="glass-panel p-5 sm:p-7 rounded-3xl border border-white/[0.08] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-brand-purple/20 border border-cyan-400/30 flex items-center justify-center">
            <History className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Recently Played
            </h3>
            <p className="text-xs text-neutral-400">
              Jump back into your recent music, audiobooks, podcasts &amp; 4K videos
            </p>
          </div>
        </div>

        <Link
          href="/library?tab=history"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-xs font-bold text-brand-gold transition-all"
        >
          <span>Full History</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Filter Pills */}
      {entries.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Recent', icon: Sparkles },
            { id: 'music', label: 'Music', icon: Music },
            { id: 'audiobook', label: 'Audiobooks', icon: BookOpen },
            { id: 'podcast', label: 'Podcasts', icon: Mic },
            { id: 'video', label: 'Videos', icon: VideoIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  active
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

      {/* Grid or Friendly Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
          <Clock className="w-7 h-7 text-brand-gold/80 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">
              {entries.length === 0 ? 'Nothing played yet in this session' : `No recently played ${filter} yet`}
            </p>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Stream any song, audiobook, podcast, or 4K video and it will appear right here for instant 1-tap resume.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link href="/music" className="px-3.5 py-1.5 rounded-full bg-brand-gold text-black text-xs font-extrabold hover:scale-105 transition-transform">
              Stream Music
            </Link>
            <Link href="/audiobooks" className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
              Audiobooks
            </Link>
            <Link href="/podcasts" className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
              Podcasts
            </Link>
            <Link href="/videos" className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
              4K Videos
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filteredEntries.map((entry) => {
            const typeLabel =
              entry.mediaType === 'video'
                ? 'Video'
                : entry.mediaType === 'audiobook'
                  ? 'Audiobook'
                  : entry.mediaType === 'podcast'
                    ? 'Podcast'
                    : 'Music';

            const badgeColor =
              entry.mediaType === 'video'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : entry.mediaType === 'audiobook'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : entry.mediaType === 'podcast'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-brand-purple/25 text-brand-neon border-brand-purple/40';

            const favCategory =
              entry.mediaType === 'video'
                ? 'videos'
                : entry.mediaType === 'audiobook'
                  ? 'audiobooks'
                  : entry.mediaType === 'podcast'
                    ? 'podcasts'
                    : 'music';

            return (
              <div
                key={entry.id}
                onClick={() => handleResumeEntry(entry)}
                className="group p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-brand-gold/45 transition-all cursor-pointer flex items-center gap-3"
              >
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/50">
                  {entry.mediaType === 'video' && entry.videoUrl ? (
                    <VideoThumbnail
                      videoUrl={entry.videoUrl}
                      thumbnailUrl={entry.coverUrl}
                      alt={entry.title}
                      preferVideoFrame={true}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Image
                      src={entry.coverUrl || '/images/studio_cover.jpg'}
                      alt={entry.title}
                      fill
                      sizes="56px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-5 h-5 text-brand-gold fill-current ml-0.5" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${badgeColor}`}>
                      {typeLabel}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                      {formatRelativeTime(entry.playedAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold truncate transition-colors">
                    {entry.title}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">{entry.subtitle}</p>
                </div>

                <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1.5">
                  <AddToPlaylistButton
                    mediaId={entry.mediaId}
                    mediaType={entry.mediaType}
                    title={entry.title}
                    artistName={entry.subtitle}
                    coverUrl={entry.coverUrl}
                    duration={entry.duration}
                    audioUrl={entry.audioUrl}
                    videoUrl={entry.videoUrl}
                    genre={entry.genre}
                    variant="icon"
                    size="sm"
                  />
                  <FavoriteButton
                    id={entry.mediaId}
                    category={favCategory}
                    title={entry.title}
                    subtitle={entry.subtitle}
                    coverUrl={entry.coverUrl}
                    genre={entry.genre}
                    url={entry.href}
                    variant="icon"
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

