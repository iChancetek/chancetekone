'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Play,
  Pause,
  Film,
  Music,
  BookOpen,
  Mic,
  Image as ImageIcon,
  FileText,
  RotateCcw,
  Send,
  Eye,
  Mail,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Download,
  Check,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Info,
} from 'lucide-react';
import { CreatorSubmission, SubmissionStatus, SubmissionCategory } from '@/types/submission';
import { SubmissionService } from '@/lib/submissions/SubmissionService';
import { useAuth } from '@/lib/auth/AuthContext';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';

export const CreatorHoldingSection: React.FC = () => {
  const { profile, user } = useAuth();
  const [submissions, setSubmissions] = useState<CreatorSubmission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Active item for Content Inspection
  const [inspectingItem, setInspectingItem] = useState<CreatorSubmission | null>(null);

  // Review Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changesNotes, setChangesNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Audio Player State for Inspection Deck
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const adminEmail = profile?.email || user?.email || 'antgreene@8ofspadesworks.com';

  const loadSubmissions = async () => {
    setLoading(true);
    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const items = await SubmissionService.fetchSubmissions({
      adminEmail,
      authToken: token,
      status: statusFilter,
      category: categoryFilter,
    });
    setSubmissions(items);
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
    const unsub = SubmissionService.subscribe(() => {
      setSubmissions(SubmissionService.getCachedSubmissions());
    });
    return () => unsub();
  }, [statusFilter, categoryFilter]);

  // Audio Inspection Transport Handlers
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
      setAudioDuration(audioRef.current.duration || 0);
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Human-in-the-Loop Review Handlers
  const handleApprove = async () => {
    if (!inspectingItem) return;
    setIsSubmittingAction(true);
    setActionError(null);

    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const res = await SubmissionService.reviewSubmission(
      inspectingItem.submissionId,
      'approve',
      { internalNotes },
      { adminEmail, authToken: token }
    );

    setIsSubmittingAction(false);
    if (res.success && res.submission) {
      // Sync into active public catalogs
      if (inspectingItem.category === 'video') {
        MediaCatalogService.addVideo({
          id: res.submission.publishedCatalogId || `vid-${Date.now()}`,
          title: inspectingItem.title,
          artistId: inspectingItem.creatorUserId || 'creator-1',
          artistName: inspectingItem.creatorOrArtistName,
          category: inspectingItem.genre || 'Cinematic Film',
          videoUrl: inspectingItem.originalStoragePath,
          thumbnailUrl: inspectingItem.coverUrl || '',
          duration: inspectingItem.durationSeconds || 360,
          views: 0,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
          description: inspectingItem.description,
          releaseDate: inspectingItem.releaseDate || new Date().toISOString().split('T')[0],
        });
      } else if (
        inspectingItem.category === 'audiobook' ||
        inspectingItem.category === 'book' ||
        inspectingItem.category === 'manuscript'
      ) {
        MediaCatalogService.addAudiobook({
          id: res.submission.publishedCatalogId || `abk-${Date.now()}`,
          title: inspectingItem.title,
          author: inspectingItem.creatorOrArtistName,
          narrator: inspectingItem.creatorOrArtistName,
          coverUrl: inspectingItem.coverUrl || '',
          duration: inspectingItem.durationSeconds || 600,
          genre: inspectingItem.genre || 'Literature',
          description: inspectingItem.description,
          chapters: [
            {
              id: `chap-${Date.now()}`,
              chapterIndex: 1,
              title: inspectingItem.title,
              duration: inspectingItem.durationSeconds || 600,
              audioUrl: inspectingItem.originalStoragePath,
              pdfUrl: inspectingItem.mediaFormat === 'pdf' ? inspectingItem.originalStoragePath : undefined,
            },
          ],
          likeCount: 0,
          rating: 5.0,
          releaseYear: new Date().getFullYear(),
          mediaFormat: inspectingItem.mediaFormat === 'pdf' ? 'pdf' : inspectingItem.mediaFormat === 'video' ? 'video' : 'audio',
          pdfUrl: inspectingItem.mediaFormat === 'pdf' ? inspectingItem.originalStoragePath : undefined,
        });
      } else if (inspectingItem.category === 'podcast') {
        MediaCatalogService.addPodcast({
          id: res.submission.publishedCatalogId || `pod-${Date.now()}`,
          title: inspectingItem.title,
          showTitle: `${inspectingItem.creatorOrArtistName} Show`,
          host: inspectingItem.creatorOrArtistName,
          description: inspectingItem.description,
          mediaUrl: inspectingItem.originalStoragePath,
          mediaType: inspectingItem.mediaFormat === 'video' ? 'video' : 'audio',
          coverUrl: inspectingItem.coverUrl || '',
          duration: inspectingItem.durationSeconds || 1200,
          releaseDate: new Date().toISOString().split('T')[0],
          category: inspectingItem.genre || 'Podcast',
          playCount: 0,
          likeCount: 0,
        });
      }

      setActionSuccess(
        `✓ "${inspectingItem.title}" approved and published! Transactional approval email dispatched to ${inspectingItem.creatorEmailSnapshot}.`
      );
      setInspectingItem(res.submission);
      setIsApproveModalOpen(false);
      loadSubmissions();
    } else {
      setActionError(res.error || 'Approval failed.');
    }
  };

  const handleReject = async () => {
    if (!inspectingItem) return;
    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      setActionError('A meaningful rejection reason is mandatory to guide the creator.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const res = await SubmissionService.reviewSubmission(
      inspectingItem.submissionId,
      'reject',
      {
        rejectionReason: cleanReason,
        internalNotes,
      },
      { adminEmail, authToken: token }
    );

    setIsSubmittingAction(false);
    if (res.success && res.submission) {
      setActionSuccess(
        `✓ "${inspectingItem.title}" rejected. Notification email containing your actual feedback dispatched to ${inspectingItem.creatorEmailSnapshot}.`
      );
      setInspectingItem(res.submission);
      setIsRejectModalOpen(false);
      setRejectionReason('');
      loadSubmissions();
    } else {
      setActionError(res.error || 'Rejection failed.');
    }
  };

  const handleRequestChanges = async () => {
    if (!inspectingItem) return;
    const cleanNotes = changesNotes.trim();
    if (!cleanNotes) {
      setActionError('Please specify the changes requested from the creator.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const res = await SubmissionService.reviewSubmission(
      inspectingItem.submissionId,
      'changes_requested',
      {
        changesRequestedNotes: cleanNotes,
        internalNotes,
      },
      { adminEmail, authToken: token }
    );

    setIsSubmittingAction(false);
    if (res.success && res.submission) {
      setActionSuccess(`✓ Changes requested for "${inspectingItem.title}". Creator notified in Creator Studio.`);
      setInspectingItem(res.submission);
      setIsChangesModalOpen(false);
      setChangesNotes('');
      loadSubmissions();
    } else {
      setActionError(res.error || 'Action failed.');
    }
  };

  const handleResendEmail = async () => {
    if (!inspectingItem) return;
    setIsSubmittingAction(true);
    setActionError(null);

    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const res = await SubmissionService.reviewSubmission(
      inspectingItem.submissionId,
      'resend_email',
      { notificationId: inspectingItem.emailNotificationId },
      { adminEmail, authToken: token }
    );

    setIsSubmittingAction(false);
    if (res.success) {
      setActionSuccess(`✓ Notification email successfully re-dispatched to ${inspectingItem.creatorEmailSnapshot}.`);
    } else {
      setActionError(res.error || 'Failed to resend email.');
    }
  };

  // Filter Submissions by search query
  const filteredSubmissions = submissions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.creatorOrArtistName.toLowerCase().includes(q) ||
      s.creatorEmailSnapshot.toLowerCase().includes(q) ||
      s.submissionId.toLowerCase().includes(q)
    );
  });

  // Calculate metrics
  const pendingCount = submissions.filter((s) => s.moderationStatus === 'pending_review').length;
  const inReviewCount = submissions.filter((s) => s.moderationStatus === 'in_review').length;
  const publishedCount = submissions.filter((s) => s.moderationStatus === 'approved' || s.moderationStatus === 'published').length;
  const rejectedCount = submissions.filter((s) => s.moderationStatus === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Strip */}
      <div className="p-6 rounded-3xl glass-panel border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-[#12111c] to-brand-purple/10 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                Official Content Holding Area
              </span>
              <span className="text-xs text-neutral-400 font-mono">Human-in-the-Loop Moderation</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-brand-gold" />
              Creator Submissions &amp; Editorial Review
            </h2>
            <p className="text-xs text-neutral-300 max-w-2xl">
              Inspect creative submissions across music, beats, MOV/MP4 videos, audiobooks, podcasts, books, and visual artwork.
              Every decision automatically coordinates catalog publication and branded email delivery to creators.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadSubmissions}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-brand-gold ${loading ? 'animate-spin' : ''}`} />
              Refresh Holding Queue
            </button>
            <Link
              href="/studio"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg hover:scale-105 transition-all cursor-pointer"
            >
              Open Creator Studio &rarr;
            </Link>
          </div>
        </div>

        {/* 4 Metric Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Awaiting Human Review</div>
            <div className="text-2xl font-black text-white mt-1">{pendingCount}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Holding in private queue</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30">
            <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">In Active Inspection</div>
            <div className="text-2xl font-black text-white mt-1">{inReviewCount}</div>
            <div className="text-[10px] text-blue-400/80 mt-0.5">Administrator reviewing</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Approved &amp; Published</div>
            <div className="text-2xl font-black text-white mt-1">{publishedCount}</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Live on 8 Of Spades Works</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30">
            <div className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Rejected with Feedback</div>
            <div className="text-2xl font-black text-white mt-1">{rejectedCount}</div>
            <div className="text-[10px] text-red-400/80 mt-0.5">Creator notified via email</div>
          </div>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 bg-[#0f0e1a] flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, artist, email, or ID..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-[11px] font-bold text-neutral-400 uppercase">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-brand-gold cursor-pointer"
          >
            <option value="pending_review">Pending Review (Holding)</option>
            <option value="in_review">In Review</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="approved">Approved &amp; Published</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Drafts</option>
            <option value="all">All Statuses</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-brand-gold cursor-pointer ml-2"
          >
            <option value="all">All Categories</option>
            <option value="music">Music Singles</option>
            <option value="beats">Beats &amp; Instrumentals</option>
            <option value="video">Video &amp; Film (MP4 / MOV)</option>
            <option value="audiobook">Audiobooks</option>
            <option value="podcast">Podcasts</option>
            <option value="book">Books &amp; Literature (PDF)</option>
            <option value="artwork">Visual Artwork &amp; Paintings</option>
          </select>
        </div>
      </div>

      {/* Main Holding Queue Table & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Submissions List (Left 7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 bg-[#0f0e1a]">
              <ShieldCheck className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">No submissions match the current filters</h3>
              <p className="text-xs text-neutral-400 mt-1">
                New submissions from registered creators will appear here for human editorial review.
              </p>
            </div>
          ) : (
            filteredSubmissions.map((sub) => {
              const isSelected = inspectingItem?.submissionId === sub.submissionId;
              const isMov = sub.fileName.toLowerCase().endsWith('.mov');

              return (
                <div
                  key={sub.submissionId}
                  onClick={() => {
                    setInspectingItem(sub);
                    setIsPlayingAudio(false);
                  }}
                  className={`p-4 rounded-2xl glass-panel border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-brand-gold bg-brand-gold/10 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                      : 'border-white/10 hover:border-white/20 bg-[#0f0e1a]/80'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail / Media Icon */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/60 border border-white/10 shrink-0 flex items-center justify-center">
                      {sub.coverUrl ? (
                        <Image src={sub.coverUrl} alt={sub.title} fill className="object-cover" unoptimized />
                      ) : sub.category === 'video' ? (
                        <Film className="w-6 h-6 text-indigo-400" />
                      ) : sub.category === 'book' || sub.category === 'manuscript' ? (
                        <BookOpen className="w-6 h-6 text-emerald-400" />
                      ) : sub.category === 'podcast' ? (
                        <Mic className="w-6 h-6 text-purple-400" />
                      ) : sub.category === 'artwork' || sub.category === 'painting' ? (
                        <ImageIcon className="w-6 h-6 text-pink-400" />
                      ) : (
                        <Music className="w-6 h-6 text-amber-400" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-md border border-brand-gold/30">
                          {sub.subtype || sub.category}
                        </span>
                        {isMov && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
                            MOV Cinema
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-400 font-mono ml-auto">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Draft'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white truncate mt-1">{sub.title}</h4>
                      <p className="text-xs text-neutral-300 truncate">By {sub.creatorOrArtistName}</p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                        <span className="truncate">Creator: {sub.creatorEmailSnapshot}</span>
                        <span>•</span>
                        <span>{(sub.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                    </div>

                    {/* Moderation Status Pill */}
                    <div className="shrink-0">
                      {sub.moderationStatus === 'pending_review' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </span>
                      )}
                      {sub.moderationStatus === 'approved' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved
                        </span>
                      )}
                      {sub.moderationStatus === 'rejected' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                      {sub.moderationStatus === 'changes_requested' && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                          Changes Requested
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Content Inspection Deck (Right 5 Cols) */}
        <div className="lg:col-span-5">
          {inspectingItem ? (
            <div className="p-5 rounded-3xl glass-panel border border-brand-gold/40 bg-[#0d0c18] space-y-5 sticky top-20 shadow-2xl">
              {/* Inspection Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-black text-brand-gold uppercase tracking-wider">
                    Actual Content Inspection
                  </div>
                  <h3 className="text-base font-black text-white truncate max-w-[260px]">
                    {inspectingItem.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 font-mono">ID: {inspectingItem.submissionId.slice(-8)}</span>
                </div>
              </div>

              {/* Real Content Player / Viewer Viewport */}
              <div className="rounded-2xl overflow-hidden bg-black/80 border border-white/10 p-3">
                {/* 1. Video Player (MP4 & MOV) */}
                {inspectingItem.category === 'video' || inspectingItem.mediaFormat === 'video' ? (
                  <div className="space-y-2">
                    <video
                      controls
                      playsInline
                      src={inspectingItem.originalStoragePath}
                      poster={inspectingItem.coverUrl || undefined}
                      className="w-full max-h-60 rounded-xl bg-black object-contain"
                    />
                    {inspectingItem.fileName.toLowerCase().endsWith('.mov') && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-300">
                        <span>MOV QuickTime Container Verified</span>
                        <a
                          href={inspectingItem.originalStoragePath}
                          download={inspectingItem.fileName}
                          className="text-xs font-bold text-white hover:text-cyan-200 underline flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> Direct Review
                        </a>
                      </div>
                    )}
                  </div>
                ) : inspectingItem.category === 'book' || inspectingItem.mediaFormat === 'pdf' ? (
                  /* 2. PDF Document Reader */
                  <div className="space-y-2">
                    <div className="h-64 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                      <iframe
                        src={inspectingItem.originalStoragePath}
                        className="w-full h-full border-none"
                        title={inspectingItem.title}
                      />
                    </div>
                    <a
                      href={inspectingItem.originalStoragePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-brand-gold text-xs font-bold flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open Fullscreen Document Reader
                    </a>
                  </div>
                ) : inspectingItem.category === 'artwork' || inspectingItem.category === 'painting' ? (
                  /* 3. Artwork Lightbox */
                  <div className="relative h-64 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center">
                    <Image
                      src={inspectingItem.originalStoragePath}
                      alt={inspectingItem.title}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  /* 4. Audio Player with Waveform Equalizer (Music, Beats, Audiobooks, Podcasts) */
                  <div className="p-4 space-y-4">
                    <audio
                      ref={audioRef}
                      src={inspectingItem.originalStoragePath}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onEnded={() => setIsPlayingAudio(false)}
                    />

                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayAudio}
                        className="w-12 h-12 rounded-2xl bg-gradient-to-r from-brand-gold to-amber-500 text-black flex items-center justify-center font-bold shadow-lg hover:scale-105 transition-all cursor-pointer shrink-0"
                      >
                        {isPlayingAudio ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                          <span>{formatSeconds(audioCurrentTime)}</span>
                          <span>{formatSeconds(audioDuration || inspectingItem.durationSeconds || 0)}</span>
                        </div>
                        {/* Audio Scrubber */}
                        <input
                          type="range"
                          min="0"
                          max={audioDuration || 100}
                          value={audioCurrentTime}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAudioCurrentTime(val);
                            if (audioRef.current) audioRef.current.currentTime = val;
                          }}
                          className="w-full accent-brand-gold cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Animated Equalizer Waveform Bars */}
                    <div className="flex items-end justify-center gap-1 h-6 pt-1">
                      {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35, 95, 60, 40].map((h, i) => (
                        <div
                          key={i}
                          style={{
                            height: isPlayingAudio ? `${h}%` : '20%',
                            transition: 'height 0.2s ease',
                          }}
                          className={`w-1 rounded-full ${
                            isPlayingAudio ? 'bg-brand-gold animate-pulse' : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submission Information & Verification Badges */}
              <div className="space-y-2 text-xs text-neutral-300 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Creator / Artist:</span>
                  <span className="font-bold text-white">{inspectingItem.creatorOrArtistName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Registered Email:</span>
                  <span className="font-mono text-brand-gold flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {inspectingItem.creatorEmailSnapshot}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Copyright Certification:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Master Certified
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Cover Art Option:</span>
                  <span className="text-neutral-200">
                    {inspectingItem.coverUrl ? 'Custom Master Artwork' : 'No Cover Art (Clean Native)'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Email Notification Status:</span>
                  <span className="capitalize font-bold text-white flex items-center gap-1">
                    {inspectingItem.emailNotificationStatus === 'sent' && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {inspectingItem.emailNotificationStatus}
                  </span>
                </div>

                {inspectingItem.rejectionReason && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-wider block mb-0.5 text-red-400">
                      Current Rejection Reason:
                    </span>
                    <p className="italic">{inspectingItem.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Human-in-the-Loop Moderation Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsApproveModalOpen(true)}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.02] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-black text-white" />
                    Approve &amp; Publish
                  </button>

                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-transform hover:scale-[1.02] cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 fill-white text-red-600" />
                    Reject Submission
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsChangesModalOpen(true)}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
                  >
                    Request Changes
                  </button>
                  {inspectingItem.emailNotificationStatus === 'failed' && (
                    <button
                      onClick={handleResendEmail}
                      disabled={isSubmittingAction}
                      className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Resend Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 bg-[#0f0e1a]">
              <Eye className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white">Select a Submission</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Click any submission in the holding queue to inspect the media, audio, video, or documents.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Approve Confirmation */}
      {isApproveModalOpen && inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel border border-emerald-500/40 bg-[#0d0c18] p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Approve &amp; Publish Content?</h3>
              <p className="text-xs text-neutral-300">
                You are approving “<strong>{inspectingItem.title}</strong>” by {inspectingItem.creatorOrArtistName}.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-neutral-400 space-y-1">
              <p>• Content will immediately publish to public streaming catalog.</p>
              <p>• Automated transactional approval email will be sent to <strong>{inspectingItem.creatorEmailSnapshot}</strong>.</p>
              <p>• Direct links to the live content will be included.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase">Internal Staff Notes (Optional)</label>
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Private staff verification notes..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={isSubmittingAction}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-black text-xs font-black uppercase tracking-wider shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                {isSubmittingAction ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Confirmation (Mandatory Reason) */}
      {isRejectModalOpen && inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-panel border border-red-500/40 bg-[#0d0c18] p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Reject Creator Submission</h3>
              <p className="text-xs text-neutral-300">
                A constructive, meaningful rejection reason is <strong>mandatory</strong>. This actual text will be automatically delivered to <strong>{inspectingItem.creatorEmailSnapshot}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-red-400 uppercase">
                Administrator Rejection Reason (Required) *
              </label>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain clearly why this submission was rejected (e.g., audio distortion, missing master clearance, corrupted video container, resolution below 1080p)..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-red-500/30 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-400"
              />
              <span className="text-[10px] text-neutral-500">
                This exact text will be inserted into the template: “[Actual Administrator Rejection Reason]”
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase">Internal Staff Notes (Private)</label>
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Private internal notes (will NOT be emailed)..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectionReason('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmittingAction || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                {isSubmittingAction ? 'Rejecting...' : 'Reject & Dispatch Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Request Changes */}
      {isChangesModalOpen && inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel border border-purple-500/40 bg-[#0d0c18] p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Request Changes from Creator</h3>
              <p className="text-xs text-neutral-300">
                Specify what edits or corrections are required before this submission can be approved.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-purple-400 uppercase">Instructions for Creator *</label>
              <textarea
                rows={3}
                value={changesNotes}
                onChange={(e) => setChangesNotes(e.target.value)}
                placeholder="e.g. Please re-export audio at 320kbps MP3 or provide master liner notes..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-purple-500/30 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsChangesModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={isSubmittingAction || !changesNotes.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                {isSubmittingAction ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
