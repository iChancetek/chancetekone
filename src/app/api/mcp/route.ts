import { NextRequest, NextResponse } from 'next/server';
import {
  WORKOUT_PROFILES,
  generateStrideIqWorkoutMix,
  queryStrideIqTracks,
  getStrideIqTrackById,
  toStrideIqTrackDto,
  getStrideIqCrates,
  getStrideIqRadioFeed,
  queryStrideIqAudiobooks,
  getStrideIqAudiobookById,
  queryStrideIqPodcasts,
  getStrideIqPodcastById,
  resolveServerCatalog,
  resolveServerAudiobooks,
  resolveServerPodcasts,
} from '@/lib/server/strideiqCatalog';
import { recordStrideIqTelemetry, getStrideIqTelemetrySummary } from '@/lib/server/strideiqStore';
import { resolvePublicOrigin } from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

function corsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-strideiq-api-key, x-api-key',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const publicOrigin = resolvePublicOrigin(request);
  const baseUrl = `${publicOrigin.replace(/\/$/, '')}/api/mcp`;

  return NextResponse.json(
    {
      ok: true,
      protocol: 'model-context-protocol',
      protocolVersion: '2024-11-05',
      server: {
        name: 'chancetekone-mcp',
        version: '1.0.0',
        description: 'ChanceTEK One Streaming Platform & Cadence-Aware Workout Audio MCP Server',
      },
      transports: {
        stdio: {
          supported: true,
          cliCommand: 'node bin/chancetek-mcp.js',
          npxCommand: 'npx tsx src/mcp/cli.ts',
        },
        http: {
          supported: true,
          endpoint: baseUrl,
          method: 'POST',
          format: 'JSON-RPC 2.0',
        },
        sse: {
          supported: true,
          endpoint: `${baseUrl}/sse`,
        },
      },
      capabilities: {
        tools: [
          'get_platform_health',
          'search_music',
          'get_track',
          'list_crates',
          'generate_workout_mix',
          'get_workout_profiles',
          'list_audiobooks',
          'get_audiobook',
          'list_podcasts',
          'get_podcast',
          'list_radio_stations',
          'get_openapi_spec',
          'report_workout_telemetry',
        ],
        resources: [
          'chancetek://catalog/summary',
          'chancetek://workout/profiles',
          'chancetek://crates',
        ],
        prompts: [
          'workout_audio_advisor',
          'crate_curator',
        ],
      },
      clientConfigExamples: {
        claudeDesktop: {
          mcpServers: {
            chancetekone: {
              command: 'node',
              args: ['<path-to-chancetekone>/bin/chancetek-mcp.js'],
              env: {
                CHANCETEK_PUBLIC_ORIGIN: publicOrigin,
              },
            },
          },
        },
        remoteHttpMcp: {
          endpoint: baseUrl,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
    },
    { headers: corsHeaders(request) }
  );
}

export async function POST(request: NextRequest) {
  const publicOrigin = resolvePublicOrigin(request);
  const headers = corsHeaders(request);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: Invalid JSON payload' } },
      { status: 400, headers }
    );
  }

  const { jsonrpc = '2.0', id = 1, method, params = {} } = body;

  try {
    switch (method) {
      case 'initialize': {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'chancetekone-mcp',
                version: '1.0.0',
              },
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
            },
          },
          { headers }
        );
      }

      case 'notifications/initialized':
      case 'ping': {
        return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers });
      }

      case 'tools/list': {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'get_platform_health',
                  description: 'Check ChanceTEK One streaming platform health, API readiness, and live playable catalog counts.',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'search_music',
                  description: 'Search and filter ChanceTEK One tracks by query keyword, artist, title, genre, crate, workout activity, or BPM.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      q: { type: 'string' },
                      genre: { type: 'string' },
                      crate: { type: 'string' },
                      activity: { type: 'string' },
                      bpmMin: { type: 'number' },
                      bpmMax: { type: 'number' },
                      limit: { type: 'number' },
                      offset: { type: 'number' },
                    },
                  },
                },
                {
                  name: 'get_track',
                  description: 'Retrieve full metadata, BPM, artwork, and a pre-signed HTTP 206 streaming URL for a specific track.',
                  inputSchema: {
                    type: 'object',
                    properties: { trackId: { type: 'string' } },
                    required: ['trackId'],
                  },
                },
                {
                  name: 'list_crates',
                  description: 'List the 8 official ChanceTEK sound crates with track counts and average BPMs.',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'generate_workout_mix',
                  description: 'Generate an intelligent, cadence-synchronized workout audio queue for fitness sessions supporting Music, Audiobooks, Podcasts, or Mixed modes with pre-signed streaming URLs.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      activity: { type: 'string', description: 'running, walking, biking, hiit, etc.' },
                      mediaMode: { type: 'string', description: 'music | audiobook | podcast | mixed' },
                      targetDurationMinutes: { type: 'number' },
                      cadenceSpm: { type: 'number' },
                      targetBpm: { type: 'number' },
                      structure: { type: 'string', description: 'steady | warmup_main_cooldown | interval' },
                      genre: { type: 'string' },
                      q: { type: 'string' },
                    },
                  },
                },
                {
                  name: 'get_workout_profiles',
                  description: 'Retrieve definitions, ideal BPM ranges, and cadence SPM guidelines for all 11 workout activities.',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'list_audiobooks',
                  description: 'Search and browse ChanceTEK One spoken literature and audiobooks.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      q: { type: 'string' },
                      genre: { type: 'string' },
                      author: { type: 'string' },
                      limit: { type: 'number' },
                    },
                  },
                },
                {
                  name: 'get_audiobook',
                  description: 'Retrieve audiobook details with full chapter breakdown and pre-signed streaming URLs.',
                  inputSchema: {
                    type: 'object',
                    properties: { id: { type: 'string' } },
                    required: ['id'],
                  },
                },
                {
                  name: 'list_podcasts',
                  description: 'Search and browse ChanceTEK One podcast episodes and talk shows (audio & video).',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      q: { type: 'string' },
                      category: { type: 'string' },
                      show: { type: 'string' },
                      mediaType: { type: 'string' },
                      limit: { type: 'number' },
                    },
                  },
                },
                {
                  name: 'get_podcast',
                  description: 'Retrieve podcast episode metadata and pre-signed streaming URL.',
                  inputSchema: {
                    type: 'object',
                    properties: { id: { type: 'string' } },
                    required: ['id'],
                  },
                },
                {
                  name: 'list_radio_stations',
                  description: 'List 24/7 internet radio frequencies broadcast from ChanceTEK One.',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'get_openapi_spec',
                  description: 'Get the full OpenAPI 3.1 specification for ChanceTEK One Partner API.',
                  inputSchema: { type: 'object', properties: {} },
                },
                {
                  name: 'report_workout_telemetry',
                  description: 'Report workout playback telemetry (play start, heartbeat, complete, skip).',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      event: { type: 'string' },
                      trackId: { type: 'string' },
                      activity: { type: 'string' },
                      mediaType: { type: 'string' },
                      cadenceSpm: { type: 'number' },
                      heartRateBpm: { type: 'number' },
                    },
                    required: ['event', 'trackId'],
                  },
                },
              ],
            },
          },
          { headers }
        );
      }

      case 'tools/call': {
        const toolName = params?.name;
        const args = params?.arguments || {};

        switch (toolName) {
          case 'get_platform_health': {
            const [tracks, books, pods, telemetry] = await Promise.all([
              resolveServerCatalog({ includeUnplayable: false }),
              resolveServerAudiobooks({ includeUnplayable: false }),
              resolveServerPodcasts({ includeUnplayable: false }),
              getStrideIqTelemetrySummary(),
            ]);
            const totalChapters = books.reduce((acc, b) => acc + (b.chapters?.length || 0), 0);

            return NextResponse.json(
              {
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          ok: true,
                          platform: 'ChanceTEK One',
                          version: '1.0.0',
                          publicOrigin,
                          playableTracksCount: tracks.length,
                          playableAudiobooksCount: books.length,
                          playableAudiobookChaptersCount: totalChapters,
                          playablePodcastsCount: pods.length,
                          telemetrySummary: telemetry,
                        },
                        null,
                        2
                      ),
                    },
                  ],
                },
              },
              { headers }
            );
          }

          case 'search_music': {
            const result = await queryStrideIqTracks({
              publicOrigin,
              q: args.q,
              genre: args.genre,
              crate: args.crate,
              activity: args.activity,
              bpmMin: args.bpmMin,
              bpmMax: args.bpmMax,
              limit: args.limit,
              offset: args.offset,
            });
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } },
              { headers }
            );
          }

          case 'get_track': {
            const rawTrack = await getStrideIqTrackById(args.trackId);
            if (!rawTrack) {
              return NextResponse.json(
                { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `Track ${args.trackId} not found.` }] } },
                { headers }
              );
            }
            const track = await toStrideIqTrackDto(rawTrack, publicOrigin);
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(track, null, 2) }] } },
              { headers }
            );
          }

          case 'list_crates': {
            const crates = await getStrideIqCrates(publicOrigin);
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, crates }, null, 2) }] } },
              { headers }
            );
          }

          case 'generate_workout_mix': {
            const mix = await generateStrideIqWorkoutMix({
              publicOrigin,
              activity: args.activity,
              mediaMode: args.mediaMode,
              targetDurationMinutes: args.targetDurationMinutes,
              cadenceSpm: args.cadenceSpm,
              targetBpm: args.targetBpm,
              structure: args.structure,
              genre: args.genre,
              q: args.q,
            });
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, mix }, null, 2) }] } },
              { headers }
            );
          }

          case 'get_workout_profiles': {
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, profiles: WORKOUT_PROFILES }, null, 2) }] } },
              { headers }
            );
          }

          case 'list_audiobooks': {
            const result = await queryStrideIqAudiobooks({
              publicOrigin,
              q: args.q,
              genre: args.genre,
              author: args.author,
              limit: args.limit,
              offset: args.offset,
            });
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } },
              { headers }
            );
          }

          case 'get_audiobook': {
            const audiobook = await getStrideIqAudiobookById(args.id, publicOrigin);
            if (!audiobook) {
              return NextResponse.json(
                { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `Audiobook ${args.id} not found.` }] } },
                { headers }
              );
            }
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, audiobook }, null, 2) }] } },
              { headers }
            );
          }

          case 'list_podcasts': {
            const result = await queryStrideIqPodcasts({
              publicOrigin,
              q: args.q,
              category: args.category,
              show: args.show,
              mediaType: args.mediaType,
              limit: args.limit,
              offset: args.offset,
            });
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } },
              { headers }
            );
          }

          case 'get_podcast': {
            const podcast = await getStrideIqPodcastById(args.id, publicOrigin);
            if (!podcast) {
              return NextResponse.json(
                { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: `Podcast ${args.id} not found.` }] } },
                { headers }
              );
            }
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, podcast }, null, 2) }] } },
              { headers }
            );
          }

          case 'list_radio_stations': {
            const stations = await getStrideIqRadioFeed(publicOrigin);
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, stations }, null, 2) }] } },
              { headers }
            );
          }

          case 'get_openapi_spec': {
            const specRes = await fetch(`${publicOrigin}/api/strideiq/v1/openapi.json`).catch(() => null);
            const spec = specRes && specRes.ok ? await specRes.json() : { title: 'ChanceTEK One API' };
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }] } },
              { headers }
            );
          }

          case 'report_workout_telemetry': {
            const recorded = await recordStrideIqTelemetry({
              event: args.event,
              trackId: args.trackId,
              activity: args.activity || 'running',
              mediaType: args.mediaType || 'music',
              cadenceSpm: args.cadenceSpm,
              heartRateBpm: args.heartRateBpm,
            });
            return NextResponse.json(
              { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, recorded }, null, 2) }] } },
              { headers }
            );
          }

          default:
            return NextResponse.json(
              { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool "${toolName}" not found` } },
              { status: 404, headers }
            );
        }
      }

      case 'resources/list': {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              resources: [
                { uri: 'chancetek://catalog/summary', name: 'Catalog Summary', mimeType: 'application/json' },
                { uri: 'chancetek://workout/profiles', name: 'Workout Profiles', mimeType: 'application/json' },
                { uri: 'chancetek://crates', name: 'Sound Crates', mimeType: 'application/json' },
              ],
            },
          },
          { headers }
        );
      }

      case 'prompts/list': {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              prompts: [
                {
                  name: 'workout_audio_advisor',
                  description: 'Recommend an optimal workout audio session based on athlete cadence and sport.',
                },
                {
                  name: 'crate_curator',
                  description: 'Curate a music crate set based on mood and vibe.',
                },
              ],
            },
          },
          { headers }
        );
      }

      default:
        return NextResponse.json(
          { jsonrpc: '2.0', id, error: { code: -32601, message: `Method "${method}" not recognized` } },
          { status: 404, headers }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32603, message: `Internal server error: ${err?.message || String(err)}` } },
      { status: 500, headers }
    );
  }
}
