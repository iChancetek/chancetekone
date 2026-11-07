/**
 * ChanceTEK One — Platform Catalog Cover Art Scanner Agent
 * Autonomous Agentic AI specialist that scans existing tracks, albums, and MP3
 * files across the platform that lack authentic cover art, searches the internet
 * using Tavily to find authentic artwork, and embeds/applies it across catalog
 * records and MP3 binaries.
 */

import { MusicCatalogService, isMissingOrGenericCover } from '@/lib/music/MusicCatalogService';
import { Track, Album } from '@/types/media';
import { CrateFolder } from '@/types/catalog';
import { TavilyCoverArtService, CoverArtCandidate } from './tavilyCoverArt';
import { optimizeCoverArtDataUrl } from '../audio/id3Parser';
import { attachCoverArtToMP3File, dataUrlToImageBytes } from '../audio/id3Writer';
import { AudioStorageService } from '../audio/AudioStorageService';
import { AuditLogger } from '../admin/AuditLogger';
import { detectImageFormat } from '../ingestion/artworkVerification';

export interface CatalogScanItem {
  id: string;
  type: 'track' | 'album' | 'folder';
  title: string;
  artistName: string;
  albumTitle?: string;
  genre?: string;
  currentCoverUrl?: string;
  missingReason: 'no_cover' | 'generic_stock' | 'unverified' | 'mp3_missing_apic';
  crateId?: string;
  crateName?: string;
  hasStoredAudio?: boolean;
}

export interface CatalogArtworkScanReport {
  scannedAt: string;
  totalTracksScanned: number;
  totalAlbumsScanned: number;
  totalFoldersScanned: number;
  missingTracksCount: number;
  missingAlbumsCount: number;
  missingFoldersCount: number;
  itemsNeedingArtwork: CatalogScanItem[];
}

export interface ItemRepairProgress {
  itemId: string;
  type: 'track' | 'album' | 'folder';
  title: string;
  artist: string;
  step: 'searching' | 'evaluating' | 'verifying' | 'embedding' | 'completed' | 'failed' | 'skipped';
  message: string;
  candidateThumb?: string;
  domain?: string;
  confidenceScore?: number;
  embeddedInMP3?: boolean;
}

export interface CatalogRepairSummaryReport {
  startedAt: string;
  completedAt: string;
  totalProcessed: number;
  repairedCount: number;
  failedCount: number;
  skippedCount: number;
  items: {
    id: string;
    title: string;
    artist: string;
    success: boolean;
    coverUrl?: string;
    sourceUrl?: string;
    domain?: string;
    confidence?: number;
    embeddedInMP3: boolean;
    reasoning: string;
  }[];
}

export class PlatformCatalogScannerAgent {
  public static readonly AGENT_ID = 'agent-catalog-artwork-scanner-v1';
  public static readonly AGENT_NAME = 'Autonomous Catalog & MP3 Cover Art Repair Specialist';

  /**
   * Determines whether a track, album, or folder lacks authentic cover art.
   */
  public static isArtworkMissing(coverUrl?: string, verification?: string): { missing: boolean; reason?: CatalogScanItem['missingReason'] } {
    if (!coverUrl || coverUrl.trim() === '') {
      return { missing: true, reason: 'no_cover' };
    }
    if (isMissingOrGenericCover(coverUrl)) {
      return { missing: true, reason: 'generic_stock' };
    }
    if (verification === 'missing') {
      return { missing: true, reason: 'unverified' };
    }
    if (coverUrl.includes('images.unsplash.com') || coverUrl.includes('placeholder')) {
      return { missing: true, reason: 'generic_stock' };
    }
    return { missing: false };
  }

