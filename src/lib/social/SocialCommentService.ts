'use client';

import {
  Comment,
  UniversalContentType,
  CommentEmojiReaction,
  CommentReactionCounts,
} from '@/types/social';

const STORAGE_KEY = 'spades_platform_comments_v3';
const BROADCAST_CHANNEL = 'spades_comments_channel';
const BROADCAST_EVENT_KEY = 'spades_comments_broadcast_event';

export const createDefaultReactions = (): CommentReactionCounts => ({
  thumbs_up: 0,
  thumbs_down: 0,
  thumbs_up_dark: 0,
  thumbs_down_dark: 0,
  heart: 0,
  fire: 0,
  clap: 0,
  clap_dark: 0,
  hundred: 0,
});

/**
 * Build canonical composite key for any content item (e.g. "song:sailing:::avant")
 * so comments and discussion threads connect universally across the platform
 */
export function buildCanonicalContentKey(
  type: string,
  title?: string,
  artistOrAuthor?: string
): string {
  if (!title) return '';
  const cleanType = (type || 'song').toLowerCase().trim();
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanArtist = (artistOrAuthor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanType}:${cleanTitle}:::${cleanArtist}`;
}

export interface MetricBucket {
  key: string;
  label: string;
  count: number;
  reactions: number;
  uniqueUsers: number;
  percentage?: number;
}

export interface CommentAnalyticsSummary {
  totalComments: number;
  totalReplies: number;
  totalReactions: number;
  uniqueUsersCount: number;
  buckets: MetricBucket[];
  peakBucketLabel: string;
  peakBucketCount: number;
  contentTypeDistribution: Record<string, number>;
}

/**
 * Authentic multi-pillar seed community threads with hourly, daily, weekly, monthly, and yearly historical spread
 */
const SEED_COMMENTS: Comment[] = [];

type CommentListener = (comments: Comment[]) => void;
type GlobalListener = () => void;

class SocialCommentServiceClass {
  private comments: Comment[] = [];
  private listeners: Map<string, Set<CommentListener>> = new Map();
  private globalListeners: Set<GlobalListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadComments();
      this.initCrossTab();
    }
  }

  private loadComments(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strictly purge synthetic seed comments so only authentic member/admin comments exist
          const realComments = parsed.filter(
            (c: Comment) =>
              c &&
              typeof c.id === 'string' &&
              !c.id.startsWith('comm-seed-') &&
              !c.id.startsWith('comm-1') &&
              !c.id.startsWith('comm-2') &&
              c.userId !== 'usr-demo' &&
              c.userId !== 'demo-user'
          );
          this.comments = realComments;
          this.persistComments();
          return;
        }
      }
    } catch (e) {
      console.warn('[SocialCommentService] Failed to load comments from storage:', e);
    }
    // Only real comments created by members and admins
    this.comments = [];
    this.persistComments();
  }

  private persistComments(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.comments));
    } catch (e) {
      console.warn('[SocialCommentService] Failed to persist comments:', e);
    }
  }

  private initCrossTab(): void {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'COMMENTS_UPDATED') {
            this.loadComments();
            this.notifyAll();
          }
        };
      } catch (e) {}
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === BROADCAST_EVENT_KEY) {
        this.loadComments();
        this.notifyAll();
      }
    });
  }

  private broadcastUpdate(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'COMMENTS_UPDATED', timestamp: Date.now() });
      }
      localStorage.setItem(
        BROADCAST_EVENT_KEY,
        JSON.stringify({ type: 'COMMENTS_UPDATED', timestamp: Date.now() })
      );
      window.dispatchEvent(
        new CustomEvent('spades_comments_updated', { detail: { timestamp: Date.now() } })
      );
    } catch (e) {}
  }

  private notify(contentId: string): void {
    const list = this.getComments(contentId);
    const norm = this.normalizeId(contentId);
    const set = this.listeners.get(norm);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(list);
        } catch (err) {
          console.error('[SocialCommentService] Listener error:', err);
        }
      });
    }
    this.globalListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {}
    });
  }

  private notifyAll(): void {
    this.listeners.forEach((set, contentId) => {
      const list = this.getComments(contentId);
      set.forEach((cb) => {
        try {
          cb(list);
        } catch (err) {}
      });
    });
    this.globalListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {}
    });
  }

  /**
   * Normalize content identifiers (e.g. 'track-123' or '123' or slug)
   */
  public normalizeId(id: string): string {
    return (id || '').trim().toLowerCase();
  }

  /**
   * Check if a comment matches a target identifier or canonical key.
   * Cross-matches between projects, audiobooks, songs, and albums so comments follow content everywhere.
   */
  private matchesTarget(c: Comment, targetId: string, targetKey?: string): boolean {
    const cId = this.normalizeId(c.contentId);
    const normTarget = this.normalizeId(targetId);
    if (cId === normTarget) return true;

    if (targetKey) {
      const normKey = this.normalizeId(targetKey);
      if (cId === normKey) return true;
      if (c.contentKey && this.normalizeId(c.contentKey) === normKey) return true;

      // Cross-match between project and audiobook (e.g. project:saturdaynightsundaymorning vs audiobook:saturdaynightsundaymorning)
      const stripPrefix = (k: string) => k.replace(/^(project|audiobook|podcast|song|album|video|media):/, '');
      const strippedTarget = stripPrefix(normKey);
      if (c.contentKey && stripPrefix(this.normalizeId(c.contentKey)) === strippedTarget) {
        return true;
      }
      if (stripPrefix(cId) === strippedTarget) {
        return true;
      }
    }

    if (c.contentKey && this.normalizeId(c.contentKey) === normTarget) return true;

    return false;
  }

  /**
   * Get all top-level comments and nested discussion threads for a specific content item.
   * Supports canonical keys so comments follow content everywhere across the platform.
   */
  public getComments(contentId: string, alternateKey?: string): Comment[] {
    return this.comments
      .filter((c) => this.matchesTarget(c, contentId, alternateKey) && !c.parentCommentId)
      .map((parent) => {
        // Attach all nested replies to the parent thread
        const nestedReplies = this.comments.filter(
          (c) => c.parentCommentId === parent.id
        );
        return {
          ...parent,
          replyCount: nestedReplies.length,
          replies: nestedReplies.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        };
      })
      .sort((a, b) => {
        // Pinned comments float to the top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  /**
   * Total comments count for a specific content item including all nested replies
   */
  public getCommentCount(contentId: string, alternateKey?: string): number {
    return this.comments.filter((c) => this.matchesTarget(c, contentId, alternateKey)).length;
  }

  /**
   * Total comments count across the entire platform
   */
  public getTotalCommentsAcrossPlatform(): number {
    return this.comments.length;
  }

  /**
   * Get flat list of all comments and replies (for reporting and admin moderation)
   */
  public getAllCommentsFlat(): (Comment & { isReply: boolean; parentCommentId?: string | null })[] {
    const list: (Comment & { isReply: boolean; parentCommentId?: string | null })[] = [];
    this.comments.forEach((c) => {
      list.push({ ...c, isReply: false });
      if (c.replies && c.replies.length > 0) {
        c.replies.forEach((r) => {
          list.push({ ...r, isReply: true, parentCommentId: c.id });
        });
      }
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Post a new comment or start a new discussion thread
   */
  public addComment(params: {
    contentId: string;
    contentKey?: string;
    contentType: UniversalContentType;
    contentTitle?: string;
    text: string;
    userId: string;
    userName: string;
    userEmail?: string;
    userHandle?: string;
    userAvatar?: string;
    userRole?: string;
    creatorType?: string;
    parentCommentId?: string | null;
  }): Comment {
    const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newComment: Comment = {
      id,
      contentId: params.contentId,
      contentKey: params.contentKey || (params.contentTitle ? buildCanonicalContentKey(params.contentType, params.contentTitle) : undefined),
      contentType: params.contentType,
      contentTitle: params.contentTitle,
      userId: params.userId,
      userName: params.userName || 'Member',
      userEmail: params.userEmail,
      userHandle: params.userHandle,
      userAvatar: params.userAvatar || '/images/logo.png',
      userRole: params.userRole || 'user',
      creatorType: params.creatorType,
      text: params.text.trim(),
      createdAt: new Date().toISOString(),
      parentCommentId: params.parentCommentId || null,
      likeCount: 0,
      replyCount: 0,
      replies: [],
      reactions: createDefaultReactions(),
      userReactions: {},
      isPinned: false,
    };

    // If this is a reply to an existing parent comment, update the parent's replyCount
    if (params.parentCommentId) {
      this.comments = this.comments.map((c) => {
        if (c.id === params.parentCommentId) {
          return {
            ...c,
            replyCount: (c.replyCount || 0) + 1,
            replies: [...(c.replies || []), newComment],
          };
        }
        return c;
      });
    }

    this.comments.unshift(newComment);
    this.persistComments();
    this.broadcastUpdate();
    this.notify(params.contentId);
    if (params.contentKey) {
      this.notify(params.contentKey);
    }

    return newComment;
  }

  /**
   * Edit comment or reply (permitted for comment author or platform administrator)
   */
  public editComment(params: {
    commentId: string;
    text: string;
    userId: string;
    isAdmin?: boolean;
  }): { success: boolean; comment?: Comment } {
    let updatedComment: Comment | undefined;
    let targetContentId = '';

    this.comments = this.comments.map((c) => {
      if (c.id === params.commentId) {
        if (c.userId !== params.userId && !params.isAdmin) {
          console.warn('[SocialCommentService] Unauthorized comment edit attempt');
          return c;
        }
        targetContentId = c.contentId;
        updatedComment = {
          ...c,
          text: params.text.trim(),
          updatedAt: new Date().toISOString(),
          isEdited: true,
        };
        return updatedComment;
      }

      if (c.replies && c.replies.length > 0) {
        let changed = false;
        const updatedReplies = c.replies.map((r) => {
          if (r.id === params.commentId) {
            if (r.userId !== params.userId && !params.isAdmin) {
              console.warn('[SocialCommentService] Unauthorized reply edit attempt');
              return r;
            }
            changed = true;
            targetContentId = c.contentId;
            updatedComment = {
              ...r,
              text: params.text.trim(),
              updatedAt: new Date().toISOString(),
              isEdited: true,
            };
            return updatedComment;
          }
          return r;
        });

        if (changed) {
          return {
            ...c,
            replies: updatedReplies,
          };
        }
      }

      return c;
    });

    if (updatedComment) {
      this.persistComments();
      this.broadcastUpdate();
      if (targetContentId) this.notify(targetContentId);
      return { success: true, comment: updatedComment };
    }

    return { success: false };
  }

  /**
   * Toggle emoji reaction (thumbs_up, thumbs_down, heart, fire, clap, hundred) on any comment or thread
   */
  public toggleReaction(params: {
    commentId: string;
    emoji: CommentEmojiReaction;
    userId: string;
    contentId?: string;
  }): { comment: Comment | undefined; activeReactions: CommentEmojiReaction[] } {
    let targetContentId = params.contentId;
    let updatedComment: Comment | undefined;
    let activeReactions: CommentEmojiReaction[] = [];

    this.comments = this.comments.map((c) => {
      if (c.id === params.commentId) {
        if (!targetContentId) targetContentId = c.contentId;
        const currentReactions = { ...(c.reactions || createDefaultReactions()) };
        const userMap = { ...(c.userReactions || {}) };
        const userList: CommentEmojiReaction[] = [...(userMap[params.userId] || [])];

        const hasReacted = userList.includes(params.emoji);

        if (hasReacted) {
          // Remove emoji reaction
          const filtered = userList.filter((e) => e !== params.emoji);
          userMap[params.userId] = filtered;
          activeReactions = filtered;
          currentReactions[params.emoji] = Math.max(0, (currentReactions[params.emoji] || 0) - 1);
        } else {
          // Add emoji reaction
          userList.push(params.emoji);
          userMap[params.userId] = userList;
          activeReactions = userList;
          currentReactions[params.emoji] = (currentReactions[params.emoji] || 0) + 1;
        }

        // Keep legacy likeCount synchronized
        const totalLikes =
          (currentReactions.thumbs_up || 0) +
          (currentReactions.thumbs_up_dark || 0) +
          (currentReactions.fire || 0) +
          (currentReactions.heart || 0);

        updatedComment = {
          ...c,
          reactions: currentReactions,
          userReactions: userMap,
          likeCount: totalLikes,
        };
        return updatedComment;
      }

      // Check nested replies
      if (c.replies && c.replies.length > 0) {
        let replyChanged = false;
        const updatedReplies = c.replies.map((r) => {
          if (r.id === params.commentId) {
            replyChanged = true;
            if (!targetContentId) targetContentId = c.contentId;
            const currentReactions = { ...(r.reactions || createDefaultReactions()) };
            const userMap = { ...(r.userReactions || {}) };
            const userList: CommentEmojiReaction[] = [...(userMap[params.userId] || [])];
            const hasReacted = userList.includes(params.emoji);

            if (hasReacted) {
              const filtered = userList.filter((e) => e !== params.emoji);
              userMap[params.userId] = filtered;
              activeReactions = filtered;
              currentReactions[params.emoji] = Math.max(0, (currentReactions[params.emoji] || 0) - 1);
            } else {
              userList.push(params.emoji);
              userMap[params.userId] = userList;
              activeReactions = userList;
              currentReactions[params.emoji] = (currentReactions[params.emoji] || 0) + 1;
            }

            const totalLikes =
              (currentReactions.thumbs_up || 0) +
              (currentReactions.thumbs_up_dark || 0) +
              (currentReactions.fire || 0) +
              (currentReactions.heart || 0);

            updatedComment = {
              ...r,
              reactions: currentReactions,
              userReactions: userMap,
              likeCount: totalLikes,
            };
            return updatedComment;
          }
          return r;
        });

        if (replyChanged) {
          return {
            ...c,
            replies: updatedReplies,
          };
        }
      }

      return c;
    });

    this.persistComments();
    this.broadcastUpdate();
    if (targetContentId) {
      this.notify(targetContentId);
    }

    return { comment: updatedComment, activeReactions };
  }

  /**
   * Delete a comment (permitted for author or administrator)
   */
  public deleteComment(commentId: string, userId: string, isAdmin = false): boolean {
    const existing = this.comments.find((c) => c.id === commentId);
    let targetContentId = existing?.contentId;

    if (!existing) {
      // Could be a nested reply
      for (const parent of this.comments) {
        const foundReply = parent.replies?.find((r) => r.id === commentId);
        if (foundReply) {
          if (foundReply.userId !== userId && !isAdmin) {
            console.warn('[SocialCommentService] Unauthorized reply deletion attempt');
            return false;
          }
          targetContentId = parent.contentId;
          break;
        }
      }
    } else {
      if (existing.userId !== userId && !isAdmin) {
        console.warn('[SocialCommentService] Unauthorized comment deletion attempt');
        return false;
      }
    }

    // Remove top-level and children
    this.comments = this.comments.filter(
      (c) => c.id !== commentId && c.parentCommentId !== commentId
    );

    // Also update any parent's nested replies list
    this.comments = this.comments.map((c) => {
      if (c.replies && c.replies.some((r) => r.id === commentId)) {
        const remaining = c.replies.filter((r) => r.id !== commentId);
        return {
          ...c,
          replyCount: remaining.length,
          replies: remaining,
        };
      }
      return c;
    });

    this.persistComments();
    this.broadcastUpdate();
    if (targetContentId) {
      this.notify(targetContentId);
    } else {
      this.notifyAll();
    }
    return true;
  }

  /**
   * Permanently purge all comments and threads across the platform (Administrator only)
   */
  public removeAllComments(isAdmin = false): boolean {
    if (!isAdmin) {
      console.warn('[SocialCommentService] Unauthorized attempt to remove all comments');
      return false;
    }
    this.comments = [];
    this.persistComments();
    this.broadcastUpdate();
    this.notifyAll();
    return true;
  }

  /**
   * Pin or unpin a top-level thread to the top of the discussion (admin only)
   */
  public pinComment(commentId: string, isAdmin = false): boolean {
    if (!isAdmin) return false;
    let targetContentId = '';

    this.comments = this.comments.map((c) => {
      if (c.id === commentId) {
        targetContentId = c.contentId;
        return {
          ...c,
          isPinned: !c.isPinned,
        };
      }
      return c;
    });

    this.persistComments();
    this.broadcastUpdate();
    if (targetContentId) this.notify(targetContentId);
    return true;
  }

  /**
   * Get active user reactions for a specific comment
   */
  public getUserReactions(commentId: string, userId: string): CommentEmojiReaction[] {
    const comment = this.comments.find((c) => c.id === commentId);
    if (comment?.userReactions && comment.userReactions[userId]) {
      return comment.userReactions[userId];
    }
    for (const c of this.comments) {
      if (c.replies) {
        const rep = c.replies.find((r) => r.id === commentId);
        if (rep?.userReactions && rep.userReactions[userId]) {
          return rep.userReactions[userId];
        }
      }
    }
    return [];
  }

  /**
   * Calculate activity telemetry and metrics grouped by hourly, daily, weekly, monthly, or yearly
   */
  public getCommentMetrics(
    timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    options?: { userId?: string; contentType?: string }
  ): CommentAnalyticsSummary {
    const all = this.getAllCommentsFlat().filter((c) => {
      if (options?.userId && c.userId !== options.userId) return false;
      if (options?.contentType && c.contentType !== options.contentType) return false;
      return true;
    });

    const totalComments = all.filter((c) => !c.isReply).length;
    const totalReplies = all.filter((c) => c.isReply).length;
    const uniqueUsers = new Set(all.map((c) => c.userId));
    let totalReactions = 0;
    const contentTypeDistribution: Record<string, number> = {};

    all.forEach((c) => {
      const type = c.contentType || 'other';
      contentTypeDistribution[type] = (contentTypeDistribution[type] || 0) + 1;
      if (c.reactions) {
        totalReactions += Object.values(c.reactions).reduce((a, b) => (a || 0) + (b || 0), 0);
      }
    });

    const now = new Date();
    const bucketsMap: Map<string, { label: string; count: number; reactions: number; users: Set<string> }> = new Map();

    if (timeframe === 'hourly') {
      // Past 24 hours in 2-hour increments
      for (let i = 22; i >= 0; i -= 2) {
        const t = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourStr = t.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const key = `h_${t.getHours()}`;
        bucketsMap.set(key, { label: hourStr, count: 0, reactions: 0, users: new Set() });
      }

      all.forEach((c) => {
        const d = new Date(c.createdAt);
        const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
        if (diffHours <= 24) {
          const roundedHour = Math.floor(d.getHours() / 2) * 2;
          const key = `h_${roundedHour}`;
          if (bucketsMap.has(key)) {
            const b = bucketsMap.get(key)!;
            b.count++;
            b.users.add(c.userId);
            if (c.reactions) {
              b.reactions += Object.values(c.reactions).reduce((acc, val) => acc + (val || 0), 0);
            }
          }
        }
      });
    } else if (timeframe === 'daily') {
      // Past 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        bucketsMap.set(key, { label, count: 0, reactions: 0, users: new Set() });
      }

      all.forEach((c) => {
        const key = c.createdAt.split('T')[0];
        if (bucketsMap.has(key)) {
          const b = bucketsMap.get(key)!;
          b.count++;
          b.users.add(c.userId);
          if (c.reactions) {
            b.reactions += Object.values(c.reactions).reduce((acc, val) => acc + (val || 0), 0);
          }
        }
      });
    } else if (timeframe === 'weekly') {
      // Past 8 weeks
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const key = `Wk ${8 - i}`;
        const label = `Wk ${8 - i} (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
        bucketsMap.set(key, { label, count: 0, reactions: 0, users: new Set() });
      }

      all.forEach((c) => {
        const diffWeeks = Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (diffWeeks >= 0 && diffWeeks < 8) {
          const key = `Wk ${8 - diffWeeks}`;
          if (bucketsMap.has(key)) {
            const b = bucketsMap.get(key)!;
            b.count++;
            b.users.add(c.userId);
            if (c.reactions) {
              b.reactions += Object.values(c.reactions).reduce((acc, val) => acc + (val || 0), 0);
            }
          }
        }
      });
    } else if (timeframe === 'monthly') {
      // Past 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        bucketsMap.set(key, { label, count: 0, reactions: 0, users: new Set() });
      }

      all.forEach((c) => {
        const d = new Date(c.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (bucketsMap.has(key)) {
          const b = bucketsMap.get(key)!;
          b.count++;
          b.users.add(c.userId);
          if (c.reactions) {
            b.reactions += Object.values(c.reactions).reduce((acc, val) => acc + (val || 0), 0);
          }
        }
      });
    } else {
      // Yearly (2024, 2025, 2026, etc.)
      const years = [2024, 2025, 2026];
      years.forEach((yr) => {
        bucketsMap.set(String(yr), { label: String(yr), count: 0, reactions: 0, users: new Set() });
      });

      all.forEach((c) => {
        const yr = String(new Date(c.createdAt).getFullYear());
        if (bucketsMap.has(yr)) {
          const b = bucketsMap.get(yr)!;
          b.count++;
          b.users.add(c.userId);
          if (c.reactions) {
            b.reactions += Object.values(c.reactions).reduce((acc, val) => acc + (val || 0), 0);
          }
        }
      });
    }

    const totalBucketCount = Array.from(bucketsMap.values()).reduce((acc, b) => acc + b.count, 0) || 1;
    let peakLabel = 'None';
    let peakCount = 0;

    const buckets: MetricBucket[] = Array.from(bucketsMap.entries()).map(([key, data]) => {
      if (data.count > peakCount) {
        peakCount = data.count;
        peakLabel = data.label;
      }
      return {
        key,
        label: data.label,
        count: data.count,
        reactions: data.reactions,
        uniqueUsers: data.users.size,
        percentage: Math.round((data.count / totalBucketCount) * 100),
      };
    });

    return {
      totalComments,
      totalReplies,
      totalReactions,
      uniqueUsersCount: uniqueUsers.size,
      buckets,
      peakBucketLabel: peakLabel,
      peakBucketCount: peakCount,
      contentTypeDistribution,
    };
  }

  /**
   * Subscribe to real-time changes for a specific content item or canonical key
   */
  public subscribe(contentId: string, listener: CommentListener): () => void {
    const norm = this.normalizeId(contentId);
    if (!this.listeners.has(norm)) {
      this.listeners.set(norm, new Set());
    }
    this.listeners.get(norm)!.add(listener);

    // Initial invocation
    listener(this.getComments(contentId));

    return () => {
      const set = this.listeners.get(norm);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(norm);
        }
      }
    };
  }

  /**
   * Global subscription for comment counts / badge updates / admin tables
   */
  public subscribeAll(listener: GlobalListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }
}

export const SocialCommentService = new SocialCommentServiceClass();
