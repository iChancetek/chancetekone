/**
 * ChanceTEK One — Standards-Compliant Pure-TypeScript ID3v2.3 Tag & Cover Art (APIC) Embedder
 * Safely prepends/replaces ID3v2.3 metadata & Front Cover artwork on MP3 buffers without
 * ever altering or corrupting the underlying MPEG audio frames.
 */

export interface Id3MetadataPayload {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: string;
  trackNumber?: string;
  coverBytes?: Uint8Array | null;
  coverMimeType?: string;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * Encodes a string as UTF-16LE with BOM (0xFF, 0xFE) for ID3v2.3 text encoding 0x01.
 */
function encodeUtf16LeWithBom(str: string): Uint8Array {
  const buf = new Uint8Array(2 + str.length * 2);
  buf[0] = 0xff;
  buf[1] = 0xfe;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[2 + i * 2] = code & 0xff;
    buf[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return buf;
}

function writeUint32BE(val: number): Uint8Array {
  return new Uint8Array([
    (val >>> 24) & 0xff,
    (val >>> 16) & 0xff,
    (val >>> 8) & 0xff,
    val & 0xff,
  ]);
}

function writeSyncsafe32(val: number): Uint8Array {
  return new Uint8Array([
    (val >>> 21) & 0x7f,
    (val >>> 14) & 0x7f,
    (val >>> 7) & 0x7f,
    val & 0x7f,
  ]);
}

function buildTextFrame(frameId: string, text: string): Uint8Array {
  const clean = text.trim();
  if (!clean) return new Uint8Array(0);
  const encodedText = encodeUtf16LeWithBom(clean);
  const body = new Uint8Array(1 + encodedText.byteLength);
  body[0] = 0x01; // UTF-16 with BOM
  body.set(encodedText, 1);

  return concatBytes([
    encodeAscii(frameId.slice(0, 4)),
    writeUint32BE(body.byteLength),
    new Uint8Array([0x00, 0x00]), // Flags
    body,
  ]);
}

function buildApicFrame(imageBytes: Uint8Array, mimeType: string): Uint8Array {
  const safeMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase() || 'image/jpeg';
  const mimeAscii = encodeAscii(safeMime);
  // ID3v2.3 APIC frame layout:
  // [Text encoding = 0x00 (ISO-8859-1)] [MIME type\0] [Picture type = 0x03 Front Cover] [Description = \0] [Picture data]
  const header = new Uint8Array(1 + mimeAscii.byteLength + 1 + 1 + 1);
  let p = 0;
  header[p++] = 0x00;
  header.set(mimeAscii, p);
  p += mimeAscii.byteLength;
  header[p++] = 0x00; // MIME null terminator
  header[p++] = 0x03; // 0x03 = Cover (front)
  header[p++] = 0x00; // Empty description null terminator

  const body = concatBytes([header, imageBytes]);

  return concatBytes([
    encodeAscii('APIC'),
    writeUint32BE(body.byteLength),
    new Uint8Array([0x00, 0x00]),
    body,
  ]);
}

/**
 * Inspects whether a buffer looks like an MP3 stream (either starting with an ID3v2 tag
 * or an MPEG frame sync word 0xFF 0xE0..0xFF).
 */
export function isLikelyMp3Buffer(bytes: Uint8Array): boolean {
  if (!bytes || bytes.byteLength < 16) return false;
  // Starts with "ID3"
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  // MPEG audio frame sync (11 bits set)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  // Scan first 4 KB for sync word (skipping leading padding bytes)
  const limit = Math.min(bytes.byteLength - 2, 4096);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

/**
 * Detects an existing leading ID3v2 header length so we can replace it cleanly
 * without stacking duplicate ID3v2 tags or touching MPEG frames.
 */
function getLeadingId3v2Size(bytes: Uint8Array): number {
  if (bytes.byteLength < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;

  const flags = bytes[5];
  const syncsafeSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const hasFooter = (flags & 0x10) !== 0;
  const total = 10 + syncsafeSize + (hasFooter ? 10 : 0);
  return total < bytes.byteLength ? total : 0;
}

/**
 * Infers image MIME type from magic bytes.
 */
export function detectImageMimeType(bytes: Uint8Array, fallback = 'image/jpeg'): string {
  if (!bytes || bytes.byteLength < 12) return fallback;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return fallback;
}

/**
 * Returns true if the buffer matches a valid image signature (JPEG, PNG, or WebP).
 */
export function isValidImageBuffer(bytes?: Uint8Array | null): boolean {
  if (!bytes || bytes.byteLength < 32) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * Embeds ID3v2.3 metadata & Front Cover artwork directly into an MP3 buffer.
 * If the buffer is not an MP3 (e.g., WAV/M4A/FLAC), returns the original audio untouched
 * with `embedded: false`.
 */
export function embedId3v2CoverArt(
  audioBytes: Uint8Array,
  meta: Id3MetadataPayload
): { bytes: Uint8Array; embedded: boolean; coverEmbedded: boolean } {
  if (!isLikelyMp3Buffer(audioBytes)) {
    return { bytes: audioBytes, embedded: false, coverEmbedded: false };
  }

  const frames: Uint8Array[] = [];
  if (meta.title) frames.push(buildTextFrame('TIT2', meta.title));
  if (meta.artist) frames.push(buildTextFrame('TPE1', meta.artist));
  if (meta.album) frames.push(buildTextFrame('TALB', meta.album));
  if (meta.genre) frames.push(buildTextFrame('TCON', meta.genre));
  if (meta.year) frames.push(buildTextFrame('TYER', meta.year));
  if (meta.trackNumber) frames.push(buildTextFrame('TRCK', meta.trackNumber));

  let coverEmbedded = false;
  if (meta.coverBytes && isValidImageBuffer(meta.coverBytes)) {
    const mime = detectImageMimeType(meta.coverBytes, meta.coverMimeType || 'image/jpeg');
    frames.push(buildApicFrame(meta.coverBytes, mime));
    coverEmbedded = true;
  }

  const nonEmptyFrames = frames.filter((f) => f.byteLength > 0);
  if (nonEmptyFrames.length === 0) {
    return { bytes: audioBytes, embedded: false, coverEmbedded: false };
  }

  const framesBody = concatBytes(nonEmptyFrames);
  const tagHeader = concatBytes([
    encodeAscii('ID3'),
    new Uint8Array([0x03, 0x00]), // ID3v2.3.0
    new Uint8Array([0x00]), // Flags
    writeSyncsafe32(framesBody.byteLength),
  ]);

  const existingTagLength = getLeadingId3v2Size(audioBytes);
  const pureAudioPayload = existingTagLength > 0 ? audioBytes.subarray(existingTagLength) : audioBytes;

  return {
    bytes: concatBytes([tagHeader, framesBody, pureAudioPayload]),
    embedded: true,
    coverEmbedded,
  };
}

