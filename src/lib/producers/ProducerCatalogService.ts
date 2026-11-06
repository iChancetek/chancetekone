import { Producer } from '@/types/media';
import { MOCK_PRODUCERS } from '@/lib/mockData';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import { ChangeTracker, mergeWithRemote } from '@/lib/catalog/catalogMerge';
import { CatalogDoc, CatalogOp, CatalogSnapshot } from '@/lib/catalog/cloudShared';

const REMOVED_PRODUCERS_KEY = 'spades_removed_producers_v1';
const PRODUCERS_STORAGE_KEY = 'spades_custom_producers_v1';

class ProducerCatalogServiceClass {
  private customProducers: Producer[] = [];
  private removedProducerIds: string[] = [];
  private listeners: Set<() => void> = new Set();
  private removedChanges = new ChangeTracker<{ id: string }>();
  private applyingCloud = false;

  constructor() {
    this.loadState();
    if (typeof window !== 'undefined') {
      this.removedChanges.reset(this.tombstones());
      CloudCatalogClient.subscribe((snap) => this.applyCloudSnapshot(snap));
      CloudCatalogClient.start();
    }
  }

  private tombstones(): { id: string; kind: string }[] {
    return this.removedProducerIds.map((id) => ({ id: `producer:${id}`, kind: 'producer' }));
  }

  private pushLocalChanges() {
    if (this.applyingCloud || !CloudCatalogClient.isWriter()) return;
    const { upserts, deletes } = this.removedChanges.diff(this.tombstones());
    const ops: CatalogOp[] = [
      ...upserts.map((t) => ({
        collection: 'removed' as const,
        op: 'set' as const,
        id: t.id,
        data: t as unknown as Record<string, any>,
      })),
      ...deletes.map((id) => ({ collection: 'removed' as const, op: 'delete' as const, id })),
    ];
    if (ops.length > 0) CloudCatalogClient.enqueue(ops);
  }

  private applyCloudSnapshot(snap: CatalogSnapshot) {
    const writer = CloudCatalogClient.isWriter();
    const hasCloudData =
      snap.revision > 0 ||
      Object.values(snap.collections || {}).some((col) => Array.isArray(col) && col.length > 0);
    if (!hasCloudData && !writer) return;

    this.applyingCloud = true;
    let toUpload: { id: string; kind: string }[] = [];
    try {
      const merged = mergeWithRemote<{ id: string; kind: string }>({
        seenKey: 'producers_removed',
        local: this.tombstones(),
        remote: (snap.collections.removed as CatalogDoc[]).filter((r) =>
          r.id.startsWith('producer:')
        ) as any,
        writer,
      });
      this.removedProducerIds = merged.merged.map((r) => r.id.slice('producer:'.length));
      toUpload = merged.toUpload;
      this.removedChanges.reset(this.tombstones());
      this.persist();
    } finally {
      this.applyingCloud = false;
    }

    if (writer && toUpload.length > 0) {
      CloudCatalogClient.enqueue(
        toUpload.map((t) => ({
          collection: 'removed' as const,
          op: 'set' as const,
          id: t.id,
          data: t as unknown as Record<string, any>,
        }))
      );
    }
    this.notify();
  }

  private loadState() {
    if (typeof window === 'undefined') return;
    try {
      const removed = localStorage.getItem(REMOVED_PRODUCERS_KEY);
      if (removed) {
        this.removedProducerIds = JSON.parse(removed);
      }

      const custom = localStorage.getItem(PRODUCERS_STORAGE_KEY);
      if (custom) {
        this.customProducers = JSON.parse(custom);
      }
    } catch (e) {
      console.warn('Failed to load producer catalog state:', e);
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(REMOVED_PRODUCERS_KEY, JSON.stringify(this.removedProducerIds));
      localStorage.setItem(PRODUCERS_STORAGE_KEY, JSON.stringify(this.customProducers));
    } catch (e) {
      console.warn('Failed to persist producer catalog state:', e);
    }
    this.pushLocalChanges();
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Producer listener error:', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('producers-updated'));
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Retrieves all active live producers
   */
  public getAllProducers(): Producer[] {
    const removedSet = new Set(this.removedProducerIds);
    const combined = [...this.customProducers, ...MOCK_PRODUCERS];
    const unique = new Map<string, Producer>();

    combined.forEach((p) => {
      if (!removedSet.has(p.id) && !unique.has(p.id)) {
        unique.set(p.id, p);
      }
    });

    return Array.from(unique.values());
  }

  public getProducerById(id: string): Producer | undefined {
    return this.getAllProducers().find((p) => p.id === id);
  }

  /**
   * Removes a producer from the live environment.
   * Optionally removes all songs and albums associated with this producer.
   */
  public removeProducer(
    producerId: string,
    adminActor?: { id?: string; name?: string; email?: string },
    reason: string = 'Removed from live platform by Administrator',
    removeAssociatedTracks: boolean = true
  ): boolean {
    const producer = this.getAllProducers().find((p) => p.id === producerId);
    if (!producer) return false;

    if (!this.removedProducerIds.includes(producerId)) {
      this.removedProducerIds.push(producerId);
      this.persist();
    }

    let removedTracksCount = 0;
    if (removeAssociatedTracks) {
      // Find all tracks associated with this producer (by artistId, artistName, or producer metadata)
      const allTracks = MusicCatalogService.getAllTracks();
      const producerNameNorm = producer.name.toLowerCase().trim();
      const associatedTracks = allTracks.filter(
        (t) =>
          t.artistId === producerId ||
          (t.artistName && t.artistName.toLowerCase().trim() === producerNameNorm) ||
          ((t as any).producer && (t as any).producer.toLowerCase().includes(producerNameNorm))
      );

      associatedTracks.forEach((t) => {
        MusicCatalogService.removeTrack(
          t.id,
          {
            id: adminActor?.id || 'usr-admin',
            name: adminActor?.name || adminActor?.email || 'Administrator',
            role: 'admin',
          },
          `Associated producer "${producer.name}" removed: ${reason}`
        );
        removedTracksCount++;
      });
    }

    AuditLogger.logAction({
      adminId: adminActor?.id || 'usr-admin',
      adminName: adminActor?.name || adminActor?.email || 'Administrator',
      adminRole: 'admin',
      eventType: 'PRODUCER_REMOVED_FROM_LIVE',
      action: `Admin removed producer "${producer.name}" (${producer.role}) from live environment`,
      resource: 'Producers Directory',
      resourceId: producer.id,
      newValue: {
        producerName: producer.name,
        role: producer.role,
        removedAt: new Date().toISOString(),
        reason,
        associatedTracksQuarantined: removedTracksCount,
      },
      status: 'SUCCESS',
      details: reason,
    });

    this.notify();
    return true;
  }

  /**
   * Restores a removed producer back to the live environment
   */
  public restoreProducer(producerId: string, adminActor?: { id?: string; name?: string }): boolean {
    if (this.removedProducerIds.includes(producerId)) {
      this.removedProducerIds = this.removedProducerIds.filter((id) => id !== producerId);
      this.persist();

      AuditLogger.logAction({
        adminId: adminActor?.id || 'usr-admin',
        adminName: adminActor?.name || 'Administrator',
        adminRole: 'admin',
        eventType: 'PRODUCER_RESTORED_TO_LIVE',
        action: `Admin restored producer ID "${producerId}" to live environment`,
        resource: 'Producers Directory',
        resourceId: producerId,
        status: 'SUCCESS',
      });

      this.notify();
      return true;
    }
    return false;
  }
}

export const ProducerCatalogService = new ProducerCatalogServiceClass();
