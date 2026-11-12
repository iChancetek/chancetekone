import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser } from '@/lib/auth/serverAuth';
import { hashFileCached } from '@/lib/server/audioAssetStore';
import {
  MAX_PROFILE_MEDIA_BYTES,
  resolveLocalProfileMedia,
  saveServerProfileMedia,
  upsertServerUserProfile,
  validateProfileMediaUpload,
} from '@/lib/server/profileStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Range, x-admin-email, x-user-id, x-user-email',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
};

function getMimeTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
    case '.mov':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.ogv':
    case '.ogg':
      return 'video/ogg';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.3gp':
      return 'video/3gpp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'application/octet-stream';
  }
}

function parseByteRange(
  rangeHeader: string,
  totalSize: number
): { ok: true; start: number; end: number } | { ok: false } {
  const trimmed = rangeHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bytes=')) return { ok: false };
  const spec = trimmed.slice(6).split(',')[0]?.trim() || '';
  const dashIdx = spec.indexOf('-');
  if (dashIdx === -1) return { ok: false };

  const startStr = spec.slice(0, dashIdx).trim();
  const endStr = spec.slice(dashIdx + 1).trim();

  let start: number;
  let end: number;

  if (startStr === '') {
    // Suffix byte range: bytes=-N
    const suffixLen = Number(endStr);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return { ok: false };
    start = Math.max(0, totalSize - suffixLen);
    end = Math.max(start, totalSize - 1);
  } else {
    start = Number(startStr);
    end = endStr === '' ? totalSize - 1 : Number(endStr);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { ok: false };
  }

  if (start < 0 || start >= totalSize || end < start) return { ok: false };
  end = Math.min(end, totalSize - 1);
  return { ok: true, start, end };
}

function createFileWebStream(filePath: string, start: number, end: number): ReadableStream<Uint8Array> {
  let fileStream: fs.ReadStream | null = null;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.on('data', (chunk) => {
        if (closed) return;
        try {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        } catch {
          closed = true;
          fileStream?.destroy();
        }
      });
      fileStream.on('end', () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      });
      fileStream.on('error', (err) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(err);
        } catch {}
      });
    },
    cancel() {
      closed = true;
      fileStream?.destroy();
    },
  });
}

async function handleReadMedia(request: NextRequest, headOnly: boolean): Promise<Response> {
  try {
    const fileParam = new URL(request.url).searchParams.get('file')?.trim() || '';
    if (!fileParam) {
      return NextResponse.json(
        { ok: false, error: 'Missing file parameter.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const resolvedPath = resolveLocalProfileMedia(fileParam);
    if (!resolvedPath) {
      return NextResponse.json(
        { ok: false, error: 'Profile media file not found.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { sha256, size } = await hashFileCached(resolvedPath);
    const etag = `"${sha256}"`;
    const contentType = getMimeTypeForFile(resolvedPath);
    const rangeHeader = request.headers.get('range');

    const baseHeaders: Record<string, string> = {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
    };

    if (!rangeHeader && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: baseHeaders });
    }

    if (size === 0) {
      return new Response(null, {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': '0' },
      });
    }

    if (rangeHeader) {
      const parsed = parseByteRange(rangeHeader, size);
      if (!parsed.ok) {
        return new Response(null, {
          status: 416,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes */${size}`,
          },
        });
      }

      const { start, end } = parsed;
      const chunkLength = end - start + 1;
      return new Response(headOnly ? null : createFileWebStream(resolvedPath, start, end), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(chunkLength),
        },
      });
    }

    return new Response(headOnly ? null : createFileWebStream(resolvedPath, 0, size - 1), {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(size),
      },
    });
  } catch (err: any) {
    console.error('[/api/profile/media GET] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to stream profile media.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  return handleReadMedia(request, false);
}

export async function HEAD(request: NextRequest) {
  return handleReadMedia(request, true);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated) {
      return (
        auth.response ||
        NextResponse.json(
          { ok: false, error: 'Authentication required.' },
          { status: 401, headers: CORS_HEADERS }
        )
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (!fileEntry || typeof fileEntry === 'string' || typeof (fileEntry as Blob).arrayBuffer !== 'function') {
      return NextResponse.json(
        { ok: false, error: 'Missing media file upload.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const uploadedFile = fileEntry as File;
    if (uploadedFile.size > MAX_PROFILE_MEDIA_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'File exceeds the 50MB maximum limit.' },
        { status: 413, headers: CORS_HEADERS }
      );
    }

    const userId = String(formData.get('userId') || auth.userId || '').trim();
    const email = String(formData.get('email') || auth.email || '').trim() || undefined;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Missing userId for profile media upload.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const authEmailLower = auth.email?.trim().toLowerCase() || '';
    const targetEmailLower = email?.toLowerCase() || '';
    const isAuthorized =
      Boolean(auth.isAdmin) ||
      (Boolean(auth.userId) && userId === auth.userId) ||
      (Boolean(authEmailLower) && authEmailLower === targetEmailLower);

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'You are not authorized to upload media for this profile.' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = uploadedFile.name || 'profile_media';
    const check = validateProfileMediaUpload(buffer, uploadedFile.type || '', fileName);

    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: check.reason },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const saved = await saveServerProfileMedia({
      userId,
      email,
      mediaType: check.kind,
      fileName,
      contentType: check.mime,
      buffer,
    });

    return NextResponse.json(
      {
        ok: true,
        url: saved.url,
        mediaType: saved.mediaType,
        storageBackend: saved.storageBackend,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
      },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/profile/media POST] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to upload profile media.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated) {
      return (
        auth.response ||
        NextResponse.json(
          { ok: false, error: 'Authentication required.' },
          { status: 401, headers: CORS_HEADERS }
        )
      );
    }

    const { searchParams } = new URL(request.url);
    let targetUserId = searchParams.get('userId')?.trim() || '';
    let targetEmail = searchParams.get('email')?.trim() || undefined;

    if (!targetUserId) {
      const body = await request.json().catch(() => null);
      if (body && typeof body === 'object') {
        if (typeof body.userId === 'string') targetUserId = body.userId.trim();
        if (typeof body.email === 'string' && body.email.trim()) targetEmail = body.email.trim();
      }
    }

    targetUserId = targetUserId || auth.userId || '';
    if (!targetUserId) {
      return NextResponse.json(
        { ok: false, error: 'Missing userId.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const authEmailLower = auth.email?.trim().toLowerCase() || '';
    const targetEmailLower = targetEmail?.toLowerCase() || '';
    const isAuthorized =
      Boolean(auth.isAdmin) ||
      (Boolean(auth.userId) && targetUserId === auth.userId) ||
      (Boolean(authEmailLower) && authEmailLower === targetEmailLower);

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'You are not authorized to clear media for this profile.' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    await upsertServerUserProfile({
      userId: targetUserId,
      email: targetEmail || auth.email,
      avatarUrl: null,
      profileVideoUrl: null,
      mediaType: null,
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/profile/media DELETE] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to delete profile media.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

