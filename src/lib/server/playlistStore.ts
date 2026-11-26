/**
 * ChanceTEK One — Server-side persistent Member & Public Playlist Store.
 *
 * Persists playlists durably to Firebase Admin Firestore (`member_playlists`)
 * when available (App Hosting / Cloud Run), with automatic local JSON fallback
 * (`.data/member_playlists.json`) for instant 0-latency local development.
 *
 * Enables any user on any device or browser to immediately discover, open, and
 * play Public playlists created by any member of the platform.
 */

import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';
import { Playlist, PlaylistItem, PlaylistVisibility } from '@/types/playlist';

const PLAYLISTS_COLLECTION = 'member_playlists';
const META_COLLECTION = 'platform_meta';
const META_DOC_ID = 'member_playlists_meta';
const MAX_DOC_BYTES = 850_000; // Safe margin under Firestore 1 MiB limit
const CACHE_TTL_MS = 2_000;

interface LocalPlaylistStoreShape {
  revision: number;
  playlists: Record<string, Playlist>;
}

let memoryCache: {
  revision: number;
  playlists: Playlist[];
  timestamp: number;
} | null = null;

export function canUseFirebaseAdmin(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
  );
}

function getDataDir(): string {
  return path.join(process.cwd(), '.data');
}

function getLocalStorePath(): string {
  return path.join(getDataDir(), 'member_playlists.json');
}

function readLocalStore(): LocalPlaylistStoreShape {
  try {
    const file = getLocalStorePath();
    if (!fs.existsSync(file)) return { revision: 0, playlists: {} };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      revision: Number(parsed?.revision || 0),
      playlists:
        parsed?.playlists && typeof parsed.playlists === 'object' ? parsed.playlists : {},
    };
  } catch {
    return { revision: 0, playlists: {} };
  }
}

function writeLocalStore(store: LocalPlaylistStoreShape): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const target = getLocalStorePath();
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch (err) {
    if (!process.env.K_SERVICE) {
      console.warn('[playlistStore] Local store write warning:', err);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function sanitizeUrl(url?: string, fallback = '/images/studio_cover.jpg'): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('blob:')) return fallback;
  // Strip huge inline base64 images so Firestore documents stay small and fast
  if (trimmed.startsWith('data:') && trimmed.length > 16_000) return fallback;
  return trimmed;
}

function sanitizeOptionalUrl(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return undefined;
  if (trimmed.startsWith('data:') && trimmed.length > 16_000) return undefined;
  return trimmed;
}

function normalizeVisibility(v: any): PlaylistVisibility {
  if (v === 'public' || v === 'private' || v === 'unlisted') return v;
  return 'private';
}

function sanitizePlaylistItem(raw: any, playlistId: string, index: number): PlaylistItem | null {
  if (!raw || typeof raw !== 'object' || !raw.mediaId) return null;
  const mediaType =
    raw.mediaType === 'music' || raw.mediaType === 'video' || raw.mediaType === 'audiobook'
      ? raw.mediaType
      : 'music';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `item-${index}-${String(raw.mediaId)}`,
    playlistId,
    mediaId: String(raw.mediaId),
    mediaType,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 200) : 'Untitled',
    artistName:
      typeof raw.artistName === 'string' && raw.artistName.trim()
        ? raw.artistName.trim().slice(0, 160)
        : 'ChanceTEK One',
    coverUrl: sanitizeUrl(raw.coverUrl, '/images/studio_cover.jpg'),
    duration: Number.isFinite(Number(raw.duration)) ? Math.max(0, Number(raw.duration)) : 0,
    position: Number.isFinite(Number(raw.position)) ? Number(raw.position) : index,
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date().toISOString(),
    ...(sanitizeOptionalUrl(raw.audioUrl) ? { audioUrl: sanitizeOptionalUrl(raw.audioUrl) } : {}),
    ...(sanitizeOptionalUrl(raw.videoUrl) ? { videoUrl: sanitizeOptionalUrl(raw.videoUrl) } : {}),
    ...(Number.isFinite(Number(raw.chapterIndex)) ? { chapterIndex: Number(raw.chapterIndex) } : {}),
    ...(Number.isFinite(Number(raw.bpm)) ? { bpm: Number(raw.bpm) } : {}),
    ...(typeof raw.genre === 'string' && raw.genre.trim() ? { genre: raw.genre.trim().slice(0, 80) } : {}),
  };
}

