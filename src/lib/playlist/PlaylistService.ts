import { Playlist, PlaylistItem, PlaylistType, PlaylistVisibility, PlaylistFilter } from '@/types/playlist';
import { MediaType, Track, Video, Audiobook, AudiobookChapter } from '@/types/media';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { FavoritesService } from '@/lib/favorites/FavoritesService';
import { EngagementMetricsService } from '@/lib/analytics/EngagementMetricsService';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

const AUTH_SESSION_STORAGE_KEY = 'spades_auth_session_v2';
const PLAYLIST_OUTBOX_STORAGE_KEY = '8spades_playlists_outbox_v1';
const PLAYLIST_KNOWN_REMOTE_KEY = '8spades_playlists_remote_ids_v1';
const PLAYLIST_SYNC_POLL_MS = 60_000; // 60s idle poll lets mobile radios sleep; Firestore onSnapshot + mutations + focus push instantly

export interface PlaylistMediaInput {
  mediaId: string;
  mediaType: MediaType | 'podcast';
  title?: string;
  artistName?: string;
  coverUrl?: string;
  duration?: number;
  audioUrl?: string;
  videoUrl?: string;
  genre?: string;
}

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

// Zero synthetic/mock seed playlists — ONLY real member-created playlists exist on the platform.
export const INITIAL_PUBLIC_PLAYLISTS: Playlist[] = [];

const LEGACY_SYNTHETIC_PLAYLIST_IDS = new Set<string>([
  'pl-featured-master',
  'pl-mixed-experience',
  'pl-video-master',
  'pl-audiobook-master',
]);

export class PlaylistService {
  private static listeners: Set<() => void> = new Set();
  private static syncStarted = false;
  private static lastServerRevision: number | null = null;
  private static lastSyncedAt = 0;
  private static isFetchingServer = false;
  private static refetchQueued = false;
  private static refetchForceQueued = false;
  private static pendingUpserts = new Map<string, Playlist>();
  private static pendingDeletes = new Set<string>();
  private static pushedLegacyIds = new Set<string>();
  private static retryTimer: ReturnType<typeof setTimeout> | null = null;
  private static metaUnsub: (() => void) | null = null;
  private static syncIdentity: { userId?: string; email?: string; isAdmin?: boolean } = {};

