'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Flame,
  Reply,
  Trash2,
  Edit2,
  Check,
  X,
  Pin,
  ChevronDown,
  ChevronUp,
  Crown,
  Sparkles,
  Music,
  Sliders,
  Video,
  Shield,
  SmilePlus,
  Clock,
  Calendar,
} from 'lucide-react';
import {
  Comment,
  UniversalContentType,
  CommentEmojiReaction,
  CommentReactionCounts,
} from '@/types/social';
import { CommentComposer } from './CommentComposer';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { SocialCommentService } from '@/lib/social/SocialCommentService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

interface CommentSectionProps {
  contentId: string;
  contentKey?: string;
  contentType: UniversalContentType;
  contentTitle?: string;
  initialComments?: Comment[];
  showHeader?: boolean;
  className?: string;
}

const EMOJI_BUTTONS: { key: CommentEmojiReaction; label: string; icon: string; activeColor: string }[] = [
  { key: 'fire', label: 'Fire', icon: '🔥', activeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]' },
  { key: 'heart', label: 'Love', icon: '❤️', activeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]' },
  { key: 'thumbs_up_dark', label: 'Thumbs Up (Dark)', icon: '👍🏿', activeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(217,119,6,0.3)]' },
  { key: 'thumbs_down_dark', label: 'Thumbs Down (Dark)', icon: '👎🏿', activeColor: 'bg-neutral-800 text-neutral-300 border-neutral-700 shadow-sm' },
  { key: 'thumbs_up', label: 'Thumbs Up', icon: '👍', activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]' },
  { key: 'thumbs_down', label: 'Thumbs Down', icon: '👎', activeColor: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
  { key: 'clap_dark', label: 'Clap (Dark)', icon: '👏🏿', activeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]' },
  { key: 'clap', label: 'Clap', icon: '👏', activeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]' },
  { key: 'hundred', label: '100', icon: '💯', activeColor: 'bg-amber-400/20 text-brand-gold border-brand-gold/40 shadow-[0_0_12px_rgba(245,195,68,0.3)]' },
];

export const CommentSection: React.FC<CommentSectionProps> = ({
  contentId,
  contentKey,
  contentType,
  contentTitle,
  initialComments,
  showHeader = true,
  className = '',
}) => {
  const { profile, user, isAdmin } = useAuth();
  const userId = profile?.id || user?.uid || 'guest';
  const isAuthenticated = Boolean(profile || user);

  const [comments, setComments] = useState<Comment[]>(() => {
    if (initialComments && initialComments.length > 0) return initialComments;
    return SocialCommentService.getComments(contentId, contentKey);
  });

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // In-place editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const refreshComments = () => {
    setComments(SocialCommentService.getComments(contentId, contentKey));
  };

  useEffect(() => {
    refreshComments();
    const unsub1 = SocialCommentService.subscribe(contentId, refreshComments);
    let unsub2: (() => void) | undefined;
    if (contentKey && contentKey !== contentId) {
      unsub2 = SocialCommentService.subscribe(contentKey, refreshComments);
    }
    const unsubAll = SocialCommentService.subscribeAll(refreshComments);

    return () => {
      unsub1();
      if (unsub2) unsub2();
      unsubAll();
    };
  }, [contentId, contentKey]);

  const handleToggleReaction = (commentId: string, emoji: CommentEmojiReaction, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    SocialCommentService.toggleReaction({
      commentId,
      emoji,
      userId,
      contentId,
    });
    setActiveReactionMenuId(null);
  };

  const handleDelete = (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      SocialCommentService.deleteComment(commentId, userId, isAdmin);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingText('');
      }
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleSaveEdit = (commentId: string) => {
    if (!editingText.trim()) return;
    const res = SocialCommentService.editComment({
      commentId,
      text: editingText.trim(),
      userId,
      isAdmin,
    });
    if (res.success) {
      setEditingCommentId(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleTogglePin = (commentId: string) => {
    SocialCommentService.pinComment(commentId, isAdmin);
  };

  const toggleThreadCollapse = (threadId: string) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const totalCommentCount = SocialCommentService.getCommentCount(contentId, contentKey);

  // Sorting
  const sortedComments = [...comments].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sortBy === 'top') {
      const scoreA =
        (a.reactions?.fire || 0) * 3 +
        (a.reactions?.heart || 0) * 2 +
        (a.reactions?.thumbs_up || 0) +
        (a.replyCount || 0) * 2;
      const scoreB =
        (b.reactions?.fire || 0) * 3 +
        (b.reactions?.heart || 0) * 2 +
        (b.reactions?.thumbs_up || 0) +
        (b.replyCount || 0) * 2;
      return scoreB - scoreA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const renderBadge = (role?: string, creatorType?: string) => {
    if (role === 'admin' || role === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-[10px] font-extrabold text-brand-gold uppercase tracking-wider">
          <Crown className="w-2.5 h-2.5" />
          <span>Admin</span>
        </span>
      );
    }
    if (creatorType === 'artist') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/40 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
          <Music className="w-2.5 h-2.5" />
          <span>Artist</span>
        </span>
      );
    }
    if (creatorType === 'producer') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
          <Sliders className="w-2.5 h-2.5" />
          <span>Producer</span>
        </span>
      );
    }
    if (creatorType === 'creator') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
          <Video className="w-2.5 h-2.5" />
          <span>Creator</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium text-neutral-400">
        <Shield className="w-2.5 h-2.5 text-neutral-400" />
        <span>Member</span>
      </span>
    );
  };

  /**
   * Format full exact date & time stamp (e.g. Oct 31, 2026 at 12:45 AM)
   */
  const formatExactDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const datePart = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} at ${timePart}`;
    } catch {
      return iso;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 3600000);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return `${Math.floor(days / 7)}w ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className={`space-y-6 pt-6 border-t border-white/10 ${className}`}>
      {/* Section Header */}
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-gold/20 to-brand-amber/10 border border-brand-gold/40 flex items-center justify-center text-brand-gold shadow-md">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <span>Community Discussion & Threads</span>
                <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-[11px] font-mono text-brand-gold font-black">
                  {totalCommentCount}
                </span>
              </h3>
              {contentTitle && (
                <p className="text-xs text-neutral-400 truncate max-w-md">
                  Discussing: <span className="text-neutral-200 font-semibold">{contentTitle}</span>
                </p>
              )}
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold">
            <button
              onClick={() => setSortBy('newest')}
              className={`px-3 py-1 rounded-lg transition-all ${sortBy === 'newest'
                  ? 'bg-brand-gold text-black font-extrabold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
                }`}
            >
              Newest
            </button>
            <button
              onClick={() => setSortBy('top')}
              className={`px-3 py-1 rounded-lg transition-all ${sortBy === 'top'
                  ? 'bg-brand-gold text-black font-extrabold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
                }`}
            >
              Top Reacted 🔥
            </button>
          </div>
        </div>
      )}

      {/* Main Thread Composer */}
      <CommentComposer
        contentId={contentId}
        contentKey={contentKey}
        contentType={contentType}
        contentTitle={contentTitle}
      />

      {/* Comments & Discussion Threads */}
      <div className="space-y-4 pt-2">
        {sortedComments.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-gold mx-auto">
              <MessageSquare className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-bold text-white">No discussion threads yet</p>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Be the first member to drop a comment, start a thread, or react with 🔥 and ❤️!
            </p>
          </div>
        ) : (
          sortedComments.map((comment) => {
            const userReactions = comment.userReactions?.[userId] || [];
            const isCollapsed = collapsedThreads.has(comment.id);
            const isAuthor =
              profile?.id === comment.userId ||
              user?.uid === comment.userId ||
              Boolean(
                profile?.email &&
                  comment.userEmail &&
                  comment.userEmail.toLowerCase() === profile.email.toLowerCase()
              );
            const displayAvatar = isAuthor && profile ? profile.avatarUrl : comment.userAvatar;
            const displayVideo = isAuthor && profile ? profile.profileVideoUrl : comment.userVideoUrl;
            const displayName = isAuthor && profile ? profile.name : comment.userName;
            const replies = comment.replies || [];
            const isEditing = editingCommentId === comment.id;

            return (
              <div
                key={comment.id}
                className={`relative group rounded-3xl transition-all duration-200 border p-4 sm:p-5 ${comment.isPinned
                    ? 'bg-gradient-to-b from-amber-500/[0.08] via-white/[0.03] to-transparent border-amber-500/30 shadow-[0_0_30px_rgba(245,195,68,0.08)]'
                    : 'bg-white/[0.03] hover:bg-white/[0.05] border-white/5 hover:border-white/10'
                  }`}
              >
                {/* Pinned Tag */}
                {comment.isPinned && (
                  <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-bold text-brand-gold">
                    <Pin className="w-3.5 h-3.5 fill-current" />
                    <span>PINNED BY PLATFORM AUTHORITY</span>
                  </div>
                )}

                {/* Header: User Info, Date & Time Stamp, Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={displayAvatar}
                      videoUrl={displayVideo}
                      name={displayName}
                      size="md"
                      borderClassName="border border-brand-purple/40 shadow-sm"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-white hover:text-brand-gold transition-colors">
                          {displayName}
                        </span>
                        {renderBadge(comment.userRole, comment.creatorType)}
                      </div>

                      {/* Explicit Date and Time Stamp */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400 font-mono mt-0.5">
                        <span className="flex items-center gap-1 text-neutral-300 font-semibold" title={comment.createdAt}>
                          <Calendar className="w-3 h-3 text-brand-gold shrink-0" />
                          <span>{formatExactDateTime(comment.createdAt)}</span>
                        </span>
                        <span className="text-neutral-500">•</span>
                        <span className="text-neutral-400">({formatRelativeTime(comment.createdAt)})</span>
                        {comment.isEdited && (
                          <span
                            className="text-brand-gold/80 italic text-[10px] ml-1"
                            title={comment.updatedAt ? `Edited: ${formatExactDateTime(comment.updatedAt)}` : 'Edited'}
                          >
                            (edited)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top Right Controls (Pin / Edit / Delete) */}
                  <div className="flex items-center gap-1 opacity-90 sm:opacity-75 group-hover:opacity-100 transition-opacity">
                    {isAdmin && (
                      <button
                        onClick={() => handleTogglePin(comment.id)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${comment.isPinned
                            ? 'text-brand-gold border-amber-500/40 bg-amber-500/10'
                            : 'text-neutral-400 hover:text-white border-transparent hover:border-white/10'
                          }`}
                        title={comment.isPinned ? 'Unpin thread' : 'Pin thread to top'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Edit Option for Author or Administrator */}
                    {(isAuthor || isAdmin) && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(comment)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-gold hover:bg-brand-gold/10 transition-colors cursor-pointer"
                        title="Edit comment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Option for Author or Administrator */}
                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment Content / In-Place Edit Mode */}
                <div className="pl-12 pt-2">
                  {isEditing ? (
                    <div className="space-y-2 p-3 rounded-2xl bg-black/40 border border-brand-gold/40">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none resize-none leading-relaxed"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={!editingText.trim()}
                          className="px-3.5 py-1 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-extrabold uppercase flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-wrap">
                      {comment.text}
                    </p>
                  )}
                </div>

                {/* Interactive Reactions & Reply Bar */}
                <div className="pl-12 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 mt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Emoji Reaction Buttons */}
                    {EMOJI_BUTTONS.map((emoji) => {
                      const count = comment.reactions?.[emoji.key] || 0;
                      const hasReacted = userReactions.includes(emoji.key);
                      const isCoreReaction =
                        emoji.key === 'fire' ||
                        emoji.key === 'heart' ||
                        emoji.key === 'thumbs_up_dark' ||
                        emoji.key === 'thumbs_down_dark' ||
                        emoji.key === 'thumbs_up';
                      if (count === 0 && !hasReacted && !isCoreReaction) {
                        return null;
                      }

                      return (
                        <button
                          key={emoji.key}
                          onClick={(e) => handleToggleReaction(comment.id, emoji.key, e)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${hasReacted
                              ? emoji.activeColor
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300 hover:text-white'
                            }`}
                          title={`React with ${emoji.label}`}
                        >
                          <span className="text-xs">{emoji.icon}</span>
                          {count > 0 && <span className="font-mono text-[11px]">{count}</span>}
                        </button>
                      );
                    })}

                    {/* Popover to React with Any Emoji */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveReactionMenuId(activeReactionMenuId === comment.id ? null : comment.id)
                        }
                        className="p-1 rounded-full text-neutral-400 hover:text-brand-gold hover:bg-white/5 transition-colors cursor-pointer"
                        title="Add emoji reaction"
                      >
                        <SmilePlus className="w-4 h-4" />
                      </button>

                      {activeReactionMenuId === comment.id && (
                        <div className="absolute left-0 bottom-full mb-2 z-30 flex items-center gap-1 p-1.5 rounded-2xl bg-[#1a1424] border border-white/15 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
                          {EMOJI_BUTTONS.map((emoji) => (
                            <button
                              key={emoji.key}
                              onClick={(e) => handleToggleReaction(comment.id, emoji.key, e)}
                              className="w-8 h-8 rounded-xl hover:bg-white/10 text-base flex items-center justify-center transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                              title={emoji.label}
                            >
                              {emoji.icon}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reply Button */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() =>
                        setReplyingToId(replyingToId === comment.id ? null : comment.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-semibold transition-colors cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>

                {/* Inline Reply Composer */}
                {replyingToId === comment.id && (
                  <div className="pl-12 pt-3">
                    <CommentComposer
                      contentId={contentId}
                      contentKey={contentKey}
                      contentType={contentType}
                      contentTitle={contentTitle}
                      parentCommentId={comment.id}
                      replyToName={comment.userName}
                      autoFocus
                      onCommentSubmitted={() => setReplyingToId(null)}
                      onCancel={() => setReplyingToId(null)}
                    />
                  </div>
                )}

                {/* Threaded Replies with curved tree line styling */}
                {replies.length > 0 && (
                  <div className="pl-12 pt-3 space-y-3">
                    {/* Collapsible toggle */}
                    <button
                      onClick={() => toggleThreadCollapse(comment.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand-gold hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {isCollapsed ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Show {replies.length} {replies.length === 1 ? 'reply' : 'replies'} in thread</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Hide replies</span>
                        </>
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2.5 border-l-2 border-brand-purple/40 pl-4 ml-1">
                        {replies.map((reply) => {
                          const replyUserReactions = reply.userReactions?.[userId] || [];
                          const isReplyAuthor =
                            profile?.id === reply.userId ||
                            user?.uid === reply.userId ||
                            Boolean(
                              profile?.email &&
                                reply.userEmail &&
                                reply.userEmail.toLowerCase() === profile.email.toLowerCase()
                            );
                          const replyAvatar = isReplyAuthor && profile ? profile.avatarUrl : reply.userAvatar;
                          const replyVideo = isReplyAuthor && profile ? profile.profileVideoUrl : reply.userVideoUrl;
                          const replyName = isReplyAuthor && profile ? profile.name : reply.userName;
                          const isReplyEditing = editingCommentId === reply.id;

                          return (
                            <div
                              key={reply.id}
                              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 space-y-2 relative"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <UserAvatar
                                    avatarUrl={replyAvatar}
                                    videoUrl={replyVideo}
                                    name={replyName}
                                    size="xs"
                                    borderClassName="border border-brand-purple/30"
                                  />
                                  <span className="text-xs font-bold text-white">
                                    {replyName}
                                  </span>
                                  {renderBadge(reply.userRole, reply.creatorType)}

                                  {/* Reply Date & Time Stamp */}
                                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                                    <Clock className="w-2.5 h-2.5 text-brand-gold" />
                                    <span>{formatExactDateTime(reply.createdAt)}</span>
                                    <span>({formatRelativeTime(reply.createdAt)})</span>
                                    {reply.isEdited && (
                                      <span className="text-brand-gold/80 italic text-[9px]">(edited)</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  {(isReplyAuthor || isAdmin) && !isReplyEditing && (
                                    <button
                                      onClick={() => handleStartEdit(reply)}
                                      className="p-1 rounded text-neutral-400 hover:text-brand-gold transition-colors cursor-pointer"
                                      title="Edit reply"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  {(isReplyAuthor || isAdmin) && (
                                    <button
                                      onClick={() => handleDelete(reply.id)}
                                      className="p-1 rounded text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                                      title="Delete reply"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isReplyEditing ? (
                                <div className="space-y-2 p-2.5 rounded-xl bg-black/40 border border-brand-gold/40 pl-8">
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    rows={2}
                                    className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none resize-none"
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-2.5 py-0.5 rounded-lg bg-white/5 text-neutral-300 text-[11px]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(reply.id)}
                                      className="px-3 py-0.5 rounded-lg bg-brand-gold text-black text-[11px] font-extrabold uppercase"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-neutral-300 leading-relaxed pl-8 whitespace-pre-wrap">
                                  {reply.text}
                                </p>
                              )}

                              {/* Reply Reactions Bar */}
                              <div className="pl-8 pt-1 flex items-center gap-1.5 flex-wrap">
                                {EMOJI_BUTTONS.map((emoji) => {
                                  const count = reply.reactions?.[emoji.key] || 0;
                                  const hasReacted = replyUserReactions.includes(emoji.key);
                                  if (count === 0 && !hasReacted) return null;

                                  return (
                                    <button
                                      key={emoji.key}
                                      onClick={(e) => handleToggleReaction(reply.id, emoji.key, e)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${hasReacted
                                          ? emoji.activeColor
                                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                                        }`}
                                    >
                                      <span>{emoji.icon}</span>
                                      {count > 0 && <span className="font-mono">{count}</span>}
                                    </button>
                                  );
                                })}

                                <button
                                  onClick={(e) => handleToggleReaction(reply.id, 'fire', e)}
                                  className="text-xs text-neutral-400 hover:text-brand-gold p-1 cursor-pointer"
                                  title="React 🔥"
                                >
                                  🔥
                                </button>
                                <button
                                  onClick={(e) => handleToggleReaction(reply.id, 'heart', e)}
                                  className="text-xs text-neutral-400 hover:text-rose-400 p-1 cursor-pointer"
                                  title="React ❤️"
                                >
                                  ❤️
                                </button>
                                <button
                                  onClick={(e) => handleToggleReaction(reply.id, 'thumbs_up_dark', e)}
                                  className="text-xs text-neutral-400 hover:text-amber-300 p-1 cursor-pointer"
                                  title="React 👍🏿 (Black Thumbs Up)"
                                >
                                  👍🏿
                                </button>
                                <button
                                  onClick={(e) => handleToggleReaction(reply.id, 'thumbs_down_dark', e)}
                                  className="text-xs text-neutral-400 hover:text-neutral-200 p-1 cursor-pointer"
                                  title="React 👎🏿 (Black Thumbs Down)"
                                >
                                  👎🏿
                                </button>
                                <button
                                  onClick={(e) => handleToggleReaction(reply.id, 'thumbs_up', e)}
                                  className="text-xs text-neutral-400 hover:text-emerald-400 p-1 cursor-pointer"
                                  title="React 👍"
                                >
                                  👍
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Auth Gate for Visitors */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Sign In to Join Discussion & React"
          description="Create your free member account or sign in to react with fire, drop hearts, post comments, and create discussion threads."
          initialTab="signup"
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
};
