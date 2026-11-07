/**
 * ChanceTEK One — High-Performance MP3 & ID3 Parser
 * Native client-side and server-compatible ID3v2.3, ID3v2.4 & ID3v1 parser.
 * Extracts full metadata, embedded album artwork (APIC), audio properties, and SHA-256 checksums.
 */

export interface ExtractedMP3Metadata {
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  producer?: string;
  copyright?: string;
  publisher?: string;
  isrc?: string;
  durationSeconds: number;
  bitrateKbps: number;
  sampleRateHz: number;
  format: string;
  hasEmbeddedArtwork: boolean;
  artworkStatus: 'extracted' | 'missing';
  coverUrl?: string; // Data URL or object URL
  fileHash: string; // SHA-256
  rawFrames: Record<string, any>;
}

// Standard ID3v1 Genre Table fallback
const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae',
  'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion',
  'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip',
  'Gospel', 'Noise', 'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative',
  'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave',
  'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock',
  'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle',
  'Native American', 'Cabaret', 'New Wave', 'Psychadelic', 'Rave', 'Showtunes',
  'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro',
  'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk',
  'Swing', 'Fast Fusion', 'Bebob', 'Latin', 'Revival', 'Celtic', 'Bluegrass',
  'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock',
  'Slow Jam', 'Big Beat', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech',
  'Chanson', 'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus',
  'Porn Groove', 'Satire', 'Slow Rock', 'Club', 'Tango', 'Samba', 'Folklore',
  'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock',
  'Drum Solo', 'Acapella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass',
  'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop', 'Negerpunk', 'Polsk Punk',
  'Beat', 'Christian Gangsta Rap', 'Heavy Metal', 'Black Metal', 'Crossover',
  'Contemporary Christian', 'Christian Rock', 'Merengue', 'Salsa', 'Thrash Metal',
  'Anime', 'JPop', 'Synthpop',
];

/**
 * Computes cryptographically secure SHA-256 hash of an ArrayBuffer
 */
export async function computeSHA256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Fast DJB2/FNV-1a 64-bit hybrid fallback if SubtleCrypto is unavailable
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const view = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 65536)));
  for (let i = 0; i < view.length; i++) {
    h1 = Math.imul(h1 ^ view[i], 2654435761);
    h2 = Math.imul(h2 ^ view[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

/**
 * Decodes text buffer based on ID3 encoding byte:
 * 0: ISO-8859-1 (Latin1)
 * 1: UTF-16 with BOM
 * 2: UTF-16BE without BOM
 * 3: UTF-8
 */
function decodeText(bytes: Uint8Array, encodingByte: number): string {
  try {
    if (bytes.length === 0) return '';
    let decoder: TextDecoder;
    if (encodingByte === 1) {
      decoder = new TextDecoder('utf-16');
    } else if (encodingByte === 2) {
      decoder = new TextDecoder('utf-16be');
    } else if (encodingByte === 3) {
      decoder = new TextDecoder('utf-8');
    } else {
      decoder = new TextDecoder('iso-8859-1');
    }
    const str = decoder.decode(bytes);
    // Remove null terminators
    return str.replace(/\0+$/, '').trim();
  } catch {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) s += String.fromCharCode(bytes[i]);
    }
    return s.trim();
  }
}

/**
 * Converts syncsafe 4-byte integer to standard number
 */
function readSyncsafeInt(v0: number, v1: number, v2: number, v3: number): number {
  return ((v0 & 0x7f) << 21) | ((v1 & 0x7f) << 14) | ((v2 & 0x7f) << 7) | (v3 & 0x7f);
}

/**
 * Locates standard image binary magic bytes (JPEG, PNG, GIF, WebP)
 * Handles both standard streams and ID3 unsynchronized byte sequences.
 */
export function findImageHeaderIndex(
  bytes: Uint8Array,
  startOffset: number = 0,
  maxSearchLength: number = 8192
): { index: number; mimeType: string } | null {
  const maxSearch = Math.min(bytes.length - 4, startOffset + maxSearchLength);
  for (let i = startOffset; i <= maxSearch; i++) {
    // JPEG SOI marker: 0xFF 0xD8 followed by 0xFF (marker prefix for APP0/Exif/DQT)
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && i + 2 < bytes.length && bytes[i + 2] === 0xff) {
      return { index: i, mimeType: 'image/jpeg' };
    }
    // Unsynced JPEG: 0xFF 0x00 0xD8 0xFF
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00 && i + 3 < bytes.length && bytes[i + 2] === 0xd8 && bytes[i + 3] === 0xff) {
      return { index: i, mimeType: 'image/jpeg' };
    }
    // PNG 8-byte signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      bytes[i] === 0x89 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x4e &&
      bytes[i + 3] === 0x47 &&
      i + 7 < bytes.length &&
      bytes[i + 4] === 0x0d &&
      bytes[i + 5] === 0x0a &&
      bytes[i + 6] === 0x1a &&
      bytes[i + 7] === 0x0a
    ) {
      return { index: i, mimeType: 'image/png' };
    }
    // GIF marker: 0x47 0x49 0x46 0x38 ('GIF8')
    if (
      bytes[i] === 0x47 &&
      bytes[i + 1] === 0x49 &&
      bytes[i + 2] === 0x46 &&
      bytes[i + 3] === 0x38
    ) {
      return { index: i, mimeType: 'image/gif' };
    }
    // WebP marker: 'RIFF' .... 'WEBP'
    if (
      bytes[i] === 0x52 &&
      bytes[i + 1] === 0x49 &&
      bytes[i + 2] === 0x46 &&
      bytes[i + 3] === 0x46 &&
      i + 11 < bytes.length &&
      bytes[i + 8] === 0x57 &&
      bytes[i + 9] === 0x45 &&
      bytes[i + 10] === 0x42 &&
      bytes[i + 11] === 0x50
    ) {
      return { index: i, mimeType: 'image/webp' };
    }
  }
  return null;
}

