/**
 * ChanceTEK One — Model Context Protocol (MCP) Server
 *
 * Exposes the ChanceTEK One streaming platform, catalog intelligence, and
 * cadence-aware workout audio engine to MCP-compatible AI clients (Claude Desktop,
 * Antigravity, Cursor, Windsurf, Claude Code, and remote HTTP/SSE agents).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
  type Resource,
  type Prompt,
} from '@modelcontextprotocol/sdk/types.js';

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

export interface ChanceTekMcpServerOptions {
  publicOrigin?: string;
  serverName?: string;
  serverVersion?: string;
}

export function createChanceTekMcpServer(options?: ChanceTekMcpServerOptions): Server {
  const publicOrigin = (options?.publicOrigin || process.env.CHANCETEK_PUBLIC_ORIGIN || 'https://chancetekone.us').replace(/\/+$/, '');
  const serverName = options?.serverName || 'chancetekone-mcp';
  const serverVersion = options?.serverVersion || '1.0.0';

  const server = new Server(
    { name: serverName, version: serverVersion },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // ──────────────────────────── TOOLS ────────────────────────────
  const TOOLS: Tool[] = [
    {
      name: 'get_platform_health',
      description: 'Check ChanceTEK One streaming platform health, API readiness, and live playable catalog counts (music tracks, audiobooks, and podcasts).',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'search_music',
      description: 'Search and filter ChanceTEK One verified studio master tracks by query keyword, artist, title, genre, crate, workout activity, or BPM range.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search term for track title, artist name, or album.' },
          genre: { type: 'string', description: 'Music genre (e.g. "R&B / Neo-Soul", "Hip Hop", "House-Club", "Disco / Funk", "Slow Jams / Soul").' },
          crate: { type: 'string', description: 'Official crate slug (e.g. "rnb-neo-soul", "hip-hop", "house-club", "disco-funk", "slow-jams", "afro-house", "break-beats", "jazz-blues").' },
          activity: { type: 'string', description: 'Workout activity recommendation (e.g. "running", "walking", "biking", "hiit", "strength", "cooldown").' },
          bpmMin: { type: 'number', description: 'Minimum beats-per-minute (BPM).' },
          bpmMax: { type: 'number', description: 'Maximum beats-per-minute (BPM).' },
          limit: { type: 'number', description: 'Maximum number of tracks to return (default 20, max 100).' },
          offset: { type: 'number', description: 'Pagination offset (default 0).' },
        },
      },
    },
    {
      name: 'get_track',
      description: 'Retrieve full metadata, BPM, workout compatibility, cover art, and a pre-signed HTTP 206 streaming URL for a specific ChanceTEK One track.',
      inputSchema: {
        type: 'object',
        properties: {
          trackId: { type: 'string', description: 'Unique track ID.' },
        },
        required: ['trackId'],
      },
    },
    {
      name: 'list_crates',
      description: 'List the 8 official ChanceTEK One sound crates (R&B/Neo-Soul, Hip-Hop, House-Club, Disco/Funk, Slow Jams, Afro-House, Break Beats, Jazz/Blues) with track counts and average BPMs.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'generate_workout_mix',
      description: 'Generate an intelligent, cadence-synchronized workout audio queue for fitness sessions (Running, Walking, Biking, HIIT, Strength, Recovery, Yoga) supporting Music, Audiobooks, Podcasts, or Mixed modes with pre-signed streaming URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            description: 'Workout activity: "walking" | "jogging" | "running" | "sprint" | "hiit" | "biking" | "cycling" | "strength" | "warmup" | "cooldown" | "recovery" | "yoga". Default is "running".',
          },
          mediaMode: {
            type: 'string',
            description: 'Media format: "music" | "audiobook" | "podcast" | "mixed". Default is "music".',
          },
          targetDurationMinutes: {
            type: 'number',
            description: 'Target session length in minutes (5 to 180, default 30).',
          },
          cadenceSpm: {
            type: 'number',
            description: 'Athlete footstep or pedal cadence in steps/pedal strokes per minute (e.g. 165 to 180 for running, 100 to 120 for walking). The engine harmonic-matches tracks (direct, half-time, or double-time).',
          },
          targetBpm: {
            type: 'number',
            description: 'Optional manual target BPM.',
          },
          structure: {
            type: 'string',
            description: 'Workout structure: "steady" | "warmup_main_cooldown" | "interval". Default is "warmup_main_cooldown" for music and "steady" for spoken content.',
          },
          genre: {
            type: 'string',
            description: 'Optional preferred genre filter.',
          },
          q: {
            type: 'string',
            description: 'Optional keyword filter for tracks, books, or shows.',
          },
        },
      },
    },
    {
      name: 'get_workout_profiles',
      description: 'Retrieve definitions, ideal BPM ranges, cadence SPM guidelines, and preferred genres for all 11 ChanceTEK One workout activities.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'list_audiobooks',
      description: 'Search and browse ChanceTEK One spoken literature and audiobooks, with author, narrator, genre, and duration details.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query for book title, author, or description.' },
          genre: { type: 'string', description: 'Genre filter (e.g. "Health & Longevity", "Technology & Society").' },
          author: { type: 'string', description: 'Author name filter.' },
          limit: { type: 'number', description: 'Max items to return (default 20).' },
          offset: { type: 'number', description: 'Pagination offset (default 0).' },
        },
      },
    },
    {
      name: 'get_audiobook',
      description: 'Retrieve full details for an audiobook including complete chapter breakdown with individual chapter durations and pre-signed HTTP 206 streaming URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Audiobook ID (e.g. "audiobook-healthy-living").' },
        },
        required: ['id'],
      },
    },
    {
      name: 'list_podcasts',
      description: 'Search and browse ChanceTEK One podcast episodes and talk shows (supports audio and 4K video podcasts).',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query for episode title, show, or description.' },
          category: { type: 'string', description: 'Podcast category.' },
          show: { type: 'string', description: 'Podcast show title.' },
          mediaType: { type: 'string', description: 'Filter by "audio" or "video".' },
          limit: { type: 'number', description: 'Max items to return (default 20).' },
          offset: { type: 'number', description: 'Pagination offset (default 0).' },
        },
      },
    },
    {
      name: 'get_podcast',
      description: 'Retrieve full details for a podcast episode with pre-signed HTTP 206 streaming URL.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Podcast episode ID.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'list_radio_stations',
      description: 'List 24/7 internet radio frequencies and stations broadcast from ChanceTEK One.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_openapi_spec',
      description: 'Get the full OpenAPI 3.1 schema specification for ChanceTEK One Partner Streaming API v1.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'report_workout_telemetry',
      description: 'Report workout playback telemetry (play start, heartbeat, complete, skip) to ChanceTEK One for analytics and session tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          event: { type: 'string', description: '"play_start" | "heartbeat" | "track_complete" | "skip"' },
          trackId: { type: 'string', description: 'ID of the track, chapter, or podcast episode.' },
          activity: { type: 'string', description: 'Workout activity (e.g. "running").' },
          mediaType: { type: 'string', description: '"music" | "audiobook" | "podcast"' },
          cadenceSpm: { type: 'number', description: 'Current athlete cadence.' },
          heartRateBpm: { type: 'number', description: 'Current athlete heart rate.' },
        },
        required: ['event', 'trackId'],
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'get_platform_health': {
          const [tracks, audiobooks, podcasts, telemetry] = await Promise.all([
            resolveServerCatalog({ includeUnplayable: false }),
            resolveServerAudiobooks({ includeUnplayable: false }),
            resolveServerPodcasts({ includeUnplayable: false }),
            getStrideIqTelemetrySummary(),
          ]);

          const totalChapters = audiobooks.reduce((acc, b) => acc + (b.chapters?.length || 0), 0);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    ok: true,
                    platform: 'ChanceTEK One',
                    status: 'operational',
                    version: '1.0.0',
                    publicOrigin,
                    catalog: {
                      playableTracksCount: tracks.length,
                      playableAudiobooksCount: audiobooks.length,
                      playableAudiobookChaptersCount: totalChapters,
                      playablePodcastsCount: podcasts.length,
                    },
                    telemetry: {
                      totalStreams: telemetry.totalStreams,
                      totalCompleted: telemetry.totalCompleted,
                      byActivity: telemetry.byActivity,
                      byMediaType: telemetry.byMediaType,
                    },
                    apiEndpoints: {
                      partnerApiBase: `${publicOrigin}/api/strideiq/v1`,
                      openapi: `${publicOrigin}/api/strideiq/v1/openapi.json`,
                      health: `${publicOrigin}/api/strideiq/v1/health`,
                      workoutMix: `${publicOrigin}/api/strideiq/v1/workout-mix`,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'search_music': {
          const result = await queryStrideIqTracks({
            publicOrigin,
            q: typeof args.q === 'string' ? args.q : undefined,
            genre: typeof args.genre === 'string' ? args.genre : undefined,
            crate: typeof args.crate === 'string' ? args.crate : undefined,
            activity: typeof args.activity === 'string' ? args.activity : undefined,
            bpmMin: typeof args.bpmMin === 'number' ? args.bpmMin : undefined,
            bpmMax: typeof args.bpmMax === 'number' ? args.bpmMax : undefined,
            limit: typeof args.limit === 'number' ? args.limit : 20,
            offset: typeof args.offset === 'number' ? args.offset : 0,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'get_track': {
          const trackId = String(args.trackId || '').trim();
          if (!trackId) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: trackId is required.' }],
            };
          }

          const rawTrack = await getStrideIqTrackById(trackId);
          if (!rawTrack) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Track with ID "${trackId}" was not found or is unplayable.` }],
            };
          }

          const track = await toStrideIqTrackDto(rawTrack, publicOrigin);
          return {
            content: [{ type: 'text', text: JSON.stringify(track, null, 2) }],
          };
        }

        case 'list_crates': {
          const crates = await getStrideIqCrates(publicOrigin);
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, crates }, null, 2) }],
          };
        }

        case 'generate_workout_mix': {
          const mix = await generateStrideIqWorkoutMix({
            publicOrigin,
            activity: typeof args.activity === 'string' ? args.activity : 'running',
            mediaMode: typeof args.mediaMode === 'string' ? args.mediaMode : 'music',
            targetDurationMinutes: typeof args.targetDurationMinutes === 'number' ? args.targetDurationMinutes : 30,
            cadenceSpm: typeof args.cadenceSpm === 'number' ? args.cadenceSpm : undefined,
            targetBpm: typeof args.targetBpm === 'number' ? args.targetBpm : undefined,
            structure: args.structure === 'steady' || args.structure === 'interval' ? args.structure : 'warmup_main_cooldown',
            genre: typeof args.genre === 'string' ? args.genre : undefined,
            q: typeof args.q === 'string' ? args.q : undefined,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, mix }, null, 2) }],
          };
        }

        case 'get_workout_profiles': {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    ok: true,
                    profiles: Object.values(WORKOUT_PROFILES).map((p) => ({
                      activity: p.activity,
                      label: p.label,
                      description: p.description,
                      bpmRange: p.bpmRange,
                      idealBpm: p.idealBpm,
                      cadenceSpmRange: p.cadenceSpmRange || null,
                      energy: p.energy,
                      preferredGenres: p.preferredGenres,
                      preferredCrates: p.preferredCrates,
                      supportsHalfTime: p.supportsHalfTime,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'list_audiobooks': {
          const result = await queryStrideIqAudiobooks({
            publicOrigin,
            q: typeof args.q === 'string' ? args.q : undefined,
            genre: typeof args.genre === 'string' ? args.genre : undefined,
            author: typeof args.author === 'string' ? args.author : undefined,
            limit: typeof args.limit === 'number' ? args.limit : 20,
            offset: typeof args.offset === 'number' ? args.offset : 0,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'get_audiobook': {
          const id = String(args.id || '').trim();
          if (!id) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: id is required.' }],
            };
          }

          const audiobook = await getStrideIqAudiobookById(id, publicOrigin);
          if (!audiobook) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Audiobook with ID "${id}" was not found or is unavailable.` }],
            };
          }

          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, audiobook }, null, 2) }],
          };
        }

        case 'list_podcasts': {
          const rawMedia = typeof args.mediaType === 'string' ? args.mediaType.toLowerCase() : undefined;
          const mediaType = rawMedia === 'audio' || rawMedia === 'video' ? rawMedia : undefined;

          const result = await queryStrideIqPodcasts({
            publicOrigin,
            q: typeof args.q === 'string' ? args.q : undefined,
            category: typeof args.category === 'string' ? args.category : undefined,
            show: typeof args.show === 'string' ? args.show : undefined,
            mediaType,
            limit: typeof args.limit === 'number' ? args.limit : 20,
            offset: typeof args.offset === 'number' ? args.offset : 0,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'get_podcast': {
          const id = String(args.id || '').trim();
          if (!id) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'Error: id is required.' }],
            };
          }

          const podcast = await getStrideIqPodcastById(id, publicOrigin);
          if (!podcast) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Podcast episode with ID "${id}" was not found or is unavailable.` }],
            };
          }

          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, podcast }, null, 2) }],
          };
        }

        case 'list_radio_stations': {
          const stations = await getStrideIqRadioFeed(publicOrigin);
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, stations }, null, 2) }],
          };
        }

        case 'get_openapi_spec': {
          const res = await fetch(`${publicOrigin}/api/strideiq/v1/openapi.json`).catch(() => null);
          if (res && res.ok) {
            const spec = await res.json();
            return {
              content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    openapi: '3.1.0',
                    info: {
                      title: 'ChanceTEK One Streaming & StrideIQ Partner API',
                      version: '1.0.0',
                    },
                    servers: [{ url: `${publicOrigin}/api/strideiq/v1` }],
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'report_workout_telemetry': {
          const event = String(args.event || '').trim() as any;
          const trackId = String(args.trackId || '').trim();
          const activity = String(args.activity || 'running').trim();
          const mediaType = (args.mediaType === 'audiobook' || args.mediaType === 'podcast' ? args.mediaType : 'music') as any;

          const recorded = await recordStrideIqTelemetry({
            event,
            trackId,
            activity,
            mediaType,
            cadenceSpm: typeof args.cadenceSpm === 'number' ? args.cadenceSpm : undefined,
            heartRateBpm: typeof args.heartRateBpm === 'number' ? args.heartRateBpm : undefined,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, recorded }, null, 2) }],
          };
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool name: ${name}` }],
          };
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Execution error in "${name}": ${err?.message || String(err)}` }],
      };
    }
  });

  // ──────────────────────────── RESOURCES ────────────────────────────
  const RESOURCES: Resource[] = [
    {
      uri: 'chancetek://catalog/summary',
      name: 'ChanceTEK One Catalog Summary',
      description: 'Quick overview of catalog tracks, audiobooks, and podcasts count and health status.',
      mimeType: 'application/json',
    },
    {
      uri: 'chancetek://workout/profiles',
      name: 'ChanceTEK One Workout Activity Profiles',
      description: 'JSON list of all 11 supported activities with ideal BPMs and cadence ranges.',
      mimeType: 'application/json',
    },
    {
      uri: 'chancetek://crates',
      name: 'ChanceTEK One Official Sound Crates',
      description: 'The 8 official sound crates with genre maps and descriptions.',
      mimeType: 'application/json',
    },
  ];

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: RESOURCES };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'chancetek://catalog/summary') {
      const [tracks, books, pods] = await Promise.all([
        resolveServerCatalog({ includeUnplayable: false }),
        resolveServerAudiobooks({ includeUnplayable: false }),
        resolveServerPodcasts({ includeUnplayable: false }),
      ]);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                platform: 'ChanceTEK One',
                playableTracks: tracks.length,
                playableAudiobooks: books.length,
                playablePodcasts: pods.length,
                status: 'operational',
                publicOrigin,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (uri === 'chancetek://workout/profiles') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(WORKOUT_PROFILES, null, 2),
          },
        ],
      };
    }

    if (uri === 'chancetek://crates') {
      const crates = await getStrideIqCrates(publicOrigin);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(crates, null, 2),
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  // ──────────────────────────── PROMPTS ────────────────────────────
  const PROMPTS: Prompt[] = [
    {
      name: 'workout_audio_advisor',
      description: 'Recommend an optimal ChanceTEK One workout audio session based on the athlete\'s sport, target cadence/BPM, duration, and content preference (music vs audiobook vs podcast).',
      arguments: [
        { name: 'activity', description: 'running, walking, cycling, hiit, etc.', required: true },
        { name: 'durationMinutes', description: 'Duration in minutes (e.g. 45)', required: false },
        { name: 'cadenceSpm', description: 'Cadence in steps or pedal strokes per minute', required: false },
        { name: 'mediaMode', description: '"music" | "audiobook" | "podcast" | "mixed"', required: false },
      ],
    },
    {
      name: 'crate_curator',
      description: 'Formulate music recommendations and crate explorations based on listener vibe, genre preference, and mood.',
      arguments: [
        { name: 'mood', description: 'e.g. energetic, late night, focus, chill', required: true },
        { name: 'genreHint', description: 'e.g. Neo-Soul, House, Funk', required: false },
      ],
    },
  ];

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: PROMPTS };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    if (name === 'workout_audio_advisor') {
      const act = args.activity || 'running';
      const dur = args.durationMinutes || '30';
      const cad = args.cadenceSpm ? ` at ${args.cadenceSpm} SPM` : '';
      const mode = args.mediaMode || 'music';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Act as a ChanceTEK One Workout Audio Coach. Recommend a customized ${dur}-minute ${act} session${cad} using ChanceTEK One in ${mode} mode. Query the "generate_workout_mix" tool, present the phased tracks/chapters with their BPMs, and explain how the tempo matches the athlete's workout intensity.`,
            },
          },
        ],
      };
    }

    if (name === 'crate_curator') {
      const mood = args.mood || 'smooth and soulful';
      const genre = args.genreHint ? ` with an emphasis on ${args.genreHint}` : '';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Act as a master DJ and crate digger on ChanceTEK One. Find tracks fitting a "${mood}" mood${genre}. Use the "search_music" and "list_crates" tools to explore the catalog and curate a 5-track listening set with authentic studio master streams.`,
            },
          },
        ],
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  });

  return server;
}

