import { NextRequest, NextResponse } from 'next/server';
import { MusicCatalogHealingAgent } from '@/lib/ai/MusicCatalogHealingAgent';

export const runtime = 'nodejs';

/**
 * GET /api/ai/music-catalog-heal
 * Runs diagnostic audit of music audio playback, cover art, and metadata (artist/album names).
 */
export async function GET() {
  try {
    const diagnosticReport = MusicCatalogHealingAgent.diagnoseCatalog();
    return NextResponse.json({
      status: 'success',
      report: diagnosticReport,
    });
  } catch (error: any) {
    console.error('[MusicCatalogHealAPI:GET] Diagnostic failed:', error);
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Failed to diagnose music catalog' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/music-catalog-heal
 * Executes autonomous repair across audio streams, cover art, and full artist/album metadata.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const dryRun = Boolean(body?.dryRun);
    const actorEmail = body?.actorEmail || 'chancellor@8ofspadesworks.com';

    const healingReport = await MusicCatalogHealingAgent.healCatalog({
      dryRun,
      actorEmail,
    });

    return NextResponse.json({
      status: 'success',
      report: healingReport,
    });
  } catch (error: any) {
    console.error('[MusicCatalogHealAPI:POST] Healing execution failed:', error);
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Failed to heal music catalog' },
      { status: 500 }
    );
  }
}