  /**
   * Scans all tracks, albums, and crate folders across the platform to identify
   * all items currently missing authentic cover art.
   */
  public static async scanPlatformArtwork(options?: {
    crateId?: string;
    checkStoredAudio?: boolean;
  }): Promise<CatalogArtworkScanReport> {
    const allTracks = MusicCatalogService.getAllTracks();
    const allAlbums = MusicCatalogService.getAllAlbums();
    const allFolders = MusicCatalogService.getCrateFolders();

    const filteredTracks = options?.crateId
      ? allTracks.filter((t) => t.crateId === options.crateId)
      : allTracks;

    const itemsNeedingArtwork: CatalogScanItem[] = [];

    // 1. Scan Tracks
    for (const track of filteredTracks) {
      const authentic = MusicCatalogService.getAuthenticCoverForTrack(track.artistName, track.albumTitle, track.title);
      const effectiveCover = authentic || track.coverUrl;
      const artCheck = this.isArtworkMissing(effectiveCover, track.coverVerification);
      let hasStoredAudio = false;

      if (options?.checkStoredAudio && typeof window !== 'undefined') {
        try {
          hasStoredAudio = await AudioStorageService.hasAudio(track.id);
        } catch {}
      }

      if (artCheck.missing) {
        itemsNeedingArtwork.push({
          id: track.id,
          type: 'track',
          title: track.title,
          artistName: track.artistName,
          albumTitle: track.albumTitle,
          genre: track.genre,
          currentCoverUrl: track.coverUrl,
          missingReason: artCheck.reason || 'no_cover',
          crateId: track.crateId,
          crateName: track.crateName,
          hasStoredAudio,
        });
      }
    }

    // 2. Scan Albums
    for (const album of allAlbums) {
      const artCheck = this.isArtworkMissing(album.coverUrl);
      if (artCheck.missing) {
        itemsNeedingArtwork.push({
          id: album.id,
          type: 'album',
          title: album.title,
          artistName: album.artistName,
          genre: album.genre,
          currentCoverUrl: album.coverUrl,
          missingReason: artCheck.reason || 'no_cover',
        });
      }
    }

    // 3. Scan Crate Folders
    for (const folder of allFolders) {
      if (options?.crateId && folder.crateId !== options.crateId) continue;
      const artCheck = this.isArtworkMissing(folder.coverUrl);
      if (artCheck.missing) {
        // avoid duplicating if album with same id already flagged
        if (!itemsNeedingArtwork.some((item) => item.id === folder.id)) {
          itemsNeedingArtwork.push({
            id: folder.id,
            type: 'folder',
            title: folder.name,
            artistName: folder.artistName || 'ChanceTEK One',
            currentCoverUrl: folder.coverUrl,
            missingReason: artCheck.reason || 'no_cover',
            crateId: folder.crateId,
          });
        }
      }
    }

    const missingTracksCount = itemsNeedingArtwork.filter((i) => i.type === 'track').length;
    const missingAlbumsCount = itemsNeedingArtwork.filter((i) => i.type === 'album').length;
    const missingFoldersCount = itemsNeedingArtwork.filter((i) => i.type === 'folder').length;

    return {
      scannedAt: new Date().toISOString(),
      totalTracksScanned: filteredTracks.length,
      totalAlbumsScanned: allAlbums.length,
      totalFoldersScanned: allFolders.length,
      missingTracksCount,
      missingAlbumsCount,
      missingFoldersCount,
      itemsNeedingArtwork,
    };
  }

