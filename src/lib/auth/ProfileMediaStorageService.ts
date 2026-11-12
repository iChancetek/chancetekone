/**
 * ChanceTEK One — Profile Media Storage Service
 * Stores user profile photos and looping profile videos (up to 50MB) in IndexedDB.
 * Bypasses localStorage 5MB quota restrictions and provides instant object URLs.
 */

const DB_NAME = 'chancetek_profile_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'media_vault';
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB

export interface StoredProfileMedia {
  userId: string;
  type: 'image' | 'video';
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  blob: Blob;
  updatedAt: number;
}

interface StoredMediaAlias {
  userId: string; // `email:${normalizedEmail}`
  aliasFor: string;
  updatedAt: number;
}

function inferMimeType(file: File | Blob, type: 'image' | 'video', fileName: string): string {
  if (file.type && file.type.trim()) return file.type;
  const lower = fileName.toLowerCase();
  if (type === 'video') {
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.m4v')) return 'video/x-m4v';
    if (lower.endsWith('.ogv') || lower.endsWith('.ogg')) return 'video/ogg';
    return 'video/mp4';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

class ProfileMediaStorageServiceClass {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, { objectUrl: string; type: 'image' | 'video' }> = new Map();

  private revokeLater(url?: string | null) {
    if (url && url.startsWith('blob:')) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 3000);
    }
  }

  public invalidateCache(userId: string) {
    const prev = this.memoryCache.get(userId);
    if (prev) {
      this.revokeLater(prev.objectUrl);
      this.memoryCache.delete(userId);
    }
  }

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

  private broadcastMediaEvent(payload: Record<string, unknown>) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('chancetek_profile_media_channel');
        bc.postMessage(payload);
        bc.close();
      } catch {}
    }
  }

  /**
   * Save a user's profile photo or video (up to 50MB) into IndexedDB
   */
  public async saveProfileMedia(
    userId: string,
    file: File | Blob,
    type: 'image' | 'video',
    fileName: string = 'profile_media',
    email?: string
  ): Promise<{ objectUrl: string; type: 'image' | 'video' }> {
    if (file.size > MAX_MEDIA_BYTES) {
      throw new Error(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 50MB.`
      );
    }

    const mimeType = inferMimeType(file, type, fileName);

    // Copy file bytes into an immutable Blob BEFORE opening IndexedDB transaction
    // so the browser never rejects File handles or times out an active IDB transaction.
    let persistentBlob: Blob = file;
    try {
      const buffer = await file.arrayBuffer();
      persistentBlob = new Blob([buffer], { type: mimeType });
    } catch {
      persistentBlob = file.slice(0, file.size, mimeType);
    }

    const db = await this.getDB();

    // Defer revoking previous URL so mounted <video> components never flash error during swap
    const prev = this.memoryCache.get(userId);
    if (prev) {
      this.revokeLater(prev.objectUrl);
    }

    const now = Date.now();
    const record: StoredProfileMedia = {
      userId,
      type,
      mimeType,
      fileName,
      sizeBytes: persistentBlob.size,
      blob: persistentBlob,
      updatedAt: now,
    };

    const emailKey = email?.trim() ? `email:${email.trim().toLowerCase()}` : null;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      if (emailKey) {
        const alias: StoredMediaAlias = { userId: emailKey, aliasFor: userId, updatedAt: now };
        store.put(alias);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to store profile media'));
      tx.onabort = () => reject(tx.error || new Error('Profile media write aborted'));
    });

    const objectUrl = URL.createObjectURL(persistentBlob);
    const entry = { objectUrl, type };
    this.memoryCache.set(userId, entry);

    this.broadcastMediaEvent({ type: 'PROFILE_MEDIA_UPDATED', userId, email, mediaType: type });

    return entry;
  }

  /**
   * Load and retrieve a user's active profile media object URL from IndexedDB
   */
  public async getProfileMedia(
    userId: string,
    email?: string,
    forceRefresh: boolean = false
  ): Promise<{ objectUrl: string; type: 'image' | 'video' } | null> {
    if (forceRefresh) {
      this.invalidateCache(userId);
    } else if (this.memoryCache.has(userId)) {
      return this.memoryCache.get(userId)!;
    }

    try {
      const db = await this.getDB();

      const readKey = (key: string) =>
        new Promise<StoredProfileMedia | StoredMediaAlias | undefined>((resolve, reject) => {
          const tx = db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result as any);
          req.onerror = () => reject(req.error);
        });

      let raw = await readKey(userId);

      // Fallback lookup by normalized email alias if signed in under another ID for same email
      if (!raw && email?.trim()) {
        const emailKey = `email:${email.trim().toLowerCase()}`;
        const aliasRec = await readKey(emailKey);
        if (aliasRec && 'aliasFor' in aliasRec && aliasRec.aliasFor) {
          raw = await readKey(aliasRec.aliasFor);
        }
      }

      if (!raw || !('blob' in raw) || !raw.blob) {
        return null;
      }

      const objectUrl = URL.createObjectURL(raw.blob);
      const entry = { objectUrl, type: raw.type };
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
  public async clearProfileMedia(userId: string, email?: string): Promise<void> {
    this.invalidateCache(userId);

    const emailKey = email?.trim() ? `email:${email.trim().toLowerCase()}` : null;

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(userId);
        if (emailKey) {
          store.delete(emailKey);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ProfileMediaStorageService] Failed to delete media', err);
    }

    this.broadcastMediaEvent({ type: 'PROFILE_MEDIA_CLEARED', userId, email });
  }
}

export const ProfileMediaStorageService = new ProfileMediaStorageServiceClass();

