import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ file: string[] }> }
) {
  try {
    const { file } = await context.params;
    const requestedFileName = file ? file.join('/') : '';
    const albumsDir = path.join(process.cwd(), 'public', 'images', 'albums');
    const physicalPath = path.join(albumsDir, requestedFileName);

    // 1. If physical file exists on disk, stream it
    if (fs.existsSync(physicalPath)) {
      return streamImage(physicalPath);
    }

    // 2. Intelligent fallback mapping
    const lower = requestedFileName.toLowerCase();
    let fallbackCover: string | null = null;

    if (lower.includes('luther') || lower.includes('vandross') || lower.includes('never_too_much')) {
      fallbackCover = path.join(albumsDir, 'luther_vandross_never_too_much.jpg');
    }

    if (fallbackCover && fs.existsSync(fallbackCover)) {
      return streamImage(fallbackCover);
    }

    const genericFallback = path.join(process.cwd(), 'public', 'images', 'genres', 'rnb-neo-soul.jpg');
    if (fs.existsSync(genericFallback)) {
      return streamImage(genericFallback);
    }

    return new NextResponse('Album image not found', { status: 404 });
  } catch (err: any) {
    console.warn('[Album Route Fallback]', err);
    return new NextResponse('Album image error', { status: 500 });
  }
}

function streamImage(filePath: string): NextResponse {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';

  const fileStream = fs.createReadStream(filePath);
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

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Length': fileSize.toString(),
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
