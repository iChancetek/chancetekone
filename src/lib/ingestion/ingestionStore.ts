/**
 * Durable key/value store for ingestion job state (batches, items, folder records, album groups).
 *
 * localStorage is capped at ~5 MB, which a single 300-folder batch (thousands of items) exceeds.
 * The previous code swallowed the resulting QuotaExceededError (`console.warn`) and silently lost
 * state, so an interrupted upload could not be resumed. This store writes to IndexedDB (no practical
 * limit) and falls back to an in-memory map when IndexedDB is unavailable.
 */

const DB_NAME = '8spades_ingestion_state_v1';
const STORE = 'kv';

const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open ingestion state DB'));
    });
  }
  return dbPromise;
}

export const IngestionStore = {
  async put(key: string, value: unknown): Promise<boolean> {
    memory.set(key, value);
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (e) {
      console.warn(`[IngestionStore] Durable write failed for "${key}" (kept in memory only):`, e);
      return false;
    }
  },

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const db = await openDb();
      const value = await new Promise<T | undefined>((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      });
      if (value !== undefined) return value;
    } catch {
      /* fall through to memory */
    }
    return memory.get(key) as T | undefined;
  },

  async remove(key: string): Promise<void> {
    memory.delete(key);
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* ignore */
    }
  },
};