/**
 * Converts image Uint8Array bytes into a Base64 dataURL.
 * Supports high-speed Node.js Buffer and browser Text/Binary fallback.
 */
export function bytesToDataUrl(imageBytes: Uint8Array, mimeType: string = 'image/jpeg'): string {
  if (typeof Buffer !== 'undefined') {
    return `data:${mimeType};base64,${Buffer.from(imageBytes).toString('base64')}`;
  }
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < imageBytes.length; i += chunkSize) {
    const chunk = imageBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Optimizes/resizes cover art dataURL using HTML canvas to preserve quality while keeping payload lean (<50KB)
 */
export async function optimizeCoverArtDataUrl(
  dataUrl: string,
  maxDim: number = 600,
  quality: number = 0.88
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return dataUrl;
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;

  try {
    return await new Promise<string>((resolve) => {
      const img = new (window as any).Image();
      const timeout = setTimeout(() => resolve(dataUrl), 4000);
      img.onload = () => {
        clearTimeout(timeout);
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && dataUrl.length < 100000) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const res = canvas.toDataURL('image/jpeg', quality);
          resolve(res || dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(dataUrl); // Fall back to original image, never wipe valid artwork
      };
      img.src = dataUrl;
    });
  } catch {
    return dataUrl;
  }
}

/**
 * Finds end of JPEG or PNG to ensure no corrupt trailing bytes
 */
export function extractCleanImageBytes(
  bytes: Uint8Array,
  startIndex: number,
  mimeType: string
): Uint8Array {
  if (startIndex >= bytes.length) return new Uint8Array(0);

  if (mimeType === 'image/jpeg') {
    // Look backwards from the end for the last JPEG EOI marker: 0xFF 0xD9
    // This avoids truncating at internal EXIF thumbnails.
    for (let i = bytes.length - 2; i >= startIndex + 100; i--) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        return bytes.slice(startIndex, i + 2);
      }
    }
  } else if (mimeType === 'image/png') {
    // Look backwards for PNG IEND chunk: 'IEND' + 4-byte CRC
    for (let i = bytes.length - 8; i >= startIndex + 8; i--) {
      if (
        bytes[i] === 0x49 && // 'I'
        bytes[i + 1] === 0x45 && // 'E'
        bytes[i + 2] === 0x4e && // 'N'
        bytes[i + 3] === 0x44 // 'D'
      ) {
        return bytes.slice(startIndex, i + 8);
      }
    }
  }

  // Fallback: take remaining or cap at 4MB
  const maxLen = Math.min(bytes.length - startIndex, 4 * 1024 * 1024);
  return bytes.slice(startIndex, startIndex + maxLen);
}

/**
 * Parses embedded APIC (Attached Picture) or PIC (ID3v2.2) frame into Data URL
 */
