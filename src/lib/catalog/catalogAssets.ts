/**
 * ChanceTEKone — Catalog asset externalization.
 *
 * Content that only exists inside one browser (IndexedDB audio, data: / blob: artwork) is
 * invisible to every other member. Before a catalog item is published to the cloud its
 * local-only media is uploaded to Firebase Storage and replaced with a durable https URL.
 *
 * Preparers return:
 *   - the item with durable URLs  → push it
 *   - null                        → the media is unavailable in this browser; skip (warn)
 * and throw on transient failures so the outbox retries.
 */

import { AudioStorageService } from '@/lib/audio/AudioStorageService';
import { getAuthenticAudioUrl, isVerifiedServerUpload } from '@/lib/music/authenticAudioMap';
import { unescapeIndexedDbUrl } from '@/lib/music/audioAssetIntegrity';
import { CloudCatalogClient } from './CloudCatalogClient';
import { CatalogDoc } from './cloudShared';

export const isEphemeralUrl = (u?: string | null): u is string => {
  if (!u || typeof u !== 'string') return false;
  const clean = unescapeIndexedDbUrl(u);
  return clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('indexeddb://');
};

/**
 * Returns true if an audio URL is either browser-local (`indexeddb://`, `blob:`, `data:`)
 * OR points to an unverified `/audio/uploads/...` path that was written to an ephemeral container disk
 * rather than Firebase Cloud Storage.
 */
export const needsCloudAudioExternalization = (u?: string | null): u is string => {
  if (!u || typeof u !== 'string') return false;
  if (isEphemeralUrl(u)) return true;
  const clean = unescapeIndexedDbUrl(u);
  if (clean.startsWith('/audio/uploads/') || clean.includes('/audio/uploads/')) {
    return !isVerifiedServerUpload(clean);
  }
  return false;
};

const extFromMime = (mime: string, fallback: string): string => {
  const m = (mime || '').toLowerCase();
  if (m.includes('mpeg') || m.includes('mp3')) return '.mp3';
  if (m.includes('mp4') && m.startsWith('audio')) return '.m4a';
  if (m.includes('mp4')) return '.mp4';
  if (m.includes('quicktime')) return '.mov';
  if (m.includes('webm')) return '.webm';
  if (m.includes('wav')) return '.wav';
  if (m.includes('ogg')) return '.ogg';
  if (m.includes('flac')) return '.flac';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  return fallback;
};

async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Resolves any browser-local image reference to a Blob (or null if it no longer exists). */
async function resolveLocalImage(url: string, ownerId: string): Promise<Blob | null> {
  const cleanUrl = unescapeIndexedDbUrl(url);
  if (cleanUrl.startsWith('indexeddb://')) {
    const raw = AudioStorageService.extractIdFromIndexedDBUrl(cleanUrl);
    const id = raw.startsWith('cover_') ? raw.slice('cover_'.length) : raw;
    const dataUrl = (await AudioStorageService.getCoverArt(id)) || (await AudioStorageService.getCoverArt(ownerId));
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    return urlToBlob(dataUrl);
  }
  return urlToBlob(cleanUrl); // data: and blob: URLs are fetchable in the page that created them
}

export async function externalizeImage(url: string | undefined, ownerId: string): Promise<string | undefined> {
  if (!isEphemeralUrl(url)) return url;
  const cleanUrl = unescapeIndexedDbUrl(url);
  try {
    const blob = await resolveLocalImage(cleanUrl, ownerId);
    if (!blob || blob.size === 0) return undefined; // artwork lost — UI falls back to authentic/default art
    const ext = extFromMime(blob.type, '.jpg');
    return await CloudCatalogClient.uploadAsset(blob, 'cover', ownerId, `cover_${ownerId}${ext}`);
  } catch (err) {
    console.warn(`[catalogAssets] Non-blocking cover upload error for ${ownerId}:`, err);
    // If it was indexeddb URL, clear so UI uses authentic cover; if data URL, preserve or fallback
    return cleanUrl.startsWith('indexeddb://') ? undefined : cleanUrl;
  }
}

