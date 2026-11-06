import { MOCK_TRACKS, MOCK_ALBUMS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_ARTISTS, MOCK_PRODUCERS, MOCK_PROJECTS } from '@/lib/mockData';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';

export type FavoriteCategory = 'music' | 'videos' | 'playlists' | 'artists' | 'producers' | 'projects' | 'audiobooks';

export interface FavoriteItem {
  id: string;
  category: FavoriteCategory;
  addedAt: string;
  metadata?: {
    title?: string;
    subtitle?: string;
    coverUrl?: string;
    duration?: number;
    url?: string;
    [key: string]: any;
  };
}

const FAVORITES_STORAGE_PREFIX = '8spades_user_favorites_v2_';

type FavoritesListener = (favorites: FavoriteItem[]) => void;

export class FavoritesService {
  private static listeners: Map<string, Set<FavoritesListener>> = new Map();

  private static getStorageKey(userId: string = 'guest'): string {
    return `${FAVORITES_STORAGE_PREFIX}${userId}`;
  }

  public static getFavorites(userId: string = 'guest'): FavoriteItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(this.getStorageKey(userId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static saveFavorites(userId: string = 'guest', items: FavoriteItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(items));
      this.notify(userId, items);
    } catch (e) {
      console.error('Error saving user favorites:', e);
    }
  }

  public static getFavoritesByCategory(category: FavoriteCategory, userId: string = 'guest'): FavoriteItem[] {
    return this.getFavorites(userId).filter((item) => item.category === category);
  }

  public static isFavorite(id: string, userId: string = 'guest'): boolean {
    const list = this.getFavorites(userId);
    return list.some((item) => item.id === id);
  }

  public static addFavorite(
    item: { id: string; category: FavoriteCategory; metadata?: Record<string, any> },
    userId: string = 'guest'
  ): void {
    const list = this.getFavorites(userId);
    if (!list.some((existing) => existing.id === item.id)) {
      const newItem: FavoriteItem = {
        id: item.id,
        category: item.category,
        addedAt: new Date().toISOString(),
        metadata: item.metadata || {},
      };
      const updated = [newItem, ...list];
      this.saveFavorites(userId, updated);

      // Track in real analytics telemetry
      AnalyticsEngine.trackEvent('favorite_added', {
        contentId: item.id,
        category: item.category,
        userId,
        action: 'added_to_favorites',
      });
    }
  }

  public static removeFavorite(id: string, userId: string = 'guest'): void {
    const list = this.getFavorites(userId);
    const updated = list.filter((item) => item.id !== id);
    if (updated.length !== list.length) {
      this.saveFavorites(userId, updated);

      AnalyticsEngine.trackEvent('favorite_removed', {
        contentId: id,
        userId,
        action: 'removed_from_favorites',
      });
    }
  }

  public static clearFavorites(userId: string = 'guest'): void {
    this.saveFavorites(userId, []);
  }

  public static toggleFavorite(
    item: { id: string; category: FavoriteCategory; metadata?: Record<string, any> },
    userId: string = 'guest'
  ): boolean {
    const currentlyFav = this.isFavorite(item.id, userId);
    if (currentlyFav) {
      this.removeFavorite(item.id, userId);
      return false;
    } else {
      this.addFavorite(item, userId);
      return true;
    }
  }

  public static subscribe(userId: string = 'guest', listener: FavoritesListener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(listener);

    return () => {
      this.listeners.get(userId)?.delete(listener);
    };
  }

  private static notify(userId: string, items: FavoriteItem[]): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach((cb) => {
        try {
          cb(items);
        } catch (e) {
          console.error('Favorites listener error:', e);
        }
      });
    }
  }

  /**
   * Helper to resolve real catalog item by ID and category
   */
  public static resolveCatalogItem(item: FavoriteItem): any {
    switch (item.category) {
      case 'music': {
        try {
          const { MusicCatalogService } = require('@/lib/music/MusicCatalogService');
          const trk = MusicCatalogService.getAllTracks?.()?.find((t: any) => t.id === item.id);
          if (trk) return trk;
          const alb = MusicCatalogService.getAllAlbums?.()?.find((a: any) => a.id === item.id);
          if (alb) return alb;
        } catch {}
        return MOCK_TRACKS.find((t) => t.id === item.id) || MOCK_ALBUMS.find((a) => a.id === item.id) || null;
      }
      case 'videos':
        return MOCK_VIDEOS.find((v) => v.id === item.id) || null;
      case 'playlists': {
        try {
          const { PlaylistService } = require('@/lib/playlist/PlaylistService');
          return PlaylistService.getPlaylistById(item.id) || null;
        } catch {
          return null;
        }
      }
      case 'artists':
        return MOCK_ARTISTS.find((a) => a.id === item.id) || null;
      case 'producers':
        return MOCK_PRODUCERS.find((p) => p.id === item.id) || null;
      case 'projects':
        return MOCK_PROJECTS.find((p) => p.id === item.id) || null;
      case 'audiobooks':
        return MOCK_AUDIOBOOKS.find((b) => b.id === item.id) || null;
      default:
        return null;
    }
  }
}
