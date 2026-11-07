// Pure OpenAI Tool Definitions — No heavy imports.
// Safe for use in Next.js API routes (server-side).
// Execution logic lives in tools.ts which is only called dynamically.

export const AGENT_TOOLS_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'searchMusic',
      description: 'Search for music tracks across genre, query keywords, mood, tempo, or BPM.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term or keyword' },
          genre: { type: 'string', description: 'Genre filter (e.g. "Breakbeat", "Boom Bap", "Funk Breaks", "Drum & Bass")' },
          minBpm: { type: 'number', description: 'Minimum BPM' },
          maxBpm: { type: 'number', description: 'Maximum BPM' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchArtists',
      description: 'Find artists, DJs, and producers on Return of the Break Beats.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Artist name or bio keyword' },
          genre: { type: 'string', description: 'Genre associated with the artist' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchVideos',
      description: 'Search music videos, documentaries, and live performances.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Video title or keyword' },
          category: { type: 'string', description: 'Category (Music Video, Documentary, Live Performance)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchAudiobooks',
      description: 'Discover audiobooks and cultural narratives on the platform.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Title, author, or keyword' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchMerchandise',
      description: 'Search official merchandise, limited vinyl releases, apparel, and accessories.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product title or keyword' },
          category: { type: 'string', description: 'Category (apparel, vinyl, accessories, posters)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getTrackDetails',
      description: 'Get full metadata, lyrics, and details for a specific track ID.',
      parameters: {
        type: 'object',
        properties: {
          trackId: { type: 'string', description: 'The unique track ID' },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getPlatformHelp',
      description: 'Get help with platform features, playlist creation, navigation, or account setup.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic (e.g. "playlists", "audiobooks", "merch", "shortcuts")' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rememberUserFact',
      description: 'Store a permanent fact, preference, equipment note, or personal detail into the user Long-Term Memory.',
      parameters: {
        type: 'object',
        properties: {
          fact: { type: 'string', description: 'The explicit fact or preference to remember' },
          category: {
            type: 'string',
            enum: ['preference', 'equipment', 'bio', 'general'],
            description: 'Category of the memory',
          },
        },
        required: ['fact'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'updateTasteProfile',
      description: 'Update the user musical DNA (favorite genres, BPM sweet spot, era affinities, gear interests, vibe tags).',
      parameters: {
        type: 'object',
        properties: {
          genres: { type: 'array', items: { type: 'string' }, description: 'Updated favorite genres' },
          minBpm: { type: 'number', description: 'Minimum preferred BPM' },
          maxBpm: { type: 'number', description: 'Maximum preferred BPM' },
          preferredBpm: { type: 'number', description: 'Ideal preferred BPM' },
          gearInterests: { type: 'array', items: { type: 'string' }, description: 'Gear & hardware interests' },
          vibeTags: { type: 'array', items: { type: 'string' }, description: 'Vibe tags' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recallMemories',
      description: 'Search or retrieve stored Long-Term Memory facts and taste profile attributes.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Search term or topic to recall' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createPlaylist',
      description: 'Create a new curated playlist / crate for the user.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the playlist' },
          description: { type: 'string', description: 'Curatorial description or liner notes' },
          type: { type: 'string', enum: ['music', 'video', 'audiobook', 'mixed'], description: 'Playlist type format' },
          trackIds: { type: 'array', items: { type: 'string' }, description: 'Optional array of track IDs' },
          visibility: { type: 'string', enum: ['public', 'private', 'unlisted'], description: 'Privacy level' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'addMediaToPlaylist',
      description: 'Add a track, video, or audiobook to an existing playlist.',
      parameters: {
        type: 'object',
        properties: {
          playlistId: { type: 'string', description: 'The playlist ID' },
          mediaId: { type: 'string', description: 'The ID of the track, video, or audiobook' },
          mediaType: { type: 'string', enum: ['music', 'video', 'audiobook'], description: 'Media type' },
        },
        required: ['playlistId', 'mediaId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getUserPlaylists',
      description: 'Retrieve the list of playlists created by the user or available on the platform.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['all', 'music', 'video', 'audiobook', 'mixed'], description: 'Filter by type' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getPlaylistDetails',
      description: 'Retrieve details, tracklist, and duration of a specific playlist.',
      parameters: {
        type: 'object',
        properties: {
          playlistId: { type: 'string', description: 'The ID of the playlist' },
        },
        required: ['playlistId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'inspectSampleLineage',
      description: 'Perform deep Sample Detective break genealogy analysis, identifying original 1960s/70s funk drum break origins, vintage sampler lore (SP-1200 / MPC60), famous flips, and cultural roots.',
      parameters: {
        type: 'object',
        properties: {
          trackTitle: { type: 'string', description: 'Title of the track to inspect' },
          artistName: { type: 'string', description: 'Artist name' },
        },
        required: ['trackTitle'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchProjects',
      description: 'Search production projects and master releases (e.g. The Return of the Break Beats, ChanceTEK, The Bronx Heritage Archive, Quantum Break Sequence, Velvet Horns & Tape Saturation).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query or project title keyword' },
          producer: { type: 'string', description: 'Filter by producer name' },
          status: { type: 'string', description: 'Filter by release status' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getProjectDetails',
      description: 'Get deep technical details, studio equipment used, sample lineage sources, vinyl pressing specifications, and tracklists for a specific project ID.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'The project ID (e.g. "project-1", "project-chancetek", "project-2", "project-3", "project-4")' },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchProducers',
      description: 'Find sonic architects, master beatmakers, and hardware sampler engineers (e.g. ChanceTEKone, Chancellor @ ChanceTEK LLC, Cipher Voltage, Luna Brass & The Crate Queens).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Producer name, hardware rig keyword (SP-1200, MPC60, Neve), or signature BPM' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getPlatformPolicies',
      description: 'Retrieve verified information and policies regarding About Page & Mission, The Fam... Famio social media platform (famio.us), Terms of Service, Privacy Policy, or Support Center & Crate Concierge.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['about', 'terms', 'privacy', 'support', 'famio', 'membership', 'pwa'],
            description: 'The specific topic or policy to retrieve',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'searchCoverArtTavily',
      description: 'Search the internet using Tavily to find authentic, high-resolution album and track cover art for an artist, album, and song.',
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string', description: 'Name of the recording artist or band' },
          album: { type: 'string', description: 'Album title' },
          title: { type: 'string', description: 'Track title' },
        },
        required: ['artist'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'attachCoverArtToMP3',
      description: 'Attach and embed verified cover art directly into an MP3 file and update catalog and folder records.',
      parameters: {
        type: 'object',
        properties: {
          coverUrl: { type: 'string', description: 'The image URL or base64 data URL to attach' },
          artist: { type: 'string', description: 'Artist name' },
          album: { type: 'string', description: 'Album title' },
          title: { type: 'string', description: 'Track title' },
        },
        required: ['coverUrl', 'artist'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'scanPlatformMissingArtwork',
      description: 'Scan all currently uploaded MP3 tracks and albums on the platform that lack authentic cover art.',
      parameters: {
        type: 'object',
        properties: {
          crateId: { type: 'string', description: 'Optional crate ID filter' },
          limit: { type: 'number', description: 'Maximum items to scan' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'autoRepairPlatformCoverArt',
      description: 'Autonomous AI agent to search Tavily for authentic cover art and apply it to missing tracks, albums, and MP3 binaries.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum items to repair' },
          crateId: { type: 'string', description: 'Target crate ID' },
          dryRun: { type: 'boolean', description: 'Dry run preview without committing updates' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'verifyArtistAudioAssociation',
      description: 'Audit and verify that MP3 audio streams are authentically associated with the correct artist, preventing cross-artist substitution (e.g. ensuring Janet Jackson tracks never play Lauryn Hill).',
      parameters: {
        type: 'object',
        properties: {
          trackId: { type: 'string', description: 'Optional track ID to verify' },
          artistName: { type: 'string', description: 'Optional artist name to verify' },
        },
      },
    },
  },
];

