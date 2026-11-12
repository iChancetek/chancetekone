import { NextRequest } from 'next/server';
import { publicStrideIqJson, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import { resolveServerCatalog } from '@/lib/server/strideiqCatalog';
import { getStrideIqTelemetrySummary } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const [playableTracks, telemetry] = await Promise.all([
    resolveServerCatalog({ includeUnplayable: false }),
    getStrideIqTelemetrySummary().catch(() => ({
      totalStreams: 0,
      totalCompleted: 0,
      byActivity: {},
      recentEvents: [],
    })),
  ]);

  return publicStrideIqJson(request, {
    ok: true,
    service: 'chancetekone-strideiq-api',
    status: 'operational',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    catalog: {
      playableTracksCount: playableTracks.length,
    },
    telemetry: {
      totalWorkoutStreams: telemetry.totalStreams,
      totalCompletedPlays: telemetry.totalCompleted,
    },
  });
}

