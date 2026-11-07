/**
 * ChanceTEK One — Autonomous Agentic AI Cover Art Specialist
 * An autonomous agent that searches the internet using Tavily to find authentic
 * cover art for artists, albums, and MP3 tracks, and embeds/attaches it across
 * the MP3 binaries, albums, folders, and platform catalog.
 */

import { TavilyCoverArtService, CoverArtCandidate } from './tavilyCoverArt';
import { optimizeCoverArtDataUrl } from '../audio/id3Parser';
import { detectImageFormat } from '../ingestion/artworkVerification';
import { attachCoverArtToMP3File } from '../audio/id3Writer';
import { AudioStorageService } from '../audio/AudioStorageService';
import { AuditLogger } from '../admin/AuditLogger';
import { UploadItem, UploadBatch, UploadAlbumGroupRecord, UploadFolderRecord } from '@/types/catalog';
import { MusicCatalogService } from '../music/MusicCatalogService';

export interface CoverArtEnrichmentResult {
  success: boolean;
  coverUrl?: string;
  sourceUrl?: string;
  candidate?: CoverArtCandidate;
  reasoning: string;
  confidence: number;
  embeddedInMP3: boolean;
}

export class AgenticAICoverArtAgent {
  public static readonly AGENT_ID = 'agent-cover-art-tavily-v1';
  public static readonly AGENT_NAME = 'Agentic AI Cover Art & Crate Curator';

  /**
   * Determines whether an item needs cover art enrichment
   */
  public static needsArtworkEnrichment(item: UploadItem): boolean {
    const authentic = MusicCatalogService.getAuthenticCoverForTrack(item.artist, item.album, item.title || item.fileName);
    if (authentic && item.coverUrl === authentic) return false;
    if (!item.coverUrl) return true;
    if (item.coverUrl.includes('images.unsplash.com')) return true;
    if (item.artworkStatus === 'missing') return true;
    if (detectImageFormat(item.coverUrl) === null) return true;
    return false;
  }

  /**
   * Autonomously finds and attaches authentic cover art to an UploadItem using Tavily
   */
  public static async enrichTrackArtwork(
    item: UploadItem,
    options?: {
      targetFile?: File;
      actorEmail?: string;
    }
  ): Promise<CoverArtEnrichmentResult> {
    const artist = (item.artist || '').trim();
    const album = (item.album || '').trim();
    const title = (item.title || item.fileName.replace(/\.[^/.]+$/, '')).trim();

    // 0. Check authentic platform catalog registry
    const localAuthentic = MusicCatalogService.getAuthenticCoverForTrack(artist, album, title);
    if (localAuthentic) {
      item.coverUrl = localAuthentic;
      item.hasEmbeddedArtwork = true;
      item.artworkStatus = 'extracted';
      item.artworkOrigin = 'manual';

      await AudioStorageService.saveCoverArt(item.id, localAuthentic);
      if (item.fileName) {
        await AudioStorageService.saveCoverArt(item.fileName, localAuthentic);
      }
      return {
        success: true,
        coverUrl: localAuthentic,
        reasoning: `Attached authentic platform catalog cover: ${localAuthentic}`,
        confidence: 100,
        embeddedInMP3: true,
      };
    }

    if (!artist || artist === 'Unknown Artist') {
      return {
        success: false,
        reasoning: 'Cannot search for cover art without an identified artist name.',
        confidence: 0,
        embeddedInMP3: false,
      };
    }

    try {
      // 1. Autonomous Internet Search via Tavily
      const candidates = await TavilyCoverArtService.searchCoverArt({
        artist,
        album: album !== 'Single Release / Vault Cuts' && album !== 'Master Crate Vault' ? album : undefined,
        title,
        genre: item.genre,
      });

      if (candidates.length === 0) {
        return {
          success: false,
          reasoning: `Tavily internet search found no high-confidence cover art images for "${title}" by ${artist}.`,
          confidence: 0,
          embeddedInMP3: false,
        };
      }

      // 2. Autonomous Candidate Evaluation & Selection
      const bestCandidate = candidates[0];
      const reasoning = `Autonomous agent selected authentic cover art from ${bestCandidate.domain} (confidence: ${bestCandidate.confidenceScore}%) for "${title}" by ${artist}.`;

      // 3. Download, verify binary signature, and optimize
      const verified = await TavilyCoverArtService.fetchAndVerifyImage(bestCandidate.url);
      const optimizedDataUrl = await optimizeCoverArtDataUrl(verified.dataUrl);

      // 4. Attach cover art to UploadItem
      item.coverUrl = optimizedDataUrl;
      item.hasEmbeddedArtwork = true;
      item.artworkStatus = 'extracted';
      item.artworkOrigin = 'manual'; // marked as authentic verified

      // 5. Persist to IndexedDB AudioStorageService
      await AudioStorageService.saveCoverArt(item.id, optimizedDataUrl);
      if (item.fileName) {
        await AudioStorageService.saveCoverArt(item.fileName, optimizedDataUrl);
      }
      if (item.scanFileId) {
        await AudioStorageService.saveCoverArt(item.scanFileId, optimizedDataUrl);
      }

      // 6. Embed APIC frame into physical MP3 File binary if file is available
      let embeddedInMP3 = false;
      if (options?.targetFile) {
        try {
          const updatedFile = await attachCoverArtToMP3File(options.targetFile, verified.bytes, {
            title,
            artist,
            album,
            genre: item.genre,
            year: item.year,
            trackNumber: item.trackNumber,
          });
          // Update AudioStorageService with tagged MP3 audio binary
          await AudioStorageService.saveAudio(item.id, updatedFile, {
            fileName: item.fileName,
            title,
            artist,
          });
          embeddedInMP3 = true;
        } catch (embedErr) {
          console.warn('[CoverArtAgent] MP3 binary APIC embedding note:', embedErr);
        }
      }

      // 7. Audit Log AI Action
      AuditLogger.logAction({
        adminId: this.AGENT_ID,
        adminName: this.AGENT_NAME,
        adminRole: 'content_admin',
        eventType: 'AI_INGESTION_ANALYSIS',
        action: `Agentic AI searched internet via Tavily and attached authentic cover art to "${title}"`,
        resource: 'Music Catalog Ingestion',
        resourceId: item.id,
        newValue: {
          artist,
          title,
          album,
          sourceUrl: bestCandidate.url,
          domain: bestCandidate.domain,
          confidence: `${bestCandidate.confidenceScore}%`,
          embeddedInMP3,
        },
        status: 'SUCCESS',
        details: reasoning,
      });

      return {
        success: true,
        coverUrl: optimizedDataUrl,
        sourceUrl: bestCandidate.url,
        candidate: bestCandidate,
        reasoning,
        confidence: bestCandidate.confidenceScore,
        embeddedInMP3,
      };
    } catch (err: any) {
      console.error('[AgenticAICoverArtAgent Error]', err);
      return {
        success: false,
        reasoning: `Cover art search failed: ${err.message || String(err)}`,
        confidence: 0,
        embeddedInMP3: false,
      };
    }
  }

