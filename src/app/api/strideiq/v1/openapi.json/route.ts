import { NextRequest } from 'next/server';
import { publicStrideIqJson, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import { resolvePublicOrigin } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const origin = resolvePublicOrigin(request).replace(/\/$/, '');

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'ChanceTEK One Music Streaming API for StrideIQ.fit',
      version: '1.0.0',
      description:
        'Partner streaming & cadence-aware workout music API connecting StrideIQ.fit fitness sessions (Running, Walking, Biking, HIIT, Strength, Cool-Down) to verified ChanceTEK One studio masters, crates, and live radio.',
      contact: {
        name: 'ChanceTEK One Engineering',
        url: 'https://chancetekone.us',
      },
    },
    servers: [
      { url: `${origin}/api/strideiq/v1`, description: 'Active ChanceTEK One Partner Server' },
      { url: 'https://chancetekone.us/api/strideiq/v1', description: 'Production Host' },
    ],
    security: [{ StrideIqApiKeyHeader: [] }, { BearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          summary: 'Health check and playable track count',
          security: [],
          responses: { '200': { description: 'Service operational status' } },
        },
      },
      '/sync': {
        get: {
          summary: 'Live synchronous catalog pull across music, audiobooks, and podcasts with zero pagination limit',
          responses: { '200': { description: 'Full synchronized catalog with tracks, audiobooks, podcasts, and crates' } },
        },
        post: {
          summary: 'Live synchronous catalog pull across music, audiobooks, and podcasts with zero pagination limit',
          responses: { '200': { description: 'Full synchronized catalog with tracks, audiobooks, podcasts, and crates' } },
        },
      },
      '/tracks': {
        get: {
          summary: 'Search and filter playable workout tracks',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search title, artist, album, or genre' },
            { name: 'activity', in: 'query', schema: { type: 'string' }, description: 'walking, jogging, running, sprint, hiit, biking, cycling, strength, warmup, cooldown, yoga' },
            { name: 'genre', in: 'query', schema: { type: 'string' } },
            { name: 'crate', in: 'query', schema: { type: 'string' } },
            { name: 'bpmMin', in: 'query', schema: { type: 'integer' } },
            { name: 'bpmMax', in: 'query', schema: { type: 'integer' } },
            { name: 'energy', in: 'query', schema: { type: 'string', enum: ['low', 'moderate', 'high', 'peak'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 40 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Paginated playable tracks with signed streamUrl' } },
        },
      },
      '/tracks/{id}': {
        get: {
          summary: 'Fetch single track metadata and fresh signed streamUrl',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Track payload' },
            '404': { description: 'Track not found or deleted' },
          },
        },
      },
      '/workout-mix': {
        get: {
          summary: 'Generate cadence-matched workout mix (query parameters)',
          parameters: [
            { name: 'activity', in: 'query', schema: { type: 'string', default: 'running' } },
            { name: 'durationMinutes', in: 'query', schema: { type: 'integer', default: 30 } },
            { name: 'cadenceSpm', in: 'query', schema: { type: 'integer' } },
            { name: 'targetBpm', in: 'query', schema: { type: 'integer' } },
            { name: 'structure', in: 'query', schema: { type: 'string', enum: ['steady', 'warmup_main_cooldown', 'interval'] } },
            { name: 'mediaMode', in: 'query', schema: { type: 'string', enum: ['music', 'audiobook', 'podcast', 'mixed'], default: 'music' } },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Topic/keyword filter for audiobooks, podcasts, or music' },
            { name: 'genre', in: 'query', schema: { type: 'string' } },
            { name: 'crate', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 24 } },
          ],
          responses: { '200': { description: 'Ordered workout mix queue' } },
        },
        post: {
          summary: 'Generate cadence-matched music, audiobook, podcast, or mixed workout queue (JSON body)',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    activity: { type: 'string', example: 'running' },
                    mediaMode: { type: 'string', enum: ['music', 'audiobook', 'podcast', 'mixed'], default: 'music' },
                    targetDurationMinutes: { type: 'integer', example: 45 },
                    cadenceSpm: { type: 'integer', example: 172 },
                    targetBpm: { type: 'integer' },
                    bpmMin: { type: 'integer' },
                    bpmMax: { type: 'integer' },
                    q: { type: 'string' },
                    genre: { type: 'string' },
                    crate: { type: 'string' },
                    structure: { type: 'string', enum: ['steady', 'warmup_main_cooldown', 'interval'] },
                    excludeTrackIds: { type: 'array', items: { type: 'string' } },
                    limit: { type: 'integer', example: 24 },
                    allowExplicit: { type: 'boolean', default: true },
                    allowLoop: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Ordered workout mix queue' } },
        },
      },
      '/audiobooks': {
        get: {
          summary: 'List playable audiobooks and chapter series with signed chapter streamUrls',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'genre', in: 'query', schema: { type: 'string' } },
            { name: 'author', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Paginated audiobooks and chapter stream URLs' } },
        },
      },
      '/audiobooks/{id}': {
        get: {
          summary: 'Fetch full chapter list and signed streamUrls for one audiobook',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Audiobook details with playable chapters' },
            '404': { description: 'Audiobook not found or removed' },
          },
        },
      },
      '/podcasts': {
        get: {
          summary: 'List playable podcast episodes with signed streamUrls',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'show', in: 'query', schema: { type: 'string' } },
            { name: 'mediaType', in: 'query', schema: { type: 'string', enum: ['audio', 'video'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { '200': { description: 'Paginated podcast episodes' } },
        },
      },
      '/podcasts/{id}': {
        get: {
          summary: 'Fetch single podcast episode metadata and signed streamUrl',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Podcast episode payload' },
            '404': { description: 'Podcast episode not found or removed' },
          },
        },
      },
      '/crates': {
        get: {
          summary: 'List official ChanceTEK One crates with workout tags and track counts',
          responses: { '200': { description: 'Official crates catalog' } },
        },
      },
      '/playlists': {
        get: {
          summary: 'Get ready-to-stream StrideIQ workout playlists curated from ChanceTEK One',
          parameters: [{ name: 'activity', in: 'query', schema: { type: 'string' } }],
          responses: { '200': { description: 'Activity-curated playlists with signed track streamUrls' } },
        },
      },
      '/radio': {
        get: {
          summary: 'Get ChanceTEK Radio live rotation stations and playable queues',
          responses: { '200': { description: 'Radio stations and tracks' } },
        },
      },
      '/stream/{trackId}': {
        get: {
          summary: 'Stream track audio with HTTP 206 Partial Content byte-range support',
          security: [{ StreamTokenQuery: [] }, { StrideIqApiKeyHeader: [] }, { BearerAuth: [] }],
          parameters: [
            { name: 'trackId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'token', in: 'query', schema: { type: 'string' }, description: 'Signed HMAC stream token from track.streamUrl' },
            { name: 'proxy', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Force server byte-range proxy for external CDN assets' },
          ],
          responses: {
            '200': { description: 'Full audio stream' },
            '206': { description: 'Partial byte-range audio chunk' },
            '302': { description: 'Redirect to verified Firebase Storage audio CDN' },
            '401': { description: 'Invalid or expired stream token / API key' },
            '404': { description: 'Track or underlying asset unavailable' },
          },
        },
      },
      '/events': {
        post: {
          summary: 'Log workout playback telemetry from StrideIQ.fit sessions',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['event', 'trackId', 'activity'],
                  properties: {
                    event: { type: 'string', enum: ['play_start', 'heartbeat', 'track_complete', 'skip'] },
                    trackId: { type: 'string' },
                    mediaType: { type: 'string', enum: ['music', 'audiobook', 'podcast'], default: 'music' },
                    trackTitle: { type: 'string' },
                    artistName: { type: 'string' },
                    activity: { type: 'string', example: 'running' },
                    sessionId: { type: 'string' },
                    strideiqUserId: { type: 'string' },
                    cadenceSpm: { type: 'number' },
                    paceSecondsPerKm: { type: 'number' },
                    heartRateBpm: { type: 'number' },
                    heartRateZone: { type: 'integer' },
                    positionSeconds: { type: 'number' },
                    durationListenedSeconds: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Telemetry recorded' } },
        },
      },
    },
    components: {
      securitySchemes: {
        StrideIqApiKeyHeader: { type: 'apiKey', in: 'header', name: 'x-strideiq-api-key' },
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Partner API Key or Firebase JWT' },
        StreamTokenQuery: { type: 'apiKey', in: 'query', name: 'token' },
      },
    },
  };

  return publicStrideIqJson(request, spec);
}

