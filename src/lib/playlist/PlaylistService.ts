import { Playlist, PlaylistItem, PlaylistType, PlaylistVisibility, PlaylistFilter } from '@/types/playlist';
import { MediaType, Track, Video, Audiobook, AudiobookChapter } from '@/types/media';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { FavoritesService } from '@/lib/favorites/FavoritesService';
import { EngagementMetricsService } from '@/lib/analytics/EngagementMetricsService';
import { AuditLogger } from '@/lib/admin/AuditLogger';

export interface RecoverablePlaylistItem {
  id: string; // recovery item id (e.g. rec-pl-...)
  originalPlaylistId: string;
  playlist: Playlist;
  removedAt: string;
  expiresAt: string;
  daysRemaining: number;
  removedByAdminId: string;
  removedByAdminName: string;
  removedByAdminRole?: string;
  reason?: string;
}

const PLAYLIST_RECOVERY_STORAGE_KEY = '8spades_playlist_recovery_vault_v1';
export const PLAYLIST_RETENTION_DAYS = 45;
const FORTY_FIVE_DAYS_MS = PLAYLIST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const PLAYLIST_STORAGE_KEY = '8spades_playlists_v2';
const SAVED_PLAYLISTS_STORAGE_KEY = '8spades_saved_playlists_v2';
const LIKED_PLAYLISTS_STORAGE_KEY = '8spades_liked_playlists_v2';

import { COVER_ART_CATALOG } from '@/lib/playlist/CoverArtCatalog';

export const PRESET_COVERS = COVER_ART_CATALOG.map((c) => c.url);

