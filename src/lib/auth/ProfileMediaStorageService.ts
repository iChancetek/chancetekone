/**
 * ChanceTEK One — Profile Media Storage Service
 * Stores user profile photos and looping profile videos (up to 50MB) in IndexedDB.
 * Bypasses localStorage 5MB quota restrictions and provides instant object URLs.
 */

const DB_NAME = 'chancetek_profile_media_v1';
const DB_VERSION = 1;
const STORE_NAME = 'media_vault';
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB

// Module-level cache of durable remote HTTP(S)/API URLs keyed by userId and lowercase email
const durableRemoteUrlCache = new Map<string, { url: string; mediaType: 'image' | 'video'; updatedAt: number }>();

export interface StoredProfileMedia {
  userId: string;
  type: 'image' | 'video';
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  blob?: Blob;
  buffer?: ArrayBuffer;
  remoteUrl?: string;
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
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    const persistentBuffer = await persistentBlob.arrayBuffer().catch(() => undefined);

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
      buffer: persistentBuffer,
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

      let raw: StoredProfileMedia | null = null;
      const directRec = await readKey(userId);
      if (directRec && !('aliasFor' in directRec)) {
        raw = directRec as StoredProfileMedia;
      }

      // Check normalized email alias as well and keep whichever record has the latest timestamp
      if (email?.trim()) {
        const emailKey = `email:${email.trim().toLowerCase()}`;
        const aliasRec = await readKey(emailKey);
        if (aliasRec && 'aliasFor' in aliasRec && aliasRec.aliasFor) {
          const aliasTarget = await readKey(aliasRec.aliasFor);
          if (aliasTarget && !('aliasFor' in aliasTarget)) {
            const candidate = aliasTarget as StoredProfileMedia;
            if (!raw || (candidate.updatedAt || 0) > (raw.updatedAt || 0)) {
              raw = candidate;
            }
          }
        }
      }

      if (!raw) {
        return null;
      }

      let sourceBlob: Blob | null = null;
      if (raw.buffer instanceof ArrayBuffer && raw.buffer.byteLength > 0) {
        sourceBlob = new Blob([raw.buffer], {
          type: raw.mimeType || (raw.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        });
      } else if (raw.blob) {
        sourceBlob = raw.blob;
      }

      if (!sourceBlob) {
        return null;
      }

      if (raw.remoteUrl) {
        durableRemoteUrlCache.set(userId, {
          url: raw.remoteUrl,
          mediaType: raw.type,
          updatedAt: raw.updatedAt || Date.now(),
        });
        if (email?.trim()) {
          durableRemoteUrlCache.set(`email:${email.trim().toLowerCase()}`, {
            url: raw.remoteUrl,
            mediaType: raw.type,
            updatedAt: raw.updatedAt || Date.now(),
          });
        }
      }

      const objectUrl = URL.createObjectURL(sourceBlob);
      const entry = {
        objectUrl,
        type: raw.type,
        ...(raw.remoteUrl ? { remoteUrl: raw.remoteUrl } : {}),
      };
      this.memoryCache.set(userId, { objectUrl, type: raw.type });
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
        if (emailKey) {
          const aliasReq = store.get(emailKey);
          aliasReq.onsuccess = () => {
            const aliasRec = aliasReq.result as StoredMediaAlias | undefined;
            if (aliasRec?.aliasFor && aliasRec.aliasFor !== userId) {
              store.delete(aliasRec.aliasFor);
            }
            store.delete(emailKey);
          };
        }
        store.delete(userId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ProfileMediaStorageService] Failed to delete media', err);
    }

