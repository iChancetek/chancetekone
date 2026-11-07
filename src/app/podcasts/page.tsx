'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Mic,
  UploadCloud,
  Play,
  Pause,
  Calendar,
  Clock,
  Sparkles,
  FileVideo,
  FileAudio,
  Share2,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MediaUploadModal } from '@/components/media/MediaUploadModal';
import { PodcastEpisode } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function PodcastsPage() {
  const { playTrack, currentTrack, isPlaying, togglePlay, openVideoModal } = usePlayer();
  const [podcasts, setPodcasts] = useState<PodcastEpisode[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [discussionPodcast, setDiscussionPodcast] = useState<PodcastEpisode | null>(null);
  const [sharePodcast, setSharePodcast] = useState<PodcastEpisode | null>(null);
  const [, setCommentRefresh] = useState(0);

  const syncPodcasts = () => {
    setPodcasts(MediaCatalogService.getAllPodcasts());
  };

  useEffect(() => {
    syncPodcasts();
    const unsub = MediaCatalogService.subscribe(syncPodcasts);
    window.addEventListener('media-catalog-updated', syncPodcasts);

    const unsubComments = SocialCommentService.subscribeAll(() => {
      setCommentRefresh((p) => p + 1);
    });

    return () => {
      unsub();
      unsubComments();
      window.removeEventListener('media-catalog-updated', syncPodcasts);
    };
  }, []);

  const getPodcastCanonicalKey = (ep: PodcastEpisode) => {
    return buildCanonicalContentKey('podcast', ep.title, ep.host);
  };

  const categories = ['all', ...Array.from(new Set(podcasts.map((p) => p.category)))];

  const filteredPodcasts = podcasts.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const handlePlayEpisode = (ep: PodcastEpisode) => {
    const isVideo =
      ep.mediaType === 'video' ||
      ep.mediaUrl.toLowerCase().endsWith('.mp4') ||
      ep.mediaUrl.toLowerCase().endsWith('.mov');

    if (isVideo) {
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
      return;
    }

    if (currentTrack?.id === ep.id) {
      togglePlay();
      return;
    }

    playTrack({
      id: ep.id,
      title: ep.title,
      artistId: 'podcast-host',
      artistName: `${ep.showTitle} • ${ep.host}`,
      albumTitle: ep.showTitle,
      audioUrl: ep.mediaUrl,
      coverUrl: ep.coverUrl,
      duration: ep.duration,
      genre: ep.category,
      playCount: ep.playCount,
      likeCount: ep.likeCount,
      dislikeCount: 0,
      commentCount: 0,
    });
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return `${hours} hr ${remMins} min`;
    }
    return `${mins} min`;
  };

  return (
    <div className="space-y-8 py-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="border-b border-white/5 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider">
            <Mic className="w-3.5 h-3.5" />
            Spoken Radio & Podcasts
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon hover:scale-105 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Podcast (MP3, MP4, .MOV)</span>
            </button>
            <VoiceNarrationButton
              text="Welcome to ChanceTEKone Podcasts. Featuring episodic conversations on Agentic AI, sonic mastering, crate digging history, cultural storytelling, and independent creative sovereignty."
              variant="dual"
            />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Podcasts & Spoken Broadcasts</h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-3xl">
          Original audio and video podcast series celebrating independent voices, beatmaker discussions, technology systems, and cultural dialogue by Chancellor @ ChanceTEK LLC and ChanceTEKone.
        </p>
      </div>

      {/* Featured Episode Spotlight */}
      {podcasts.length > 0 && (
        <section className="glass-panel p-6 rounded-3xl border border-brand-gold/30 bg-gradient-to-r from-[#180e28] via-[#120a1c] to-black shadow-2xl flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-48 h-48 rounded-2xl overflow-hidden border border-brand-gold/40 shrink-0 shadow-2xl bg-neutral-900 group">
            <Image
              src={podcasts[0].coverUrl}
              alt={podcasts[0].title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-brand-gold border border-brand-gold/30">
              FEATURED EPISODE
            </div>
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center gap-2 text-xs text-brand-neon font-mono">
              <span>{podcasts[0].showTitle}</span>
              <span>•</span>
              <span>{podcasts[0].category}</span>
            </div>
            <Link href={`/podcasts/${podcasts[0].id}`} className="group/title block">
              <h2 className="text-2xl font-black text-white leading-tight group-hover/title:text-brand-gold transition-colors flex items-center gap-2">
                <span>{podcasts[0].title}</span>
                <ChevronRight className="w-5 h-5 opacity-0 group-hover/title:opacity-100 transition-opacity text-brand-gold" />
              </h2>
            </Link>
            <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
              {podcasts[0].description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 font-mono pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                {formatDuration(podcasts[0].duration)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {podcasts[0].releaseDate}
              </span>
              <span className="text-neutral-300">Host: {podcasts[0].host}</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handlePlayEpisode(podcasts[0])}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon hover:scale-105 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-xl flex items-center gap-2 cursor-pointer"
              >
                {currentTrack?.id === podcasts[0].id && isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Episode</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play Featured Episode</span>
                  </>
                )}
              </button>

              {/* Emoji Reactions for Featured Spotlight */}
              <ReactionButtons
                contentId={podcasts[0].id}
                contentKey={getPodcastCanonicalKey(podcasts[0])}
                contentType="podcast"
                contentTitle={podcasts[0].title}
                contextLocation="Podcasts Featured Spotlight"
                variant="compact"
                showShare={false}
              />

              {/* Discussion Comments & Threads */}
              {(() => {
                const canonicalKey = getPodcastCanonicalKey(podcasts[0]);
                const count = SocialCommentService.getCommentCount(podcasts[0].id, canonicalKey);
                return (
                  <button
                    type="button"
                    onClick={() => setDiscussionPodcast(podcasts[0])}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-brand-gold/20 border border-white/15 hover:border-brand-gold/40 text-neutral-200 hover:text-brand-gold font-semibold text-xs transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                    title={`${count} Discussion Comments & Threads on ${podcasts[0].title}`}
                  >
                    <MessageSquare className="w-4 h-4 text-brand-gold" />
                    <span className="font-mono font-bold text-brand-gold">{count}</span>
                    <span>Comments & Threads</span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => setSharePodcast(podcasts[0])}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-200 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
                title="Share this episode & text message"
              >
                <Share2 className="w-4 h-4 text-brand-gold" />
                <span>Share Broadcast</span>
              </button>

              <Link
                href={`/podcasts/${podcasts[0].id}`}
                className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <span>Full Episode Hub</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Category Filter and Count */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-400 font-semibold">Category:</span>
          <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === c
                    ? 'bg-brand-gold text-black shadow'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {c === 'all' ? 'All Episodes' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="text-neutral-400 font-mono text-xs">
          Showing <span className="text-white font-bold">{filteredPodcasts.length}</span> Episodes
        </div>
      </div>

      {/* Podcast Episode Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPodcasts.map((ep) => {
          const isCurrent = currentTrack?.id === ep.id && isPlaying;
          const isVideo = ep.mediaType === 'video' || ep.mediaUrl.toLowerCase().endsWith('.mp4');
          const canonicalKey = getPodcastCanonicalKey(ep);
          const commentCount = SocialCommentService.getCommentCount(ep.id, canonicalKey);

          return (
            <div
              key={ep.id}
              className="p-5 rounded-3xl glass-panel border border-white/10 bg-white/5 hover:border-brand-gold/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-neutral-900 group-hover:scale-[1.02] transition-transform">
                  <Image src={ep.coverUrl} alt={ep.title} fill className="object-cover" />

                  {/* Format Badge (Top Right) */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-mono text-brand-gold flex items-center gap-1 border border-white/10">
                    {isVideo ? <FileVideo className="w-3 h-3 text-red-400" /> : <FileAudio className="w-3 h-3 text-brand-gold" />}
                    <span>{isVideo ? 'Video' : 'Audio'}</span>
                  </div>

                  {/* Comment Count Badge (Top Left) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDiscussionPodcast(ep);
                    }}
                    className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-mono text-brand-gold flex items-center gap-1 border border-brand-gold/30 hover:scale-105 transition-transform cursor-pointer shadow-md z-10"
                    title={`${commentCount} Discussion Comments & Threads`}
                  >
                    <MessageSquare className="w-3 h-3 text-brand-gold" />
                    <span className="font-bold">{commentCount}</span>
                  </button>

                  <button
                    onClick={() => handlePlayEpisode(ep)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-brand-gold text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl hover:scale-110 cursor-pointer"
                    title={isCurrent ? 'Pause' : 'Play Episode'}
                  >
                    {isCurrent ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span className="text-brand-neon truncate font-bold">{ep.showTitle}</span>
                    <span>{formatDuration(ep.duration)}</span>
                  </div>
                  <Link href={`/podcasts/${ep.id}`} className="block group/link">
                    <h3 className="font-extrabold text-white text-base leading-snug line-clamp-2 group-hover/link:text-brand-gold transition-colors">
                      {ep.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                    {ep.description}
                  </p>
                </div>
              </div>

              {/* Card Footer: Host, Emojis, Discuss, Play */}
              <div className="space-y-3 border-t border-white/5 pt-3 text-xs">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>
                    Host: <span className="text-neutral-200">{ep.host}</span>
                  </span>
                  <span>{ep.releaseDate}</span>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Emoji Reactions */}
                  <ReactionButtons
                    contentId={ep.id}
                    contentKey={canonicalKey}
                    contentType="podcast"
                    contentTitle={ep.title}
                    contextLocation="Podcast Card Grid"
                    variant="compact"
                    showShare={false}
                  />

                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Discuss Trigger */}
                    <button
                      type="button"
                      onClick={() => setDiscussionPodcast(ep)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title={`${commentCount} Discussion Comments & Threads on ${ep.title}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                      <span className="font-mono font-bold text-[11px]">{commentCount}</span>
                      <span className="hidden sm:inline">Discuss</span>
                    </button>

                    {/* Quick Share Trigger */}
                    <button
                      type="button"
                      onClick={() => setSharePodcast(ep)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      title="Share episode & text message"
                    >
                      <Share2 className="w-3.5 h-3.5 hover:text-brand-gold transition-colors" />
                    </button>

                    {/* Listen / Watch Trigger */}
                    <button
                      onClick={() => handlePlayEpisode(ep)}
                      className="px-3 py-1.5 rounded-xl bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isCurrent ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isCurrent ? 'Playing' : 'Play'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discussion Slide-over Drawer */}
      {discussionPodcast && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionPodcast)}
          onClose={() => setDiscussionPodcast(null)}
          contentId={discussionPodcast.id}
          contentKey={getPodcastCanonicalKey(discussionPodcast)}
          contentType="podcast"
          contentTitle={discussionPodcast.title}
          contentSubtitle={`${discussionPodcast.showTitle} • Host: ${discussionPodcast.host}`}
          coverUrl={discussionPodcast.coverUrl}
          badgeLabel="Podcast Episode"
        />
      )}

      {/* Universal Share Modal */}
      {sharePodcast && (
        <UniversalShareModal
          isOpen={Boolean(sharePodcast)}
          onClose={() => setSharePodcast(null)}
          entity={{
            type: 'podcast',
            item: sharePodcast,
          }}
        />
      )}

      {/* Upload Modal */}
      <MediaUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        mediaType="podcast"
        onSuccess={syncPodcasts}
      />
    </div>
  );
}
