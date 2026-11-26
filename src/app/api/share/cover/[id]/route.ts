import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  lookupAudiobookForShareMetadata,
  lookupPodcastForShareMetadata,
  lookupTrackForShareMetadata,
  lookupVideoForShareMetadata,
  normalizeExternalCoverOrigin,
} from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

const IMAGE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
};

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const mimeType = match[1] || 'image/jpeg';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  try {
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf-8');
    if (buffer.byteLength < 32) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

function parseCoverSlug(rawParam: string, queryType?: string | null): { id: string; mediaType: string } {
  let decoded = rawParam || '';
  try {
    decoded = decodeURIComponent(rawParam);
  } catch { }

  // Strip optional crawler-friendly file extension (.jpg, .jpeg, .png, .webp)
  let cleanId = decoded.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  let mediaType = (queryType || 'song').toLowerCase();

  // Support clean query-less prefixes: audiobook--<id>.jpg, podcast--<id>.jpg, video--<id>.jpg
  if (cleanId.startsWith('audiobook--')) {
    mediaType = 'audiobook';
    cleanId = cleanId.slice('audiobook--'.length);
  } else if (cleanId.startsWith('podcast--')) {
    mediaType = 'podcast';
    cleanId = cleanId.slice('podcast--'.length);
  } else if (cleanId.startsWith('video--')) {
    mediaType = 'video';
    cleanId = cleanId.slice('video--'.length);
  }

  return { id: cleanId, mediaType };
}

function readLocalFallbackCover(mediaType: string): { body: Uint8Array; contentType: string } | null {
  const publicRoot = path.resolve(process.cwd(), 'public');
  const candidates =
    mediaType === 'audiobook' || mediaType === 'book'
      ? [
        path.resolve(publicRoot, 'images', 'audiobooks', 'famio.jpg'),
        path.resolve(publicRoot, 'images', 'chancetekone_logo.jpg'),
      ]
      : mediaType === 'video'
        ? [
          path.resolve(publicRoot, 'images', 'video-thumbs', 'video-1.jpg'),
          path.resolve(publicRoot, 'images', 'chancetekone_logo.jpg'),
        ]
        : mediaType === 'podcast'
          ? [
            path.resolve(publicRoot, 'images', 'genres', 'hip-hop.jpg'),
            path.resolve(publicRoot, 'images', 'chancetekone_logo.jpg'),
          ]
          : [
            path.resolve(publicRoot, 'images', 'genres', 'rnb-neo-soul.jpg'),
            path.resolve(publicRoot, 'images', 'chancetekone_logo.jpg'),
          ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const bytes = fs.readFileSync(candidate);
        return { body: new Uint8Array(bytes), contentType: mimeFromExt(candidate) };
      }
    } catch { }
  }
  return null;
}

async function resolveCoverBinary(
  request: NextRequest,
  rawParam: string
): Promise<{ body: Uint8Array; contentType: string } | { redirectUrl: string }> {
  const sp = request.nextUrl.searchParams;
  const { id, mediaType } = parseCoverSlug(rawParam, sp.get('type'));
  const hints = {
    title: sp.get('t') || undefined,
    artist: sp.get('a') || undefined,
    cover: sp.get('c') || undefined,
  };

  const resolved =
    mediaType === 'audiobook' || mediaType === 'book'
      ? await lookupAudiobookForShareMetadata(id, hints)
      : mediaType === 'podcast'
        ? await lookupPodcastForShareMetadata(id, hints)
        : mediaType === 'video'
          ? await lookupVideoForShareMetadata(id, hints)
          : await lookupTrackForShareMetadata(id, hints);

  const rawCover = normalizeExternalCoverOrigin(resolved.rawCover);

  // 1. Embedded data:image/... URI -> decode & stream real binary image
  if (rawCover.startsWith('data:image/')) {
    const decoded = decodeDataUrl(rawCover);
    if (decoded) {
      return { body: new Uint8Array(decoded.buffer), contentType: decoded.mimeType };
    }
  }

  // 2. External HTTPS image URL (Firebase Storage / GCS / 8ofspadesworks.us / CDN) -> proxy bytes cleanly
  if (rawCover.startsWith('https://') || rawCover.startsWith('http://')) {
    try {
      const upstream = await fetch(rawCover, {
        redirect: 'follow',
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'ChanceTEKOne-OGCoverProxy/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (upstream.ok) {
        const arr = await upstream.arrayBuffer();
        const rawCt = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const contentType = rawCt.startsWith('image/') ? rawCt : mimeFromExt(rawCover.split('?')[0]);
        if (arr.byteLength > 32) {
          return { body: new Uint8Array(arr), contentType };
        }
      }
    } catch (fetchErr) {
      console.warn('[api/share/cover] Upstream fetch warning for', rawCover, fetchErr);
    }
  }

  // 3. Local asset in /public
  try {
    const relPath = rawCover.startsWith('/') ? rawCover : '';
    if (relPath) {
      const cleanRel = decodeURIComponent(relPath.split('?')[0].split('#')[0]).replace(/^\/+/, '');
      const publicRoot = path.resolve(process.cwd(), 'public');
      const fullPath = path.resolve(publicRoot, cleanRel);
      if (fullPath.startsWith(publicRoot + path.sep) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const fileBytes = fs.readFileSync(fullPath);
        return { body: new Uint8Array(fileBytes), contentType: mimeFromExt(fullPath) };
      }
    }
  } catch (fsErr) {
    console.warn('[api/share/cover] Local file read warning:', fsErr);
  }

  // 4. Guaranteed HTTP 200 binary fallback from /public (zero 404s, zero redirects that strict bots drop)
  const localFallback = readLocalFallbackCover(mediaType);
  if (localFallback) {
    return localFallback;
  }

  if (rawCover.startsWith('https://')) {
    return { redirectUrl: rawCover };
  }
  return { redirectUrl: 'https://chancetekone.us/images/chancetekone_logo.jpg' };
}

/**
 * GET /api/share/cover/[id]
 * Public binary image endpoint serving the exact cover art of any shared song, audiobook, podcast, or video.
 * Supports clean extensioned URLs (/api/share/cover/trk-123.jpg) and legacy ?type=song URLs.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await resolveCoverBinary(request, id);

    if ('body' in result) {
      return new NextResponse(Buffer.from(result.body), {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Content-Length': String(result.body.byteLength),
          ...IMAGE_CORS_HEADERS,
        },
      });
    }

    return NextResponse.redirect(result.redirectUrl, 302);
  } catch (err) {
    console.error('[api/share/cover] GET error:', err);
    const localFallback = readLocalFallbackCover('song');
    if (localFallback) {
      return new NextResponse(Buffer.from(localFallback.body), {
        status: 200,
        headers: {
          'Content-Type': localFallback.contentType,
          'Content-Length': String(localFallback.body.byteLength),
          ...IMAGE_CORS_HEADERS,
        },
      });
    }
    return NextResponse.redirect('https://chancetekone.us/images/chancetekone_logo.jpg', 302);
  }
}

/**
 * HEAD /api/share/cover/[id]
 * Required by Facebook, Messenger, WhatsApp, iMessage, and Famio.us preview crawlers that probe headers first.
 */
export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await resolveCoverBinary(request, id);
    if ('body' in result) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Content-Length': String(result.body.byteLength),
          ...IMAGE_CORS_HEADERS,
        },
      });
    }
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        ...IMAGE_CORS_HEADERS,
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        ...IMAGE_CORS_HEADERS,
      },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: IMAGE_CORS_HEADERS,
  });
}
