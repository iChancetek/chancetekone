/**
 * ChanceTEK One — Profile Media Storage Service
 * Stores user profile photos and looping profile videos (up to 50MB) in IndexedDB.
 * Bypasses localStorage 5MB quota restrictions and provides instant object URLs.
 */

const DB_NAME = 'chancetek_profile_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'media_vault';

export interface StoredProfileMedia {
  userId: string;
  type: 'image' | 'video';
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  blob: Blob;
  updatedAt: number;
}

class ProfileMediaStorageServiceClass {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, { objectUrl: string; type: 'image' | 'video' }> = new Map();

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB is only available in browser environments'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);

          req.onupgradeneeded = (evt) => {
            const db = (evt.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
            }
          };

          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('Failed to open profile media database'));
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Save a user's profile photo or video (up to 50MB) into IndexedDB
   */
  public async saveProfileMedia(
    userId: string,
    file: File | Blob,
    type: 'image' | 'video',
    fileName: string = 'profile_media'
  ): Promise<{ objectUrl: string; type: 'image' | 'video' }> {
    const db = await this.getDB();

    // Revoke previous URL if any
    const prev = this.memoryCache.get(userId);
    if (prev?.objectUrl && prev.objectUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {}
    }

    const record: StoredProfileMedia = {
      userId,
      type,
      mimeType: file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileName,
      sizeBytes: file.size,
      blob: file,
      updatedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to store profile media'));
    });

    const objectUrl = URL.createObjectURL(file);
    const entry = { objectUrl, type };
    this.memoryCache.set(userId, entry);

    // Broadcast change across tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('chancetek_profile_media_channel');
        bc.postMessage({ type: 'PROFILE_MEDIA_UPDATED', userId, mediaType: type });
        bc.close();
      } catch {}
    }

    return entry;
  }

  /**
   * Load and retrieve a user's active profile media object URL from IndexedDB
   */
  public async getProfileMedia(
    userId: string
  ): Promise<{ objectUrl: string; type: 'image' | 'video' } | null> {
    if (this.memoryCache.has(userId)) {
      return this.memoryCache.get(userId)!;
    }

    try {
      const db = await this.getDB();
      const record = await new Promise<StoredProfileMedia | undefined>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(userId);

        req.onsuccess = () => resolve(req.result as StoredProfileMedia | undefined);
        req.onerror = () => reject(req.error);
      });

      if (!record || !record.blob) {
        return null;
      }

      const objectUrl = URL.createObjectURL(record.blob);
      const entry = { objectUrl, type: record.type };
      this.memoryCache.set(userId, entry);
      return entry;
    } catch (err) {
      console.warn('[ProfileMediaStorageService] Error loading media for', userId, err);
      return null;
    }
  }

  /**
   * Remove a user's profile media
   */
  public async clearProfileMedia(userId: string): Promise<void> {
    const prev = this.memoryCache.get(userId);
    if (prev?.objectUrl && prev.objectUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev.objectUrl);
      } catch {}
    }
    this.memoryCache.delete(userId);

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(userId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ProfileMediaStorageService] Failed to delete media', err);
    }
  }
}

export const ProfileMediaStorageService = new ProfileMediaStorageServiceClass();

