/**
 * ChanceTEKone — Music Recovery Vault & 45-Day Quarantine Service
 * Admin authority governance for soft-deleting music, songs, and albums.
 * Enforces a strict 45-day rolling recovery window before permanent destruction.
 * Integrates with Agentic AI Audit Trail to log all uploads, removals, and restorations.
 */

import { Track } from '@/types/media';
import { AdminRole } from '@/types/admin';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { OFFICIAL_CRATES } from '@/types/catalog';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';

export interface RecoverableMusicItem {
  id: string;
  originalTrackId: string;
  itemType: 'track' | 'album' | 'song';
  track: Track;
  removedAt: string; // ISO date/time of removal
  expiresAt: string; // ISO date/time (removedAt + 45 days)
  daysRemaining: number; // 0 to 45
  removedByAdminId: string;
  removedByAdminName: string;
  removedByAdminRole: AdminRole;
  originalCrateId: string;
  originalCrateName: string;
  originalFolderId?: string;
  originalFolderName?: string;
  uploadedAt: string;
  uploadedByAdminName: string;
  uploadedByAdminId?: string;
  reason?: string;
}

const RECOVERY_STORAGE_KEY = 'spades_music_recovery_vault_v1';
export const RETENTION_DAYS = 45;
const FORTY_FIVE_DAYS_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const SEED_RECOVERY_ITEMS: RecoverableMusicItem[] = [];

