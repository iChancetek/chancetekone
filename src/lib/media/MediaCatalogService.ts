import { Audiobook, Video, PodcastEpisode } from '@/types/media';
import { MOCK_AUDIOBOOKS, MOCK_VIDEOS } from '@/lib/mockData';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { EngagementMetricsService } from '@/lib/analytics/EngagementMetricsService';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import { ChangeTracker, mergeWithRemote } from '@/lib/catalog/catalogMerge';
import {
  prepareAudiobookDoc,
  preparePodcastDoc,
  prepareVideoDoc,
} from '@/lib/catalog/catalogAssets';
import { CatalogCollection, CatalogDoc, CatalogOp, CatalogSnapshot } from '@/lib/catalog/cloudShared';

const CUSTOM_AUDIOBOOKS_KEY = 'spades_custom_audiobooks_v1';
const CUSTOM_VIDEOS_KEY = 'spades_custom_videos_v1';
const CUSTOM_PODCASTS_KEY = 'spades_custom_podcasts_v1';

const REMOVED_AUDIOBOOKS_KEY = 'spades_removed_audiobooks_v1';
const REMOVED_VIDEOS_KEY = 'spades_removed_videos_v1';
const REMOVED_PODCASTS_KEY = 'spades_removed_podcasts_v1';

export const SEED_PODCASTS: PodcastEpisode[] = [
  {
    id: 'podcast-ep-1',
    title: 'Episode 1: The Architecture of Agentic AI & Sonic Systems',
    showTitle: 'ChanceTEK Masterminds Podcast',
    host: 'Chancellor @ ChanceTEK LLC',
    description: 'Deep dive into autonomous agentic pipelines, MCP protocol integration, 12-bit hardware samplers, and the future of cultural media sovereignty.',
    mediaUrl: '/audio/Agentic AI.mp3',
    mediaType: 'audio',
    coverUrl: '/images/audiobooks/agentic_ai.jpg',
    duration: 1840,
    releaseDate: '2026-03-01',
    category: 'Technology & AI',
    playCount: 0,
    likeCount: 0,
  },
  {
    id: 'podcast-ep-2',
    title: 'Episode 2: The SP-1200 Concrete Era & Turntable Science',
    showTitle: 'ChanceTEK One Crate Talk',
    host: 'The Crate Diggers & Chancellor',
    description: 'Exploring the genesis of 12-bit sampling, chop techniques, classic funk drum breaks, and the culture of unreleased acetate test pressings.',
    mediaUrl: '/audio/Fort Apache.mp3',
    mediaType: 'audio',
    coverUrl: '/images/genres/hip-hop.jpg',
    duration: 2150,
    releaseDate: '2026-03-08',
    category: 'Music Culture',
    playCount: 0,
    likeCount: 0,
  },
  {
    id: 'podcast-ep-3',
    title: 'Episode 3: Visual Cinema, CyneMora & Cultural Storytelling',
    showTitle: 'ChanceTEK Visual Cinema Hour',
    host: 'Chancellor @ ChanceTEK LLC',
    description: 'An episodic exploration of high-definition cinema, architectural spatial rendering, and the creative vision behind CyneMora and The Famio.',
    mediaUrl: '/videos/CyneMora221.mp4',
    mediaType: 'video',
    coverUrl: '/images/chancetek_banner.png',
    duration: 980,
    releaseDate: '2026-03-15',
    category: 'Film & Visual Arts',
    playCount: 0,
    likeCount: 0,
  },
];

class MediaCatalogServiceClass {
  private customAudiobooks: Audiobook[] = [];
  private customVideos: Video[] = [];
  private customPodcasts: PodcastEpisode[] = [];

  private removedAudiobookIds: string[] = [];
  private removedVideoIds: string[] = [];
  private removedPodcastIds: string[] = [];

  private listeners: Set<() => void> = new Set();

