'use client';

export interface HistoryEntry {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'music' | 'video' | 'audiobook' | 'podcast';
  title: string;
  subtitle: string;
  coverUrl: string;
  duration: number; // seconds
  playedAt: string; // ISO
  audioUrl?: string;
  videoUrl?: string;
  genre?: string;
  artistName?: string;
  bpm?: number;
  tags?: string[];
  href?: string;
}

const STORAGE_PREFIX = '8spades_user_history_';
const MAX_ENTRIES = 100;

/**
 * Canonical userId resolver for Listening & Watch History across the entire platform.
 * Ensures writes (PlayerContext, VideoPlayer, AudiobookPlayer, Podcasts) and reads
 * (Library, RecentlyPlayedSection, DiscoveryDeck) ALWAYS target the exact same user bucket.
 */
export function resolveHistoryUserId(
  profile?: { id?: string | null; email?: string | null } | null,
  user?: { uid?: string | null; email?: string | null } | null,
  isAdmin?: boolean
): string {
  const pid = profile?.id?.trim();
  if (pid) return pid;
  const uid = user?.uid?.trim();
  if (uid) return uid;
  if (isAdmin) return 'admin';
  return 'guest';
}

/**
 * Prevents oversized base64 data: URIs or transient blob: URLs from blowing
 * the browser's 5MB localStorage quota (which previously caused silent QuotaExceededError).
 */
function sanitizePersistableUrl(url?: string, fallback?: string): string | undefined {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('blob:')) return fallback;
  if (trimmed.startsWith('data:') && trimmed.length > 2048) return fallback;
  return trimmed;
}

class HistoryServiceClass {
  private listeners: Map<string, Set<(history: HistoryEntry[]) => void>> = new Map();
  private globalListeners: Set<() => void> = new Set();
  private mergedCache: Map<string, HistoryEntry[]> = new Map();
  /** In-memory mirror guarantees immediate live UI updates even if localStorage quota is tight */
  private memoryStore: Map<string, HistoryEntry[]> = new Map();
  private storageListenerBound = false;

