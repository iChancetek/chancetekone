
/**
 * ChanceTEK One — Centralized Music Catalog Service
 * Manages the 8 official Crates, album/folder hierarchies, and published tracks.
 * Seamlessly extends existing MOCK_TRACKS and MOCK_ALBUMS with newly approved music.
 */

import {
  CrateDefinition,
  OFFICIAL_CRATES,
  DIRECT_MUSIC_CRATE,
  CrateFolder,
  CrateAnalyticsRecord,
} from '@/types/catalog';
import { Track, Album } from '@/types/media';
import { MOCK_TRACKS, MOCK_ALBUMS } from '@/lib/mockData';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { MusicRecoveryService } from '@/lib/music/MusicRecoveryService';
import { AdminRole } from '@/types/admin';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { optimizeCoverArtDataUrl } from '@/lib/audio/id3Parser';
import { EngagementMetricsService } from '@/lib/analytics/EngagementMetricsService';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import { CatalogCollection, CatalogDoc, CatalogOp, CatalogSnapshot } from '@/lib/catalog/cloudShared';
import { ChangeTracker, mergeWithRemote } from '@/lib/catalog/catalogMerge';
import { needsCloudAudioExternalization, prepareArtworkDoc, prepareTrackDoc } from '@/lib/catalog/catalogAssets';
import { getAuthenticAudioUrl, isCrossArtistAudioMismatch, isVerifiedServerUpload, VERIFIED_SERVER_UPLOADS } from './authenticAudioMap';
import { auditAudioAssociations, AudioFinding, logAudioDiag, unescapeIndexedDbUrl } from './audioAssetIntegrity';
import {
  normalizeTrackTitle,
  normalizeArtistName,
  normalizeAlbumTitle,
  resolveSafeAudioUrl,
} from './musicMetadataNormalizer';
import { classifyGenre, isGenericOrInvalidGenre } from './genreClassifier';
import { filterAndRankTracks, matchesTrackSearch } from '@/lib/search/universalSearch';

const PUBLISHED_TRACKS_KEY = 'spades_catalog_published_tracks_v2';
const CRATE_FOLDERS_KEY = 'spades_catalog_crate_folders_v2';
const REMOVED_TRACKS_KEY = 'spades_catalog_removed_tracks_v2';
const REMOVED_ALBUMS_KEY = 'spades_catalog_removed_albums_v2';
const PUBLISHED_ALBUMS_KEY = 'spades_catalog_published_albums_v2';
const CRATES_STORAGE_KEY = 'spades_catalog_crates_v2';
const CUSTOM_COVERS_KEY = 'spades_catalog_custom_covers_v2';

import {
  KNOWN_ALBUM_COVERS,
  THRILLER_TRACKS,
  OFF_THE_WALL_TRACKS,
  normalizeAlbumKey,
  isGenericOrVirtualAlbum,
  knownAlbumCover,
  getAuthenticCoverForTrack,
  getDefaultCoverForTrack,
  isMissingOrGenericCover,
  correctedKnownCover,
  MICHAEL_JACKSON_TRACKS,
  VAULT_CLASSIC_TRACKS,
  JANET_JACKSON_TRACKS,
  AVANT_TRACKS,
  ONE_ONE_TWO_TRACKS,
  ASHANTI_TRACKS,
  CHRIS_BROWN_TRACKS,
  BROWNSTONE_TRACKS,
  JERMAINE_DUPRI_TRACKS,
  BREAKBEAT_ANTHEM_TRACK,
  PLATFORM_CANONICAL_TRACKS,
} from './canonicalCatalogData';

export * from './canonicalCatalogData';


class MusicCatalogServiceClass {
  private customCrates: CrateDefinition[] = OFFICIAL_CRATES.map((c) => ({ ...c }));
  private publishedTracks: Track[] = [];
  private crateFolders: CrateFolder[] = [];
  private publishedAlbums: Album[] = [];
  private removedTrackIds: string[] = [];
  private removedAlbumIds: string[] = [];
  private customCovers: Record<string, string> = {};
  private listeners: Set<() => void> = new Set();

  // ── Shared cloud catalog state ──
  private trackChanges = new ChangeTracker<Track>();
  private albumChanges = new ChangeTracker<Album>();
  private folderChanges = new ChangeTracker<CrateFolder>();
  private crateChanges = new ChangeTracker<CrateDefinition>();
  private removedChanges = new ChangeTracker<{ id: string }>();
  private applyingCloud = false;
  private selfNotifying = false;

  // ── In-memory memoization caches (invalidated on any catalog mutation) ──
  private catalogVersion = 0;
  private cachedAllTracks: { version: number; tracks: Track[] } | null = null;
  private cachedAllAlbums: { version: number; albums: Album[] } | null = null;
  private cachedOfficialCrates: { version: number; crates: CrateDefinition[] } | null = null;
  private cachedRemovedTrackSet: { ref: string[]; len: number; set: Set<string> } | null = null;
  private cachedRemovedAlbumSet: { ref: string[]; len: number; set: Set<string> } | null = null;

  private invalidateCache(): void {
    this.catalogVersion++;
    this.cachedAllTracks = null;
    this.cachedAllAlbums = null;
    this.cachedOfficialCrates = null;
    this.cachedRemovedTrackSet = null;
    this.cachedRemovedAlbumSet = null;
  }

  private getRemovedTrackSet(): Set<string> {
    if (
      !this.cachedRemovedTrackSet ||
      this.cachedRemovedTrackSet.ref !== this.removedTrackIds ||
      this.cachedRemovedTrackSet.len !== this.removedTrackIds.length
    ) {
      this.cachedRemovedTrackSet = {
        ref: this.removedTrackIds,
        len: this.removedTrackIds.length,
        set: new Set(this.removedTrackIds),
      };
    }
    return this.cachedRemovedTrackSet.set;
  }