// Seed Data
export const INITIAL_PUBLIC_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-featured-master',
    ownerId: 'creator-8spades',
    ownerName: 'ChanceTEK One',
    ownerAvatarUrl: '/images/logo.png',
    name: 'ChanceTEK One: The Master Vault',
    description: 'Heavyweight big beat anthems, Apache break mastercuts, sample-chopping crate science, and legendary 12-bit SP-1200 crunch.',
    type: 'music',
    visibility: 'public',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    itemCount: 4,
    totalDuration: 769,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-02-28T18:00:00.000Z',
    isFeatured: true,
    stats: {
      plays: 0,
      saves: 0,
      likes: 0,
      shares: 0,
    },
    items: [
      {
        id: 'item-master-1',
        playlistId: 'pl-featured-master',
        mediaId: 'track-1',
        mediaType: 'music',
        title: 'ChanceTEK One Presents: The Return of the Break Beats',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        duration: 194,
        position: 0,
        addedAt: '2026-01-15T12:00:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 130,
        genre: 'Big Beat',
      },
      {
        id: 'item-master-2',
        playlistId: 'pl-featured-master',
        mediaId: 'track-2',
        mediaType: 'music',
        title: 'Neon Crate Philosophy',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        duration: 218,
        position: 1,
        addedAt: '2026-01-15T12:05:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 110,
        genre: 'Epic Tracks',
      },
      {
        id: 'item-master-3',
        playlistId: 'pl-featured-master',
        mediaId: 'track-5',
        mediaType: 'music',
        title: 'Ghost In The SP-1200',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80',
        duration: 172,
        position: 2,
        addedAt: '2026-01-15T12:10:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 120,
        genre: 'Big Beat',
      },
      {
        id: 'item-master-4',
        playlistId: 'pl-featured-master',
        mediaId: 'track-4',
        mediaType: 'music',
        title: 'Soul Kitchen 1974',
        artistName: 'Luna Brass & The Crate Queens',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        duration: 185,
        position: 3,
        addedAt: '2026-01-15T12:15:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 108,
        genre: 'Funk Breaks',
      },
    ],
  },
  {
    id: 'pl-mixed-experience',
    ownerId: 'creator-8spades',
    ownerName: 'ChanceTEK One',
    ownerAvatarUrl: '/images/logo.png',
    name: 'Late Night Concrete Session (Mixed Crate)',
    description: 'Immersive multi-format experience seamlessly blending heavy audio tracks, 4K studio visual cuts, and audiobook history chapters.',
    type: 'mixed',
    visibility: 'public',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    itemCount: 4,
    totalDuration: 3014,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-28T20:00:00.000Z',
    isFeatured: true,
    stats: {
      plays: 0,
      saves: 0,
      likes: 0,
      shares: 0,
    },
    items: [
      {
        id: 'item-mix-1',
        playlistId: 'pl-mixed-experience',
        mediaId: 'track-1',
        mediaType: 'music',
        title: 'ChanceTEK One Presents: The Return of the Break Beats',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        duration: 194,
        position: 0,
        addedAt: '2026-02-01T10:00:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 130,
        genre: 'Big Beat',
      },
      {
        id: 'item-mix-2',
        playlistId: 'pl-mixed-experience',
        mediaId: 'video-1',
        mediaType: 'video',
        title: 'ChanceTEK One: Masterclass & Breakbeat Experience',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
        duration: 240,
        position: 1,
        addedAt: '2026-02-01T10:05:00.000Z',
        videoUrl: '/videos/FatherTime4K.mp4',
        genre: 'Masterclass',
      },
      {
        id: 'item-mix-3',
        playlistId: 'pl-mixed-experience',
        mediaId: 'audiobook-1',
        mediaType: 'audiobook',
        title: 'Chapter 1: The Six Seconds That Changed Everything',
        artistName: 'ChanceTEK One',
        coverUrl: '/images/logo.png',
        duration: 2400,
        position: 2,
        addedAt: '2026-02-01T10:10:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        chapterIndex: 1,
        genre: 'Documentary',
      },
      {
        id: 'item-mix-4',
        playlistId: 'pl-mixed-experience',
        mediaId: 'track-3',
        mediaType: 'music',
        title: 'Cyber Grid Overdrive',
        artistName: 'Cipher Voltage',
        coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
        duration: 245,
        position: 3,
        addedAt: '2026-02-01T10:15:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        bpm: 134,
        genre: 'Electro Breaks',
      },
    ],
  },
  {
    id: 'pl-video-master',
    ownerId: 'creator-8spades',
    ownerName: 'ChanceTEK One',
    ownerAvatarUrl: '/images/logo.png',
    name: 'ChanceTEK One Studio Visual Masterclasses',
    description: 'Official continuous stream of high-definition 4K studio cuts, hardware break chopping sessions, and turntable demonstrations.',
    type: 'video',
    visibility: 'public',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    itemCount: 4,
    totalDuration: 735,
    createdAt: '2026-02-10T14:00:00.000Z',
    updatedAt: '2026-02-27T16:00:00.000Z',
    isFeatured: true,
    stats: {
      plays: 0,
      saves: 0,
      likes: 0,
      shares: 0,
    },
    items: [
      {
        id: 'item-vid-1',
        playlistId: 'pl-video-master',
        mediaId: 'video-1',
        mediaType: 'video',
        title: 'ChanceTEK One: Masterclass & Breakbeat Experience',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
        duration: 240,
        position: 0,
        addedAt: '2026-02-10T14:00:00.000Z',
        videoUrl: '/videos/FatherTime4K.mp4',
        genre: 'Masterclass',
      },
      {
        id: 'item-vid-2',
        playlistId: 'pl-video-master',
        mediaId: 'video-2',
        mediaType: 'video',
        title: 'ChanceTEK One: Chapter I — The Sonic Lab Session',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
        duration: 180,
        position: 1,
        addedAt: '2026-02-10T14:05:00.000Z',
        videoUrl: '/videos/chancetekone1.mp4',
        genre: 'Studio Session',
      },
      {
        id: 'item-vid-3',
        playlistId: 'pl-video-master',
        mediaId: 'video-3',
        mediaType: 'video',
        title: 'ChanceTEK One: Chapter II — Underground Crate Science',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
        duration: 150,
        position: 2,
        addedAt: '2026-02-10T14:10:00.000Z',
        videoUrl: '/videos/chancetekone2.mp4',
        genre: 'Masterclass',
      },
      {
        id: 'item-vid-4',
        playlistId: 'pl-video-master',
        mediaId: 'video-4',
        mediaType: 'video',
        title: 'ChanceTEK One: Chapter III — Rhythm Dynamics & Flow',
        artistName: 'ChanceTEK One',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
        duration: 165,
        position: 3,
        addedAt: '2026-02-10T14:15:00.000Z',
        videoUrl: '/videos/chancetekone3.mp4',
        genre: 'Production',
      },
    ],
  },
  {
    id: 'pl-audiobook-master',
    ownerId: 'creator-8spades',
    ownerName: 'ChanceTEK One',
    ownerAvatarUrl: '/images/logo.png',
    name: 'The Return of the Break Beats: Audio Documentary',
    description: 'The definitive audio narrative documenting how 6 seconds of drum solo in the 1960s ignited Big Beat and modern culture.',
    type: 'audiobook',
    visibility: 'public',
    coverUrl: '/images/logo.png',
    itemCount: 3,
    totalDuration: 9000,
    createdAt: '2026-01-20T08:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
    isFeatured: true,
    stats: {
      plays: 0,
      saves: 0,
      likes: 0,
      shares: 0,
    },
    items: [
      {
        id: 'item-book-1',
        playlistId: 'pl-audiobook-master',
        mediaId: 'audiobook-1',
        mediaType: 'audiobook',
        title: 'Chapter 1: The Six Seconds That Changed Everything',
        artistName: 'ChanceTEK One',
        coverUrl: '/images/logo.png',
        duration: 2400,
        position: 0,
        addedAt: '2026-01-20T08:00:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        chapterIndex: 1,
        genre: 'Documentary',
      },
      {
        id: 'item-book-2',
        playlistId: 'pl-audiobook-master',
        mediaId: 'audiobook-1',
        mediaType: 'audiobook',
        title: 'Chapter 2: South Bronx Block Parties & Pioneer Code',
        artistName: 'ChanceTEK One',
        coverUrl: '/images/logo.png',
        duration: 3000,
        position: 1,
        addedAt: '2026-01-20T08:05:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        chapterIndex: 2,
        genre: 'Documentary',
      },
      {
        id: 'item-book-3',
        playlistId: 'pl-audiobook-master',
        mediaId: 'audiobook-1',
        mediaType: 'audiobook',
        title: 'Chapter 3: The 12-Bit Renaissance: SP-1200 & MPC60',
        artistName: 'ChanceTEK One',
        coverUrl: '/images/logo.png',
        duration: 3600,
        position: 2,
        addedAt: '2026-01-20T08:10:00.000Z',
        audioUrl: '/audio/Fort Apache.mp3',
        chapterIndex: 3,
        genre: 'Documentary',
      },
    ],
  },
];

