'use client';

export interface HistoryEntry {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'music' | 'video' | 'audiobook';
  title: string;
  subtitle: string;
  coverUrl: string;
  duration: number; // seconds
  playedAt: string; // ISO
  audioUrl?: string;
  videoUrl?: string;
}

const STORAGE_PREFIX = '8spades_user_history_';

class HistoryServiceClass {
  private listeners: Map<string, Set<(history: HistoryEntry[]) => void>> = new Map();

  private getStorageKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}`;
  }

  public getHistory(userId: string): HistoryEntry[] {
    if (typeof window === 'undefined' || !userId) return [];
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

  public recordHistory(
    userId: string,
    item: Omit<HistoryEntry, 'id' | 'userId' | 'playedAt'>
  ): HistoryEntry | null {
    if (typeof window === 'undefined' || !userId) return null;

    try {
      const current = this.getHistory(userId);
      // Remove any previous occurrence of this same media item so it moves to the top
      const filtered = current.filter((h) => !(h.mediaId === item.mediaId && h.mediaType === item.mediaType));

      const newEntry: HistoryEntry = {
        ...item,
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId,
        playedAt: new Date().toISOString(),
      };

      filtered.unshift(newEntry);
      // Limit to 100 recent entries
      const trimmed = filtered.slice(0, 100);

      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(trimmed));
      this.notify(userId, trimmed);
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
  }
}

export const HistoryService = new HistoryServiceClass();
