import {
  MOCK_TRACKS,
  MOCK_ALBUMS,
  MOCK_VIDEOS,
  MOCK_AUDIOBOOKS,
  MOCK_ARTISTS,
  MOCK_PRODUCERS,
  MOCK_PROJECTS,
} from '@/lib/mockData';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';

export type FavoriteCategory =
  | 'music'
  | 'albums'
  | 'artists'
  | 'audiobooks'
  | 'podcasts'
  | 'videos'
  | 'playlists'
  | 'producers'
  | 'projects';

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
    genre?: string;
    artistName?: string;
    [key: string]: any;
  };
}

const FAVORITES_STORAGE_PREFIX = '8spades_user_favorites_v2_';

type FavoritesListener = (favorites: FavoriteItem[]) => void;

export class FavoritesService {
  private static listeners: Map<string, Set<FavoritesListener>> = new Map();
  private static globalListeners: Set<() => void> = new Set();

  private static getStorageKey(userId: string = 'guest'): string {
    return `${FAVORITES_STORAGE_PREFIX}${userId}`;
  }

  public static getFavorites(userId: string = 'guest'): FavoriteItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(this.getStorageKey(userId));
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Returns merged favorites across the signed-in userId AND guest storage
   * (deduplicated by id + category, newest first) so items favorited before
   * signing in remain seamlessly available in Library.
   */
  public static getMergedFavorites(userId?: string | null): FavoriteItem[] {
    if (typeof window === 'undefined') return [];
    const primary = userId ? this.getFavorites(userId) : [];
    const guest = this.getFavorites('guest');
    const combined = userId && userId !== 'guest' ? [...primary, ...guest] : guest;
    const seen = new Set<string>();
    const deduped: FavoriteItem[] = [];
    combined
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .forEach((item) => {
        const key = `${item.category}:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      });
    return deduped;
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
    return this.getMergedFavorites(userId).filter((item) => item.category === category);
  }

  public static isFavorite(id: string, userId: string = 'guest', category?: FavoriteCategory): boolean {
    const list = this.getMergedFavorites(userId);
    return list.some((item) => item.id === id && (!category || item.category === category));
  }

  public static addFavorite(
    item: { id: string; category: FavoriteCategory; metadata?: Record<string, any> },
    userId: string = 'guest'
  ): void {
    const effectiveUser = userId || 'guest';
    const list = this.getFavorites(effectiveUser);
    if (!list.some((existing) => existing.id === item.id && existing.category === item.category)) {
      const newItem: FavoriteItem = {
        id: item.id,
        category: item.category,
        addedAt: new Date().toISOString(),
        metadata: item.metadata || {},
      };
      const updated = [newItem, ...list];
      this.saveFavorites(effectiveUser, updated);

      AnalyticsEngine.trackEvent('favorite_added', {
        contentId: item.id,
        category: item.category,
        userId: effectiveUser,
        action: 'added_to_favorites',
      });
    }
  }

  public static removeFavorite(id: string, userId: string = 'guest', category?: FavoriteCategory): void {
    const effectiveUser = userId || 'guest';
    const keysToUpdate = effectiveUser !== 'guest' ? [effectiveUser, 'guest'] : ['guest'];

    keysToUpdate.forEach((uid) => {
      const list = this.getFavorites(uid);
      const updated = list.filter((item) => !(item.id === id && (!category || item.category === category)));
      if (updated.length !== list.length) {
        this.saveFavorites(uid, updated);
      }
    });

    AnalyticsEngine.trackEvent('favorite_removed', {
      contentId: id,
      userId: effectiveUser,
      action: 'removed_from_favorites',
    });
  }

  public static clearFavorites(userId: string = 'guest'): void {
    this.saveFavorites(userId, []);
    if (userId !== 'guest') {
      this.saveFavorites('guest', []);
    }
  }

  public static toggleFavorite(
    item: { id: string; category: FavoriteCategory; metadata?: Record<string, any> },
    userId: string = 'guest'
  ): boolean {
    const currentlyFav = this.isFavorite(item.id, userId, item.category);
    if (currentlyFav) {
      this.removeFavorite(item.id, userId, item.category);
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

  public static subscribeAll(listener: () => void): () => void {
    this.globalListeners.add(listener);
    const onWindow = () => listener();
    if (typeof window !== 'undefined') {
      window.addEventListener('favorites-updated', onWindow);
    }
    return () => {
      this.globalListeners.delete(listener);
      if (typeof window !== 'undefined') {
        window.removeEventListener('favorites-updated', onWindow);
      }
    };
  }

  private static notify(userId: string, items: FavoriteItem[]): void {
    const merged = this.getMergedFavorites(userId);
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach((cb) => {
        try {
          cb(merged);
        } catch (e) {
          console.error('Favorites listener error:', e);
        }
      });
    }
    this.globalListeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Global favorites listener error:', e);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('favorites-updated', { detail: { userId, count: items.length } }));
    }
  }

  /**
   * Resolves the live catalog item across MusicCatalogService, MediaCatalogService,
   * PlaylistService, ProducerCatalogService, and fallback metadata so favorited items
   * always display cleanly in Library.
   */
  public static resolveCatalogItem(item: FavoriteItem): any {
    switch (item.category) {
      case 'music': {
        try {
          const { MusicCatalogService } = require('@/lib/music/MusicCatalogService');
          const trk = MusicCatalogService.getAllTracks?.()?.find((t: any) => t.id === item.id);
          if (trk) return trk;
        } catch { }
        return MOCK_TRACKS.find((t) => t.id === item.id) || (item.metadata?.title ? { id: item.id, ...item.metadata } : null);
      }
      case 'albums': {
        try {
          const { MusicCatalogService } = require('@/lib/music/MusicCatalogService');
          const alb = MusicCatalogService.getAllAlbums?.()?.find((a: any) => a.id === item.id);
          if (alb) return alb;
        } catch { }
        return MOCK_ALBUMS.find((a) => a.id === item.id) || (item.metadata?.title ? { id: item.id, ...item.metadata } : null);
      }
      case 'videos': {
        try {
          const { MediaCatalogService } = require('@/lib/media/MediaCatalogService');
          const vid = MediaCatalogService.getAllVideos?.()?.find((v: any) => v.id === item.id);
          if (vid) return vid;
        } catch { }
        return MOCK_VIDEOS.find((v) => v.id === item.id) || (item.metadata?.title ? { id: item.id, ...item.metadata } : null);
      }
      case 'audiobooks': {
        try {
          const { MediaCatalogService } = require('@/lib/media/MediaCatalogService');
          const book = MediaCatalogService.getAllAudiobooks?.()?.find((b: any) => b.id === item.id);
          if (book) return book;
        } catch { }
        return MOCK_AUDIOBOOKS.find((b) => b.id === item.id) || (item.metadata?.title ? { id: item.id, ...item.metadata } : null);
      }
      case 'podcasts': {
        try {
          const { MediaCatalogService } = require('@/lib/media/MediaCatalogService');
          const pod = MediaCatalogService.getAllPodcasts?.()?.find((p: any) => p.id === item.id);
          if (pod) return pod;
        } catch { }
        return item.metadata?.title ? { id: item.id, ...item.metadata } : null;
      }
      case 'playlists': {
        try {
          const { PlaylistService } = require('@/lib/playlist/PlaylistService');
          const res = PlaylistService.getPlaylistById(item.id);
          if (res?.playlist) return res.playlist;
        } catch { }
        return item.metadata?.title ? { id: item.id, name: item.metadata.title, ...item.metadata } : null;
      }
      case 'artists': {
        const mockArtist = MOCK_ARTISTS.find((a) => a.id === item.id);
        if (mockArtist) return mockArtist;
        try {
          const { MusicCatalogService } = require('@/lib/music/MusicCatalogService');
          const trk = MusicCatalogService.getAllTracks?.()?.find(
            (t: any) => t.artistId === item.id || t.artistName?.toLowerCase() === item.metadata?.title?.toLowerCase()
          );
          if (trk) {
            return {
              id: item.id,
              name: trk.artistName,
              imageUrl: trk.coverUrl,
              genres: [trk.genre || 'Music'],
            };
          }
        } catch { }
        return item.metadata?.title
          ? { id: item.id, name: item.metadata.title, imageUrl: item.metadata.coverUrl || '/images/studio_cover.jpg' }
          : null;
      }
      case 'producers': {
        try {
          const { ProducerCatalogService } = require('@/lib/producers/ProducerCatalogService');
          const prod = ProducerCatalogService.getAllProducers?.()?.find((p: any) => p.id === item.id);
          if (prod) return prod;
        } catch { }
        return MOCK_PRODUCERS.find((p) => p.id === item.id) || (item.metadata?.title ? { id: item.id, name: item.metadata.title, ...item.metadata } : null);
      }
      case 'projects':
        return MOCK_PROJECTS.find((p) => p.id === item.id) || (item.metadata?.title ? { id: item.id, ...item.metadata } : null);
      default:
        return item.metadata?.title ? { id: item.id, ...item.metadata } : null;
    }
  }
}