export class PlaylistService {
  private static listeners: Set<() => void> = new Set();

  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in playlist subscriber:', err);
      }
    });
  }

  private static sanitizePlaylist(p: Playlist): Playlist {
    if (!p.items || p.items.length === 0) return p;
    const sanitizedItems = p.items.filter((item) => {
      if (item.mediaType === 'music') {
        return !MusicCatalogService.isTrackPermanentlyRemoved(item.mediaId, item.title, item.artistName);
      }
      return true;
    });
    return {
      ...p,
      items: sanitizedItems,
      itemCount: sanitizedItems.length,
    };
  }

  private static loadRecoveryVault(): RecoverablePlaylistItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(PLAYLIST_RECOVERY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RecoverablePlaylistItem[];
        if (Array.isArray(parsed)) {
          const now = Date.now();
          const valid = parsed
            .map((item) => {
              const expTime = new Date(item.expiresAt).getTime();
              const remainingMs = expTime - now;
              const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
              return { ...item, daysRemaining };
            })
            .filter((item) => item.daysRemaining > 0);
          return valid.sort((a, b) => new Date(b.removedAt).getTime() - new Date(a.removedAt).getTime());
        }
      }
    } catch (e) {
      console.warn('Failed to load playlist recovery vault:', e);
    }
    return [];
  }

  private static persistRecoveryVault(items: RecoverablePlaylistItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PLAYLIST_RECOVERY_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to persist playlist recovery vault:', e);
    }
  }

  public static getDeletedPlaylists(): RecoverablePlaylistItem[] {
    const vault = this.loadRecoveryVault();
    // Also cross-reference any playlists in raw store marked isDeleted
    const raw = this.getRawAll();
    const deletedInRaw = raw.filter((p) => p.isDeleted);
    const vaultOriginalIds = new Set(vault.map((v) => v.originalPlaylistId));

    let updated = false;
    deletedInRaw.forEach((dp) => {
      if (!vaultOriginalIds.has(dp.id)) {
        vault.unshift({
          id: `rec-pl-${dp.id}`,
          originalPlaylistId: dp.id,
          playlist: dp,
          removedAt: dp.updatedAt || new Date().toISOString(),
          expiresAt: new Date(Date.now() + FORTY_FIVE_DAYS_MS).toISOString(),
          daysRemaining: PLAYLIST_RETENTION_DAYS,
          removedByAdminId: 'usr-admin',
          removedByAdminName: 'Platform Administrator',
          removedByAdminRole: 'admin',
          reason: 'Removed by Administrator',
        });
        updated = true;
      }
    });

    if (updated) {
      this.persistRecoveryVault(vault);
    }

    return vault;
  }

  public static getRecoveryCount(): number {
    return this.getDeletedPlaylists().length;
  }

  private static getRawAll(): Playlist[] {
    if (typeof window === 'undefined') {
      return INITIAL_PUBLIC_PLAYLISTS.map((p) => this.sanitizePlaylist(p));
    }
    try {
      const stored = localStorage.getItem(PLAYLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Playlist[];
        const existingIds = new Set(parsed.map((p) => p.id));
        const missingSeeds = INITIAL_PUBLIC_PLAYLISTS.filter((s) => !existingIds.has(s.id));
        return [...parsed, ...missingSeeds].map((p) => this.sanitizePlaylist(p));
      }
    } catch (e) {
      console.warn('Error loading playlists from localStorage:', e);
    }
    return INITIAL_PUBLIC_PLAYLISTS.map((p) => this.sanitizePlaylist(p));
  }

  private static loadAll(): Playlist[] {
    return this.getRawAll()
      .filter((p) => !p.isDeleted)
      .map((p) => this.sanitizePlaylist(p));
  }

  private static saveRaw(playlists: Playlist[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
      this.notifyListeners();
      window.dispatchEvent(new CustomEvent('playlists-updated'));
    } catch (e) {
      console.error('Error saving playlists:', e);
    }
  }

  private static saveAll(activePlaylists: Playlist[]): void {
    const raw = this.getRawAll();
    const deletedPlaylists = raw.filter((p) => p.isDeleted);
    const combined = [
      ...activePlaylists,
      ...deletedPlaylists.filter((d) => !activePlaylists.some((a) => a.id === d.id)),
    ];
    this.saveRaw(combined);
  }

  // --- Read Operations ---

  public static getAllPlaylists(): Playlist[] {
    return this.loadAll();
  }

  public static getPublicPlaylists(filter?: PlaylistFilter): Playlist[] {
    const all = this.loadAll().filter((p) => p.visibility === 'public');
    return this.applyFilter(all, filter);
  }

  public static canUserModifyPlaylist(
    playlist: Playlist,
    userId?: string,
    isAdmin?: boolean,
    userEmail?: string
  ): boolean {
    if (isAdmin) return true;
    if (!userId && !userEmail) return false;
    if (userId && playlist.ownerId === userId) return true;
    const normalizedEmail = userEmail?.toLowerCase().trim();
    if (normalizedEmail && playlist.ownerEmail && playlist.ownerEmail.toLowerCase() === normalizedEmail) {
      return true;
    }
    return false;
  }

  public static getUserPlaylists(userId: string, filter?: PlaylistFilter): Playlist[];
  public static getUserPlaylists(userId: string, userEmail?: string, filter?: PlaylistFilter): Playlist[];
  public static getUserPlaylists(
    userId: string,
    userEmailOrFilter?: string | PlaylistFilter,
    filterArg?: PlaylistFilter
  ): Playlist[] {
    let userEmail: string | undefined;
    let filter: PlaylistFilter | undefined;

    if (typeof userEmailOrFilter === 'object') {
      filter = userEmailOrFilter;
    } else {
      userEmail = userEmailOrFilter;
      filter = filterArg;
    }

    const normalizedEmail = userEmail?.toLowerCase().trim();
    const all = this.loadAll().filter((p) => {
      if (p.isDeleted) return false;
      return (
        p.ownerId === userId ||
        Boolean(normalizedEmail && p.ownerEmail && p.ownerEmail.toLowerCase() === normalizedEmail)
      );
    });
    return this.applyFilter(all, filter);
  }

  public static getSharedPlaylists(userId: string, filter?: PlaylistFilter): Playlist[];
  public static getSharedPlaylists(userId: string, userEmail?: string, filter?: PlaylistFilter): Playlist[];
  public static getSharedPlaylists(
    userId: string,
    userEmailOrFilter?: string | PlaylistFilter,
    filterArg?: PlaylistFilter
  ): Playlist[] {
    let userEmail: string | undefined;
    let filter: PlaylistFilter | undefined;

    if (typeof userEmailOrFilter === 'object') {
      filter = userEmailOrFilter;
    } else {
      userEmail = userEmailOrFilter;
      filter = filterArg;
    }

    const normalizedEmail = userEmail?.toLowerCase().trim();
    const all = this.loadAll().filter((p) => {
      if (p.isDeleted) return false;
      if (p.ownerId === userId || (normalizedEmail && p.ownerEmail && p.ownerEmail.toLowerCase() === normalizedEmail)) {
        return false;
      }
      const list = p.sharedWith || [];
      return (
        list.includes(userId) ||
        Boolean(normalizedEmail && list.some((idOrEmail) => idOrEmail.toLowerCase() === normalizedEmail))
      );
    });
    return this.applyFilter(all, filter);
  }

  public static getSavedPlaylists(userId: string): Playlist[] {
    if (typeof window === 'undefined') return [];
    try {
      const savedIds = JSON.parse(localStorage.getItem(`${SAVED_PLAYLISTS_STORAGE_KEY}_${userId}`) || '[]') as string[];
      const all = this.loadAll();
      return all.filter((p) => !p.isDeleted && savedIds.includes(p.id) && (p.visibility !== 'private' || p.ownerId === userId));
    } catch (e) {
      return [];
    }
  }

  public static getPlaylistById(
    id: string,
    currentUserId?: string,
    currentUserEmail?: string,
    isAdmin?: boolean
  ): {
    playlist: Playlist | null;
    isOwner: boolean;
    isAdmin: boolean;
    canManage: boolean;
    isSharedWithMe: boolean;
    isSaved: boolean;
    isLiked: boolean;
    error?: string;
  } {
    const all = this.loadAll();
    const playlist = all.find((p) => p.id === id);

    if (!playlist || playlist.isDeleted) {
      return { playlist: null, isOwner: false, isAdmin: Boolean(isAdmin), canManage: false, isSharedWithMe: false, isSaved: false, isLiked: false, error: 'Playlist not found' };
    }

    const normalizedEmail = currentUserEmail?.toLowerCase().trim();
    const isOwner = Boolean(
      (currentUserId && playlist.ownerId === currentUserId) ||
      (normalizedEmail && playlist.ownerEmail && playlist.ownerEmail.toLowerCase() === normalizedEmail)
    );
    const canManage = Boolean(isOwner || isAdmin);
    const isSharedWithMe = Boolean(
      (currentUserId && playlist.sharedWith?.includes(currentUserId)) ||
      (normalizedEmail && playlist.sharedWith?.some((u) => u.toLowerCase() === normalizedEmail))
    );

    // Private playlists cannot be accessed by non-owners unless explicitly shared or user is admin
    if (playlist.visibility === 'private' && !canManage && !isSharedWithMe) {
      return { playlist: null, isOwner: false, isAdmin: Boolean(isAdmin), canManage: false, isSharedWithMe: false, isSaved: false, isLiked: false, error: 'This playlist is private.' };
    }

    let isSaved = false;
    let isLiked = false;
    if (currentUserId && typeof window !== 'undefined') {
      const savedIds = JSON.parse(localStorage.getItem(`${SAVED_PLAYLISTS_STORAGE_KEY}_${currentUserId}`) || '[]') as string[];
      const likedIds = JSON.parse(localStorage.getItem(`${LIKED_PLAYLISTS_STORAGE_KEY}_${currentUserId}`) || '[]') as string[];
      isSaved = savedIds.includes(id);
      isLiked = likedIds.includes(id);
    }

    return { playlist, isOwner, isAdmin: Boolean(isAdmin), canManage, isSharedWithMe, isSaved, isLiked };
  }

  // --- Write Operations ---

  public static createPlaylist(params: {
    ownerId: string;
    ownerName: string;
    ownerEmail?: string;
    ownerAvatarUrl?: string;
    name: string;
    description?: string;
    type: PlaylistType;
    visibility: PlaylistVisibility;
    coverUrl?: string;
    initialItems?: Array<{ mediaId: string; mediaType: MediaType }>;
    sharedWith?: string[];
  }): Playlist {
    const all = this.loadAll();

    const items: PlaylistItem[] = [];
    if (params.initialItems && params.initialItems.length > 0) {
      params.initialItems.forEach((it, idx) => {
        const item = this.resolveMediaItem(it.mediaId, it.mediaType, `pl-${Date.now()}`, idx);
        if (item) items.push(item);
      });
    }

    const totalDuration = items.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ownerId: params.ownerId,
      ownerName: params.ownerName || 'ChanceTEK One',
      ownerEmail: params.ownerEmail?.toLowerCase().trim() || undefined,
      ownerAvatarUrl: params.ownerAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
      name: params.name.trim(),
      description: params.description?.trim() || '',
      type: params.type,
      visibility: params.visibility,
      coverUrl: params.coverUrl || (items.length > 0 ? items[0].coverUrl : PRESET_COVERS[Math.floor(Math.random() * PRESET_COVERS.length)]),
      items,
      itemCount: items.length,
      totalDuration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sharedWith: params.sharedWith || [],
      stats: {
        plays: 0,
        saves: 0,
        likes: 0,
        shares: 0,
      },
    };

    all.unshift(newPlaylist);
    this.saveAll(all);

    AnalyticsEngine.trackEvent('playlist_created', {
      playlistId: newPlaylist.id,
      name: newPlaylist.name,
      type: newPlaylist.type,
      visibility: newPlaylist.visibility,
      userId: params.ownerId,
    });

    return newPlaylist;
  }

  public static updatePlaylist(
    playlistId: string,
    userId: string,
    updates: Partial<Pick<Playlist, 'name' | 'description' | 'visibility' | 'coverUrl' | 'type' | 'sharedWith'>>,
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; playlist?: Playlist; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);

    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, userId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can make changes to this playlist.' };
    }

    // Safety check: Prevent changing type if it would invalidate existing media
    if (updates.type && updates.type !== playlist.type) {
      const hasIncompatible = playlist.items.some((it) => {
        if (updates.type === 'mixed') return false;
        return it.mediaType !== updates.type;
      });
      if (hasIncompatible) {
        return {
          success: false,
          error: `Cannot change playlist type to ${updates.type} because it contains different media formats. Use Mixed instead.`,
        };
      }
    }

    const updated: Playlist = {
      ...playlist,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    this.saveAll(all);
    return { success: true, playlist: updated };
  }

  public static deletePlaylist(
    playlistId: string,
    userId: string,
    isAdmin?: boolean,
    userEmail?: string,
    reason: string = 'Removed from platform by Administrator'
  ): { success: boolean; error?: string } {
    const raw = this.getRawAll();
    const idx = raw.findIndex((p) => p.id === playlistId);

    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = raw[idx];
    if (!this.canUserModifyPlaylist(playlist, userId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can delete this playlist.' };
    }

    // Soft delete: mark isDeleted true so active queries exclude it
    raw[idx] = {
      ...playlist,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    };
    this.saveRaw(raw);

    // Archive into 45-day Playlist Recovery Vault
    const vault = this.loadRecoveryVault();
    const existingIdx = vault.findIndex((r) => r.originalPlaylistId === playlistId);
    const recItem: RecoverablePlaylistItem = {
      id: `rec-pl-${playlist.id}`,
      originalPlaylistId: playlist.id,
      playlist: { ...raw[idx] },
      removedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + FORTY_FIVE_DAYS_MS).toISOString(),
      daysRemaining: PLAYLIST_RETENTION_DAYS,
      removedByAdminId: userId,
      removedByAdminName: userEmail || 'Administrator',
      removedByAdminRole: isAdmin ? 'admin' : 'creator',
      reason,
    };

    if (existingIdx >= 0) {
      vault[existingIdx] = recItem;
    } else {
      vault.unshift(recItem);
    }
    this.persistRecoveryVault(vault);

    // Audit logging
    try {
      AuditLogger.logAction({
        adminId: userId,
        adminName: userEmail || 'Administrator',
        adminRole: (isAdmin ? 'admin' : 'user') as any,
        eventType: 'PLAYLIST_DELETED',
        action: `Moved playlist "${playlist.name}" to 45-day Recovery Vault (${reason})`,
        resource: 'Playlist Management',
        resourceId: playlist.id,
      });
    } catch {}

    return { success: true };
  }

  public static restorePlaylist(
    playlistId: string,
    adminActor?: { id?: string; name?: string; role?: string }
  ): { success: boolean; playlist?: Playlist; error?: string } {
    const vault = this.loadRecoveryVault();
    const recIdx = vault.findIndex(
      (r) => r.originalPlaylistId === playlistId || r.id === playlistId
    );

    const raw = this.getRawAll();
    const rawIdx = raw.findIndex((p) => p.id === playlistId);

    let restoredPlaylist: Playlist | null = null;

    if (rawIdx >= 0) {
      raw[rawIdx] = {
        ...raw[rawIdx],
        isDeleted: false,
        updatedAt: new Date().toISOString(),
      };
      restoredPlaylist = raw[rawIdx];
    } else if (recIdx >= 0) {
      restoredPlaylist = {
        ...vault[recIdx].playlist,
        isDeleted: false,
        updatedAt: new Date().toISOString(),
      };
      raw.unshift(restoredPlaylist);
    }

    if (!restoredPlaylist) {
      return { success: false, error: 'Playlist not found in recovery vault.' };
    }

    this.saveRaw(raw);

    // Remove from recovery vault
    if (recIdx >= 0) {
      vault.splice(recIdx, 1);
      this.persistRecoveryVault(vault);
    }

    // Audit logging
    try {
      AuditLogger.logAction({
        adminId: adminActor?.id || 'usr-admin',
        adminName: adminActor?.name || 'Administrator',
        adminRole: (adminActor?.role || 'admin') as any,
        eventType: 'PLAYLIST_RESTORED',
        action: `Restored playlist "${restoredPlaylist.name}" back to live platform`,
        resource: 'Playlist Management',
        resourceId: restoredPlaylist.id,
      });
    } catch {}

    return { success: true, playlist: restoredPlaylist };
  }

  public static permanentlyPurgePlaylist(
    playlistId: string,
    adminActor?: { id?: string; name?: string; role?: string }
  ): { success: boolean; error?: string } {
    const vault = this.loadRecoveryVault();
    const updatedVault = vault.filter(
      (r) => r.originalPlaylistId !== playlistId && r.id !== playlistId
    );
    this.persistRecoveryVault(updatedVault);

    const raw = this.getRawAll();
    const filteredRaw = raw.filter((p) => p.id !== playlistId);
    this.saveRaw(filteredRaw);

    try {
      AuditLogger.logAction({
        adminId: adminActor?.id || 'usr-admin',
        adminName: adminActor?.name || 'Administrator',
        adminRole: (adminActor?.role || 'admin') as any,
        eventType: 'PLAYLIST_PERMANENTLY_PURGED',
        action: `Permanently purged playlist "${playlistId}" from vault and storage`,
        resource: 'Playlist Management',
        resourceId: playlistId,
      });
    } catch {}

    return { success: true };
  }

  public static addItemToPlaylist(
    playlistId: string,
    userId: string,
    media: { mediaId: string; mediaType: MediaType },
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; item?: PlaylistItem; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);

    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, userId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can modify this playlist.' };
    }

    // Type compatibility check & auto-upgrade to mixed format (e.g. adding video to music crate)
    if (playlist.type !== 'mixed' && playlist.type !== media.mediaType) {
      playlist.type = 'mixed';
    }

    // Check duplicate
    const exists = playlist.items.some((it) => it.mediaId === media.mediaId && it.mediaType === media.mediaType);
    if (exists) {
      return { success: false, error: 'This item is already in the playlist.' };
    }

    const newItem = this.resolveMediaItem(media.mediaId, media.mediaType, playlistId, playlist.items.length);
    if (!newItem) {
      return { success: false, error: 'Media asset could not be found.' };
    }

    playlist.items.push(newItem);
    playlist.itemCount = playlist.items.length;
    playlist.totalDuration = playlist.items.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    playlist.updatedAt = new Date().toISOString();

    all[idx] = playlist;
    this.saveAll(all);
    return { success: true, item: newItem };
  }

  public static removeItemFromPlaylist(
    playlistId: string,
    userId: string,
    itemId: string,
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);

    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, userId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can modify this playlist.' };
    }

    const itemIdx = playlist.items.findIndex((it) => it.id === itemId);
    if (itemIdx === -1) return { success: false, error: 'Item not found in playlist.' };

    playlist.items.splice(itemIdx, 1);
    // Reindex positions
    playlist.items.forEach((it, i) => {
      it.position = i;
    });

    playlist.itemCount = playlist.items.length;
    playlist.totalDuration = playlist.items.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    playlist.updatedAt = new Date().toISOString();

    all[idx] = playlist;
    this.saveAll(all);
    return { success: true };
  }

  public static reorderPlaylistItems(
    playlistId: string,
    userId: string,
    itemIdsInOrder: string[],
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; items?: PlaylistItem[]; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);

    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, userId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can reorder this playlist.' };
    }

    const itemMap = new Map(playlist.items.map((it) => [it.id, it]));
    const reordered: PlaylistItem[] = [];

    itemIdsInOrder.forEach((id, pos) => {
      const item = itemMap.get(id);
      if (item) {
        item.position = pos;
        reordered.push(item);
      }
    });

    playlist.items = reordered;
    playlist.updatedAt = new Date().toISOString();

    all[idx] = playlist;
    this.saveAll(all);
    return { success: true, items: reordered };
  }

  public static toggleLikePlaylist(playlistId: string, userId: string): boolean {
    if (typeof window === 'undefined') return false;
    const key = `${LIKED_PLAYLISTS_STORAGE_KEY}_${userId}`;
    let likedIds: string[] = [];
    try {
      likedIds = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {}

    const isLiked = likedIds.includes(playlistId);
    if (isLiked) {
      likedIds = likedIds.filter((id) => id !== playlistId);
    } else {
      likedIds.push(playlistId);
    }
    localStorage.setItem(key, JSON.stringify(likedIds));

    // Update count in playlist stats
    const all = this.loadAll();
    const p = all.find((item) => item.id === playlistId);
    if (p) {
      p.stats.likes = Math.max(0, p.stats.likes + (isLiked ? -1 : 1));
      this.saveAll(all);

      EngagementMetricsService.recordInteraction({
        contentId: playlistId,
        contentTitle: p.name,
        contentType: 'playlist',
        reactionType: 'heart',
        action: isLiked ? 'remove' : 'add',
        userId,
        userName: userId === 'guest' ? 'Guest Listener' : p.ownerName,
        contextLocation: 'Community Crate / Playlist',
      });
    }

    if (!isLiked) {
      FavoritesService.addFavorite({ id: playlistId, category: 'playlists' }, userId);
    } else {
      FavoritesService.removeFavorite(playlistId, userId);
    }

    return !isLiked;
  }

  public static toggleSavePlaylist(playlistId: string, userId: string): boolean {
    if (typeof window === 'undefined') return false;
    const key = `${SAVED_PLAYLISTS_STORAGE_KEY}_${userId}`;
    let savedIds: string[] = [];
    try {
      savedIds = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {}

    const isSaved = savedIds.includes(playlistId);
    if (isSaved) {
      savedIds = savedIds.filter((id) => id !== playlistId);
    } else {
      savedIds.push(playlistId);
    }
    localStorage.setItem(key, JSON.stringify(savedIds));

    const all = this.loadAll();
    const p = all.find((item) => item.id === playlistId);
    if (p) {
      p.stats.saves = Math.max(0, p.stats.saves + (isSaved ? -1 : 1));
      this.saveAll(all);
    }

    if (!isSaved) {
      FavoritesService.addFavorite({ id: playlistId, category: 'playlists' }, userId);
    } else {
      FavoritesService.removeFavorite(playlistId, userId);
    }

    return !isSaved;
  }

  public static recordPlaylistPlay(playlistId: string): void {
    const all = this.loadAll();
    const p = all.find((item) => item.id === playlistId);
    if (p) {
      p.stats.plays += 1;
      this.saveAll(all);
    }
  }

  public static recordPlaylistShare(playlistId: string): void {
    const all = this.loadAll();
    const p = all.find((item) => item.id === playlistId);
    if (p) {
      p.stats.shares += 1;
      this.saveAll(all);
    }
  }

  public static shareWithUser(
    playlistId: string,
    ownerId: string,
    targetIdentifier: string,
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; sharedWith?: string[]; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);
    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, ownerId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can manage shared members.' };
    }

    const target = targetIdentifier.trim().toLowerCase();
    if (!target) return { success: false, error: 'Please enter a valid username or email.' };

    if (!playlist.sharedWith) {
      playlist.sharedWith = [];
    }

    if (!playlist.sharedWith.some((u) => u.toLowerCase() === target)) {
      playlist.sharedWith.push(target);
      playlist.updatedAt = new Date().toISOString();
      all[idx] = playlist;
      this.saveAll(all);

      AnalyticsEngine.trackEvent('playlist_share', {
        playlistId: playlist.id,
        ownerId,
        sharedWith: target,
      });
    }

    return { success: true, sharedWith: playlist.sharedWith };
  }

  public static removeSharedUser(
    playlistId: string,
    ownerId: string,
    targetIdentifier: string,
    isAdmin?: boolean,
    userEmail?: string
  ): { success: boolean; sharedWith?: string[]; error?: string } {
    const all = this.loadAll();
    const idx = all.findIndex((p) => p.id === playlistId);
    if (idx === -1) return { success: false, error: 'Playlist not found.' };

    const playlist = all[idx];
    if (!this.canUserModifyPlaylist(playlist, ownerId, isAdmin, userEmail)) {
      return { success: false, error: 'Only the playlist creator or an administrator can manage shared members.' };
    }

    const target = targetIdentifier.trim().toLowerCase();
    if (playlist.sharedWith) {
      playlist.sharedWith = playlist.sharedWith.filter((u) => u.toLowerCase() !== target);
      playlist.updatedAt = new Date().toISOString();
      all[idx] = playlist;
      this.saveAll(all);
    }

    return { success: true, sharedWith: playlist.sharedWith || [] };
  }

  public static searchPlaylists(query: string, currentUserId?: string): Playlist[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getPublicPlaylists();

    const all = this.loadAll();
    return all.filter((p) => {
      // Access check
      if (p.visibility === 'private' && p.ownerId !== currentUserId) return false;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q)
      );
    });
  }

  // --- Helper Helpers ---

  private static applyFilter(playlists: Playlist[], filter?: PlaylistFilter): Playlist[] {
    let result = [...playlists];

    if (!filter) return result;

    if (filter.type && filter.type !== 'all') {
      result = result.filter((p) => p.type === filter.type);
    }

    if (filter.visibility && filter.visibility !== 'all') {
      result = result.filter((p) => p.visibility === filter.visibility);
    }

    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.ownerName.toLowerCase().includes(q)
      );
    }

    if (filter.sortBy) {
      switch (filter.sortBy) {
        case 'recent':
          result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          break;
        case 'popular':
          result.sort((a, b) => b.stats.plays - a.stats.plays);
          break;
        case 'tracks':
          result.sort((a, b) => b.itemCount - a.itemCount);
          break;
        case 'name':
          result.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    return result;
  }

  private static resolveMediaItem(
    mediaId: string,
    mediaType: MediaType,
    playlistId: string,
    position: number
  ): PlaylistItem | null {
    if (mediaType === 'music') {
      if (MusicCatalogService.isTrackPermanentlyRemoved(mediaId)) return null;
      const track = MusicCatalogService.getTrackById(mediaId);
      if (!track || MusicCatalogService.isTrackPermanentlyRemoved(track.id, track.title, track.artistName)) return null;
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playlistId,
        mediaId: track.id,
        mediaType: 'music',
        title: track.title,
        artistName: track.artistName,
        coverUrl: track.coverUrl,
        duration: track.duration,
        position,
        addedAt: new Date().toISOString(),
        audioUrl: track.audioUrl,
        bpm: track.bpm,
        genre: track.genre,
      };
    }

    if (mediaType === 'video') {
      const video = MOCK_VIDEOS.find((v) => v.id === mediaId);
      if (!video) return null;
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playlistId,
        mediaId: video.id,
        mediaType: 'video',
        title: video.title,
        artistName: video.artistName,
        coverUrl: video.thumbnailUrl,
        duration: video.duration,
        position,
        addedAt: new Date().toISOString(),
        videoUrl: video.videoUrl,
        genre: video.category,
      };
    }

    if (mediaType === 'audiobook') {
      const book = MOCK_AUDIOBOOKS.find((b) => b.id === mediaId);
      if (!book) return null;
      const firstChapter = book.chapters[0];
      return {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playlistId,
        mediaId: book.id,
        mediaType: 'audiobook',
        title: firstChapter ? firstChapter.title : book.title,
        artistName: book.author,
        coverUrl: book.coverUrl,
        duration: firstChapter ? firstChapter.duration : book.duration,
        position,
        addedAt: new Date().toISOString(),
        audioUrl: firstChapter?.audioUrl || '/audio/Fort Apache.mp3',
        chapterIndex: 1,
        genre: book.genre,
      };
    }

    return null;
  }
}
