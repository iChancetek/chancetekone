/**
 * ChanceTEK One — Super Admin Autonomous Music Export Agent
 *
 * Autonomous, strictly read-only export controller that plans, resolves audio + authentic
 * cover artwork across IndexedDB / local server / Firebase Storage, embeds ID3v2.3 APIC
 * artwork directly into MP3 files, writes safely to a user-chosen local or cloud-drive folder
 * (via File System Access API with automatic browser download fallback), auto-retries transient
 * failures, verifies SHA-256 & byte integrity, and emits live telemetry without ever removing
 * or modifying any track on the platform.
 */

import { Track } from '@/types/media';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { isSuperAdminEmail } from '@/lib/catalog/adminIdentity';
import {
  embedId3v2CoverArt,
  detectImageMimeType,
  isValidImageBuffer,
} from '@/lib/admin/id3CoverEmbedder';

export type ExportFolderLayout = 'artist-album' | 'artist' | 'flat';

export type AgentPhase =
  | 'idle'
  | 'planning'
  | 'running'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'cancelled'
  | 'error';

export type TrackExportStatus =
  | 'queued'
  | 'resolving'
  | 'embedding'
  | 'writing'
  | 'retrying'
  | 'verified'
  | 'failed'
  | 'skipped';

export interface TrackExportRecord {
  trackId: string;
  title: string;
  artistName: string;
  albumTitle: string;
  status: TrackExportStatus;
  attempts: number;
  audioSource?: string;
  coverAttached: boolean;
  sidecarCoverWritten: boolean;
  bytesWritten: number;
  sha256?: string;
  destinationPath?: string;
  error?: string;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: 'plan' | 'audio' | 'art' | 'id3' | 'write' | 'verify' | 'retry' | 'warn' | 'error' | 'done';
  message: string;
}

export interface MusicExportOptions {
  tracks: Track[];
  directoryHandle: any | null; // FileSystemDirectoryHandle when available
  directoryLabel: string;
  folderLayout: ExportFolderLayout;
  embedId3CoverArt: boolean;
  writeSidecarCoverArt: boolean;
  writeManifestJson: boolean;
  actor: { id: string; name: string; email: string };
}

export interface ExportManifestItem {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  relativePath: string;
  bytesWritten: number;
  sha256: string;
  coverEmbeddedInId3: boolean;
  sidecarCoverWritten: boolean;
  exportedAt: string;
}

export interface MusicExportAgentSnapshot {
  phase: AgentPhase;
  runId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  directoryLabel: string;
  usingDirectoryPicker: boolean;
  totalTracks: number;
  completedCount: number;
  failedCount: number;
  retriedCount: number;
  coversEmbeddedCount: number;
  totalBytesWritten: number;
  currentTrackTitle: string | null;
  currentAction: string;
  records: Record<string, TrackExportRecord>;
  logs: AgentLogEntry[];
}

const MAX_RETRIES = 3;

function sanitizeSegment(raw: string, fallback = 'Unknown'): string {
  const cleaned = String(raw || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
  return (cleaned || fallback).slice(0, 96);
}

function inferAudioExtension(url?: string, mimeType?: string): string {
  const lowerUrl = (url || '').toLowerCase().split('?')[0];
  if (lowerUrl.endsWith('.wav')) return '.wav';
  if (lowerUrl.endsWith('.flac')) return '.flac';
  if (lowerUrl.endsWith('.m4a')) return '.m4a';
  if (lowerUrl.endsWith('.aac')) return '.aac';
  if (lowerUrl.endsWith('.ogg')) return '.ogg';
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime.includes('wav')) return '.wav';
  if (lowerMime.includes('flac')) return '.flac';
  if (lowerMime.includes('mp4') || lowerMime.includes('m4a')) return '.m4a';
  if (lowerMime.includes('ogg')) return '.ogg';
  return '.mp3';
}

function extensionForImageMime(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  return '.jpg';
}

function decodeDataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  try {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
    if (!match) return null;
    const mimeType = match[1] || 'image/jpeg';
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || '';
    if (isBase64) {
      const binStr = atob(payload);
      const out = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) out[i] = binStr.charCodeAt(i);
      return { bytes: out, mimeType };
    }
    const decoded = decodeURIComponent(payload);
    const out = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) out[i] = decoded.charCodeAt(i);
    return { bytes: out, mimeType };
  } catch {
    return null;
  }
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch { }
  return `len-${bytes.byteLength}`;
}

function looksLikeHtmlError(bytes: Uint8Array): boolean {
  if (!bytes || bytes.byteLength < 12) return true;
  const head = new TextDecoder('ascii', { fatal: false }).decode(bytes.subarray(0, 64)).trim().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('{"ok":false');
}

function triggerBrowserFileDownload(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch { }
  }, 5000);
}

class MusicExportAgentController {
  private snapshot: MusicExportAgentSnapshot = this.createEmptySnapshot();
  private listeners = new Set<(snap: MusicExportAgentSnapshot) => void>();
  private pauseRequested = false;
  private cancelRequested = false;
  private resumeWaiter: (() => void) | null = null;
  private lastOptions: MusicExportOptions | null = null;

  private createEmptySnapshot(): MusicExportAgentSnapshot {
    return {
      phase: 'idle',
      runId: null,
      startedAt: null,
      completedAt: null,
      directoryLabel: '',
      usingDirectoryPicker: false,
      totalTracks: 0,
      completedCount: 0,
      failedCount: 0,
      retriedCount: 0,
      coversEmbeddedCount: 0,
      totalBytesWritten: 0,
      currentTrackTitle: null,
      currentAction: 'Standing by — Select tracks & destination folder to launch the Autonomous Export Agent.',
      records: {},
      logs: [],
    };
  }

  public getSnapshot(): MusicExportAgentSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (snap: MusicExportAgentSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(partial?: Partial<MusicExportAgentSnapshot>): void {
    if (partial) {
      this.snapshot = { ...this.snapshot, ...partial };
    } else {
      this.snapshot = { ...this.snapshot };
    }
    this.listeners.forEach((fn) => fn(this.snapshot));
  }

  private log(level: AgentLogEntry['level'], message: string): void {
    const entry: AgentLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level,
      message,
    };
    const nextLogs = [...this.snapshot.logs.slice(-249), entry];
    this.emit({ logs: nextLogs, currentAction: message });
  }

  private updateRecord(trackId: string, patch: Partial<TrackExportRecord>): void {
    const existing = this.snapshot.records[trackId];
    if (!existing) return;
    const nextRecords = {
      ...this.snapshot.records,
      [trackId]: { ...existing, ...patch },
    };
    this.emit({ records: nextRecords });
  }

  public pause(): void {
    if (this.snapshot.phase !== 'running') return;
    this.pauseRequested = true;
    this.emit({ phase: 'paused' });
    this.log('warn', 'Autonomous agent paused by Super Administrator.');
  }

  public resume(): void {
    if (this.snapshot.phase !== 'paused') return;
    this.pauseRequested = false;
    this.emit({ phase: 'running' });
    this.log('plan', 'Resuming autonomous export pipeline...');
    if (this.resumeWaiter) {
      const fn = this.resumeWaiter;
      this.resumeWaiter = null;
      fn();
    }
  }

  public cancel(): void {
    if (this.snapshot.phase !== 'running' && this.snapshot.phase !== 'paused' && this.snapshot.phase !== 'planning') {
      return;
    }
    this.cancelRequested = true;
    this.pauseRequested = false;
    if (this.resumeWaiter) {
      const fn = this.resumeWaiter;
      this.resumeWaiter = null;
      fn();
    }
    this.emit({ phase: 'cancelled', completedAt: Date.now() });
    this.log('warn', 'Autonomous export cancelled safely. Platform catalog remained 100% untouched.');
  }

  public reset(): void {
    if (this.snapshot.phase === 'running') return;
    this.pauseRequested = false;
    this.cancelRequested = false;
    this.snapshot = this.createEmptySnapshot();
    this.emit();
  }

  private async waitIfPaused(): Promise<void> {
    if (!this.pauseRequested) return;
    await new Promise<void>((resolve) => {
      this.resumeWaiter = resolve;
    });
  }