class MusicRecoveryServiceClass {
  private recoveryItems: RecoverableMusicItem[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadRecoveryVault();
    }
  }

  private loadRecoveryVault() {
    try {
      const saved = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strictly purge synthetic seed deletions so only authentic removed items appear
          const realItems = parsed.filter((it: any) => it && !it.id?.startsWith('rec-init-'));
          this.recoveryItems = this.recalculateDaysRemaining(realItems);
          this.persistRecoveryVault();
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load music recovery vault from storage:', e);
    }

    this.recoveryItems = [];
    this.persistRecoveryVault();
  }

  private persistRecoveryVault() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(this.recoveryItems));
    } catch (e) {
      console.warn('Failed to persist recovery vault to localStorage:', e);
    }
  }

  private recalculateDaysRemaining(items: RecoverableMusicItem[]): RecoverableMusicItem[] {
    const now = Date.now();
    return items.map((it) => {
      const expiresTime = new Date(it.expiresAt).getTime();
      const diffMs = expiresTime - now;
      const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return {
        ...it,
        daysRemaining: days,
      };
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Recovery service listener error:', err);
      }
    });
  }

  public getRecoveryItems(): RecoverableMusicItem[] {
    return this.recalculateDaysRemaining(this.recoveryItems);
  }

  public getRecoveryCount(): number {
    return this.recoveryItems.length;
  }

  /**
   * Moves a single track to the 45-day recovery vault
   */
  public moveToRecovery(
    track: Track,
    admin: { id?: string; name?: string; role?: AdminRole },
    options?: {
      crateId?: string;
      crateName?: string;
      folderId?: string;
      folderName?: string;
      reason?: string;
    }
  ): RecoverableMusicItem {
    const now = new Date();
    const removedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + FORTY_FIVE_DAYS_MS).toISOString();

    const crate = OFFICIAL_CRATES.find((c) => c.id === options?.crateId) || OFFICIAL_CRATES[0];
    const adminName = admin.name || 'Administrator';
    const adminId = admin.id || 'admin-usr';
    const adminRole: AdminRole = admin.role || 'admin';

    const recoveryItem: RecoverableMusicItem = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalTrackId: track.id,
      itemType: 'track',
      track: { ...track },
      removedAt,
      expiresAt,
      daysRemaining: RETENTION_DAYS,
      removedByAdminId: adminId,
      removedByAdminName: adminName,
      removedByAdminRole: adminRole,
      originalCrateId: options?.crateId || crate.id,
      originalCrateName: options?.crateName || crate.name,
      originalFolderId: options?.folderId || track.albumId,
      originalFolderName: options?.folderName || track.albumTitle || 'Master Collection',
      uploadedAt: track.uploadedAt || new Date(Date.now() - 7 * 86400000).toISOString(),
      uploadedByAdminName: track.uploadedByAdminName || 'Chancellor (Admin)',
      uploadedByAdminId: track.uploadedByAdminId || 'usr-chancellor',
      reason: options?.reason || 'Removed by authorized administrator into 45-day recovery area',
    };

    this.recoveryItems.unshift(recoveryItem);
    this.persistRecoveryVault();

    // Log to Immutable Audit Trail with explicit date, time, admin name and track info
    AuditLogger.logAction({
      adminId,
      adminName,
      adminRole,
      eventType: 'MUSIC_REMOVED',
      action: `Admin "${adminName}" removed song "${track.title}" by "${track.artistName}" (Album: "${track.albumTitle || 'Vault'}") — quarantined in 45-day Recovery Vault (auto-expires ${new Date(expiresAt).toLocaleDateString()})`,
      resource: '45-Day Recovery Vault',
      resourceId: track.id,
      previousValue: {
        title: track.title,
        artist: track.artistName,
        album: track.albumTitle,
        crate: recoveryItem.originalCrateName,
        duration: track.duration,
        uploadedAt: recoveryItem.uploadedAt,
        uploadedBy: recoveryItem.uploadedByAdminName,
      },
      newValue: {
        quarantineStatus: 'IN_RECOVERY_VAULT',
        removedAt,
        expiresAt,
        retentionDays: RETENTION_DAYS,
        removedBy: adminName,
        reason: recoveryItem.reason,
      },
      status: 'WARNING',
      details: `Music quarantined under 45-day retention policy. Authority held by ${adminName}.`,
    });

    this.notify();
    return recoveryItem;
  }

  /**
   * Removes an entire album or collection to recovery
   */
  public removeAlbumToRecovery(
    albumTitle: string,
    tracks: Track[],
    admin: { id?: string; name?: string; role?: AdminRole },
    options?: {
      crateId?: string;
      crateName?: string;
      folderId?: string;
      reason?: string;
    }
  ): RecoverableMusicItem[] {
    const adminName = admin.name || 'Administrator';
    const adminId = admin.id || 'admin-usr';
    const adminRole: AdminRole = admin.role || 'admin';
    const now = new Date();
    const removedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + FORTY_FIVE_DAYS_MS).toISOString();

    const createdItems: RecoverableMusicItem[] = [];

    tracks.forEach((track) => {
      const recItem: RecoverableMusicItem = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        originalTrackId: track.id,
        itemType: 'album',
        track: { ...track },
        removedAt,
        expiresAt,
        daysRemaining: RETENTION_DAYS,
        removedByAdminId: adminId,
        removedByAdminName: adminName,
        removedByAdminRole: adminRole,
        originalCrateId: options?.crateId || 'golden-era-hip-hop',
        originalCrateName: options?.crateName || 'Master Vault',
        originalFolderId: options?.folderId || track.albumId,
        originalFolderName: albumTitle,
        uploadedAt: track.uploadedAt || new Date(Date.now() - 7 * 86400000).toISOString(),
        uploadedByAdminName: track.uploadedByAdminName || adminName,
        uploadedByAdminId: track.uploadedByAdminId || adminId,
        reason: options?.reason || `Whole album collection "${albumTitle}" removed into 45-day recovery vault`,
      };

      createdItems.push(recItem);
      this.recoveryItems.unshift(recItem);
    });

    this.persistRecoveryVault();

    AuditLogger.logAction({
      adminId,
      adminName,
      adminRole,
      eventType: 'ALBUM_REMOVED',
      action: `Admin "${adminName}" removed entire album "${albumTitle}" (${tracks.length} songs) — transferred to 45-day Recovery Vault`,
      resource: '45-Day Recovery Vault',
      resourceId: albumTitle,
      previousValue: {
        albumTitle,
        songsCount: tracks.length,
        songs: tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artistName })),
      },
      newValue: {
        quarantineStatus: 'ALBUM_IN_RECOVERY_VAULT',
        removedAt,
        expiresAt,
        retentionDays: RETENTION_DAYS,
        removedBy: adminName,
      },
      status: 'WARNING',
      details: `Album collection moved to 45-day recovery area with full restore capability.`,
    });

    this.notify();
    return createdItems;
  }

  /**
   * Restores a track from recovery back to the active platform catalog
   */
  public restoreItem(
    recoveryId: string,
    admin: { id?: string; name?: string; role?: AdminRole }
  ): RecoverableMusicItem | null {
    const idx = this.recoveryItems.findIndex((it) => it.id === recoveryId);
    if (idx === -1) return null;

    const [item] = this.recoveryItems.splice(idx, 1);
    this.persistRecoveryVault();

    const adminName = admin.name || 'Administrator';
    const adminId = admin.id || 'admin-usr';
    const adminRole: AdminRole = admin.role || 'admin';

    AuditLogger.logAction({
      adminId,
      adminName,
      adminRole,
      eventType: 'MUSIC_RESTORED',
      action: `Admin "${adminName}" restored song "${item.track.title}" by "${item.track.artistName}" from 45-day Recovery Vault back to active crate "${item.originalCrateName}"`,
      resource: '45-Day Recovery Vault',
      resourceId: item.track.id,
      previousValue: {
        recoveryId: item.id,
        removedAt: item.removedAt,
        removedBy: item.removedByAdminName,
      },
      newValue: {
        restoredAt: new Date().toISOString(),
        restoredBy: adminName,
        restoredCrate: item.originalCrateName,
        trackId: item.track.id,
      },
      status: 'SUCCESS',
      details: 'Restored from 45-day quarantine with full audio integrity and metadata.',
    });

    this.notify();
    return item;
  }

  /**
   * Permanently purges a track from recovery (irreversible)
   */
  public permanentlyPurge(
    recoveryId: string,
    admin: { id?: string; name?: string; role?: AdminRole }
  ): boolean {
    const idx = this.recoveryItems.findIndex((it) => it.id === recoveryId);
    if (idx === -1) return false;

    const [item] = this.recoveryItems.splice(idx, 1);
    this.persistRecoveryVault();

    // Remove from client binary storage if present
    if (typeof window !== 'undefined') {
      AudioStorageService.deleteAudio(item.track.id);
    }

    const adminName = admin.name || 'Administrator';
    const adminId = admin.id || 'admin-usr';
    const adminRole: AdminRole = admin.role || 'admin';

    AuditLogger.logAction({
      adminId,
      adminName,
      adminRole,
      eventType: 'MUSIC_PERMANENTLY_PURGED',
      action: `Admin "${adminName}" permanently purged song "${item.track.title}" by "${item.track.artistName}" from platform storage`,
      resource: '45-Day Recovery Vault',
      resourceId: item.track.id,
      previousValue: {
        recoveryId: item.id,
        title: item.track.title,
        artist: item.track.artistName,
        album: item.track.albumTitle,
        removedAt: item.removedAt,
        removedBy: item.removedByAdminName,
      },
      newValue: {
        purgedAt: new Date().toISOString(),
        purgedBy: adminName,
        status: 'PERMANENTLY_DESTROYED',
      },
      status: 'FAILED',
      details: 'Irreversible deletion performed by authorized administrator.',
    });

    this.notify();
    return true;
  }

  /**
   * Restores multiple items in batch
   */
  public batchRestore(
    recoveryIds: string[],
    admin: { id?: string; name?: string; role?: AdminRole }
  ): RecoverableMusicItem[] {
    const restored: RecoverableMusicItem[] = [];
    recoveryIds.forEach((id) => {
      const item = this.restoreItem(id, admin);
      if (item) restored.push(item);
    });
    return restored;
  }

  /**
   * Purges multiple items in batch
   */
  public batchPurge(
    recoveryIds: string[],
    admin: { id?: string; name?: string; role?: AdminRole }
  ): number {
    let count = 0;
    recoveryIds.forEach((id) => {
      if (this.permanentlyPurge(id, admin)) count++;
    });
    return count;
  }
}

export const MusicRecoveryService = new MusicRecoveryServiceClass();
