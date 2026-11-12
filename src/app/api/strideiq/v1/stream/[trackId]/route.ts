import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { hashFileCached } from '@/lib/server/audioAssetStore';
import {
  buildStrideIqCorsHeaders,
  optionsStrideIqResponse,
  verifyStrideIqPartnerRequest,
} from '@/lib/server/strideiqStore';
import { resolvePlayableStreamAsset } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
};

function parseHttpRange(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | 'invalid' {
  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
  if (!m) return 'invalid';
  const rawStart = m[1];
  const rawEnd = m[2];
  if (!rawStart && !rawEnd) return 'invalid';

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return 'invalid';
  }

  return { start, end: Math.min(end, size - 1) };
}

function streamResponseHeaders(
  request: NextRequest,
  extra: Record<string, string>,
): Record<string, string> {
  return {
    ...buildStrideIqCorsHeaders(request),
    'Access-Control-Expose-Headers':
      'Content-Range, Content-Length, Accept-Ranges, ETag, Content-Type',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    ...extra,
  };
}

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

async function handleStream(
  request: NextRequest,
  trackIdParam: string,
  isHead: boolean,
): Promise<NextResponse> {
  const trackId = decodeURIComponent(trackIdParam || '').trim();
  const auth = await verifyStrideIqPartnerRequest(request, {
    trackIdForStreamToken: trackId,
    rateLimitPerMinute: 300,
  });

  if (!auth.authorized) {
    return auth.response!;
  }

  const corsHeaders = buildStrideIqCorsHeaders(request);
  const track = await resolvePlayableStreamAsset(trackId);

  if (!track || !track.playable) {
    return NextResponse.json(
      { ok: false, error: `Stream unavailable for "${trackId}".` },
      { status: 404, headers: { ...corsHeaders, ...auth.rateHeaders } },
    );
  }

  // External Firebase Storage / CDN track
  if (track.isExternalUrl && track.resolvedAudioSource) {
    const proxyRequested = request.nextUrl.searchParams.get('proxy') === '1';
    if (!proxyRequested || isHead) {
      return new NextResponse(null, {
        status: 302,
        headers: streamResponseHeaders(request, {
          ...auth.rateHeaders,
          Location: track.resolvedAudioSource,
        }),
      });
    }

    const forwardHeaders: Record<string, string> = {};
    const range = request.headers.get('range');
    if (range) forwardHeaders.Range = range;

    const upstream = await fetch(track.resolvedAudioSource, {
      headers: forwardHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { ok: false, error: 'Upstream audio stream unavailable.' },
        { status: 502, headers: corsHeaders },
      );
    }

    const passthroughHeaders = streamResponseHeaders(request, {
      ...auth.rateHeaders,
      'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
    });
    const cl = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');
    if (cl) passthroughHeaders['Content-Length'] = cl;
    if (cr) passthroughHeaders['Content-Range'] = cr;

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: passthroughHeaders,
    });
  }

  // Local physical disk file with HTTP 206 Partial Content byte-range seeking
  if (!track.localFilePath) {
    return NextResponse.json(
      { ok: false, error: 'Underlying audio file is missing on server.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const { size, sha256 } = await hashFileCached(track.localFilePath);
  const ext = path.extname(track.localFilePath).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] || 'audio/mpeg';
  const etag = `"${sha256}"`;

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const parsed = parseHttpRange(rangeHeader, size);
    if (parsed === 'invalid') {
      return new NextResponse(null, {
        status: 416,
        headers: streamResponseHeaders(request, {
          ...auth.rateHeaders,
          'Content-Range': `bytes */${size}`,
        }),
      });
    }

    const chunkLen = parsed.end - parsed.start + 1;
    const headers = streamResponseHeaders(request, {
      ...auth.rateHeaders,
      'Content-Type': contentType,
      'Content-Length': String(chunkLen),
      'Content-Range': `bytes ${parsed.start}-${parsed.end}/${size}`,
      ETag: etag,
    });

    if (isHead) {
      return new NextResponse(null, { status: 206, headers });
    }

    const nodeStream = fs.createReadStream(track.localFilePath, {
      start: parsed.start,
      end: parsed.end,
    });
    return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 206,
      headers,
    });
  }

  const headers = streamResponseHeaders(request, {
    ...auth.rateHeaders,
    'Content-Type': contentType,
    'Content-Length': String(size),
    ETag: etag,
  });

  if (isHead) {
    return new NextResponse(null, { status: 200, headers });
  }

  const nodeStream = fs.createReadStream(track.localFilePath);
  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await context.params;
  return handleStream(request, trackId, false);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await context.params;
  return handleStream(request, trackId, true);
}