  // ── Shared cloud catalog state ──
  private audiobookChanges = new ChangeTracker<Audiobook>();
  private videoChanges = new ChangeTracker<Video>();
  private podcastChanges = new ChangeTracker<PodcastEpisode>();
  private removedChanges = new ChangeTracker<{ id: string }>();
  private applyingCloud = false;
  private selfNotifying = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadState();
      window.addEventListener('storage', (e) => {
        if (
          e.key === CUSTOM_AUDIOBOOKS_KEY ||
          e.key === CUSTOM_VIDEOS_KEY ||
          e.key === CUSTOM_PODCASTS_KEY ||
          e.key === REMOVED_AUDIOBOOKS_KEY ||
          e.key === REMOVED_VIDEOS_KEY ||
          e.key === REMOVED_PODCASTS_KEY
        ) {
          this.loadState();
          this.notify();
        }
      });
      window.addEventListener('media-catalog-updated', () => {
        if (this.selfNotifying) return;
        this.loadState();
      });
      this.initCloud();
    }
  }

  /* ───────────────────── Shared cloud catalog (Firestore) ───────────────────── */

  private initCloud() {
    CloudCatalogClient.registerPreparer('audiobooks', prepareAudiobookDoc, (_o, p) =>
      this.onPrepared('audiobooks', p)
    );
    CloudCatalogClient.registerPreparer('videos', prepareVideoDoc, (_o, p) =>
      this.onPrepared('videos', p)
    );
    CloudCatalogClient.registerPreparer('podcasts', preparePodcastDoc, (_o, p) =>
      this.onPrepared('podcasts', p)
    );
    this.resetCloudBaselines();
    CloudCatalogClient.subscribe((snap) => this.applyCloudSnapshot(snap));
    CloudCatalogClient.start();
  }

  private removedTombstones(): { id: string; kind: string }[] {
    return [
      ...this.removedAudiobookIds.map((id) => ({ id: `audiobook:${id}`, kind: 'audiobook' })),
      ...this.removedVideoIds.map((id) => ({ id: `video:${id}`, kind: 'video' })),
      ...this.removedPodcastIds.map((id) => ({ id: `podcast:${id}`, kind: 'podcast' })),
    ];
  }

  private resetCloudBaselines() {
    this.audiobookChanges.reset(this.customAudiobooks);
    this.videoChanges.reset(this.customVideos);
    this.podcastChanges.reset(this.customPodcasts);
    this.removedChanges.reset(this.removedTombstones());
  }

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

    collect('audiobooks', this.audiobookChanges, this.customAudiobooks);
    collect('videos', this.videoChanges, this.customVideos);
    collect('podcasts', this.podcastChanges, this.customPodcasts);
    collect('removed', this.removedChanges, this.removedTombstones());

    if (ops.length > 0) CloudCatalogClient.enqueue(ops);
  }

  private applyCloudSnapshot(snap: CatalogSnapshot) {
    const writer = CloudCatalogClient.isWriter();
    const hasCloudData =
      snap.revision > 0 ||
      Object.values(snap.collections || {}).some((col) => Array.isArray(col) && col.length > 0);
    if (!hasCloudData && !writer) return;

    this.applyingCloud = true;
    const ops: CatalogOp[] = [];
    try {
      const c = snap.collections;
      const removedOf = (prefix: string) =>
        (c.removed as CatalogDoc[]).filter((r) => r.id.startsWith(prefix)) as unknown as {
          id: string;
          kind: string;
        }[];
      const localRemoved = this.removedTombstones();

      const audiobooks = mergeWithRemote<Audiobook>({
        seenKey: 'media_audiobooks',
        local: this.customAudiobooks,
        remote: c.audiobooks as unknown as Audiobook[],
        writer,
      });
      const videos = mergeWithRemote<Video>({
        seenKey: 'media_videos',
        local: this.customVideos,
        remote: c.videos as unknown as Video[],
        writer,
      });
      const podcasts = mergeWithRemote<PodcastEpisode>({
        seenKey: 'media_podcasts',
        local: this.customPodcasts,
        remote: c.podcasts as unknown as PodcastEpisode[],
        writer,
      });
      const rmAb = mergeWithRemote({
        seenKey: 'media_removed_audiobooks',
        local: localRemoved.filter((r) => r.kind === 'audiobook'),
        remote: removedOf('audiobook:'),
        writer,
      });
      const rmVid = mergeWithRemote({
        seenKey: 'media_removed_videos',
        local: localRemoved.filter((r) => r.kind === 'video'),
        remote: removedOf('video:'),
        writer,
      });
      const rmPod = mergeWithRemote({
        seenKey: 'media_removed_podcasts',
        local: localRemoved.filter((r) => r.kind === 'podcast'),
        remote: removedOf('podcast:'),
        writer,
      });

      this.removedAudiobookIds = rmAb.merged.map((r) => r.id.slice('audiobook:'.length));
      this.removedVideoIds = rmVid.merged.map((r) => r.id.slice('video:'.length));
      this.removedPodcastIds = rmPod.merged.map((r) => r.id.slice('podcast:'.length));

      // A cloud tombstone always beats a stale local copy.
      const rmAbSet = new Set(this.removedAudiobookIds);
      const rmVidSet = new Set(this.removedVideoIds);
      const rmPodSet = new Set(this.removedPodcastIds);
      this.customAudiobooks = audiobooks.merged.filter((x) => !rmAbSet.has(x.id));
      this.customVideos = videos.merged.filter((x) => !rmVidSet.has(x.id));
      this.customPodcasts = podcasts.merged.filter((x) => !rmPodSet.has(x.id));

      this.resetCloudBaselines();
      this.persist();

      if (writer) {
        const pending = <T extends { id: string }>(collection: CatalogCollection, items: T[]) =>
          items.forEach((item) =>
            ops.push({ collection, op: 'set', id: item.id, data: item as unknown as Record<string, any> })
          );
        pending('audiobooks', audiobooks.toUpload.filter((x) => !rmAbSet.has(x.id)));
        pending('videos', videos.toUpload.filter((x) => !rmVidSet.has(x.id)));
        pending('podcasts', podcasts.toUpload.filter((x) => !rmPodSet.has(x.id)));
        pending('removed', [...rmAb.toUpload, ...rmVid.toUpload, ...rmPod.toUpload]);
      }
    } catch (err) {
      console.warn('[MediaCatalogService] Failed to apply cloud catalog:', err);
    } finally {
      this.applyingCloud = false;
    }

    if (ops.length > 0) CloudCatalogClient.enqueue(ops);
    this.notify();
  }

  /** After local media was uploaded, swap in the durable cloud URLs. */
  private onPrepared(kind: 'audiobooks' | 'videos' | 'podcasts', prepared: CatalogDoc) {
    const list: any[] =
      kind === 'audiobooks'
        ? this.customAudiobooks
        : kind === 'videos'
          ? this.customVideos
          : this.customPodcasts;
    const idx = list.findIndex((x) => x.id === prepared.id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...prepared };
    if (kind === 'audiobooks') this.audiobookChanges.accept(list[idx]);
    else if (kind === 'videos') this.videoChanges.accept(list[idx]);
    else this.podcastChanges.accept(list[idx]);
    this.applyingCloud = true;
    try {
      this.persist();
    } finally {
      this.applyingCloud = false;
    }
    this.notify();
  }

  private loadState() {
    if (typeof window === 'undefined') return;
    try {
      const savedAudiobooks = localStorage.getItem(CUSTOM_AUDIOBOOKS_KEY);
      if (savedAudiobooks) {
        this.customAudiobooks = JSON.parse(savedAudiobooks);
      }

      const savedVideos = localStorage.getItem(CUSTOM_VIDEOS_KEY);
      if (savedVideos) {
        this.customVideos = JSON.parse(savedVideos);
      }

      const savedPodcasts = localStorage.getItem(CUSTOM_PODCASTS_KEY);
      if (savedPodcasts) {
        this.customPodcasts = JSON.parse(savedPodcasts);
      }

      const savedRemovedAb = localStorage.getItem(REMOVED_AUDIOBOOKS_KEY);
      if (savedRemovedAb) {
        this.removedAudiobookIds = JSON.parse(savedRemovedAb);
      }

      const savedRemovedVid = localStorage.getItem(REMOVED_VIDEOS_KEY);
      if (savedRemovedVid) {
        this.removedVideoIds = JSON.parse(savedRemovedVid);
      }

      const savedRemovedPod = localStorage.getItem(REMOVED_PODCASTS_KEY);
      if (savedRemovedPod) {
        this.removedPodcastIds = JSON.parse(savedRemovedPod);
      }
    } catch (e) {
      console.warn('Failed to load media catalog state:', e);
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CUSTOM_AUDIOBOOKS_KEY, JSON.stringify(this.customAudiobooks));
      localStorage.setItem(CUSTOM_VIDEOS_KEY, JSON.stringify(this.customVideos));
      localStorage.setItem(CUSTOM_PODCASTS_KEY, JSON.stringify(this.customPodcasts));

      localStorage.setItem(REMOVED_AUDIOBOOKS_KEY, JSON.stringify(this.removedAudiobookIds));
      localStorage.setItem(REMOVED_VIDEOS_KEY, JSON.stringify(this.removedVideoIds));
      localStorage.setItem(REMOVED_PODCASTS_KEY, JSON.stringify(this.removedPodcastIds));
    } catch (e) {
      console.warn('Failed to persist media catalog state:', e);
    }
    this.pushLocalChanges();
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('MediaCatalogService listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      this.selfNotifying = true;
      try {
        window.dispatchEvent(new CustomEvent('media-catalog-updated'));
      } finally {
        this.selfNotifying = false;
      }
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // Audiobooks
  public getAllAudiobooks(): Audiobook[] {
    const customMap = new Map<string, Audiobook>();
    this.customAudiobooks.forEach((ab) => customMap.set(ab.id, ab));
    const combined = [...this.customAudiobooks];
    MOCK_AUDIOBOOKS.forEach((ab) => {
      if (!customMap.has(ab.id)) {
        combined.push(ab);
      }
    });
    return combined
      .filter((ab) => {
        const titleKey = `title:${(ab.title || '').toLowerCase().trim()}`;
        return !this.removedAudiobookIds.includes(ab.id) && !this.removedAudiobookIds.includes(titleKey);
      })
      .map((ab) => ({
        ...ab,
        likeCount: EngagementMetricsService.getLikeCount(ab.id),
      }));
  }

  public getAudiobookById(id: string): Audiobook | undefined {
    return this.getAllAudiobooks().find((ab) => ab.id === id);
  }

  public addAudiobook(audiobook: Audiobook): void {
    const titleKey = `title:${(audiobook.title || '').toLowerCase().trim()}`;
    this.customAudiobooks.unshift(audiobook);
    this.removedAudiobookIds = this.removedAudiobookIds.filter((id) => id !== audiobook.id && id !== titleKey);
    this.persist();
    this.notify();
  }

  public removeAudiobook(
    id: string,
    adminActor?: { id?: string; name?: string; email?: string; role?: string },
    reason?: string,
    options?: { exactIdOnly?: boolean }
  ): boolean {
    const item = this.getAllAudiobooks().find((a) => a.id === id);
    if (!item) return false;

    const exactIdOnly = options?.exactIdOnly === true;
    const titleKey = `title:${(item.title || '').toLowerCase().trim()}`;
    this.customAudiobooks = this.customAudiobooks.filter((a) => a.id !== id);
    if (!this.removedAudiobookIds.includes(id)) {
      this.removedAudiobookIds.push(id);
    }
    if (!exactIdOnly && !this.removedAudiobookIds.includes(titleKey)) {
      this.removedAudiobookIds.push(titleKey);
    }
    this.persist();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || adminActor?.email || 'Platform Administrator',
      adminRole: 'admin',
      eventType: 'AUDIOBOOK_DELETED',
      action: `Deleted audiobook "${item.title}" by ${item.author} from the live platform`,
      resource: 'Audiobook Catalog',
      resourceId: id,
      previousValue: {
        title: item.title,
        author: item.author,
        narrator: item.narrator,
      },
      newValue: {
        status: 'DELETED_FROM_PLATFORM',
        deletedAt: new Date().toISOString(),
        deletedBy: adminActor?.name || 'Admin',
        reason: reason || 'Deleted from platform by administrator',
      },
      status: 'SUCCESS',
    });

    this.notify();
    return true;
  }

  // Videos
  public getAllVideos(): Video[] {
    const customMap = new Map<string, Video>();
    this.customVideos.forEach((v) => customMap.set(v.id, v));
    const combined = [...this.customVideos];
    MOCK_VIDEOS.forEach((v) => {
      if (!customMap.has(v.id)) {
        combined.push(v);
      }
    });
    return combined
      .filter((v) => {
        const titleKey = `title:${(v.title || '').toLowerCase().trim()}`;
        return !this.removedVideoIds.includes(v.id) && !this.removedVideoIds.includes(titleKey);
      })
      .map((v) => ({
        ...v,
        likeCount: EngagementMetricsService.getLikeCount(v.id),
      }));
  }

  public getVideoById(id: string): Video | undefined {
    return this.getAllVideos().find((v) => v.id === id);
  }

  public addVideo(video: Video): void {
    const titleKey = `title:${(video.title || '').toLowerCase().trim()}`;
    this.customVideos.unshift(video);
    this.removedVideoIds = this.removedVideoIds.filter((id) => id !== video.id && id !== titleKey);
    this.persist();
    this.notify();
  }

  public removeVideo(
    id: string,
    adminActor?: { id?: string; name?: string; email?: string; role?: string },
    reason?: string,
    options?: { exactIdOnly?: boolean }
  ): boolean {
    const item = this.getAllVideos().find((v) => v.id === id);
    if (!item) return false;

    const exactIdOnly = options?.exactIdOnly === true;
    const titleKey = `title:${(item.title || '').toLowerCase().trim()}`;
    this.customVideos = this.customVideos.filter((v) => v.id !== id);
    if (!this.removedVideoIds.includes(id)) {
      this.removedVideoIds.push(id);
    }
    if (!exactIdOnly && !this.removedVideoIds.includes(titleKey)) {
      this.removedVideoIds.push(titleKey);
    }
    this.persist();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || adminActor?.email || 'Platform Administrator',
      adminRole: 'admin',
      eventType: 'VIDEO_DELETED',
      action: `Deleted 4K video "${item.title}" from the live platform`,
      resource: 'Video Catalog',
      resourceId: id,
      previousValue: {
        title: item.title,
        artist: item.artistName,
        category: item.category,
      },
      newValue: {
        status: 'DELETED_FROM_PLATFORM',
        deletedAt: new Date().toISOString(),
        deletedBy: adminActor?.name || 'Admin',
        reason: reason || 'Deleted from platform by administrator',
      },
      status: 'SUCCESS',
    });

    this.notify();
    return true;
  }

  // Podcasts
  public getAllPodcasts(): PodcastEpisode[] {
    const customMap = new Map<string, PodcastEpisode>();
    this.customPodcasts.forEach((p) => customMap.set(p.id, p));
    const combined = [...this.customPodcasts];
    SEED_PODCASTS.forEach((p) => {
      if (!customMap.has(p.id)) {
        combined.push(p);
      }
    });
    return combined
      .filter((p) => {
        const titleKey = `title:${(p.title || '').toLowerCase().trim()}`;
        return !this.removedPodcastIds.includes(p.id) && !this.removedPodcastIds.includes(titleKey);
      })
      .map((p) => ({
        ...p,
        likeCount: EngagementMetricsService.getLikeCount(p.id),
      }));
  }

  public getPodcastById(id: string): PodcastEpisode | undefined {
    return this.getAllPodcasts().find((p) => p.id === id);
  }

  public addPodcast(podcast: PodcastEpisode): void {
    const titleKey = `title:${(podcast.title || '').toLowerCase().trim()}`;
    this.customPodcasts.unshift(podcast);
    this.removedPodcastIds = this.removedPodcastIds.filter((id) => id !== podcast.id && id !== titleKey);
    this.persist();
    this.notify();
  }

  public removePodcast(
    id: string,
    adminActor?: { id?: string; name?: string; email?: string; role?: string },
    reason?: string
  ): boolean {
    const item = this.getAllPodcasts().find((p) => p.id === id);
    if (!item) return false;

    const titleKey = `title:${(item.title || '').toLowerCase().trim()}`;
    this.customPodcasts = this.customPodcasts.filter((p) => p.id !== id);
    if (!this.removedPodcastIds.includes(id)) {
      this.removedPodcastIds.push(id);
    }
    if (!this.removedPodcastIds.includes(titleKey)) {
      this.removedPodcastIds.push(titleKey);
    }
    this.persist();

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || adminActor?.email || 'Platform Administrator',
      adminRole: 'admin',
      eventType: 'PODCAST_DELETED',
      action: `Deleted podcast episode "${item.title}" (${item.showTitle}) from the live platform`,
      resource: 'Podcast Catalog',
      resourceId: id,
      previousValue: {
        title: item.title,
        showTitle: item.showTitle,
        host: item.host,
      },
      newValue: {
        status: 'DELETED_FROM_PLATFORM',
        deletedAt: new Date().toISOString(),
        deletedBy: adminActor?.name || 'Admin',
        reason: reason || 'Deleted from platform by administrator',
      },
      status: 'SUCCESS',
    });

    this.notify();
    return true;
  }

  public isAudiobookPermanentlyRemoved(id?: string, title?: string): boolean {
    if (!id && !title) return false;
    if (id && this.removedAudiobookIds.includes(id)) return true;
    if (title) {
      const titleKey = `title:${title.toLowerCase().trim()}`;
      if (this.removedAudiobookIds.includes(titleKey)) return true;
    }
    return false;
  }

  public isVideoPermanentlyRemoved(id?: string, title?: string): boolean {
    if (!id && !title) return false;
    if (id && this.removedVideoIds.includes(id)) return true;
    if (title) {
      const titleKey = `title:${title.toLowerCase().trim()}`;
      if (this.removedVideoIds.includes(titleKey)) return true;
    }
    return false;
  }

  public isPodcastPermanentlyRemoved(id?: string, title?: string): boolean {
    if (!id && !title) return false;
    if (id && this.removedPodcastIds.includes(id)) return true;
    if (title) {
      const titleKey = `title:${title.toLowerCase().trim()}`;
      if (this.removedPodcastIds.includes(titleKey)) return true;
    }
    return false;
  }
}

export const MediaCatalogService = new MediaCatalogServiceClass();
