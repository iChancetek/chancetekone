/**
 * 8 Of Spades Works — ID3v2.3 Tag & APIC Cover Art Writer
 * Pure TypeScript implementation for attaching authentic cover art and ID3 metadata
 * directly to MP3 audio binaries across browser and Node.js environments.
 */

export interface ID3MetadataToWrite {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  publisher?: string;
  comment?: string;
  coverImageBytes?: Uint8Array;
  coverMimeType?: string;
}

/**
 * Encodes an integer as a 4-byte ID3 syncsafe integer
 */
function toSyncsafeInt(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);
}

/**
 * Encodes an integer as a standard 4-byte big-endian integer
 */
function toUint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
}

/**
 * Creates an ID3v2.3 Text Frame (e.g. TIT2, TPE1, TALB)
 */
function createTextFrame(frameId: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  // Encoding byte 3 = UTF-8
  const framePayload = new Uint8Array(1 + textBytes.length);
  framePayload[0] = 3; // UTF-8
  framePayload.set(textBytes, 1);

  const header = new Uint8Array(10);
  for (let i = 0; i < 4; i++) {
    header[i] = frameId.charCodeAt(i);
  }
  // ID3v2.3 frame size is 4-byte standard big endian
  header.set(toUint32BE(framePayload.length), 4);
  header[8] = 0; // Flags byte 1
  header[9] = 0; // Flags byte 2

  const combined = new Uint8Array(header.length + framePayload.length);
  combined.set(header, 0);
  combined.set(framePayload, 10);
  return combined;
}

/**
 * Creates an ID3v2.3 APIC (Attached Picture) Frame
 */
function createAPICFrame(imageBytes: Uint8Array, mimeType: string = 'image/jpeg'): Uint8Array {
  const cleanMime = mimeType.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg';
  const mimeBytes = new TextEncoder().encode(cleanMime);

  // APIC payload structure:
  // 1 byte: text encoding (0 = ISO-8859-1 for mime/description)
  // N bytes: MIME type null-terminated
  // 1 byte: picture type (0x03 = Cover / Front)
  // 1 byte: description null-terminator (empty description)
  // Remaining: raw image data
  const payloadLen = 1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length;
  const payload = new Uint8Array(payloadLen);

  let offset = 0;
  payload[offset++] = 0; // Encoding: ISO-8859-1
  payload.set(mimeBytes, offset);
  offset += mimeBytes.length;
  payload[offset++] = 0; // Null terminator for MIME type
  payload[offset++] = 3; // Picture type: 0x03 = Cover (front)
  payload[offset++] = 0; // Null terminator for Description
  payload.set(imageBytes, offset);

  // APIC Header (10 bytes)
  const header = new Uint8Array(10);
  header[0] = 0x41; // 'A'
  header[1] = 0x50; // 'P'
  header[2] = 0x49; // 'I'
  header[3] = 0x43; // 'C'
  header.set(toUint32BE(payload.length), 4);
  header[8] = 0;
  header[9] = 0;

  const combined = new Uint8Array(10 + payload.length);
  combined.set(header, 0);
  combined.set(payload, 10);
  return combined;
}

/**
 * Converts a Base64 Data URL or raw base64 string into a Uint8Array and MIME type
 */
export function dataUrlToImageBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  let mimeType = 'image/jpeg';
  let base64 = dataUrl;

  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      mimeType = match[1];
      base64 = match[2];
    } else {
      const parts = dataUrl.split('base64,');
      if (parts.length > 1) {
        base64 = parts[1];
      }
    }
  }

  // Cross-environment Base64 decoding
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return { bytes: new Uint8Array(buf), mimeType };
  }

  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { bytes, mimeType };
}

/**
 * Detects existing ID3v2 tag in audio buffer and returns offset and length
 */
export function findExistingID3v2Range(bytes: Uint8Array): { offset: number; length: number } | null {
  const maxSearch = Math.min(bytes.length - 10, 65536);
  for (let i = 0; i <= maxSearch; i++) {
    if (bytes[i] === 0x49 && bytes[i + 1] === 0x44 && bytes[i + 2] === 0x33) {
      if (bytes[i + 3] <= 4 && bytes[i + 4] < 255) {
        const tagSize =
          ((bytes[i + 6] & 0x7f) << 21) |
          ((bytes[i + 7] & 0x7f) << 14) |
          ((bytes[i + 8] & 0x7f) << 7) |
          (bytes[i + 9] & 0x7f);
        return {
          offset: i,
          length: 10 + tagSize,
        };
      }
    }
  }
  return null;
}

/**
 * Writes an ID3v2.3 tag with optional APIC cover art into an MP3 ArrayBuffer.
 * Replaces existing ID3v2 tag or prepends new tag before audio frames.
 */
