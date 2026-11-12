import { NextRequest } from 'next/server';
import { publicStrideIqJson, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import { resolvePublicOrigin } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const origin = resolvePublicOrigin(request);
  const baseUrl = `${origin.replace(/\/$/, '')}/api/v1`;

  return publicStrideIqJson(request, {
    ok: true,
    platform: 'ChanceTEK One Universal Music & Audiobook API',
    version: '1.0.0',
    baseUrl,
    openApiSpecUrl: `${baseUrl}/openapi.json`,
    partners: ['famio.us', 'strideiq.fit', 'custom-apps'],
    authentication: {
      methods: [
        'Header: x-api-key: sk_live_... / sk_famio_... / sk_strideiq_...',
        'Header: x-famio-api-key: sk_famio_...',
        'Header: Authorization: Bearer <partner_api_key>',
        'Query (streaming URLs only): ?token=<hmac_stream_token>',
        'Dual-platform SSO: Authorization: Bearer <firebase_jwt>',
      ],
      notes:
        'Catalog endpoints return pre-signed HTTPS streamUrl endpoints supporting HTTP 206 byte-range seeking for HTML5 <audio>, iOS AVPlayer, Android ExoPlayer, and web embeds.',
    },
    endpoints: {
      health: `${baseUrl}/health`,
      openapi: `${baseUrl}/openapi.json`,
      sync: `${baseUrl}/sync`,
      syncLive: `${baseUrl}/sync-live`,
      tracks: `${baseUrl}/tracks`,
      trackById: `${baseUrl}/tracks/{id}`,
      audiobooks: `${baseUrl}/audiobooks`,
      audiobookById: `${baseUrl}/audiobooks/{id}`,
      podcasts: `${baseUrl}/podcasts`,
      podcastById: `${baseUrl}/podcasts/{id}`,
      crates: `${baseUrl}/crates`,
      playlists: `${baseUrl}/playlists`,
      radio: `${baseUrl}/radio`,
      workoutMix: `${baseUrl}/workout-mix`,
      stream: `${baseUrl}/stream/{assetId}?token={streamToken}`,
      events: `${baseUrl}/events`,
      adminKeys: `${baseUrl}/keys`,
    },
    supportedMediaModes: ['music', 'audiobook', 'podcast', 'mixed'],
  });
}