export function sanitizePlaylistForServer(raw: any): Playlist | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: PlaylistItem[] = [];
  for (let i = 0; i < rawItems.length && items.length < 300; i++) {
    const clean = sanitizePlaylistItem(rawItems[i], id, items.length);
    if (clean) items.push(clean);
  }

  const totalDuration = items.reduce((sum, it) => sum + (it.duration || 0), 0);
  const type =
    raw.type === 'music' || raw.type === 'video' || raw.type === 'audiobook' || raw.type === 'mixed'
      ? raw.type
      : 'mixed';

  const now = new Date().toISOString();
  const sharedWith = Array.isArray(raw.sharedWith)
    ? raw.sharedWith
        .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => s.trim().toLowerCase())
    : [];

  const sanitized: Playlist = {
    id,
    ownerId: typeof raw.ownerId === 'string' && raw.ownerId.trim() ? raw.ownerId.trim() : 'usr-member',
    ownerName:
      typeof raw.ownerName === 'string' && raw.ownerName.trim()
        ? raw.ownerName.trim().slice(0, 120)
        : 'ChanceTEK One Member',
    ...(sanitizeOptionalUrl(raw.ownerAvatarUrl)
      ? { ownerAvatarUrl: sanitizeOptionalUrl(raw.ownerAvatarUrl) }
      : {}),
    ...(typeof raw.ownerEmail === 'string' && raw.ownerEmail.trim()
      ? { ownerEmail: raw.ownerEmail.trim().toLowerCase() }
      : {}),
    name: name.slice(0, 120),
    description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : '',
    type,
    visibility: normalizeVisibility(raw.visibility),
    coverUrl: sanitizeUrl(raw.coverUrl, '/images/studio_cover.jpg'),
    items,
    itemCount: items.length,
    totalDuration,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    stats: {
      plays: Math.max(0, Number(raw.stats?.plays || 0)),
      saves: Math.max(0, Number(raw.stats?.saves || 0)),
      likes: Math.max(0, Number(raw.stats?.likes || 0)),
      shares: Math.max(0, Number(raw.stats?.shares || 0)),
    },
    sharedWith,
    ...(raw.isFeatured ? { isFeatured: true } : {}),
    ...(raw.isDeleted ? { isDeleted: true } : {}),
  };

  return JSON.parse(JSON.stringify(sanitized)) as Playlist;
}

export function invalidatePlaylistStoreCache(): void {
  memoryCache = null;
}

function encodeDocId(id: string): string {
  return encodeURIComponent(id);
}

function canActorModify(
  existing: Playlist,
  actor: { userId?: string; email?: string; isAdmin?: boolean }
): boolean {
  if (actor.isAdmin) return true;
  const actorEmail = actor.email?.trim().toLowerCase();
  const ownerEmail = existing.ownerEmail?.trim().toLowerCase();
  if (actor.userId && existing.ownerId === actor.userId) return true;
  if (actorEmail && ownerEmail && actorEmail === ownerEmail) return true;
  return false;
}

function canViewerSee(
  playlist: Playlist,
  viewer?: { userId?: string; email?: string; isAdmin?: boolean },
  allowUnlistedById = false
): boolean {
  if (playlist.isDeleted) return Boolean(viewer?.isAdmin);
  if (playlist.visibility === 'public') return true;
  if (allowUnlistedById && playlist.visibility === 'unlisted') return true;
  if (!viewer) return false;
  if (viewer.isAdmin) return true;
  const viewerEmail = viewer.email?.trim().toLowerCase();
  const ownerEmail = playlist.ownerEmail?.trim().toLowerCase();
  if (viewer.userId && playlist.ownerId === viewer.userId) return true;
  if (viewerEmail && ownerEmail && viewerEmail === ownerEmail) return true;
  const shared = playlist.sharedWith || [];
  if (viewer.userId && shared.includes(viewer.userId)) return true;
  if (viewerEmail && shared.some((s) => s.toLowerCase() === viewerEmail)) return true;
  return false;
}

export async function getPlaylistsRevision(): Promise<number> {
  let cloudRev = 0;
  if (canUseFirebaseAdmin()) {
    try {
      cloudRev = await withTimeout(
        (async () => {
          const { adminDb } = await getFirebaseAdmin();
          const snap = await adminDb.collection(META_COLLECTION).doc(META_DOC_ID).get();
          return snap.exists ? Number(snap.data()?.revision || 0) : 0;
        })(),
        1_500,
        0
      );
    } catch {
      cloudRev = 0;
    }
  }
  const local = readLocalStore();
  return Math.max(cloudRev, local.revision || 0);
}

