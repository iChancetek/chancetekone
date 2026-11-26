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

class HistoryServiceClass {
  private listeners: Map<string, Set<(history: HistoryEntry[]) => void>> = new Map();
  private globalListeners: Set<() => void> = new Set();
  private mergedCache: Map<string, HistoryEntry[]> = new Map();
  private storageListenerBound = false;

  private ensureStorageSync(): void {
    if (this.storageListenerBound || typeof window === 'undefined') return;
    this.storageListenerBound = true;
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(STORAGE_PREFIX)) {
        this.mergedCache.clear();
        this.globalListeners.forEach((cb) => {
          try {
            cb();
          } catch { }
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
    try {
      const raw = localStorage.getItem(this.getStorageKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to load user history:', e);
      return [];
    }
  }

  /**
   * Returns strictly isolated playback history for the given userId (multi-user safe).
   * Signed-in users ONLY see their own history; guests ONLY see guest session history.
   */
  public getMergedHistory(userId?: string | null): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    this.ensureStorageSync();
    const effectiveUserId = userId && userId.trim() ? userId.trim() : 'guest';
    const hit = this.mergedCache.get(effectiveUserId);
    if (hit) return hit;

    const items = this.getHistory(effectiveUserId);
    const seen = new Set<string>();
    const deduped: HistoryEntry[] = [];
    [...items]
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .forEach((entry) => {
        const key = `${entry.mediaType}:${entry.mediaId}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(entry);
        }
      });
    const result = deduped.slice(0, 100);
    this.mergedCache.set(effectiveUserId, result);
    return result;
  }

  public recordHistory(
    userId: string,
    item: Omit<HistoryEntry, 'id' | 'userId' | 'playedAt'>
  ): HistoryEntry | null {
    if (typeof window === 'undefined') return null;
    const effectiveUserId = userId || 'guest';

    try {
      const current = this.getHistory(effectiveUserId);
      // Remove any previous occurrence of this same media item so it moves to the top
      const filtered = current.filter((h) => !(h.mediaId === item.mediaId && h.mediaType === item.mediaType));

      const newEntry: HistoryEntry = {
        ...item,
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: effectiveUserId,
        playedAt: new Date().toISOString(),
      };

      filtered.unshift(newEntry);
      // Limit to 100 recent entries
      const trimmed = filtered.slice(0, 100);

      localStorage.setItem(this.getStorageKey(effectiveUserId), JSON.stringify(trimmed));
      this.mergedCache.clear();
      this.notify(effectiveUserId, trimmed);
      return newEntry;
    } catch (e) {
      console.warn('Failed to record history entry:', e);
      return null;
    }
  }

  public clearHistory(userId: string): void {
    if (typeof window === 'undefined' || !userId) return;
    try {
      localStorage.removeItem(this.getStorageKey(userId));
      this.mergedCache.clear();
      this.notify(userId, []);
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
