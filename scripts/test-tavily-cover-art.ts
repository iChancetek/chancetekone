/* eslint-disable */
import assert from 'node:assert/strict';
import { parseMP3File, extractCoverArtFallbackFromBytes } from '../src/lib/audio/id3Parser';
import { writeID3v2TagToMP3, dataUrlToImageBytes, findExistingID3v2Range } from '../src/lib/audio/id3Writer';
import { TavilyCoverArtService } from '../src/lib/ai/tavilyCoverArt';
import { AgenticAICoverArtAgent } from '../src/lib/ai/coverArtAgent';
import { MusicMcpServer } from '../src/lib/mcp/musicMcpServer';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}

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

// Dummy MPEG Audio frame (sync word 0xFF 0xFB)
const dummyAudioBytes = new Uint8Array(1024);
dummyAudioBytes[0] = 0xff;
dummyAudioBytes[1] = 0xfb;
dummyAudioBytes[2] = 0x90;
dummyAudioBytes[3] = 0x64;

console.log('\n--- Test 1: ID3 Tag & APIC Cover Art Writer & Round-Trip Extraction ---');

await test('writeID3v2TagToMP3 attaches APIC cover art to MP3 binary', () => {
  const taggedBuffer = writeID3v2TagToMP3(dummyAudioBytes.buffer, {
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    genre: 'R&B / Pop',
    year: 1982,
    trackNumber: 6,
    coverImageBytes: sampleJpegBytes,
    coverMimeType: 'image/jpeg',
  });

  assert.ok(taggedBuffer.byteLength > dummyAudioBytes.byteLength);
  const bytes = new Uint8Array(taggedBuffer);
  // Verify ID3v2 header
  assert.equal(bytes[0], 0x49); // 'I'
  assert.equal(bytes[1], 0x44); // 'D'
  assert.equal(bytes[2], 0x33); // '3'
  assert.equal(bytes[3], 3);    // ID3v2.3
});

await test('parseMP3File extracts embedded APIC cover art, title, artist from newly tagged MP3', async () => {
  const taggedBuffer = writeID3v2TagToMP3(dummyAudioBytes.buffer, {
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    genre: 'R&B / Pop',
    year: 1982,
    trackNumber: 6,
    coverImageBytes: sampleJpegBytes,
    coverMimeType: 'image/jpeg',
  });

  const fakeFile = {
    name: '06 - Billie Jean.mp3',
    arrayBuffer: async () => taggedBuffer,
    type: 'audio/mpeg',
  };

  const parsed = await parseMP3File(fakeFile as any);
  assert.equal(parsed.title, 'Billie Jean');
  assert.equal(parsed.artist, 'Michael Jackson');
  assert.equal(parsed.album, 'Thriller');
  assert.equal(parsed.year, 1982);
  assert.equal(parsed.trackNumber, 6);
  assert.equal(parsed.hasEmbeddedArtwork, true);
  assert.equal(parsed.artworkStatus, 'extracted');
  assert.ok(parsed.coverUrl?.startsWith('data:image/jpeg;base64,'));
});

await test('findExistingID3v2Range correctly locates and measures ID3v2 tag', () => {
  const taggedBuffer = writeID3v2TagToMP3(dummyAudioBytes.buffer, {
    title: 'Thriller',
    artist: 'Michael Jackson',
    coverImageBytes: sampleJpegBytes,
  });
  const range = findExistingID3v2Range(new Uint8Array(taggedBuffer));
  assert.ok(range !== null);
  assert.equal(range.offset, 0);
  assert.ok(range.length > 50);
});

await test('extractCoverArtFallbackFromBytes detects APIC frame even if tag is non-standard', () => {
  const taggedBuffer = writeID3v2TagToMP3(dummyAudioBytes.buffer, {
    title: 'Deep Search Track',
    artist: 'Test Artist',
    coverImageBytes: sampleJpegBytes,
  });
  const rawBytes = new Uint8Array(taggedBuffer);
  const fallbackCover = extractCoverArtFallbackFromBytes(rawBytes);
  assert.ok(fallbackCover !== null);
  assert.ok(fallbackCover?.startsWith('data:image/jpeg;base64,'));
});

console.log('\n--- Test 2: Tavily Cover Art Query Builder & Ranking ---');

await test('buildSearchQueries generates high-resolution album and track queries', () => {
  const queries = TavilyCoverArtService.buildSearchQueries({
    artist: 'Michael Jackson',
    album: 'Thriller',
    title: 'Beat It',
  });
  assert.ok(queries.length >= 2);
  assert.ok(queries[0].includes('Michael Jackson'));
  assert.ok(queries[0].includes('Thriller'));
  assert.ok(queries[0].includes('cover art'));
});

await test('needsArtworkEnrichment identifies missing and placeholder artwork', () => {
  assert.equal(
    AgenticAICoverArtAgent.needsArtworkEnrichment({
      id: '1',
      batchId: 'b1',
      fileName: 'test.mp3',
      fileSizeBytes: 1000,
      fileHash: 'h1',
      mimeType: 'audio/mpeg',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      genre: 'Pop',
      durationSeconds: 120,
      bitrateKbps: 320,
      sampleRateHz: 44100,
      format: 'MP3',
      hasEmbeddedArtwork: false,
      artworkStatus: 'missing',
      coverUrl: undefined,
      crateId: 'c1',
      crateName: 'Crate',
      uploadStatus: 'pending',
      progressPercent: 0,
      createdAt: '',
      updatedAt: '',
    }),
    true
  );

  assert.equal(
    AgenticAICoverArtAgent.needsArtworkEnrichment({
      id: '2',
      batchId: 'b1',
      fileName: 'test.mp3',
      fileSizeBytes: 1000,
      fileHash: 'h2',
      mimeType: 'audio/mpeg',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      genre: 'Pop',
      durationSeconds: 120,
      bitrateKbps: 320,
      sampleRateHz: 44100,
      format: 'MP3',
      hasEmbeddedArtwork: false,
      artworkStatus: 'missing',
      coverUrl: 'https://images.unsplash.com/photo-1234?w=500', // stock placeholder
      crateId: 'c1',
      crateName: 'Crate',
      uploadStatus: 'pending',
      progressPercent: 0,
      createdAt: '',
      updatedAt: '',
    }),
    true
  );
});

console.log('\n--- Test 3: Music MCP (Model Context Protocol) Server ---');

await test('MusicMcpServer lists compliant MCP tools with JSON schemas', () => {
  const tools = MusicMcpServer.listTools();
  assert.ok(tools.length >= 3);
  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes('search_cover_art_tavily'));
  assert.ok(toolNames.includes('attach_cover_art_to_mp3'));
  assert.ok(toolNames.includes('batch_enrich_missing_artwork'));

  const searchTool = tools.find((t) => t.name === 'search_cover_art_tavily')!;
  assert.equal(searchTool.inputSchema.type, 'object');
  assert.ok(searchTool.inputSchema.properties.artist);
});

await test('MusicMcpServer executes attach_cover_art_to_mp3', async () => {
  const dataUrl = `data:image/jpeg;base64,${Buffer.from(sampleJpegBytes).toString('base64')}`;
  const res = await MusicMcpServer.callTool('attach_cover_art_to_mp3', {
    coverUrl: dataUrl,
    artist: 'Michael Jackson',
    album: 'Thriller',
    title: 'Wanna Be Startin Somethin',
  });
  assert.equal(res.success, true);
  assert.equal(res.coverUrl, dataUrl);
  assert.equal(res.attachedTo.artist, 'Michael Jackson');
});

console.log(`\nResults: ${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  process.exit(1);
}
