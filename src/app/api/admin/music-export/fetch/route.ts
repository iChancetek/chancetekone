import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { isSuperAdminEmail } from '@/lib/catalog/adminIdentity';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTERNAL_HOSTS = new Set([
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'chancetekone.us',
  'www.chancetekone.us',
  'chancetekone.com',
  'www.chancetekone.com',
]);

function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.m4a':
    case '.aac':
      return 'audio/mp4';
    case '.flac':
      return 'audio/flac';
    case '.ogg':
      return 'audio/ogg';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * GET /api/admin/music-export/fetch?url=...
 * Strictly Super Admin–only read-only media fetcher for the Autonomous Music Export Agent.
 * Reads local public assets or approved Firebase/platform URLs without ever mutating platform files.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized || !isSuperAdminEmail(auth.email)) {
    return NextResponse.json(
      { ok: false, error: 'Access Denied: Super Administrator privileges required for platform music export.' },
      { status: 403 }
    );
  }

  const rawUrl = (request.nextUrl.searchParams.get('url') || '').trim();
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: 'Missing url parameter.' }, { status: 400 });
  }

  try {
    // 1. Relative local asset inside /public (read-only)
    if (rawUrl.startsWith('/')) {
      const cleanRel = decodeURIComponent(rawUrl.split('?')[0].split('#')[0]).replace(/^\/+/, '');
      const publicRoot = path.resolve(process.cwd(), 'public');
      const fullPath = path.resolve(publicRoot, cleanRel);

      if (!fullPath.startsWith(publicRoot + path.sep) && fullPath !== publicRoot) {
        return NextResponse.json({ ok: false, error: 'Invalid asset path.' }, { status: 400 });
      }

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return NextResponse.json({ ok: false, error: 'Asset not found on disk.' }, { status: 404 });
      }

      const bytes = fs.readFileSync(fullPath);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': inferContentType(fullPath),
          'Content-Length': String(bytes.byteLength),
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2. Approved HTTPS cloud storage URL (Firebase Storage / GCS / platform CDN)
    if (rawUrl.startsWith('https://')) {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const isAllowed =
        ALLOWED_EXTERNAL_HOSTS.has(host) ||
        host.endsWith('.firebasestorage.app') ||
        host.endsWith('.appspot.com') ||
        host.endsWith('.googleusercontent.com');

      if (!isAllowed) {
        return NextResponse.json(
          { ok: false, error: `Host "${host}" is not permitted for server export proxy.` },
          { status: 400 }
        );
      }

      const upstream = await fetch(rawUrl, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
      });

      if (!upstream.ok) {
        return NextResponse.json(
          { ok: false, error: `Upstream returned HTTP ${upstream.status}` },
          { status: upstream.status }
        );
      }

      const arr = await upstream.arrayBuffer();
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

      return new NextResponse(Buffer.from(arr), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(arr.byteLength),
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported URL scheme.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Read-only asset fetch failed.' },
      { status: 500 }
    );
  }
}

