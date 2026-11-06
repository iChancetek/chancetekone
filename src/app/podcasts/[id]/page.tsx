'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Mic,
  Play,
  Pause,
  Clock,
  Calendar,
  Share2,
  Check,
  ChevronLeft,
  MessageSquare,
  ListPlus,
  FileVideo,
  FileAudio,
  Radio,
  Sparkles,
} from 'lucide-react';
import { MediaCatalogService, SEED_PODCASTS } from '@/lib/media/MediaCatalogService';
import { PodcastEpisode } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { CommentSection } from '@/components/comments/CommentSection';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function PodcastEpisodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const episodeId = params.id as string;
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [podcast, setPodcast] = useState<PodcastEpisode | null>(null);
  const [allPodcasts, setAllPodcasts] = useState<PodcastEpisode[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setCommentRefresh] = useState(0);

  useEffect(() => {
    const list = MediaCatalogService.getAllPodcasts();
    setAllPodcasts(list);
    const found = list.find((p) => p.id === episodeId) || SEED_PODCASTS.find((p) => p.id === episodeId) || list[0] || SEED_PODCASTS[0];
    setPodcast(found);

    const unsubComments = SocialCommentService.subscribeAll(() => {
      setCommentRefresh((p) => p + 1);
    });
    return () => unsubComments();
  }, [episodeId]);

  if (!podcast) {
    return (
      <div className="py-20 text-center space-y-4">
        <Mic className="w-12 h-12 text-brand-gold mx-auto animate-pulse" />
        <h2 className="text-xl font-bold text-white">Loading Podcast Broadcast...</h2>
      </div>
    );
  }

  const canonicalKey = buildCanonicalContentKey('podcast', podcast.title, podcast.host);
  const commentCount = SocialCommentService.getCommentCount(podcast.id, canonicalKey);
  const isVideo = podcast.mediaType === 'video' || podcast.mediaUrl.toLowerCase().endsWith('.mp4') || podcast.mediaUrl.toLowerCase().endsWith('.mov');
  const isCurrentActive = currentTrack?.id === podcast.id;
  const isCurrentPlaying = isCurrentActive && isPlaying;

  const handlePlayToggle = () => {
    if (isCurrentActive) {
      togglePlay();
      return;
    }
    playTrack({
      id: podcast.id,
      title: podcast.title,
      artistId: 'podcast-host',
      artistName: `${podcast.showTitle} • ${podcast.host}`,
      albumTitle: podcast.showTitle,
      audioUrl: podcast.mediaUrl,
      coverUrl: podcast.coverUrl,
      duration: podcast.duration,
      genre: podcast.category,
      playCount: podcast.playCount,
      likeCount: podcast.likeCount,
      dislikeCount: 0,
      commentCount: 0,
    });
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) return `${hours} hr ${remMins} min`;
    return `${mins} min`;
  };

  const relatedEpisodes = allPodcasts.filter((p) => p.id !== podcast.id).slice(0, 3);

  return (
    <div className="space-y-8 py-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-brand-gold" />
          <span>Back to Podcasts</span>
        </button>

        <div className="flex items-center gap-2 text-neutral-400 font-mono text-[11px]">
          <Link href="/podcasts" className="hover:text-brand-gold transition-colors">
            Podcasts
          </Link>
          <span>/</span>
          <span className="text-white font-bold truncate max-w-[200px] sm:max-w-xs">{podcast.showTitle}</span>
        </div>
      </div>

      {/* Hero Media Player Showcase */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-gradient-to-br from-[#180e28]/95 via-[#120a1c]/98 to-black shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Cover Art / Video Viewport */}
          <div className="relative w-full md:w-72 aspect-video md:aspect-square rounded-2xl overflow-hidden border border-brand-gold/40 shrink-0 shadow-2xl bg-neutral-900 group">
            <Image
              src={podcast.coverUrl}
              alt={podcast.title}
              fill
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

            <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-bold text-brand-gold border border-brand-gold/30 flex items-center gap-1">
              <Radio className="w-3 h-3 text-brand-gold animate-pulse" />
              <span>PODCAST BROADCAST</span>
            </div>

            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-mono text-white border border-white/10 flex items-center gap-1">
              {isVideo ? <FileVideo className="w-3 h-3 text-red-400" /> : <FileAudio className="w-3 h-3 text-brand-gold" />}
              <span>{isVideo ? '4K Video' : 'HQ Audio'}</span>
            </div>

            <button
              onClick={handlePlayToggle}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              title={isCurrentPlaying ? 'Pause Broadcast' : 'Play Broadcast'}
            >
              {isCurrentPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>
          </div>

          {/* Episode Info & Meta */}
          <div className="flex-1 space-y-4 min-w-0">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/35 text-brand-gold text-xs font-mono font-bold uppercase tracking-wider">
                <Mic className="w-3.5 h-3.5" />
                <span>{podcast.showTitle}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-1">
                {podcast.title}
              </h1>
              <p className="text-xs text-neutral-400 font-mono">
                Hosted by <span className="text-white font-bold">{podcast.host}</span> • {podcast.category}
              </p>
            </div>

            <p className="text-sm text-neutral-300 leading-relaxed">
              {podcast.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                {formatDuration(podcast.duration)}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {podcast.releaseDate}
              </span>
              <span>{(podcast.playCount || 0).toLocaleString()} Streams</span>
            </div>

            {/* Playback Controls & Voice Narration */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handlePlayToggle}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon hover:scale-105 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-xl flex items-center gap-2 cursor-pointer"
              >
                {isCurrentPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Episode</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play Podcast Episode</span>
                  </>
                )}
              </button>

              <VoiceNarrationButton
                text={`Podcast broadcast: ${podcast.title}. From the show: ${podcast.showTitle}. Hosted by ${podcast.host}. ${podcast.description}`}
                label="Narrate Synopsis"
                variant="pill"
                voice="nova"
              />
            </div>
          </div>
        </div>

        {/* Integrated Video Viewport (if Video Podcast) */}
        {isVideo && (
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold mb-3 flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-red-400" />
              <span>Broadcast Visual Cinema Feed</span>
            </h3>
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl aspect-video max-h-[60vh] mx-auto flex items-center justify-center">
              <video
                src={podcast.mediaUrl}
                controls
                playsInline
                preload="metadata"
                poster={podcast.coverUrl}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Social Reactions, Discussion & Sharing Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Left: Add to Playlist & Share */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowPlaylistModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-neon hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
          >
            <ListPlus className="w-4 h-4 text-brand-gold" />
            <span>Add to Playlist</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share this podcast"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4 text-brand-gold" />}
            <span>{copied ? 'Link Copied!' : 'Share Episode'}</span>
          </button>
        </div>

        {/* Right: Full Emoji Reactions & Threads Button */}
        <div className="flex flex-wrap items-center gap-3">
          <ReactionButtons
            contentId={podcast.id}
            contentKey={canonicalKey}
            contentType="podcast"
            contentTitle={podcast.title}
            contextLocation="Podcast Deep Dive Page"
            initialLikes={podcast.likeCount}
          />

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('podcast-comments-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer shadow-sm"
            title={`${commentCount} Discussion Comments & Threads`}
          >
            <MessageSquare className="w-4 h-4 text-brand-gold" />
            <span className="font-mono text-brand-gold font-black">{commentCount}</span>
            <span>Threads</span>
          </button>
        </div>
      </div>

      {/* Comprehensive Discussion Threads Section */}
      <div id="podcast-comments-section" className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-gold" />
            <h2 className="text-xl font-bold text-white tracking-tight">Episode Discussion & Member Threads</h2>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            <strong className="text-brand-gold">{commentCount}</strong> active comments
          </span>
        </div>

        <CommentSection
          contentId={podcast.id}
          contentKey={canonicalKey}
          contentType="podcast"
          contentTitle={`${podcast.title} (${podcast.showTitle})`}
        />
      </div>

      {/* Related Episodes Rail */}
      {relatedEpisodes.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <span>More Episodes to Explore</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedEpisodes.map((rel) => (
              <Link
                key={rel.id}
                href={`/podcasts/${rel.id}`}
                className="p-4 rounded-2xl glass-panel border border-white/5 hover:border-brand-gold/40 transition-all flex items-center gap-3 group"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-neutral-900">
                  <Image src={rel.coverUrl} alt={rel.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-brand-neon font-mono truncate font-bold">{rel.showTitle}</p>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                    {rel.title}
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    {formatDuration(rel.duration)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add To Playlist Modal */}
      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={{
            mediaId: podcast.id,
            mediaType: 'podcast' as any,
            title: podcast.title,
            artistName: `${podcast.showTitle} • ${podcast.host}`,
            coverUrl: podcast.coverUrl,
            duration: podcast.duration,
          }}
        />
      )}

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'podcast',
            item: podcast,
          }}
        />
      )}
    </div>
  );
}

