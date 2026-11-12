/**
 * ChanceTEK One — Server-side shared catalog store (Firebase Admin SDK).
 * Only import from API routes / server code.
 */

import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';
import {
  CATALOG_COLLECTIONS,
  CATALOG_META_COLLECTION,
  CATALOG_META_DOC,
  CatalogCollection,
  CatalogDoc,
  CatalogOp,
  CatalogSnapshot,
  emptySnapshot,
  encodeDocId,
  firestoreCollectionName,
  isCatalogCollection,
} from '@/lib/catalog/cloudShared';

const MAX_DOC_BYTES = 900_000; // Firestore hard limit is 1 MiB
const BATCH_SIZE = 400; // Firestore hard limit is 500 writes per batch
const SNAPSHOT_CACHE_TTL_MS = 2500; // 2.5 seconds cache TTL for instant real-time synchronization

let snapshotCache: { revision: number; snapshot: CatalogSnapshot; timestamp: number } | null = null;

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

function getLocalSnapshotPath(): string {
  return path.join(getDataDir(), 'catalog_snapshot.json');
}

function readLocalCatalogSnapshot(): CatalogSnapshot | null {
  try {
    const file = getLocalSnapshotPath();
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (parsed && typeof parsed === 'object' && parsed.collections) {
      return parsed as CatalogSnapshot;
    }
  } catch {}
  return null;
}

function writeLocalCatalogSnapshot(snapshot: CatalogSnapshot): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const target = getLocalSnapshotPath();
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch (err) {
    if (!process.env.K_SERVICE) {
      console.warn('[catalogStore] Local catalog snapshot write warning:', err);
    }
  }
}

