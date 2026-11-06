'use client';

import { FavoritesService, FavoriteCategory } from '@/lib/favorites/FavoritesService';
import { EngagementMetricsService, ReactionKind } from '@/lib/analytics/EngagementMetricsService';

export type UniversalReactionType =
  | 'fire'
  | 'heart'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'thumbs_up_dark'
  | 'thumbs_down_dark'
  | 'clap'
  | 'hundred';

export interface ContentReactions {
  fireCount: number;
  heartCount: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  thumbsUpDarkCount: number;
  thumbsDownDarkCount: number;
  clapCount: number;
  hundredCount: number;
  hasFire: boolean;
  hasHeart: boolean;
  hasThumbsUp: boolean;
  hasThumbsDown: boolean;
  hasThumbsUpDark: boolean;
  hasThumbsDownDark: boolean;
  hasClap: boolean;
  hasHundred: boolean;
}

type ReactionListener = (reactions: ContentReactions) => void;

interface ItemReactionStore {
  counts: {
    fire: number;
    heart: number;
    thumbs_up: number;
    thumbs_down: number;
    thumbs_up_dark: number;
    thumbs_down_dark: number;
    clap: number;
    hundred: number;
  };
  userReactions: Record<string, Partial<Record<UniversalReactionType, boolean>>>;
}

const STORAGE_KEY = 'spades_content_emoji_reactions_v2';
const BROADCAST_CHANNEL = 'spades_emoji_reactions_channel';

export class ReactionService {
  private static listeners: Map<string, Set<ReactionListener>> = new Map();
  private static store: Record<string, ItemReactionStore> = {};
  private static isInitialized = false;
  private static broadcastChannel: BroadcastChannel | null = null;