export function writeID3v2TagToMP3(
  audioBuffer: ArrayBuffer | Uint8Array,
  metadata: ID3MetadataToWrite
): ArrayBuffer {
  const audioBytes = audioBuffer instanceof Uint8Array ? audioBuffer : new Uint8Array(audioBuffer);
  const frames: Uint8Array[] = [];

  if (metadata.title) frames.push(createTextFrame('TIT2', metadata.title));
  if (metadata.artist) frames.push(createTextFrame('TPE1', metadata.artist));
  if (metadata.album) frames.push(createTextFrame('TALB', metadata.album));
  if (metadata.genre) frames.push(createTextFrame('TCON', metadata.genre));
  if (metadata.year) frames.push(createTextFrame('TYER', String(metadata.year)));
  if (metadata.trackNumber) frames.push(createTextFrame('TRCK', String(metadata.trackNumber)));
  if (metadata.composer) frames.push(createTextFrame('TCOM', metadata.composer));
  if (metadata.publisher) frames.push(createTextFrame('TPUB', metadata.publisher));

  if (metadata.coverImageBytes && metadata.coverImageBytes.length > 0) {
    frames.push(createAPICFrame(metadata.coverImageBytes, metadata.coverMimeType));
  }

  // Calculate total frames length
  const totalFramesLength = frames.reduce((sum, f) => sum + f.length, 0);

  // ID3v2.3 Header (10 bytes)
  const tagHeader = new Uint8Array(10);
  tagHeader[0] = 0x49; // 'I'
  tagHeader[1] = 0x44; // 'D'
  tagHeader[2] = 0x33; // '3'
  tagHeader[3] = 3;    // ID3v2.3
  tagHeader[4] = 0;    // Revision 0
  tagHeader[5] = 0;    // Flags (no unsync, no ext header)
  tagHeader.set(toSyncsafeInt(totalFramesLength), 6);

  // Combine tag header + frames
  const tagBuffer = new Uint8Array(10 + totalFramesLength);
  tagBuffer.set(tagHeader, 0);
  let pos = 10;
  for (const frame of frames) {
    tagBuffer.set(frame, pos);
    pos += frame.length;
  }

  // Identify pure audio payload without previous ID3v2 tag
  const existingRange = findExistingID3v2Range(audioBytes);
  let pureAudioBytes: Uint8Array;
  if (existingRange && existingRange.offset === 0) {
    pureAudioBytes = audioBytes.subarray(existingRange.length);
  } else if (existingRange && existingRange.offset > 0) {
    // Keep prefix before ID3 (if any), drop ID3, keep audio after
    const prefix = audioBytes.subarray(0, existingRange.offset);
    const suffix = audioBytes.subarray(existingRange.offset + existingRange.length);
    const stitched = new Uint8Array(prefix.length + suffix.length);
    stitched.set(prefix, 0);
    stitched.set(suffix, prefix.length);
    pureAudioBytes = stitched;
  } else {
    pureAudioBytes = audioBytes;
  }

  // Result: new ID3v2 tag + pure audio frames
  const finalBuffer = new Uint8Array(tagBuffer.length + pureAudioBytes.length);
  finalBuffer.set(tagBuffer, 0);
  finalBuffer.set(pureAudioBytes, tagBuffer.length);

  return finalBuffer.buffer;
}

/**
 * Attaches cover art (from Data URL, Blob, or Uint8Array) into an MP3 File.
 * Returns an updated File object with the embedded ID3v2.3 APIC frame.
 */
export async function attachCoverArtToMP3File(
  file: File | Blob,
  coverArtDataUrlOrBlob: string | Blob | Uint8Array,
  metadata?: Partial<ID3MetadataToWrite>
): Promise<File> {
  let coverBytes: Uint8Array;
  let coverMime = 'image/jpeg';

  if (typeof coverArtDataUrlOrBlob === 'string') {
    const decoded = dataUrlToImageBytes(coverArtDataUrlOrBlob);
    coverBytes = decoded.bytes;
    coverMime = decoded.mimeType;
  } else if (coverArtDataUrlOrBlob instanceof Uint8Array) {
    coverBytes = coverArtDataUrlOrBlob;
  } else {
    const arrayBuf = await coverArtDataUrlOrBlob.arrayBuffer();
    coverBytes = new Uint8Array(arrayBuf);
    coverMime = (coverArtDataUrlOrBlob as Blob).type || 'image/jpeg';
  }

  const audioBuffer = await file.arrayBuffer();
  const fileName = (file as File).name || `${metadata?.title || 'track'}.mp3`;

  const taggedBuffer = writeID3v2TagToMP3(audioBuffer, {
    title: metadata?.title || fileName.replace(/\.[^/.]+$/, ''),
    artist: metadata?.artist || '8 OF SPADES WORKS',
    album: metadata?.album,
    genre: metadata?.genre,
    year: metadata?.year,
    trackNumber: metadata?.trackNumber,
    coverImageBytes: coverBytes,
    coverMimeType: coverMime,
  });

  return new File([taggedBuffer], fileName, {
    type: 'audio/mpeg',
    lastModified: Date.now(),
  });
}