  private ensureStorageSync(): void {
    if (this.storageListenerBound || typeof window === 'undefined') return;
    this.storageListenerBound = true;
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(STORAGE_PREFIX)) {
        const userId = e.key.slice(STORAGE_PREFIX.length);
        this.memoryStore.delete(userId);
        this.mergedCache.clear();
        this.globalListeners.forEach((cb) => {
          try {
            cb();
          } catch {}
        });
      }
    });
  }

  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  public getHistory(userId: string): HistoryEntry[] {
    if (typeof window === 'undefined' || !userId) return [];
    this.ensureStorageSync();
    const key = userId.trim();
    const mem = this.memoryStore.get(key);
    try {
      const raw = localStorage.getItem(this.getStorageKey(key));
      if (!raw) return mem ? [...mem] : [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (mem && mem.length > parsed.length) {
          return [...mem];
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load user history:', e);
    }
    return mem ? [...mem] : [];
  }

  /**
   * Returns strictly isolated playback history for the given user (multi-user safe).
   * Optionally accepts secondaryId (e.g. Firebase user.uid alongside profile.id for the SAME user)
   * so history recorded under either identifier of the same signed-in account always appears together.
   */
  public getMergedHistory(userId?: string | null, secondaryUserId?: string | null): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    this.ensureStorageSync();
    const primary = userId && userId.trim() ? userId.trim() : 'guest';
    const secondary =
      secondaryUserId && secondaryUserId.trim() && secondaryUserId.trim() !== primary
        ? secondaryUserId.trim()
        : null;
    const cacheKey = secondary ? `${primary}::${secondary}` : primary;
    const hit = this.mergedCache.get(cacheKey);
    if (hit) return hit;

    const combined: HistoryEntry[] = [...this.getHistory(primary)];
    if (secondary && primary !== 'guest') {
      combined.push(...this.getHistory(secondary));
    }

    const seen = new Set<string>();
    const deduped: HistoryEntry[] = [];
    combined
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .forEach((entry) => {
        const key = `${entry.mediaType}:${entry.mediaId}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(entry);
        }
      });

    const result = deduped.slice(0, MAX_ENTRIES);
    this.mergedCache.set(cacheKey, result);
    return result;
  }

  private persistWithQuotaFallback(storageKey: string, entries: HistoryEntry[]): void {
    const attemptSizes = [entries.length, 40, 20, 10, 5];
    for (const limit of attemptSizes) {
      const slice = entries.slice(0, limit);
      try {
        localStorage.setItem(storageKey, JSON.stringify(slice));
        return;
      } catch {
        // Retry with smaller slice if origin localStorage quota is nearly full
      }
    }
    // Last-resort minimal entries (drop optional tags/urls)
    try {
      const minimal = entries.slice(0, 10).map((e) => ({
        id: e.id,
        userId: e.userId,
        mediaId: e.mediaId,
        mediaType: e.mediaType,
        title: e.title,
        subtitle: e.subtitle,
        coverUrl: sanitizePersistableUrl(e.coverUrl, '/images/studio_cover.jpg') || '/images/studio_cover.jpg',
        duration: e.duration || 0,
        playedAt: e.playedAt,
        href: e.href,
      }));
      localStorage.setItem(storageKey, JSON.stringify(minimal));
    } catch (err) {
      console.warn('localStorage quota exhausted for history; keeping in-memory history active:', err);
    }
  }

  public recordHistory(
    userId: string,
    item: Omit<HistoryEntry, 'id' | 'userId' | 'playedAt'>
  ): HistoryEntry | null {
    if (typeof window === 'undefined') return null;
    const effectiveUserId = userId && userId.trim() ? userId.trim() : 'guest';

    try {
      const current = this.getHistory(effectiveUserId);
      // Remove any previous occurrence of this same media item so it moves to the top
      const filtered = current.filter(
        (h) => !(h.mediaId === item.mediaId && h.mediaType === item.mediaType)
      );

      const newEntry: HistoryEntry = {
        ...item,
        coverUrl:
          sanitizePersistableUrl(item.coverUrl, '/images/studio_cover.jpg') ||
          '/images/studio_cover.jpg',
        audioUrl: sanitizePersistableUrl(item.audioUrl),
        videoUrl: sanitizePersistableUrl(item.videoUrl),
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: effectiveUserId,
        playedAt: new Date().toISOString(),
      };

      filtered.unshift(newEntry);
      const trimmed = filtered.slice(0, MAX_ENTRIES);

      // Always update memory mirror & cache first so live UI reflects the play immediately
      this.memoryStore.set(effectiveUserId, trimmed);
      this.mergedCache.clear();

      // Persist to localStorage with automatic quota-safe trimming
      this.persistWithQuotaFallback(this.getStorageKey(effectiveUserId), trimmed);

      this.notify(effectiveUserId, trimmed);
      return newEntry;
    } catch (e) {
      console.warn('Failed to record history entry:', e);
      return null;
    }
  }

  public clearHistory(userId: string, secondaryUserId?: string | null): void {
    if (typeof window === 'undefined' || !userId) return;
    try {
      const primary = userId.trim();
      localStorage.removeItem(this.getStorageKey(primary));
      this.memoryStore.delete(primary);
      if (secondaryUserId && secondaryUserId.trim() && secondaryUserId.trim() !== primary) {
        const sec = secondaryUserId.trim();
        localStorage.removeItem(this.getStorageKey(sec));
        this.memoryStore.delete(sec);
      }
      this.mergedCache.clear();
      this.notify(primary, []);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  }

  public subscribe(userId: string, callback: (history: HistoryEntry[]) => void): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    const userListeners = this.listeners.get(userId)!;
    userListeners.add(callback);

    return () => {
      userListeners.delete(callback);
      if (userListeners.size === 0) {
        this.listeners.delete(userId);
      }
    };
  }

  public subscribeAll(callback: () => void): () => void {
    this.ensureStorageSync();
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  private notify(userId: string, history: HistoryEntry[]) {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach((cb) => {
        try {
          cb(history);
        } catch (err) {
          console.error('History listener error:', err);
        }
      });
    }
    this.globalListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Global history listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('history-updated', { detail: { userId } }));
    }
  }
}

export const HistoryService = new HistoryServiceClass();