  private static initStore(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.store = JSON.parse(raw);
      }
    } catch (e) {
      this.store = {};
    }

    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'REACTION_UPDATED') {
            this.reloadFromStorage();
            if (event.data.contentId) {
              const state = this.getReactions(event.data.contentId);
              this.notify(event.data.contentId, state);
            }
            if (event.data.contentKey) {
              const state = this.getReactions(event.data.contentKey);
              this.notify(event.data.contentKey, state);
            }
          }
        };
      } catch (e) { }
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.reloadFromStorage();
      }
    });
  }

  private static reloadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.store = JSON.parse(raw);
      }
    } catch (e) { }
  }

  private static saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) { }
  }

  private static normalizeKey(k: string): string {
    return (k || '').trim().toLowerCase();
  }

  private static stripPrefix(k: string): string {
    return this.normalizeKey(k).replace(/^(project|audiobook|podcast|song|album|video|media):/, '');
  }

  private static getOrCreateRecord(idOrKey: string): ItemReactionStore {
    const norm = this.normalizeKey(idOrKey);
    if (!this.store[norm]) {
      this.store[norm] = {
        counts: {
          fire: 0,
          heart: 0,
          thumbs_up: 0,
          thumbs_down: 0,
          thumbs_up_dark: 0,
          thumbs_down_dark: 0,
          clap: 0,
          hundred: 0,
        },
        userReactions: {},
      };
    }
    return this.store[norm];
  }

  /**
   * Get reactions for a specific content item or canonical key.
   * Merges authentic EngagementMetricsService counts with multi-emoji reactions.
   * Cross-matches so emojis follow content and projects universally.
   */
  public static getReactions(
    contentId: string,
    userId: string = 'guest',
    _fallbackLikes: number = 0,
    contentKey?: string
  ): ContentReactions {
    this.initStore();

    const normId = this.normalizeKey(contentId);
    const normKey = contentKey ? this.normalizeKey(contentKey) : '';
    const strippedId = this.stripPrefix(normId);
    const strippedKey = normKey ? this.stripPrefix(normKey) : '';

    // 1. Authentic baseline from EngagementMetricsService
    const emHeart = Math.max(
      EngagementMetricsService.getLikeCount(normId),
      normKey ? EngagementMetricsService.getLikeCount(normKey) : 0
    );
    const emFire = Math.max(
      EngagementMetricsService.getFireCount(normId),
      normKey ? EngagementMetricsService.getFireCount(normKey) : 0
    );
    const emHasHeart =
      EngagementMetricsService.isLikedByUser(normId, userId, 'heart') ||
      (Boolean(normKey) && EngagementMetricsService.isLikedByUser(normKey, userId, 'heart'));
    const emHasFire =
      EngagementMetricsService.isLikedByUser(normId, userId, 'fire') ||
      (Boolean(normKey) && EngagementMetricsService.isLikedByUser(normKey, userId, 'fire'));

    // 2. Query matching records from extended store
    const matchingRecords: ItemReactionStore[] = [];
    if (this.store[normId]) matchingRecords.push(this.store[normId]);
    if (normKey && this.store[normKey]) matchingRecords.push(this.store[normKey]);

    // Cross-match stripped keys (e.g. project:saturday... vs audiobook:saturday...)
    Object.entries(this.store).forEach(([k, rec]) => {
      const stripped = this.stripPrefix(k);
      if (stripped && (stripped === strippedId || stripped === strippedKey)) {
        if (!matchingRecords.includes(rec)) {
          matchingRecords.push(rec);
        }
      }
    });

    const fireCount = Math.max(emFire, ...matchingRecords.map((r) => r.counts.fire || 0));
    const heartCount = Math.max(emHeart, ...matchingRecords.map((r) => r.counts.heart || 0));
    const thumbsUpCount = Math.max(0, ...matchingRecords.map((r) => r.counts.thumbs_up || 0));
    const thumbsDownCount = Math.max(0, ...matchingRecords.map((r) => r.counts.thumbs_down || 0));
    const thumbsUpDarkCount = Math.max(0, ...matchingRecords.map((r) => r.counts.thumbs_up_dark || 0));
    const thumbsDownDarkCount = Math.max(0, ...matchingRecords.map((r) => r.counts.thumbs_down_dark || 0));
    const clapCount = Math.max(0, ...matchingRecords.map((r) => r.counts.clap || 0));
    const hundredCount = Math.max(0, ...matchingRecords.map((r) => r.counts.hundred || 0));

    const hasFire = emHasFire || matchingRecords.some((r) => Boolean(r.userReactions[userId]?.fire));
    const hasHeart = emHasHeart || matchingRecords.some((r) => Boolean(r.userReactions[userId]?.heart));
    const hasThumbsUp = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.thumbs_up));
    const hasThumbsDown = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.thumbs_down));
    const hasThumbsUpDark = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.thumbs_up_dark));
    const hasThumbsDownDark = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.thumbs_down_dark));
    const hasClap = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.clap));
    const hasHundred = matchingRecords.some((r) => Boolean(r.userReactions[userId]?.hundred));

    return {
      fireCount,
      heartCount,
      thumbsUpCount,
      thumbsDownCount,
      thumbsUpDarkCount,
      thumbsDownDarkCount,
      clapCount,
      hundredCount,
      hasFire,
      hasHeart,
      hasThumbsUp,
      hasThumbsDown,
      hasThumbsUpDark,
      hasThumbsDownDark,
      hasClap,
      hasHundred,
    };
  }

  /**
   * Toggle any reaction (Fire, Heart, Thumbs Up, Thumbs Down, Black Thumbs Up, Black Thumbs Down)
   * Synchronizes across both contentId and canonical contentKey so emojis follow content universally.
   */
  public static toggleReaction(
    contentId: string,
    reactionType: UniversalReactionType,
    contentType: string = 'media',
    userId: string = 'guest',
    _fallbackLikes: number = 0,
    options?: {
      contentTitle?: string;
      userName?: string;
      userEmail?: string;
      contextLocation?: string;
      contentKey?: string;
    }
  ): ContentReactions {
    this.initStore();

    const normId = this.normalizeKey(contentId);
    const normKey = options?.contentKey ? this.normalizeKey(options.contentKey) : '';

    // Synchronize fire & heart with authentic EngagementMetricsService
    if (reactionType === 'fire' || reactionType === 'heart') {
      EngagementMetricsService.recordInteraction({
        contentId: normId,
        contentTitle: options?.contentTitle,
        contentType,
        reactionType: reactionType as ReactionKind,
        userId,
        userName: options?.userName,
        userEmail: options?.userEmail,
        contextLocation: options?.contextLocation || 'Platform Player',
      });
      if (normKey && normKey !== normId) {
        EngagementMetricsService.recordInteraction({
          contentId: normKey,
          contentTitle: options?.contentTitle,
          contentType,
          reactionType: reactionType as ReactionKind,
          userId,
          userName: options?.userName,
          userEmail: options?.userEmail,
          contextLocation: options?.contextLocation || 'Platform Player',
        });
      }
    }

    // Update in local extended store on all target identifiers
    const targets = [normId];
    if (normKey && normKey !== normId) targets.push(normKey);

    const current = this.getReactions(contentId, userId, 0, options?.contentKey);
    let isCurrentlyActive = false;
    switch (reactionType) {
      case 'fire': isCurrentlyActive = current.hasFire; break;
      case 'heart': isCurrentlyActive = current.hasHeart; break;
      case 'thumbs_up': isCurrentlyActive = current.hasThumbsUp; break;
      case 'thumbs_down': isCurrentlyActive = current.hasThumbsDown; break;
      case 'thumbs_up_dark': isCurrentlyActive = current.hasThumbsUpDark; break;
      case 'thumbs_down_dark': isCurrentlyActive = current.hasThumbsDownDark; break;
      case 'clap': isCurrentlyActive = Boolean(current.hasClap); break;
      case 'hundred': isCurrentlyActive = Boolean(current.hasHundred); break;
    }

    const willBeActive = !isCurrentlyActive;

    targets.forEach((tgt) => {
      const rec = this.getOrCreateRecord(tgt);
      if (!rec.userReactions[userId]) rec.userReactions[userId] = {};
      rec.userReactions[userId][reactionType] = willBeActive;

      const currentCount = rec.counts[reactionType] || 0;
      rec.counts[reactionType] = willBeActive ? currentCount + 1 : Math.max(0, currentCount - 1);
    });

    this.saveToStorage();

    // Favorites persistence
    try {
      let favCategory: FavoriteCategory = 'music';
      const ct = contentType.toLowerCase();
      if (ct.includes('video')) favCategory = 'videos';
      else if (ct.includes('playlist')) favCategory = 'playlists';
      else if (ct.includes('artist')) favCategory = 'artists';
      else if (ct.includes('producer')) favCategory = 'producers';
      else if (ct.includes('project')) favCategory = 'projects';
      else if (ct.includes('audiobook')) favCategory = 'audiobooks';
      else if (ct.includes('podcast')) favCategory = 'audiobooks';

      if (willBeActive && (reactionType === 'fire' || reactionType === 'heart' || reactionType === 'thumbs_up' || reactionType === 'thumbs_up_dark')) {
        FavoritesService.addFavorite({ id: contentId, category: favCategory }, userId);
      }
    } catch (e) { }

    const result = this.getReactions(contentId, userId, 0, options?.contentKey);

    // Notify listeners
    this.notify(contentId, result);
    if (options?.contentKey) {
      this.notify(options.contentKey, result);
    }

    // Broadcast update across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'REACTION_UPDATED',
          contentId,
          contentKey: options?.contentKey,
          timestamp: Date.now(),
        });
      } catch (e) { }
    }

    return result;
  }

  /**
   * Subscribe to changes for a content item or canonical key
   */
  public static subscribe(
    contentId: string,
    listener: ReactionListener,
    contentKey?: string
  ): () => void {
    const normId = this.normalizeKey(contentId);
    if (!this.listeners.has(normId)) {
      this.listeners.set(normId, new Set());
    }
    this.listeners.get(normId)!.add(listener);

    const normKey = contentKey ? this.normalizeKey(contentKey) : '';
    if (normKey && normKey !== normId) {
      if (!this.listeners.has(normKey)) {
        this.listeners.set(normKey, new Set());
      }
      this.listeners.get(normKey)!.add(listener);
    }

    return () => {
      const set = this.listeners.get(normId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(normId);
      }
      if (normKey && normKey !== normId) {
        const kSet = this.listeners.get(normKey);
        if (kSet) {
          kSet.delete(listener);
          if (kSet.size === 0) this.listeners.delete(normKey);
        }
      }
    };
  }

  private static notify(target: string, state: ContentReactions): void {
    const norm = this.normalizeKey(target);
    const set = this.listeners.get(norm);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(state);
        } catch (e) {
          console.error('Error in reaction listener:', e);
        }
      });
    }
  }
}