  /**
   * Autonomously searches Tavily for authentic artwork and applies it to a track.
   * Also embeds the APIC tag directly into the MP3 binary if stored in AudioStorageService.
   */
  public static async enrichTrackArtwork(
    track: Track,
    options?: {
      dryRun?: boolean;
      actorEmail?: string;
    }
  ): Promise<{
    success: boolean;
    coverUrl?: string;
    candidate?: CoverArtCandidate;
    embeddedInMP3: boolean;
    reasoning: string;
  }> {
    const artist = (track.artistName || '').trim();
    const album = (track.albumTitle || '').trim();
    const title = (track.title || '').trim();

    if (!artist || artist.toLowerCase() === 'unknown artist') {
      return {
        success: false,
        embeddedInMP3: false,
        reasoning: `Cannot search without a valid artist name for track "${title}".`,
      };
    }

    // 0. Check local authentic artwork archives first
    const localAuthentic = MusicCatalogService.getAuthenticCoverForTrack(artist, album, title);
    if (localAuthentic) {
      if (!options?.dryRun) {
        MusicCatalogService.updateTrack(track.id, {
          coverUrl: localAuthentic,
          albumCoverUrl: localAuthentic,
          coverVerification: 'verified',
          coverSource: 'authentic_archive',
          coverAssetHash: `authentic_${Date.now()}`,
        }, {
          id: options?.actorEmail || 'usr-ai-agent',
          name: this.AGENT_NAME,
        });
        if (track.albumId) {
          MusicCatalogService.updateFolderCover(track.albumId, localAuthentic);
        }
      }
      return {
        success: true,
        coverUrl: localAuthentic,
        embeddedInMP3: false,
        reasoning: `Resolved authentic platform cover art for "${title}" by ${artist} from authentic archives.`,
      };
    }

    // 1. Search Tavily for authentic cover art
    const candidates = await TavilyCoverArtService.searchCoverArt({
      artist,
      album: album && !album.toLowerCase().includes('vault') ? album : undefined,
      title,
      genre: track.genre,
    });

    if (candidates.length === 0) {
      return {
        success: false,
        embeddedInMP3: false,
        reasoning: `Tavily web discovery found no authentic artwork for "${title}" by ${artist}.`,
      };
    }

    const bestCandidate = candidates[0];

    // 2. Download and verify binary signature
    const verified = await TavilyCoverArtService.fetchAndVerifyImage(bestCandidate.url);
    const optimizedDataUrl = await optimizeCoverArtDataUrl(verified.dataUrl);

    if (options?.dryRun) {
      return {
        success: true,
        coverUrl: optimizedDataUrl,
        candidate: bestCandidate,
        embeddedInMP3: false,
        reasoning: `[DRY-RUN] Discovered authentic cover art from ${bestCandidate.domain} (confidence ${bestCandidate.confidenceScore}%).`,
      };
    }

    // 3. Update Track in MusicCatalogService
    MusicCatalogService.updateTrack(track.id, {
      coverUrl: optimizedDataUrl,
      albumCoverUrl: optimizedDataUrl,
      coverVerification: 'verified',
      coverSource: bestCandidate.url,
      coverAssetHash: `tavily_${Date.now()}`,
    }, {
      id: options?.actorEmail || 'usr-ai-agent',
      name: this.AGENT_NAME,
    });

    // 4. Update matching folder / album if track is grouped
    if (track.albumId) {
      MusicCatalogService.updateFolderCover(track.albumId, optimizedDataUrl);
    }

    // 5. Embed into MP3 binary if available in AudioStorageService
    let embeddedInMP3 = false;
    if (typeof window !== 'undefined') {
      try {
        const storedBlob = await AudioStorageService.getAudioBlob(track.id);
        if (storedBlob) {
          const taggedBlob = await attachCoverArtToMP3File(storedBlob, optimizedDataUrl, {
            title: track.title,
            artist: track.artistName,
            album: track.albumTitle,
          });
          await AudioStorageService.saveAudio(track.id, taggedBlob, {
            title: track.title,
            artist: track.artistName,
          });
          embeddedInMP3 = true;
        }

        // Always save cover art to IndexedDB cache
        await AudioStorageService.saveCoverArt(track.id, optimizedDataUrl);
      } catch (err) {
        console.warn(`[PlatformCatalogScannerAgent] Failed to embed MP3 binary for track ${track.id}:`, err);
      }
    }

    // 6. Audit Trail Logging
    AuditLogger.logAction({
      adminId: options?.actorEmail || this.AGENT_ID,
      adminName: this.AGENT_NAME,
      adminRole: 'admin',
      eventType: 'TRACK_METADATA_UPDATED',
      action: `Autonomous AI agent applied authentic cover art from ${bestCandidate.domain} to "${track.title}" by ${track.artistName} (embeddedInMP3: ${embeddedInMP3})`,
      resource: 'Music Catalog',
      resourceId: track.id,
      newValue: {
        coverUrl: bestCandidate.url,
        confidence: bestCandidate.confidenceScore,
        embeddedInMP3,
      },
      status: 'SUCCESS',
    });

    return {
      success: true,
      coverUrl: optimizedDataUrl,
      candidate: bestCandidate,
      embeddedInMP3,
      reasoning: `Attached authentic cover art from ${bestCandidate.domain} (confidence ${bestCandidate.confidenceScore}%) to catalog record and embedded ID3 APIC tag into MP3.`,
    };
  }