  private static loadPersistedOutbox(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PLAYLIST_OUTBOX_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.upserts)) {
        parsed.upserts.forEach((p: Playlist) => {
          if (p && p.id && !this.pendingUpserts.has(p.id)) {
            this.pendingUpserts.set(p.id, p);
          }
        });
      }
      if (Array.isArray(parsed?.deletes)) {
        parsed.deletes.forEach((id: string) => {
          if (typeof id === 'string' && id) this.pendingDeletes.add(id);
        });
      }
    } catch {
      /* ignore */
    }
  }

  private static persistOutbox(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        PLAYLIST_OUTBOX_STORAGE_KEY,
        JSON.stringify({
          upserts: Array.from(this.pendingUpserts.values()),
          deletes: Array.from(this.pendingDeletes.values()),
        })
      );
    } catch {
      /* ignore */
    }
  }

  private static loadKnownRemoteIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(PLAYLIST_KNOWN_REMOTE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.filter((s) => typeof s === 'string'));
      }
    } catch {
      /* ignore */
    }
    return new Set();
  }

  private static saveKnownRemoteIds(ids: Set<string>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PLAYLIST_KNOWN_REMOTE_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      /* ignore */
    }
  }

  private static scheduleOutboxRetry(delayMs = 3_500): void {
    if (typeof window === 'undefined') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.pendingUpserts.size > 0 || this.pendingDeletes.size > 0) {
        void this.flushPendingToServer();
      }
    }, delayMs);
  }

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

  private static readSessionIdentity(): { userId?: string; email?: string; isAdmin?: boolean } {
    if (typeof window === 'undefined') return this.syncIdentity;
    try {
      const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const userId = parsed?.profile?.id || parsed?.userId || this.syncIdentity.userId;
        const email =
          (parsed?.profile?.email || parsed?.email || this.syncIdentity.email || '').trim().toLowerCase() ||
          undefined;
        const role = parsed?.profile?.role;
        const isAdmin =
          Boolean(this.syncIdentity.isAdmin) ||
          role === 'admin' ||
          role === 'super_admin' ||
          role === 'executive';
        return { userId, email, isAdmin };
      }
    } catch {
      /* ignore */
    }
    if (auth?.currentUser) {
      return {
        userId: this.syncIdentity.userId || auth.currentUser.uid,
        email: this.syncIdentity.email || auth.currentUser.email?.trim().toLowerCase() || undefined,
        isAdmin: this.syncIdentity.isAdmin,
      };
    }
    return this.syncIdentity;
  }

  private static async buildSyncHeaders(
    includeContentType = true,
    fallbackActor?: { userId?: string; email?: string }
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    const id = this.readSessionIdentity();
    const effectiveUserId = id.userId || fallbackActor?.userId;
    const effectiveEmail = id.email || fallbackActor?.email?.trim().toLowerCase();
    if (effectiveUserId) headers['x-user-id'] = effectiveUserId;
    if (effectiveEmail) {
      headers['x-user-email'] = effectiveEmail;
      if (id.isAdmin) headers['x-admin-email'] = effectiveEmail;
    }
    try {
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      /* fall back to session headers */
    }
    return headers;
  }

  public static setSyncIdentity(identity: { userId?: string; email?: string; isAdmin?: boolean }): void {
    const nextEmail = identity.email?.trim().toLowerCase() || undefined;
    const changed =
      this.syncIdentity.userId !== identity.userId ||
      this.syncIdentity.email !== nextEmail ||
      Boolean(this.syncIdentity.isAdmin) !== Boolean(identity.isAdmin);
    this.syncIdentity = {
      userId: identity.userId,
      email: nextEmail,
      isAdmin: identity.isAdmin,
    };
    if (changed && typeof window !== 'undefined') {
      void this.syncFromServer(true);
    }
  }

  public static startCloudSync(): void {
    if (this.syncStarted || typeof window === 'undefined') return;
    this.syncStarted = true;
    this.loadPersistedOutbox();

    void this.syncFromServer(true);

    window.setInterval(() => {
      if (!document.hidden) {
        void this.syncFromServer(false);
      }
    }, PLAYLIST_SYNC_POLL_MS);

    window.addEventListener('focus', () => {
      if (Date.now() - this.lastSyncedAt > 4_000) {
        void this.syncFromServer(true);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - this.lastSyncedAt > 4_000) {
        void this.syncFromServer(true);
      }
    });

    window.addEventListener('online', () => {
      void this.flushPendingToServer().then(() => this.syncFromServer(true));
    });

    // Near-instant real-time push across all users & devices when ANY member creates/updates a Public playlist
    try {
      this.metaUnsub = onSnapshot(
        doc(db, 'catalog_meta', 'playlists_state'),
        (snap) => {
          const rev = Number(snap.data()?.revision || 0);
          if (rev > 0 && rev !== (this.lastServerRevision ?? -1)) {
            void this.syncFromServer(true);
          }
        },
        () => {
          /* permission denied / offline — polling + focus covers it */
        }
      );
    } catch {
      /* ignore */
    }
  }

  public static async syncPlaylistNow(
    playlist: Playlist
  ): Promise<{ ok: boolean; error?: string }> {
    return this.pushPlaylistToServer(playlist);
  }

  private static async pushPlaylistToServer(
    playlist: Playlist
  ): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === 'undefined') return { ok: false, error: 'SSR context' };
    this.pendingDeletes.delete(playlist.id);
    this.pendingUpserts.set(playlist.id, playlist);
    this.persistOutbox();
    try {
      const headers = await this.buildSyncHeaders(true, {
        userId: playlist.ownerId,
        email: playlist.ownerEmail,
      });
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify({ action: 'upsert', playlist }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        if (this.pendingUpserts.get(playlist.id) === playlist) {
          this.pendingUpserts.delete(playlist.id);
          this.persistOutbox();
        }
        this.pushedLegacyIds.add(playlist.id);
        const known = this.loadKnownRemoteIds();
        known.add(playlist.id);
        this.saveKnownRemoteIds(known);
        if (typeof body?.revision === 'number') {
          this.lastServerRevision = body.revision;
        }
        return { ok: true };
      }
      const errMsg = body?.error || `Server returned ${res.status}`;
      console.warn('[PlaylistService] Server upsert failed, will retry:', errMsg);
      this.scheduleOutboxRetry(3_500);
      return { ok: false, error: errMsg };
    } catch (err: any) {
      console.warn('[PlaylistService] Background server upsert deferred, will retry:', err);
      this.scheduleOutboxRetry(4_000);
      return { ok: false, error: err?.message || 'Network error' };
    }
  }

  private static async pushDeleteToServer(playlistId: string, permanent = false): Promise<void> {
    if (typeof window === 'undefined') return;
    this.pendingUpserts.delete(playlistId);
    this.pendingDeletes.add(playlistId);
    this.persistOutbox();
    try {
      const headers = await this.buildSyncHeaders(true);
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify({ action: 'delete', playlistId, permanent }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        this.pendingDeletes.delete(playlistId);
        this.persistOutbox();
        if (typeof body?.revision === 'number') {
          this.lastServerRevision = body.revision;
        }
      } else {
        this.scheduleOutboxRetry(4_000);
      }
    } catch (err) {
      console.warn('[PlaylistService] Background server delete deferred:', err);
      this.scheduleOutboxRetry(4_000);
    }
  }

  private static async pushStatToServer(
    playlistId: string,
    field: 'plays' | 'saves' | 'likes' | 'shares',
    delta = 1
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ action: 'stat', playlistId, field, delta }),
      });
    } catch {
      /* non-fatal */
    }
  }

  private static async flushPendingToServer(): Promise<void> {
    const upserts = Array.from(this.pendingUpserts.values());
    for (const pl of upserts) {
      await this.pushPlaylistToServer(pl);
    }
    const deletes = Array.from(this.pendingDeletes.values());
    for (const id of deletes) {
      await this.pushDeleteToServer(id, false);
    }
  }

  public static async syncFromServer(force = false): Promise<Playlist[]> {
    if (typeof window === 'undefined') return [];
    if (this.isFetchingServer) {
      this.refetchQueued = true;
      if (force) this.refetchForceQueued = true;
      return this.loadAll();
    }
    this.isFetchingServer = true;
    try {
      this.loadPersistedOutbox();
      if (this.pendingUpserts.size > 0 || this.pendingDeletes.size > 0) {
        await this.flushPendingToServer();
      }

      const headers = await this.buildSyncHeaders(false);
      const url =
        !force && this.lastServerRevision !== null && this.lastServerRevision > 0
          ? `/api/playlists?rev=${this.lastServerRevision}`
          : '/api/playlists';
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) return this.loadAll();

      const body = await res.json().catch(() => null);
      this.lastSyncedAt = Date.now();
      if (!body?.ok) return this.loadAll();
      if (body.unchanged) return this.loadAll();

      const serverPlaylists: Playlist[] = Array.isArray(body.playlists) ? body.playlists : [];
      if (typeof body.revision === 'number') {
        this.lastServerRevision = body.revision;
      }

      const localRaw = this.getRawAll();
      const mergedMap = new Map<string, Playlist>();
      const previouslyKnownRemote = this.loadKnownRemoteIds();

      // Start with all local playlists (NEVER drop locally created playlists!)
      localRaw.forEach((p) => {
        if (p && p.id) mergedMap.set(p.id, p);
      });

      const serverIds = new Set<string>();
      const session = this.readSessionIdentity();

      // Merge authoritative server playlists
      serverPlaylists.forEach((sp) => {
        if (!sp || !sp.id || LEGACY_SYNTHETIC_PLAYLIST_IDS.has(sp.id)) return;
        serverIds.add(sp.id);
        if (this.pendingDeletes.has(sp.id) || this.pendingUpserts.has(sp.id)) return;

        const existing = mergedMap.get(sp.id);
        if (!existing) {
          mergedMap.set(sp.id, this.sanitizePlaylist(sp));
          return;
        }

        const isOwnedLocally = this.canUserModifyPlaylist(
          existing,
          session.userId,
          false,
          session.email
        );
        const existingTs = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
        const serverTs = Date.parse(sp.updatedAt || sp.createdAt || '') || 0;
        if (!isOwnedLocally || serverTs >= existingTs) {
          mergedMap.set(sp.id, this.sanitizePlaylist(sp));
        }
      });

      // Only prune a playlist if it was PREVIOUSLY fetched from the server (remote-origin)
      // and is now gone from the server — NEVER prune local-only playlists before migration!
      const finalList: Playlist[] = [];
      mergedMap.forEach((pl) => {
        if (pl.isDeleted) {
          finalList.push(pl);
          return;
        }
        const isOwned = this.canUserModifyPlaylist(pl, session.userId, false, session.email);
        const wasRemoteOnly = previouslyKnownRemote.has(pl.id) && !isOwned;
        if (wasRemoteOnly && !serverIds.has(pl.id) && !this.pendingUpserts.has(pl.id)) {
          return;
        }
        finalList.push(pl);
      });

      // Persist updated set of known remote IDs
      const nextKnownRemote = new Set<string>(serverIds);
      this.saveKnownRemoteIds(nextKnownRemote);

      // Auto-migrate any existing local-only playlists (public OR owned by current user) up to the server!
      const localOnlyToMigrate = finalList.filter((pl) => {
        if (pl.isDeleted || serverIds.has(pl.id) || this.pushedLegacyIds.has(pl.id)) return false;
        if (pl.visibility === 'public') return true;
        if (session.userId || session.email) {
          return this.canUserModifyPlaylist(pl, session.userId, session.isAdmin, session.email);
        }
        return false;
      });
      localOnlyToMigrate.forEach((pl) => {
        void this.pushPlaylistToServer(pl);
      });

      const prevJson = JSON.stringify(localRaw);
      const nextJson = JSON.stringify(finalList);
      if (prevJson !== nextJson) {
        this.saveRaw(finalList);
      }

      return finalList.filter((p) => !p.isDeleted);
    } catch {
      return this.loadAll();
    } finally {
      this.isFetchingServer = false;
      if (this.refetchQueued) {
        const nextForce = this.refetchForceQueued;
        this.refetchQueued = false;
        this.refetchForceQueued = false;
        void this.syncFromServer(nextForce);
      }
    }
  }

  public static async fetchPlaylistFromServer(playlistId: string): Promise<Playlist | null> {
    if (typeof window === 'undefined' || !playlistId) return null;
    try {
      const headers = await this.buildSyncHeaders(false);
      const res = await fetch(`/api/playlists?id=${encodeURIComponent(playlistId)}`, {
        headers,
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      if (!body?.ok || !body.playlist) return null;

      const remotePl = this.sanitizePlaylist(body.playlist as Playlist);
      const raw = this.getRawAll();
      const idx = raw.findIndex((p) => p.id === remotePl.id);
      if (idx >= 0) {
        raw[idx] = remotePl;
      } else {
        raw.unshift(remotePl);
      }
      this.saveRaw(raw);
      return remotePl;
    } catch {
      return null;
    }
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
      return [];
    }
    try {
      const stored = localStorage.getItem(PLAYLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Playlist[];
        const cleaned = (Array.isArray(parsed) ? parsed : []).filter(
          (p) => p && p.id && !LEGACY_SYNTHETIC_PLAYLIST_IDS.has(p.id) && p.ownerId !== 'creator-chancetekone'
        );
        if (cleaned.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
          localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned.map((p) => this.sanitizePlaylist(p));
      }
    } catch (e) {
      console.warn('Error loading playlists from localStorage:', e);
    }
    return [];
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
        (Boolean(userId) && p.ownerId === userId) ||
        Boolean(normalizedEmail && p.ownerEmail && p.ownerEmail.toLowerCase() === normalizedEmail) ||
        (userId === 'usr-member' && p.ownerId === 'usr-member' && !p.ownerEmail)
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
    initialItems?: PlaylistMediaInput[];
    sharedWith?: string[];
  }): Playlist {
    const all = this.loadAll();
    const playlistId = `pl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const items: PlaylistItem[] = [];
    if (params.initialItems && params.initialItems.length > 0) {
      params.initialItems.forEach((it, idx) => {
        const item = this.resolveMediaItem(it, playlistId, idx);
        if (item) items.push(item);
      });
    }

    const totalDuration = items.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    // Ensure playlist type matches initial items (auto-upgrade to mixed if heterogeneous)
    let resolvedType: PlaylistType = params.type;
    if (items.length > 0 && resolvedType !== 'mixed') {
      const hasDifferentType = items.some((it) => it.mediaType !== resolvedType);
      if (hasDifferentType) {
        resolvedType = 'mixed';
      }
    }

    const newPlaylist: Playlist = {
      id: playlistId,
      ownerId: params.ownerId,
      ownerName: params.ownerName || 'ChanceTEK One',
      ownerEmail: params.ownerEmail?.toLowerCase().trim() || undefined,
      ownerAvatarUrl: params.ownerAvatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
      name: params.name.trim(),
      description: params.description?.trim() || '',
      type: resolvedType,
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
    void this.pushPlaylistToServer(newPlaylist);

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
    void this.pushPlaylistToServer(updated);
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
    void this.pushDeleteToServer(playlistId, false);

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
    void this.pushPlaylistToServer(restoredPlaylist);

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
    void this.pushDeleteToServer(playlistId, true);

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
    media: PlaylistMediaInput,
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

    const newItem = this.resolveMediaItem(media, playlistId, playlist.items.length);
    if (!newItem) {
      return { success: false, error: 'Media asset could not be found.' };
    }

    // Type compatibility check & auto-upgrade to mixed format (e.g. adding video/podcast/audiobook to music crate)
    if (playlist.type !== 'mixed' && playlist.type !== newItem.mediaType) {
      playlist.type = 'mixed';
    }

    // Check duplicate (by mediaId across matching normalized type or exact mediaId)
    const exists = playlist.items.some(
      (it) => it.mediaId === newItem.mediaId && (it.mediaType === newItem.mediaType || media.mediaType === 'podcast')
    );
    if (exists) {
      return { success: false, error: 'This item is already in the playlist.' };
    }

    playlist.items.push(newItem);
    playlist.itemCount = playlist.items.length;
    playlist.totalDuration = playlist.items.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    playlist.updatedAt = new Date().toISOString();

    all[idx] = playlist;
    this.saveAll(all);
    void this.pushPlaylistToServer(playlist);
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
    void this.pushPlaylistToServer(playlist);
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
    void this.pushPlaylistToServer(playlist);
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
      void this.pushStatToServer(playlistId, 'likes', isLiked ? -1 : 1);

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
      void this.pushStatToServer(playlistId, 'saves', isSaved ? -1 : 1);
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
    void this.pushStatToServer(playlistId, 'plays', 1);
  }

  public static recordPlaylistShare(playlistId: string): void {
    const all = this.loadAll();
    const p = all.find((item) => item.id === playlistId);
    if (p) {
      p.stats.shares += 1;
      this.saveAll(all);
    }
    void this.pushStatToServer(playlistId, 'shares', 1);
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
      void this.pushPlaylistToServer(playlist);

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
      void this.pushPlaylistToServer(playlist);
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
    input: PlaylistMediaInput,
    playlistId: string,
    position: number
  ): PlaylistItem | null {
    const { mediaId, mediaType } = input;
    const itemUid = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    // 1. Podcast resolution (explicit 'podcast' OR fallback when a podcast is passed as 'music'/'video')
    const resolvePodcast = () => {
      const pod = MediaCatalogService.getAllPodcasts().find((p) => p.id === mediaId);
      if (!pod) return null;
      const isVid =
        pod.mediaType === 'video' ||
        pod.mediaUrl.toLowerCase().endsWith('.mp4') ||
        pod.mediaUrl.toLowerCase().endsWith('.mov');
      return {
        id: itemUid,
        playlistId,
        mediaId: pod.id,
        mediaType: (isVid ? 'video' : 'music') as MediaType,
        title: pod.title,
        artistName: `${pod.showTitle} • ${pod.host}`,
        coverUrl: pod.coverUrl || '/images/studio_cover.jpg',
        duration: pod.duration || 0,
        position,
        addedAt: nowIso,
        audioUrl: isVid ? undefined : pod.mediaUrl,
        videoUrl: isVid ? pod.mediaUrl : undefined,
        genre: pod.category || 'Podcast',
      } satisfies PlaylistItem;
    };

    if (mediaType === 'podcast') {
      const podItem = resolvePodcast();
      if (podItem) return podItem;
      if (input.title) {
        const isVid = Boolean(input.videoUrl) || Boolean(input.audioUrl?.toLowerCase().endsWith('.mp4'));
        return {
          id: itemUid,
          playlistId,
          mediaId,
          mediaType: isVid ? 'video' : 'music',
          title: input.title,
          artistName: input.artistName || 'Podcast',
          coverUrl: input.coverUrl || '/images/studio_cover.jpg',
          duration: input.duration || 0,
          position,
          addedAt: nowIso,
          audioUrl: isVid ? undefined : input.audioUrl,
          videoUrl: isVid ? (input.videoUrl || input.audioUrl) : undefined,
          genre: input.genre || 'Podcast',
        };
      }
      return null;
    }

    // 2. Music Track resolution
    if (mediaType === 'music') {
      if (MusicCatalogService.isTrackPermanentlyRemoved(mediaId)) return null;
      const track =
        MusicCatalogService.getTrackById(mediaId) ||
        MOCK_TRACKS.find((t) => t.id === mediaId);
      if (track) {
        if (MusicCatalogService.isTrackPermanentlyRemoved(track.id, track.title, track.artistName)) {
          return null;
        }
        return {
          id: itemUid,
          playlistId,
          mediaId: track.id,
          mediaType: 'music',
          title: track.title,
          artistName: track.artistName,
          coverUrl: MusicCatalogService.resolveTrackCover(track),
          duration: track.duration,
          position,
          addedAt: nowIso,
          audioUrl: track.audioUrl,
          bpm: track.bpm,
          genre: track.genre,
        };
      }
      const podFallback = resolvePodcast();
      if (podFallback) return podFallback;
      if (input.title) {
        return {
          id: itemUid,
          playlistId,
          mediaId,
          mediaType: 'music',
          title: input.title,
          artistName: input.artistName || 'ChanceTEK One',
          coverUrl: input.coverUrl || '/images/studio_cover.jpg',
          duration: input.duration || 0,
          position,
          addedAt: nowIso,
          audioUrl: input.audioUrl,
          genre: input.genre || 'Music',
        };
      }
      return null;
    }

    // 3. Video resolution (checks live MediaCatalogService first, then MOCK_VIDEOS, then podcasts)
    if (mediaType === 'video') {
      const video =
        MediaCatalogService.getAllVideos().find((v) => v.id === mediaId) ||
        MOCK_VIDEOS.find((v) => v.id === mediaId);
      if (video) {
        return {
          id: itemUid,
          playlistId,
          mediaId: video.id,
          mediaType: 'video',
          title: video.title,
          artistName: video.artistName,
          coverUrl: video.thumbnailUrl || '/images/studio_cover.jpg',
          duration: video.duration,
          position,
          addedAt: nowIso,
          videoUrl: video.videoUrl,
          genre: video.category,
        };
      }
      const podFallback = resolvePodcast();
      if (podFallback) return podFallback;
      if (input.title) {
        return {
          id: itemUid,
          playlistId,
          mediaId,
          mediaType: 'video',
          title: input.title,
          artistName: input.artistName || 'ChanceTEK One',
          coverUrl: input.coverUrl || '/images/studio_cover.jpg',
          duration: input.duration || 0,
          position,
          addedAt: nowIso,
          videoUrl: input.videoUrl,
          genre: input.genre || '4K Video',
        };
      }
      return null;
    }

    // 4. Audiobook resolution (checks live MediaCatalogService first, then MOCK_AUDIOBOOKS)
    if (mediaType === 'audiobook') {
      const book =
        MediaCatalogService.getAllAudiobooks().find((b) => b.id === mediaId) ||
        MOCK_AUDIOBOOKS.find((b) => b.id === mediaId);
      if (book) {
        const firstChapter = book.chapters?.[0];
        const firstUrl = firstChapter?.audioUrl || '';
        const isVideoBook =
          book.mediaFormat === 'video' ||
          firstUrl.toLowerCase().endsWith('.mp4') ||
          firstUrl.toLowerCase().endsWith('.mov');
        return {
          id: itemUid,
          playlistId,
          mediaId: book.id,
          mediaType: 'audiobook',
          title: book.title,
          artistName: book.author,
          coverUrl: book.coverUrl || '/images/studio_cover.jpg',
          duration: firstChapter ? firstChapter.duration : book.duration,
          position,
          addedAt: nowIso,
          audioUrl: isVideoBook ? undefined : firstUrl || undefined,
          videoUrl: isVideoBook ? firstUrl : undefined,
          chapterIndex: 1,
          genre: book.genre,
        };
      }
      if (input.title) {
        return {
          id: itemUid,
          playlistId,
          mediaId,
          mediaType: 'audiobook',
          title: input.title,
          artistName: input.artistName || 'Author',
          coverUrl: input.coverUrl || '/images/studio_cover.jpg',
          duration: input.duration || 0,
          position,
          addedAt: nowIso,
          audioUrl: input.audioUrl,
          videoUrl: input.videoUrl,
          chapterIndex: 1,
          genre: input.genre || 'Audiobook',
        };
      }
      return null;
    }

    return null;
  }
}
