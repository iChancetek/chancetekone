import { NextRequest, NextResponse } from 'next/server';
import { PlatformCatalogScannerAgent } from '@/lib/ai/platformCatalogScannerAgent';
import fs from 'fs';
import path from 'path';
import { TavilyCoverArtService } from '@/lib/ai/tavilyCoverArt';
import { extractCoverArtFromBuffer } from '@/lib/audio/id3Parser';
import { writeID3v2TagToMP3, dataUrlToImageBytes } from '@/lib/audio/id3Writer';

export const runtime = 'nodejs';

/**
 * GET /api/ai/catalog-artwork-scan
 * Returns diagnostic inventory of missing artwork across platform tracks and albums.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const crateId = searchParams.get('crateId') || undefined;

    const report = await PlatformCatalogScannerAgent.scanPlatformArtwork({ crateId });

    // Also inspect public/audio/uploads directory on the server
    const uploadsDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
    let localMp3Stats = {
      totalLocalMp3s: 0,
      missingCoverArtCount: 0,
      filesNeedingArt: [] as string[],
    };

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter((f) => f.endsWith('.mp3'));
      localMp3Stats.totalLocalMp3s = files.length;

      for (const file of files) {
        try {
          const filePath = path.join(uploadsDir, file);
          const fd = fs.openSync(filePath, 'r');
          const headerBuf = Buffer.alloc(256 * 1024);
          const bytesRead = fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
          fs.closeSync(fd);

          const art = extractCoverArtFromBuffer(headerBuf.subarray(0, bytesRead));
          if (!art) {
            localMp3Stats.missingCoverArtCount++;
            localMp3Stats.filesNeedingArt.push(file);
          }
        } catch {}
      }
    }

    return NextResponse.json({
      status: 'success',
      report,
      localMp3Stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Failed to scan catalog artwork' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/catalog-artwork-scan
 * Executes autonomous scan and auto-repair.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      limit = 10,
      crateId,
      trackIds,
      albumIds,
      dryRun = false,
      repairLocalMp3Files = false,
    } = body;

    // 1. Run Autonomous Catalog Repair
    const summary = await PlatformCatalogScannerAgent.runAutonomousCatalogRepair({
      limit,
      crateId,
      trackIds,
      albumIds,
      dryRun,
    });

    // 2. Optionally repair local physical MP3 files in public/audio/uploads if requested
    const localRepairs: Array<{ file: string; success: boolean; error?: string }> = [];
    if (repairLocalMp3Files && !dryRun) {
      const uploadsDir = path.join(process.cwd(), 'public', 'audio', 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir).filter((f) => f.endsWith('.mp3'));
        for (const file of files) {
          try {
            const filePath = path.join(uploadsDir, file);
            const buf = fs.readFileSync(filePath);
            const art = extractCoverArtFromBuffer(buf);
            if (!art) {
              // Parse artist and title from filename (e.g. "Artist_-_Title.mp3" or "Artist_Title.mp3")
              const cleanName = file.replace(/\.mp3$/i, '').replace(/_/g, ' ');
              const parts = cleanName.split('-');
              const artist = parts[0]?.trim() || 'ChanceTEKone';
              const title = (parts[1] || parts[0]).trim();

              const candidates = await TavilyCoverArtService.searchCoverArt({ artist, title });
              if (candidates.length > 0) {
                const verified = await TavilyCoverArtService.fetchAndVerifyImage(candidates[0].url);
                const imageBytes = dataUrlToImageBytes(verified.dataUrl);
                const taggedBuffer = writeID3v2TagToMP3(new Uint8Array(buf), {
                  title,
                  artist,
                  coverImageBytes: imageBytes.bytes,
                  coverMimeType: verified.mimeType || 'image/jpeg',
                });
                fs.writeFileSync(filePath, Buffer.from(taggedBuffer));
                localRepairs.push({ file, success: true });
              } else {
                localRepairs.push({ file, success: false, error: 'No candidates found' });
              }
            }
          } catch (err: any) {
            localRepairs.push({ file, success: false, error: err?.message });
          }
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      summary,
      localRepairs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Auto-repair execution failed' },
      { status: 500 }
    );
  }
}
