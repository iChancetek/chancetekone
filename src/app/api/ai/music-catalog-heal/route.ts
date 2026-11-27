import { NextRequest, NextResponse } from 'next/server';
import { MusicCatalogHealingAgent } from '@/lib/ai/MusicCatalogHealingAgent';
import { traceWyresExecution } from '@/lib/telemetry/wyres';

export const runtime = 'nodejs';

/**
 * GET /api/ai/music-catalog-heal
 * Runs diagnostic audit of music audio playback, cover art, and metadata (artist/album names).
 */
export async function GET() {
  try {
    const diagnosticReport = await traceWyresExecution(
      {
        name: 'catalog-healing-agent:diagnose',
        runType: 'agent',
        provider: 'chancetek-agent',
        model: MusicCatalogHealingAgent.AGENT_ID,
        category: 'healing_agent',
        feature: 'music-catalog-heal',
        input: { mode: 'diagnose' },
        tags: ['healing-agent', 'diagnostic'],
        extractOutput: (rep) => ({
          totalTracks: rep.totalTracks,
          totalAlbums: rep.totalAlbums,
          unplayableAudioCount: rep.unplayableAudioCount,
          missingCoverCount: rep.missingCoverCount,
          nameIssuesCount: rep.nameIssuesCount,
          invalidGenreCount: rep.invalidGenreCount,
        }),
      },
      async () => MusicCatalogHealingAgent.diagnoseCatalog()
    );
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
    const actorEmail = body?.actorEmail || 'chancellor@chancetekone.com';

    const healingReport = await traceWyresExecution(
      {
        name: 'catalog-healing-agent:heal',
        runType: 'agent',
        provider: 'chancetek-agent',
        model: MusicCatalogHealingAgent.AGENT_ID,
        category: 'healing_agent',
        feature: 'music-catalog-heal',
        userId: actorEmail,
        input: { dryRun, actorEmail },
        tags: ['healing-agent', ...(dryRun ? ['dry-run'] : ['auto-heal'])],
        extractOutput: (rep) => ({
          totalTracksProcessed: rep.totalTracksProcessed,
          audioRepairedCount: rep.audioRepairedCount,
          coversRepairedCount: rep.coversRepairedCount,
          namesRepairedCount: rep.namesRepairedCount,
          genresRepairedCount: rep.genresRepairedCount,
        }),
      },
      () =>
        MusicCatalogHealingAgent.healCatalog({
          dryRun,
          actorEmail,
        })
    );

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
