import fs from 'fs';
import path from 'path';

// Load .env.local for local script execution
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

import assert from 'assert';
import { PlatformCatalogScannerAgent } from '../src/lib/ai/platformCatalogScannerAgent';
import { MusicCatalogService } from '../src/lib/music/MusicCatalogService';
import { MusicMcpServer } from '../src/lib/mcp/musicMcpServer';
import { writeID3v2TagToMP3 } from '../src/lib/audio/id3Writer';
import { extractCoverArtFromBuffer, parseMP3File } from '../src/lib/audio/id3Parser';
import { TavilyCoverArtService } from '../src/lib/ai/tavilyCoverArt';

// 1x1 test red JPEG
const SAMPLE_JPEG_BASE64 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runTests() {
  console.log('\n--- Test 1: Platform Catalog Artwork Scanner ---');
  const scanReport = await PlatformCatalogScannerAgent.scanPlatformArtwork();
  console.log('Total tracks scanned:', scanReport.totalTracksScanned);
  console.log('Total albums scanned:', scanReport.totalAlbumsScanned);
  console.log('Items needing artwork:', scanReport.itemsNeedingArtwork.length);
  console.log('Missing tracks count:', scanReport.missingTracksCount);
  console.log('Missing albums count:', scanReport.missingAlbumsCount);

  assert(scanReport.totalTracksScanned > 0, 'Scan should discover existing catalog tracks');
  assert(scanReport.itemsNeedingArtwork.length > 0, 'Scan should flag items with missing/generic artwork');
  console.log('  ✓ scanPlatformArtwork successfully scanned and diagnosed platform artwork');

  console.log('\n--- Test 2: Artwork Missing Heuristics ---');
  const genericCheck = PlatformCatalogScannerAgent.isArtworkMissing(
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819'
  );
  assert.strictEqual(genericCheck.missing, true, 'Unsplash photos must be flagged as missing/generic');
  assert.strictEqual(genericCheck.reason, 'generic_stock');

  const emptyCheck = PlatformCatalogScannerAgent.isArtworkMissing('');
  assert.strictEqual(emptyCheck.missing, true, 'Empty strings must be flagged as missing');

  const authenticCheck = PlatformCatalogScannerAgent.isArtworkMissing('/audio/uploads/Off_The_Wall_cover.jpg');
  assert.strictEqual(authenticCheck.missing, false, 'Authentic verified covers must NOT be flagged as missing');
  console.log('  ✓ isArtworkMissing accurately categorizes stock photos vs authentic artwork');

  console.log('\n--- Test 3: Autonomous Tavily Search Query Synthesis for Catalog Track ---');
  const firstMissing = scanReport.itemsNeedingArtwork.find((i) => i.type === 'track');
  if (firstMissing) {
    const queries = TavilyCoverArtService.buildSearchQueries({
      artist: firstMissing.artistName,
      album: firstMissing.albumTitle,
      title: firstMissing.title,
      genre: firstMissing.genre,
    });
    console.log(`Synthesized queries for "${firstMissing.title}" by ${firstMissing.artistName}:`, queries);
    assert(queries.length >= 2, 'Should generate multiple high-resolution candidate queries');
    console.log('  ✓ Query builder synthesized tailored music discovery queries');
  }

  console.log('\n--- Test 4: MP3 Binary APIC Tag Writing & Verification ---');
  // Create mock MP3 frame header (0xFF 0xFB)
  const mockMp3 = new Uint8Array(1024);
  mockMp3[0] = 0xff;
  mockMp3[1] = 0xfb;
  mockMp3[2] = 0x90;
  mockMp3[3] = 0x64;

// 1x1 Transparent JPEG minimal valid payload (SOI, APP0, SOF0, SOS, EOI)
const sampleJpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
  0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 0x06, 0x05, 0x06, 0x09,
  0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a, 0x0b, 0x0e, 0x0b, 0x09,
  0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10, 0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10,
  0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
  0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00, 0xff,
  0xd9,
]);

  const taggedBuffer = writeID3v2TagToMP3(mockMp3.buffer, {
    title: 'Autonomous AI Test Track',
    artist: 'ChanceTEKone',
    album: 'Crate Intelligence Vault',
    coverImageBytes: sampleJpegBytes,
    coverMimeType: 'image/jpeg',
  });

  const extracted = await extractCoverArtFromBuffer(taggedBuffer);
  assert(extracted !== undefined, 'Extracted cover art must be found in tagged MP3');
  assert(extracted.startsWith('data:image/jpeg'), 'Extracted data URL must have image/jpeg mime type');
  console.log('  ✓ Tagged MP3 successfully carries embedded ID3v2.3 APIC frame');

  console.log('\n--- Test 5: MCP Tool - scan_platform_missing_artwork ---');
  const mcpScanResult = await MusicMcpServer.callTool('scan_platform_missing_artwork', { limit: 5 });
  assert(mcpScanResult.totalTracksScanned > 0, 'MCP scan should return scanned track count');
  assert(Array.isArray(mcpScanResult.items), 'MCP scan should return item list');
  console.log('  ✓ MusicMcpServer executed scan_platform_missing_artwork successfully');

  console.log('\n--- Test 6: MCP Tool - auto_repair_platform_cover_art (Dry Run) ---');
  const mcpRepairResult = await MusicMcpServer.callTool('auto_repair_platform_cover_art', {
    limit: 2,
    dryRun: true,
  });
  assert.strictEqual(mcpRepairResult.success, true);
  console.log('  ✓ MusicMcpServer executed auto_repair_platform_cover_art dry-run successfully');

  console.log('\nAll 6 tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
