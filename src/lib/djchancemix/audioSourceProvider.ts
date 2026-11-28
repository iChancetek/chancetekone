/**
 * DJChanceMix — Compliant Audio Source Provider Abstraction
 *
 * Resolves legally authorized audio sources ONLY:
 * 1. ChanceTEK One verified studio catalog & uploaded tracks
 * 2. Local IndexedDB Audio Vault (AudioStorageService)
 * 3. User-imported authorized local audio files (MP3, WAV, AAC, FLAC, M4A, OGG)
 *
 * Strictly enforces copyright & privacy boundaries:
 * - Zero scraping of third-party streaming services (Spotify, Apple Music, YouTube)
 * - Zero DRM bypass
 * - Local files remain strictly client-side in browser memory
 */

import { Track } from '@/types/media';
import { Playlist, PlaylistItem } from '@/types/playlist';
import { DJTrackSource } from '@/types/djchancemix';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import {
  getAuthenticAudioUrl,
  isVerifiedServerUpload,
  getResilientAudioFallback,
} from '@/lib/music/authenticAudioMap';

export const ALLOWED_LOCAL_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'];
export const MAX_LOCAL_AUDIO_FILE_BYTES = 150 * 1024 * 1024; // 150 MB safe ceiling

const localObjectUrls = new Map<string, string>();
const localFilesRegistry = new Map<string, DJTrackSource>();

/**
 * Resolves a playable URL for any DJTrackSource (handles IndexedDB, local File objects, and catalog uploads).
 */
export async function resolveAuthorizedPlayableUrl(track: DJTrackSource): Promise<string> {
  // 1. User-imported local File (zero server upload, 100% private)
  if (track.sourceType === 'local-file' && track.localFile) {
    const existing = localObjectUrls.get(track.id);
    if (existing) return existing;
    const blobUrl = URL.createObjectURL(track.localFile);
    localObjectUrls.set(track.id, blobUrl);
    return blobUrl;
  }

  const rawUrl = (track.audioUrl || '').trim();

  // 2. IndexedDB stored audio blob
  if (rawUrl.startsWith('indexeddb://')) {
    const key = rawUrl.replace('indexeddb://', '').split('?')[0];
    try {
      const url = await AudioStorageService.getAudioUrl(key);
      if (url) return url;
    } catch {
      // fall through to catalog resolution
    }
  }

  // 3. Direct verified server upload or blob URL
  if (rawUrl.startsWith('blob:') || isVerifiedServerUpload(rawUrl)) {
    return rawUrl;
  }

  // 4. Authentic catalog mapping / resilient fallback
  const authentic = getAuthenticAudioUrl({
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    audioUrl: rawUrl,
  });
  if (authentic) return authentic;

  if (rawUrl.startsWith('/audio/') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  return getResilientAudioFallback({
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    genre: track.genre,
    crateId: track.crateId,
  });
}

/**
 * Converts a ChanceTEK One catalog Track into a DJTrackSource.
 */
export function trackToDJSource(track: Track): DJTrackSource {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    albumTitle: track.albumTitle,
    coverUrl: track.coverUrl || '/images/studio_cover.jpg',
    audioUrl: track.audioUrl,
    duration: track.duration || 180,
    genre: track.genre || 'Music',
    bpm: track.bpm,
    crateId: track.crateId,
    sourceType: track.audioUrl?.startsWith('indexeddb://') ? 'indexeddb' : 'catalog',
  };
}

/**
 * Converts music items in a ChanceTEK One Playlist into DJTrackSource[] ready for mixing.
 */
export function playlistToDJSources(playlist: Playlist): DJTrackSource[] {
  const catalogById = new Map(MusicCatalogService.getAllTracks().map((t) => [t.id, t]));
  const result: DJTrackSource[] = [];

  for (const item of playlist.items || []) {
    if (item.mediaType !== 'music') continue;
    const catTrack = catalogById.get(item.mediaId);
    if (catTrack) {
      result.push(trackToDJSource(catTrack));
    } else if (item.audioUrl) {
      result.push({
        id: item.mediaId || item.id,
        title: item.title,
        artistName: item.artistName || 'ChanceTEK One',
        coverUrl: item.coverUrl || '/images/studio_cover.jpg',
        audioUrl: item.audioUrl,
        duration: item.duration || 180,
        genre: item.genre || 'Music',
        bpm: item.bpm,
        sourceType: item.audioUrl.startsWith('indexeddb://') ? 'indexeddb' : 'authorized-stream',
      });
    }
  }

  return result;
}

/**
 * Validates and imports user-selected local audio files into the private browser DJ session.
 */
export function importAuthorizedLocalAudioFiles(
  fileList: FileList | File[]
): { imported: DJTrackSource[]; rejected: Array<{ fileName: string; reason: string }> } {
  const imported: DJTrackSource[] = [];
  const rejected: Array<{ fileName: string; reason: string }> = [];

  const files = Array.from(fileList);
  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const hasAllowedExt = ALLOWED_LOCAL_AUDIO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const isAudioMime = file.type.startsWith('audio/') || hasAllowedExt;

    if (!isAudioMime) {
      rejected.push({
        fileName: file.name,
        reason: `Unsupported file type. Supported: ${ALLOWED_LOCAL_AUDIO_EXTENSIONS.join(', ')}`,
      });
      continue;
    }

    if (file.size > MAX_LOCAL_AUDIO_FILE_BYTES) {
      rejected.push({
        fileName: file.name,
        reason: 'File exceeds the 150 MB browser decoding safety limit.',
      });
      continue;
    }

    // Parse "Artist - Title.mp3" cleanly from filename
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
    const parts = cleanBase.split(/\s+[-–—]\s+/);
    const artistName = parts.length >= 2 ? parts[0].trim() : 'Local Library';
    const title = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : cleanBase;

    const id = `dj-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const blobUrl = URL.createObjectURL(file);
    localObjectUrls.set(id, blobUrl);

    const source: DJTrackSource = {
      id,
      title: title || file.name,
      artistName,
      albumTitle: 'Authorized Local Audio',
      coverUrl: '/images/genres/rnb-neo-soul.jpg',
      audioUrl: blobUrl,
      duration: 180,
      genre: 'Local Mix',
      sourceType: 'local-file',
      localFile: file,
    };

    localFilesRegistry.set(id, source);
    imported.push(source);
  }

  return { imported, rejected };
}

export function getRegisteredLocalAudioTracks(): DJTrackSource[] {
  return Array.from(localFilesRegistry.values());
}

/**
 * Generates a lightweight deterministic hash string for cache invalidation.
 */
export function hashAudioReference(trackId: string, url: string): string {
  const input = `${trackId}::${url}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `a_${(h >>> 0).toString(36)}`;
}