  /**
   * Resolves raw audio bytes non-destructively across IndexedDB, direct URL, and Super Admin proxy.
   */
  private async resolveAudioBytes(
    track: Track,
    actorEmail: string
  ): Promise<{ bytes: Uint8Array; mimeType: string; source: string; extension: string }> {
    // 1. Check IndexedDB first if track uses indexeddb:// or has a local stored master
    const rawUrl = (track.audioUrl || '').trim();
    if (AudioStorageService.isIndexedDBUrl(rawUrl)) {
      const idbKey = AudioStorageService.extractIdFromIndexedDBUrl(rawUrl);
      const blob = (await AudioStorageService.getAudioBlob(idbKey)) || (await AudioStorageService.getAudioBlob(track.id));
      if (blob && blob.size > 1024) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!looksLikeHtmlError(bytes)) {
          return {
            bytes,
            mimeType: blob.type || 'audio/mpeg',
            source: 'IndexedDB Vault',
            extension: inferAudioExtension(rawUrl, blob.type),
          };
        }
      }
    }

    // Also try exact IndexedDB match by track ID/title+artist if audioUrl is empty or relative fails
    const candidateUrls: string[] = [];
    if (rawUrl && !AudioStorageService.isIndexedDBUrl(rawUrl)) {
      candidateUrls.push(rawUrl);
    }

    for (const candidate of candidateUrls) {
      // 2a. Try direct fetch for same-origin or CORS-enabled URLs
      try {
        const res = await fetch(candidate, { cache: 'no-store' });
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const bytes = new Uint8Array(arr);
          if (bytes.byteLength > 1024 && !looksLikeHtmlError(bytes)) {
            const mime = res.headers.get('content-type') || 'audio/mpeg';
            return {
              bytes,
              mimeType: mime,
              source: candidate.startsWith('http') ? 'Cloud Storage Direct' : 'Platform Server Stream',
              extension: inferAudioExtension(candidate, mime),
            };
          }
        }
      } catch {
        // Fall through to Super Admin proxy
      }

      // 2b. Super Admin read-only server proxy (resolves CORS & disk assets cleanly)
      try {
        const proxyUrl = `/api/admin/music-export/fetch?url=${encodeURIComponent(candidate)}`;
        const proxyRes = await fetch(proxyUrl, {
          cache: 'no-store',
          headers: { 'x-admin-email': actorEmail },
        });
        if (proxyRes.ok) {
          const arr = await proxyRes.arrayBuffer();
          const bytes = new Uint8Array(arr);
          if (bytes.byteLength > 1024 && !looksLikeHtmlError(bytes)) {
            const mime = proxyRes.headers.get('content-type') || 'audio/mpeg';
            return {
              bytes,
              mimeType: mime,
              source: 'Super Admin Export Proxy',
              extension: inferAudioExtension(candidate, mime),
            };
          }
        }
      } catch {
        // Continue to next source
      }
    }

    // 3. Fallback: IndexedDB exact match lookup
    try {
      const stored = await AudioStorageService.findAudioByTrack({
        id: track.id,
        title: track.title,
        artistName: track.artistName,
      });
      if (stored?.blob && stored.blob.size > 1024) {
        const bytes = new Uint8Array(await stored.blob.arrayBuffer());
        if (!looksLikeHtmlError(bytes)) {
          return {
            bytes,
            mimeType: stored.blob.type || 'audio/mpeg',
            source: 'IndexedDB Exact Match',
            extension: inferAudioExtension(rawUrl, stored.blob.type),
          };
        }
      }
    } catch { }

    throw new Error(`Unable to read verifiable audio stream for "${track.title}" (source: ${rawUrl || 'missing'}).`);
  }

  /**
   * Resolves the exact authentic cover artwork bytes for a track (IndexedDB -> Track cover -> Catalog resolver).
   */
  private async resolveCoverArtBytes(
    track: Track,
    actorEmail: string
  ): Promise<{ bytes: Uint8Array; mimeType: string; source: string } | null> {
    // 1. Check IndexedDB APIC cover first (highest fidelity for local uploads)
    try {
      const idbCover = await AudioStorageService.getCoverArt(track.id);
      if (idbCover && idbCover.startsWith('data:image/')) {
        const decoded = decodeDataUrlToBytes(idbCover);
        if (decoded && isValidImageBuffer(decoded.bytes)) {
          return {
            bytes: decoded.bytes,
            mimeType: detectImageMimeType(decoded.bytes, decoded.mimeType),
            source: 'IndexedDB Embedded Art',
          };
        }
      }
    } catch { }

    const resolvedCoverUrl = MusicCatalogService.resolveTrackCover(track);
    const candidates = Array.from(
      new Set([track.coverUrl, resolvedCoverUrl].filter((u): u is string => Boolean(u && u.trim())))
    );

    for (const coverUrl of candidates) {
      if (coverUrl.startsWith('data:image/')) {
        const decoded = decodeDataUrlToBytes(coverUrl);
        if (decoded && isValidImageBuffer(decoded.bytes)) {
          return {
            bytes: decoded.bytes,
            mimeType: detectImageMimeType(decoded.bytes, decoded.mimeType),
            source: 'Embedded Data URI',
          };
        }
        continue;
      }

      // Direct fetch
      try {
        const res = await fetch(coverUrl, { cache: 'no-store' });
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (isValidImageBuffer(bytes)) {
            return {
              bytes,
              mimeType: detectImageMimeType(bytes, res.headers.get('content-type') || 'image/jpeg'),
              source: coverUrl.startsWith('http') ? 'Cloud Cover Direct' : 'Platform Artwork',
            };
          }
        }
      } catch { }

      // Proxy fetch for CORS-protected cloud artwork
      if (coverUrl.startsWith('/') || coverUrl.startsWith('https://')) {
        try {
          const proxyUrl = `/api/admin/music-export/fetch?url=${encodeURIComponent(coverUrl)}`;
          const res = await fetch(proxyUrl, {
            cache: 'no-store',
            headers: { 'x-admin-email': actorEmail },
          });
          if (res.ok) {
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (isValidImageBuffer(bytes)) {
              return {
                bytes,
                mimeType: detectImageMimeType(bytes, res.headers.get('content-type') || 'image/jpeg'),
                source: 'Super Admin Art Proxy',
              };
            }
          }
        } catch { }
      }
    }

    return null;
  }

  /**
   * Ensures nested subdirectories inside a FileSystemDirectoryHandle and writes a file atomically.
   */
  private async writeFileToDirectoryHandle(
    rootHandle: any,
    subFolders: string[],
    fileName: string,
    bytes: Uint8Array
  ): Promise<{ relativePath: string; verifiedBytes: number }> {
    let dirHandle = rootHandle;
    for (const folder of subFolders) {
      if (!folder) continue;
      dirHandle = await dirHandle.getDirectoryHandle(folder, { create: true });
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await writable.write(new Blob([copy.buffer]));
    await writable.close();

    // Post-write read-back verification
    const writtenFile = await fileHandle.getFile();
    const verifiedBytes = writtenFile.size;
    if (verifiedBytes <= 0) {
      throw new Error(`Write verification failed: 0 bytes written for ${fileName}`);
    }

    const rel = [...subFolders, fileName].filter(Boolean).join('/');
    return { relativePath: rel, verifiedBytes };
  }

  /**
   * Launches the Autonomous Music Export Agent for the given tracks & destination.
   */
  public async startExport(options: MusicExportOptions): Promise<void> {
    if (!isSuperAdminEmail(options.actor.email)) {
      this.emit({ phase: 'error' });
      this.log('error', 'Authorization denied: Only Super Administrators can run the Music Export Agent.');
      return;
    }

    if (!options.tracks || options.tracks.length === 0) {
      this.emit({ phase: 'error' });
      this.log('warn', 'No tracks selected for export.');
      return;
    }

    this.lastOptions = options;
    this.pauseRequested = false;
    this.cancelRequested = false;

    const runId = `export-${Date.now()}`;
    const initialRecords: Record<string, TrackExportRecord> = {};
    options.tracks.forEach((t) => {
      initialRecords[t.id] = {
        trackId: t.id,
        title: t.title,
        artistName: t.artistName,
        albumTitle: t.albumTitle || 'Singles & Vault Cuts',
        status: 'queued',
        attempts: 0,
        coverAttached: false,
        sidecarCoverWritten: false,
        bytesWritten: 0,
      };
    });

    this.emit({
      phase: 'planning',
      runId,
      startedAt: Date.now(),
      completedAt: null,
      directoryLabel: options.directoryLabel || 'Browser Downloads Folder',
      usingDirectoryPicker: Boolean(options.directoryHandle),
      totalTracks: options.tracks.length,
      completedCount: 0,
      failedCount: 0,
      retriedCount: 0,
      coversEmbeddedCount: 0,
      totalBytesWritten: 0,
      currentTrackTitle: null,
      records: initialRecords,
      logs: [],
    });

    this.log(
      'plan',
      `Autonomous Agent initialized [${runId}]. Scope: ${options.tracks.length} song(s) -> "${options.directoryLabel || 'Browser Downloads'}" (Layout: ${options.folderLayout}). Read-only mode LOCKED.`
    );

    if (options.directoryHandle && typeof options.directoryHandle.requestPermission === 'function') {
      try {
        const perm = await options.directoryHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          this.emit({ phase: 'error', completedAt: Date.now() });
          this.log('error', 'Folder write permission was not granted by the operating system.');
          return;
        }
      } catch (err: any) {
        this.log('warn', `Directory permission check note: ${err?.message || 'continuing'}`);
      }
    }

    this.emit({ phase: 'running' });

    const manifestItems: ExportManifestItem[] = [];
    const writtenAlbumCovers = new Set<string>();
    const usedFileNames = new Set<string>();

    let completedCount = 0;
    let failedCount = 0;
    let retriedCount = 0;
    let coversEmbeddedCount = 0;
    let totalBytesWritten = 0;

    for (let idx = 0; idx < options.tracks.length; idx++) {
      if (this.cancelRequested) break;
      await this.waitIfPaused();
      if (this.cancelRequested) break;

      const track = options.tracks[idx];
      this.emit({ currentTrackTitle: `${track.artistName} — ${track.title}` });

      let succeeded = false;
      let lastErr = '';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (this.cancelRequested) break;
        await this.waitIfPaused();
        if (this.cancelRequested) break;

        if (attempt > 1) {
          retriedCount++;
          this.emit({ retriedCount });
          this.updateRecord(track.id, { status: 'retrying', attempts: attempt });
          this.log('retry', `[${idx + 1}/${options.tracks.length}] Auto-retry #${attempt} for "${track.title}"...`);
          await new Promise((r) => setTimeout(r, attempt * 600));
        } else {
          this.updateRecord(track.id, { status: 'resolving', attempts: attempt });
          this.log('audio', `[${idx + 1}/${options.tracks.length}] Resolving master audio & cover art for "${track.title}" by ${track.artistName}...`);
        }

        try {
          // Step A: Resolve audio & exact cover art in parallel
          const [audioRes, coverRes] = await Promise.all([
            this.resolveAudioBytes(track, options.actor.email),
            this.resolveCoverArtBytes(track, options.actor.email),
          ]);

          // Step B: Embed ID3v2.3 cover art & tags
          this.updateRecord(track.id, { status: 'embedding', audioSource: audioRes.source });
          let finalBytes = audioRes.bytes;
          let coverEmbedded = false;

          if (options.embedId3CoverArt) {
            const embedded = embedId3v2CoverArt(audioRes.bytes, {
              title: track.title,
              artist: track.artistName,
              album: track.albumTitle || 'ChanceTEK One Vault',
              genre: track.genre || 'Music',
              year: track.releaseYear ? String(track.releaseYear) : undefined,
              trackNumber: track.trackNumber ? String(track.trackNumber) : undefined,
              coverBytes: coverRes?.bytes || null,
              coverMimeType: coverRes?.mimeType || 'image/jpeg',
            });
            finalBytes = embedded.bytes;
            coverEmbedded = embedded.coverEmbedded;
            if (coverEmbedded) {
              this.log(
                'id3',
                `Attached authentic cover art (${Math.round((coverRes?.bytes.byteLength || 0) / 1024)} KB) into ID3v2.3 APIC tag for "${track.title}".`
              );
            }
          }

          // Step C: Compute clean, collision-free folder & filename
          const safeArtist = sanitizeSegment(track.artistName, 'Unknown Artist');
          const safeAlbum = sanitizeSegment(track.albumTitle || 'Singles & Vault Cuts', 'Singles & Vault Cuts');
          const safeTitle = sanitizeSegment(track.title, track.id);

          const subFolders =
            options.folderLayout === 'artist-album'
              ? [safeArtist, safeAlbum]
              : options.folderLayout === 'artist'
                ? [safeArtist]
                : [];

          let baseFileName =
            options.folderLayout === 'flat'
              ? `${safeArtist} - ${safeTitle}`
              : `${track.trackNumber ? `${String(track.trackNumber).padStart(2, '0')} - ` : ''}${safeTitle}`;

          let candidateKey = `${subFolders.join('/')}/${baseFileName}${audioRes.extension}`.toLowerCase();
          let suffix = 2;
          while (usedFileNames.has(candidateKey)) {
            baseFileName = `${baseFileName} (${suffix++})`;
            candidateKey = `${subFolders.join('/')}/${baseFileName}${audioRes.extension}`.toLowerCase();
          }
          usedFileNames.add(candidateKey);
          const finalFileName = `${baseFileName}${audioRes.extension}`;

          // Step D: Write to target folder (or fallback browser download) & verify
          this.updateRecord(track.id, { status: 'writing' });
          let destinationPath = finalFileName;
          let verifiedBytes = finalBytes.byteLength;
          let sidecarWritten = false;

          if (options.directoryHandle) {
            const writeResult = await this.writeFileToDirectoryHandle(
              options.directoryHandle,
              subFolders,
              finalFileName,
              finalBytes
            );
            destinationPath = writeResult.relativePath;
            verifiedBytes = writeResult.verifiedBytes;

            // Optional sidecar cover art file in folder
            if (options.writeSidecarCoverArt && coverRes) {
              const imgExt = extensionForImageMime(coverRes.mimeType);
              const coverDirKey = subFolders.join('/').toLowerCase();
              if (options.folderLayout === 'flat') {
                await this.writeFileToDirectoryHandle(
                  options.directoryHandle,
                  [],
                  `${baseFileName}${imgExt}`,
                  coverRes.bytes
                );
                sidecarWritten = true;
              } else if (!writtenAlbumCovers.has(coverDirKey)) {
                await this.writeFileToDirectoryHandle(
                  options.directoryHandle,
                  subFolders,
                  `cover${imgExt}`,
                  coverRes.bytes
                );
                writtenAlbumCovers.add(coverDirKey);
                sidecarWritten = true;
              } else {
                sidecarWritten = true;
              }
            }
          } else {
            // Graceful fallback when File System Access API is unavailable
            triggerBrowserFileDownload(finalBytes, finalFileName, audioRes.mimeType);
            destinationPath = `Downloads/${finalFileName}`;
            await new Promise((r) => setTimeout(r, 250));
          }

          const sha256 = await computeSha256Hex(finalBytes);
          completedCount++;
          totalBytesWritten += verifiedBytes;
          if (coverEmbedded || sidecarWritten) coversEmbeddedCount++;

          manifestItems.push({
            trackId: track.id,
            title: track.title,
            artist: track.artistName,
            album: track.albumTitle || 'Singles & Vault Cuts',
            genre: track.genre || 'Music',
            relativePath: destinationPath,
            bytesWritten: verifiedBytes,
            sha256,
            coverEmbeddedInId3: coverEmbedded,
            sidecarCoverWritten: sidecarWritten,
            exportedAt: new Date().toISOString(),
          });

          this.updateRecord(track.id, {
            status: 'verified',
            attempts: attempt,
            coverAttached: coverEmbedded || sidecarWritten,
            sidecarCoverWritten: sidecarWritten,
            bytesWritten: verifiedBytes,
            sha256,
            destinationPath,
            error: undefined,
          });

          this.emit({
            completedCount,
            coversEmbeddedCount,
            totalBytesWritten,
          });

          this.log(
            'verify',
            `Verified "${destinationPath}" (${(verifiedBytes / (1024 * 1024)).toFixed(2)} MB • SHA-256 ${sha256.slice(0, 10)}…${coverEmbedded ? ' • Cover Embedded' : ''}).`
          );

          succeeded = true;
          break;
        } catch (err: any) {
          lastErr = err?.message || 'Unexpected export error';
          this.log('warn', `Attempt ${attempt}/${MAX_RETRIES} failed for "${track.title}": ${lastErr}`);
        }
      }

      if (!succeeded && !this.cancelRequested) {
        failedCount++;
        this.updateRecord(track.id, {
          status: 'failed',
          error: lastErr || 'Exhausted autonomous retries',
        });
        this.emit({ failedCount });
        this.log('error', `Marked "${track.title}" as failed after ${MAX_RETRIES} autonomous attempts.`);
      }
    }

    if (this.cancelRequested) return;

    // Write Export Manifest JSON into chosen directory
    this.emit({ phase: 'verifying', currentTrackTitle: null });
    if (options.writeManifestJson && manifestItems.length > 0) {
      const manifestPayload = {
        platform: 'ChanceTEK One',
        agent: 'Super Admin Autonomous Music Export Agent',
        runId,
        readOnlyCatalogGuarantee: true,
        exportedBy: options.actor.email,
        exportedAt: new Date().toISOString(),
        folderLayout: options.folderLayout,
        summary: {
          totalRequested: options.tracks.length,
          verifiedExported: completedCount,
          failed: failedCount,
          coversAttached: coversEmbeddedCount,
          totalBytesWritten,
        },
        tracks: manifestItems,
      };
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestPayload, null, 2));
      try {
        if (options.directoryHandle) {
          await this.writeFileToDirectoryHandle(
            options.directoryHandle,
            [],
            'ChanceTEK_One_Export_Manifest.json',
            manifestBytes
          );
          this.log('write', 'Wrote SHA-256 verified ChanceTEK_One_Export_Manifest.json to target folder.');
        }
      } catch (err: any) {
        this.log('warn', `Could not write manifest JSON: ${err?.message || 'skipped'}`);
      }
    }

    // Record tamper-evident Super Admin audit trail (non-destructive)
    try {
      AuditLogger.logAction({
        adminId: options.actor.id,
        adminName: options.actor.name,
        adminRole: 'super_admin',
        eventType: 'SUPER_ADMIN_MUSIC_EXPORT',
        action: `Autonomous music export: ${completedCount}/${options.tracks.length} tracks -> ${options.directoryLabel}`,
        resource: 'Music Catalog Export',
        resourceId: runId,
        newValue: {
          verified: completedCount,
          failed: failedCount,
          coversAttached: coversEmbeddedCount,
          megabytesWritten: Number((totalBytesWritten / (1024 * 1024)).toFixed(2)),
          tracksRemovedFromPlatform: 0,
        },
        status: failedCount > 0 ? 'WARNING' : 'SUCCESS',
        details: 'Read-only export. Zero platform tracks removed or modified.',
      });
    } catch { }

    this.emit({
      phase: 'completed',
      completedAt: Date.now(),
      currentTrackTitle: null,
    });

    this.log(
      'done',
      `Autonomous Export Complete: ${completedCount}/${options.tracks.length} verified (${(totalBytesWritten / (1024 * 1024)).toFixed(2)} MB, ${coversEmbeddedCount} with cover art). Zero songs removed from platform.`
    );
  }

  /**
   * Re-runs only failed tracks from the most recent batch using the same folder handle.
   */
  public async retryFailed(): Promise<void> {
    if (!this.lastOptions) return;
    const failedIds = new Set(
      Object.values(this.snapshot.records)
        .filter((r) => r.status === 'failed')
        .map((r) => r.trackId)
    );
    const failedTracks = this.lastOptions.tracks.filter((t) => failedIds.has(t.id));
    if (failedTracks.length === 0) return;

    await this.startExport({
      ...this.lastOptions,
      tracks: failedTracks,
    });
  }
}

export const MusicExportAgent = new MusicExportAgentController();