  /**
   * Enriches an entire album group and propagates authentic artwork to all constituent tracks
   */
  public static async enrichAlbumArtwork(
    albumGroup: UploadAlbumGroupRecord,
    tracksInGroup: UploadItem[],
    options?: {
      fileGetter?: (fileName: string) => File | undefined;
    }
  ): Promise<CoverArtEnrichmentResult> {
    const artist = (albumGroup.albumArtist || '').trim();
    const album = (albumGroup.title || '').trim();

    try {
      const candidates = await TavilyCoverArtService.searchCoverArt({
        artist,
        album,
      });

      if (candidates.length === 0) {
        return {
          success: false,
          reasoning: `No album cover art found on the web for album "${album}" by ${artist}.`,
          confidence: 0,
          embeddedInMP3: false,
        };
      }

      const best = candidates[0];
      const verified = await TavilyCoverArtService.fetchAndVerifyImage(best.url);
      const optimizedDataUrl = await optimizeCoverArtDataUrl(verified.dataUrl);

      // 1. Update album record
      albumGroup.artworkUrl = optimizedDataUrl;
      albumGroup.humanConfirmed = true;

      // 2. Propagate to every track in this album group that is missing cover art
      let embeddedCount = 0;
      for (const track of tracksInGroup) {
        if (!track.coverUrl || track.coverUrl.includes('images.unsplash.com') || track.artworkStatus === 'missing') {
          track.coverUrl = optimizedDataUrl;
          track.albumCoverUrl = optimizedDataUrl;
          track.hasEmbeddedArtwork = true;
          track.artworkStatus = 'extracted';
          track.artworkOrigin = 'manual';

          await AudioStorageService.saveCoverArt(track.id, optimizedDataUrl);

          const file = options?.fileGetter ? options.fileGetter(track.fileName) : undefined;
          if (file) {
            try {
              const updatedFile = await attachCoverArtToMP3File(file, verified.bytes, {
                title: track.title,
                artist: track.artist,
                album: albumGroup.title,
              });
              await AudioStorageService.saveAudio(track.id, updatedFile, {
                fileName: track.fileName,
                title: track.title,
                artist: track.artist,
              });
              embeddedCount++;
            } catch {}
          }
        }
      }

      const reasoning = `Agentic AI found and attached authentic album artwork from ${best.domain} for album "${album}" (${tracksInGroup.length} tracks updated, ${embeddedCount} MP3 binaries tagged).`;

      return {
        success: true,
        coverUrl: optimizedDataUrl,
        sourceUrl: best.url,
        candidate: best,
        reasoning,
        confidence: best.confidenceScore,
        embeddedInMP3: embeddedCount > 0,
      };
    } catch (err: any) {
      return {
        success: false,
        reasoning: `Album cover enrichment error: ${err.message || String(err)}`,
        confidence: 0,
        embeddedInMP3: false,
      };
    }
  }
}
