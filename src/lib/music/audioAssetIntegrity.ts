/**
 * 8 Of Spades Works — Audio Asset Integrity
 *
 * Single, isomorphic (browser + Node) home for the rules that keep every song record bound to
 * the exact audio asset that was uploaded for it:
 *
 *   - file-signature detection (never trust a filename / declared MIME)
 *   - collision-proof storage file names
 *   - safe URL normalisation (no double-encoding of Firebase `%2F` object paths)
 *   - structured upload → publish → playback diagnostics (secrets redacted)
 *   - a read-only association audit that FLAGS suspect records (never repairs by guessing)
 *
 * Nothing here infers an audio file from an artist name, title, filename keyword, list index or
 * player state. An audio reference is only ever the one stored on the song record itself.
 */

import { isCrossArtistAudioMismatch } from './authenticAudioMap';

/* ───────────────────────────── file signatures ───────────────────────────── */

export type AudioContainerKind = 'mp3' | 'aac' | 'mp4' | 'wav' | 'ogg' | 'flac' | 'webm';

export interface AudioSignature {
  kind: AudioContainerKind;
  mime: string;
  ext: string;
}

const SIGNATURES: Record<AudioContainerKind, AudioSignature> = {
  mp3: { kind: 'mp3', mime: 'audio/mpeg', ext: '.mp3' },
  aac: { kind: 'aac', mime: 'audio/aac', ext: '.aac' },
  mp4: { kind: 'mp4', mime: 'audio/mp4', ext: '.m4a' },
  wav: { kind: 'wav', mime: 'audio/wav', ext: '.wav' },
  ogg: { kind: 'ogg', mime: 'audio/ogg', ext: '.ogg' },
  flac: { kind: 'flac', mime: 'audio/flac', ext: '.flac' },
  webm: { kind: 'webm', mime: 'audio/webm', ext: '.webm' },
};

const ascii = (b: Uint8Array, start: number, text: string): boolean => {
  if (b.length < start + text.length) return false;
  for (let i = 0; i < text.length; i++) if (b[start + i] !== text.charCodeAt(i)) return false;
  return true;
};

/** True when `b[i..i+3]` is a plausible MPEG audio frame header (layer I-III). */
function isMpegFrameHeader(b: Uint8Array, i: number): boolean {
  if (i + 3 >= b.length) return false;
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return false;
  const version = (b[i + 1] >> 3) & 0x03; // 01 = reserved
  const layer = (b[i + 1] >> 1) & 0x03; // 00 = reserved (ADTS AAC uses this)
  const bitrate = (b[i + 2] >> 4) & 0x0f; // 0000 free / 1111 bad
  const sampleRate = (b[i + 2] >> 2) & 0x03; // 11 = reserved
  return version !== 1 && layer !== 0 && bitrate !== 0x0f && bitrate !== 0 && sampleRate !== 3;
}

/**
 * Detects the real audio container from the leading bytes of a file.
 * Returns null when the bytes are not a recognised audio container.
 * Pass at least the first 16 KB of the file for reliable MP3 detection.
 */
export function detectAudioSignature(bytes: Uint8Array): AudioSignature | null {
  if (!bytes || bytes.length < 4) return null;

  if (ascii(bytes, 0, 'ID3')) {
    // Valid ID3v2 header: version byte < 0xff (tolerate non-synchsafe size bytes written by older taggers).
    if (bytes.length >= 10 && bytes[3] < 0xff) {
      return SIGNATURES.mp3;
    }
    return null;
  }
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) return SIGNATURES.wav;
  if (ascii(bytes, 0, 'OggS')) return SIGNATURES.ogg;
  if (ascii(bytes, 0, 'fLaC')) return SIGNATURES.flac;
  if (ascii(bytes, 4, 'ftyp')) return SIGNATURES.mp4;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return SIGNATURES.webm;

  // Headerless MPEG / ADTS: look for a real frame sync in the first 64 KB (tolerates leading padding).
  const limit = Math.min(bytes.length - 4, 65536);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    if (isMpegFrameHeader(bytes, i)) return SIGNATURES.mp3;
    if ((bytes[i + 1] & 0xf6) === 0xf0) return SIGNATURES.aac; // ADTS: layer bits 00
  }
  return null;
}

/** Container used by video uploads (audiobook / video catalog): MP4 / MOV (ftyp) or WebM. */
export function detectVideoSignature(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (!bytes || bytes.length < 12) return null;
  if (ascii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return brand === 'qt  ' ? { mime: 'video/quicktime', ext: '.mov' } : { mime: 'video/mp4', ext: '.mp4' };
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: 'video/webm', ext: '.webm' };
  }
  return null;
}