async function readAllServerPlaylists(): Promise<{ revision: number; playlists: Playlist[] }> {
  const revision = await getPlaylistsRevision();
  const now = Date.now();

  if (
    memoryCache &&
    memoryCache.revision === revision &&
    now - memoryCache.timestamp < CACHE_TTL_MS
  ) {
    return { revision: memoryCache.revision, playlists: memoryCache.playlists };
  }

  const mergedMap = new Map<string, Playlist>();
  let cloudLoaded = false;

  // 1. Load from Firestore when Firebase Admin is configured
  if (canUseFirebaseAdmin()) {
    try {
      cloudLoaded = await withTimeout(
        (async () => {
          const { adminDb } = await getFirebaseAdmin();
          const qs = await adminDb.collection(PLAYLISTS_COLLECTION).get();
          qs.docs.forEach((docSnap: any) => {
            const { _updatedAt, ...data } = docSnap.data() || {};
            const clean = sanitizePlaylistForServer({ ...data, id: data.id || docSnap.id });
            if (clean) {
              mergedMap.set(clean.id, clean);
            }
          });
          return true;
        })(),
        4_500,
        false
      );
    } catch (err) {
      console.warn('[playlistStore] Firestore read failed, using local store:', err);
    }
  }

  // 2. Merge local JSON store (newest updatedAt wins)
  const local = readLocalStore();
  Object.values(local.playlists).forEach((raw) => {
    const clean = sanitizePlaylistForServer(raw);
    if (!clean) return;
    const existing = mergedMap.get(clean.id);
    if (!existing) {
      mergedMap.set(clean.id, clean);
    } else {
      const existingTs = Date.parse(existing.updatedAt || '') || 0;
      const localTs = Date.parse(clean.updatedAt || '') || 0;
      if (localTs > existingTs) {
        mergedMap.set(clean.id, clean);
      }
    }
  });

  const playlists = Array.from(mergedMap.values()).sort(
    (a, b) => (Date.parse(b.updatedAt || b.createdAt || '') || 0) - (Date.parse(a.updatedAt || a.createdAt || '') || 0)
  );

  if (cloudLoaded || playlists.length > 0 || !canUseFirebaseAdmin()) {
    memoryCache = { revision, playlists, timestamp: now };
  }

  return { revision, playlists };
}

export async function listVisibleServerPlaylists(viewer?: {
  userId?: string;
  email?: string;
  isAdmin?: boolean;
}): Promise<{ revision: number; playlists: Playlist[] }> {
  const { revision, playlists } = await readAllServerPlaylists();
  const visible = playlists.filter((p) => !p.isDeleted && canViewerSee(p, viewer, false));
  return { revision, playlists: visible };
}

export async function getServerPlaylistById(
  id: string,
  viewer?: { userId?: string; email?: string; isAdmin?: boolean }
): Promise<Playlist | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  // Check warm memory cache first
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS * 3) {
    const cached = memoryCache.playlists.find((p) => p.id === cleanId);
    if (cached) {
      return canViewerSee(cached, viewer, true) ? cached : null;
    }
  }

  // Direct single-doc Firestore lookup for fast cold starts
  if (canUseFirebaseAdmin()) {
    try {
      const cloudPlaylist = await withTimeout<Playlist | null>(
        (async () => {
          const { adminDb } = await getFirebaseAdmin();
          const snap = await adminDb
            .collection(PLAYLISTS_COLLECTION)
            .doc(encodeDocId(cleanId))
            .get();
          if (!snap.exists) return null;
          const { _updatedAt, ...data } = snap.data() || {};
          return sanitizePlaylistForServer({ ...data, id: data.id || cleanId });
        })(),
        3_000,
        null
      );
      if (cloudPlaylist) {
        return canViewerSee(cloudPlaylist, viewer, true) ? cloudPlaylist : null;
      }
    } catch {
      // fall through to local
    }
  }

  const local = readLocalStore();
  const localRaw = local.playlists[cleanId];
  const localPlaylist = localRaw ? sanitizePlaylistForServer(localRaw) : null;
  if (localPlaylist) {
    return canViewerSee(localPlaylist, viewer, true) ? localPlaylist : null;
  }

  return null;
}