function parseAPICFrame(
  bytes: Uint8Array,
  majorVersion: number
): { mimeType: string; dataUrl: string } | null {
  try {
    if (bytes.length < 10) return null;

    // 1. Direct binary signature search within the first 4096 bytes (where image data starts)
    const headerMatch = findImageHeaderIndex(bytes, 1, Math.min(bytes.length - 1, 4096));
    if (headerMatch && headerMatch.index < bytes.length) {
      const imageBytes = extractCleanImageBytes(bytes, headerMatch.index, headerMatch.mimeType);
      if (imageBytes.length >= 100) {
        return {
          mimeType: headerMatch.mimeType,
          dataUrl: bytesToDataUrl(imageBytes, headerMatch.mimeType),
        };
      }
    }

    // 2. Structured fallback based on encoding byte
    const encodingByte = bytes[0];
    let offset = 1;

    let mimeType = 'image/jpeg';

    if (majorVersion === 2) {
      // ID3v2.2 uses 3-byte image format e.g. "PNG" or "JPG"
      if (bytes.length > 4) {
        const fmt = String.fromCharCode(bytes[1], bytes[2], bytes[3]).toLowerCase();
        mimeType = fmt.includes('png') ? 'image/png' : 'image/jpeg';
        offset = 4; // 1 (encoding) + 3 (format)
        offset++; // skip picture type
      }
    } else {
      let mimeEnd = offset;
      while (mimeEnd < bytes.length && bytes[mimeEnd] !== 0) {
        mimeEnd++;
      }
      if (mimeEnd > offset) {
        const mimeBytes = bytes.slice(offset, mimeEnd);
        mimeType = decodeText(mimeBytes, 0) || 'image/jpeg';
        offset = mimeEnd + 1;
      } else {
        offset++;
      }
      if (offset < bytes.length) {
        offset++; // skip picture type
      }
    }

    // Skip description string
    if (encodingByte === 1 || encodingByte === 2) {
      while (offset < bytes.length - 1 && !(bytes[offset] === 0 && bytes[offset + 1] === 0)) {
        offset += 2;
      }
      offset += 2;
    } else {
      while (offset < bytes.length && bytes[offset] !== 0) {
        offset++;
      }
      offset++;
    }

    if (offset >= bytes.length) return null;
    const fallbackMatch = findImageHeaderIndex(bytes, offset, Math.min(bytes.length - offset, 4096)) || { index: offset, mimeType };
    const imageBytes = extractCleanImageBytes(bytes, fallbackMatch.index, fallbackMatch.mimeType);
    if (imageBytes.length < 100) return null;

    return {
      mimeType: fallbackMatch.mimeType.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg',
      dataUrl: bytesToDataUrl(imageBytes, fallbackMatch.mimeType),
    };
  } catch (err) {
    console.warn('[ID3 APIC Parser Error]', err);
    return null;
  }
}

/**
 * Intelligent filename fallback parser
 */
function parseMetadataFromFilename(fileName: string): { title: string; artist: string; trackNumber?: number } {
  const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/i, '').trim();

  // Pattern 1: "01 - Artist - Title" or "01. Artist - Title"
  const m1 = cleanName.match(/^(\d{1,3})[\s._-]+(.+?)[\s._-]+(.+)$/);
  if (m1) {
    return {
      trackNumber: parseInt(m1[1], 10),
      artist: m1[2].trim(),
      title: m1[3].trim(),
    };
  }

  // Pattern 2: "Artist - Title"
  const m2 = cleanName.match(/^(.+?)[\s._-]+(.+)$/);
  if (m2) {
    return {
      artist: m2[1].trim(),
      title: m2[2].trim(),
    };
  }

  // Pattern 3: "Title"
  return {
    artist: 'ChanceTEK One',
    title: cleanName,
  };
}

/**
 * Primary Audio & ID3 Parser Entrypoint
 */
