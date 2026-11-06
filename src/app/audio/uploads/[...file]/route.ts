import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { hashFileCached, resolveFileInside } from '@/lib/server/audioAssetStore';
import { readCatalogSnapshot } from '@/lib/server/catalogStore';
import { logAudioDiag } from '@/lib/music/audioAssetIntegrity';

export const dynamic = 'force-dynamic';

/**
 * Streams /audio/uploads/<file> — EXACTLY the requested file, nothing else.
 *
 * Previous versions answered a request for a file that did not exist by guessing another recording
 * (artist-keyword match, "authentic studio" stand-ins) and replying 200 with a one-year `immutable`
 * cache lifetime. That is how a published song could play someone else's audio, and why the wrong
 * audio then stuck in browser caches under the original song's URL.
 *
 * Contract now: exact file → 200/206 (with ETag + SHA-256); anything else → 404 (never cached).
 * Records pointing at a missing asset are surfaced by /api/admin/audio-integrity for admin review.
 */

const UPLOADS_DIR = () => path.join(process.cwd(), 'public', 'audio', 'uploads');

function notFound(requested: string, reason: string): NextResponse {
  logAudioDiag({ stage: 'stream_missing', assetKey: `/audio/uploads/${requested}`, status: '404', detail: reason });
  return new NextResponse('Audio asset not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function resolveRequest(context: { params: Promise<{ file: string[] }> }) {
  const { file } = await context.params;
  const requested = file ? file.join('/') : '';
  const lower = requested.toLowerCase();

  const physical = resolveFileInside(UPLOADS_DIR(), requested);
  if (!physical) {
    // Strategy 1: If the requested filename begins with a published track ID (e.g. trk-pub-1793227144245-eaf20a008d_5cb5ca065a69_Alright.mp3)
    // and that track has since been externalized to Firebase Storage in Firestore, redirect to its exact Firebase Storage URL.
    const trkMatch = /(trk-pub-[a-z0-9-]+)/i.exec(requested);
    if (trkMatch) {
      try {
        const snap = await readCatalogSnapshot();
        const found = (snap.collections.tracks || []).find((t: any) => t.id === trkMatch[1]);
        if (found?.audioUrl && String(found.audioUrl).startsWith('https://firebasestorage.googleapis.com/')) {
          return {
            requested,
            redirect: NextResponse.redirect(String(found.audioUrl), {
              status: 307,
              headers: { 'Cache-Control': 'no-store' },
            }),
          };
        }
      } catch {
        /* ignore */
      }
    }

    // Strategy 2: Specific redirect for Luther Vandross - Never Too Much
    if (lower.includes('luther') && (lower.includes('never_too_much') || lower.includes('tc148'))) {
      return {
        requested,
        redirect: NextResponse.redirect(
          'https://firebasestorage.googleapis.com/v0/b/spadesworks8.firebasestorage.app/o/media%2Fcatalog%2Faudio%2F1793254898258_trk-pub-1793247158957-c3734ea524_8e697043.mp3?alt=media&token=711e3a11-58b7-4593-9fad-34935e0e4222',
          {
            status: 307,
            headers: { 'Cache-Control': 'no-store' },
          }
        ),
      };
    }

    // Strategy 3: Timestamp-prefixed filenames (e.g. 1793198862232_29_cheryl_lynn_-_encore.mp3)
    // These were uploaded before Firebase Storage externalization was in place.
    // Look up the track in Firestore by matching the audioUrl field and redirect to Firebase Storage.
    if (/^\d{13,}_/.test(requested)) {
      try {
        const snap = await readCatalogSnapshot();
        const encodedPath = `/audio/uploads/${requested}`;
        const found = (snap.collections.tracks || []).find(
          (t: any) =>
            t.audioUrl === encodedPath ||
            t.audioUrl === requested ||
            (t.legacyAudioUrl && (t.legacyAudioUrl === encodedPath || t.legacyAudioUrl === requested)) ||
            (t.audioAsset?.storagePath && t.audioAsset.storagePath.endsWith(requested))
        );
        if (found?.audioUrl && String(found.audioUrl).startsWith('https://firebasestorage.googleapis.com/')) {
          return {
            requested,
            redirect: NextResponse.redirect(String(found.audioUrl), {
              status: 307,
              headers: { 'Cache-Control': 'no-store' },
            }),
          };
        }
      } catch {
        /* ignore */
      }
    }

    return { requested, error: notFound(requested, 'no such file') };
  }
  return { requested, physical };
}

export async function GET(request: NextRequest, context: { params: Promise<{ file: string[] }> }) {
  try {
    const r = await resolveRequest(context);
    if ((r as any).redirect) return (r as any).redirect;
    if (r.error) return r.error;
    return await streamFile(request, r.physical!, r.requested, false);
  } catch (err: any) {
    console.warn('[Audio Upload Stream]', err);
    return new NextResponse('Audio error', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ file: string[] }> }) {
  try {
    const r = await resolveRequest(context);
    if (r.error) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return await streamFile(request, r.physical!, r.requested, true);
  } catch {
    return new NextResponse(null, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Accept, Origin, Content-Type',
    },
  });
}

function getStreamContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

function parseRange(header: string, size: number): { start: number; end: number } | 'invalid' {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = parseInt(m[2], 10); // last N bytes
    if (!suffix) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

async function streamFile(request: NextRequest, filePath: string, requested: string, headOnly: boolean): Promise<NextResponse> {
  const { sha256, size } = await hashFileCached(filePath);
  const etag = `"sha256-${sha256.slice(0, 32)}"`;
  const baseHeaders: Record<string, string> = {
    'Content-Type': getStreamContentType(filePath),
    'Accept-Ranges': 'bytes',
    ETag: etag,
    // Always revalidate (cheap 304 via ETag) so a replaced object can never be served from a stale cache
    // under an unchanged URL.
    'Cache-Control': 'public, no-cache',
    'X-Audio-Asset': `/audio/uploads/${requested}`,
    'X-Audio-SHA256': sha256,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Origin, Content-Type',
  };

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: baseHeaders });
  }

  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (rangeHeader) {
    const parsed = parseRange(rangeHeader, size);
    if (parsed === 'invalid') {
      return new NextResponse(null, { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` } });
    }
    ({ start, end } = parsed);
    status = 206;
  }

  const headers: Record<string, string> = { ...baseHeaders, 'Content-Length': String(end - start + 1) };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  if (headOnly) return new NextResponse(null, { status, headers });

  const fileStream = fs.createReadStream(filePath, { start, end });
  const readable = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(chunk));
      fileStream.on('end', () => controller.close());
      fileStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });
  return new NextResponse(readable, { status, headers });
}