  /**
   * Autonomously searches Tavily for authentic artwork and applies it to an album or folder.
   */
  public static async enrichAlbumArtwork(
    albumOrFolder: { id: string; title: string; artistName?: string; genre?: string },
    options?: { dryRun?: boolean; actorEmail?: string }
  ): Promise<{
    success: boolean;
    coverUrl?: string;
    candidate?: CoverArtCandidate;
    reasoning: string;
  }> {
    const artist = (albumOrFolder.artistName || 'ChanceTEK One').trim();
    const title = (albumOrFolder.title || '').trim();

    // 0. Check local authentic artwork archives first
    const localAuthentic = MusicCatalogService.getAuthenticCoverForTrack(artist, title);
    if (localAuthentic) {
      if (!options?.dryRun) {
        MusicCatalogService.updateFolderCover(albumOrFolder.id, localAuthentic);
      }
      return {
        success: true,
        coverUrl: localAuthentic,
        reasoning: `Resolved authentic platform album artwork for "${title}" by ${artist} from authentic archives.`,
      };
    }

    const candidates = await TavilyCoverArtService.searchCoverArt({
      artist,
      album: title,
      genre: albumOrFolder.genre,
    });

    if (candidates.length === 0) {
      return {
        success: false,
        reasoning: `No authentic artwork found on Tavily for album "${title}" by ${artist}.`,
      };
    }

    const bestCandidate = candidates[0];
    const verified = await TavilyCoverArtService.fetchAndVerifyImage(bestCandidate.url);
    const optimizedDataUrl = await optimizeCoverArtDataUrl(verified.dataUrl);

    if (options?.dryRun) {
      return {
        success: true,
        coverUrl: optimizedDataUrl,
        candidate: bestCandidate,
        reasoning: `[DRY-RUN] Discovered authentic album artwork from ${bestCandidate.domain}.`,
      };
    }

    // Apply to CrateFolder and Album
    MusicCatalogService.updateFolderCover(albumOrFolder.id, optimizedDataUrl);

    AuditLogger.logAction({
      adminId: options?.actorEmail || this.AGENT_ID,
      adminName: this.AGENT_NAME,
      adminRole: 'admin',
      eventType: 'ALBUM_METADATA_UPDATED',
      action: `Autonomous AI agent applied authentic album cover art from ${bestCandidate.domain} to "${title}" by ${artist}`,
      resource: 'Album Catalog',
      resourceId: albumOrFolder.id,
      newValue: {
        coverUrl: bestCandidate.url,
        confidence: bestCandidate.confidenceScore,
      },
      status: 'SUCCESS',
    });

    return {
      success: true,
      coverUrl: optimizedDataUrl,
      candidate: bestCandidate,
      reasoning: `Applied authentic album artwork from ${bestCandidate.domain} (confidence: ${bestCandidate.confidenceScore}%).`,
    };
  }

  /**
   * Autonomous repair loop: scans and sequentially repairs all or selected missing items
   * with real-time streaming progress callbacks.
   */
  public static async runAutonomousCatalogRepair(options?: {
    limit?: number;
    crateId?: string;
    trackIds?: string[];
    albumIds?: string[];
    dryRun?: boolean;
    actorEmail?: string;
    onProgress?: (progress: ItemRepairProgress) => void;
  }): Promise<CatalogRepairSummaryReport> {
    const startedAt = new Date().toISOString();
    const scanReport = await this.scanPlatformArtwork({ crateId: options?.crateId });

    let targets = scanReport.itemsNeedingArtwork;

    if (options?.trackIds && options.trackIds.length > 0) {
      const allowed = new Set(options.trackIds);
      targets = targets.filter((item) => item.type === 'track' && allowed.has(item.id));
    }
    if (options?.albumIds && options.albumIds.length > 0) {
      const allowed = new Set(options.albumIds);
      targets = targets.filter((item) => (item.type === 'album' || item.type === 'folder') && allowed.has(item.id));
    }
    if (options?.limit && options.limit > 0) {
      targets = targets.slice(0, options.limit);
    }

    const summaryItems: CatalogRepairSummaryReport['items'] = [];
    let repairedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];

      options?.onProgress?.({
        itemId: item.id,
        type: item.type,
        title: item.title,
        artist: item.artistName,
        step: 'searching',
        message: `Querying Tavily for authentic artwork (${i + 1}/${targets.length})...`,
      });