    durableRemoteUrlCache.delete(userId);
    if (email?.trim()) {
      durableRemoteUrlCache.delete(`email:${email.trim().toLowerCase()}`);
    }
    this.broadcastMediaEvent({ type: 'PROFILE_MEDIA_CLEARED', userId, email });
  }

  public getCachedRemoteUrl(userId: string, email?: string): string | undefined {
    const byId = durableRemoteUrlCache.get(userId);
    if (byId?.url) return byId.url;
    if (email?.trim()) {
      return durableRemoteUrlCache.get(`email:${email.trim().toLowerCase()}`)?.url;
    }
    return undefined;
  }

  public async attachRemoteUrl(
    userId: string,
    email: string | undefined,
    mediaType: 'image' | 'video',
    remoteUrl: string
  ): Promise<void> {
    if (!remoteUrl || remoteUrl.startsWith('blob:')) return;
    const now = Date.now();
    durableRemoteUrlCache.set(userId, { url: remoteUrl, mediaType, updatedAt: now });
    if (email?.trim()) {
      durableRemoteUrlCache.set(`email:${email.trim().toLowerCase()}`, {
        url: remoteUrl,
        mediaType,
        updatedAt: now,
      });
    }

    try {
      const db = await this.getDB();
      if (!db) return;
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(userId);
        req.onsuccess = () => {
          const rec = req.result as StoredProfileMedia | undefined;
          if (rec && !('aliasFor' in rec)) {
            store.put({ ...rec, remoteUrl, updatedAt: now });
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {}
  }

  private async buildAuthHeaders(userId?: string, email?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;
    if (email?.trim()) {
      const trimmed = email.trim();
      headers['x-user-email'] = trimmed;
      headers['x-admin-email'] = trimmed;
    }
    try {
      const { auth } = await import('@/lib/firebase/client');
      const fbUser = auth?.currentUser;
      if (fbUser) {
        const token = await fbUser.getIdToken().catch(() => null);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (fbUser.email && !headers['x-user-email']) {
          headers['x-user-email'] = fbUser.email;
          headers['x-admin-email'] = fbUser.email;
        }
      }
    } catch {}
    return headers;
  }

  public async uploadDurableProfileMedia(args: {
    userId: string;
    email?: string;
    file: File;
    mediaType: 'image' | 'video';
  }): Promise<{
    url: string;
    mediaType: 'image' | 'video';
    storageBackend: 'firebase' | 'disk' | 'firebase-client';
  }> {
    const SERVER_SAFE_BYTES = 28 * 1024 * 1024; // Avoid Cloud Run 32MiB ingress ceiling in prod
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    let serverError: Error | null = null;

    // Path A: Server API (/api/profile/media) — handles up to 50MB locally & <=28MB on Cloud Run, plus .mov->.mp4 normalization
    if (isLocalhost || args.file.size <= SERVER_SAFE_BYTES) {
      try {
        const headers = await this.buildAuthHeaders(args.userId, args.email);
        const form = new FormData();
        form.append('file', args.file, args.file.name || 'profile_media');
        form.append('userId', args.userId);
        if (args.email?.trim()) form.append('email', args.email.trim());
        form.append('mediaType', args.mediaType);

        const res = await fetch('/api/profile/media', {
          method: 'POST',
          headers,
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.url === 'string' && data.url) {
          await this.attachRemoteUrl(args.userId, args.email, args.mediaType, data.url);
          return {
            url: data.url,
            mediaType: data.mediaType === 'video' ? 'video' : 'image',
            storageBackend: data.storageBackend === 'firebase' ? 'firebase' : 'disk',
          };
        }
        serverError = new Error(data?.error || `Server media upload failed (${res.status}).`);
      } catch (err: any) {
        serverError = err instanceof Error ? err : new Error('Server media upload failed.');
      }
    }

    // Path B: Direct Client Firebase Storage upload (handles >28MB up to 50MB in production & server fallback)
    try {
      const [{ auth, storage }, { getDownloadURL, ref, uploadBytes }] = await Promise.all([
        import('@/lib/firebase/client'),
        import('firebase/storage'),
      ]);

      const fbUser = auth?.currentUser;
      if (fbUser && storage) {
        const safeName = (args.file.name || 'profile_media')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 64);
        const storagePath = `users/${fbUser.uid}/profile_media/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        const contentType =
          args.file.type || (args.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');

        await uploadBytes(storageRef, args.file, {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        });
        const url = await getDownloadURL(storageRef);
        await this.attachRemoteUrl(args.userId, args.email, args.mediaType, url);
        return {
          url,
          mediaType: args.mediaType,
          storageBackend: 'firebase-client',
        };
      }
    } catch (fbErr: any) {
      if (!serverError) {
        serverError = fbErr instanceof Error ? fbErr : new Error('Firebase Storage upload failed.');
      }
    }

    throw serverError || new Error('Failed to upload durable profile media.');
  }

  public async clearDurableProfileMedia(userId: string, email?: string): Promise<void> {
    await this.clearProfileMedia(userId, email);
    try {
      const headers = await this.buildAuthHeaders(userId, email);
      headers['Content-Type'] = 'application/json';
      await fetch('/api/profile/media', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ userId, email }),
      });
    } catch (err) {
      console.warn('[ProfileMediaStorageService] Server media delete warning:', err);
    }
  }
}

export const ProfileMediaStorageService = new ProfileMediaStorageServiceClass();

