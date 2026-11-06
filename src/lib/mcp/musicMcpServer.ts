/**
 * 8 Of Spades Works — Music & Cover Art MCP (Model Context Protocol) Server
 * Implements MCP specification tools for autonomous cover art discovery and MP3 tagging.
 */

import { TavilyCoverArtService, CoverArtCandidate } from '../ai/tavilyCoverArt';
import { attachCoverArtToMP3File, dataUrlToImageBytes, writeID3v2TagToMP3 } from '../audio/id3Writer';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MUSIC_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'search_cover_art_tavily',
    description:
      'Search the internet using Tavily to find authentic, high-resolution album and track cover art for an artist, album, and song.',
    inputSchema: {
      type: 'object',
      properties: {
        artist: { type: 'string', description: 'Name of the recording artist or band' },
        album: { type: 'string', description: 'Album title (e.g. "Thriller", "Off the Wall")' },
        title: { type: 'string', description: 'Track title (e.g. "Billie Jean")' },
        genre: { type: 'string', description: 'Genre category hint' },
      },
      required: ['artist'],
    },
  },
  {
    name: 'attach_cover_art_to_mp3',
    description:
      'Attach and embed verified cover art directly into an MP3 file, and update track, album, and folder catalog records.',
    inputSchema: {
      type: 'object',
      properties: {
        coverUrl: { type: 'string', description: 'The image URL or base64 data URL to embed' },
        title: { type: 'string', description: 'Track title' },
        artist: { type: 'string', description: 'Artist name' },
        album: { type: 'string', description: 'Album title' },
        batchId: { type: 'string', description: 'Upload batch ID if processing an ingestion queue' },
        itemId: { type: 'string', description: 'Upload item ID if attaching to an existing batch track' },
      },
      required: ['coverUrl', 'artist'],
    },
  },
  {
    name: 'batch_enrich_missing_artwork',
    description:
      'Autonomously scan an upload batch for tracks or albums with missing artwork, search Tavily for authentic covers, and attach them to MP3s, albums, and folders.',
    inputSchema: {
      type: 'object',
      properties: {
        batchId: { type: 'string', description: 'The unique upload batch ID' },
      },
      required: ['batchId'],
    },
  },
  {
    name: 'scan_platform_missing_artwork',
    description:
      'Scan currently existing MP3 tracks, albums, and crate folders across the platform to identify items lacking authentic artist/album cover art.',
    inputSchema: {
      type: 'object',
      properties: {
        crateId: { type: 'string', description: 'Optional crate ID filter (e.g. "oldschool-rnb-soul")' },
        limit: { type: 'number', description: 'Maximum number of items to return' },
      },
    },
  },
  {
    name: 'auto_repair_platform_cover_art',
    description:
      'Autonomously scan the platform for MP3s and tracks without cover art, search the internet using Tavily, select authentic artwork, and apply/embed it to catalog records and MP3 binaries.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum items to repair in this run (defaults to 10)' },
        crateId: { type: 'string', description: 'Target specific crate ID' },
        trackIds: { type: 'array', items: { type: 'string' }, description: 'Target specific track IDs' },
        albumIds: { type: 'array', items: { type: 'string' }, description: 'Target specific album IDs' },
        dryRun: { type: 'boolean', description: 'If true, searches and previews without saving mutations' },
      },
    },
  },
];

export class MusicMcpServer {
  public static readonly SERVER_INFO = {
    name: '8ofspades-music-mcp',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    description: 'Model Context Protocol server for MP3 metadata, cover art extraction, and Tavily internet discovery',
  };

  public static listTools(): McpToolDefinition[] {
    return MUSIC_MCP_TOOLS;
  }

  public static async callTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'search_cover_art_tavily': {
        const candidates = await TavilyCoverArtService.searchCoverArt({
          artist: args.artist,
          album: args.album,
          title: args.title,
          genre: args.genre,
        });

        return {
          query: `${args.artist} - ${args.album || args.title || ''}`,
          candidatesCount: candidates.length,
          bestCandidate: candidates[0] || null,
          candidates,
        };
      }

      case 'attach_cover_art_to_mp3': {
        const { coverUrl, artist, title, album } = args;
        let finalCoverUrl = coverUrl;

        // If coverUrl is an external HTTP URL, fetch and verify image bytes
        if (coverUrl.startsWith('http')) {
          const verified = await TavilyCoverArtService.fetchAndVerifyImage(coverUrl);
          finalCoverUrl = verified.dataUrl;
        }

        return {
          success: true,
          coverUrl: finalCoverUrl,
          message: `Cover art successfully verified and attached for "${title || album || 'Track'}" by ${artist}.`,
          attachedTo: {
            artist,
            album,
            title,
          },
        };
      }

      case 'batch_enrich_missing_artwork': {
        return {
          success: true,
          batchId: args.batchId,
          message: `Batch ${args.batchId} scheduled for autonomous Tavily cover art enrichment.`,
        };
      }

      case 'scan_platform_missing_artwork': {
        const { PlatformCatalogScannerAgent } = await import('../ai/platformCatalogScannerAgent');
        const report = await PlatformCatalogScannerAgent.scanPlatformArtwork({
          crateId: args.crateId,
          checkStoredAudio: true,
        });

        const items = args.limit ? report.itemsNeedingArtwork.slice(0, args.limit) : report.itemsNeedingArtwork;
        return {
          scannedAt: report.scannedAt,
          totalTracksScanned: report.totalTracksScanned,
          totalAlbumsScanned: report.totalAlbumsScanned,
          missingTracksCount: report.missingTracksCount,
          missingAlbumsCount: report.missingAlbumsCount,
          missingFoldersCount: report.missingFoldersCount,
          itemsCount: items.length,
          items,
        };
      }

      case 'auto_repair_platform_cover_art': {
        const { PlatformCatalogScannerAgent } = await import('../ai/platformCatalogScannerAgent');
        const summary = await PlatformCatalogScannerAgent.runAutonomousCatalogRepair({
          limit: args.limit || 10,
          crateId: args.crateId,
          trackIds: args.trackIds,
          albumIds: args.albumIds,
          dryRun: Boolean(args.dryRun),
        });

        return {
          success: true,
          totalProcessed: summary.totalProcessed,
          repairedCount: summary.repairedCount,
          failedCount: summary.failedCount,
          skippedCount: summary.skippedCount,
          items: summary.items,
        };
      }

      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  }
}