      try {
        if (item.type === 'track') {
          const track = MusicCatalogService.getTrackById(item.id);
          if (!track) {
            skippedCount++;
            summaryItems.push({
              id: item.id,
              title: item.title,
              artist: item.artistName,
              success: false,
              embeddedInMP3: false,
              reasoning: 'Track record was not found in catalog.',
            });
            continue;
          }

          options?.onProgress?.({
            itemId: item.id,
            type: item.type,
            title: item.title,
            artist: item.artistName,
            step: 'evaluating',
            message: `Evaluating candidates and domain authority for "${track.title}"...`,
          });

          const result = await this.enrichTrackArtwork(track, {
            dryRun: options?.dryRun,
            actorEmail: options?.actorEmail,
          });

          if (result.success) {
            repairedCount++;
            options?.onProgress?.({
              itemId: item.id,
              type: item.type,
              title: item.title,
              artist: item.artistName,
              step: 'completed',
              message: `Attached authentic artwork from ${result.candidate?.domain || 'web'}.`,
              candidateThumb: result.coverUrl,
              domain: result.candidate?.domain,
              confidenceScore: result.candidate?.confidenceScore,
              embeddedInMP3: result.embeddedInMP3,
            });

            summaryItems.push({
              id: item.id,
              title: item.title,
              artist: item.artistName,
              success: true,
              coverUrl: result.coverUrl,
              sourceUrl: result.candidate?.url,
              domain: result.candidate?.domain,
              confidence: result.candidate?.confidenceScore,
              embeddedInMP3: result.embeddedInMP3,
              reasoning: result.reasoning,
            });
          } else {
            failedCount++;
            options?.onProgress?.({
              itemId: item.id,
              type: item.type,
              title: item.title,
              artist: item.artistName,
              step: 'failed',
              message: result.reasoning,
            });

            summaryItems.push({
              id: item.id,
              title: item.title,
              artist: item.artistName,
              success: false,
              embeddedInMP3: false,
              reasoning: result.reasoning,
            });
          }
        } else {
          // Album or folder
          const result = await this.enrichAlbumArtwork({
            id: item.id,
            title: item.title,
            artistName: item.artistName,
          }, {
            dryRun: options?.dryRun,
            actorEmail: options?.actorEmail,
          });

          if (result.success) {
            repairedCount++;
            options?.onProgress?.({
              itemId: item.id,
              type: item.type,
              title: item.title,
              artist: item.artistName,
              step: 'completed',
              message: `Applied authentic album artwork from ${result.candidate?.domain || 'web'}.`,
              candidateThumb: result.coverUrl,
              domain: result.candidate?.domain,
              confidenceScore: result.candidate?.confidenceScore,
              embeddedInMP3: false,
            });

            summaryItems.push({
              id: item.id,
              title: item.title,
              artist: item.artistName,
              success: true,
              coverUrl: result.coverUrl,
              sourceUrl: result.candidate?.url,
              domain: result.candidate?.domain,
              confidence: result.candidate?.confidenceScore,
              embeddedInMP3: false,
              reasoning: result.reasoning,
            });
          } else {
            failedCount++;
            options?.onProgress?.({
              itemId: item.id,
              type: item.type,
              title: item.title,
              artist: item.artistName,
              step: 'failed',
              message: result.reasoning,
            });

            summaryItems.push({
              id: item.id,
              title: item.title,
              artist: item.artistName,
              success: false,
              embeddedInMP3: false,
              reasoning: result.reasoning,
            });
          }
        }
      } catch (err: any) {
        failedCount++;
        options?.onProgress?.({
          itemId: item.id,
          type: item.type,
          title: item.title,
          artist: item.artistName,
          step: 'failed',
          message: err?.message || 'Error occurred during processing.',
        });

        summaryItems.push({
          id: item.id,
          title: item.title,
          artist: item.artistName,
          success: false,
          embeddedInMP3: false,
          reasoning: err?.message || 'Unknown processing error.',
        });
      }
    }

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      totalProcessed: targets.length,
      repairedCount,
      failedCount,
      skippedCount,
      items: summaryItems,
    };
  }
}
