'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { VideoAnalyticsRecord, AudiobookAnalyticsRecord } from '@/types/analytics';
import { Video as VideoItem, Audiobook, PodcastEpisode } from '@/types/media';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { useAuth } from '@/lib/auth/AuthContext';
import { BarRankingChart, RankingItem } from '../charts/BarRankingChart';
import { ConfirmDeletionModal, DeletableItem } from '../modals/ConfirmDeletionModal';
import { MediaUploadModal } from '@/components/media/MediaUploadModal';
import {
  Video,
  BookOpen,
  Mic,
  Play,
  Eye,
  CheckCircle2,
  Clock,
  Star,
  Flame,
  ArrowUpRight,
  Headphones,
  Volume2,
  Trash2,
  Search,
  Sliders,
  AlertTriangle,
  UploadCloud,
  ArrowRight,
  Plus,
  ExternalLink,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

interface VideoAudiobookSectionProps {
  videos: VideoAnalyticsRecord[];
  audiobooks: AudiobookAnalyticsRecord[];
  initialSubTab?: 'videos' | 'audiobooks' | 'podcasts' | 'analytics';
}

export const VideoAudiobookSection: React.FC<VideoAudiobookSectionProps> = ({
  videos,
  audiobooks,
  initialSubTab = 'videos',
}) => {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState<'videos' | 'audiobooks' | 'podcasts' | 'analytics'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Media Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadMediaType, setUploadMediaType] = useState<'audiobook' | 'video' | 'podcast'>('audiobook');

  const handleOpenUpload = (type: 'audiobook' | 'video' | 'podcast') => {
    setUploadMediaType(type);
    setIsUploadModalOpen(true);
  };

  // Live media items
  const [liveVideos, setLiveVideos] = useState<VideoItem[]>([]);
  const [liveAudiobooks, setLiveAudiobooks] = useState<Audiobook[]>([]);
  const [livePodcasts, setLivePodcasts] = useState<PodcastEpisode[]>([]);

  // Search
  const [videoSearch, setVideoSearch] = useState('');
  const [audiobookSearch, setAudiobookSearch] = useState('');
  const [podcastSearch, setPodcastSearch] = useState('');

  // Deletion modal
  const [itemToDelete, setItemToDelete] = useState<DeletableItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const syncMedia = () => {
    setLiveVideos(MediaCatalogService.getAllVideos());
    setLiveAudiobooks(MediaCatalogService.getAllAudiobooks());
    setLivePodcasts(MediaCatalogService.getAllPodcasts());
  };

  useEffect(() => {
    syncMedia();
    const unsub = MediaCatalogService.subscribe(syncMedia);
    window.addEventListener('media-catalog-updated', syncMedia);
    return () => {
      unsub();
      window.removeEventListener('media-catalog-updated', syncMedia);
    };
  }, []);

  const handleConfirmDeletion = (reason: string) => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@8ofspadesworks.com',
      role: 'admin',
    };

    try {
      if (itemToDelete.type === 'video') {
        MediaCatalogService.removeVideo(itemToDelete.id, adminActor, reason);
        setFeedbackMessage(`4K video "${itemToDelete.title}" deleted from platform.`);
      } else if (itemToDelete.type === 'audiobook') {
        MediaCatalogService.removeAudiobook(itemToDelete.id, adminActor, reason);
        setFeedbackMessage(`Audiobook "${itemToDelete.title}" deleted from platform.`);
      } else if (itemToDelete.type === 'podcast') {
        MediaCatalogService.removePodcast(itemToDelete.id, adminActor, reason);
        setFeedbackMessage(`Podcast episode "${itemToDelete.title}" deleted from platform.`);
      }

      syncMedia();
      setItemToDelete(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (e) {
      console.error('Error deleting media:', e);
      setFeedbackMessage('Failed to delete media item.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered live items
  const filteredVideos = liveVideos.filter((v) => {
    const q = videoSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      v.title.toLowerCase().includes(q) ||
      (v.artistName || '').toLowerCase().includes(q) ||
      (v.category || '').toLowerCase().includes(q)
    );
  });

  const filteredAudiobooks = liveAudiobooks.filter((b) => {
    const q = audiobookSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.narrator.toLowerCase().includes(q)
    );
  });

  const filteredPodcasts = livePodcasts.filter((p) => {
    const q = podcastSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.showTitle.toLowerCase().includes(q) ||
      p.host.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  // Ranking data for analytics
  const topVideoRankingItems: RankingItem[] = videos.map((v, idx) => ({
    id: v.id,
    rank: idx + 1,
    title: v.title,
    subtitle: `${v.artist} • ${v.category}`,
    coverUrl: v.thumbnailUrl,
    value: v.views,
    displayValue: v.views >= 1000 ? `${(v.views / 1000).toFixed(1)}k views` : `${v.views} views`,
    trendPercent: v.trendPercent,
    secondaryMetric: `${v.completionRate}% completion`,
  }));

  const topAudiobookRankingItems: RankingItem[] = audiobooks.map((b, idx) => ({
    id: b.id,
    rank: idx + 1,
    title: b.title,
    subtitle: `By ${b.author} • Narrated by ${b.narrator}`,
    coverUrl: b.coverUrl,
    value: b.listeningHours,
    displayValue: `${b.listeningHours.toLocaleString()} hrs`,
    trendPercent: b.trendPercent,
    secondaryMetric: `${b.completionRate}% completion`,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{feedbackMessage}</p>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs uppercase font-mono font-bold text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subtab Navigation Pills */}
      <div className="p-2 rounded-2xl glass-panel border border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubTab('videos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'videos'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Live 4K Videos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveVideos.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('audiobooks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'audiobooks'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Live Audiobooks</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {liveAudiobooks.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('podcasts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'podcasts'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Live Podcasts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
              {livePodcasts.length}
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenUpload('audiobook')}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95"
            title="Upload audiobook or book (MP3, MP4, .MOV) to /audiobooks area"
          >
            <Plus className="w-3.5 h-3.5" />
            <BookOpen className="w-3.5 h-3.5" />
            <span>Upload Audiobook & Book</span>
          </button>

          <button
            onClick={() => handleOpenUpload('video')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/30 hover:scale-105 active:scale-95"
            title="Upload 4K cinema or music video (MP3, MP4, .MOV)"
          >
            <Plus className="w-3.5 h-3.5" />
            <Video className="w-3.5 h-3.5" />
            <span>Upload 4K Video</span>
          </button>

          <button
            onClick={() => handleOpenUpload('podcast')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-amber-600/30 hover:scale-105 active:scale-95"
            title="Upload podcast episode"
          >
            <Plus className="w-3.5 h-3.5" />
            <Mic className="w-3.5 h-3.5" />
            <span>Upload Podcast</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LIVE 4K VIDEOS MANAGEMENT                                              */}
      {/* ========================================================================= */}
      {subTab === 'videos' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-rose-400" />
                Live 4K Cinema Videos Roster & Deletion Console
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage all visual cinema films, documentaries, music videos, and video productions (MP3, MP4, .MOV) live on the platform.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search live video, artist..."
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-rose-400 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenUpload('video')}
                className="shrink-0 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/30"
                title="Upload video in MP3, MP4, or .mov format"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Video (MP3/MP4/.MOV)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-rose-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shrink-0 flex items-center justify-center">
                  {video.thumbnailUrl ? (
                    <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/80">
                      <Video className="w-8 h-8 text-neutral-600 mb-1" />
                      <span className="text-[10px] text-neutral-400 font-mono">Cinema Master</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                  </span>
                </div>

                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm truncate group-hover:text-rose-300 transition-colors">
                    {video.title}
                  </h4>
                  <p className="text-xs text-neutral-300 truncate">{video.artistName}</p>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    {video.category} • {(video.views || 0).toLocaleString()} Views
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>

                  <button
                    onClick={() =>
                      setItemToDelete({
                        id: video.id,
                        type: 'video',
                        title: video.title,
                        subtitle: `${video.artistName} • ${video.category}`,
                        coverUrl: video.thumbnailUrl,
                        meta: `4K Cinema • ${Math.floor(video.duration / 60)} mins`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete video from platform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Video</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE AUDIOBOOKS & LITERATURE MANAGEMENT                                */}
      {/* ========================================================================= */}
      {subTab === 'audiobooks' && (
        <div className="space-y-6">
          {/* Executive Audiobooks & Literature Ingestion Deck */}
          <div className="relative overflow-hidden p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-blue-950/40 via-neutral-900/60 to-black/80 border border-blue-500/30 backdrop-blur-xl shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-mono font-bold">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>AUDIOBOOKS & BOOKS INGESTION PORTAL</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Spoken Literature, Novels & Cultural Odysseys
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Directly ingest audiobooks, autobiographies, literary works, and chapter series in{' '}
                  <strong className="text-brand-gold">MP3, MP4, or .MOV</strong> format to the public{' '}
                  <span className="text-blue-400 font-semibold">/audiobooks</span> theater. Multi-part audio chapters, narrator credits, and jacket artwork are instantly persisted and synchronized platform-wide.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] font-mono text-neutral-400">
                  <span className="flex items-center gap-1.5 text-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Live in Catalog: <strong className="text-white">{liveAudiobooks.length} Audiobooks</strong>
                  </span>
                  <span>•</span>
                  <span>Indexed Chapters: <strong className="text-white">{liveAudiobooks.reduce((acc, b) => acc + (b.chapters?.length || 0), 0)} chapters</strong></span>
                  <span>•</span>
                  <span>Supported Formats: <strong className="text-brand-gold">MP3, MP4, .MOV</strong></span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">100% Ingestion Pipeline Active</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                <button
                  onClick={() => handleOpenUpload('audiobook')}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  title="Upload audiobook or book (MP3, MP4, .MOV)"
                >
                  <Plus className="w-4 h-4" />
                  <BookOpen className="w-4 h-4" />
                  <span>Upload Audiobook & Book (MP3/MP4/.MOV)</span>
                </button>

                <a
                  href="/audiobooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <span>Open Public /audiobooks Area</span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                </a>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Live Audiobooks Roster & Deletion Console
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Manage all narrated literary works, chapter series, and culture odysseys live on the platform.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search live audiobook, author..."
                    value={audiobookSearch}
                    onChange={(e) => setAudiobookSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => handleOpenUpload('audiobook')}
                  className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
                  title="Upload audiobook or PDF book (MP3, MP4, .MOV, .PDF)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Audiobook & PDF Book (.MP3, .MP4, .MOV, .PDF)</span>
                </button>
              </div>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAudiobooks.map((ab) => (
              <div
                key={ab.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shrink-0 flex items-center justify-center">
                    {ab.coverUrl ? (
                      <Image src={ab.coverUrl} alt={ab.title} fill className="object-cover" />
                    ) : ab.pdfUrl || ab.chapters?.[0]?.audioUrl?.endsWith('.pdf') ? (
                      <FileText className="w-7 h-7 text-rose-400" />
                    ) : (
                      <BookOpen className="w-7 h-7 text-brand-gold" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-blue-300 transition-colors">
                      {ab.title}
                    </h4>
                    <p className="text-xs text-neutral-300 truncate">Author: {ab.author}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      Narrator: {ab.narrator} • {ab.chapters?.length || 0} Chapters
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 line-clamp-2">{ab.description}</p>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Rating: <span className="text-brand-gold font-bold">★ {ab.rating || 5.0}</span>
                  </span>

                  <button
                    onClick={() =>
                      setItemToDelete({
                        id: ab.id,
                        type: 'audiobook',
                        title: ab.title,
                        subtitle: `By ${ab.author} • Narrated by ${ab.narrator}`,
                        coverUrl: ab.coverUrl,
                        meta: `${ab.chapters?.length || 0} Chapters • ${Math.round(ab.duration / 3600)} hrs`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete audiobook from platform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Audiobook</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LIVE PODCASTS MANAGEMENT                                               */}
      {/* ========================================================================= */}
      {subTab === 'podcasts' && (
        <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-amber-400" />
                Live Podcasts Roster & Deletion Console
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage episodic podcasts, host interview discussions, and talk series live on the platform.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search live podcast episode, host..."
                  value={podcastSearch}
                  onChange={(e) => setPodcastSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleOpenUpload('podcast')}
                className="shrink-0 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Podcast</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPodcasts.map((pod) => (
              <div
                key={pod.id}
                className="p-4 rounded-2xl glass-panel border border-white/10 bg-white/5 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shrink-0">
                    <Image src={pod.coverUrl} alt={pod.title} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-sm truncate group-hover:text-amber-300 transition-colors">
                      {pod.title}
                    </h4>
                    <p className="text-xs text-brand-gold truncate">{pod.showTitle}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      Host: {pod.host} • {Math.floor((pod.duration || 0) / 60)} mins
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 line-clamp-2">{pod.description}</p>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-300">
                      {pod.category} • {(pod.playCount || 0).toLocaleString()} Plays
                    </span>
                    {(() => {
                      const count = SocialCommentService.getCommentCount(
                        pod.id,
                        buildCanonicalContentKey('podcast', pod.title, pod.host)
                      );
                      return (
                        <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-brand-gold text-[10px] font-mono font-bold border border-brand-gold/30 flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5 text-brand-gold" />
                          <span>{count}</span>
                        </span>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() =>
                      setItemToDelete({
                        id: pod.id,
                        type: 'podcast',
                        title: pod.title,
                        subtitle: `${pod.showTitle} • Host: ${pod.host}`,
                        coverUrl: pod.coverUrl,
                        meta: `${pod.category} • ${Math.floor(pod.duration / 60)} mins`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    title="Delete podcast from platform"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Podcast</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STREAMING ANALYTICS & LEADERBOARDS                                      */}
      {/* ========================================================================= */}
      {subTab === 'analytics' && (
        <div className="space-y-8">
          {/* Visual Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarRankingChart
              title="Most Popular 4K Music Videos"
              subtitle="Total views, average watch retention, and trending video sequences"
              items={topVideoRankingItems}
              icon={Video}
              barColor="from-red-500 via-rose-500 to-amber-500"
            />

            <BarRankingChart
              title="Audiobook & Audio Drama Engagement"
              subtitle="Total listening hours, completion rates, and chapter replays"
              items={topAudiobookRankingItems}
              icon={BookOpen}
              barColor="from-blue-500 via-indigo-500 to-brand-neon"
            />
          </div>

          {/* 4K Video Detailed Intelligence Grid */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-400" />
                  4K Video Analytics & Viewer Retention Table
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tracks completed views vs partial views, average watch duration, replay frequency, and likes
                </p>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Video Title / Category</th>
                    <th className="py-3 px-3 text-right">Total Views</th>
                    <th className="py-3 px-3 text-right">Unique Viewers</th>
                    <th className="py-3 px-3 text-right">Completed</th>
                    <th className="py-3 px-3 text-right">Partial</th>
                    <th className="py-3 px-3 text-right">Avg Duration</th>
                    <th className="py-3 px-3 text-right">Replays</th>
                    <th className="py-3 px-3 text-right">Rating</th>
                    <th className="py-3 px-3 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {videos.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-2 text-neutral-400 font-bold">#{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-6 rounded-md overflow-hidden border border-white/10 shrink-0 bg-neutral-900 flex items-center justify-center">
                            {v.thumbnailUrl ? (
                              <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover" />
                            ) : (
                              <Video className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0 font-sans">
                            <p className="font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                              {v.title}
                            </p>
                            <p className="text-[10px] text-neutral-400">{v.artist} • {v.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">{v.views.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-neutral-300">{v.uniqueViewers.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                        {v.completedViews.toLocaleString()} ({v.completionRate}%)
                      </td>
                      <td className="py-3 px-3 text-right text-neutral-400">{v.partialViews.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-brand-gold">{v.avgWatchDuration}</td>
                      <td className="py-3 px-3 text-right text-purple-300">{v.replays.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-brand-gold flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        {v.rating.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400">+{v.trendPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audiobook Deep Intelligence Grid */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Audiobook & Culture Odyssey Deep Intelligence
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tracks listening hours, chapter retention, completion rates, and top listener chapters
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audiobooks.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all space-y-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <Image src={b.coverUrl} alt={b.title} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white truncate">{b.title}</h4>
                        <span className="text-emerald-400 text-xs font-mono font-bold">+{b.trendPercent}%</span>
                      </div>
                      <p className="text-xs text-neutral-300">Author: {b.author}</p>
                      <p className="text-[11px] text-neutral-400">Narrator: {b.narrator}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Listening Hours</span>
                      <span className="text-white font-bold">{b.listeningHours.toLocaleString()} hrs</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Completion Rate</span>
                      <span className="text-emerald-400 font-bold">{b.completionRate}%</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Unique Listeners</span>
                      <span className="text-brand-gold font-bold">{b.uniqueListeners.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] flex items-center justify-between">
                    <span className="text-neutral-400">Most-Played Chapter:</span>
                    <span className="text-white font-semibold truncate max-w-[200px]">{b.topChapter}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Deletion Modal */}
      <ConfirmDeletionModal
        isOpen={Boolean(itemToDelete)}
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDeletion}
        isDeleting={isDeleting}
      />

      {/* Unified Media Upload Modal (Audiobooks, Videos, Podcasts) */}
      <MediaUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        mediaType={uploadMediaType}
        onSuccess={() => {
          syncMedia();
          setFeedbackMessage(
            uploadMediaType === 'audiobook'
              ? 'Audiobook published to /audiobooks catalog!'
              : uploadMediaType === 'video'
              ? '4K Video published to catalog!'
              : 'Podcast episode published to catalog!'
          );
          setTimeout(() => setFeedbackMessage(null), 4000);
        }}
      />
    </div>
  );
};
