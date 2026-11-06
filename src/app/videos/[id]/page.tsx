'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Video as VideoIcon, Eye, Calendar, ListPlus, MessageSquare, Share2 } from 'lucide-react';
import { MOCK_VIDEOS } from '@/lib/mockData';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { CommentSection } from '@/components/comments/CommentSection';
import { MediaCard } from '@/components/media/MediaCard';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { useAuth } from '@/lib/auth/AuthContext';
import { HistoryService } from '@/lib/history/HistoryService';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function VideoDetailPage() {
  const params = useParams();
  const videoId = params.id as string;
  const { profile } = useAuth();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const video =
    MediaCatalogService.getVideoById(videoId) ||
    MOCK_VIDEOS.find((v) => v.id === videoId) ||
    MOCK_VIDEOS[0];
  const allVideos = MediaCatalogService.getAllVideos();
  const relatedVideos = allVideos.filter((v) => v.id !== video.id);

  useEffect(() => {
    if (profile?.id && video) {
      HistoryService.recordHistory(profile.id, {
        mediaId: video.id,
        mediaType: 'video',
        title: video.title,
        subtitle: video.artistName || video.category || '4K Video',
        coverUrl: video.thumbnailUrl || '/images/logo.png',
        duration: video.duration || 0,
        videoUrl: video.videoUrl,
      });
      AnalyticsEngine.trackEvent({
        eventType: 'VIDEO_STARTED',
        action: `Started 4K Video "${video.title}"`,
        resource: video.title,
        resourceId: video.id,
        platformArea: 'Videos',
        userId: profile.id,
        userName: profile.name,
        userEmail: profile.email,
      });
    }
  }, [profile?.id, video?.id]);

  return (
    <div className="space-y-8 py-6 max-w-6xl mx-auto">
      {/* Video Streaming Viewport */}
      <VideoPlayer video={video} />

      {/* Video Info Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">{video.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            <Link href={`/artists/${video.artistId}`} className="text-brand-gold font-semibold hover:underline">
              {video.artistName}
            </Link>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {video.views.toLocaleString()} views
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {video.releaseDate}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share Video & Text Message"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Video</span>
          </button>

          <button
            onClick={() => setShowPlaylistModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-neon hover:text-white font-semibold text-xs transition-all shadow-md"
          >
            <ListPlus className="w-4 h-4 text-brand-gold" />
            <span>Add to Playlist</span>
          </button>

          {(() => {
            const vidKey = buildCanonicalContentKey('video', video.title, video.artistName);
            const count = SocialCommentService.getCommentCount(video.id, vidKey);
            return (
              <>
                <ReactionButtons
                  contentId={video.id}
                  contentKey={vidKey}
                  contentType="video"
                  contentTitle={`${video.title} (${video.artistName})`}
                  contextLocation="4K Video Cinema Page"
                  initialLikes={video.likeCount}
                  initialDislikes={video.dislikeCount}
                />

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('video-comments-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer shadow-md"
                  title={`${count} Discussion Comments & Threads`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                  <span className="font-mono text-brand-gold font-black">{count}</span>
                  <span className="hidden sm:inline">Threads</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Description & Side Rail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Description & Comments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-white/5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">About this Video</h3>
              <VoiceNarrationButton
                text={`${video.title}. By ${video.artistName}. ${video.description}`}
                variant="dual"
              />
            </div>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">{video.description}</p>
          </div>

          <div id="video-comments-section" className="pt-2">
            <CommentSection
              contentId={video.id}
              contentKey={buildCanonicalContentKey('video', video.title, video.artistName)}
              contentType="video"
              contentTitle={`${video.title} - ${video.artistName}`}
            />
          </div>
        </div>

        {/* Right Column: Related Videos */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Up Next</h3>
          <div className="space-y-4">
            {relatedVideos.map((v) => (
              <MediaCard key={v.id} item={v} type="video" />
            ))}
          </div>
        </div>
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={{
            mediaId: video.id,
            mediaType: 'video',
            title: video.title,
            artistName: video.artistName,
            coverUrl: video.thumbnailUrl,
            duration: video.duration,
          }}
        />
      )}

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'video',
            item: video,
          }}
        />
      )}
    </div>
  );
}
