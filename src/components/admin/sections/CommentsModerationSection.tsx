'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  MessageSquare,
  Search,
  Trash2,
  Download,
  Filter,
  Calendar,
  Clock,
  User,
  Crown,
  Flame,
  Heart,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Pin,
  ExternalLink,
  ChevronDown,
  BarChart3,
  FileText,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  SocialCommentService,
  CommentAnalyticsSummary,
  MetricBucket,
} from '@/lib/social/SocialCommentService';
import { Comment, UniversalContentType } from '@/types/social';
import { useAuth } from '@/lib/auth/AuthContext';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';

type TimeframeOption = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

const VIBRANT_BAR_GRADIENTS = [
  'from-amber-400 via-brand-gold to-yellow-500 shadow-[0_0_15px_rgba(245,195,68,0.4)]',
  'from-purple-500 via-brand-purple to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]',
  'from-emerald-400 via-teal-500 to-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
  'from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(6,182,212,0.4)]',
  'from-rose-400 via-pink-500 to-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.4)]',
  'from-amber-500 via-orange-500 to-red-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]',
  'from-violet-400 via-purple-600 to-fuchsia-600 shadow-[0_0_15px_rgba(192,132,252,0.4)]',
  'from-yellow-400 via-amber-500 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
];

export const CommentsModerationSection: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [comments, setComments] = useState<(Comment & { isReply: boolean; parentCommentId?: string | null })[]>([]);
  const [timeframe, setTimeframe] = useState<TimeframeOption>('daily');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_reacted' | 'most_replies'>('newest');

  // Purge all comments modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Discussion view modal
  const [activeDiscussionItem, setActiveDiscussionItem] = useState<{
    id: string;
    key?: string;
    type: UniversalContentType;
    title: string;
  } | null>(null);

  const loadData = () => {
    setComments(SocialCommentService.getAllCommentsFlat());
  };

  useEffect(() => {
    loadData();
    const unsub = SocialCommentService.subscribeAll(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Filtered comments
  const filteredComments = useMemo(() => {
    const q = searchUserQuery.toLowerCase().trim();
    return comments.filter((c) => {
      // User query (match name, email, handle, userId, or text content)
      if (q) {
        const matchName = (c.userName || '').toLowerCase().includes(q);
        const matchEmail = (c.userEmail || '').toLowerCase().includes(q);
        const matchHandle = (c.userHandle || '').toLowerCase().includes(q);
        const matchText = (c.text || '').toLowerCase().includes(q);
        const matchTitle = (c.contentTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchHandle && !matchText && !matchTitle) {
          return false;
        }
      }

      // Content type filter
      if (selectedContentType !== 'all') {
        const ct = (c.contentType || '').toLowerCase();
        if (ct !== selectedContentType.toLowerCase()) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'most_reacted') {
        const rA = Object.values(a.reactions || {}).reduce((acc, v) => acc + (v || 0), 0);
        const rB = Object.values(b.reactions || {}).reduce((acc, v) => acc + (v || 0), 0);
        return rB - rA;
      }
      if (sortBy === 'most_replies') {
        return (b.replyCount || 0) - (a.replyCount || 0);
      }
      return 0;
    });
  }, [comments, searchUserQuery, selectedContentType, sortBy]);

  // Analytics Metrics & Bar Charts Data
  const analytics: CommentAnalyticsSummary = useMemo(() => {
    return SocialCommentService.getCommentMetrics(timeframe, {
      contentType: selectedContentType !== 'all' ? selectedContentType : undefined,
    });
  }, [timeframe, selectedContentType, comments]);

  // Max count for chart scaling
  const maxBucketCount = useMemo(() => {
    return Math.max(...analytics.buckets.map((b) => b.count), 1);
  }, [analytics]);

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment from the platform?')) {
      SocialCommentService.deleteComment(commentId, profile?.id || 'admin', true);
      loadData();
    }
  };

  const handleTogglePin = (commentId: string) => {
    SocialCommentService.pinComment(commentId, true);
    loadData();
  };

  const handleConfirmPurgeAll = () => {
    if (purgeConfirmText !== 'CONFIRM PURGE') return;
    SocialCommentService.removeAllComments(true);
    setShowPurgeModal(false);
    setPurgeConfirmText('');
    loadData();
  };

  // Format exact date & time stamp
  const formatExactDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })}`;
    } catch {
      return iso;
    }
  };

  // CSV Report Generator
  const handleExportCSVReport = () => {
    const headers = [
      'Comment ID',
      'Is Reply',
      'Parent Thread ID',
      'Timestamp (ISO)',
      'Formatted Date & Time',
      'User ID',
      'User Name',
      'User Email',
      'User Handle',
      'User Role',
      'Content Type',
      'Content ID',
      'Content Title',
      'Comment Text',
      'Reactions Total',
      'Reply Count',
      'Is Pinned',
      'Is Edited',
    ];

    const rows = filteredComments.map((c) => {
      const totalReactions = Object.values(c.reactions || {}).reduce((acc, v) => acc + (v || 0), 0);
      return [
        `"${c.id}"`,
        c.isReply ? 'Yes' : 'No',
        `"${c.parentCommentId || ''}"`,
        `"${c.createdAt}"`,
        `"${formatExactDateTime(c.createdAt)}"`,
        `"${c.userId}"`,
        `"${(c.userName || '').replace(/"/g, '""')}"`,
        `"${(c.userEmail || '').replace(/"/g, '""')}"`,
        `"${(c.userHandle || '').replace(/"/g, '""')}"`,
        `"${c.userRole || 'user'}"`,
        `"${c.contentType}"`,
        `"${c.contentId}"`,
        `"${(c.contentTitle || '').replace(/"/g, '""')}"`,
        `"${(c.text || '').replace(/"/g, '""')}"`,
        totalReactions,
        c.replyCount || 0,
        c.isPinned ? 'Yes' : 'No',
        c.isEdited ? 'Yes' : 'No',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `chancetekone_community_comments_report_${timeframe}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Bar with Overview Metrics & Danger Zone */}
      <div className="p-6 rounded-3xl glass-panel border border-brand-gold/40 bg-gradient-to-r from-[#170e28]/95 via-[#0e091a]/95 to-[#080511]/95 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 border border-brand-gold/50 flex items-center justify-center text-brand-gold shadow-lg shadow-brand-gold/10">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                  Community Discussion & Comments Telemetry
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                    Live Telemetry
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Real-time discussion velocity, multi-pillar tracking (hourly, daily, weekly, monthly, yearly), member CRM audit, and universal moderation
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions: Export Report & Purge All */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-white/10 shadow-sm"
              title="View formatted summary report"
            >
              <FileText className="w-3.5 h-3.5 text-brand-gold" />
              <span>View Executive Report</span>
            </button>

            <button
              onClick={handleExportCSVReport}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-gold/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Download CSV report of filtered comments"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowPurgeModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              title="Remove all platform comments"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Purge All Comments</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Total Platform Records</span>
              <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
            </div>
            <p className="text-2xl font-black text-white">{analytics.totalComments + analytics.totalReplies}</p>
            <p className="text-[10px] text-neutral-400">
              {analytics.totalComments} threads • {analytics.totalReplies} replies
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Unique Active Members</span>
              <User className="w-3.5 h-3.5 text-brand-purple" />
            </div>
            <p className="text-2xl font-black text-white">{analytics.uniqueUsersCount}</p>
            <p className="text-[10px] text-emerald-400">Engaged platform creators & listeners</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Total Emoji Reactions</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-300">{analytics.totalReactions}</p>
            <p className="text-[10px] text-neutral-400">🔥, ❤️, 👍🏿, 👎🏿, 👏🏿, 💯 engagement</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Peak Activity Bucket</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-lg font-black text-cyan-300 truncate">{analytics.peakBucketLabel}</p>
            <p className="text-[10px] text-neutral-400">{analytics.peakBucketCount} comments recorded</p>
          </div>
        </div>
      </div>

      {/* 2. Colorful Metric Bar Charts & Timeframe Tracking */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0917]/90 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-gold" />
              <span>Comment Velocity & Activity Distribution</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Multi-scale metric visualization grouped by {timeframe} volume
            </p>
          </div>

          {/* Timeframe Selector Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/50 border border-white/10 overflow-x-auto no-scrollbar">
            {(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  timeframe === tf
                    ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Colorful Bar Chart Visualizer */}
        <div className="space-y-4">
          <div className="h-56 sm:h-64 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-white/10 bg-white/[0.01] rounded-2xl">
            {analytics.buckets.map((b, idx) => {
              const heightPercent = Math.max(12, Math.round((b.count / maxBucketCount) * 100));
              const gradientClass = VIBRANT_BAR_GRADIENTS[idx % VIBRANT_BAR_GRADIENTS.length];

              return (
                <div
                  key={b.key}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <div className="p-2.5 rounded-xl bg-black/90 border border-brand-gold/50 shadow-2xl backdrop-blur-md text-center space-y-1 min-w-[110px]">
                      <p className="text-xs font-extrabold text-brand-gold">{b.label}</p>
                      <p className="text-sm font-black text-white font-mono">{b.count} comments</p>
                      <p className="text-[10px] text-neutral-300 font-mono">
                        {b.reactions} reactions • {b.uniqueUsers} users
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-black border-r border-b border-brand-gold/50 transform rotate-45 -mt-1" />
                  </div>

                  {/* Top Count Label */}
                  <span className="text-[10px] font-mono font-bold text-neutral-400 group-hover:text-white mb-1 transition-colors">
                    {b.count}
                  </span>

                  {/* Glowing Animated Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[48px] rounded-t-xl bg-gradient-to-t ${gradientClass} transition-all duration-500 group-hover:scale-y-105 group-hover:brightness-125 cursor-pointer`}
                  />

                  {/* Bottom Bucket Label */}
                  <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400 truncate max-w-[65px] mt-2 group-hover:text-brand-gold transition-colors">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Content Pillar Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
            <span className="text-neutral-400 font-medium">Activity Distribution by Content Pillar:</span>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(analytics.contentTypeDistribution).map(([type, count]) => (
                <span
                  key={type}
                  className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-mono text-[11px]"
                >
                  <strong className="capitalize text-white">{type}</strong>:{' '}
                  <span className="text-brand-gold font-bold">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Query Engine & Moderation Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0917]/90 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-gold" />
              <span>Query & Moderation Deck</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Query comments by member, keyword, timeframe, or content type with live audit logs
            </p>
          </div>

          <div className="text-xs font-mono text-neutral-400">
            Showing <strong className="text-brand-gold">{filteredComments.length}</strong> of{' '}
            <strong className="text-white">{comments.length}</strong> platform comments
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search by user / keyword */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search user, email, or comment..."
              value={searchUserQuery}
              onChange={(e) => setSearchUserQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/60"
            />
            {searchUserQuery && (
              <button
                onClick={() => setSearchUserQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Content Type Filter */}
          <select
            value={selectedContentType}
            onChange={(e) => setSelectedContentType(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-200 focus:outline-none focus:border-brand-gold/60 capitalize cursor-pointer"
          >
            <option value="all" className="bg-[#120a1f] text-white">All Content Types</option>
            <option value="song" className="bg-[#120a1f] text-white">Songs / Tracks</option>
            <option value="album" className="bg-[#120a1f] text-white">Albums</option>
            <option value="artist" className="bg-[#120a1f] text-white">Artists</option>
            <option value="video" className="bg-[#120a1f] text-white">Videos (4K)</option>
            <option value="audiobook" className="bg-[#120a1f] text-white">Audiobooks & Literature</option>
            <option value="merch" className="bg-[#120a1f] text-white">Merchandise</option>
            <option value="playlist" className="bg-[#120a1f] text-white">Playlists & Crates</option>
            <option value="producer" className="bg-[#120a1f] text-white">Producers</option>
          </select>

          {/* Sort By Filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-200 focus:outline-none focus:border-brand-gold/60 cursor-pointer"
          >
            <option value="newest" className="bg-[#120a1f] text-white">Newest First</option>
            <option value="oldest" className="bg-[#120a1f] text-white">Oldest First</option>
            <option value="most_reacted" className="bg-[#120a1f] text-white">Most Reacted (🔥)</option>
            <option value="most_replies" className="bg-[#120a1f] text-white">Most Replies</option>
          </select>

          {/* Reset Filters Button */}
          <button
            onClick={() => {
              setSearchUserQuery('');
              setSelectedContentType('all');
              setSortBy('newest');
            }}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Query Filters</span>
          </button>
        </div>

        {/* Detailed Comments Table */}
        <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-neutral-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-4">Member Info</th>
                <th className="py-3 px-4">Date & Time Stamp</th>
                <th className="py-3 px-4">Target Content</th>
                <th className="py-3 px-4">Comment Text</th>
                <th className="py-3 px-4 text-center">Engagement</th>
                <th className="py-3 px-4 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredComments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-neutral-600" />
                    <p className="font-bold text-white text-sm">No comments match the active query</p>
                    <p className="text-xs">Adjust your search parameters or select a different timeframe.</p>
                  </td>
                </tr>
              ) : (
                filteredComments.map((c) => {
                  const totalReactions = Object.values(c.reactions || {}).reduce((acc, v) => acc + (v || 0), 0);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        c.isPinned ? 'bg-amber-500/[0.04]' : ''
                      }`}
                    >
                      {/* 1. Member Info */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-purple/40 shrink-0">
                            <Image
                              src={c.userAvatar || '/images/logo.png'}
                              alt={c.userName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white truncate text-xs">{c.userName}</span>
                              {c.userRole === 'admin' && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-brand-gold text-[9px] font-black uppercase font-mono">
                                  Admin
                                </span>
                              )}
                              {c.isReply && (
                                <span className="px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 text-[9px] font-bold font-mono">
                                  Reply
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-400 font-mono truncate">
                              {c.userEmail || c.userHandle || `ID: ${c.userId.substring(0, 10)}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Date & Time Stamp */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap font-mono text-[11px] text-neutral-300">
                        <div className="flex flex-col">
                          <span className="font-bold text-white flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-brand-gold shrink-0" />
                            {formatExactDateTime(c.createdAt)}
                          </span>
                          {c.isEdited && (
                            <span className="text-[10px] text-brand-gold/70 italic">
                              (edited {c.updatedAt ? formatExactDateTime(c.updatedAt) : ''})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Target Content */}
                      <td className="py-3.5 px-4 align-top max-w-[180px]">
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-extrabold uppercase text-brand-gold font-mono">
                            {c.contentType}
                          </span>
                          <p className="text-xs font-bold text-white truncate" title={c.contentTitle}>
                            {c.contentTitle || 'Platform Content'}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-mono truncate">
                            ID: {c.contentId}
                          </p>
                        </div>
                      </td>

                      {/* 4. Comment Text */}
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <p className="text-xs text-neutral-200 leading-relaxed line-clamp-3">
                          {c.text}
                        </p>
                      </td>

                      {/* 5. Engagement */}
                      <td className="py-3.5 px-4 align-top text-center whitespace-nowrap font-mono">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                            <span>🔥</span>
                            <span>{totalReactions}</span>
                          </span>
                          {!c.isReply && (
                            <span className="text-[10px] text-neutral-400">
                              {c.replyCount || 0} replies
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Moderation Actions */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View in Modal */}
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDiscussionItem({
                                id: c.contentId,
                                key: c.contentKey,
                                type: c.contentType,
                                title: c.contentTitle || 'Discussion',
                              })
                            }
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            title="Inspect in Discussion Drawer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-brand-gold" />
                          </button>

                          {/* Pin Toggle (Top-Level Only) */}
                          {!c.isReply && (
                            <button
                              type="button"
                              onClick={() => handleTogglePin(c.id)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                c.isPinned
                                  ? 'text-brand-gold border-amber-500/40 bg-amber-500/10'
                                  : 'text-neutral-400 hover:text-white border-transparent hover:border-white/10'
                              }`}
                              title={c.isPinned ? 'Unpin comment' : 'Pin comment to top'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Comment */}
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete this comment from platform"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Universal Discussion Drawer for Inspection */}
      {activeDiscussionItem && (
        <UniversalDiscussionModal
          isOpen={Boolean(activeDiscussionItem)}
          onClose={() => setActiveDiscussionItem(null)}
          contentId={activeDiscussionItem.id}
          contentKey={activeDiscussionItem.key}
          contentType={activeDiscussionItem.type}
          contentTitle={activeDiscussionItem.title}
          badgeLabel={activeDiscussionItem.type}
        />
      )}

      {/* Modal: Purge All Comments (Double-Confirmation) */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/50 bg-[#160a12] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-white">Permanently Remove All Comments</h3>
              </div>
              <button
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmText('');
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              This action will permanently delete <strong className="text-red-400">{comments.length}</strong> comments, threads, replies, and reactions across all platform crates, albums, songs, videos, audiobooks, and merchandise.
            </p>

            <div className="space-y-1.5 text-xs font-mono">
              <label className="text-neutral-400">
                Type <strong className="text-red-400">CONFIRM PURGE</strong> below to authorize:
              </label>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="CONFIRM PURGE"
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurgeAll}
                disabled={purgeConfirmText !== 'CONFIRM PURGE'}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase disabled:opacity-40 transition-all cursor-pointer"
              >
                Delete All Comments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Formatted Executive Report */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] p-6 sm:p-8 rounded-3xl glass-panel border border-brand-gold/40 bg-[#0d0914] shadow-2xl space-y-6 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold uppercase tracking-wider mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  Executive Community Telemetry Report
                </div>
                <h3 className="text-xl font-black text-white">ChanceTEK One Discussion Intelligence</h3>
                <p className="text-xs text-neutral-400">Generated on {formatExactDateTime(new Date().toISOString())}</p>
              </div>

              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-neutral-400">Total Entries</span>
                <p className="text-xl font-bold text-white">{filteredComments.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-neutral-400">Unique Members</span>
                <p className="text-xl font-bold text-brand-gold">{analytics.uniqueUsersCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-neutral-400">Emoji Reactions</span>
                <p className="text-xl font-bold text-amber-400">{analytics.totalReactions}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-neutral-400">Timeframe</span>
                <p className="text-xl font-bold text-cyan-300 capitalize">{timeframe}</p>
              </div>
            </div>

            {/* Timeframe Buckets Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                Activity Distribution ({timeframe.toUpperCase()})
              </h4>
              <div className="rounded-xl border border-white/10 overflow-hidden font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-neutral-400 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Time Interval</th>
                      <th className="p-2.5 text-center">Volume</th>
                      <th className="p-2.5 text-center">Reactions</th>
                      <th className="p-2.5 text-center">Active Members</th>
                      <th className="p-2.5 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analytics.buckets.map((b) => (
                      <tr key={b.key} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-bold text-white">{b.label}</td>
                        <td className="p-2.5 text-center text-brand-gold font-bold">{b.count}</td>
                        <td className="p-2.5 text-center text-amber-300">{b.reactions}</td>
                        <td className="p-2.5 text-center text-neutral-300">{b.uniqueUsers}</td>
                        <td className="p-2.5 text-right text-neutral-400">{b.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export and Close Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={handleExportCSVReport}
                className="px-5 py-2.5 rounded-xl bg-brand-gold hover:bg-amber-400 text-black text-xs font-extrabold uppercase flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report CSV</span>
              </button>

              <button
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

