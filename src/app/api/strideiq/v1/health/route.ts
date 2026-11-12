import { NextRequest } from 'next/server';
import { publicStrideIqJson, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import {
  resolveServerCatalog,
  resolveServerAudiobooks,
  resolveServerPodcasts,
} from '@/lib/server/strideiqCatalog';
import { getStrideIqTelemetrySummary } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const [playableTracks, playableAudiobooks, playablePodcasts, telemetry] = await Promise.all([
    resolveServerCatalog({ includeUnplayable: false }),
    resolveServerAudiobooks({ includeUnplayable: false }),
    resolveServerPodcasts({ includeUnplayable: false }),
    getStrideIqTelemetrySummary().catch(() => ({
      totalStreams: 0,
      totalCompleted: 0,
      byActivity: {},
      byMediaType: {},
      recentEvents: [],
    })),
  ]);

  const playableAudiobookChaptersCount = playableAudiobooks.reduce(
    (sum, book) => sum + book.chapters.filter((c) => c.playable).length,
    0,
  );

  return publicStrideIqJson(request, {
    ok: true,
    service: 'chancetekone-strideiq-api',
    status: 'operational',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    catalog: {
      playableTracksCount: playableTracks.length,
      playableAudiobooksCount: playableAudiobooks.length,
      playableAudiobookChaptersCount,
      playablePodcastsCount: playablePodcasts.length,
    },
    telemetry: {
      totalWorkoutStreams: telemetry.totalStreams,
      totalCompletedPlays: telemetry.totalCompleted,
      byMediaType: telemetry.byMediaType || {},
    },
  });
}