export function isPdfSignature(bytes: Uint8Array): boolean {
  return !!bytes && ascii(bytes, 0, '%PDF');
}

/* ───────────────────────────── file names & paths ───────────────────────────── */

/** Strips everything that could escape a directory or confuse a URL. */
export function sanitizeFileSegment(input: string, max = 60): string {
  const base = (input || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, max);
  return base || 'track';
}

/**
 * Collision-proof storage file name.
 *   `<uploadId>_<sha12>_<cleanName><ext>`
 *
 * - Deterministic for the same (uploadId, content): a retry of the same upload maps to the same
 *   object, so it is idempotent and can never create a second conflicting copy.
 * - Different content → different sha → different name, so one upload can never overwrite another.
 * - Identical filenames from different artists differ by uploadId (and sha) — filename is cosmetic.
 */
export function buildUniqueAudioFileName(args: {
  uploadId: string;
  sha256: string;
  originalName: string;
  ext: string;
}): string {
  const id = (args.uploadId || '').replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 48);
  if (!id) throw new Error('buildUniqueAudioFileName requires a non-empty uploadId / nonce.');
  if (!/^[a-f0-9]{12,}$/i.test(args.sha256)) throw new Error('buildUniqueAudioFileName requires a sha256 hex digest.');
  const ext = (args.ext || '.mp3').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${id}_${args.sha256.slice(0, 12).toLowerCase()}_${sanitizeFileSegment(args.originalName)}${ext}`;
}

/** Rejects path traversal / separators in a requested upload file name. */
export function isSafeUploadFileName(name: string): boolean {
  if (!name || name.length > 255) return false;
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    return false;
  }
  if (decoded.includes('\0') || decoded.includes('..') || decoded.includes('\\') || decoded.includes('/')) return false;
  if (decoded.startsWith('.')) return false;
  return true;
}

/* ───────────────────────────── URL handling ───────────────────────────── */

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Repairs any `indexeddb://` reference that was previously percent-encoded into `indexeddb%3A//`
 * or resolved against a page route (e.g. `https://.../music/indexeddb%3A//up-...`).
 */