  private getRemovedAlbumSet(): Set<string> {
    if (
      !this.cachedRemovedAlbumSet ||
      this.cachedRemovedAlbumSet.ref !== this.removedAlbumIds ||
      this.cachedRemovedAlbumSet.len !== this.removedAlbumIds.length
    ) {
      this.cachedRemovedAlbumSet = {
        ref: this.removedAlbumIds,
        len: this.removedAlbumIds.length,
        set: new Set(this.removedAlbumIds),
      };
    }
    return this.cachedRemovedAlbumSet.set;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadCatalog();
      this.initStorageListener();
      this.initCloud();
    }
  }

  /* ───────────────────── Shared cloud catalog (Firestore) ───────────────────── */

  private initCloud() {
    CloudCatalogClient.registerPreparer('tracks', prepareTrackDoc, (_orig, prepared) =>
      this.onTrackPrepared(prepared)
    );
    CloudCatalogClient.registerPreparer('albums', prepareArtworkDoc, (_orig, prepared) =>
      this.onArtworkPrepared('albums', prepared)
    );
    CloudCatalogClient.registerPreparer('folders', prepareArtworkDoc, (_orig, prepared) =>
      this.onArtworkPrepared('folders', prepared)
    );
    CloudCatalogClient.onSyncNow(() => this.forcePushAllToCloud());
    this.resetCloudBaselines();
    CloudCatalogClient.subscribe((snap) => this.applyCloudSnapshot(snap));
    CloudCatalogClient.start();
  }

  private removedTombstones(): { id: string; kind: string }[] {
    return [
      ...this.removedTrackIds.map((id) => ({ id: `track:${id}`, kind: 'track' })),
      ...this.removedAlbumIds.map((id) => ({ id: `album:${id}`, kind: 'album' })),
    ];
  }

  /**
   * Returns true if a track has been permanently deleted from the platform.
   * Checks track ID, title key, and title+artist composite key against tombstones.
   */
  public isTrackPermanentlyRemoved(id?: string, title?: string, artist?: string): boolean {
    if (!id && !title) return false;
    const removedSet = this.getRemovedTrackSet();
    if (id && removedSet.has(id)) return true;

    if (title) {
      const titleKey = normalizeAlbumKey(title);
      if (removedSet.has(`title:${titleKey}`)) return true;
      if (removedSet.has(titleKey)) return true;

      if (artist) {
        const artistKey = normalizeAlbumKey(artist);
        const compositeKey = `key:${titleKey}:::${artistKey}`;
        if (removedSet.has(compositeKey)) return true;
      }
    }
    return false;
  }

  /**
   * Returns true if an album has been permanently deleted from the platform.
   */
  public isAlbumPermanentlyRemoved(id?: string, title?: string): boolean {
    if (!id && !title) return false;
    const removedSet = this.getRemovedAlbumSet();
    if (id && removedSet.has(id)) return true;

    if (title) {
      const titleKey = normalizeAlbumKey(title);
      if (removedSet.has(titleKey)) return true;
      if (removedSet.has(title.toLowerCase().trim())) return true;
      if (removedSet.has(`key:${titleKey}`)) return true;
    }
    return false;
  }

  /**
   * Lifts tombstones when content is reloaded, re-uploaded, or auditioned.
   */
  public unremoveTrack(id?: string, title?: string, artist?: string): void {
    if (!id && !title) return;
    const toRemove = new Set<string>();
    if (id) toRemove.add(id);
    if (title) {
      const titleKey = normalizeAlbumKey(title);
      toRemove.add(titleKey);
      toRemove.add(`title:${titleKey}`);
      if (artist) {
        const artistKey = normalizeAlbumKey(artist);
        toRemove.add(`key:${titleKey}:::${artistKey}`);
      }
    }
    this.removedTrackIds = this.removedTrackIds.filter((t) => !toRemove.has(t));
    this.persistRemoved();
  }

  private resetCloudBaselines() {
    this.trackChanges.reset(this.publishedTracks);
    this.albumChanges.reset(this.publishedAlbums);
    this.folderChanges.reset(this.crateFolders);
    this.crateChanges.reset(this.customCrates);
    this.removedChanges.reset(this.removedTombstones());
  }

  private ensureOfficialCrates() {
    if (this.customCrates.length === 0) {
      this.customCrates = OFFICIAL_CRATES.map((c) => ({ ...c }));
      return;
    }
    OFFICIAL_CRATES.forEach((canonical) => {
      if (!this.customCrates.some((c) => c.id === canonical.id)) {
        this.customCrates.push({ ...canonical });
      }
    });
  }

  /** Admins: queue every local change (new upload, edit, delete, restore) for the shared cloud catalog. */
  private pushLocalChanges() {
    if (this.applyingCloud || !CloudCatalogClient.isWriter()) return;

    const ops: CatalogOp[] = [];
    const collect = <T extends { id: string }>(
      collection: CatalogCollection,
      tracker: ChangeTracker<T>,
      items: T[]
    ) => {
      const { upserts, deletes } = tracker.diff(items);
      upserts.forEach((item) =>
        ops.push({ collection, op: 'set', id: item.id, data: item as unknown as Record<string, any> })
      );
      deletes.forEach((id) => ops.push({ collection, op: 'delete', id }));
    };

    collect('tracks', this.trackChanges, this.publishedTracks);
    collect('albums', this.albumChanges, this.publishedAlbums);
    collect('folders', this.folderChanges, this.crateFolders);
    collect('crates', this.crateChanges, this.customCrates);
    collect('removed', this.removedChanges, this.removedTombstones());

    if (ops.length > 0) CloudCatalogClient.enqueue(ops);
  }

  /** Forces an enqueue of all active catalog items (tracks, albums, folders, crates) to the shared cloud. */
  public forcePushAllToCloud(): void {
    if (!CloudCatalogClient.isWriter()) return;
    const ops: CatalogOp[] = [];
    const removedSet = new Set(this.removedTrackIds);
    this.publishedTracks
      .filter((t) => !removedSet.has(t.id))
      .forEach((track) => {
        ops.push({ collection: 'tracks', op: 'set', id: track.id, data: track as unknown as Record<string, any> });
      });
    this.publishedAlbums.forEach((alb) => {
      ops.push({ collection: 'albums', op: 'set', id: alb.id, data: alb as unknown as Record<string, any> });
    });
    this.crateFolders.forEach((folder) => {
      ops.push({ collection: 'folders', op: 'set', id: folder.id, data: folder as unknown as Record<string, any> });
    });
    this.customCrates.forEach((crate) => {
      ops.push({ collection: 'crates', op: 'set', id: crate.id, data: crate as unknown as Record<string, any> });
    });
    this.removedTombstones().forEach((tomb) => {
      ops.push({ collection: 'removed', op: 'set', id: tomb.id, data: tomb as unknown as Record<string, any> });
    });
    if (ops.length > 0) {
      CloudCatalogClient.enqueue(ops);
    }
  }

  /** Runs a local-cache write without echoing it back to the cloud. */
  private withoutCloudPush(fn: () => void) {
    const prev = this.applyingCloud;
    this.applyingCloud = true;
    try {
      fn();
    } finally {
      this.applyingCloud = prev;
    }
  }

  private applyCloudSnapshot(snap: CatalogSnapshot) {
    const writer = CloudCatalogClient.isWriter();
    const hasCloudData =
      snap.revision > 0 ||
      Object.values(snap.collections || {}).some((col) => Array.isArray(col) && col.length > 0);
    // Cloud has never been written: members keep the built-in defaults.
    if (!hasCloudData && !writer) return;

    this.applyingCloud = true;
    try {
      // Admins: make sure built-in canonical tracks participate in the merge as local items.
      if (writer) {
        this.reconcileMichaelJacksonTracks();
        this.reconcileAuthenticAudioStreams();
      }

      const c = snap.collections;
      const remoteTracksSanitized = ((c.tracks as unknown as Track[]) || []).map((t) => ({
        ...t,
        audioUrl: unescapeIndexedDbUrl(t.audioUrl),
        coverUrl: t.coverUrl ? unescapeIndexedDbUrl(t.coverUrl) : t.coverUrl,
      }));
      const tracks = mergeWithRemote<Track>({
        seenKey: 'music_tracks',
        local: this.publishedTracks,
        remote: remoteTracksSanitized,
        writer,
      });
      const albums = mergeWithRemote<Album>({
        seenKey: 'music_albums',
        local: this.publishedAlbums,
        remote: c.albums as unknown as Album[],
        writer,
      });
      const folders = mergeWithRemote<CrateFolder>({
        seenKey: 'music_folders',
        local: this.crateFolders,
        remote: c.folders as unknown as CrateFolder[],
        writer,
      });
      const crates = mergeWithRemote<CrateDefinition>({
        seenKey: 'music_crates',
        local: this.customCrates,
        remote: c.crates as unknown as CrateDefinition[],
        writer,
      });
      const remoteRemovedTrackIds = (c.removed as CatalogDoc[])
        .filter((r) => r.id.startsWith('track:'))
        .map((r) => r.id.slice('track:'.length));
      const remoteRemovedAlbumIds = (c.removed as CatalogDoc[])
        .filter((r) => r.id.startsWith('album:'))
        .map((r) => r.id.slice('album:'.length));

      this.removedTrackIds = Array.from(new Set([...remoteRemovedTrackIds]));
      this.removedAlbumIds = Array.from(new Set(remoteRemovedAlbumIds));
      const removedSet = new Set(this.removedTrackIds);
      const removedAlbumSet = new Set(this.removedAlbumIds);

      // A cloud tombstone always beats a stale local copy.
      this.publishedTracks = tracks.merged.filter((t) => !removedSet.has(t.id));
      this.publishedAlbums = albums.merged.filter((a) => !removedAlbumSet.has(a.id));
      this.crateFolders = folders.merged.filter((f) => !removedAlbumSet.has(f.id));
      this.sanitizeCrateFolders();
      this.customCrates = crates.merged;
      this.ensureOfficialCrates();

      if (writer) {
        this.withoutCloudPush(() => {
          this.restoreAndHealUserUploads();
        });
      } else {
        this.reconcileCanonicalPlatformTracks();
        this.reconcileAuthenticAudioStreams();
        if (this.crateFolders.length === 0) this.initDefaultFolders();
      }

      this.resetCloudBaselines();

      // Refresh the local cache (no echo back to the cloud).
      this.persistTracks();
      this.persistAlbums();
      this.persistFolders();
      this.persistCrates();
      this.persistRemoved();
      this.persistRemovedAlbums();

      if (writer) {
        const ops: CatalogOp[] = [];
        const pending = <T extends { id: string }>(collection: CatalogCollection, items: T[]) =>
          items.forEach((item) =>
            ops.push({ collection, op: 'set', id: item.id, data: item as unknown as Record<string, any> })
          );
        const remoteTrackMap = new Map(remoteTracksSanitized.map((t) => [t.id, t]));
        const toUploadIds = new Set(tracks.toUpload.map((t) => t.id));
        const needsExternalization = this.publishedTracks.filter((t) => {
          if (removedSet.has(t.id) || toUploadIds.has(t.id)) return false;
          const remoteCopy = remoteTrackMap.get(t.id);
          if (!remoteCopy) return true;
          return (
            needsCloudAudioExternalization(t.audioUrl) ||
            needsCloudAudioExternalization(remoteCopy.audioUrl) ||
            Boolean(t.coverUrl && t.coverUrl.startsWith('indexeddb://'))
          );
        });
        pending('tracks', [...tracks.toUpload.filter((t) => !removedSet.has(t.id)), ...needsExternalization]);
        pending('albums', albums.toUpload.filter((a) => !removedAlbumSet.has(a.id)));
        pending('folders', folders.toUpload.filter((f) => !removedAlbumSet.has(f.id)));
        pending('crates', crates.toUpload);
        this.applyingCloud = false;
        if (ops.length > 0) CloudCatalogClient.enqueue(ops);
      }
    } catch (err) {
      console.warn('[MusicCatalogService] Failed to apply cloud catalog:', err);
    } finally {
      this.applyingCloud = false;
    }

    this.notify();
  }

  /** Called after a track's local audio/artwork was uploaded: swap in durable cloud URLs. */
  private onTrackPrepared(prepared: CatalogDoc) {
    const t = this.publishedTracks.find((x) => x.id === prepared.id);
    if (t) {
      t.audioUrl = prepared.audioUrl;
      t.coverUrl = prepared.coverUrl;
      if (prepared.audioStatus) t.audioStatus = prepared.audioStatus as any;
      if (prepared.albumCoverUrl !== undefined) t.albumCoverUrl = prepared.albumCoverUrl;
      this.trackChanges.accept(t);
      this.withoutCloudPush(() => this.persistTracks());
    }
    // Also persist the durable Firebase Storage URL into upload batch items so restoreAndHealUserUploads
    // never reverts an externalized track back to an ephemeral URL.
    if (typeof window !== 'undefined' && prepared.audioUrl?.startsWith('https://')) {
      try {
        const batchesRaw = localStorage.getItem('spades_upload_batches_v2');
        const batches = batchesRaw ? JSON.parse(batchesRaw) : [];
        if (Array.isArray(batches)) {
          batches.forEach((b: any) => {
            if (!b?.id) return;
            const key = `spades_upload_items_v2_${b.id}`;
            const itemsRaw = localStorage.getItem(key);
            if (!itemsRaw) return;
            const items = JSON.parse(itemsRaw);
            if (!Array.isArray(items)) return;
            let changed = false;
            items.forEach((it: any) => {
              if (it.publishedTrackId === prepared.id || it.id === prepared.id) {
                it.storageUrl = prepared.audioUrl;
                it.previewAudioUrl = prepared.audioUrl;
                if (prepared.coverUrl && prepared.coverUrl.startsWith('https://')) {
                  it.coverUrl = prepared.coverUrl;
                }
                changed = true;
              }
            });
            if (changed) localStorage.setItem(key, JSON.stringify(items));
          });
        }
      } catch {
        /* ignore */
      }
    }
    this.notify();
  }

  private onArtworkPrepared(kind: 'albums' | 'folders', prepared: CatalogDoc) {
    const list: Array<{ id: string; coverUrl?: string }> =
      kind === 'albums' ? this.publishedAlbums : this.crateFolders;
    const item = list.find((x) => x.id === prepared.id);
    if (!item) return;
    item.coverUrl = prepared.coverUrl;
    if (kind === 'albums') {
      this.albumChanges.accept(item as Album);
      this.withoutCloudPush(() => this.persistAlbums());
    } else {
      this.folderChanges.accept(item as CrateFolder);
      this.withoutCloudPush(() => this.persistFolders());
    }
    this.notify();
  }

  private initStorageListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e) => {
      if (
        e.key === PUBLISHED_TRACKS_KEY ||
        e.key === CRATES_STORAGE_KEY ||
        e.key === REMOVED_TRACKS_KEY ||
        e.key === REMOVED_ALBUMS_KEY ||
        e.key === CRATE_FOLDERS_KEY ||
        e.key === PUBLISHED_ALBUMS_KEY ||
        e.key === 'spades_catalog_last_sync'
      ) {
        this.loadCatalog();
        this.notify();
      }
    });

    window.addEventListener('catalog-updated', () => {
      // Ignore our own notifications — memory already holds the freshest (cloud-merged) state.
      if (this.selfNotifying) return;
      this.loadCatalog();
    });
  }

  private loadCatalog() {
    try {
      const savedCrates = localStorage.getItem(CRATES_STORAGE_KEY);
      if (savedCrates) {
        const parsed = JSON.parse(savedCrates);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.customCrates = parsed;
        }
      }

      if (this.customCrates.length === 0) {
        this.customCrates = OFFICIAL_CRATES.map((c) => ({ ...c }));
      } else {
        // Ensure all official canonical crate IDs exist
        OFFICIAL_CRATES.forEach((canonical) => {
          if (!this.customCrates.some((c) => c.id === canonical.id)) {
            this.customCrates.push({ ...canonical });
          }
        });
      }

      const savedTracks = localStorage.getItem(PUBLISHED_TRACKS_KEY);
      if (savedTracks) {
        const parsed = JSON.parse(savedTracks);
        if (Array.isArray(parsed)) {
          const inMemoryMap = new Map(this.publishedTracks.map((t) => [t.id, t]));
          this.publishedTracks = parsed.map((loadedTrack: Track) => {
            const memTrack = inMemoryMap.get(loadedTrack.id);
            // Strictly preserve authentic original cover art from memory (prevent generic crate artwork from overwriting original)
            if (
              memTrack?.coverUrl &&
              !memTrack.coverUrl.includes('images.unsplash.com') &&
              (!loadedTrack.coverUrl || loadedTrack.coverUrl.includes('images.unsplash.com') || memTrack.coverUrl.length > (loadedTrack.coverUrl?.length || 0))
            ) {
              return { ...loadedTrack, coverUrl: memTrack.coverUrl };
            }
            return loadedTrack;
          });
        }
      }

      const savedFolders = localStorage.getItem(CRATE_FOLDERS_KEY);
      if (savedFolders) {
        const parsed = JSON.parse(savedFolders);
        if (Array.isArray(parsed)) {
          this.crateFolders = parsed;
        }
      }

      const savedAlbums = localStorage.getItem(PUBLISHED_ALBUMS_KEY);
      if (savedAlbums) {
        const parsed = JSON.parse(savedAlbums);
        if (Array.isArray(parsed)) {
          this.publishedAlbums = parsed;
        }
      }

      const savedRemoved = localStorage.getItem(REMOVED_TRACKS_KEY);
      if (savedRemoved) {
        const parsed = JSON.parse(savedRemoved);
        if (Array.isArray(parsed)) {
          this.removedTrackIds = parsed;
        }
      }

      const savedCustomCovers = localStorage.getItem(CUSTOM_COVERS_KEY);
      if (savedCustomCovers) {
        try {
          const parsed = JSON.parse(savedCustomCovers);
          if (parsed && typeof parsed === 'object') {
            const cleaned: Record<string, string> = {};
            Object.keys(parsed).forEach((k) => {
              // 1. Purge broad artist:* keys that bleed across multiple songs
              if (k.startsWith('artist:')) return;
              // 2. Purge un-scoped album keys that do not specify artist (lacking ':::')
              if (k.startsWith('album:') && !k.includes(':::')) return;
              // 3. Purge generic or virtual album keys
              if (k.startsWith('album:')) {
                const parts = k.replace(/^album:/, '').split(':::');
                if (parts[0] && isGenericOrVirtualAlbum(parts[0])) return;
              }
              cleaned[k] = parsed[k];
            });
            this.customCovers = { ...cleaned };
            localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(this.customCovers));
          }
        } catch { }
      }

      const savedRemovedAlbums = localStorage.getItem(REMOVED_ALBUMS_KEY);
      if (savedRemovedAlbums) {
        const parsed = JSON.parse(savedRemovedAlbums);
        if (Array.isArray(parsed)) {
          this.removedAlbumIds = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load local music catalog:', e);
    }

    // Auto-repair & link all canonical platform tracks to their authentic audio files and artwork
    // Wrapped in withoutCloudPush so startup reconciliation does not run redundant diff/stringify passes
    this.withoutCloudPush(() => {
      this.reconcileCanonicalPlatformTracks();
      this.reconcileAuthenticAudioStreams();
      this.restoreAndHealUserUploads();
      this.sanitizeCustomCoversRegistry();

      // Initialize default seed folders for each official crate if empty
      if (this.crateFolders.length === 0) {
        this.initDefaultFolders();
      }
      this.sanitizeCrateFolders();
    });

    // Hydrate any user-uploaded tracks that have authentic cover art backed up in IndexedDB after initial paint
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const candidates = this.publishedTracks.filter(
          (t) =>
            isMissingOrGenericCover(t.coverUrl) &&
            (Boolean((t as any).isUserUpload) || t.coverUrl?.startsWith('indexeddb://') || /^trk-pub-\d/.test(t.id))
        );
        if (candidates.length === 0) return;
        let hydrated = false;
        Promise.all(
          candidates.map(async (t) => {
            let dbCover = await AudioStorageService.getCoverArt(t.id);
            if (!dbCover && (t as any).fileName) {
              dbCover = await AudioStorageService.getCoverArt((t as any).fileName);
            }
            if (dbCover) {
              t.coverUrl = dbCover;
              hydrated = true;
            }
          })
        ).then(() => {
          if (hydrated) {
            this.invalidateCache();
            this.notify();
          }
        });
      }, 600);
    }
  }

  private persistCrates() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CRATES_STORAGE_KEY, JSON.stringify(this.customCrates));
    } catch (e) {
      console.warn('Failed to persist crates:', e);
    }
    this.pushLocalChanges();
  }

  /**
   * Reconciles all platform tracks so that uploaded files and catalog tracks
   * are seamlessly linked to their authentic high-fidelity MP3 audio streams
   * and original, verified cover artwork.
   */
  public reconcileCanonicalPlatformTracks() {
    const canonicalMap = new Map<string, Track>();
    PLATFORM_CANONICAL_TRACKS.forEach((t) => {
      canonicalMap.set(t.id, t);
    });

    let modified = false;

    // 1. Update and heal any existing published tracks matching IDs, filenames, titles, or artist/album
    this.publishedTracks = this.publishedTracks.map((existing) => {
      // Direct ID match from canonical platform tracks takes highest precedence.
      // CRITICAL: Never overwrite a track's own verified audioAsset or valid existing audioUrl!
      if (canonicalMap.has(existing.id)) {
        const canonical = canonicalMap.get(existing.id)!;
        const preserveExistingAudio = Boolean(
          existing.audioAsset ||
          (existing.audioUrl &&
            existing.audioUrl !== '/audio/Fort Apache.mp3' &&
            !isCrossArtistAudioMismatch({ artistName: existing.artistName, title: existing.title, audioUrl: existing.audioUrl }))
        );
        const nextAudio = preserveExistingAudio ? existing.audioUrl : canonical.audioUrl;
        const nextAlbumId = canonical.albumId || existing.albumId;
        if (
          existing.title !== canonical.title ||
          existing.artistName !== canonical.artistName ||
          existing.albumId !== nextAlbumId ||
          existing.albumTitle !== canonical.albumTitle ||
          existing.audioUrl !== nextAudio ||
          existing.coverUrl !== canonical.coverUrl ||
          existing.duration !== canonical.duration
        ) {
          modified = true;
          return {
            ...existing,
            title: canonical.title,
            artistName: canonical.artistName,
            albumId: nextAlbumId,
            albumTitle: canonical.albumTitle,
            audioUrl: nextAudio,
            coverUrl: canonical.coverUrl,
            duration: canonical.duration,
            bpm: existing.bpm || canonical.bpm,
            genre: existing.genre || canonical.genre,
            crateId: existing.crateId || canonical.crateId,
            crateName: existing.crateName || canonical.crateName,
          };
        }
        return existing;
      }

      // Check audioUrl file ending match against canonical (ONLY if BOTH artist AND title match!)
      const exAudio = (existing.audioUrl || '').split('/').pop()?.toLowerCase();
      if (exAudio) {
        const matchByAudio = PLATFORM_CANONICAL_TRACKS.find((m) => {
          const mAudio = (m.audioUrl || '').split('/').pop()?.toLowerCase();
          if (mAudio !== exAudio) return false;
          const mArtist = normalizeAlbumKey(m.artistName);
          const mTitle = normalizeAlbumKey(m.title);
          const eArtist = normalizeAlbumKey(existing.artistName);
          const eTitle = normalizeAlbumKey(existing.title);
          return mArtist === eArtist && mTitle === eTitle;
        });
        if (matchByAudio) {
          modified = true;
          return {
            ...existing,
            title: matchByAudio.title,
            artistName: matchByAudio.artistName,
            albumId: existing.albumId || matchByAudio.albumId,
            albumTitle: matchByAudio.albumTitle,
            crateId: existing.crateId || matchByAudio.crateId,
            crateName: existing.crateName || matchByAudio.crateName,
            audioUrl: existing.audioAsset ? existing.audioUrl : matchByAudio.audioUrl,
            coverUrl: matchByAudio.coverUrl,
            duration: matchByAudio.duration,
            bpm: existing.bpm || matchByAudio.bpm,
            genre: existing.genre || matchByAudio.genre,
          };
        }
      }

      // Check exact title AND artist match against canonical (never title-only or substring!)
      const exTitle = normalizeAlbumKey(existing.title);
      const exArtist = normalizeAlbumKey(existing.artistName);
      const match = PLATFORM_CANONICAL_TRACKS.find((m) => {
        const mTitle = normalizeAlbumKey(m.title);
        const mArtist = normalizeAlbumKey(m.artistName);
        return mTitle.length > 2 && mArtist.length > 1 && mTitle === exTitle && mArtist === exArtist;
      });

      if (match) {
        const preserveExistingAudio = Boolean(
          existing.audioAsset ||
          (existing.audioUrl &&
            existing.audioUrl !== '/audio/Fort Apache.mp3' &&
            !isCrossArtistAudioMismatch({ artistName: existing.artistName, title: existing.title, audioUrl: existing.audioUrl }))
        );
        modified = true;
        return {
          ...existing,
          title: match.title,
          artistName: match.artistName,
          albumId: existing.albumId || match.albumId,
          albumTitle: match.albumTitle,
          audioUrl: preserveExistingAudio ? existing.audioUrl : match.audioUrl,
          coverUrl: match.coverUrl,
          duration: match.duration,
          bpm: existing.bpm || match.bpm,
          genre: existing.genre || match.genre,
          crateId: existing.crateId || match.crateId,
          crateName: existing.crateName || match.crateName,
        };
      }

      // Autonomous Normalizer Healing: titles, artists, albums, audio, and covers
      const normTitle = normalizeTrackTitle(existing.title, existing.artistName, existing.albumTitle);
      const normArtist = normalizeArtistName(existing.artistName, normTitle);
      const normAlbum = normalizeAlbumTitle(existing.albumTitle, normArtist, normTitle);
      const safeAudio = existing.audioUrl || resolveSafeAudioUrl({ ...existing, title: normTitle, artistName: normArtist, albumTitle: normAlbum });
      const safeCover =
        (existing.coverUrl && !isMissingOrGenericCover(existing.coverUrl))
          ? existing.coverUrl
          : (correctedKnownCover({ ...existing, title: normTitle, artistName: normArtist, albumTitle: normAlbum }) ||
            getAuthenticCoverForTrack(normArtist, normAlbum, normTitle) ||
            existing.coverUrl);

      if (
        normTitle !== existing.title ||
        normArtist !== existing.artistName ||
        normAlbum !== existing.albumTitle ||
        (safeCover && safeCover !== existing.coverUrl && isMissingOrGenericCover(existing.coverUrl))
      ) {
        modified = true;
        return {
          ...existing,
          title: normTitle,
          artistName: normArtist,
          albumTitle: normAlbum,
          audioUrl: existing.audioUrl || safeAudio,
          coverUrl: safeCover || existing.coverUrl,
        };
      }

      return existing;
    });

    // 2. Ensure all canonical platform tracks exist in the published catalog without duplicating
    const existingIds = new Set(this.publishedTracks.map((t) => t.id));
    const existingKeys = new Set(this.publishedTracks.map((t) => `${normalizeAlbumKey(t.title)}:::${normalizeAlbumKey(t.artistName)}`));
    const removedSet = new Set(this.removedTrackIds);

    PLATFORM_CANONICAL_TRACKS.forEach((canonical) => {
      const canonKey = `${normalizeAlbumKey(canonical.title)}:::${normalizeAlbumKey(canonical.artistName)}`;
      if (
        !this.isTrackPermanentlyRemoved(canonical.id, canonical.title, canonical.artistName) &&
        !existingIds.has(canonical.id) &&
        !existingKeys.has(canonKey)
      ) {
        this.publishedTracks.unshift(canonical);
        existingIds.add(canonical.id);
        existingKeys.add(canonKey);
        modified = true;
      }
    });

    if (modified) {
      this.persistTracks();
    }
  }

  /** Backwards compatibility alias for external callers */
  public reconcileMichaelJacksonTracks() {
    this.reconcileCanonicalPlatformTracks();
  }

  /**
   * Reconciles canonical platform tracks so that missing or generic breakbeat audio URLs
   * are replaced with authentic, full-fidelity audio streams (MJ, Aaliyah, Alicia Keys, etc.).
   * NEVER overwrites user-uploaded tracks!
   */
  public reconcileAuthenticAudioStreams(): void {
    const canonicalIds = new Set(PLATFORM_CANONICAL_TRACKS.map((c) => c.id));
    let modified = false;
    this.publishedTracks = this.publishedTracks.map((t) => {
      // ONLY reconcile authentic studio audio streams for verified canonical platform tracks or cross-artist mismatches
      if (canonicalIds.has(t.id) || !t.audioUrl || t.audioUrl === '/audio/Fort Apache.mp3' || isCrossArtistAudioMismatch(t)) {
        const authentic = getAuthenticAudioUrl(t);
        if (authentic && t.audioUrl !== authentic && !isCrossArtistAudioMismatch({ ...t, audioUrl: authentic })) {
          modified = true;
          return {
            ...t,
            audioUrl: authentic,
          };
        }
      }
      return t;
    });

    if (modified) {
      this.persistTracks();
      if (CloudCatalogClient.isWriter()) {
        this.forcePushAllToCloud();
      }
    }
  }

  /**
   * Automatically restores all user-uploaded music and original cover art
   * (e.g. Avant, 112, Janet Jackson, Ashanti, Chris Brown, Brownstone),
   * repairing any hijacked audio streams, recovering removed upload tracks,
   * and retrieving original embedded artwork from upload batches & IndexedDB.
   */
  public restoreAndHealUserUploads(): void {
    if (typeof window === 'undefined') return;

    let modified = false;
    let removedChanged = false;
    const uploadItems: any[] = [];

    // 1. Gather all upload items from all batch storage keys
    try {
      const batchesRaw = localStorage.getItem('spades_upload_batches_v2');
      const batches = batchesRaw ? JSON.parse(batchesRaw) : [];
      if (Array.isArray(batches)) {
        batches.forEach((b: any) => {
          if (!b?.id) return;
          const itemsRaw = localStorage.getItem(`spades_upload_items_v2_${b.id}`);
          if (itemsRaw) {
            const items = JSON.parse(itemsRaw);
            if (Array.isArray(items)) {
              items.forEach((it: any) => uploadItems.push({ ...it, batchCrateId: b.crateId, batchFolderId: b.folderId }));
            }
          }
        });
      }
    } catch (e) {
      console.warn('[MusicCatalogService] Error reading upload batches:', e);
    }

    const stripAudioExt = (s?: string) => (s || '').replace(/\.(mp3|wav|m4a|flac|aac|ogg)$/i, '').trim();

    const uploadItemMap = new Map<string, any>();
    const activeTombstoneLiftSet = new Set<string>();
    const currentRemovedIds = new Set(this.removedTrackIds);

    uploadItems.forEach((it) => {
      if (it.title) it.title = stripAudioExt(it.title);
      if (it.publishedTrackId) uploadItemMap.set(it.publishedTrackId, it);
      if (it.id) uploadItemMap.set(it.id, it);
      const titleArtistKey = `${(it.title || '').toLowerCase().trim()}:::${(it.artist || '').toLowerCase().trim()}`;
      if (titleArtistKey.length > 5) uploadItemMap.set(titleArtistKey, it);

      // If this upload item is active (not deleted/rejected/skipped) and its own IDs were not deleted,
      // lift any stale title/composite tombstones from older deleted batches so it is never falsely hidden.
      if (
        it.uploadStatus !== 'deleted' &&
        it.uploadStatus !== 'rejected' &&
        it.uploadStatus !== 'skipped' &&
        (!it.id || !currentRemovedIds.has(it.id)) &&
        (!it.publishedTrackId || !currentRemovedIds.has(it.publishedTrackId))
      ) {
        const tKey = normalizeAlbumKey(it.title || '');
        const aKey = normalizeAlbumKey(it.artist || '');
        if (tKey) {
          activeTombstoneLiftSet.add(tKey);
          activeTombstoneLiftSet.add(`title:${tKey}`);
          if (aKey) activeTombstoneLiftSet.add(`key:${tKey}:::${aKey}`);
        }
      }
    });

    this.publishedTracks.forEach((t) => {
      if (!currentRemovedIds.has(t.id)) {
        const cleanTitle = stripAudioExt(t.title);
        const tKey = normalizeAlbumKey(cleanTitle);
        const aKey = normalizeAlbumKey(t.artistName || '');
        if (tKey) {
          activeTombstoneLiftSet.add(tKey);
          activeTombstoneLiftSet.add(`title:${tKey}`);
          if (aKey) activeTombstoneLiftSet.add(`key:${tKey}:::${aKey}`);
        }
      }
    });

    if (activeTombstoneLiftSet.size > 0) {
      const beforeLen = this.removedTrackIds.length;
      this.removedTrackIds = this.removedTrackIds.filter((id) => !activeTombstoneLiftSet.has(id));
      if (this.removedTrackIds.length !== beforeLen) {
        removedChanged = true;
      }
    }

    // 2. Repair hijacked or duplicated audio and covers on existing published tracks
    this.publishedTracks = this.publishedTracks.map((t) => {
      const cleanedTitle = stripAudioExt(t.title);
      const titleArtistKey = `${cleanedTitle.toLowerCase().trim()}:::${(t.artistName || '').toLowerCase().trim()}`;
      const matchedUpload =
        uploadItemMap.get(t.id) ||
        uploadItemMap.get(titleArtistKey) ||
        uploadItemMap.get(`${(t.title || '').toLowerCase().trim()}:::${(t.artistName || '').toLowerCase().trim()}`);

      let repairedAudio = unescapeIndexedDbUrl(t.audioUrl);
      let repairedCover = t.coverUrl ? unescapeIndexedDbUrl(t.coverUrl) : t.coverUrl;
      let trackModified =
        cleanedTitle !== t.title || repairedAudio !== (t.audioUrl || '') || repairedCover !== t.coverUrl;

      if ((repairedAudio.startsWith('indexeddb://') || needsCloudAudioExternalization(repairedAudio)) && matchedUpload) {
        const candidate = unescapeIndexedDbUrl(
          matchedUpload.storageUrl || matchedUpload.previewAudioUrl || matchedUpload.audioUrl || ''
        );
        if (candidate && candidate.startsWith('https://firebasestorage.googleapis.com/')) {
          repairedAudio = candidate;
          trackModified = true;
        } else if (!repairedAudio.startsWith('indexeddb://') && matchedUpload.id) {
          // Point unverified /audio/uploads/trk-pub-... back to its exact IndexedDB upload key so
          // PlayerContext and CloudCatalogClient can read the MP3 from IndexedDB and externalize it to Firebase Storage.
          repairedAudio = AudioStorageService.makeIndexedDBUrl(matchedUpload.id);
          trackModified = true;
        }
      }

      // Detect hijacked duplicate audio
      const lowerArtist = (t.artistName || '').toLowerCase();
      const lowerTitle = (t.title || '').toLowerCase();
      const audioEnding = (t.audioUrl || '').split('/').pop() || '';

      const isJanetJacksonHijacked =
        lowerArtist.includes('janet') &&
        !lowerTitle.includes("got 'til") &&
        !lowerTitle.includes('got til') &&
        audioEnding === 'Janet_Jackson_Got_Til_Its_Gone.mp3';

      const isAvantHijacked =
        lowerArtist.includes('avant') &&
        (audioEnding === 'Carl_Thomas_Summer_Rain.mp3' || audioEnding === 'Carl_Thomas_I_Wish.mp3' || audioEnding === 'Tevin_Campbell_Can_We_Talk.mp3');

      const is112Hijacked =
        lowerArtist.includes('112') &&
        (audioEnding === 'Blackstreet_Joy_12_Remix.mp3' || audioEnding === 'Carl_Thomas_I_Wish.mp3');

      const isAshantiHijacked =
        lowerArtist.includes('ashanti') &&
        (audioEnding === 'Aaliyah_At_Your_Best_Remix.mp3' || audioEnding === 'Amerie_Why_Dont_We_Fall_In_Love.mp3');

      const isChrisBrownHijacked =
        lowerArtist.includes('chris brown') &&
        (audioEnding === 'Bobby_Brown_Every_Little_Step.mp3' || audioEnding === 'Bobby_Brown_My_Prerogative.mp3');

      const isBrownstoneHijacked =
        lowerArtist.includes('brownstone') &&
        audioEnding === 'SWV_Right_Here_Human_Nature.mp3';

      const isLutherNeverTooMuchMissing =
        (lowerArtist.includes('luther') || lowerTitle.includes('never too much')) &&
        (t.audioUrl?.includes('TC148') || (t.audioUrl?.startsWith('/audio/uploads/') && !isVerifiedServerUpload(t.audioUrl)));

      const isMismatch = isCrossArtistAudioMismatch(t);

      if (isMismatch || isJanetJacksonHijacked || isAvantHijacked || is112Hijacked || isAshantiHijacked || isChrisBrownHijacked || isBrownstoneHijacked || isLutherNeverTooMuchMissing) {
        if (matchedUpload) {
          repairedAudio = unescapeIndexedDbUrl(
            matchedUpload.storageUrl || matchedUpload.previewAudioUrl || matchedUpload.audioUrl || AudioStorageService.makeIndexedDBUrl(matchedUpload.id || t.id)
          );
          trackModified = true;
        } else {
          const authentic = getAuthenticAudioUrl(t);
          if (authentic && !isCrossArtistAudioMismatch({ ...t, audioUrl: authentic })) {
            repairedAudio = authentic;
            trackModified = true;
          } else {
            // Flag for administrator review instead of guessing a filename or replacing with another song
            repairedAudio = AudioStorageService.makeIndexedDBUrl(t.id);
            trackModified = true;
          }
        }
      }

      // Detect hijacked, stripped, or cross-artist contaminated cover art
      const isCrossArtistContaminated =
        (!lowerArtist.includes('112') && (t.coverUrl?.includes('112_') || t.coverUrl?.includes('112_part_iii') || t.coverUrl?.includes('112_self_titled'))) ||
        (lowerArtist.includes('ashanti') && t.coverUrl?.includes('112')) ||
        ((lowerArtist.includes('50 cent') || lowerArtist.includes('50 cents')) && t.coverUrl?.includes('112')) ||
        (lowerArtist.includes('chris brown') && t.coverUrl?.includes('112')) ||
        (lowerArtist.includes('avant') && t.coverUrl?.includes('112'));

      const isCoverWrong =
        isCrossArtistContaminated ||
        (lowerArtist.includes('luther') && (t.coverUrl?.includes('rnb-neo-soul') || isMissingOrGenericCover(t.coverUrl))) ||
        (lowerArtist.includes('112') && (t.coverUrl?.includes('blackstreet') || t.coverUrl?.includes('rnb-neo-soul'))) ||
        (lowerArtist.includes('ashanti') && t.coverUrl?.includes('aaliyah_one_in_a_million')) ||
        (lowerArtist.includes('chris brown') && t.coverUrl?.includes('bobby_brown_dont_be_cruel')) ||
        (lowerArtist.includes('brownstone') && t.coverUrl?.includes('swv_its_about_time')) ||
        (lowerArtist.includes('avant') && t.coverUrl?.includes('rnb-neo-soul') && matchedUpload?.coverUrl) ||
        (t.coverUrl?.includes('chancetekone_banner.png') && !lowerArtist.includes('8 of spades') || lowerArtist.includes('chancetekone'));

      if (isCoverWrong || !t.coverUrl || isMissingOrGenericCover(t.coverUrl)) {
        let custom: string | undefined;
        if (!isCrossArtistContaminated) {
          custom = this.getCustomCover(t);
        }
        if (custom && !isMissingOrGenericCover(custom)) {
          repairedCover = custom;
          trackModified = true;
        } else if (matchedUpload?.coverUrl && !isMissingOrGenericCover(matchedUpload.coverUrl)) {
          repairedCover = matchedUpload.coverUrl;
          trackModified = true;
        } else {
          const authCover = getAuthenticCoverForTrack(t.artistName, t.albumTitle, t.title);
          if (authCover && authCover !== t.coverUrl) {
            repairedCover = authCover;
            trackModified = true;
          } else if (isCrossArtistContaminated || !t.coverUrl || isMissingOrGenericCover(t.coverUrl)) {
            repairedCover = getDefaultCoverForTrack(t);
            trackModified = true;
          }
        }
      }

      // Repair misassigned crateId for pure R&B / Soul tracks that inherited golden-era-hip-hop from older defaults
      let repairedCrateId = t.crateId;
      let repairedCrateName = t.crateName;
      const isRnBTrack =
        lowerArtist.includes('luther') ||
        lowerArtist.includes('janet') ||
        lowerArtist.includes('michael jackson') ||
        lowerArtist.includes('avant') ||
        lowerArtist.includes('112') ||
        lowerArtist.includes('ashanti') ||
        lowerArtist.includes('chris brown') ||
        lowerArtist.includes('brownstone') ||
        lowerArtist.includes('carl thomas') ||
        lowerArtist.includes('tevin campbell') ||
        lowerArtist.includes('alicia keys') ||
        lowerArtist.includes('sade') ||
        lowerArtist.includes('mary j') ||
        lowerArtist.includes('bobby brown') ||
        lowerArtist.includes('blackstreet') ||
        lowerArtist.includes('swv');

      if (isRnBTrack && repairedCrateId === 'golden-era-hip-hop') {
        repairedCrateId = 'oldschool-rnb-soul';
        repairedCrateName = 'Timeless R&B | Soul Music';
        trackModified = true;
      }

      // Repair generic, invalid, or misclassified genre
      let repairedGenre = t.genre;
      if (isGenericOrInvalidGenre(t.genre) || (isRnBTrack && t.genre?.toLowerCase().includes('hip hop'))) {
        repairedGenre = classifyGenre({
          artist: matchedUpload?.artist || t.artistName,
          title: stripAudioExt(matchedUpload?.title || cleanedTitle),
          album: matchedUpload?.album || t.albumTitle,
          rawGenre: matchedUpload?.genre || t.genre,
          crateId: repairedCrateId,
          crateName: repairedCrateName,
        });
        if (repairedGenre !== t.genre) {
          trackModified = true;
        }
      }

      if (trackModified) {
        modified = true;
        return {
          ...t,
          title: stripAudioExt(matchedUpload?.title || cleanedTitle),
          artistName: matchedUpload?.artist || t.artistName,
          albumTitle: matchedUpload?.album || t.albumTitle,
          audioUrl: repairedAudio,
          coverUrl: repairedCover,
          crateId: repairedCrateId,
          crateName: repairedCrateName,
          genre: repairedGenre,
        };
      }
      return t;
    });

    // 3. Filter publishedTracks: permanently purge any track that was removed by administrator
    this.publishedTracks = this.publishedTracks.filter((t) => !this.isTrackPermanentlyRemoved(t.id, t.title, t.artistName));

    // 4. Restore only active, non-deleted uploaded tracks that have NOT been tombstoned
    uploadItems.forEach((it) => {
      const targetId = it.publishedTrackId || it.id;
      if (this.isTrackPermanentlyRemoved(targetId, it.title, it.artist) || it.uploadStatus === 'deleted') {
        return; // Permanently removed: do NOT restore!
      }

      const titleArtistKey = `${stripAudioExt(it.title).toLowerCase()}:::${(it.artist || '').toLowerCase().trim()}`;
      const existsInPublished =
        this.publishedTracks.some((p) => p.id === targetId || p.id === it.id) ||
        this.publishedTracks.some(
          (p) => `${stripAudioExt(p.title).toLowerCase()}:::${(p.artistName || '').toLowerCase().trim()}` === titleArtistKey
        );

      if (
        !existsInPublished &&
        it.title &&
        it.artist &&
        it.uploadStatus !== 'skipped' &&
        it.uploadStatus !== 'rejected' &&
        it.uploadStatus !== 'deleted'
      ) {
        let validAudioUrl = unescapeIndexedDbUrl(
          it.storageUrl || it.previewAudioUrl || it.audioUrl || AudioStorageService.makeIndexedDBUrl(it.id)
        );
        if (
          needsCloudAudioExternalization(validAudioUrl) &&
          !validAudioUrl.startsWith('indexeddb://') &&
          it.id
        ) {
          validAudioUrl = AudioStorageService.makeIndexedDBUrl(it.id);
        }
        const lowItArtist = (it.artist || '').toLowerCase();
        const isItRnB =
          lowItArtist.includes('luther') ||
          lowItArtist.includes('janet') ||
          lowItArtist.includes('michael jackson') ||
          lowItArtist.includes('avant') ||
          lowItArtist.includes('112') ||
          lowItArtist.includes('ashanti') ||
          lowItArtist.includes('chris brown') ||
          lowItArtist.includes('brownstone') ||
          lowItArtist.includes('carl thomas') ||
          lowItArtist.includes('tevin campbell') ||
          lowItArtist.includes('alicia keys') ||
          lowItArtist.includes('sade') ||
          lowItArtist.includes('mary j') ||
          lowItArtist.includes('bobby brown') ||
          lowItArtist.includes('blackstreet') ||
          lowItArtist.includes('swv');

        let targetCrateId = it.crateId || it.batchCrateId || 'oldschool-rnb-soul';
        let targetCrateName = it.crateName || 'Timeless R&B | Soul Music';
        if (isItRnB && targetCrateId === 'golden-era-hip-hop') {
          targetCrateId = 'oldschool-rnb-soul';
          targetCrateName = 'Timeless R&B | Soul Music';
        }

        let targetGenre = it.genre;
        if (!targetGenre || isGenericOrInvalidGenre(targetGenre) || (isItRnB && targetGenre.toLowerCase().includes('hip hop'))) {
          targetGenre = classifyGenre({
            artist: it.artist,
            title: stripAudioExt(it.title),
            album: it.album,
            rawGenre: it.genre,
            crateId: targetCrateId,
            crateName: targetCrateName,
          });
        }

        const restoredTrack: Track = {
          id: targetId,
          title: stripAudioExt(it.title),
          artistId: 'artist-1',
          artistName: it.artist,
          label: 'ChanceTEK One',
          albumId: it.albumGroupId || it.folderId || 'album-vault',
          albumTitle: it.album || 'Collection',
          albumCoverUrl: it.albumCoverUrl,
          audioUrl: validAudioUrl,
          audioAsset: it.audioAsset,
          audioStatus: validAudioUrl.startsWith('https://firebasestorage.googleapis.com/')
            ? 'verified'
            : validAudioUrl.startsWith('indexeddb://')
              ? 'local_only'
              : 'legacy',
          coverUrl: it.coverUrl || AudioStorageService.makeIndexedDBUrl(`cover_${it.id}`),
          duration: it.durationSeconds || 240,
          genre: targetGenre,
          bpm: 96,
          releaseYear: it.year || 2026,
          crateId: targetCrateId,
          crateName: targetCrateName,
          playCount: 0,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
          featured: true,
          uploadedAt: new Date().toISOString(),
          uploadedByAdminName: it.uploadedBy || 'Admin',
          uploadBatchId: it.batchId,
        };
        this.publishedTracks.unshift(restoredTrack);
        modified = true;
      }
    });

    if (removedChanged) {
      this.persistRemoved();
    }

    if (modified) {
      this.persistTracks();
      this.notify();
    }
  }

  /**
   * Scans all published tracks and repairs any tracks with missing, generic,
   * or invalid placeholder genres (such as 'Direct Music Library', 'Discographys', 'Miscellaneous', 'Stems', etc.).
   */
  public healCatalogGenres(): { healedCount: number } {
    let healedCount = 0;
    this.publishedTracks.forEach((t) => {
      if (isGenericOrInvalidGenre(t.genre)) {
        const authentic = classifyGenre({
          artist: t.artistName,
          title: t.title,
          album: t.albumTitle,
          rawGenre: t.genre,
          crateId: t.crateId,
          crateName: t.crateName,
        });
        if (authentic !== t.genre) {
          t.genre = authentic;
          healedCount++;
        }
      }
    });

    if (healedCount > 0) {
      this.persistTracks();
      this.notify();
    }
    return { healedCount };
  }

  private initDefaultFolders() {
    // All crate collections/folders are permanently removed from all crates per user directive.
    // Crates display exclusively songs.
    this.crateFolders = [];
    this.persistFolders();
  }

  public sanitizeCrateFolders(): void {
    // All crate collections/folders are permanently removed from all crates per user directive.
    if (this.crateFolders.length > 0) {
      this.crateFolders = [];
      this.persistFolders();
      this.notify();
    }
  }

  private persistTracks() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;

    // Asynchronously back up inline (data:) covers to IndexedDB so they can never be lost.
    // Durable URLs (static paths / cloud https) need no local backup.
    this.publishedTracks.forEach((t) => {
      if (t.coverUrl && t.coverUrl.startsWith('data:')) {
        AudioStorageService.saveCoverArt(t.id, t.coverUrl).catch(() => { });
      }
    });

    try {
      const serialized = JSON.stringify(this.publishedTracks);
      if (serialized.length > 2000000) {
        throw new Error('Payload exceeds safe localStorage threshold, compressing pointers');
      }
      localStorage.setItem(PUBLISHED_TRACKS_KEY, serialized);
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      try {
        // Safe compact payload: offload heavy inline data: URLs (>15KB) to IndexedDB references
        const safePayload = this.publishedTracks.map((t) => {
          if (t.coverUrl && t.coverUrl.startsWith('data:') && t.coverUrl.length > 15000) {
            return { ...t, coverUrl: `indexeddb://cover_${t.id}` };
          }
          return t;
        });
        localStorage.setItem(PUBLISHED_TRACKS_KEY, JSON.stringify(safePayload));
        localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
      } catch (innerErr) {
        console.warn('Secondary localStorage write skipped; authentic covers remain intact in memory and IndexedDB:', innerErr);
      }
    }
    this.pushLocalChanges();
  }

  private persistRemoved() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REMOVED_TRACKS_KEY, JSON.stringify(this.removedTrackIds));
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save removed track IDs:', e);
    }
    this.pushLocalChanges();
  }

  private persistRemovedAlbums() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REMOVED_ALBUMS_KEY, JSON.stringify(this.removedAlbumIds));
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save removed album IDs:', e);
    }
    this.pushLocalChanges();
  }

  private persistFolders() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CRATE_FOLDERS_KEY, JSON.stringify(this.crateFolders));
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save crate folders:', e);
    }
    this.pushLocalChanges();
  }

  private persistAlbums() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PUBLISHED_ALBUMS_KEY, JSON.stringify(this.publishedAlbums));
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save published albums:', e);
    }
    this.pushLocalChanges();
  }

  /**
   * Automatically sanitizes and compresses bloated, uncompressed base64 cover art
   * (e.g. from camera uploads) down to lightweight ~35KB thumbnails to prevent iOS memory crashes.
   */
  public async sanitizeBloatedCustomCovers(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      let updated = false;
      const keys = Object.keys(this.customCovers);
      for (const k of keys) {
        const v = this.customCovers[k];
        if (typeof v === 'string' && v.startsWith('data:image') && v.length > 80000) {
          try {
            const opt = await optimizeCoverArtDataUrl(v, 500, 0.82);
            if (opt && opt.length < v.length) {
              this.customCovers[k] = opt;
              updated = true;
            }
          } catch { }
        }
      }

      this.publishedTracks.forEach((t) => {
        if (t.coverUrl && t.coverUrl.startsWith('data:image') && t.coverUrl.length > 80000) {
          const matchCustom = this.customCovers[t.id];
          if (matchCustom && matchCustom.length < t.coverUrl.length) {
            t.coverUrl = matchCustom;
            updated = true;
          }
        }
      });

      if (updated) {
        this.persistCustomCovers();
        this.persistTracks();
        this.notify();
      }
    } catch (e) {
      console.warn('[MusicCatalogService] sanitizeBloatedCustomCovers error:', e);
    }
  }

  /**
   * Sanitizes the custom covers registry, permanently purging broad artist keys,
   * un-scoped album keys, and generic/virtual album overrides (e.g. Singles & Vault Cuts).
   * Also repairs cross-artist cover contamination on published tracks.
   */
  public sanitizeCustomCoversRegistry(): void {
    if (typeof window === 'undefined') return;
    try {
      let customCoversModified = false;
      const keys = Object.keys(this.customCovers);
      for (const k of keys) {
        // 1. Purge broad artist:* keys
        if (k.startsWith('artist:')) {
          delete this.customCovers[k];
          customCoversModified = true;
          continue;
        }
        // 2. Purge un-scoped album keys that lack an artist delimiter ':::'
        if (k.startsWith('album:') && !k.includes(':::')) {
          delete this.customCovers[k];
          customCoversModified = true;
          continue;
        }
        // 3. Purge generic or virtual album overrides even if composite
        if (k.startsWith('album:')) {
          const parts = k.replace(/^album:/, '').split(':::');
          if (parts[0] && isGenericOrVirtualAlbum(parts[0])) {
            delete this.customCovers[k];
            customCoversModified = true;
            continue;
          }
        }
        // 4. Purge generic albumId overrides like 'album-vault', 'direct-music-library', etc.
        if (isGenericOrVirtualAlbum(k)) {
          delete this.customCovers[k];
          customCoversModified = true;
          continue;
        }
      }

      if (customCoversModified) {
        localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(this.customCovers));
      }

      // Build a map of covers to artists to detect cross-artist contamination
      const coverArtistMap = new Map<string, Set<string>>();
      this.publishedTracks.forEach((t) => {
        const cover = t.coverUrl;
        const art = String(t.artistName || '').trim().toLowerCase();
        if (cover && art && !isMissingOrGenericCover(cover)) {
          if (!coverArtistMap.has(cover)) {
            coverArtistMap.set(cover, new Set());
          }
          coverArtistMap.get(cover)!.add(art);
        }
      });

      // Repair cross-artist cover contamination on published tracks
      let tracksModified = false;
      this.publishedTracks.forEach((t) => {
        const lowerArt = String(t.artistName || '').toLowerCase().trim();
        const lowerCover = String(t.coverUrl || '').toLowerCase();
        const isVirtual = isGenericOrVirtualAlbum(t.albumTitle) || isGenericOrVirtualAlbum(t.albumId);

        // Check if this cover is shared across distinct artists
        const artistsWithCover = t.coverUrl ? coverArtistMap.get(t.coverUrl) : null;
        const isSharedWithOtherArtists = Boolean(artistsWithCover && artistsWithCover.size > 1);

        const is112Contaminated = !lowerArt.includes('112') && (lowerCover.includes('112_') || lowerCover.includes('112_part_iii') || lowerCover.includes('112_self_titled'));
        const isAshantiContaminated = lowerArt.includes('ashanti') && (lowerCover.includes('112') || lowerCover.includes('aaliyah'));
        const is50CentContaminated = (lowerArt.includes('50 cent') || lowerArt.includes('50 cents')) && lowerCover.includes('112');
        const isChrisBrownContaminated = lowerArt.includes('chris brown') && lowerCover.includes('112');
        const isAvantContaminated = lowerArt.includes('avant') && lowerCover.includes('112');
        const isJacksonsContaminated = !lowerArt.includes('jacksons') && !lowerArt.includes('jackson') && (lowerCover.includes('jacksons') || lowerCover.includes('the_jacksons'));

        if (
          is112Contaminated ||
          isAshantiContaminated ||
          is50CentContaminated ||
          isChrisBrownContaminated ||
          isAvantContaminated ||
          isJacksonsContaminated ||
          (isVirtual && isSharedWithOtherArtists && !lowerCover.includes(lowerArt.replace(/[^a-z0-9]/g, '')))
        ) {
          delete this.customCovers[t.id];
          const tKey = normalizeAlbumKey(t.title);
          const aKey = normalizeAlbumKey(t.artistName);
          if (tKey && aKey) {
            delete this.customCovers[`track:${tKey}:::${aKey}`];
          }
          t.coverUrl = this.getAuthenticOriginalCover(t);
          delete (t as any).customCover;
          tracksModified = true;
        }
      });

      if (tracksModified) {
        this.persistTracks();
      }

      if (customCoversModified || tracksModified) {
        this.catalogVersion++;
        this.cachedAllTracks = null;
        this.cachedAllAlbums = null;
        this.cachedOfficialCrates = null;
        this.notify();
      }
    } catch (err) {
      console.warn('[MusicCatalogService] sanitizeCustomCoversRegistry error:', err);
    }
  }

  private persistCustomCovers() {
    this.invalidateCache();
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CUSTOM_COVERS_KEY, JSON.stringify(this.customCovers));
      localStorage.setItem('spades_catalog_last_sync', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save custom covers:', e);
    }
    this.pushLocalChanges();
  }

  public getCustomCover(entity?: {
    id?: string;
    title?: string;
    artistName?: string;
    albumTitle?: string;
    coverUrl?: string;
  }): string | undefined {
    if (!entity) return undefined;

    // Direct check if entity already has an explicit customCover flag and valid cover
    if ((entity as any).customCover && entity.coverUrl && !isMissingOrGenericCover(entity.coverUrl)) {
      return entity.coverUrl;
    }

    if (entity.id && this.customCovers[entity.id] && !isMissingOrGenericCover(this.customCovers[entity.id])) {
      return this.customCovers[entity.id];
    }

    const tKey = normalizeAlbumKey(entity.title);
    const aKey = normalizeAlbumKey(entity.artistName);
    const alKey = entity.albumTitle ? normalizeAlbumKey(entity.albumTitle) : '';

    if (tKey && aKey) {
      const trackKey = `track:${tKey}:::${aKey}`;
      if (this.customCovers[trackKey] && !isMissingOrGenericCover(this.customCovers[trackKey])) {
        return this.customCovers[trackKey];
      }
    }

    // Album + Artist composite override (ONLY for real studio albums with both album title and artist, NEVER virtual collections)
    if (alKey && aKey && !isGenericOrVirtualAlbum(entity.albumTitle)) {
      const albumArtistKey = `album:${alKey}:::${aKey}`;
      if (this.customCovers[albumArtistKey] && !isMissingOrGenericCover(this.customCovers[albumArtistKey])) {
        return this.customCovers[albumArtistKey];
      }
    }

    // Explicitly NEVER check broad album:* or artist:* keys without both album and artist
    return undefined;
  }

  public resolveTrackCover(track: {
    id?: string;
    title?: string;
    artistName?: string;
    albumTitle?: string;
    coverUrl?: string;
    genre?: string;
    crateId?: string;
  }): string {
    // 1. Explicit custom cover set by admin or user in registry
    const custom = this.getCustomCover(track);
    if (custom && !isMissingOrGenericCover(custom)) {
      return custom;
    }

    // 2. Direct coverUrl on track if present, valid, and not generic
    const direct = track.coverUrl;
    if (direct && !isMissingOrGenericCover(direct)) {
      return direct;
    }

    // 3. Authentic known studio cover art fallback
    const normTitle = normalizeTrackTitle(track.title || '', track.artistName, track.albumTitle);
    const normArtist = normalizeArtistName(track.artistName, normTitle);
    const normAlbum = normalizeAlbumTitle(track.albumTitle, normArtist, normTitle);
    const authentic = getAuthenticCoverForTrack(normArtist, normAlbum, normTitle);
    if (authentic && !isMissingOrGenericCover(authentic)) {
      return authentic;
    }

    // 4. Crate or genre default
    return getDefaultCoverForTrack(track);
  }

  public resolveAlbumCover(album: {
    id?: string;
    title?: string;
    artistName?: string;
    coverUrl?: string;
    genre?: string;
  }): string {
    // 1. Explicit custom cover set by admin
    const custom = this.getCustomCover(album);
    if (custom && !isMissingOrGenericCover(custom)) {
      return custom;
    }

    // 2. Direct coverUrl on album if present, valid, and not generic
    const direct = album.coverUrl;
    if (direct && !isMissingOrGenericCover(direct)) {
      return direct;
    }

    // 3. Authentic known album cover
    const authentic = getAuthenticCoverForTrack(album.artistName, album.title, '');
    if (authentic && !isMissingOrGenericCover(authentic)) {
      return authentic;
    }

    return '/images/genres/rnb-neo-soul.jpg';
  }

  /**
   * Checks whether a track or album entity has an explicit custom cover set
   */
  public hasCustomCover(entity?: {
    id?: string;
    title?: string;
    artistName?: string;
    albumTitle?: string;
  }): boolean {
    if (!entity) return false;
    if (entity.id && this.customCovers[entity.id]) return true;

    const tKey = normalizeAlbumKey(entity.title);
    const aKey = normalizeAlbumKey(entity.artistName);
    const alKey = normalizeAlbumKey(entity.albumTitle);

    if (tKey && aKey && this.customCovers[`track:${tKey}:::${aKey}`]) return true;
    if (alKey && aKey && !isGenericOrVirtualAlbum(alKey) && this.customCovers[`album:${alKey}:::${aKey}`]) return true;

    return false;
  }

  /**
   * Checks whether a specific album of an artist has a custom cover set
   */
  public hasAlbumCustomCover(albumTitle?: string, artistName?: string): boolean {
    if (!albumTitle || !artistName || isGenericOrVirtualAlbum(albumTitle)) return false;
    const alKey = normalizeAlbumKey(albumTitle);
    const aKey = normalizeAlbumKey(artistName);
    return Boolean(this.customCovers[`album:${alKey}:::${aKey}`]);
  }

  /**
   * Resolves the authentic original cover for a track without consulting custom covers
   */
  public getAuthenticOriginalCover(track: {
    id?: string;
    title?: string;
    artistName?: string;
    albumTitle?: string;
    genre?: string;
    crateId?: string;
    coverUrl?: string;
  }): string {
    const normTitle = normalizeTrackTitle(track.title || '', track.artistName, track.albumTitle);
    const normArtist = normalizeArtistName(track.artistName, normTitle);
    const normAlbum = normalizeAlbumTitle(track.albumTitle, normArtist, normTitle);

    // 1. Check authentic known album/track registry
    const authentic = getAuthenticCoverForTrack(normArtist, normAlbum, normTitle);
    if (authentic && !isMissingOrGenericCover(authentic)) {
      return authentic;
    }

    // 2. Check canonical platform tracks or mock tracks original cover
    const tKey = normalizeAlbumKey(normTitle);
    const aKey = normalizeAlbumKey(normArtist);
    const canon = PLATFORM_CANONICAL_TRACKS.find(
      (c) => c.id === track.id || (tKey && aKey && normalizeAlbumKey(c.title) === tKey && normalizeAlbumKey(c.artistName) === aKey)
    );
    if (canon?.coverUrl && !isMissingOrGenericCover(canon.coverUrl) && !canon.coverUrl.startsWith('data:image')) {
      return canon.coverUrl;
    }

    const mock = MOCK_TRACKS.find(
      (m) => m.id === track.id || (tKey && aKey && normalizeAlbumKey(m.title) === tKey && normalizeAlbumKey(m.artistName) === aKey)
    );
    if (mock?.coverUrl && !isMissingOrGenericCover(mock.coverUrl) && !mock.coverUrl.startsWith('data:image')) {
      return mock.coverUrl;
    }

    // 3. Fall back to genre/crate default
    return getDefaultCoverForTrack({
      genre: track.genre,
      crateId: track.crateId,
      title: normTitle,
      artistName: normArtist,
    });
  }

  /**
   * Reverts a track's cover back to its authentic original artwork, removing any custom cover override
   */
  public revertTrackCover(trackId: string, adminActor?: { id?: string; name?: string }): boolean {
    const track = this.getAllTracks().find((t) => t.id === trackId);
    if (!track) return false;

    const tKey = normalizeAlbumKey(track.title);
    const aKey = normalizeAlbumKey(track.artistName);

    // 1. Remove custom cover entries
    delete this.customCovers[trackId];
    if (tKey && aKey) {
      delete this.customCovers[`track:${tKey}:::${aKey}`];
    }
    this.persistCustomCovers();

    // 2. Resolve authentic original cover
    const originalCover = this.getAuthenticOriginalCover(track);

    // 3. Reset track
    const pub = this.publishedTracks.find((t) => t.id === trackId);
    if (pub) {
      pub.coverUrl = originalCover;
      delete (pub as any).customCover;
    }

    const mockMatch = MOCK_TRACKS.find(
      (m) => m.id === trackId || (tKey && aKey && normalizeAlbumKey(m.title) === tKey && normalizeAlbumKey(m.artistName) === aKey)
    );
    if (mockMatch) {
      mockMatch.coverUrl = originalCover;
      delete (mockMatch as any).customCover;
    }

    const canonMatch = PLATFORM_CANONICAL_TRACKS.find(
      (c) => c.id === trackId || (tKey && aKey && normalizeAlbumKey(c.title) === tKey && normalizeAlbumKey(c.artistName) === aKey)
    );
    if (canonMatch) {
      canonMatch.coverUrl = originalCover;
      delete (canonMatch as any).customCover;
    }

    this.syncUploadBatchCover(trackId, originalCover);
    this.persistTracks();
    this.catalogVersion++;
    this.cachedAllTracks = null;
    this.cachedOfficialCrates = null;
    this.notify();
    return true;
  }

  /**
   * Reverts an album's cover back to authentic original artwork for that specific artist and album
   */
  public revertAlbumCover(albumTitle: string, artistName: string, adminActor?: { id?: string; name?: string }): boolean {
    const targetNorm = normalizeAlbumKey(albumTitle);
    const artistNorm = normalizeAlbumKey(artistName);
    if (!targetNorm || !artistNorm || isGenericOrVirtualAlbum(albumTitle)) return false;

    // 1. Remove album custom cover keys
    delete this.customCovers[`album:${targetNorm}:::${artistNorm}`];
    delete this.customCovers[`album:${targetNorm}`];
    this.persistCustomCovers();

    // 2. Revert matching tracks
    const all = this.getAllTracks();
    const matching = all.filter((t) => {
      const tAlbNorm = normalizeAlbumKey(t.albumTitle);
      const tArtNorm = normalizeAlbumKey(t.artistName);
      return tAlbNorm === targetNorm && tArtNorm === artistNorm;
    });

    matching.forEach((t) => {
      const orig = this.getAuthenticOriginalCover(t);
      delete this.customCovers[t.id];
      const tKey = normalizeAlbumKey(t.title);
      if (tKey && artistNorm) {
        delete this.customCovers[`track:${tKey}:::${artistNorm}`];
      }
      const pub = this.publishedTracks.find((p) => p.id === t.id);
      if (pub) {
        pub.coverUrl = orig;
        delete (pub as any).customCover;
      }
    });

    // 3. Revert published album cover
    this.publishedAlbums.forEach((a) => {
      const aTitleNorm = normalizeAlbumKey(a.title);
      const aArtNorm = normalizeAlbumKey(a.artistName);
      if (aTitleNorm === targetNorm && aArtNorm === artistNorm) {
        a.coverUrl = getAuthenticCoverForTrack(artistName, albumTitle, '') || '/images/genres/rnb-neo-soul.jpg';
      }
    });

    this.persistAlbums();
    this.persistTracks();
    this.catalogVersion++;
    this.cachedAllTracks = null;
    this.cachedAllAlbums = null;
    this.notify();
    return true;
  }

  private syncUploadBatchCover(trackId: string, newCoverUrl: string): void {
    if (typeof window === 'undefined') return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('spades_upload_items_v2_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const items = JSON.parse(raw);
            if (Array.isArray(items)) {
              let updated = false;
              items.forEach((item: any) => {
                if (item.id === trackId || item.publishedTrackId === trackId) {
                  item.coverUrl = newCoverUrl;
                  updated = true;
                }
              });
              if (updated) {
                localStorage.setItem(key, JSON.stringify(items));
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[MusicCatalogService] syncUploadBatchCover error:', e);
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.invalidateCache();
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Catalog listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      this.selfNotifying = true;
      try {
        window.dispatchEvent(new CustomEvent('catalog-updated'));
      } finally {
        this.selfNotifying = false;
      }
    }
  }

  public getOfficialCrates(): CrateDefinition[] {
    if (this.cachedOfficialCrates && this.cachedOfficialCrates.version === this.catalogVersion) {
      return this.cachedOfficialCrates.crates;
    }
    const crates = this.customCrates.map((crate) => {
      const crateTracks = this.getTracksByCrate(crate.id);
      const folders = this.getFoldersByCrate(crate.id);
      return {
        ...crate,
        totalTracks: crateTracks.length > 0 ? crateTracks.length : crate.totalTracks,
        totalFolders: folders.length,
      };
    });
    this.cachedOfficialCrates = { version: this.catalogVersion, crates };
    return crates;
  }

  public getCrateBySlug(slug: string): CrateDefinition | undefined {
    if (slug === 'direct-music-library') return DIRECT_MUSIC_CRATE;
    return this.customCrates.find(
      (c) => c.slug === slug || c.id === slug || c.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === slug
    );
  }

  public getCrateById(crateId: string): CrateDefinition | undefined {
    if (crateId === 'direct-music-library') return DIRECT_MUSIC_CRATE;
    return this.customCrates.find(
      (c) => c.id === crateId || c.slug === crateId || c.name.toLowerCase().trim() === crateId.toLowerCase().trim()
    );
  }

  public updateCrate(
    crateId: string,
    updates: Partial<CrateDefinition>,
    actor?: { id?: string; name?: string }
  ): CrateDefinition | undefined {
    const crate = this.customCrates.find((c) => c.id === crateId || c.slug === crateId);
    if (!crate) return undefined;

    const oldName = crate.name;
    Object.assign(crate, updates);

    // Sync crateName on published tracks if name changed
    if (updates.name && updates.name !== oldName) {
      this.publishedTracks.forEach((t) => {
        if (t.crateId === crate.id) {
          t.crateName = updates.name;
        }
      });
      this.persistTracks();
    }

    this.persistCrates();
    this.notify();

    AuditLogger.logAction({
      adminId: actor?.id || 'usr-admin',
      adminName: actor?.name || 'Administrator',
      adminRole: 'admin',
      eventType: 'CRATE_UPDATED',
      action: `Admin updated crate "${oldName}" ${updates.name && updates.name !== oldName ? `(renamed to "${updates.name}")` : ''}`,
      resource: 'Crate System',
      resourceId: crate.id,
      newValue: updates,
      status: 'SUCCESS',
    });

    return crate;
  }

  public getAuthenticCoverForTrack(artist?: string, album?: string, title?: string): string | undefined {
    return getAuthenticCoverForTrack(artist, album, title);
  }

  /**
   * Deterministic SSR baseline tracks (independent of localStorage) so initial client hydration
   * matches server-rendered HTML 100% before useEffect syncs localStorage / cloud tracks.
   */
  public getSSRBaselineTracks(): Track[] {
    const canonicalIds = new Set(PLATFORM_CANONICAL_TRACKS.map((c) => c.id));
    const canonicalKeys = new Set(
      PLATFORM_CANONICAL_TRACKS.map((c) => `${normalizeAlbumKey(c.title)}:::${normalizeAlbumKey(c.artistName)}`)
    );
    const baseRemaining = MOCK_TRACKS.filter(
      (t) =>
        !canonicalIds.has(t.id) &&
        !canonicalKeys.has(`${normalizeAlbumKey(t.title)}:::${normalizeAlbumKey(t.artistName)}`)
    );
    return [...PLATFORM_CANONICAL_TRACKS, ...baseRemaining];
  }

  public getSSRBaselineCrates(): CrateDefinition[] {
    return OFFICIAL_CRATES.map((c) => ({ ...c }));
  }

  public getAllTracks(): Track[] {
    if (this.cachedAllTracks && this.cachedAllTracks.version === this.catalogVersion) {
      return this.cachedAllTracks.tracks;
    }
    const activePublished = this.publishedTracks.filter((t) => !this.isTrackPermanentlyRemoved(t.id, t.title, t.artistName));
    const publishedKeys = new Set(activePublished.map((p) => `${normalizeAlbumKey(p.title)}:::${normalizeAlbumKey(p.artistName)}`));
    const publishedIds = new Set(activePublished.map((p) => p.id));

    // Ensure canonical platform tracks are only included if NOT permanently deleted
    const canonicalRemaining = PLATFORM_CANONICAL_TRACKS.filter(
      (c) =>
        !publishedIds.has(c.id) &&
        !this.isTrackPermanentlyRemoved(c.id, c.title, c.artistName) &&
        !publishedKeys.has(`${normalizeAlbumKey(c.title)}:::${normalizeAlbumKey(c.artistName)}`)
    );
    const canonicalKeys = new Set(
      canonicalRemaining.map((c) => `${normalizeAlbumKey(c.title)}:::${normalizeAlbumKey(c.artistName)}`)
    );

    const baseRemaining = MOCK_TRACKS.filter(
      (t) =>
        !publishedIds.has(t.id) &&
        !this.isTrackPermanentlyRemoved(t.id, t.title, t.artistName) &&
        !publishedKeys.has(`${normalizeAlbumKey(t.title)}:::${normalizeAlbumKey(t.artistName)}`) &&
        !canonicalKeys.has(`${normalizeAlbumKey(t.title)}:::${normalizeAlbumKey(t.artistName)}`)
    );

    const combined = [...activePublished, ...canonicalRemaining, ...baseRemaining];

    // Each track is healed with full artist name, full album title, clean title,
    // playable URI-safe audio stream, authentic original cover artwork, and verified genre.
    const tracks = combined.map((t) => {
      const normTitle = normalizeTrackTitle(t.title, t.artistName, t.albumTitle);
      const normArtist = normalizeArtistName(t.artistName, normTitle);
      const normAlbum = normalizeAlbumTitle(t.albumTitle, normArtist, normTitle);
      const safeAudio = resolveSafeAudioUrl({ ...t, title: normTitle, artistName: normArtist, albumTitle: normAlbum });
      const safeCover = this.resolveTrackCover({
        ...t,
        title: normTitle,
        artistName: normArtist,
        albumTitle: normAlbum,
      });

      const lowArtist = normArtist.toLowerCase();
      const isRnB =
        lowArtist.includes('luther') ||
        lowArtist.includes('janet') ||
        lowArtist.includes('michael jackson') ||
        lowArtist.includes('avant') ||
        lowArtist.includes('112') ||
        lowArtist.includes('ashanti') ||
        lowArtist.includes('chris brown') ||
        lowArtist.includes('brownstone') ||
        lowArtist.includes('carl thomas') ||
        lowArtist.includes('tevin campbell') ||
        lowArtist.includes('alicia keys') ||
        lowArtist.includes('sade') ||
        lowArtist.includes('mary j') ||
        lowArtist.includes('bobby brown') ||
        lowArtist.includes('blackstreet') ||
        lowArtist.includes('swv');

      let resolvedCrateId = t.crateId;
      let resolvedCrateName = t.crateName;
      if (!(t as any).customCrate && isRnB && resolvedCrateId === 'golden-era-hip-hop') {
        resolvedCrateId = 'oldschool-rnb-soul';
        resolvedCrateName = 'Timeless R&B | Soul Music';
      }

      let resolvedGenre = t.genre;
      const normalizedGenre = classifyGenre({
        artist: normArtist,
        title: normTitle,
        album: normAlbum,
        rawGenre: t.genre,
        crateId: resolvedCrateId,
      });

      if (
        !resolvedGenre ||
        isGenericOrInvalidGenre(resolvedGenre) ||
        (isRnB && resolvedGenre.toLowerCase().includes('hip hop')) ||
        (resolvedGenre === 'R&B / Neo-Soul' && normalizedGenre !== 'R&B / Neo-Soul' && !isRnB) ||
        (resolvedGenre.toLowerCase().includes('hip hop') && normalizedGenre === 'Latin-Freestyle')
      ) {
        resolvedGenre = normalizedGenre;
      }

      return {
        ...t,
        title: normTitle,
        artistName: normArtist,
        albumTitle: normAlbum,
        audioUrl: safeAudio,
        coverUrl: safeCover,
        crateId: resolvedCrateId,
        crateName: resolvedCrateName,
        genre: resolvedGenre,
        likeCount: EngagementMetricsService.getLikeCount(t.id),
      };
    });
    this.cachedAllTracks = { version: this.catalogVersion, tracks };
    return tracks;
  }

  public getTrackById(id: string): Track | undefined {
    return this.getAllTracks().find((t) => t.id === id);
  }

  public getTracksByCrate(crateIdOrName: string): Track[] {
    const target = crateIdOrName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const all = this.getAllTracks();

    return all.filter((t) => {
      // 1. If querying direct music library
      if (target.includes('directmusic') || target.includes('generalmusic')) {
        return t.crateId === 'direct-music-library' || !t.crateId;
      }

      // If track was explicitly placed in direct-music-library, do not allow fallthrough to specific crate heuristics
      if (t.crateId === 'direct-music-library' && (t as any).customCrate) {
        return false;
      }

      // 2. Direct explicit crateId match takes absolute precedence for specific crates
      if (t.crateId && t.crateId !== 'direct-music-library') {
        if (t.crateId === crateIdOrName) return true;
        if (t.crateId.toLowerCase().replace(/[^a-z0-9]/g, '') === target) return true;
        if (t.crateName && (t.crateName === crateIdOrName || t.crateName.toLowerCase().replace(/[^a-z0-9]/g, '') === target)) return true;
        const matchingCrate = this.getCrateById(t.crateId) || this.getCrateBySlug(t.crateId);
        if (matchingCrate) {
          if (matchingCrate.id === crateIdOrName || matchingCrate.slug === crateIdOrName || matchingCrate.name === crateIdOrName) return true;
          if (matchingCrate.id.toLowerCase().replace(/[^a-z0-9]/g, '') === target) return true;
          if (matchingCrate.slug.toLowerCase().replace(/[^a-z0-9]/g, '') === target) return true;
          if (matchingCrate.name.toLowerCase().replace(/[^a-z0-9]/g, '') === target) return true;
        }
        // If track has an assigned specific crateId and it did NOT match the requested crate,
        // it belongs to that other crate. Do NOT allow fallthrough to heuristics!
        return false;
      }

      // 3. Mock, legacy, and general library track matching by genre / album / artist
      const genre = (t.genre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const album = (t.albumTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const artist = (t.artistName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (genre.includes(target) || target.includes(genre)) return true;
      if (album.includes(target) || target.includes(album)) return true;

      // Special crate matching rules for unassigned seed tracks & general library uploads
      if (target.includes('slowjam') && (
        genre.includes('slow') || genre.includes('ballad') || genre.includes('quietstorm') ||
        artist.includes('aaliyah') || artist.includes('alicia') ||
        genre.includes('rnb') || genre.includes('soul')
      )) return true;

      if (target.includes('disco') && (
        genre.includes('disco') || genre.includes('dance') || genre.includes('funk') ||
        artist.includes('michaeljackson') || album.includes('offthewall')
      )) return true;

      if ((target.includes('oldschool') || target.includes('timeless') || target.includes('soul') || target.includes('rnb')) && (
        genre.includes('soul') || genre.includes('rnb') || genre.includes('motown') || genre.includes('timeless') || genre.includes('oldschool') ||
        artist.includes('aaliyah') || artist.includes('alicia') || artist.includes('michaeljackson')
      )) return true;

      if (target.includes('goldenera') && (
        genre.includes('hiphop') || genre.includes('boombap') || genre.includes('12bit') ||
        album.includes('thriller') || (artist.includes('michaeljackson') && album.includes('thriller'))
      )) return true;

      if (target.includes('breakbeat') && (genre.includes('break') || genre.includes('sample'))) return true;
      if (target.includes('discography') && (genre.includes('discog') || genre.includes('archive') || genre.includes('anthology'))) return true;
      if (target.includes('stem') && (genre.includes('stem') || genre.includes('multitrack'))) return true;
      if (target.includes('misc') || target.includes('miscellaneous')) return true;

      return false;
    });
  }

  /**
   * Moves a track from one crate to another crate (or to Direct Music Library).
   * Takes effect immediately and updates audit logs.
   */
  public moveTrackToCrate(
    trackId: string,
    targetCrateId: string,
    actor?: { id?: string; name?: string }
  ): boolean {
    const targetCrate = this.getCrateById(targetCrateId) || DIRECT_MUSIC_CRATE;
    let track = this.publishedTracks.find((t) => t.id === trackId);

    if (!track) {
      const baseTrack = MOCK_TRACKS.find((t) => t.id === trackId);
      if (baseTrack) {
        track = { ...baseTrack };
        this.publishedTracks.push(track);
      }
    }

    if (track) {
      const previousCrate = track.crateName || track.crateId || 'Previous Crate';
      track.crateId = targetCrate.id;
      track.crateName = targetCrate.name;
      track.genre = targetCrate.name;
      this.persistTracks();
      this.notify();

      AuditLogger.logAction({
        adminId: actor?.id || 'usr-admin',
        adminName: actor?.name || 'Administrator',
        adminRole: 'admin',
        eventType: 'TRACK_MOVED_CRATE',
        action: `Admin moved track "${track.title}" by "${track.artistName}" from ${previousCrate} to "${targetCrate.name}"`,
        resource: 'Music Catalog',
        resourceId: track.id,
        newValue: {
          crateId: targetCrate.id,
          crateName: targetCrate.name,
        },
        status: 'SUCCESS',
      });

      return true;
    }
    return false;
  }

  /**
   * Bulk moves multiple tracks to a destination crate.
   */
  public moveTracksToCrate(
    trackIds: string[],
    targetCrateId: string,
    actor?: { id?: string; name?: string }
  ): number {
    const targetCrate = this.getCrateById(targetCrateId) || DIRECT_MUSIC_CRATE;
    const targetSet = new Set(trackIds);
    let count = 0;

    // Check published tracks
    this.publishedTracks.forEach((t) => {
      if (targetSet.has(t.id)) {
        t.crateId = targetCrate.id;
        t.crateName = targetCrate.name;
        t.genre = targetCrate.name;
        count++;
      }
    });

    // Check mock tracks if any not yet in published
    MOCK_TRACKS.forEach((m) => {
      if (targetSet.has(m.id) && !this.publishedTracks.some((p) => p.id === m.id)) {
        this.publishedTracks.push({
          ...m,
          crateId: targetCrate.id,
          crateName: targetCrate.name,
          genre: targetCrate.name,
        });
        count++;
      }
    });

    if (count > 0) {
      this.persistTracks();
      this.notify();

      AuditLogger.logAction({
        adminId: actor?.id || 'usr-admin',
        adminName: actor?.name || 'Administrator',
        adminRole: 'admin',
        eventType: 'TRACKS_BULK_MOVED_CRATE',
        action: `Admin bulk moved ${count} tracks to crate "${targetCrate.name}"`,
        resource: 'Music Catalog',
        resourceId: targetCrate.id,
        newValue: {
          count,
          targetCrateId: targetCrate.id,
          targetCrateName: targetCrate.name,
        },
        status: 'SUCCESS',
      });
    }

    return count;
  }

  public getAllFolders(): CrateFolder[] {
    return [];
  }

  public getCrateFolders(): CrateFolder[] {
    return [];
  }

  public getFoldersByCrate(_crateId?: string): CrateFolder[] {
    // All crate collections/folders are permanently removed from all crates per user directive.
    // Crates display exclusively songs.
    return [];
  }

  public createFolder(
    crateId: string,
    name: string,
    artistName: string = 'ChanceTEK One',
    description?: string,
    coverUrl?: string,
    id?: string
  ): CrateFolder {
    const newFolder: CrateFolder = {
      id: id || `folder-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      crateId: 'direct-music-library',
      name: name.trim(),
      artistName: artistName.trim(),
      description: description || `Collection for ${name}`,
      coverUrl: coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      trackCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newFolder;
  }

  public updateTrackAudio(
    trackId: string,
    newAudioUrl: string,
    audioAsset?: Track['audioAsset'],
    actorName: string = 'Administrator'
  ): boolean {
    const track = this.publishedTracks.find((t) => t.id === trackId);
    if (track) {
      const previousAudioUrl = track.audioUrl;
      track.audioUrl = newAudioUrl;
      if (audioAsset) {
        track.audioAsset = audioAsset;
        track.audioStatus = 'verified';
      } else {
        track.audioStatus = newAudioUrl.startsWith('indexeddb://') ? 'local_only' : 'legacy';
      }
      track.audioReviewNote = undefined;
      this.persistTracks();
      this.notify();
      logAudioDiag({ stage: 'repair', trackId, assetKey: newAudioUrl, sha256: audioAsset?.sha256, status: 'relinked' });
      AuditLogger.logAction({
        adminId: 'admin-action',
        adminName: actorName,
        adminRole: 'admin',
        eventType: 'TRACK_METADATA_UPDATED',
        action: `Relinked audio asset for "${track.title}" by "${track.artistName}"`,
        resource: 'Music Catalog',
        resourceId: track.id,
        previousValue: { audioUrl: previousAudioUrl },
        newValue: { audioUrl: newAudioUrl, audioAsset },
        status: 'SUCCESS',
      });
      return true;
    }
    return false;
  }

  /**
   * Read-only diagnostic audit of all tracks in the catalog.
   * Identifies missing assets, cross-artist filenames, and shared assets across different songs/artists.
   */
  public auditCatalogAudioIntegrity(existingUploadFiles?: Set<string>): { findings: AudioFinding[]; summary: Record<string, number> } {
    const files = existingUploadFiles || new Set(Array.from(VERIFIED_SERVER_UPLOADS).map((f) => f.toLowerCase()));
    return auditAudioAssociations(this.getAllTracks(), { existingUploadFiles: files });
  }

  /**
   * Flags a track for administrator review without deleting or guessing a replacement file.
   */
  public flagTrackForAudioReview(trackId: string, note: string, actorName: string = 'System Audit'): boolean {
    const track = this.publishedTracks.find((t) => t.id === trackId);
    if (!track) return false;
    track.audioStatus = 'needs_review';
    track.audioReviewNote = note;
    this.persistTracks();
    this.notify();
    AuditLogger.logAction({
      adminId: 'admin-audit',
      adminName: actorName,
      adminRole: 'admin',
      eventType: 'TRACK_METADATA_UPDATED',
      action: `Flagged track "${track.title}" (${track.artistName}) for audio review: ${note}`,
      resource: 'Music Catalog',
      resourceId: track.id,
      newValue: { audioStatus: 'needs_review', audioReviewNote: note },
      status: 'WARNING',
    });
    return true;
  }

  public updateTrackCover(trackId: string, newCoverUrl: string, adminActor?: { id?: string; name?: string }): boolean {
    return this.updateTrack(trackId, { coverUrl: newCoverUrl }, adminActor);
  }

  public updateTrack(trackId: string, updates: Partial<Track>, adminActor?: { id?: string; name?: string }): boolean {
    let track = this.publishedTracks.find((t) => t.id === trackId);
    if (!track) {
      const baseTrack =
        PLATFORM_CANONICAL_TRACKS.find((t) => t.id === trackId) ||
        MOCK_TRACKS.find((t) => t.id === trackId) ||
        this.getAllTracks().find((t) => t.id === trackId);
      if (baseTrack) {
        track = { ...baseTrack };
        this.publishedTracks.push(track);
      }
    }

    if (track) {
      Object.assign(track, updates);
      if (updates.coverUrl) {
        (track as any).customCover = true;
        this.customCovers[track.id] = updates.coverUrl;
        const tKey = normalizeAlbumKey(track.title);
        const aKey = normalizeAlbumKey(track.artistName);
        if (tKey && aKey) {
          this.customCovers[`track:${tKey}:::${aKey}`] = updates.coverUrl;
        }
        this.persistCustomCovers();
        this.syncUploadBatchCover(track.id, updates.coverUrl);

        // Synchronize in-memory canonical and mock collections
        const mockMatch = MOCK_TRACKS.find((m) => m.id === track!.id || (tKey && aKey && normalizeAlbumKey(m.title) === tKey && normalizeAlbumKey(m.artistName) === aKey));
        if (mockMatch) {
          mockMatch.coverUrl = updates.coverUrl;
          (mockMatch as any).customCover = true;
        }
        const canonMatch = PLATFORM_CANONICAL_TRACKS.find((c) => c.id === track!.id || (tKey && aKey && normalizeAlbumKey(c.title) === tKey && normalizeAlbumKey(c.artistName) === aKey));
        if (canonMatch) {
          canonMatch.coverUrl = updates.coverUrl;
          (canonMatch as any).customCover = true;
        }
      }
      if (updates.crateId) {
        (track as any).customCrate = true;
      }
      this.persistTracks();
      this.catalogVersion++;
      this.cachedAllTracks = null;
      this.cachedOfficialCrates = null;
      this.notify();

      if (adminActor && updates.crateId) {
        AuditLogger.logAction({
          adminId: adminActor.id || 'usr-admin',
          adminName: adminActor.name || 'Administrator',
          adminRole: 'admin',
          eventType: 'TRACK_METADATA_UPDATED',
          action: `Administrator moved track "${track.title}" to crate "${updates.crateName || updates.crateId}"`,
          resource: 'Music Catalog',
          resourceId: track.id,
          newValue: { crateId: updates.crateId, crateName: updates.crateName },
          status: 'SUCCESS',
        });
      } else if (adminActor && updates.coverUrl) {
        AuditLogger.logAction({
          adminId: adminActor.id || 'usr-admin',
          adminName: adminActor.name || 'Administrator',
          adminRole: 'admin',
          eventType: 'TRACK_METADATA_UPDATED',
          action: `Administrator updated cover art for "${track.title}" by "${track.artistName}"`,
          resource: 'Music Catalog',
          resourceId: track.id,
          newValue: { coverUrl: updates.coverUrl },
          status: 'SUCCESS',
        });
      } else if (adminActor) {
        AuditLogger.logAction({
          adminId: adminActor.id || 'usr-admin',
          adminName: adminActor.name || 'Administrator',
          adminRole: 'admin',
          eventType: 'TRACK_METADATA_UPDATED',
          action: `Administrator updated metadata for "${track.title}" by "${track.artistName}"`,
          resource: 'Music Catalog',
          resourceId: track.id,
          newValue: updates as Record<string, any>,
          status: 'SUCCESS',
        });
      }
      return true;
    }
    return false;
  }

  public updateAlbumCover(
    albumTitle: string,
    newCoverUrl: string,
    adminActor?: { id?: string; name?: string },
    options?: { artistName?: string; albumId?: string; trackId?: string }
  ): boolean {
    const targetTitle = String(albumTitle || '').toLowerCase().trim();
    const targetNorm = normalizeAlbumKey(albumTitle);
    const artistNorm = options?.artistName ? normalizeAlbumKey(options.artistName) : '';

    if (!targetNorm && !options?.albumId && !artistNorm) return false;

    // If album is generic or virtual (e.g. "Singles & Vault Cuts" or "album-vault"), NEVER apply across the album!
    if (isGenericOrVirtualAlbum(albumTitle) || isGenericOrVirtualAlbum(options?.albumId)) {
      if (options?.trackId) {
        return this.updateTrack(options.trackId, { coverUrl: newCoverUrl }, adminActor);
      }
      return false;
    }

    // 1. Save into persistent custom covers registry: ALWAYS strictly scoped by BOTH album AND artist
    if (targetNorm && artistNorm) {
      this.customCovers[`album:${targetNorm}:::${artistNorm}`] = newCoverUrl;
    }
    if (options?.albumId && !isGenericOrVirtualAlbum(options.albumId)) {
      this.customCovers[options.albumId] = newCoverUrl;
    }
    // NEVER write broad un-scoped album:${targetNorm} without artist!
    this.persistCustomCovers();

    // 2. Update matching tracks strictly scoped to THIS album AND THIS artist
    const all = this.getAllTracks();
    const matchingTracks = all.filter((t) => {
      const tArtNorm = normalizeAlbumKey(t.artistName);
      // HARD SECURITY CHECK: Artist MUST match! Different artists can NEVER share an album cover!
      if (artistNorm && tArtNorm !== artistNorm) {
        return false;
      }
      if (options?.albumId && !isGenericOrVirtualAlbum(options.albumId) && t.albumId === options.albumId) {
        return true;
      }
      const tAlbNorm = normalizeAlbumKey(t.albumTitle);
      if (targetNorm && artistNorm && tAlbNorm === targetNorm && tArtNorm === artistNorm) {
        return true;
      }
      if (options?.trackId && t.id === options.trackId) return true;
      return false;
    });

    matchingTracks.forEach((t) => {
      t.coverUrl = newCoverUrl;
      (t as any).customCover = true;
      this.customCovers[t.id] = newCoverUrl;
      const tKey = normalizeAlbumKey(t.title);
      if (tKey && artistNorm) {
        this.customCovers[`track:${tKey}:::${artistNorm}`] = newCoverUrl;
      }
      this.syncUploadBatchCover(t.id, newCoverUrl);
    });

    // 3. Update publishedAlbums strictly scoped to this album and artist
    let albumFound = false;
    this.publishedAlbums.forEach((a) => {
      const aTitleNorm = normalizeAlbumKey(a.title);
      const aArtNorm = normalizeAlbumKey(a.artistName);
      if (
        (options?.albumId && !isGenericOrVirtualAlbum(options.albumId) && a.id === options.albumId && aArtNorm === artistNorm) ||
        (targetNorm && artistNorm && aTitleNorm === targetNorm && aArtNorm === artistNorm)
      ) {
        a.coverUrl = newCoverUrl;
        albumFound = true;
      }
    });

    if (!albumFound && (targetTitle || options?.albumId)) {
      const newAlbumId = options?.albumId || `album-${targetNorm || 'custom'}`;
      this.publishedAlbums.push({
        id: newAlbumId,
        title: albumTitle,
        artistId: matchingTracks[0]?.artistId || 'artist-custom',
        artistName: options?.artistName || matchingTracks[0]?.artistName || 'Artist',
        label: matchingTracks[0]?.label || 'ChanceTEK One',
        coverUrl: newCoverUrl,
        releaseYear: matchingTracks[0]?.releaseYear || 2026,
        genre: matchingTracks[0]?.genre || 'R&B / Soul',
        trackIds: matchingTracks.map((t) => t.id),
        description: `Album release by ${options?.artistName || matchingTracks[0]?.artistName || 'Artist'}`,
        likeCount: 0,
        playCount: 0,
      });
    }
    this.persistAlbums();

    // 4. Update crateFolders
    this.crateFolders.forEach((f) => {
      const fNorm = normalizeAlbumKey(f.name);
      const fArtNorm = normalizeAlbumKey(f.artistName);
      if (
        (options?.albumId && f.id === options.albumId) ||
        (targetNorm && fNorm === targetNorm && (!artistNorm || fArtNorm === artistNorm)) ||
        (artistNorm && fArtNorm === artistNorm && (!targetNorm || targetNorm === 'single' || targetNorm === 'direct music library'))
      ) {
        f.coverUrl = newCoverUrl;
        f.updatedAt = new Date().toISOString();
      }
    });
    this.persistFolders();

    // 5. Update MOCK_ALBUMS in place strictly scoped to artist
    MOCK_ALBUMS.forEach((a) => {
      const aTitleNorm = normalizeAlbumKey(a.title);
      const aArtNorm = normalizeAlbumKey(a.artistName);
      if (
        (options?.albumId && a.id === options.albumId) ||
        (targetNorm && artistNorm && aTitleNorm === targetNorm && aArtNorm === artistNorm)
      ) {
        a.coverUrl = newCoverUrl;
      }
    });

    this.persistTracks();
    this.catalogVersion++;
    this.cachedAllTracks = null;
    this.cachedAllAlbums = null;
    this.cachedOfficialCrates = null;
    this.notify();

    if (adminActor) {
      AuditLogger.logAction({
        adminId: adminActor.id || 'usr-admin',
        adminName: adminActor.name || 'Administrator',
        adminRole: 'admin',
        eventType: 'ALBUM_METADATA_UPDATED',
        action: `Administrator updated cover art for album "${albumTitle}" (${options?.artistName || ''})`,
        resource: 'Music Catalog',
        resourceId: options?.albumId || albumTitle,
        newValue: { coverUrl: newCoverUrl },
        status: 'SUCCESS',
      });
    }

    return true;
  }

  public updateFolderCover(folderId: string, newCoverUrl: string): boolean {
    const folder = this.crateFolders.find((f) => f.id === folderId);
    if (folder) {
      folder.coverUrl = newCoverUrl;
      folder.updatedAt = new Date().toISOString();
      this.persistFolders();

      // Also sync coverUrl to matching published album
      const album = this.publishedAlbums.find((a) => a.id === folderId || a.title.toLowerCase().trim() === folder.name.toLowerCase().trim());
      if (album) {
        album.coverUrl = newCoverUrl;
        this.persistAlbums();
      }

      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Retrieves all albums in the platform: combines published albums, dynamic albums from crate folders, and mock releases
   */
  public getAllAlbums(): Album[] {
    if (this.cachedAllAlbums && this.cachedAllAlbums.version === this.catalogVersion) {
      return this.cachedAllAlbums.albums;
    }
    const allTracks = this.getAllTracks();
    const albumsMap = new Map<string, Album>();

    // 1. Seed with base MOCK_ALBUMS
    MOCK_ALBUMS.forEach((a) => {
      albumsMap.set(a.id, { ...a });
    });

    // 2. Add published albums from state
    this.publishedAlbums.forEach((a) => {
      albumsMap.set(a.id, { ...a });
    });

    // 3. Ensure any CrateFolder with tracks is represented as an Album
    this.crateFolders.forEach((folder) => {
      const folderTracks = allTracks.filter(
        (t) => (t.albumId && t.albumId === folder.id) ||
          (t.albumTitle && t.albumTitle.toLowerCase().trim() === folder.name.toLowerCase().trim())
      );

      if (folderTracks.length > 0) {
        const existing = albumsMap.get(folder.id) || Array.from(albumsMap.values()).find(
          (a) => a.title.toLowerCase().trim() === folder.name.toLowerCase().trim() &&
            a.artistName.toLowerCase().trim() === folder.artistName.toLowerCase().trim()
        );

        const authenticTrackCover = folderTracks.find(
          (t) => t.coverUrl && !t.coverUrl.includes('images.unsplash.com') && !t.coverUrl.startsWith('indexeddb://')
        )?.coverUrl;

        const effectiveAuthenticCover = this.resolveAlbumCover({
          id: folder.id,
          title: folder.name,
          artistName: folder.artistName,
          coverUrl: authenticTrackCover || folder.coverUrl,
        });

        if (existing) {
          existing.trackIds = Array.from(new Set([...existing.trackIds, ...folderTracks.map((t) => t.id)]));
          if (effectiveAuthenticCover) {
            existing.coverUrl = effectiveAuthenticCover;
            if (!folder.coverUrl || isMissingOrGenericCover(folder.coverUrl)) {
              folder.coverUrl = effectiveAuthenticCover;
            }
          } else if (folder.coverUrl && !isMissingOrGenericCover(folder.coverUrl)) {
            existing.coverUrl = folder.coverUrl;
          }
        } else {
          const first = folderTracks[0];
          const bestCover = authenticTrackCover ||
            (folder.coverUrl && !folder.coverUrl.includes('images.unsplash.com') ? folder.coverUrl : undefined) ||
            first.coverUrl ||
            folder.coverUrl ||
            '/images/logo.png';

          const newAlb: Album = {
            id: folder.id,
            title: folder.name,
            artistId: first.artistId || 'artist-1',
            artistName: folder.artistName || first.artistName,
            label: first.label || 'ChanceTEK One',
            coverUrl: bestCover,
            releaseYear: first.releaseYear || 2026,
            genre: first.genre || 'Music',
            trackIds: folderTracks.map((t) => t.id),
            description: folder.description || `Album release by ${folder.artistName}`,
            likeCount: 0,
            playCount: folderTracks.reduce((sum, t) => sum + (t.playCount || 0), 0),
          };
          albumsMap.set(newAlb.id, newAlb);
        }
      }
    });

    // 4. Auto-group any uploaded tracks sharing (artistName, albumTitle) into an Album
    const albumGroups = new Map<string, Track[]>();
    allTracks.forEach((t) => {
      if (t.albumTitle && t.albumTitle !== 'Single Release' && t.albumTitle !== 'Vault Cuts') {
        const key = `${t.artistName.toLowerCase().trim()}:::${t.albumTitle.toLowerCase().trim()}`;
        if (!albumGroups.has(key)) albumGroups.set(key, []);
        albumGroups.get(key)!.push(t);
      }
    });

    albumGroups.forEach((groupTracks) => {
      const first = groupTracks[0];
      const authenticTrackCover = groupTracks.find(
        (t) => t.coverUrl && !t.coverUrl.includes('images.unsplash.com') && !t.coverUrl.startsWith('indexeddb://')
      )?.coverUrl || first.coverUrl;

      const found = Array.from(albumsMap.values()).find(
        (a) => a.title.toLowerCase().trim() === first.albumTitle!.toLowerCase().trim() &&
          a.artistName.toLowerCase().trim() === first.artistName.toLowerCase().trim()
      );
      if (found) {
        const finalCover = this.resolveAlbumCover({
          title: first.albumTitle!,
          artistName: first.artistName,
          coverUrl: authenticTrackCover || first.coverUrl,
        });
        if (finalCover) {
          found.coverUrl = finalCover;
        }
        found.trackIds = Array.from(new Set([...found.trackIds, ...groupTracks.map((t) => t.id)]));
      } else {
        const id = first.albumId || `album-${first.artistName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${first.albumTitle!.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        albumsMap.set(id, {
          id,
          title: first.albumTitle!,
          artistId: first.artistId || 'artist-1',
          artistName: first.artistName,
          label: first.label || 'ChanceTEK One',
          coverUrl: this.resolveAlbumCover({
            id,
            title: first.albumTitle!,
            artistName: first.artistName,
            coverUrl: authenticTrackCover || first.coverUrl,
          }),
          releaseYear: first.releaseYear || 2026,
          genre: first.genre,
          trackIds: groupTracks.map((t) => t.id),
          description: `Album release by ${first.artistName}`,
          likeCount: 0,
          playCount: groupTracks.reduce((sum, t) => sum + (t.playCount || 0), 0),
        });
      }
    });

    const result = Array.from(albumsMap.values())
      .filter((a) => {
        if (this.isAlbumPermanentlyRemoved(a.id, a.title)) return false;
        // If all tracks in this album are permanently removed, do not display empty album
        const activeTracks = (a.trackIds || []).filter((tId) => !this.isTrackPermanentlyRemoved(tId));
        return activeTracks.length > 0;
      })
      .map((a) => ({
        ...a,
        likeCount: EngagementMetricsService.getLikeCount(a.id),
      }));
    this.cachedAllAlbums = { version: this.catalogVersion, albums: result };
    return result;
  }

  public getAlbumById(id: string): Album | undefined {
    return this.getAllAlbums().find(
      (a) => a.id === id ||
        a.title.toLowerCase().replace(/[^a-z0-9]/g, '-') === id.toLowerCase().replace(/[^a-z0-9]/g, '-')
    );
  }

  public getAlbumTracks(albumIdOrTitle: string): Track[] {
    const allTracks = this.getAllTracks();
    const album = this.getAlbumById(albumIdOrTitle);
    if (album) {
      const trackIdSet = new Set(album.trackIds);
      const matched = allTracks.filter((t) => trackIdSet.has(t.id));
      if (matched.length > 0) return matched;
      return allTracks.filter(
        (t) => (t.albumTitle || '').toLowerCase().trim() === album.title.toLowerCase().trim()
      );
    }
    return allTracks.filter(
      (t) => (t.albumTitle || '').toLowerCase().trim() === albumIdOrTitle.toLowerCase().trim() ||
        (t.albumId || '') === albumIdOrTitle
    );
  }

  public createOrUpdateAlbum(albumData: Partial<Album> & { title: string; artistName: string }): Album {
    const existingIndex = this.publishedAlbums.findIndex(
      (a) => (albumData.id && a.id === albumData.id) ||
        (a.title.toLowerCase().trim() === albumData.title.toLowerCase().trim() &&
          a.artistName.toLowerCase().trim() === albumData.artistName.toLowerCase().trim())
    );

    let resultAlbum: Album;

    if (existingIndex >= 0) {
      const existing = this.publishedAlbums[existingIndex];
      // Strictly prioritize authentic original cover art:
      // If incoming albumData.coverUrl is authentic, it takes precedence.
      // If incoming albumData.coverUrl is generic or missing, preserve existing authentic cover art.
      let effectiveCover = existing.coverUrl;
      const isIncomingAuthentic = Boolean(albumData.coverUrl && !albumData.coverUrl.includes('images.unsplash.com'));
      const isExistingGeneric = Boolean(!existing.coverUrl || existing.coverUrl.includes('images.unsplash.com'));

      if (isIncomingAuthentic || isExistingGeneric) {
        effectiveCover = albumData.coverUrl || existing.coverUrl;
      }

      resultAlbum = {
        ...existing,
        ...albumData,
        coverUrl: effectiveCover,
        trackIds: Array.from(new Set([
          ...(existing.trackIds || []),
          ...(albumData.trackIds || []),
        ])),
      };
      this.publishedAlbums[existingIndex] = resultAlbum;
    } else {
      resultAlbum = {
        id: albumData.id || `album-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: albumData.title,
        artistId: albumData.artistId || 'artist-1',
        artistName: albumData.artistName,
        label: albumData.label || 'ChanceTEK One',
        coverUrl: albumData.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        releaseYear: albumData.releaseYear || 2026,
        genre: albumData.genre || 'Music',
        trackIds: albumData.trackIds || [],
        description: albumData.description || `Album collection by ${albumData.artistName}`,
        likeCount: albumData.likeCount || 0,
        playCount: albumData.playCount || 0,
      };
      this.publishedAlbums.push(resultAlbum);
    }

    this.persistAlbums();
    this.notify();
    return resultAlbum;
  }

  public publishTracks(
    newTracks: Track[],
    crateId: string,
    folderId?: string,
    actorName: string = 'Administrator'
  ): void {
    const now = new Date().toISOString();

    const targetCrate = this.getCrateById(crateId) || DIRECT_MUSIC_CRATE;
    const formattedTracks: Track[] = newTracks.map((t) => ({
      ...t,
      crateId: t.crateId || crateId,
      crateName: t.crateName || targetCrate.name,
      genre: (!t.genre || isGenericOrInvalidGenre(t.genre))
        ? classifyGenre({
          artist: t.artistName,
          title: t.title,
          album: t.albumTitle,
          rawGenre: t.genre,
          crateId: t.crateId || crateId,
          crateName: targetCrate.name,
        })
        : t.genre,
      playCount: t.playCount || 0,
      likeCount: t.likeCount || 0,
      dislikeCount: 0,
      commentCount: 0,
    }));

    // Auto-create or link album/folder for tracks sharing same artist in same folder/album
    const albumGroups = new Map<string, Track[]>();
    formattedTracks.forEach((t) => {
      // Find effective album name from albumTitle or folder
      let albName = (t.albumTitle || '').trim();
      if (!albName || albName.toLowerCase() === 'single release' || albName.toLowerCase() === 'vault cuts' || albName.toLowerCase() === 'master crate vault') {
        if (folderId) {
          const matchFolder = this.crateFolders.find((f) => f.id === folderId);
          if (matchFolder) albName = matchFolder.name;
        }
      }

      if (albName && albName.toLowerCase() !== 'single release' && albName.toLowerCase() !== 'vault cuts') {
        const key = `${(t.artistName || 'ChanceTEK One').toLowerCase().trim()}:::${albName.toLowerCase().trim()}`;
        if (!albumGroups.has(key)) albumGroups.set(key, []);
        albumGroups.get(key)!.push(t);
      }
    });

    albumGroups.forEach((groupTracks) => {
      const first = groupTracks[0];
      const albTitle = first.albumTitle || 'Collection';
      const artist = first.artistName || 'ChanceTEK One';
      // Stable album id assigned by the ingestion agent (survives retries/reprocessing, never collides between albums)
      const explicitAlbumId = groupTracks.find((t) => t.albumId && t.albumId !== 'album-vault')?.albumId;
      // Verified album artwork computed by the artwork planner wins over "first track that has any cover"
      const verifiedAlbumCover = groupTracks.find(
        (t) => t.albumCoverUrl && !t.albumCoverUrl.includes('images.unsplash.com')
      )?.albumCoverUrl;
      const authenticTrackCover = groupTracks.find(
        (t) => t.coverUrl && !t.coverUrl.includes('images.unsplash.com')
      )?.coverUrl;
      const albCover = verifiedAlbumCover || authenticTrackCover || first.coverUrl;

      // Crates display songs directly without crate collection folders.
      // Albums are maintained exclusively for the platform Albums (/albums) library.
      const effectiveAlbumId = explicitAlbumId || `album-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      groupTracks.forEach((t) => {
        t.albumId = effectiveAlbumId;
        t.albumTitle = albTitle;
        if (!t.coverUrl || t.coverUrl.includes('images.unsplash.com')) {
          if (albCover && !albCover.includes('images.unsplash.com')) t.coverUrl = albCover;
        }
      });

      this.createOrUpdateAlbum({
        id: effectiveAlbumId,
        title: albTitle,
        artistName: artist,
        coverUrl: (albCover && !albCover.includes('images.unsplash.com')) ? albCover : first.coverUrl,
        genre: first.genre,
        releaseYear: first.releaseYear || 2026,
        trackIds: groupTracks.map((t) => t.id),
      });
    });

    // Deduplicate and prepend to published list with linked albumIds
    const incomingIds = new Set(formattedTracks.map((t) => t.id));
    this.publishedTracks = [
      ...formattedTracks,
      ...this.publishedTracks.filter((t) => !incomingIds.has(t.id)),
    ];

    // Ensure newly reloaded/published tracks lift any past deletion tombstones
    const incomingKeys = new Set(
      formattedTracks.map((t) => `key:${normalizeAlbumKey(t.title)}:::${normalizeAlbumKey(t.artistName)}`)
    );
    const incomingTitles = new Set(formattedTracks.map((t) => normalizeAlbumKey(t.title)));

    this.removedTrackIds = this.removedTrackIds.filter(
      (id) =>
        !incomingIds.has(id) &&
        !incomingKeys.has(id) &&
        !incomingTitles.has(id) &&
        !incomingTitles.has(id.replace(/^title:/, ''))
    );
    this.persistRemoved();

    this.persistTracks();
    this.forcePushAllToCloud();

    // Direct server catalog synchronization for 0-latency reflection to StrideIQ partner API & MCP
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const ops = formattedTracks.map((t) => ({
        collection: 'tracks',
        op: 'set',
        id: t.id,
        data: t as unknown as Record<string, any>,
      }));
      fetch('/api/catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': actorName && actorName.includes('@') ? actorName : 'admin@chancetekone.com',
        },
        body: JSON.stringify({ ops }),
      }).catch((err) => console.warn('[MusicCatalogService] Direct server catalog push warning:', err));
    }

    // Increment track count on folder if specified
    if (folderId) {
      const f = this.crateFolders.find((folder) => folder.id === folderId);
      if (f) {
        f.trackCount += newTracks.length;
        f.updatedAt = now;
        this.persistFolders();
      }
    }

    // Track analytics event
    AnalyticsEngine.trackEvent({
      eventType: 'BATCH_PUBLISHED',
      action: `${actorName} published batch of ${newTracks.length} tracks to crate "${crateId}"`,
      resource: `Crate: ${crateId}`,
      platformArea: 'Music Catalog',
      metadata: {
        trackCount: newTracks.length,
        crateId,
        folderId,
      },
    });

    AuditLogger.logAction({
      adminId: 'admin-action',
      adminName: actorName,
      adminRole: 'admin',
      eventType: 'MUSIC_BATCH_PUBLISHED',
      action: `Published ${newTracks.length} approved tracks to catalog crate "${crateId}"`,
      resource: 'Music Catalog',
      resourceId: crateId,
      newValue: {
        publishedCount: newTracks.length,
        tracks: newTracks.map((t) => ({ id: t.id, title: t.title, artist: t.artistName })),
      },
      status: 'SUCCESS',
    });

    this.notify();
  }

  /**
   * Authority to remove music: permanently removes track from live platform,
   * purges cached binary storage and staging batches, and archives in 45-day recovery vault.
   */
  public removeTrack(
    trackId: string,
    admin: { id?: string; name?: string; role?: AdminRole },
    reason?: string,
    options?: { exactIdOnly?: boolean }
  ): boolean {
    const exactIdOnly = options?.exactIdOnly === true;
    const track =
      this.getAllTracks().find((t) => t.id === trackId) ||
      PLATFORM_CANONICAL_TRACKS.find((t) => t.id === trackId) ||
      this.publishedTracks.find((t) => t.id === trackId);

    const trackTitle = track?.title;
    const trackArtist = track?.artistName;
    const titleKey = trackTitle ? normalizeAlbumKey(trackTitle) : '';
    const artistKey = trackArtist ? normalizeAlbumKey(trackArtist) : '';
    const compositeKey = titleKey && artistKey ? `key:${titleKey}:::${artistKey}` : '';

    const idsToTombstone: string[] = [trackId];
    if (track?.id) idsToTombstone.push(track.id);
    if (!exactIdOnly) {
      if (compositeKey) idsToTombstone.push(compositeKey);
      if (titleKey) {
        idsToTombstone.push(titleKey);
        idsToTombstone.push(`title:${titleKey}`);
      }

      // Check all matching canonical & mock tracks so they are also permanently tombstoned
      if (titleKey && artistKey) {
        PLATFORM_CANONICAL_TRACKS.forEach((c) => {
          if (normalizeAlbumKey(c.title) === titleKey && normalizeAlbumKey(c.artistName) === artistKey) {
            idsToTombstone.push(c.id);
          }
        });
        MOCK_TRACKS.forEach((m) => {
          if (normalizeAlbumKey(m.title) === titleKey && normalizeAlbumKey(m.artistName) === artistKey) {
            idsToTombstone.push(m.id);
          }
        });
      }
    }

    let changed = false;
    idsToTombstone.forEach((id) => {
      if (id && !this.removedTrackIds.includes(id)) {
        this.removedTrackIds.push(id);
        changed = true;
      }
    });
    if (changed) {
      this.persistRemoved();
    }

    // Remove from publishedTracks permanently
    const tombstoneSet = new Set(idsToTombstone);
    this.publishedTracks = this.publishedTracks.filter((t) => {
      if (tombstoneSet.has(t.id)) return false;
      if (!exactIdOnly && titleKey && artistKey && normalizeAlbumKey(t.title) === titleKey && normalizeAlbumKey(t.artistName) === artistKey) {
        return false;
      }
      return true;
    });
    this.persistTracks();

    // Purge cached audio binary and cover art from IndexedDB
    if (typeof window !== 'undefined') {
      idsToTombstone.forEach((id) => {
        AudioStorageService.deleteAudio(id).catch(() => { });
        AudioStorageService.deleteCoverArt(id).catch(() => { });
        AudioStorageService.deleteCoverArt(`cover_${id}`).catch(() => { });
      });
    }

    // Purge from upload batches in localStorage so staging workspaces cannot resurrect this track
    if (typeof window !== 'undefined') {
      try {
        const batchesRaw = localStorage.getItem('spades_upload_batches_v2');
        const batches = batchesRaw ? JSON.parse(batchesRaw) : [];
        if (Array.isArray(batches)) {
          batches.forEach((b: any) => {
            if (!b?.id) return;
            const itemsKey = `spades_upload_items_v2_${b.id}`;
            const itemsRaw = localStorage.getItem(itemsKey);
            if (!itemsRaw) return;
            const items = JSON.parse(itemsRaw);
            if (!Array.isArray(items)) return;
            let batchModified = false;
            const remaining = items.filter((it: any) => {
              const itTitleKey = normalizeAlbumKey(it.title || '');
              const itArtistKey = normalizeAlbumKey(it.artist || '');
              const isMatch =
                tombstoneSet.has(it.id) ||
                (it.publishedTrackId && tombstoneSet.has(it.publishedTrackId)) ||
                (!exactIdOnly && titleKey && artistKey && itTitleKey === titleKey && itArtistKey === artistKey);
              if (isMatch) {
                batchModified = true;
                return false;
              }
              return true;
            });
            if (batchModified) {
              localStorage.setItem(itemsKey, JSON.stringify(remaining));
            }
          });
        }
      } catch (e) {
        console.warn('[MusicCatalogService] Error cleaning upload batches on removeTrack:', e);
      }
    }

    // Move to 45-day Recovery Vault if track object exists
    if (track) {
      MusicRecoveryService.moveToRecovery(track, admin, {
        crateId: track.genre,
        folderId: track.albumId,
        folderName: track.albumTitle,
        reason,
      });
    }

    this.pushLocalChanges();
    this.notify();
    return true;
  }

  /**
   * Authority to permanently remove multiple music tracks in a batch:
   * permanently removes tracks from live platform, purges storage, archives in 45-day recovery vault,
   * and synchronizes changes across cloud and local storage in a single optimized pass.
   */
  public removeTracks(
    trackIds: string[],
    admin: { id?: string; name?: string; role?: AdminRole },
    reason?: string
  ): number {
    let removedCount = 0;
    this.withoutCloudPush(() => {
      trackIds.forEach((id) => {
        if (this.removeTrack(id, admin, reason)) {
          removedCount++;
        }
      });
    });

    this.pushLocalChanges();
    this.notify();
    return removedCount;
  }

  /**
   * Authority to permanently remove an entire album/collection:
   * permanently deletes all tracks and album records from the platform.
   */
  public removeAlbum(
    albumTitle: string,
    admin: { id?: string; name?: string; role?: AdminRole },
    reason?: string
  ): number {
    const target = albumTitle.toLowerCase().trim();
    const titleKey = normalizeAlbumKey(albumTitle);
    const all = this.getAllTracks();
    const matchingTracks = all.filter(
      (t) =>
        (t.albumTitle || '').toLowerCase().trim() === target ||
        (t.albumId && t.albumId === albumTitle) ||
        (t.albumTitle && normalizeAlbumKey(t.albumTitle) === titleKey)
    );

    const albumTombstones = [target, albumTitle, titleKey, `key:${titleKey}`];
    albumTombstones.forEach((k) => {
      if (k && !this.removedAlbumIds.includes(k)) {
        this.removedAlbumIds.push(k);
      }
    });
    this.persistRemovedAlbums();

    // Permanently remove all matching tracks
    matchingTracks.forEach((t) => {
      this.removeTrack(t.id, admin, reason);
    });

    this.publishedAlbums = this.publishedAlbums.filter(
      (a) =>
        a.title.toLowerCase().trim() !== target &&
        a.id !== albumTitle &&
        normalizeAlbumKey(a.title) !== titleKey
    );
    this.persistAlbums();

    // Remove matching crate folder
    this.crateFolders = this.crateFolders.filter(
      (f) =>
        f.name.toLowerCase().trim() !== target &&
        f.id !== albumTitle &&
        normalizeAlbumKey(f.name) !== titleKey
    );
    this.persistFolders();

    MusicRecoveryService.removeAlbumToRecovery(albumTitle, matchingTracks, admin, { reason });
    this.pushLocalChanges();
    this.notify();
    return matchingTracks.length;
  }

  /**
   * Authority to remove an album by its exact ID (not by title string, avoiding cross-artist collisions).
   * Supports detaching tracks or cascading tracks to permanent removal and recovery vault.
   */
  public removeAlbumById(
    albumId: string,
    admin: { id?: string; name?: string; role?: AdminRole },
    reason?: string,
    options: { detachTracks?: boolean } = {}
  ): { removedAlbumId: string; tracksAffected: number } {
    const allAlbums = this.getAllAlbums();
    const album = allAlbums.find((a) => a.id === albumId);
    const albumTitle = album?.title || albumId;
    const titleKey = normalizeAlbumKey(albumTitle);
    const allTracks = this.getAllTracks();
    const matchingTracks = allTracks.filter(
      (t) => t.albumId === albumId || (album && (album.trackIds || []).includes(t.id))
    );

    const albumTombstones = [albumId, albumTitle.toLowerCase().trim(), titleKey, `key:${titleKey}`];
    albumTombstones.forEach((k) => {
      if (k && !this.removedAlbumIds.includes(k)) {
        this.removedAlbumIds.push(k);
      }
    });
    this.persistRemovedAlbums();

    this.publishedAlbums = this.publishedAlbums.filter((a) => a.id !== albumId && normalizeAlbumKey(a.title) !== titleKey);
    this.persistAlbums();

    this.crateFolders = this.crateFolders.filter((f) => f.id !== albumId && normalizeAlbumKey(f.name) !== titleKey);
    this.persistFolders();

    if (options.detachTracks) {
      // Detach tracks from album without deleting them
      this.publishedTracks = this.publishedTracks.map((t) => {
        if (t.albumId === albumId) {
          return { ...t, albumId: 'album-vault', albumTitle: 'Single Release / Vault Cuts' };
        }
        return t;
      });
      this.persistTracks();
      this.pushLocalChanges();
      this.notify();
      return { removedAlbumId: albumId, tracksAffected: matchingTracks.length };
    }

    // Cascade: permanently remove matching tracks
    matchingTracks.forEach((t) => {
      this.removeTrack(t.id, admin, reason);
    });

    MusicRecoveryService.removeAlbumToRecovery(albumTitle, matchingTracks, admin, { reason });
    this.pushLocalChanges();
    this.notify();
    return { removedAlbumId: albumId, tracksAffected: matchingTracks.length };
  }

  /**
   * Restores a track from recovery back to active catalog (lifts tombstones)
   */
  public restoreTrack(track: Track): void {
    const titleKey = normalizeAlbumKey(track.title);
    const artistKey = normalizeAlbumKey(track.artistName);
    const compositeKey = `key:${titleKey}:::${artistKey}`;

    // Lift tombstones for this restored track
    this.removedTrackIds = this.removedTrackIds.filter(
      (id) =>
        id !== track.id &&
        id !== compositeKey &&
        id !== titleKey &&
        id !== `title:${titleKey}`
    );
    this.persistRemoved();

    // Prepend to published list if not already present
    const exists = this.publishedTracks.some((t) => t.id === track.id);
    if (!exists) {
      this.publishedTracks.unshift(track);
      this.persistTracks();
    }

    this.pushLocalChanges();
    this.notify();
  }

  public getCrateAnalytics(): CrateAnalyticsRecord[] {
    const crates = OFFICIAL_CRATES;
    const events = AnalyticsEngine.getEvents();

    return crates.map((c) => {
      const tracks = this.getTracksByCrate(c.id);

      // Real plays aggregated from actual tracks in crate + real telemetry events
      const trackPlayCounts = tracks.reduce((sum, t) => sum + (t.playCount || 0), 0);

      const matchingEvents = events.filter((e) => {
        const res = (e.resource || '').toLowerCase();
        const resId = e.resourceId || '';
        const crateIdNorm = c.id.toLowerCase();
        const crateNameNorm = c.name.toLowerCase();
        const matchesTrack = tracks.some((t) => t.id === resId || t.title.toLowerCase() === res);
        const matchesCrate = res.includes(crateIdNorm) || res.includes(crateNameNorm);
        return matchesTrack || matchesCrate;
      });

      const eventPlays = matchingEvents.filter((e) =>
        e.eventType === 'SONG_PLAY_STARTED' ||
        e.eventType === 'SONG_PLAY_COMPLETED' ||
        e.eventType === 'TRACK_PLAY' ||
        e.eventType === 'TRACK_STREAM'
      ).length;

      const totalPlays = trackPlayCounts + eventPlays;
      const uniqueListeners = new Set(
        matchingEvents.map((e) => e.userId || e.sessionId)
      ).size;

      const completedCount = matchingEvents.filter((e) => e.eventType === 'SONG_PLAY_COMPLETED').length;
      const completionRate = totalPlays > 0 && completedCount > 0
        ? Math.min(100, Math.round((completedCount / totalPlays) * 100))
        : totalPlays > 0 ? 100 : 0;

      const skips = matchingEvents.filter((e) => e.eventType === 'SONG_SKIPPED').length;
      const repeatPlays = matchingEvents.filter((e) => e.eventType === 'SONG_REPLAYED').length;

      // Real listening duration in hours calculated from actual audio track lengths played
      const totalSeconds = tracks.reduce((sum, t) => sum + (t.playCount || 0) * (t.duration || 180), 0) +
        eventPlays * 180;
      const memberListeningHours = Math.round((totalSeconds / 3600) * 10) / 10;

      return {
        crateId: c.id,
        crateName: c.name,
        totalPlays,
        uniqueListeners: uniqueListeners || (totalPlays > 0 ? 1 : 0),
        completionRate,
        skips,
        repeatPlays,
        memberListeningHours,
        trend: totalPlays > 0 ? 'up' : 'neutral',
        trendPercent: totalPlays > 0 ? 100 : 0,
      };
    });
  }

  /**
   * Universal search across all active tracks in the catalog.
   * Matches composite artist + title, multi-token keywords, and ranks by relevance.
   */
  public searchTracks(query: string): Track[] {
    return filterAndRankTracks(this.getAllTracks(), query);
  }
}

export const MusicCatalogService = new MusicCatalogServiceClass();
