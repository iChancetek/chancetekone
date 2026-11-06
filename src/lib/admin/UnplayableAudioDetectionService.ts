import { Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { VERIFIED_SERVER_UPLOADS, isCrossArtistAudioMismatch } from '@/lib/music/authenticAudioMap';
import { getAudioDiagnostics } from '@/lib/music/audioAssetIntegrity';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { AdminRole } from '@/types/admin';

export type UnplayableReasonCode =
  | 'MISSING_AUDIO_URL'
  | 'SERVER_404_NOT_FOUND'
  | 'LOCAL_BLOB_UNSTREAMABLE'
  | 'INDEXEDDB_UNSTREAMABLE'
  | 'PLAYBACK_MEDIA_ERROR'
  | 'CROSS_ARTIST_MISMATCH';

export interface UnplayableTrackRecord {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string;
  genre?: string;
  coverUrl?: string;
  audioUrl?: string;
  duration?: number;
  reasonCode: UnplayableReasonCode;
  reasonTitle: string;
  reasonDescription: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  probeStatus: 'UNTESTED' | 'PROBING' | 'CONFIRMED_BROKEN' | 'CONFIRMED_PLAYABLE';
  probeDetails?: string;
  rawTrack: Track;
}

export interface UnplayableStats {
  totalUnplayable: number;
  server404Count: number;
  missingAudioCount: number;
  localBlobCount: number;
  playbackErrorCount: number;
  crossArtistMismatchCount: number;
  catalogHealthScore: number;
}

class UnplayableAudioDetectionServiceClass {
  private listeners = new Set<() => void>();
  private confirmedPlayableIds = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('catalog-updated', () => this.notify());
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[UnplayableAudioDetectionService] Listener error:', err);
      }
    });
  }

  /**
   * Scans all catalog songs to detect tracks that users cannot play
   */
  public scanUnplayableTracks(): UnplayableTrackRecord[] {
    const tracks = MusicCatalogService.getAllTracks();
    const results: UnplayableTrackRecord[] = [];
    const recentDiags = getAudioDiagnostics();
    const mediaErrorTrackIds = new Set(
      recentDiags
        .filter((d) => d.stage === 'media_error' || d.stage === 'stream_missing')
        .map((d) => d.trackId)
        .filter(Boolean) as string[]
    );

    for (const track of tracks) {
      if (this.confirmedPlayableIds.has(track.id)) {
        continue;
      }

      const url = track.audioUrl ? track.audioUrl.trim() : '';

      // 1. Missing or empty audio URL
      if (!url) {
        results.push({
          id: track.id,
          title: track.title || 'Untitled Track',
          artistName: track.artistName || 'Unknown Artist',
          albumTitle: track.albumTitle,
          genre: track.genre,
          coverUrl: track.coverUrl,
          audioUrl: '',
          duration: track.duration,
          reasonCode: 'MISSING_AUDIO_URL',
          reasonTitle: 'Missing Audio Source',
          reasonDescription: 'Track has no audio stream URL attached in the catalog.',
          severity: 'CRITICAL',
          probeStatus: 'CONFIRMED_BROKEN',
          probeDetails: 'No audio URL specified',
          rawTrack: track,
        });
        continue;
      }

      const lowerUrl = url.toLowerCase();

      // 2. Local unstreamable blob (blob: or data:)
      if (lowerUrl.startsWith('blob:') || lowerUrl.startsWith('data:')) {
        results.push({
          id: track.id,
          title: track.title,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          genre: track.genre,
          coverUrl: track.coverUrl,
          audioUrl: url,
          duration: track.duration,
          reasonCode: 'LOCAL_BLOB_UNSTREAMABLE',
          reasonTitle: 'Temporary Local Blob URL',
          reasonDescription: 'Points to an in-memory browser blob. Unplayable for mobile users and other visitors.',
          severity: 'HIGH',
          probeStatus: 'CONFIRMED_BROKEN',
          probeDetails: 'Local client blob not available over network',
          rawTrack: track,
        });
        continue;
      }

      // 3. Local IndexedDB URL without cloud mirror
      if (lowerUrl.startsWith('indexeddb://') || lowerUrl.includes('indexeddb:')) {
        results.push({
          id: track.id,
          title: track.title,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          genre: track.genre,
          coverUrl: track.coverUrl,
          audioUrl: url,
          duration: track.duration,
          reasonCode: 'INDEXEDDB_UNSTREAMABLE',
          reasonTitle: 'Client IndexedDB Source',
          reasonDescription: 'Stored solely in creator’s local browser IndexedDB. Mobile PWA and other visitors cannot stream it.',
          severity: 'HIGH',
          probeStatus: 'CONFIRMED_BROKEN',
          probeDetails: 'Private IndexedDB key cannot be resolved remotely',
          rawTrack: track,
        });
        continue;
      }

      // 4. Dead / 404 local upload path
      if (lowerUrl.startsWith('/audio/uploads/') || lowerUrl.includes('/audio/uploads/')) {
        const rawFile = url.split('/audio/uploads/').pop()?.split('?')[0]?.split('#')[0] || '';
        const isVerified =
          VERIFIED_SERVER_UPLOADS.has(rawFile) ||
          Array.from(VERIFIED_SERVER_UPLOADS).some((v) => v.toLowerCase() === rawFile.toLowerCase());

        // Luther Vandross Never Too Much has dynamic route streamer handling
        const isLutherNeverTooMuch =
          rawFile.toLowerCase().includes('luther') && rawFile.toLowerCase().includes('never_too_much');

        if (!isVerified && !isLutherNeverTooMuch) {
          results.push({
            id: track.id,
            title: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            genre: track.genre,
            coverUrl: track.coverUrl,
            audioUrl: url,
            duration: track.duration,
            reasonCode: 'SERVER_404_NOT_FOUND',
            reasonTitle: '404 File Not Found on Server',
            reasonDescription: `Referenced audio file "${rawFile}" is missing from physical storage and returns 404 Not Found.`,
            severity: 'CRITICAL',
            probeStatus: 'UNTESTED',
            probeDetails: `File ${rawFile} does not exist in public/audio/uploads/`,
            rawTrack: track,
          });
          continue;
        }
      }

      // 5. Cross-Artist Mismatch
      if (isCrossArtistAudioMismatch(track)) {
        results.push({
          id: track.id,
          title: track.title,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          genre: track.genre,
          coverUrl: track.coverUrl,
          audioUrl: url,
          duration: track.duration,
          reasonCode: 'CROSS_ARTIST_MISMATCH',
          reasonTitle: 'Cross-Artist Audio Collision',
          reasonDescription: 'Audio asset filename or metadata belongs to another artist. Blocked by platform integrity policy.',
          severity: 'HIGH',
          probeStatus: 'CONFIRMED_BROKEN',
          probeDetails: 'Cross-artist audio mismatch detected',
          rawTrack: track,
        });
        continue;
      }

      // 6. Recent media error logged in telemetry
      if (mediaErrorTrackIds.has(track.id)) {
        results.push({
          id: track.id,
          title: track.title,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          genre: track.genre,
          coverUrl: track.coverUrl,
          audioUrl: url,
          duration: track.duration,
          reasonCode: 'PLAYBACK_MEDIA_ERROR',
          reasonTitle: 'User Playback Failure Logged',
          reasonDescription: 'Users experienced HTML5 audio playback errors or playback aborted on this track.',
          severity: 'HIGH',
          probeStatus: 'UNTESTED',
          probeDetails: 'Telemetry logged HTML5 media_error',
          rawTrack: track,
        });
        continue;
      }
    }

    return results;
  }

  /**
   * Returns stats on unplayable tracks across the catalog
   */
  public getStats(): UnplayableStats {
    const list = this.scanUnplayableTracks();
    const totalCatalog = MusicCatalogService.getAllTracks().length;

    let server404 = 0;
    let missingAudio = 0;
    let localBlob = 0;
    let playbackError = 0;
    let crossArtist = 0;

    list.forEach((t) => {
      if (t.reasonCode === 'SERVER_404_NOT_FOUND') server404++;
      else if (t.reasonCode === 'MISSING_AUDIO_URL') missingAudio++;
      else if (t.reasonCode === 'LOCAL_BLOB_UNSTREAMABLE' || t.reasonCode === 'INDEXEDDB_UNSTREAMABLE') localBlob++;
      else if (t.reasonCode === 'PLAYBACK_MEDIA_ERROR') playbackError++;
      else if (t.reasonCode === 'CROSS_ARTIST_MISMATCH') crossArtist++;
    });

    const playableCount = Math.max(0, totalCatalog - list.length);
    const healthScore = totalCatalog > 0 ? Math.round((playableCount / totalCatalog) * 100) : 100;

    return {
      totalUnplayable: list.length,
      server404Count: server404,
      missingAudioCount: missingAudio,
      localBlobCount: localBlob,
      playbackErrorCount: playbackError,
      crossArtistMismatchCount: crossArtist,
      catalogHealthScore: healthScore,
    };
  }

  /**
   * Probes an individual track's audio playability in the browser environment
   */
  public async probeAudioStream(audioUrl: string): Promise<{ playable: boolean; statusText: string; error?: string }> {
    if (!audioUrl || typeof window === 'undefined') {
      return { playable: false, statusText: 'Missing URL', error: 'No audio URL provided' };
    }

    const lower = audioUrl.toLowerCase();
    if (lower.startsWith('blob:') || lower.startsWith('data:') || lower.startsWith('indexeddb:')) {
      return { playable: false, statusText: 'Local Only', error: 'Client-only storage source cannot stream across devices' };
    }

    return new Promise((resolve) => {
      const audio = new Audio();
      let resolved = false;

      const cleanup = () => {
        resolved = true;
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        audio.src = '';
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolve({ playable: false, statusText: 'Timeout (5s)', error: 'Audio stream probe timed out after 5 seconds' });
        }
      }, 5000);

      const onCanPlay = () => {
        if (!resolved) {
          clearTimeout(timer);
          cleanup();
          resolve({ playable: true, statusText: 'Verified Playable (canplay triggered)' });
        }
      };

      const onLoaded = () => {
        if (!resolved && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          clearTimeout(timer);
          cleanup();
          resolve({ playable: true, statusText: `Verified Playable (${Math.round(audio.duration)}s)` });
        }
      };

      const onError = () => {
        if (!resolved) {
          clearTimeout(timer);
          const errCode = audio.error ? audio.error.code : 0;
          let msg = 'HTML5 Audio failed to load stream';
          if (errCode === 4) msg = 'Source format not supported or 404 Not Found';
          else if (errCode === 2) msg = 'Network error downloading audio';
          else if (errCode === 3) msg = 'Audio decode error';
          cleanup();
          resolve({ playable: false, statusText: 'Confirmed Broken', error: msg });
        }
      };

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);

      audio.preload = 'metadata';
      audio.src = audioUrl;
      audio.load();
    });
  }

  /**
   * Admin confirms the song is actually playing and clears it from unplayable alerts
   */
  public markConfirmedPlayable(trackId: string): void {
    this.confirmedPlayableIds.add(trackId);
    this.notify();
  }

  /**
   * Permanently deletes a single unplayable track from the platform
   */
  public deleteUnplayableTrack(
    trackId: string,
    adminActor: { id: string; name: string; email: string; role: AdminRole },
    reason: string = 'Purged unplayable track with broken/missing audio source'
  ): boolean {
    try {
      const success = MusicCatalogService.removeTrack(trackId, adminActor, reason, { exactIdOnly: true });

      if (success) {
        AuditLogger.logAction({
          adminId: adminActor.id || 'usr-admin',
          adminName: adminActor.name || 'Platform Administrator',
          adminRole: adminActor.role || 'admin',
          eventType: 'CATALOG_PURGE_UNPLAYABLE',
          action: `Deleted unplayable song ${trackId} from live platform`,
          resource: 'Music Catalog',
          resourceId: trackId,
          newValue: {
            reason,
            status: 'PURGED_UNPLAYABLE',
            deletedAt: new Date().toISOString(),
          },
          status: 'SUCCESS',
        });
      }

      this.notify();
      return success;
    } catch (err) {
      console.error('[UnplayableAudioDetectionService] Deletion error:', err);
      return false;
    }
  }

  /**
   * Batch deletes multiple selected unplayable songs all at one time
   */
  public batchDeleteUnplayableTracks(
    tracks: UnplayableTrackRecord[],
    adminActor: { id: string; name: string; email: string; role: AdminRole },
    reason: string = 'Batch remediation: purged unplayable songs with broken/missing audio sources'
  ): { deletedCount: number; failedCount: number } {
    let deletedCount = 0;
    let failedCount = 0;

    for (const t of tracks) {
      const ok = this.deleteUnplayableTrack(
        t.id,
        adminActor,
        reason || `Batch purge: unplayable track "${t.title}" (${t.id}) — ${t.reasonTitle}`
      );
      if (ok) {
        deletedCount++;
      } else {
        failedCount++;
      }
    }

    if (deletedCount > 0) {
      AuditLogger.logAction({
        adminId: adminActor.id || 'usr-admin',
        adminName: adminActor.name || 'Platform Administrator',
        adminRole: adminActor.role || 'admin',
        eventType: 'CATALOG_PURGE_UNPLAYABLE_BATCH',
        action: `Batch purged ${deletedCount} unplayable songs at once`,
        resource: 'Music Catalog',
        status: 'SUCCESS',
        newValue: {
          totalDeleted: deletedCount,
          totalFailed: failedCount,
          deletedSongs: tracks.map((t) => ({ id: t.id, title: t.title, reason: t.reasonTitle })),
        },
      });
    }

    this.notify();
    return { deletedCount, failedCount };
  }
}

export const UnplayableAudioDetectionService = new UnplayableAudioDetectionServiceClass();