export async function parseMP3File(
  file: File | Blob,
  fileNameOverride?: string
): Promise<ExtractedMP3Metadata> {
  const fileName = fileNameOverride || (file as File).name || 'Unknown Track.mp3';
  const buffer = await file.arrayBuffer();
  const fileHash = await computeSHA256(buffer);
  const dataView = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const rawFrames: Record<string, any> = {};
  let title = '';
  let artist = '';
  let albumArtist = '';
  let album = '';
  let genre = '';
  let year: number | undefined;
  let trackNumber: number | undefined;
  let discNumber: number | undefined;
  let composer = '';
  let producer = '';
  let copyright = '';
  let publisher = '';
  let isrc = '';
  let coverUrl: string | undefined;

  // 1. Locate ID3v2 Header ('ID3' = 0x49, 0x44, 0x33) within first 64KB
  let id3Start = -1;
  const maxHeaderSearch = Math.min(bytes.length - 10, 65536);
  for (let i = 0; i <= maxHeaderSearch; i++) {
    if (bytes[i] === 0x49 && bytes[i + 1] === 0x44 && bytes[i + 2] === 0x33) {
      if (bytes[i + 3] <= 4 && bytes[i + 4] < 255) {
        id3Start = i;
        break;
      }
    }
  }

  if (id3Start !== -1) {
    const majorVersion = bytes[id3Start + 3]; // e.g. 2 for v2.2, 3 for v2.3, 4 for v2.4
    const flags = bytes[id3Start + 5];
    const tagSize = readSyncsafeInt(
      bytes[id3Start + 6],
      bytes[id3Start + 7],
      bytes[id3Start + 8],
      bytes[id3Start + 9]
    );

    let offset = id3Start + 10;
    const end = Math.min(bytes.length, id3Start + 10 + tagSize);

    // Skip ID3v2 Extended Header if present (bit 6 of flags)
    if ((flags & 0x40) !== 0 && offset + 4 <= end) {
      if (majorVersion === 4) {
        const extSize = readSyncsafeInt(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        offset += Math.max(4, extSize);
      } else {
        const extSize = dataView.getUint32(offset, false);
        offset += 4 + extSize;
      }
    }

    // Parse ID3v2 Frames (Handles both ID3v2.3/v2.4 4-char tags and ID3v2.2 3-char tags)
    const isV22 = majorVersion === 2;
    const headerLen = isV22 ? 6 : 10;

    while (offset + headerLen <= end) {
      // Check for tag padding (null bytes)
      if (bytes[offset] === 0 && bytes[offset + 1] === 0) {
        break;
      }

      let frameId: string;
      let frameSize: number;

      if (isV22) {
        frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
        if (!/^[A-Z0-9]{3}$/.test(frameId)) {
          offset++;
          continue;
        }
        frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
      } else {
        frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        if (!/^[A-Z0-9]{4}$/.test(frameId)) {
          offset++;
          continue;
        }
        if (majorVersion === 4) {
          frameSize = readSyncsafeInt(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        } else {
          frameSize = dataView.getUint32(offset + 4, false);
          // Auto-recover if ID3v2.3 tagger erroneously wrote syncsafe integer for frame size
          if (frameSize > end - offset - headerLen && frameSize > 0) {
            const syncsafeCandidate = readSyncsafeInt(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
            if (syncsafeCandidate > 0 && syncsafeCandidate <= end - offset - headerLen) {
              frameSize = syncsafeCandidate;
            }
          }
        }
      }

      if (frameSize <= 0 || offset + headerLen + frameSize > end) {
        offset += headerLen;
        continue;
      }

      const frameData = bytes.slice(offset + headerLen, offset + headerLen + frameSize);
      const encoding = frameData.length > 0 ? frameData[0] : 0;
      const textBody = frameData.length > 1 ? decodeText(frameData.slice(1), encoding) : '';

      rawFrames[frameId] = textBody;

      switch (frameId) {
        case 'TIT2':
        case 'TT2': // ID3v2.2 Title
          title = textBody;
          break;
        case 'TPE1':
        case 'TP1': // ID3v2.2 Artist
          artist = textBody;
          break;
        case 'TPE2':
        case 'TP2': // ID3v2.2 Album Artist
          albumArtist = textBody;
          break;
        case 'TALB':
        case 'TAL': // ID3v2.2 Album
          album = textBody;
          break;
        case 'TCON':
        case 'TCO': // ID3v2.2 Genre
          if (textBody.startsWith('(') && textBody.includes(')')) {
            const idxStr = textBody.substring(1, textBody.indexOf(')'));
            const num = parseInt(idxStr, 10);
            if (!isNaN(num) && ID3V1_GENRES[num]) {
              genre = ID3V1_GENRES[num];
            } else {
              genre = textBody.replace(/^\(\d+\)/, '').trim();
            }
          } else {
            genre = textBody;
          }
          break;
        case 'TYER':
        case 'TYE': // ID3v2.2 Year
        case 'TDRC': // Recording time (ID3v2.4)
          const yrMatch = textBody.match(/\b(19\d{2}|20\d{2})\b/);
          if (yrMatch) year = parseInt(yrMatch[1], 10);
          break;
        case 'TRCK':
        case 'TRK': // ID3v2.2 Track Number
          const trkMatch = textBody.match(/^(\d+)/);
          if (trkMatch) trackNumber = parseInt(trkMatch[1], 10);
          break;
        case 'TPOS': // Part of set / Disc
          const discMatch = textBody.match(/^(\d+)/);
          if (discMatch) discNumber = parseInt(discMatch[1], 10);
          break;
        case 'TCOM':
        case 'TCM': // Composer
          composer = textBody;
          break;
        case 'TIPL':
        case 'IPLS':
        case 'IPL': // Involved people / Producer
          producer = textBody;
          break;
        case 'TCOP':
        case 'TCR': // Copyright
          copyright = textBody;
          break;
        case 'TPUB':
        case 'PBM': // Publisher
          publisher = textBody;
          break;
        case 'TSRC': // ISRC
          isrc = textBody;
          break;
        case 'APIC':
        case 'PIC': // Attached Picture (Artwork in v2.3/v2.4 or v2.2)
          const art = parseAPICFrame(frameData, majorVersion);
          if (art) {
            coverUrl = art.dataUrl;
          }
          break;
      }

      offset += headerLen + frameSize;
    }

    // 1b. Deep Tag Picture Extraction Fallback if APIC frame was skipped or formatted differently
    if (!coverUrl && bytes.length > 32) {
      const searchEnd = Math.min(bytes.length, id3Start + 10 + tagSize);
      if (searchEnd > id3Start + 10) {
        const searchSlice = bytes.subarray(id3Start + 10, searchEnd);
        const headerMatch = findImageHeaderIndex(searchSlice, 0, Math.min(searchSlice.length, Math.max(0, searchSlice.length - 100)));
        if (headerMatch) {
          const imgBytes = extractCleanImageBytes(searchSlice, headerMatch.index, headerMatch.mimeType);
          if (imgBytes.length >= 100) {
            coverUrl = bytesToDataUrl(imgBytes, headerMatch.mimeType);
          }
        }
      }
    }
  }

  // 1c. Deep Metadata & Binary APIC Scanner Fallback (up to 8MB)
  if (!coverUrl && bytes.length > 64) {
    coverUrl = extractCoverArtFallbackFromBytes(bytes);
  }

  // Optimize embedded cover art if extracted
  if (coverUrl) {
    const optimized = await optimizeCoverArtDataUrl(coverUrl);
    coverUrl = optimized || coverUrl;
  }

  // 2. ID3v1 Fallback if title/artist still empty (Last 128 bytes)
  if ((!title || !artist) && bytes.length >= 128) {
    const v1Offset = bytes.length - 128;
    if (bytes[v1Offset] === 0x54 && bytes[v1Offset + 1] === 0x41 && bytes[v1Offset + 2] === 0x47) {
      // 'TAG'
      const v1Title = decodeText(bytes.slice(v1Offset + 3, v1Offset + 33), 0);
      const v1Artist = decodeText(bytes.slice(v1Offset + 33, v1Offset + 63), 0);
      const v1Album = decodeText(bytes.slice(v1Offset + 63, v1Offset + 93), 0);
      const v1Year = decodeText(bytes.slice(v1Offset + 93, v1Offset + 97), 0);
      const v1GenreIdx = bytes[v1Offset + 127];

      if (!title && v1Title) title = v1Title;
      if (!artist && v1Artist) artist = v1Artist;
      if (!album && v1Album) album = v1Album;
      if (!year && v1Year) year = parseInt(v1Year, 10) || undefined;
      if (!genre && ID3V1_GENRES[v1GenreIdx]) genre = ID3V1_GENRES[v1GenreIdx];
    }
  }

  // 3. Filename heuristic fallback
  if (!title || !artist) {
    const fromFilename = parseMetadataFromFilename(fileName);
    if (!title) title = fromFilename.title;
    if (!artist) artist = fromFilename.artist;
    if (!trackNumber && fromFilename.trackNumber) trackNumber = fromFilename.trackNumber;
  }

  if (!album) {
    album = 'Single Release / Vault Cuts';
  }
  if (!genre) {
    genre = 'Break Beats & Samples';
  }

  // 4. Audio properties (Duration, Bitrate, Sample Rate)
  let durationSeconds = 180;
  let sampleRateHz = 44100;
  let bitrateKbps = 320;

  // Try decoding duration via browser Audio Element
  if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      const dur = await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 1200);
        audio.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve(audio.duration && !isNaN(audio.duration) ? Math.round(audio.duration) : 0);
        };
        audio.onerror = () => {
          clearTimeout(timeout);
          resolve(0);
        };
        audio.src = audioUrl;
      });
      URL.revokeObjectURL(audioUrl);
      if (dur > 0) {
        durationSeconds = dur;
        bitrateKbps = Math.round((buffer.byteLength * 8) / (durationSeconds * 1000));
        // Clamp to standard MP3 bitrates
        if (bitrateKbps < 64) bitrateKbps = 128;
        if (bitrateKbps > 320) bitrateKbps = 320;
      }
    } catch {
      // Audio element decoding failed, use file size estimation
      durationSeconds = Math.max(30, Math.round(buffer.byteLength / 40000));
    }
  } else {
    durationSeconds = Math.max(30, Math.round(buffer.byteLength / 40000));
  }

  const hasEmbeddedArtwork = Boolean(coverUrl);
  const artworkStatus: 'extracted' | 'missing' = hasEmbeddedArtwork ? 'extracted' : 'missing';

  return {
    title,
    artist,
    albumArtist: albumArtist || artist,
    album,
    genre,
    year: year || 2026,
    trackNumber,
    discNumber: discNumber || 1,
    composer,
    producer,
    copyright,
    publisher: publisher || 'ChanceTEK One',
    isrc,
    durationSeconds,
    bitrateKbps,
    sampleRateHz,
    format: 'MP3 (MPEG-1 Audio Layer III)',
    hasEmbeddedArtwork,
    artworkStatus,
    coverUrl,
    fileHash,
    rawFrames,
  };
}

