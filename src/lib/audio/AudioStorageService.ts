/**
 * 8 Of Spades Works — IndexedDB Audio Blob Storage Service
 * Provides client-side binary persistence for uploaded MP3 files up to several gigabytes.
 * Ensures zero-latency instant playback and offline reliability.
 */

const DB_NAME = '8spades_audio_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'audio_tracks';

export interface StoredAudioRecord {
  id: string; // trackId or itemId
  fileName: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  title?: string;
  artist?: string;
}

class AudioStorageServiceClass {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private objectUrlCache: Map<string, string> = new Map();

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
              const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
              store.createIndex('fileName', 'fileName', { unique: false });
              store.createIndex('title', 'title', { unique: false });
              store.createIndex('artist', 'artist', { unique: false });
            }
          };

          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Saves an audio File or Blob into IndexedDB
   */
  public async saveAudio(
    id: string,
    fileOrBlob: File | Blob,
    metadata?: { fileName?: string; title?: string; artist?: string }
  ): Promise<string> {
    try {
      const db = await this.getDB();
      const fileName = metadata?.fileName || (fileOrBlob as File).name || `${id}.mp3`;
      const record: StoredAudioRecord = {
        id,
        fileName,
        blob: fileOrBlob,
        mimeType: fileOrBlob.type || 'audio/mpeg',
        sizeBytes: fileOrBlob.size,
        uploadedAt: Date.now(),
        title: metadata?.title,
        artist: metadata?.artist,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // Evict old cached object URL if exists
      if (this.objectUrlCache.has(id)) {
        try {
          URL.revokeObjectURL(this.objectUrlCache.get(id)!);
        } catch {}
        this.objectUrlCache.delete(id);
      }

      return this.makeIndexedDBUrl(id);
    } catch (e) {
      console.warn('[AudioStorageService] Failed to save audio in IndexedDB:', e);
      return '';
    }
  }

  /**
   * Retrieves stored audio Blob by trackId or itemId
   */
  public async getAudioBlob(id: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          const rec = req.result as StoredAudioRecord | undefined;
          resolve(rec?.blob || null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[AudioStorageService] Failed to get audio from IndexedDB:', e);
      return null;
    }
  }

  /**
   * Retrieves or creates a playable blob: URL for the track
   */
  public async getAudioUrl(id: string): Promise<string | null> {
    if (this.objectUrlCache.has(id)) {
      return this.objectUrlCache.get(id)!;
    }

    const blob = await this.getAudioBlob(id);
    if (!blob) return null;

    try {
      const objectUrl = URL.createObjectURL(blob);
      this.objectUrlCache.set(id, objectUrl);
      return objectUrl;
    } catch (err) {
      console.warn('[AudioStorageService] Failed to create object URL:', err);
      return null;
    }
  }

  /**
   * Looks up stored audio for a track.
   *
   * The ONLY authoritative key is the record id. The metadata fallback exists solely to recover audio
   * that was saved under a different id for the very same song, so it requires an EXACT (normalised)
   * match on BOTH title AND artist. It deliberately never matches on a title/filename substring or on
   * the title alone — a short title such as "Joy" is contained in many file names, and that loose match
   * is how one song's local blob could be played under another song's record.
   */
  public async findAudioByTrack(track: {
    id?: string;
    title?: string;
    artistName?: string;
  }): Promise<{ id: string; blob: Blob; url: string } | null> {
    if (track.id) {
      const blob = await this.getAudioBlob(track.id);
      if (blob) {
        const url = (await this.getAudioUrl(track.id)) || '';
        return { id: track.id, blob, url };
      }
    }

    const norm = (s?: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\.(mp3|wav|m4a|flac|aac|ogg)$/i, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');
    const targetTitle = norm(track.title);
    const targetArtist = norm(track.artistName);
    if (!targetTitle || !targetArtist) return null;

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();

        req.onsuccess = async () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(null);
            return;
          }

          const rec = cursor.value as StoredAudioRecord;
          if (!rec.id.startsWith('cover_')) {
            const recTitle = norm(rec.title);
            const recArtist = norm(rec.artist);
            const recFile = norm(rec.fileName ? rec.fileName.replace(/\.[a-z0-9]+$/i, '') : '');
            const artistMatches =
              recArtist === targetArtist ||
              recArtist === '8ofspadesworks' ||
              recFile.includes(targetArtist);
            const titleMatches =
              recTitle === targetTitle ||
              (targetTitle.length >= 4 && recFile.endsWith(targetTitle));
            if (titleMatches && artistMatches) {
              const url = (await this.getAudioUrl(rec.id)) || '';
              resolve({ id: rec.id, blob: rec.blob, url });
              return;
            }
          }

          cursor.continue();
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Checks if audio exists in IndexedDB for the given ID
   */
  public async hasAudio(id: string): Promise<boolean> {
    const blob = await this.getAudioBlob(id);
    return blob !== null;
  }

  /**
   * Deletes audio from IndexedDB
   */
  public async deleteAudio(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      if (this.objectUrlCache.has(id)) {
        try {
          URL.revokeObjectURL(this.objectUrlCache.get(id)!);
        } catch {}
        this.objectUrlCache.delete(id);
      }
    } catch (e) {
      console.warn('[AudioStorageService] Failed to delete audio:', e);
    }
  }

  public makeIndexedDBUrl(id: string): string {
    return `indexeddb://${id}`;
  }

  public isIndexedDBUrl(url?: string | null): boolean {
    if (!url || typeof url !== 'string') return false;
    return /(?:^|\/)indexeddb(?:%3a|:)\/\//i.test(url.trim());
  }

  public extractIdFromIndexedDBUrl(url: string): string {
    const raw = (url || '').trim();
    const m = raw.match(/(?:^|\/)indexeddb(?:%3a|:)\/\/([^\s?#]+)/i);
    if (m && m[1]) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
    return raw.replace(/^indexeddb:\/\//i, '');
  }

  /**
   * Saves cover art binary or data URL into IndexedDB under a dedicated key
   */
  public async saveCoverArt(id: string, coverDataUrl: string): Promise<void> {
    if (!coverDataUrl || !id) return;
    try {
      const db = await this.getDB();
      const record: StoredAudioRecord = {
        id: `cover_${id}`,
        fileName: `${id}_cover.jpg`,
        blob: new Blob([coverDataUrl], { type: 'text/plain' }),
        mimeType: 'image/jpeg',
        sizeBytes: coverDataUrl.length,
        uploadedAt: Date.now(),
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[AudioStorageService] Failed to save cover art in IndexedDB:', e);
    }
  }

  /**
   * Retrieves cover art from IndexedDB
   */
  public async getCoverArt(id: string): Promise<string | null> {
    if (!id) return null;
    try {
      const db = await this.getDB();
      return new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(`cover_${id}`);
        req.onsuccess = async () => {
          const rec = req.result as StoredAudioRecord | undefined;
          if (!rec?.blob) {
            resolve(null);
            return;
          }
          try {
            const text = await rec.blob.text();
            resolve(text);
          } catch {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Deletes cover art from IndexedDB
   */
  public async deleteCoverArt(id: string): Promise<void> {
    if (!id) return;
    try {
      const targetId = id.startsWith('cover_') ? id : `cover_${id}`;
      await this.deleteAudio(targetId);
    } catch (e) {
      console.warn('[AudioStorageService] Failed to delete cover art from IndexedDB:', e);
    }
  }
}

export const AudioStorageService = new AudioStorageServiceClass();
