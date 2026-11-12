import { NextRequest } from 'next/server';
import { publicStrideIqJson, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import { resolvePublicOrigin } from '@/lib/server/strideiqStore';
import { WORKOUT_PROFILES } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const origin = resolvePublicOrigin(request);
  const baseUrl = `${origin.replace(/\/$/, '')}/api/strideiq/v1`;

  return publicStrideIqJson(request, {
    ok: true,
    partner: 'StrideIQ.fit',
    platform: 'ChanceTEK One',
    version: '1.0.0',
    baseUrl,
    openApiSpecUrl: `${baseUrl}/openapi.json`,
    authentication: {
      methods: [
        'Header: x-strideiq-api-key: sk_strideiq_...',
        'Header: Authorization: Bearer sk_strideiq_...',
        'Query (streaming URLs only): ?token=<hmac_stream_token>',
        'Firebase ID Token (Authorization: Bearer <firebase_jwt>) for signed-in dual-platform members',
      ],
      notes:
        'Catalog & mix endpoints return pre-signed HTTPS streamUrl endpoints supporting HTTP 206 byte-range seeking for HTML5 <audio>, AVPlayer, and ExoPlayer.',
    },
    endpoints: {
      health: `${baseUrl}/health`,
      openapi: `${baseUrl}/openapi.json`,
      tracks: `${baseUrl}/tracks`,
      trackById: `${baseUrl}/tracks/{id}`,
      audiobooks: `${baseUrl}/audiobooks`,
      audiobookById: `${baseUrl}/audiobooks/{id}`,
      podcasts: `${baseUrl}/podcasts`,
      podcastById: `${baseUrl}/podcasts/{id}`,
      workoutMix: `${baseUrl}/workout-mix`,
      crates: `${baseUrl}/crates`,
      playlists: `${baseUrl}/playlists`,
      radio: `${baseUrl}/radio`,
      stream: `${baseUrl}/stream/{assetId}?token={streamToken}`,
      events: `${baseUrl}/events`,
      adminKeys: `${baseUrl}/keys`,
    },
    supportedMediaModes: ['music', 'audiobook', 'podcast', 'mixed'],
    workoutProfiles: Object.values(WORKOUT_PROFILES).map((spec) => ({
      activity: spec.activity,
      label: spec.label,
      description: spec.description,
      bpmRange: spec.bpmRange,
      idealBpm: spec.idealBpm,
      cadenceSpmRange: spec.cadenceSpmRange || null,
      energy: spec.energy,
      preferredGenres: spec.preferredGenres,
    })),
  });
}

