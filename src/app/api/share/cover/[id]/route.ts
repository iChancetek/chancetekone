import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  lookupAudiobookForShareMetadata,
  lookupPodcastForShareMetadata,
  lookupTrackForShareMetadata,
  normalizeExternalCoverOrigin,
} from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

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

/**
 * GET /api/share/cover/[id]
 * Public binary image endpoint serving the exact cover art of any shared song.
 * Enables SMS/iMessage, WhatsApp, Facebook, X/Twitter, LinkedIn, and Telegram crawlers
 * to render exact song cover art even when artwork is stored as embedded base64 or cloud URLs.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sp = request.nextUrl.searchParams;
    const mediaType = (sp.get('type') || 'song').toLowerCase();
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
          : await lookupTrackForShareMetadata(id, hints);

    const rawCover = normalizeExternalCoverOrigin(resolved.rawCover);

    // 1. Embedded data:image/... URI -> decode & stream real binary image
    if (rawCover.startsWith('data:image/')) {
      const decoded = decodeDataUrl(rawCover);
      if (decoded) {
        return new NextResponse(new Uint8Array(decoded.buffer), {
          status: 200,
          headers: {
            'Content-Type': decoded.mimeType,
            'Content-Length': String(decoded.buffer.byteLength),
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    }

    // 2. External HTTPS image URL (Firebase Storage / GCS / CDN) -> proxy bytes cleanly
    if (rawCover.startsWith('https://')) {
      try {
        const upstream = await fetch(rawCover, { cache: 'force-cache', redirect: 'follow' });
        if (upstream.ok) {
          const arr = await upstream.arrayBuffer();
          const contentType = upstream.headers.get('content-type') || 'image/jpeg';
          if (arr.byteLength > 32 && contentType.toLowerCase().startsWith('image/')) {
            return new NextResponse(Buffer.from(arr), {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(arr.byteLength),
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
              },
            });
          }
        }
      } catch {
        // Fall through to local fallback
      }
    }

    // 3. Local asset in /public
    const relPath = rawCover.startsWith('/') ? rawCover : '/images/genres/rnb-neo-soul.jpg';
    const cleanRel = decodeURIComponent(relPath.split('?')[0].split('#')[0]).replace(/^\/+/, '');
    const publicRoot = path.resolve(process.cwd(), 'public');
    let fullPath = path.resolve(publicRoot, cleanRel);

    if (!fullPath.startsWith(publicRoot + path.sep) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      fullPath = path.resolve(publicRoot, 'images', 'genres', 'rnb-neo-soul.jpg');
    }

    const fileBytes = fs.readFileSync(fullPath);
    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        'Content-Type': mimeFromExt(fullPath),
        'Content-Length': String(fileBytes.byteLength),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to resolve track cover art' }, { status: 404 });
  }
}