export async function upsertServerPlaylist(
  input: any,
  actor: { userId?: string; email?: string; isAdmin?: boolean }
): Promise<{ ok: true; playlist: Playlist; revision: number } | { ok: false; error: string; status: number }> {
  const sanitized = sanitizePlaylistForServer(input);
  if (!sanitized) {
    return { ok: false, error: 'Invalid playlist payload.', status: 400 };
  }

  const existing = await getServerPlaylistById(sanitized.id, { isAdmin: true });
  if (existing && !canActorModify(existing, actor)) {
    return {
      ok: false,
      error: 'Only the playlist creator or an administrator can modify this playlist.',
      status: 403,
    };
  }

  const now = new Date().toISOString();
  const merged: Playlist = {
    ...sanitized,
    ownerId: existing ? existing.ownerId : sanitized.ownerId || actor.userId || 'usr-member',
    ownerEmail: existing?.ownerEmail || sanitized.ownerEmail || actor.email?.trim().toLowerCase(),
    createdAt: existing?.createdAt || sanitized.createdAt || now,
    updatedAt: now,
    stats: {
      plays: Math.max(existing?.stats?.plays || 0, sanitized.stats?.plays || 0),
      saves: Math.max(existing?.stats?.saves || 0, sanitized.stats?.saves || 0),
      likes: Math.max(existing?.stats?.likes || 0, sanitized.stats?.likes || 0),
      shares: Math.max(existing?.stats?.shares || 0, sanitized.stats?.shares || 0),
    },
  };

  const payloadBytes = Buffer.byteLength(JSON.stringify(merged));
  if (payloadBytes > MAX_DOC_BYTES) {
    return { ok: false, error: 'Playlist payload exceeds maximum size.', status: 413 };
  }

  // 1. Write local store immediately
  const local = readLocalStore();
  local.playlists[merged.id] = merged;
  local.revision = (local.revision || 0) + 1;
  writeLocalStore(local);

  // 2. Write Firestore when available
  if (canUseFirebaseAdmin()) {
    try {
      const { admin, adminDb } = await getFirebaseAdmin();
      await adminDb
        .collection(PLAYLISTS_COLLECTION)
        .doc(encodeDocId(merged.id))
        .set(
          {
            ...merged,
            _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: false }
        );
      await adminDb
        .collection(META_COLLECTION)
        .doc(META_DOC_ID)
        .set(
          {
            revision: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (err) {
      console.warn('[playlistStore] Firestore write warning (local write succeeded):', err);
    }
  }

  invalidatePlaylistStoreCache();
  const revision = await getPlaylistsRevision();
  return { ok: true, playlist: merged, revision };
}

export async function deleteServerPlaylist(
  id: string,
  actor: { userId?: string; email?: string; isAdmin?: boolean },
  permanent = false
): Promise<{ ok: true; revision: number } | { ok: false; error: string; status: number }> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return { ok: false, error: 'Missing playlist id.', status: 400 };

  const existing = await getServerPlaylistById(cleanId, { isAdmin: true });
  if (existing && !canActorModify(existing, actor)) {
    return {
      ok: false,
      error: 'Only the playlist creator or an administrator can delete this playlist.',
      status: 403,
    };
  }

  const now = new Date().toISOString();
  const local = readLocalStore();
  if (permanent) {
    delete local.playlists[cleanId];
  } else if (existing || local.playlists[cleanId]) {
    local.playlists[cleanId] = {
      ...(existing || local.playlists[cleanId]),
      isDeleted: true,
      updatedAt: now,
    };
  }
  local.revision = (local.revision || 0) + 1;
  writeLocalStore(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { admin, adminDb } = await getFirebaseAdmin();
      const ref = adminDb.collection(PLAYLISTS_COLLECTION).doc(encodeDocId(cleanId));
      if (permanent) {
        await ref.delete();
      } else if (existing) {
        await ref.set(
          {
            ...existing,
            isDeleted: true,
            updatedAt: now,
            _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      await adminDb
        .collection(META_COLLECTION)
        .doc(META_DOC_ID)
        .set(
          {
            revision: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (err) {
      console.warn('[playlistStore] Firestore delete warning:', err);
    }
  }

  invalidatePlaylistStoreCache();
  const revision = await getPlaylistsRevision();
  return { ok: true, revision };
}

export async function updateServerPlaylistStat(
  id: string,
  field: 'plays' | 'saves' | 'likes' | 'shares',
  delta = 1
): Promise<{ ok: boolean; revision: number }> {
  const cleanId = String(id || '').trim();
  const existing = await getServerPlaylistById(cleanId, { isAdmin: true });
  if (!existing) {
    return { ok: false, revision: await getPlaylistsRevision() };
  }

  const nextVal = Math.max(0, Number(existing.stats?.[field] || 0) + (Number(delta) || 1));
  const updated: Playlist = {
    ...existing,
    stats: {
      ...existing.stats,
      [field]: nextVal,
    },
  };

  const local = readLocalStore();
  local.playlists[cleanId] = updated;
  local.revision = (local.revision || 0) + 1;
  writeLocalStore(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { admin, adminDb } = await getFirebaseAdmin();
      await adminDb
        .collection(PLAYLISTS_COLLECTION)
        .doc(encodeDocId(cleanId))
        .set(
          {
            stats: updated.stats,
            _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch {
      // non-fatal
    }
  }

  invalidatePlaylistStoreCache();
  return { ok: true, revision: await getPlaylistsRevision() };
}

