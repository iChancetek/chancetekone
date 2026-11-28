import { NextRequest, NextResponse } from 'next/server';
import {
  getServerTrackAnalysis,
  saveServerTrackAnalysis,
} from '@/lib/server/djChanceMixStore';
import { TrackAudioAnalysis } from '@/types/djchancemix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('trackId');
    const multiIds = searchParams.get('trackIds');

    if (singleId) {
      const analysis = await getServerTrackAnalysis(singleId);
      return NextResponse.json(
        { ok: true, analysis },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    if (multiIds) {
      const ids = multiIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 60);
      const entries = await Promise.all(
        ids.map(async (id) => [id, await getServerTrackAnalysis(id)] as const)
      );
      const analyses: Record<string, TrackAudioAnalysis> = {};
      for (const [id, data] of entries) {
        if (data) analyses[id] = data;
      }
      return NextResponse.json(
        { ok: true, analyses },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'trackId or trackIds query parameter is required' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load track analysis' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const analysis = body?.analysis as TrackAudioAnalysis | undefined;
    if (!analysis || !analysis.trackId || typeof analysis.bpm !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'Valid TrackAudioAnalysis payload with trackId and bpm is required' },
        { status: 400 }
      );
    }

    // Never persist private local-file analyses to shared catalog cache
    if (String(analysis.trackId).startsWith('dj-local-')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'local-private-file' });
    }

    const saved = await saveServerTrackAnalysis(analysis);
    return NextResponse.json({ ok: true, analysis: saved });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to store track analysis' },
      { status: 500 }
    );
  }
}