export function invalidateCatalogSnapshotCache(): void {
  snapshotCache = null;
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

export async function getCatalogRevision(): Promise<number> {
  let cloudRev = 0;
  if (canUseFirebaseAdmin()) {
    try {
      cloudRev = await withTimeout(
        (async () => {
          const { adminDb } = await getFirebaseAdmin();
          const snap = await adminDb.collection(CATALOG_META_COLLECTION).doc(CATALOG_META_DOC).get();
          return snap.exists ? Number(snap.data()?.revision || 0) : 0;
        })(),
        1500,
        0,
      );
    } catch {
      cloudRev = 0;
    }
  }
  const local = readLocalCatalogSnapshot();
  const localRev = Number(local?.revision || 0);
  return Math.max(cloudRev, localRev);
}

/**
 * Reads the full catalog across Firestore and local snapshot.
 * Ensures newly added tracks, audiobooks, and podcasts are picked up in real time.
 */
export async function readCatalogSnapshot(): Promise<CatalogSnapshot> {
  const revision = await getCatalogRevision();
  const now = Date.now();

  if (snapshotCache && snapshotCache.revision === revision && now - snapshotCache.timestamp < SNAPSHOT_CACHE_TTL_MS) {
    return snapshotCache.snapshot;
  }

  const snapshot = emptySnapshot();
  snapshot.revision = revision;

  // 1. Load cloud snapshot if Firebase Admin is available (capped with 2000ms timeout for ultra-fast API response)
  if (canUseFirebaseAdmin()) {
    try {
      await withTimeout(
        (async () => {
          const { adminDb } = await getFirebaseAdmin();
          await Promise.all(
            CATALOG_COLLECTIONS.map(async (c) => {
              const qs = await adminDb.collection(firestoreCollectionName(c)).get();
              snapshot.collections[c] = qs.docs.map((d: any) => {
                const { _updatedAt, ...data } = d.data() || {};
                const id = typeof data.id === 'string' && data.id ? data.id : safeDecode(d.id);
                return { ...data, id } as CatalogDoc;
              });
            })
          );
        })(),
        2000,
        undefined,
      );
    } catch (err: any) {
      // Fallback gracefully to local snapshot
    }
  }

  // 2. Merge local snapshot if present (ensures instant real-time reflection across local writes/dev mode)
  const local = readLocalCatalogSnapshot();
  if (local?.collections) {
    for (const col of CATALOG_COLLECTIONS) {
      const localDocs = local.collections[col] || [];
      if (localDocs.length > 0) {
        const existingMap = new Map<string, CatalogDoc>(
          (snapshot.collections[col] || []).map((d) => [d.id, d])
        );
        for (const ld of localDocs) {
          existingMap.set(ld.id, { ...(existingMap.get(ld.id) || {}), ...ld });
        }
        snapshot.collections[col] = Array.from(existingMap.values());
      }
    }
  }

  snapshotCache = { revision, snapshot, timestamp: now };
  return snapshot;
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Removes `undefined` and non-JSON values (Firestore rejects them). */
function sanitize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export async function applyCatalogOps(
  ops: CatalogOp[],
  actor: string
): Promise<{ applied: number; revision: number }> {
  const valid = ops.filter(
    (o) =>
      o &&
      isCatalogCollection(o.collection) &&
      typeof o.id === 'string' &&
      o.id.length > 0 &&
      (o.op === 'delete' || (o.op === 'set' && o.data && typeof o.data === 'object'))
  );
  if (valid.length === 0) {
    return { applied: 0, revision: await getCatalogRevision() };
  }

  // 1. Immediately apply to local catalog snapshot for 0-latency real-time reflection
  const local = readLocalCatalogSnapshot() || emptySnapshot();
  for (const o of valid) {
    const col = o.collection as CatalogCollection;
    const list = local.collections[col] || [];
    if (o.op === 'delete') {
      local.collections[col] = list.filter((d) => d.id !== o.id);
    } else {
      const payload = sanitize({ ...o.data, id: o.id });
      const idx = list.findIndex((d) => d.id === o.id);
      if (idx >= 0) {
        list[idx] = payload;
      } else {
        list.unshift(payload);
      }
      local.collections[col] = list;
    }
  }
  local.revision = (local.revision || 0) + 1;
  writeLocalCatalogSnapshot(local);

  // 2. If Firebase Admin is available, commit batches to Firestore
  if (canUseFirebaseAdmin()) {
    try {
      const { admin, adminDb } = await getFirebaseAdmin();

      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        for (const o of valid.slice(i, i + BATCH_SIZE)) {
          const ref = adminDb
            .collection(firestoreCollectionName(o.collection as CatalogCollection))
            .doc(encodeDocId(o.id));
          if (o.op === 'delete') {
            batch.delete(ref);
          } else {
            const payload = sanitize({ ...o.data, id: o.id });
            const size = Buffer.byteLength(JSON.stringify(payload));
            if (size > MAX_DOC_BYTES) {
              throw new Error(
                `Catalog item "${o.id}" in "${o.collection}" is too large (${size} bytes). Upload large media/artwork as files, not inline data.`
              );
            }
            batch.set(ref, { ...payload, _updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          }
        }
        await batch.commit();
      }

      await adminDb
        .collection(CATALOG_META_COLLECTION)
        .doc(CATALOG_META_DOC)
        .set(
          {
            revision: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: actor,
          },
          { merge: true }
        );
    } catch (cloudErr) {
      console.warn('[catalogStore] Cloud batch write warning (local write succeeded):', cloudErr);
    }
  }

  invalidateCatalogSnapshotCache();
  const revision = await getCatalogRevision();
  return { applied: valid.length, revision };
}

const sanitizeSegment = (s: string) =>
  s
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'file';

export type CatalogAssetKind = 'audio' | 'video' | 'cover' | 'document';

/**
 * In-place QuickTime .mov (ftypqt + avc1 + mp4a v1) -> ISO BMFF .mp4 (ftypisom + avc1 + mp4a v0)
 * normalizer. Keeps every box size and stco chunk offset identical so H.264/AAC .mov uploads
 * play natively in Chromium, Firefox, Safari, Edge, Android, and iOS.
 */
export function normalizeQuickTimeMovToMp4(input: Buffer): { buffer: Buffer; normalized: boolean } {
  if (input.length < 32 || input.subarray(4, 12).toString('ascii') !== 'ftypqt  ') {
    return { buffer: input, normalized: false };
  }
  const buf = Buffer.from(input);
  if (buf.readUInt32BE(0) === 20) {
    Buffer.from('000000146674797069736f6d000002006d703431', 'hex').copy(buf, 0);
  }
  let idx = 0;
  while ((idx = buf.indexOf(Buffer.from('hdlr'), idx)) !== -1) {
    if (idx >= 4) {
      const sz = buf.readUInt32BE(idx - 4);
      const kind = buf.subarray(idx + 8, idx + 12).toString('ascii');
      if (kind === 'mhlr') {
        buf.writeUInt32BE(0, idx + 8);
      } else if (kind === 'dhlr' && idx - 4 + sz <= buf.length) {
        buf.write('free', idx, 4, 'ascii');
        buf.fill(0, idx + 4, idx - 4 + sz);
      }
    }
    idx += 4;
  }
  idx = 0;
  while ((idx = buf.indexOf(Buffer.from('0000000c616c697300000001', 'hex'), idx)) !== -1) {
    buf.write('url ', idx + 4, 4, 'ascii');
    idx += 12;
  }
  const mp4aIdx = buf.indexOf(Buffer.from('mp4a'));
  if (mp4aIdx >= 4) {
    const boxStart = mp4aIdx - 4;
    const boxSize = buf.readUInt32BE(boxStart);
    if (boxStart + boxSize <= buf.length && boxSize >= 52) {
      const ver = buf.readUInt16BE(boxStart + 16);
      if (ver === 1) {
        const esdsTag = buf.indexOf(Buffer.from('esds'), boxStart + 36);
        if (esdsTag !== -1 && esdsTag < boxStart + boxSize) {
          const esdsStart = esdsTag - 4;
          const esdsSize = buf.readUInt32BE(esdsStart);
          if (esdsStart + esdsSize <= boxStart + boxSize) {
            const esdsBytes = Buffer.from(buf.subarray(esdsStart, esdsStart + esdsSize));
            buf.writeUInt16BE(0, boxStart + 16);
            buf.writeUInt16BE(0, boxStart + 28);
            esdsBytes.copy(buf, boxStart + 36);
            const freeStart = boxStart + 36 + esdsSize;
            const freeSize = boxStart + boxSize - freeStart;
            if (freeSize >= 8) {
              buf.writeUInt32BE(freeSize, freeStart);
              buf.write('free', freeStart + 4, 4, 'ascii');
              buf.fill(0, freeStart + 8, freeStart + freeSize);
            }
          }
        }
      }
    }
  }
  return { buffer: buf, normalized: true };
}

/**
 * Stores a binary asset in Firebase Storage and returns a durable public download URL
 * (token based, so no bucket ACL changes and no signed-URL IAM permission are required).
 */
export async function uploadCatalogAsset(args: {
  buffer: Buffer;
  kind: CatalogAssetKind;
  fileName: string;
  contentType: string;
  ownerId?: string;
}): Promise<{ url: string; path: string; sha256: string; sizeBytes: number }> {
  const { adminStorage } = await getFirebaseAdmin();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'spadesworks8.firebasestorage.app';
  const bucket = adminStorage.bucket(bucketName);

  const rawExt = (args.fileName.match(/\.[a-zA-Z0-9]{1,5}$/)?.[0] || '').toLowerCase();
  const movNorm =
    args.kind === 'video' || rawExt === '.mov'
      ? normalizeQuickTimeMovToMp4(args.buffer)
      : { buffer: args.buffer, normalized: false };
  const finalBuffer = movNorm.buffer;
  const ext = movNorm.normalized ? '.mp4' : rawExt;
  const finalContentType = movNorm.normalized ? 'video/mp4' : args.contentType;
  const folder = args.kind === 'cover' ? 'artwork' : args.kind === 'document' ? 'documents' : 'media';
  const sha256 = createHash('sha256').update(finalBuffer).digest('hex');

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Timestamp + 8 hex chars of UUID: every upload gets its own object, so one upload can never
      // overwrite another (the owner id is cosmetic, not identity).
      const objectPath = `${folder}/catalog/${args.kind}/${Date.now()}_${sanitizeSegment(
        args.ownerId || args.fileName
      )}_${randomUUID().slice(0, 8)}${ext}`;

      const token = randomUUID();
      const file = bucket.file(objectPath);
      await file.save(finalBuffer, {
        contentType: finalContentType,
        resumable: false,
        // Fail instead of replacing an existing object (belt-and-braces; paths are already unique).
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { firebaseStorageDownloadTokens: token, sha256, ownerId: args.ownerId || '' },
        },
      });

      // Prove the object really exists with the bytes we sent before any record is allowed to reference it.
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== finalBuffer.length) {
        await file.delete().catch(() => {});
        throw new Error(`Storage verification failed for ${objectPath}: stored size ${metadata.size} ≠ ${finalBuffer.length}.`);
      }

      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        objectPath
      )}?alt=media&token=${token}`;
      return { url, path: objectPath, sha256, sizeBytes: finalBuffer.length };
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw lastErr;
}

