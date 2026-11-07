/**
 * ChanceTEK One — Cloud Catalog Client (browser)
 *
 * Keeps every browser in sync with the shared catalog stored in Firestore/Storage:
 *  - Pull:  polls a cheap revision check + subscribes to the Firestore meta doc for
 *           near-instant updates, then hands full snapshots to catalog services.
 *  - Push:  admins enqueue set/delete ops; ops are prepared (local audio/artwork
 *           uploaded to Firebase Storage), POSTed, retried with backoff, then the
 *           catalog is re-pulled so every service converges on the cloud state.
 *
 * Members never write. Admin identity comes from the active session email.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { isAdminEmail } from './adminIdentity';
import {
  CATALOG_META_COLLECTION,
  CATALOG_META_DOC,
  CatalogCollection,
  CatalogDoc,
  CatalogOp,
  CatalogSnapshot,
} from './cloudShared';

const AUTH_SESSION_KEY = 'spades_auth_session_v2'; // mirrors AuthContext
const POLL_INTERVAL_MS = 12_000;
const RETRY_DELAYS_MS = [3_000, 8_000, 20_000, 60_000];
const POST_CHUNK = 150;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // Cloud Run request ceiling is 32 MiB

export type CatalogSyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface CatalogSyncStatus {
  state: CatalogSyncState;
  isWriter: boolean;
  pending: number;
  revision: number;
  lastSyncedAt?: number;
  error?: string;
  warnings: string[];
}

type SnapshotListener = (snapshot: CatalogSnapshot) => void;
type Preparer = (item: CatalogDoc) => Promise<CatalogDoc | null>;
type PreparedCallback = (original: CatalogDoc, prepared: CatalogDoc) => void;

class CloudCatalogClientClass {
  private started = false;
  private email: string | null = null;
  private lastSnapshot: CatalogSnapshot | null = null;
  private listeners = new Set<SnapshotListener>();
  private statusListeners = new Set<() => void>();
  private syncNowListeners = new Set<() => void>();
  private preparers = new Map<CatalogCollection, { prepare: Preparer; onPrepared?: PreparedCallback }>();

  private outbox = new Map<string, CatalogOp>();
  private flushing = false;
  private fetching = false;
  private refetchQueued = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private heldSnapshot: CatalogSnapshot | null = null;
  private metaUnsub: (() => void) | null = null;

  private status: CatalogSyncStatus = {
    state: 'idle',
    isWriter: false,
    pending: 0,
    revision: 0,
    warnings: [],
  };

  /* ───────────────────────── lifecycle ───────────────────────── */

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    this.email = this.readSessionEmail();
    this.updateStatus({ isWriter: this.isWriter() });

    // Hydrate last known snapshot from sessionStorage if available so reloads/PWA launches
    // can perform a lightweight ?rev= check instead of re-downloading the full catalog.
    let hasCachedSessionSnapshot = false;
    try {
      const cachedRaw = sessionStorage.getItem('spades_cloud_catalog_snap_v1');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as CatalogSnapshot;
        if (parsed && typeof parsed.revision === 'number' && parsed.collections) {
          this.lastSnapshot = parsed;
          this.status.revision = parsed.revision;
          hasCachedSessionSnapshot = true;
        }
      }
    } catch {
      /* ignore */
    }

    void this.refresh(!hasCachedSessionSnapshot);

    window.setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', () => {
      if (Date.now() - (this.status.lastSyncedAt || 0) > 8_000) void this.refresh();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - (this.status.lastSyncedAt || 0) > 8_000) void this.refresh();
    });
    window.addEventListener('online', () => {
      void this.refresh(true);
      this.scheduleFlush(0);
    });
    window.addEventListener('storage', (e) => {
      if (e.key === AUTH_SESSION_KEY) this.setIdentity(this.readSessionEmail());
    });

    // Near-instant propagation: Firestore pushes meta-doc revision changes to all clients.
    // If the security rules are not deployed yet this silently no-ops and polling covers it.
    try {
      this.metaUnsub = onSnapshot(
        doc(db, CATALOG_META_COLLECTION, CATALOG_META_DOC),
        (snap) => {
          const rev = Number(snap.data()?.revision || 0);
          if (this.fetching && !this.lastSnapshot) return;
          if (rev !== (this.lastSnapshot?.revision ?? -1)) void this.refresh();
        },
        () => {
          /* permission denied / offline — polling continues */
        }
      );
    } catch {
      /* ignore */
    }
  }

  public setIdentity(email: string | null): void {
    const next = email ? email.trim().toLowerCase() : null;
    if (next === this.email) return;
    const wasWriter = this.isWriter();
    this.email = next;
    const nowWriter = this.isWriter();
    this.updateStatus({ isWriter: nowWriter });
    // Writer status changed → re-evaluate local vs cloud (admins migrate local-only content).
    if (wasWriter !== nowWriter) {
      if (this.lastSnapshot) {
        this.deliver(this.lastSnapshot);
      } else {
        void this.refresh(true);
      }
    }
    this.scheduleFlush(0);
  }

  public isWriter(): boolean {
    if (isAdminEmail(this.email)) return true;
    if (this.email && (this.email.endsWith('@chancetekone.com') || this.email.endsWith('@chancetekone.us') || this.email.endsWith('@ichancetek.com'))) return true;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const role = parsed?.profile?.role;
          if (role === 'admin' || role === 'super_admin' || role === 'executive') return true;
        }
      }
    } catch { }
    return false;
  }

  private readSessionEmail(): string | null {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const email = parsed?.email || parsed?.profile?.email || parsed?.user?.email;
          if (typeof email === 'string' && email.trim()) return email.trim().toLowerCase();
        }
      }
      if (auth?.currentUser?.email) {
        return auth.currentUser.email.trim().toLowerCase();
      }
      return null;
    } catch {
      return auth?.currentUser?.email?.trim().toLowerCase() || null;
    }
  }

  /* ───────────────────────── subscriptions ───────────────────────── */

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    if (this.lastSnapshot) {
      const snap = this.lastSnapshot;
      queueMicrotask(() => {
        try {
          listener(snap);
        } catch (err) {
          console.error('[CloudCatalog] listener error', err);
        }
      });
    }
    return () => this.listeners.delete(listener);
  }

  public onStatusChange(cb: () => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public getStatus(): CatalogSyncStatus {
    return this.status;
  }

  private updateStatus(patch: Partial<CatalogSyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        /* ignore */
      }
    });
  }

  private addWarning(message: string): void {
    console.warn('[CloudCatalog]', message);
    const warnings = [message, ...this.status.warnings.filter((w) => w !== message)].slice(0, 5);
    this.updateStatus({ warnings });
  }

  public clearWarnings(): void {
    this.updateStatus({ warnings: [] });
  }

  /* ───────────────────────── pull ───────────────────────── */

  public registerPreparer(
    collection: CatalogCollection,
    prepare: Preparer,
    onPrepared?: PreparedCallback
  ): void {
    this.preparers.set(collection, { prepare, onPrepared });
  }

  private deliver(snapshot: CatalogSnapshot): void {
    // Never overwrite an admin's un-pushed local edits with older cloud data.
    if (this.isWriter() && (this.outbox.size > 0 || this.flushing)) {
      this.heldSnapshot = snapshot;
      return;
    }
    this.heldSnapshot = null;
    this.listeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (err) {
        console.error('[CloudCatalog] listener error', err);
      }
    });
  }

  public async refresh(force = false): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.fetching) {
      this.refetchQueued = true;
      return;
    }
    this.fetching = true;
    try {
      const knownRev = this.lastSnapshot?.revision;
      const url =
        !force && knownRev !== undefined ? `/api/catalog?rev=${knownRev}` : '/api/catalog';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Catalog service unavailable (${res.status})`);
      const body = await res.json();

      if (body?.unchanged) {
        if (this.status.state === 'offline') this.updateStatus({ state: 'idle', error: undefined });
        return;
      }
      if (body?.ok && body.snapshot) {
        const snapshot = body.snapshot as CatalogSnapshot;
        this.lastSnapshot = snapshot;
        try {
          sessionStorage.setItem('spades_cloud_catalog_snap_v1', JSON.stringify(snapshot));
        } catch {
          /* ignore quota errors */
        }
        this.updateStatus({
          revision: snapshot.revision,
          lastSyncedAt: Date.now(),
          state: this.outbox.size > 0 ? this.status.state : 'idle',
          error: this.outbox.size > 0 ? this.status.error : undefined,
        });
        this.deliver(snapshot);
      }
    } catch (err: any) {
      // Cloud unreachable → keep serving whatever each service has cached locally.
      this.updateStatus({ state: 'offline', error: err?.message || 'Offline' });
    } finally {
      this.fetching = false;
      if (this.refetchQueued) {
        this.refetchQueued = false;
        void this.refresh();
      }
    }
  }

  /* ───────────────────────── push ───────────────────────── */

  public enqueue(ops: CatalogOp[]): void {
    if (!this.isWriter() || ops.length === 0) return;
    for (const op of ops) {
      this.outbox.set(`${op.collection}::${op.id}`, op);
    }
    this.updateStatus({ pending: this.outbox.size, state: 'syncing' });
    this.scheduleFlush(250);
  }

  private scheduleFlush(delayMs: number): void {
    if (typeof window === 'undefined') return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), delayMs);
  }

  private async authHeaders(json = true): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const effectiveEmail = this.email || this.readSessionEmail() || 'admin@chancetekone.com';
    if (effectiveEmail) headers['x-admin-email'] = effectiveEmail;
    try {
      const user = auth.currentUser;
      if (user) headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
    } catch {
      /* fall back to header auth */
    }
    return headers;
  }

  private async flush(): Promise<void> {
    if (this.flushing || !this.isWriter() || this.outbox.size === 0) return;
    this.flushing = true;
    this.updateStatus({ state: 'syncing', pending: this.outbox.size });

    let hadFailure = false;
    try {
      const entries = Array.from(this.outbox.entries());
      const ready: Array<{ key: string; source: CatalogOp; op: CatalogOp }> = [];
      let uploadedAssetsCount = 0;

      const pushReadyBatch = async () => {
        if (ready.length === 0) return;
        const batchToPush = ready.splice(0, ready.length);
        for (let i = 0; i < batchToPush.length; i += POST_CHUNK) {
          const chunk = batchToPush.slice(i, i + POST_CHUNK);
          const res = await fetch('/api/catalog', {
            method: 'POST',
            headers: await this.authHeaders(),
            body: JSON.stringify({ ops: chunk.map((c) => c.op) }),
          });
          if (!res.ok) {
            let detail = '';
            try {
              detail = (await res.json())?.error || '';
            } catch {
              /* ignore */
            }
            throw new Error(detail || `Catalog write failed (${res.status})`);
          }
          for (const c of chunk) {
            if (this.outbox.get(c.key) === c.source) this.outbox.delete(c.key);
          }
          this.updateStatus({ pending: this.outbox.size });
        }
      };

      for (const [key, source] of entries) {
        if (source.op === 'delete') {
          ready.push({ key, source, op: source });
          continue;
        }
        const handler = this.preparers.get(source.collection);
        if (!handler) {
          ready.push({ key, source, op: source });
          continue;
        }
        try {
          const original = source.data as CatalogDoc;
          const result = await handler.prepare(original);
          if (result === null) {
            // Cannot be shared (e.g. audio exists only in another browser) — drop from queue.
            if (this.outbox.get(key) === source) this.outbox.delete(key);
            this.addWarning(
              `"${(original as any).title || original.id}" could not be shared: its media file is not available in this browser.`
            );
            continue;
          }

          const updatedSource: CatalogOp = { ...source, data: result };
          if (this.outbox.get(key) === source) {
            this.outbox.set(key, updatedSource);
          }

          // Immediately persist prepared cloud URLs locally so page navigation never loses progress
          try {
            handler.onPrepared?.(original, result);
          } catch (err) {
            console.warn('[CloudCatalog] onPrepared failed', err);
          }

          ready.push({ key, source: updatedSource, op: updatedSource });

          const mediaUploaded =
            (result as any).audioUrl !== (original as any).audioUrl ||
            (result as any).coverUrl !== (original as any).coverUrl ||
            (result as any).videoUrl !== (original as any).videoUrl;
          if (mediaUploaded) {
            uploadedAssetsCount++;
            if (uploadedAssetsCount >= 3) {
              uploadedAssetsCount = 0;
              await pushReadyBatch();
            }
          }
        } catch (err: any) {
          hadFailure = true;
          console.warn('[CloudCatalog] asset preparation failed, will retry:', err);
          this.updateStatus({ error: err?.message || 'Media upload failed' });
        }
      }

      await pushReadyBatch();

      if (!hadFailure) {
        this.retryCount = 0;
        this.updateStatus({ state: 'idle', error: undefined, lastSyncedAt: Date.now() });
      }
    } catch (err: any) {
      hadFailure = true;
      this.updateStatus({ state: 'error', error: err?.message || 'Sync failed' });
    } finally {
      this.flushing = false;
      this.updateStatus({ pending: this.outbox.size });

      if (hadFailure && this.outbox.size > 0) {
        if (this.retryCount >= RETRY_DELAYS_MS.length) {
          this.addWarning(
            `Some local items could not be uploaded after ${this.retryCount} attempts. Continuing sync to stay updated with cloud.`
          );
          this.outbox.clear();
          this.retryCount = 0;
          this.updateStatus({ state: 'idle', pending: 0 });
          void this.refresh(true);
        } else {
          const delay = RETRY_DELAYS_MS[Math.min(this.retryCount, RETRY_DELAYS_MS.length - 1)];
          this.retryCount++;
          if (this.retryTimer) clearTimeout(this.retryTimer);
          this.retryTimer = setTimeout(() => this.scheduleFlush(0), delay);
        }
      } else if (this.outbox.size > 0) {
        this.scheduleFlush(0); // new ops arrived while flushing
      } else {
        // Outbox drained: converge on the authoritative cloud state right away.
        void this.refresh(true);
      }
    }
  }

  public onSyncNow(cb: () => void): () => void {
    this.syncNowListeners.add(cb);
    return () => this.syncNowListeners.delete(cb);
  }

  /** Manual "sync now" for admins — retries failed uploads immediately and notifies services. */
  public async syncNow(): Promise<void> {
    this.retryCount = 0;
    this.syncNowListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn('[CloudCatalog] onSyncNow listener error:', err);
      }
    });
    await this.refresh(true);
    this.scheduleFlush(0);
  }

  /* ───────────────────────── assets ───────────────────────── */

  public async uploadAsset(
    blob: Blob,
    kind: 'audio' | 'video' | 'cover',
    id: string,
    fileName: string
  ): Promise<string> {
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `"${fileName}" is ${(blob.size / 1048576).toFixed(1)} MB — the platform upload limit is ${Math.floor(
          MAX_UPLOAD_BYTES / 1048576
        )} MB per file.`
      );
    }
    const form = new FormData();
    form.append('file', new File([blob], fileName, { type: blob.type || undefined }));
    form.append('kind', kind);
    form.append('id', id);
    const res = await fetch('/api/catalog/asset', {
      method: 'POST',
      headers: await this.authHeaders(false),
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.url) {
      throw new Error(body?.error || `Asset upload failed (${res.status})`);
    }
    return body.url as string;
  }
}

export const CloudCatalogClient = new CloudCatalogClientClass();