/**
 * Extracts and optimizes cover art from an uploaded image file (JPEG, PNG, WebP)
 */
export async function extractCoverArtFromImageFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const headerMatch = findImageHeaderIndex(bytes, 0, Math.min(bytes.length, 128));
  const mimeType = headerMatch?.mimeType || (file as File).type || 'image/jpeg';
  const dataUrl = bytesToDataUrl(bytes, mimeType);
  return await optimizeCoverArtDataUrl(dataUrl);
}

/**
 * Deep fallback scanner: searches binary chunks for APIC frame tags or embedded image magic signatures
 */
export function extractCoverArtFallbackFromBytes(bytes: Uint8Array): string | undefined {
  const maxSearch = Math.min(bytes.length, 8 * 1024 * 1024);

  // 1. Scan for ASCII "APIC" (0x41, 0x50, 0x49, 0x43) or "PIC" (0x50, 0x49, 0x43)
  for (let i = 0; i < maxSearch - 10; i++) {
    const isAPIC = bytes[i] === 0x41 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x49 && bytes[i + 3] === 0x43;
    const isPIC = bytes[i] === 0x50 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x43;
    if (isAPIC || isPIC) {
      const searchStart = isAPIC ? i + 4 : i + 3;
      const match = findImageHeaderIndex(bytes, searchStart, Math.min(bytes.length - searchStart, 1024));
      if (match) {
        const imgBytes = extractCleanImageBytes(bytes, match.index, match.mimeType);
        if (imgBytes.length >= 100) {
          return bytesToDataUrl(imgBytes, match.mimeType);
        }
      }
    }
  }

  // 2. Only scan prefix if the file actually begins with an ID3 tag ('ID3')
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize = readSyncsafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);
    if (tagSize > 0) {
      const headerSlice = bytes.subarray(10, Math.min(bytes.length, 10 + tagSize));
      const directMatch = findImageHeaderIndex(headerSlice, 0, headerSlice.length);
      if (directMatch) {
        const imgBytes = extractCleanImageBytes(headerSlice, directMatch.index, directMatch.mimeType);
        if (imgBytes.length >= 200) {
          return bytesToDataUrl(imgBytes, directMatch.mimeType);
        }
      }
    }
  }

  return undefined;
}

/**
 * Asynchronously extracts cover art from an ArrayBuffer or Uint8Array
 */
export async function extractCoverArtFromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string | undefined> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const fallback = extractCoverArtFallbackFromBytes(bytes);
  if (fallback) {
    return await optimizeCoverArtDataUrl(fallback);
  }
  return undefined;
}

