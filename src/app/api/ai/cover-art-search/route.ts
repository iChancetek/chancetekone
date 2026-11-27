import { NextRequest, NextResponse } from 'next/server';
import { TavilyCoverArtService } from '@/lib/ai/tavilyCoverArt';
import { traceWyresExecution } from '@/lib/telemetry/wyres';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'search';

    // Action 1: Search the web via Tavily for cover art
    if (action === 'search') {
      const { artist, album, title, genre } = body;
      if (!artist && !title && !album) {
        return NextResponse.json(
          { success: false, error: 'At least artist, album, or title must be provided.' },
          { status: 400 }
        );
      }

      const candidates = await traceWyresExecution(
        {
          name: 'cover-art-agent:tavily-search',
          runType: 'retriever',
          provider: 'tavily',
          model: 'tavily-cover-search',
          category: 'rag_retriever',
          feature: 'cover-art-search',
          input: { artist: artist || '', album: album || '', title: title || '', genre: genre || '' },
          tags: ['cover-art-agent', 'tavily', 'retriever'],
          extractOutput: (list) => ({
            count: list.length,
            topDomain: list[0]?.domain || null,
            topConfidence: list[0]?.confidenceScore ?? null,
          }),
        },
        () =>
          TavilyCoverArtService.searchCoverArt({
            artist: artist || '',
            album: album || '',
            title: title || '',
            genre: genre || '',
          })
      );

      return NextResponse.json({
        success: true,
        candidates,
        count: candidates.length,
        query: `${artist} - ${album || title}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Action 2: Proxy download and verify image to avoid browser CORS
    if (action === 'fetch_image') {
      const { imageUrl } = body;
      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
        return NextResponse.json(
          { success: false, error: 'A valid http/https imageUrl is required.' },
          { status: 400 }
        );
      }

      const verified = await traceWyresExecution(
        {
          name: 'cover-art-agent:fetch-verify',
          runType: 'tool',
          provider: 'tavily',
          model: 'cover-art-verifier',
          category: 'agentic_agent',
          feature: 'cover-art-fetch',
          input: { imageUrl },
          tags: ['cover-art-agent', 'image-verify'],
          extractOutput: (res) => ({
            mimeType: res.mimeType,
            sizeBytes: res.bytes.length,
          }),
        },
        () => TavilyCoverArtService.fetchAndVerifyImage(imageUrl)
      );
      return NextResponse.json({
        success: true,
        dataUrl: verified.dataUrl,
        mimeType: verified.mimeType,
        sizeBytes: verified.bytes.length,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Cover Art API Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Cover art search failed.' },
      { status: 500 }
    );
  }
}
