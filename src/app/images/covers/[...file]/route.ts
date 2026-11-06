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
    const coversDir = path.join(process.cwd(), 'public', 'images', 'covers');
    const physicalPath = path.join(coversDir, requestedFileName);

    // 1. If physical file exists on disk, stream it
    if (fs.existsSync(physicalPath)) {
      return streamImage(physicalPath);
    }

    // 2. Parse filename to intelligently map to authentic album cover
    const lower = requestedFileName.toLowerCase();

    let fallbackCover = '/images/genres/rnb-neo-soul.jpg';

    if (lower.includes('avant') || lower.includes('destiny') || lower.includes('flickin') || lower.includes('separated') || lower.includes('sailing') || lower.includes('read_your_mind')) {
      fallbackCover = '/images/albums/avant_my_thoughts.jpg';
    } else if (lower.includes('112') || lower.includes('peaches') || lower.includes('cupid') || lower.includes('over_now') || lower.includes('part_2') || lower.includes('.t_2_the_remix')) {
      fallbackCover = '/images/albums/112_part_iii.jpg';
    } else if (lower.includes('ashanti') || lower.includes('foolish') || lower.includes('rock_wit_u') || lower.includes('only_you') || lower.includes('nly_you_remix')) {
      fallbackCover = '/images/albums/ashanti_ashanti.jpg';
    } else if (lower.includes('chris_brown') || lower.includes('chris') || lower.includes('poppin') || lower.includes('run_it') || lower.includes('excuse_me') || lower.includes('wn_-_poppin')) {
      fallbackCover = '/images/albums/chris_brown_self_titled.jpg';
    } else if (lower.includes('brownstone') || lower.includes('grapevyne') || lower.includes('if_you_love_me')) {
      fallbackCover = '/images/albums/brownstone_from_the_bottom_up.jpg';
    } else if (lower.includes('jermaine') || lower.includes('dupri') || lower.includes('atlanta') || lower.includes('ermaine_dupri')) {
      fallbackCover = '/images/albums/jermaine_dupri_instructions.jpg';
    } else if (lower.includes('janet') || lower.includes('jackson')) {
      fallbackCover = '/images/albums/janet_jackson_velvet_rope.png';
    } else if (lower.includes('carl_thomas') || lower.includes('emotional') || lower.includes('summer_rain') || lower.includes('i_wish')) {
      fallbackCover = '/images/albums/carl_thomas_emotional.jpg';
    } else if (lower.includes('luther') || lower.includes('vandross') || lower.includes('never_too_much')) {
      fallbackCover = '/images/albums/luther_vandross_never_too_much.jpg';
    }

    const fallbackPhysical = path.join(process.cwd(), 'public', fallbackCover);
    if (fs.existsSync(fallbackPhysical)) {
      return streamImage(fallbackPhysical);
    }

    // Secondary fallback
    const genericFallback = path.join(process.cwd(), 'public', 'images', 'genres', 'rnb-neo-soul.jpg');
    if (fs.existsSync(genericFallback)) {
      return streamImage(genericFallback);
    }

    return new NextResponse('Cover image not found', { status: 404 });
  } catch (err: any) {
    console.warn('[Cover Route Fallback]', err);
    return new NextResponse('Cover image error', { status: 500 });
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
