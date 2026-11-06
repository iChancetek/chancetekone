/**
 * 8 Of Spades Works — server-side audio asset store helpers.
 * Only import from API routes / server code (uses Node fs + crypto).
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  AudioSignature,
  detectAudioSignature,
  detectVideoSignature,
  isPdfSignature,
  isSafeUploadFileName,
} from '@/lib/music/audioAssetIntegrity';

export const sha256Hex = (buf: Buffer | Uint8Array): string => createHash('sha256').update(buf).digest('hex');

export type ValidatedAsset =
  | { ok: true; kind: 'audio'; mime: string; ext: string; signature: AudioSignature }
  | { ok: true; kind: 'video' | 'document'; mime: string; ext: string }
  | { ok: false; reason: string };

/**
 * Validates the REAL bytes of an upload (not its filename or declared MIME) for the asset kind the
 * route is about to store. Empty / truncated / mislabelled files are rejected before anything is
 * written or associated with a song record.
 */
export function validateUploadBytes(buffer: Buffer, kind: 'audio' | 'video' | 'document'): ValidatedAsset {
  if (!buffer || buffer.length === 0) return { ok: false, reason: 'The uploaded file is empty.' };
  const head = new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 65536));

  if (kind === 'audio') {
    const sig = detectAudioSignature(head);
    if (!sig) {
      return { ok: false, reason: 'The file is not a recognised audio format (MP3, AAC, M4A, WAV, OGG, FLAC or WebM). It was not stored.' };
    }
    if (buffer.length < 1024) return { ok: false, reason: 'The audio file is too small to be a valid recording.' };
    return { ok: true, kind: 'audio', mime: sig.mime, ext: sig.ext, signature: sig };
  }
  if (kind === 'video') {
    const sig = detectVideoSignature(head);
    if (!sig) return { ok: false, reason: 'The file is not a recognised MP4 / MOV / WebM container.' };
    return { ok: true, kind: 'video', ...sig };
  }
  if (!isPdfSignature(head)) return { ok: false, reason: 'The file is not a valid PDF document.' };
  return { ok: true, kind: 'document', mime: 'application/pdf', ext: '.pdf' };
}

export interface DiskWriteResult {
  url: string;
  path: string;
  sha256: string;
  sizeBytes: number;
  /** True when an identical object already existed (idempotent retry) and nothing was rewritten. */
  deduplicated: boolean;
}

/**
 * Writes an asset to disk WITHOUT ever overwriting a different object, then re-reads it to prove it is
 * byte-identical to what was received.
 *
 * - Exclusive create (`wx`): two uploads can never silently clobber each other.
 * - If the file already exists it is only accepted when its SHA-256 equals ours (idempotent retry);
 *   otherwise this is a real collision and the upload fails loudly instead of re-pointing a track.
 */
export async function writeAssetExclusive(args: {
  dir: string;
  fileName: string;
  urlPrefix: string;
  buffer: Buffer;
}): Promise<DiskWriteResult> {
  if (!isSafeUploadFileName(args.fileName)) throw new Error('Unsafe storage file name.');
  await fs.promises.mkdir(args.dir, { recursive: true });
  const target = path.join(args.dir, args.fileName);
  const expected = sha256Hex(args.buffer);

  let deduplicated = false;
  try {
    await fs.promises.writeFile(target, args.buffer, { flag: 'wx' });
  } catch (err: any) {
    if (err?.code !== 'EEXIST') throw err;
    const existing = await fs.promises.readFile(target);
    if (sha256Hex(existing) !== expected) {
      throw new Error(`Storage collision: "${args.fileName}" already exists with different content. Upload aborted; nothing was overwritten.`);
    }
    deduplicated = true;
  }

  const stat = await fs.promises.stat(target);
  if (stat.size !== args.buffer.length) {
    throw new Error(`Storage verification failed for "${args.fileName}": size ${stat.size} ≠ ${args.buffer.length}.`);
  }
  if (!deduplicated) {
    const readback = await fs.promises.readFile(target);
    if (sha256Hex(readback) !== expected) {
      await fs.promises.unlink(target).catch(() => {});
      throw new Error(`Storage verification failed for "${args.fileName}": checksum mismatch after write.`);
    }
  }

  return {
    url: `${args.urlPrefix}/${args.fileName}`,
    path: args.fileName,
    sha256: expected,
    sizeBytes: stat.size,
    deduplicated,
  };
}

/** Resolves a requested file under `dir`; returns null for traversal attempts or non-files. */
export function resolveFileInside(dir: string, requested: string): string | null {
  if (!isSafeUploadFileName(requested)) return null;
  let decoded = requested;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    return null;
  }
  const resolvedDir = path.resolve(dir);
  const candidate = path.resolve(resolvedDir, decoded);
  if (!candidate.startsWith(resolvedDir + path.sep)) return null;
  try {
    return fs.statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const hashCache = new Map<string, { mtimeMs: number; size: number; sha256: string }>();

/** SHA-256 of a file, cached by (path, mtime, size) so repeated range requests stay cheap. */
export async function hashFileCached(filePath: string): Promise<{ sha256: string; size: number; mtimeMs: number }> {
  const stat = await fs.promises.stat(filePath);
  const hit = hashCache.get(filePath);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    return { sha256: hit.sha256, size: stat.size, mtimeMs: stat.mtimeMs };
  }
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve())
      .on('error', reject);
  });
  const sha256 = hash.digest('hex');
  hashCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, sha256 });
  return { sha256, size: stat.size, mtimeMs: stat.mtimeMs };
}