export function unescapeIndexedDbUrl(url?: string | null): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  const m = raw.match(/(?:^|\/)indexeddb(?:%3a|:)\/\/([^\s?#]+)/i);
  if (m && m[1]) {
    return `indexeddb://${safeDecode(m[1])}`;
  }
  return raw;
}

/**
 * Makes an audio URL safe to hand to an <audio> element WITHOUT corrupting it.
 *
 * The previous `encodeURI(decodeURI(url))` turned Firebase Storage object paths
 * (`.../o/media%2Fcatalog%2Fx.mp3?...`) into `...%252F...`, which 404s and pushed the player into its
 * error-recovery path. Absolute URLs and scheme-prefixed local references (`indexeddb://`, `blob:`,
 * `data:`) are passed through untouched; only relative paths are normalised (each segment decoded
 * once, then re-encoded once).
 */
export function normalizePlayableUrl(url: string): string {
  const raw = unescapeIndexedDbUrl(url);
  if (!raw) return '';
  if (/^(https?:|blob:|data:|indexeddb:)/i.test(raw)) return raw;
  const [pathAndQuery, hash = ''] = raw.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const encoded = path
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(safeDecode(seg)) : seg))
    .join('/');
  return encoded + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

/** Removes tokens / signatures / query strings so a URL can be logged safely. */
export function redactAudioUrl(url?: string | null): string {
  const raw = unescapeIndexedDbUrl(url);
  if (!raw) return '';
  if (/^data:/i.test(raw)) return 'data:<redacted>';
  if (/^blob:/i.test(raw)) return 'blob:<local>';
  return raw.split('#')[0].split('?')[0];
}

export type AudioRefKind = 'none' | 'server_upload' | 'static_audio' | 'cloud_storage' | 'remote' | 'blob' | 'indexeddb' | 'data';

export interface AudioRefInfo {
  kind: AudioRefKind;
  /** Stable, case-insensitive identity of the stored object (query/token stripped). */
  assetKey: string;
  fileName: string;
}

/** Classifies an audio reference and derives the identity of the object it points at. */
export function describeAudioRef(url?: string | null): AudioRefInfo {
  const raw = unescapeIndexedDbUrl(url);
  if (!raw || raw === 'null' || raw === 'undefined') return { kind: 'none', assetKey: '', fileName: '' };
  const lower = raw.toLowerCase();
  if (lower.startsWith('blob:')) return { kind: 'blob', assetKey: '', fileName: '' };
  if (lower.startsWith('data:')) return { kind: 'data', assetKey: '', fileName: '' };
  if (lower.startsWith('indexeddb://')) return { kind: 'indexeddb', assetKey: lower, fileName: '' };

  const pathOnly = safeDecode(raw.split('#')[0].split('?')[0]);
  if (/^https?:\/\//i.test(raw)) {
    const m = pathOnly.match(/\/o\/(.+)$/); // firebasestorage.googleapis.com/v0/b/<bucket>/o/<object>
    if (m && /firebasestorage|storage\.googleapis/i.test(raw)) {
      return { kind: 'cloud_storage', assetKey: `gcs:${m[1].toLowerCase()}`, fileName: m[1].split('/').pop() || '' };
    }
    return { kind: 'remote', assetKey: pathOnly.toLowerCase(), fileName: pathOnly.split('/').pop() || '' };
  }

  const fileName = pathOnly.split('/').pop() || '';
  if (pathOnly.toLowerCase().includes('/audio/uploads/')) {
    return { kind: 'server_upload', assetKey: `/audio/uploads/${fileName.toLowerCase()}`, fileName };
  }
  return { kind: 'static_audio', assetKey: pathOnly.toLowerCase(), fileName };
}

/** Lower-case alphanumeric key for comparing titles / artists. */
export const normalizeIdentityKey = (s?: string | null): string =>
  (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

/** SHA-256 (hex) of a Blob/File using WebCrypto (browser and Node 18+). */
export async function sha256OfBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ───────────────────────────── structured diagnostics ───────────────────────────── */

export type AudioDiagStage =
  | 'upload_start'
  | 'upload_complete'
  | 'upload_failed'
  | 'publish_bind'
  | 'publish_skipped'
  | 'select'
  | 'resolved'
  | 'superseded'
  | 'media_error'
  | 'stream_missing'
  | 'repair';

export interface AudioDiagEvent {
  ts: string;
  stage: AudioDiagStage;
  trackId?: string;
  uploadId?: string;
  /** Resolved asset identity — query strings / tokens are always stripped. */
  assetKey?: string;
  source?: string;
  sha256?: string;
  status?: string;
  detail?: string;
}

const DIAG_CAP = 300;
const diagRing: AudioDiagEvent[] = [];

/** Records one structured event. Safe in SSR; never throws; never logs secrets. */
export function logAudioDiag(event: Omit<AudioDiagEvent, 'ts'>): AudioDiagEvent {
  const entry: AudioDiagEvent = {
    ts: new Date().toISOString(),
    ...event,
    assetKey: event.assetKey ? redactAudioUrl(event.assetKey) : undefined,
  };
  diagRing.push(entry);
  if (diagRing.length > DIAG_CAP) diagRing.shift();
  try {
    const isProblem = entry.stage === 'media_error' || entry.stage === 'upload_failed' || entry.stage === 'stream_missing';
    (isProblem ? console.warn : console.debug)('[AudioDiag]', JSON.stringify(entry));
    (globalThis as any).__spadesAudioDiag = () => diagRing.slice();
  } catch {
    /* logging must never break playback or publishing */
  }
  return entry;
}

export function getAudioDiagnostics(): AudioDiagEvent[] {
  return diagRing.slice();
}

/* ───────────────────────────── read-only association audit ───────────────────────────── */

export type AudioFindingCode =
  | 'missing_audio'
  | 'missing_asset'
  | 'shared_asset_different_artists'
  | 'shared_asset_different_titles'
  | 'shared_asset_same_recording'
  | 'cross_artist_filename'
  | 'not_shareable_reference'
  | 'identical_content_different_songs';

export interface AudioFinding {
  code: AudioFindingCode;
  severity: 'error' | 'warning' | 'info';
  trackIds: string[];
  assetKey: string;
  message: string;
  /** What an administrator should do. The audit itself NEVER changes a record. */
  recommendation: 'review' | 'relink' | 'none';
}

export interface AuditableTrack {
  id: string;
  title?: string;
  artistName?: string;
  audioUrl?: string;
  audioAsset?: { sha256?: string } | null;
}

export interface AuditOptions {
  /** Lower-cased file names that physically exist in the uploads directory. */
  existingUploadFiles?: Set<string>;
  /** sha256 of physical upload files, keyed by lower-cased file name. */
  uploadFileHashes?: Record<string, string>;
}

/**
 * Compares every track record to the assets it references and reports suspicious associations.
 * Shared assets are only an error when *different artists* share one file — alternate versions of the
 * same song legitimately share or duplicate audio, so those are informational.
 */
export function auditAudioAssociations(tracks: AuditableTrack[], options: AuditOptions = {}): { findings: AudioFinding[]; summary: Record<string, number> } {
  const findings: AudioFinding[] = [];
  const byAsset = new Map<string, AuditableTrack[]>();
  const byHash = new Map<string, { assetKeys: Set<string>; tracks: AuditableTrack[] }>();

  for (const t of tracks) {
    const ref = describeAudioRef(t.audioUrl);

    if (ref.kind === 'none') {
      findings.push({ code: 'missing_audio', severity: 'error', trackIds: [t.id], assetKey: '', message: `"${t.title}" has no audio reference.`, recommendation: 'relink' });
      continue;
    }
    if (ref.kind === 'blob' || ref.kind === 'data' || ref.kind === 'indexeddb') {
      findings.push({
        code: 'not_shareable_reference',
        severity: 'warning',
        trackIds: [t.id],
        assetKey: ref.assetKey,
        message: `"${t.title}" points at browser-local media; other members cannot stream it.`,
        recommendation: 'relink',
      });
      continue;
    }

    if (ref.kind === 'server_upload' && options.existingUploadFiles && !options.existingUploadFiles.has(ref.fileName.toLowerCase())) {
      findings.push({
        code: 'missing_asset',
        severity: 'error',
        trackIds: [t.id],
        assetKey: ref.assetKey,
        message: `"${t.title}" by ${t.artistName} references ${ref.assetKey}, which does not exist in storage.`,
        recommendation: 'relink',
      });
    }

    if (isCrossArtistAudioMismatch({ artistName: t.artistName, title: t.title, audioUrl: t.audioUrl })) {
      findings.push({
        code: 'cross_artist_filename',
        severity: 'error',
        trackIds: [t.id],
        assetKey: ref.assetKey,
        message: `"${t.title}" by ${t.artistName} references a file that belongs to a different artist.`,
        recommendation: 'review',
      });
    }

    if (!byAsset.has(ref.assetKey)) byAsset.set(ref.assetKey, []);
    byAsset.get(ref.assetKey)!.push(t);

    const hash = (ref.kind === 'server_upload' && options.uploadFileHashes?.[ref.fileName.toLowerCase()]) || t.audioAsset?.sha256;
    if (hash) {
      if (!byHash.has(hash)) byHash.set(hash, { assetKeys: new Set(), tracks: [] });
      const g = byHash.get(hash)!;
      g.assetKeys.add(ref.assetKey);
      g.tracks.push(t);
    }
  }

  const describeGroup = (group: AuditableTrack[]) => {
    const artists = new Set(group.map((t) => normalizeIdentityKey(t.artistName)));
    const titles = new Set(group.map((t) => normalizeIdentityKey(t.title)));
    return { artists, titles };
  };

  for (const [assetKey, group] of byAsset) {
    if (group.length < 2) continue;
    const { artists, titles } = describeGroup(group);
    const ids = group.map((t) => t.id);
    const label = group.map((t) => `"${t.title}" (${t.artistName})`).join(', ');
    if (artists.size > 1) {
      findings.push({ code: 'shared_asset_different_artists', severity: 'error', trackIds: ids, assetKey, message: `Different artists share one audio asset: ${label}. At least one is wrong.`, recommendation: 'review' });
    } else if (titles.size > 1) {
      findings.push({ code: 'shared_asset_different_titles', severity: 'error', trackIds: ids, assetKey, message: `Different songs by one artist share one audio asset: ${label}. Only one can be correct.`, recommendation: 'review' });
    } else {
      findings.push({ code: 'shared_asset_same_recording', severity: 'info', trackIds: ids, assetKey, message: `Records for the same song share an asset (alternate release / duplicate record): ${label}.`, recommendation: 'none' });
    }
  }

  for (const [hash, g] of byHash) {
    if (g.assetKeys.size < 2) continue; // same object referenced twice is covered above
    const { artists, titles } = describeGroup(g.tracks);
    if (artists.size > 1 || titles.size > 1) {
      findings.push({
        code: 'identical_content_different_songs',
        severity: 'warning',
        trackIds: g.tracks.map((t) => t.id),
        assetKey: `sha256:${hash}`,
        message: `Distinct stored files have byte-identical content but are attached to different songs: ${g.tracks.map((t) => `"${t.title}" (${t.artistName})`).join(', ')}.`,
        recommendation: 'review',
      });
    }
  }

  const summary: Record<string, number> = { tracks: tracks.length, errors: 0, warnings: 0, info: 0 };
  for (const f of findings) {
    summary[f.severity === 'error' ? 'errors' : f.severity === 'warning' ? 'warnings' : 'info']++;
    summary[f.code] = (summary[f.code] || 0) + 1;
  }
  return { findings, summary };
}
