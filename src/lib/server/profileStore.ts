/**
 * ChanceTEK One — Server-side persistent User Profile & Profile Media Store.
 * Writes durably to Firebase Admin Storage / Firestore when available (App Hosting / Cloud Run),
 * and falls back seamlessly to `.data/user_profiles.json` + `.data/profile_media/` locally.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';
import { detectVideoSignature, sanitizeFileSegment } from '@/lib/music/audioAssetIntegrity';
import { sha256Hex, writeAssetExclusive, resolveFileInside } from './audioAssetStore';
import { normalizeQuickTimeMovToMp4 } from './catalogStore';

export const MAX_PROFILE_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB

export interface ServerUserProfileRecord {
  id: string;
  email?: string;
  emailLower?: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  profileVideoUrl?: string;
  mediaType?: 'image' | 'video';
  updatedAt: string;
}

export interface UpsertProfileInput {
  userId: string;
  email?: string;
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  profileVideoUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
}

interface LocalProfileStoreShape {
  byId: Record<string, ServerUserProfileRecord>;
  byEmail: Record<string, string>;
}

const PROFILES_COLLECTION = 'users';
const PROFILE_ALIASES_COLLECTION = 'user_profile_aliases';

export function canUseFirebaseAdmin(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
  );
}

function getProfileDataDir(): string {
  return path.join(process.cwd(), '.data');
}

export function getProfileMediaDir(): string {
  return path.join(getProfileDataDir(), 'profile_media');
}

function getLocalProfilesFile(): string {
  return path.join(getProfileDataDir(), 'user_profiles.json');
}

function readLocalStore(): LocalProfileStoreShape {
  try {
    const file = getLocalProfilesFile();
    if (!fs.existsSync(file)) return { byId: {}, byEmail: {} };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      byId: parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      byEmail: parsed?.byEmail && typeof parsed.byEmail === 'object' ? parsed.byEmail : {},
    };
  } catch {
    return { byId: {}, byEmail: {} };
  }
}

function writeLocalStore(store: LocalProfileStoreShape): void {
  const dir = getProfileDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const target = getLocalProfilesFile();
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, target);
}

function isDurableUrl(value?: string | null): value is string {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith('blob:');
}

function normalizeRecord(raw: any, fallbackId: string): ServerUserProfileRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : fallbackId;
  return {
    id,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    emailLower: typeof raw.emailLower === 'string' ? raw.emailLower : undefined,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined,
    bio: typeof raw.bio === 'string' ? raw.bio : undefined,
    avatarUrl: isDurableUrl(raw.avatarUrl) ? raw.avatarUrl : undefined,
    profileVideoUrl: isDurableUrl(raw.profileVideoUrl) ? raw.profileVideoUrl : undefined,
    mediaType: raw.mediaType === 'video' || raw.mediaType === 'image' ? raw.mediaType : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

function encodeAliasDocId(emailLower: string): string {
  return encodeURIComponent(emailLower);
}

export async function getServerUserProfile(args: {
  userId?: string | null;
  email?: string | null;
}): Promise<ServerUserProfileRecord | null> {
  const userId = args.userId?.trim() || '';
  const emailLower = args.email?.trim().toLowerCase() || '';
  if (!userId && !emailLower) return null;

  const localStore = readLocalStore();
  let localRec: ServerUserProfileRecord | null = null;
  if (userId && localStore.byId[userId]) {
    localRec = normalizeRecord(localStore.byId[userId], userId);
  } else if (emailLower && localStore.byEmail[emailLower]) {
    const mappedId = localStore.byEmail[emailLower];
    if (localStore.byId[mappedId]) {
      localRec = normalizeRecord(localStore.byId[mappedId], mappedId);
    }
  }

  let cloudRec: ServerUserProfileRecord | null = null;
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      if (userId) {
        const snap = await adminDb.collection(PROFILES_COLLECTION).doc(userId).get();
        if (snap.exists) {
          cloudRec = normalizeRecord(snap.data(), userId);
        }
      }
      if (!cloudRec && emailLower) {
        const aliasSnap = await adminDb
          .collection(PROFILE_ALIASES_COLLECTION)
          .doc(encodeAliasDocId(emailLower))
          .get();
        const mappedId = aliasSnap.exists ? aliasSnap.data()?.userId : null;
        if (mappedId && typeof mappedId === 'string') {
          const snap = await adminDb.collection(PROFILES_COLLECTION).doc(mappedId).get();
          if (snap.exists) {
            cloudRec = normalizeRecord(snap.data(), mappedId);
          }
        }
        if (!cloudRec) {
          const qs = await adminDb
            .collection(PROFILES_COLLECTION)
            .where('emailLower', '==', emailLower)
            .limit(1)
            .get();
          if (!qs.empty) {
            const docSnap = qs.docs[0];
            cloudRec = normalizeRecord(docSnap.data(), docSnap.id);
          }
        }
      }
    } catch (err) {
      console.warn('[profileStore] Cloud profile read failed, using local fallback:', err);
    }
  }

  if (cloudRec && localRec) {
    const cloudTime = Date.parse(cloudRec.updatedAt || '') || 0;
    const localTime = Date.parse(localRec.updatedAt || '') || 0;
    return localTime > cloudTime ? localRec : cloudRec;
  }
  return cloudRec || localRec;
}

export async function upsertServerUserProfile(
  input: UpsertProfileInput
): Promise<ServerUserProfileRecord> {
  const now = new Date().toISOString();
  const userId = input.userId.trim();
  const emailLower = input.email?.trim().toLowerCase() || undefined;

  const store = readLocalStore();
  const existingLocal =
    store.byId[userId] ||
    (emailLower && store.byEmail[emailLower] ? store.byId[store.byEmail[emailLower]] : undefined);

  const merged: ServerUserProfileRecord = {
    ...(existingLocal || {}),
    id: userId,
    email: input.email?.trim() || existingLocal?.email,
    emailLower: emailLower || existingLocal?.emailLower,
    updatedAt: now,
  };

  if (input.name !== undefined && input.name.trim()) {
    merged.name = input.name.trim();
  }
  if (input.bio === null) {
    delete merged.bio;
  } else if (input.bio !== undefined) {
    merged.bio = input.bio.trim() || undefined;
  }

  if (input.avatarUrl === null) {
    delete merged.avatarUrl;
  } else if (isDurableUrl(input.avatarUrl)) {
    merged.avatarUrl = input.avatarUrl;
  }

  if (input.profileVideoUrl === null) {
    delete merged.profileVideoUrl;
  } else if (isDurableUrl(input.profileVideoUrl)) {
    merged.profileVideoUrl = input.profileVideoUrl;
  }

  if (input.mediaType === null) {
    delete merged.mediaType;
  } else if (input.mediaType === 'image' || input.mediaType === 'video') {
    merged.mediaType = input.mediaType;
  }

  store.byId[userId] = merged;
  if (merged.emailLower) {
    store.byEmail[merged.emailLower] = userId;
  }

  try {
    writeLocalStore(store);
  } catch (err) {
    if (!process.env.K_SERVICE) {
      console.warn('[profileStore] Local store write warning:', err);
    }
  }

  if (canUseFirebaseAdmin()) {
    try {
      const { admin, adminDb } = await getFirebaseAdmin();
      const cloudPayload: Record<string, any> = {
        id: userId,
        updatedAt: now,
        _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (merged.email) cloudPayload.email = merged.email;
      if (merged.emailLower) cloudPayload.emailLower = merged.emailLower;
      if (merged.name) cloudPayload.name = merged.name;
      if (input.bio === null) {
        cloudPayload.bio = admin.firestore.FieldValue.delete();
      } else if (merged.bio !== undefined) {
        cloudPayload.bio = merged.bio;
      }
      if (input.avatarUrl === null) {
        cloudPayload.avatarUrl = admin.firestore.FieldValue.delete();
      } else if (merged.avatarUrl) {
        cloudPayload.avatarUrl = merged.avatarUrl;
      }
      if (input.profileVideoUrl === null) {
        cloudPayload.profileVideoUrl = admin.firestore.FieldValue.delete();
      } else if (merged.profileVideoUrl) {
        cloudPayload.profileVideoUrl = merged.profileVideoUrl;
      }
      if (input.mediaType === null) {
        cloudPayload.mediaType = admin.firestore.FieldValue.delete();
      } else if (merged.mediaType) {
        cloudPayload.mediaType = merged.mediaType;
      }

      await adminDb.collection(PROFILES_COLLECTION).doc(userId).set(cloudPayload, { merge: true });
      if (merged.emailLower) {
        await adminDb
          .collection(PROFILE_ALIASES_COLLECTION)
          .doc(encodeAliasDocId(merged.emailLower))
          .set({ userId, email: merged.email, updatedAt: now }, { merge: true });
      }
    } catch (err) {
      console.warn('[profileStore] Cloud profile write warning:', err);
    }
  }

  return merged;
}

export function validateProfileMediaUpload(
  buffer: Buffer,
  declaredMime: string,
  fileName: string
): { ok: true; kind: 'image' | 'video'; mime: string; ext: string } | { ok: false; reason: string } {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'Uploaded file is empty.' };
  }
  if (buffer.length > MAX_PROFILE_MEDIA_BYTES) {
    return { ok: false, reason: 'File exceeds the 50MB maximum limit.' };
  }

  const head = new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 64));
  const ext = (path.extname(fileName || '') || '').toLowerCase();
  const mimeLower = (declaredMime || '').toLowerCase();

  // 1. Check real video signatures first (MP4, MOV, M4V, WebM, MKV, OGG)
  const vidSig = detectVideoSignature(head);
  if (vidSig) {
    return { ok: true, kind: 'video', mime: vidSig.mime, ext: vidSig.ext };
  }
  if (
    head.length >= 4 &&
    head[0] === 0x4f &&
    head[1] === 0x67 &&
    head[2] === 0x67 &&
    head[3] === 0x53 &&
    (mimeLower.startsWith('video/') || ext === '.ogv' || ext === '.ogg')
  ) {
    return { ok: true, kind: 'video', mime: 'video/ogg', ext: '.ogv' };
  }
  if (
    mimeLower.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v|mkv|avi|ogv|ogg|3gp)$/i.test(ext)
  ) {
    return {
      ok: true,
      kind: 'video',
      mime: mimeLower.startsWith('video/') ? mimeLower : 'video/mp4',
      ext: ext || '.mp4',
    };
  }

  // 2. Check image signatures (JPEG, PNG, GIF, WEBP, BMP, AVIF/HEIC)
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { ok: true, kind: 'image', mime: 'image/jpeg', ext: '.jpg' };
  }
  if (head.length >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return { ok: true, kind: 'image', mime: 'image/png', ext: '.png' };
  }
  if (head.length >= 4 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) {
    return { ok: true, kind: 'image', mime: 'image/gif', ext: '.gif' };
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return { ok: true, kind: 'image', mime: 'image/webp', ext: '.webp' };
  }
  if (
    mimeLower.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|avif|bmp|heic|heif)$/i.test(ext)
  ) {
    return {
      ok: true,
      kind: 'image',
      mime: mimeLower.startsWith('image/') ? mimeLower : 'image/jpeg',
      ext: ext || '.jpg',
    };
  }

  return {
    ok: false,
    reason: 'Unsupported media file. Upload a photo (JPG, PNG, WEBP, GIF) or video (MP4, MOV, WEBM).',
  };
}

export async function saveServerProfileMedia(args: {
  userId: string;
  email?: string;
  mediaType: 'image' | 'video';
  fileName: string;
  contentType: string;
  buffer: Buffer;
}): Promise<{
  url: string;
  mediaType: 'image' | 'video';
  storageBackend: 'firebase' | 'disk';
  sizeBytes: number;
  sha256: string;
}> {
  const movNorm =
    args.mediaType === 'video' || args.fileName.toLowerCase().endsWith('.mov')
      ? normalizeQuickTimeMovToMp4(args.buffer)
      : { buffer: args.buffer, normalized: false };

  const finalBuffer = movNorm.buffer;
  const sha256 = sha256Hex(finalBuffer);
  const rawExt = (path.extname(args.fileName || '') || (args.mediaType === 'video' ? '.mp4' : '.jpg')).toLowerCase();
  const finalExt = movNorm.normalized ? '.mp4' : rawExt;
  const finalContentType = movNorm.normalized ? 'video/mp4' : args.contentType;
  const safeOwner = args.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'member';
  const uniqueFileName = `${safeOwner}_${Date.now()}_${sha256.slice(0, 12)}_${sanitizeFileSegment(
    args.fileName,
    36
  )}${finalExt}`;

  if (canUseFirebaseAdmin()) {
    try {
      const { adminStorage } = await getFirebaseAdmin();
      const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        'nestobanks-221.firebasestorage.app';
      const bucket = adminStorage.bucket(bucketName);
      const objectPath = `users/${safeOwner}/profile_media/${uniqueFileName}`;
      const token = randomUUID();
      const file = bucket.file(objectPath);

      await file.save(finalBuffer, {
        contentType: finalContentType,
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: {
            firebaseStorageDownloadTokens: token,
            sha256,
            ownerId: args.userId,
          },
        },
      });

      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== finalBuffer.length) {
        await file.delete().catch(() => {});
        throw new Error('Firebase Storage size verification mismatch.');
      }

      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        objectPath
      )}?alt=media&token=${token}`;

      await upsertServerUserProfile({
        userId: args.userId,
        email: args.email,
        mediaType: args.mediaType,
        ...(args.mediaType === 'video'
          ? { profileVideoUrl: url }
          : { avatarUrl: url, profileVideoUrl: null }),
      });

      return {
        url,
        mediaType: args.mediaType,
        storageBackend: 'firebase',
        sizeBytes: finalBuffer.length,
        sha256,
      };
    } catch (err) {
      if (process.env.K_SERVICE) {
        throw err;
      }
      console.warn('[profileStore] Firebase Admin Storage unavailable locally, saving to local profile_media dir:', err);
    }
  }

  const written = await writeAssetExclusive({
    dir: getProfileMediaDir(),
    fileName: uniqueFileName,
    urlPrefix: '/api/profile/media?file=',
    buffer: finalBuffer,
  });

  const durableLocalUrl = `/api/profile/media?file=${encodeURIComponent(written.path)}`;

  await upsertServerUserProfile({
    userId: args.userId,
    email: args.email,
    mediaType: args.mediaType,
    ...(args.mediaType === 'video'
      ? { profileVideoUrl: durableLocalUrl }
      : { avatarUrl: durableLocalUrl, profileVideoUrl: null }),
  });

  return {
    url: durableLocalUrl,
    mediaType: args.mediaType,
    storageBackend: 'disk',
    sizeBytes: written.sizeBytes,
    sha256: written.sha256,
  };
}

export function resolveLocalProfileMedia(fileName: string): string | null {
  return resolveFileInside(getProfileMediaDir(), fileName);
}