/** Uploads browser-local audio/video. Returns null when the source file isn't in this browser. */
export async function externalizeMedia(
  url: string | undefined,
  ownerId: string,
  kind: 'audio' | 'video',
  label: string,
  extraTrack?: { title?: string; artistName?: string; fileName?: string }
): Promise<string | null | undefined> {
  if (!needsCloudAudioExternalization(url)) return url;
  const cleanUrl = unescapeIndexedDbUrl(url);

  let blob: Blob | null = null;
  if (cleanUrl.startsWith('indexeddb://')) {
    const id = AudioStorageService.extractIdFromIndexedDBUrl(cleanUrl);
    blob = await AudioStorageService.getAudioBlob(id);
  }
  if (!blob) {
    blob = await AudioStorageService.getAudioBlob(ownerId);
  }
  if (!blob) {
    const match = await AudioStorageService.findAudioByTrack({
      id: ownerId,
      title: extraTrack?.title || label,
      artistName: extraTrack?.artistName,
    });
    if (match?.blob) blob = match.blob;
  }
  if (!blob && (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('data:'))) {
    blob = await urlToBlob(cleanUrl);
  }

  // Also check memory fileStore from MusicUploadService if available in browser (exact ownerId only —
  // never by track title or display filename, which could cross-associate two tracks).
  if (!blob && typeof window !== 'undefined') {
    try {
      const { MusicUploadService } = await import('@/lib/admin/MusicUploadService');
      const file = MusicUploadService.getFile(ownerId);
      if (file) blob = file;
    } catch {}
  }

  if (!blob || blob.size === 0) return null;

  try {
    const ext = extFromMime(blob.type, kind === 'video' ? '.mp4' : '.mp3');
    const safe = label.replace(/[^a-zA-Z0-9_\- ]+/g, '').trim().replace(/\s+/g, '_') || ownerId;
    return await CloudCatalogClient.uploadAsset(blob, kind, ownerId, `${safe}${ext}`);
  } catch (err) {
    console.warn(`[catalogAssets] Non-blocking media asset upload error for ${ownerId}:`, err);
    return null; // Caller skips cloud push when local media cannot be externalized
  }
}

/* ───────────────────────── per-collection preparers ───────────────────────── */

export async function prepareTrackDoc(doc: CatalogDoc): Promise<CatalogDoc | null> {
  const t = { ...doc };
  if (needsCloudAudioExternalization(t.audioUrl)) {
    const audio = await externalizeMedia(t.audioUrl, t.id, 'audio', t.title || t.id, {
      title: t.title,
      artistName: t.artistName,
      fileName: (t as any).fileName,
    });
    if (audio) {
      t.audioUrl = audio;
      t.audioStatus = 'verified';
    } else {
      const authentic = getAuthenticAudioUrl(t);
      if (authentic) {
        t.audioUrl = authentic;
      } else {
        // Do NOT synthesize a non-existent `/audio/uploads/${safe}.mp3` URL when local media is
        // unavailable in this browser; return null so CloudCatalogClient skips pushing a broken reference.
        return null;
      }
    }
  } else if (!t.audioUrl || t.audioUrl === '/audio/Fort Apache.mp3') {
    const authentic = getAuthenticAudioUrl(t);
    if (authentic) {
      t.audioUrl = authentic;
    } else if (!t.audioUrl) {
      return null;
    }
  }
  if (isEphemeralUrl(t.coverUrl)) t.coverUrl = await externalizeImage(t.coverUrl, t.id);
  if (isEphemeralUrl(t.albumCoverUrl)) t.albumCoverUrl = await externalizeImage(t.albumCoverUrl, `${t.id}_album`);
  return t;
}

export async function prepareArtworkDoc(doc: CatalogDoc): Promise<CatalogDoc | null> {
  const a = { ...doc };
  if (isEphemeralUrl(a.coverUrl)) a.coverUrl = await externalizeImage(a.coverUrl, a.id);
  return a;
}

export async function prepareAudiobookDoc(doc: CatalogDoc): Promise<CatalogDoc | null> {
  const ab = { ...doc };
  if (isEphemeralUrl(ab.coverUrl)) ab.coverUrl = await externalizeImage(ab.coverUrl, ab.id);
  if (Array.isArray(ab.chapters)) {
    const chapters = [];
    for (const ch of ab.chapters) {
      if (isEphemeralUrl(ch?.audioUrl)) {
        const isVideoMedia =
          ch.audioUrl.toLowerCase().includes('.mov') || ch.audioUrl.toLowerCase().includes('.mp4');
        const audio = await externalizeMedia(
          ch.audioUrl,
          ch.id || `${ab.id}_${ch.chapterIndex}`,
          isVideoMedia ? 'video' : 'audio',
          `${ab.title}_${ch.chapterIndex}`
        );
        if (!audio) return null;
        chapters.push({ ...ch, audioUrl: audio });
      } else {
        chapters.push(ch);
      }
    }
    ab.chapters = chapters;
  }
  return ab;
}

export async function prepareVideoDoc(doc: CatalogDoc): Promise<CatalogDoc | null> {
  const v = { ...doc };
  if (isEphemeralUrl(v.videoUrl)) {
    const isAudioOnly = v.videoUrl.toLowerCase().includes('.mp3');
    const video = await externalizeMedia(v.videoUrl, v.id, isAudioOnly ? 'audio' : 'video', v.title || v.id);
    if (!video) return null;
    v.videoUrl = video;
  }
  if (isEphemeralUrl(v.thumbnailUrl)) v.thumbnailUrl = await externalizeImage(v.thumbnailUrl, `${v.id}_thumb`);
  return v;
}

export async function preparePodcastDoc(doc: CatalogDoc): Promise<CatalogDoc | null> {
  const p = { ...doc };
  if (isEphemeralUrl(p.mediaUrl)) {
    const media = await externalizeMedia(p.mediaUrl, p.id, p.mediaType === 'video' ? 'video' : 'audio', p.title || p.id);
    if (!media) return null;
    p.mediaUrl = media;
  }
  if (isEphemeralUrl(p.coverUrl)) p.coverUrl = await externalizeImage(p.coverUrl, p.id);
  return p;
}
