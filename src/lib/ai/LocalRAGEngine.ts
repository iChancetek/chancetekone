import {
  MusicCatalogService,
  MICHAEL_JACKSON_TRACKS,
  VAULT_CLASSIC_TRACKS,
} from '@/lib/music/MusicCatalogService';
import {
  MOCK_ARTISTS,
  MOCK_ALBUMS,
  MOCK_VIDEOS,
  MOCK_AUDIOBOOKS,
  MOCK_PRODUCTS,
  MOCK_PROJECTS,
  MOCK_PRODUCERS,
} from '@/lib/mockData';
import { Track, Artist, Video, Audiobook, Project, Producer, Album } from '@/types/media';
import { Product } from '@/types/commerce';
import { Playlist } from '@/types/playlist';
import { AgentContextPayload, AvailablePlaylistSummary } from '@/types/agent';
import { MemoryFact, TasteProfile } from '@/types/memory';
import { PlaylistService } from '@/lib/playlist/PlaylistService';

export interface LocalRAGResult {
  content: string;
  playIntent?: boolean;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, any>;
    status: 'completed';
    result: any;
  }>;
  recommendations: {
    tracks?: Track[];
    playlists?: Playlist[];
    artists?: Artist[];
    albums?: Album[];
    videos?: Video[];
    audiobooks?: Audiobook[];
    products?: Product[];
    projects?: Project[];
    producers?: Producer[];
  };
  memoryUpdates?: {
    newFacts?: MemoryFact[];
    updatedTaste?: Partial<TasteProfile>;
  };
}

// Canonical featured audiobooks / spoken works
const CANONICAL_AUDIOBOOKS: Audiobook[] = [
  {
    id: 'audiobook-1793148157988-bnzl3',
    title: 'Mi Vida Loca',
    author: 'Orlando Figueroa',
    narrator: 'Orlando Figueroa',
    description: 'Mi Vida Loca. Written by Orlando Figueroa. Master spoken work and cinema presentation.',
    coverUrl: '/images/genres/literature.jpg',
    genre: 'Memoir / Spoken Cinema',
    duration: 1800,
    likeCount: 0,
    rating: 0,
    releaseYear: 2026,
    chapters: [
      {
        id: 'ch-mvl-1',
        title: 'Mi Vida Loca: Spoken Chapter',
        duration: 1800,
        audioUrl: '/videos/OrlandoFigueroa.mp4',
        chapterIndex: 1,
      },
    ],
  },
  {
    id: 'audiobook-kwame-thompson',
    title: 'Saturday Night, Sunday Morning',
    author: 'Kwame Thompson',
    narrator: 'Kwame Thompson',
    description: 'Featured Upcoming Works. Saturday Night, Sunday Morning... By Author, Kwame Thompson.',
    coverUrl: '/images/genres/literature.jpg',
    genre: 'Urban Fiction / Drama',
    duration: 1500,
    likeCount: 0,
    rating: 0,
    releaseYear: 2026,
    chapters: [
      {
        id: 'ch-snsm-1',
        title: 'Saturday Night, Sunday Morning: Visual Chapter',
        duration: 1500,
        audioUrl: '/videos/Kwame Book Promo 1.mp4',
        chapterIndex: 1,
      },
    ],
  },
];

// Canonical featured videos
const CANONICAL_VIDEOS: Video[] = [
  {
    id: 'vid-mi-vida-loca',
    title: 'Mi Vida Loca',
    artistId: 'artist-orlando-figueroa',
    artistName: 'Orlando Figueroa',
    description: 'Mi Vida Loca. Written and presented by Orlando Figueroa. Master spoken cinema and cultural story.',
    videoUrl: '/videos/OrlandoFigueroa.mp4',
    thumbnailUrl: '/images/genres/literature.jpg',
    duration: 345,
    views: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    category: 'Documentary / Cinema',
    releaseDate: '2026-01-01',
  },
  {
    id: 'vid-saturday-night-sunday-morning',
    title: 'Saturday Night, Sunday Morning',
    artistId: 'artist-kwame-thompson',
    artistName: 'Kwame Thompson',
    description: 'Featured Upcoming Works: Saturday Night, Sunday Morning by Kwame Thompson.',
    videoUrl: '/videos/Kwame Book Promo 1.mp4',
    thumbnailUrl: '/images/genres/literature.jpg',
    duration: 290,
    views: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    category: 'Cinema / Literature',
    releaseDate: '2026-01-01',
  },
];

// Canonical Luther Vandross master record
const LUTHER_VANDROSS_TRACK: Track = {
  id: 'trk-pub-luther-never-too-much',
  title: 'Never Too Much',
  artistId: 'artist-luther-vandross',
  artistName: 'Luther Vandross',
  label: 'Epic Records / ChanceTEK One',
  albumId: 'album-luther-never-too-much',
  albumTitle: 'Never Too Much',
  audioUrl:
    'https://firebasestorage.googleapis.com/v0/b/spadesworks8.firebasestorage.app/o/media%2Fcatalog%2Faudio%2F1793254898258_trk-pub-1793247158957-c3734ea524_8e697043.mp3?alt=media&token=711e3a11-58b7-4593-9fad-34935e0e4222',
  coverUrl: '/images/albums/luther_vandross_never_too_much.jpg',
  duration: 231,
  genre: 'R&B / Soul / Post-Disco',
  bpm: 110,
  releaseYear: 1981,
  crateId: 'oldschool-rnb-soul',
  crateName: 'Timeless R&B | Soul Music',
  playCount: 0,
  likeCount: 0,
  dislikeCount: 0,
  commentCount: 0,
  featured: true,
};

export class LocalRAGEngine {
  /**
   * Main entry point: process a user prompt using local catalog indexing & semantic rules.
   */
  public static processQuery(rawQuery: string, context?: AgentContextPayload): LocalRAGResult {
    const query = (rawQuery || '').trim();
    const cleanLower = query.toLowerCase();

    // 1. Clean query of common filler words and search verbs
    const normalizedTarget = this.extractSearchTarget(cleanLower);

    // 2. Identify media & play intent
    const isPlayIntent =
      /\b(play|put on|queue|spin|mix|start playing|listen to)\b/.test(cleanLower);

    const isPlaylistIntent =
      cleanLower.includes('playlist') ||
      cleanLower.includes('crate') ||
      (/\bmix\b/.test(cleanLower) && !cleanLower.includes('remix'));

    const isVideoIntent =
      cleanLower.includes('video') ||
      cleanLower.includes('watch') ||
      cleanLower.includes('documentary') ||
      cleanLower.includes('film') ||
      cleanLower.includes('cinema');

    const isAudiobookIntent =
      cleanLower.includes('audiobook') ||
      cleanLower.includes('book') ||
      cleanLower.includes('read') ||
      cleanLower.includes('listen to book') ||
      cleanLower.includes('literature') ||
      cleanLower.includes('chapter') ||
      cleanLower.includes('spoken work');

    const isMerchIntent =
      cleanLower.includes('merch') ||
      cleanLower.includes('vinyl') ||
      cleanLower.includes('store') ||
      cleanLower.includes('shop') ||
      cleanLower.includes('buy') ||
      cleanLower.includes('shirt') ||
      cleanLower.includes('hoodie') ||
      cleanLower.includes('slipmat');

    // 3. Extract Memory Insights if user expresses a preference
    const memoryUpdates = this.extractMemoryInsights(query, cleanLower);

    // ── INTENT ROUTING ────────────────────────────────────────────────────────

    // A. Specific Artist Search: Michael Jackson
    if (
      cleanLower.includes('michael jackson') ||
      cleanLower.includes('king of pop') ||
      cleanLower.includes('thriller') ||
      cleanLower.includes('off the wall')
    ) {
      return this.handleMichaelJacksonQuery(cleanLower, memoryUpdates);
    }

    // B. Featured Literature / Spoken Works: Mi Vida Loca / Saturday Night
    if (cleanLower.includes('mi vida loca') || cleanLower.includes('orlando figueroa')) {
      return this.handleMiVidaLocaQuery(memoryUpdates);
    }

    if (cleanLower.includes('saturday night') || cleanLower.includes('kwame thompson')) {
      return this.handleSaturdayNightQuery(memoryUpdates);
    }

    // C0. Playlist Search Intent (user asked to play or find a playlist/crate)
    if (isPlaylistIntent) {
      const playlistMatches = this.searchPlaylists(
        normalizedTarget,
        context?.userId,
        context?.availablePlaylists
      );
      if (playlistMatches.length > 0) {
        return {
          content: this.formatPlaylistResponse(playlistMatches, normalizedTarget, isPlayIntent),
          playIntent: isPlayIntent,
          toolCalls: [
            {
              toolName: 'searchPlaylists',
              args: { query: normalizedTarget || query },
              status: 'completed',
              result: { count: playlistMatches.length, playlists: playlistMatches },
            },
          ],
          recommendations: { playlists: playlistMatches },
          memoryUpdates,
        };
      }
    }

    // C. Video Search Intent
    if (isVideoIntent && !cleanLower.includes('song') && !cleanLower.includes('track')) {
      const videoResult = this.searchVideos(normalizedTarget || cleanLower);
      if (videoResult.videos.length > 0) {
        return {
          content: this.formatVideoResponse(videoResult.videos, normalizedTarget),
          toolCalls: [
            {
              toolName: 'searchVideos',
              args: { query: normalizedTarget },
              status: 'completed',
              result: { count: videoResult.videos.length, videos: videoResult.videos },
            },
          ],
          recommendations: { videos: videoResult.videos },
          memoryUpdates,
        };
      }
    }

    // D. Audiobook Intent
    if (isAudiobookIntent) {
      const bookResult = this.searchAudiobooks(normalizedTarget || cleanLower);
      if (bookResult.audiobooks.length > 0) {
        return {
          content: this.formatAudiobookResponse(bookResult.audiobooks, normalizedTarget),
          toolCalls: [
            {
              toolName: 'searchAudiobooks',
              args: { query: normalizedTarget },
              status: 'completed',
              result: { count: bookResult.audiobooks.length, audiobooks: bookResult.audiobooks },
            },
          ],
          recommendations: { audiobooks: bookResult.audiobooks },
          memoryUpdates,
        };
      }
    }

    // E. Merch / Vinyl Intent
    if (isMerchIntent) {
      const merchResult = this.searchMerchandise(normalizedTarget || cleanLower);
      if (merchResult.products.length > 0) {
        return {
          content: this.formatMerchResponse(merchResult.products, normalizedTarget),
          toolCalls: [
            {
              toolName: 'searchMerchandise',
              args: { query: normalizedTarget },
              status: 'completed',
              result: { count: merchResult.products.length, products: merchResult.products },
            },
          ],
          recommendations: { products: merchResult.products },
          memoryUpdates,
        };
      }
    }

    // F. General Music / Song Search (Default Primary Pillar)
    const musicResult = this.searchMusic(normalizedTarget || cleanLower);

    if (musicResult.tracks.length > 0) {
      return {
        content: this.formatMusicResponse(musicResult.tracks, normalizedTarget || query, musicResult.artistMatch, isPlayIntent),
        playIntent: isPlayIntent,
        toolCalls: [
          {
            toolName: 'searchMusic',
            args: { query: normalizedTarget || query },
            status: 'completed',
            result: { count: musicResult.tracks.length, tracks: musicResult.tracks },
          },
        ],
        recommendations: {
          tracks: musicResult.tracks,
          artists: musicResult.artistMatch ? [musicResult.artistMatch] : undefined,
        },
        memoryUpdates,
      };
    }

    // G. Artist Discovery
    const artistResult = this.searchArtists(normalizedTarget || cleanLower);
    if (artistResult.artists.length > 0) {
      const topArtist = artistResult.artists[0];
      const artistTracks = this.searchMusic(topArtist.name).tracks;
      return {
        content:
          `Yo! Here is the profile for **${topArtist.name}** in the Break Beats archive!\n\n` +
          `**Label:** ${topArtist.label || 'ChanceTEK One'}\n` +
          `**Genres:** ${(topArtist.genres || []).join(' • ')}\n\n` +
          `> ${topArtist.bio}\n\n` +
          `I pulled verified tracks by **${topArtist.name}** below. Tap **Play** to start streaming!`,
        toolCalls: [
          {
            toolName: 'searchArtists',
            args: { query: normalizedTarget },
            status: 'completed',
            result: { count: artistResult.artists.length, artists: artistResult.artists },
          },
        ],
        recommendations: {
          artists: artistResult.artists,
          tracks: artistTracks.slice(0, 10),
        },
        memoryUpdates,
      };
    }

    // H. Fallback: Cultured Guide Overview
    return this.generatePlatformOverview(query, memoryUpdates);
  }

  /**
   * Dedicated high-fidelity handler for Michael Jackson queries.
   * Delivers all 19 remastered studio recordings across Off The Wall and Thriller.
   */
  private static handleMichaelJacksonQuery(
    cleanLower: string,
    memoryUpdates?: LocalRAGResult['memoryUpdates']
  ): LocalRAGResult {
    // Build combined pool to guarantee all 19 tracks are included
    const allTracks = MusicCatalogService.getAllTracks();
    const mjPool = [
      ...MICHAEL_JACKSON_TRACKS,
      ...allTracks.filter(
        (t) =>
          (t.artistName || '').toLowerCase().includes('michael jackson') &&
          !MICHAEL_JACKSON_TRACKS.some((mj) => mj.id === t.id)
      ),
    ];

    const offTheWallTracks = mjPool.filter((t) =>
      (t.albumTitle || '').toLowerCase().includes('off the wall')
    );
    const thrillerTracks = mjPool.filter((t) =>
      (t.albumTitle || '').toLowerCase().includes('thriller')
    );
    const otherMjTracks = mjPool.filter(
      (t) => !offTheWallTracks.includes(t) && !thrillerTracks.includes(t)
    );

    const orderedTracks = [...offTheWallTracks, ...thrillerTracks, ...otherMjTracks];

    const mjArtist: Artist = MOCK_ARTISTS.find((a) => a.id === 'artist-michael-jackson') || {
      id: 'artist-michael-jackson',
      name: 'Michael Jackson',
      label: 'Epic Records / ChanceTEK One',
      bio: 'The King of Pop. Legendary singer, songwriter, and dancer whose ground-breaking recordings revolutionized pop music, production, and video choreography.',
      avatarUrl: '/audio/uploads/Off_The_Wall_cover.jpg',
      bannerUrl: '/audio/uploads/Thriller_cover.jpg',
      genres: ['Pop', 'R&B / Soul', 'Disco', 'Funk', 'Rock'],
      verified: true,
      followerCount: 0,
      popularTrackIds: orderedTracks.map((t) => t.id),
      socialLinks: { website: 'https://chancetekone.com' },
    };

    let content = `Yo! Here are all **${orderedTracks.length} iconic Michael Jackson master recordings** in the **ChanceTEK One** vault!\n\n`;

    if (offTheWallTracks.length > 0) {
      content += `### 💽 *Off The Wall* (1979 Remastered Vault Edition)\n`;
      content += `*Produced by Quincy Jones & Michael Jackson — Peak Disco-Funk and Smooth Soul*\n`;
      offTheWallTracks.forEach((t, i) => {
        content += `${i + 1}. **${t.title}** (${this.formatDuration(t.duration)})\n`;
      });
      content += `\n`;
    }

    if (thrillerTracks.length > 0) {
      content += `### 🏆 *Thriller* (1982 Milestone Master Edition)\n`;
      content += `*The Best-Selling Album of All Time — Groundbreaking Pop, Funk, and Rock*\n`;
      thrillerTracks.forEach((t, i) => {
        content += `${i + 1}. **${t.title}** (${this.formatDuration(t.duration)})\n`;
      });
      content += `\n`;
    }

    content += `Tap the **Play** button on any track card below to stream in studio high-fidelity audio!`;

    return {
      content,
      toolCalls: [
        {
          toolName: 'searchMusic',
          args: { query: 'Michael Jackson', limit: orderedTracks.length },
          status: 'completed',
          result: {
            count: orderedTracks.length,
            artist: 'Michael Jackson',
            albums: ['Off The Wall', 'Thriller'],
            tracks: orderedTracks,
          },
        },
      ],
      recommendations: {
        tracks: orderedTracks,
        artists: [mjArtist],
      },
      memoryUpdates: {
        newFacts: [
          {
            id: `fact-mj-${Date.now()}`,
            fact: 'User is a fan of Michael Jackson and requested his complete catalog recordings.',
            category: 'preference',
            timestamp: new Date().toISOString(),
          },
        ],
        updatedTaste: {
          favoriteArtists: ['Michael Jackson'],
          favoriteGenres: ['Pop / Soul', 'Funk / Disco', 'R&B / Post-Disco'],
        },
      },
    };
  }

  /**
   * Dedicated handler for Mi Vida Loca by Author Orlando Figueroa.
   */
  private static handleMiVidaLocaQuery(memoryUpdates?: LocalRAGResult['memoryUpdates']): LocalRAGResult {
    const book = CANONICAL_AUDIOBOOKS[0];
    const video = CANONICAL_VIDEOS[0];

    const content =
      `Yo! Here is ***Mi Vida Loca*** by Author **Orlando Figueroa**!\n\n` +
      `### 📖 *Mi Vida Loca* (Spoken Work & Cinema Presentation)\n` +
      `**Author:** Orlando Figueroa\n` +
      `**Category:** Spoken Literature & 4K Cinema\n\n` +
      `> *A poignant, deeply personal autobiographical narrative chronicling resilience, streets, redemption, and artistic triumph.*\n\n` +
      `You can stream the master spoken video presentation in full HD below or visit **/audiobooks** and **/videos**!`;

    return {
      content,
      toolCalls: [
        {
          toolName: 'searchAudiobooks',
          args: { query: 'Mi Vida Loca' },
          status: 'completed',
          result: { count: 1, title: 'Mi Vida Loca', author: 'Orlando Figueroa' },
        },
      ],
      recommendations: {
        audiobooks: [book],
        videos: [video],
      },
      memoryUpdates,
    };
  }

  /**
   * Dedicated handler for Saturday Night, Sunday Morning by Kwame Thompson.
   */
  private static handleSaturdayNightQuery(memoryUpdates?: LocalRAGResult['memoryUpdates']): LocalRAGResult {
    const book = CANONICAL_AUDIOBOOKS[1];
    const video = CANONICAL_VIDEOS[1];

    const content =
      `Yo! Here is ***Saturday Night, Sunday Morning*** by Author **Kwame Thompson**!\n\n` +
      `### 📖 *Saturday Night, Sunday Morning*\n` +
      `**Author:** Kwame Thompson\n` +
      `**Category:** Urban Fiction & Drama\n\n` +
      `> *Featured Upcoming Work exploring urban life, choices, spirit, and the duality of nocturnal street rhythm versus Sunday morning clarity.*\n\n` +
      `You can watch the cinema book promo below or explore the full literature collection in **/audiobooks**!`;

    return {
      content,
      toolCalls: [
        {
          toolName: 'searchAudiobooks',
          args: { query: 'Saturday Night, Sunday Morning' },
          status: 'completed',
          result: { count: 1, title: 'Saturday Night, Sunday Morning', author: 'Kwame Thompson' },
        },
      ],
      recommendations: {
        audiobooks: [book],
        videos: [video],
      },
      memoryUpdates,
    };
  }

  /**
   * Search for music tracks with fuzzy matching & artist prioritization.
   */
  public static searchMusic(target: string): { tracks: Track[]; artistMatch?: Artist } {
    const allTracks = MusicCatalogService.getAllTracks();
    const clean = (target || '').toLowerCase().trim();

    if (!clean) {
      return { tracks: allTracks.slice(0, 10) };
    }

    // Comprehensive catalog pool including Michael Jackson, Vault classics, and Luther Vandross
    const pool: Track[] = [
      ...allTracks,
      ...MICHAEL_JACKSON_TRACKS.filter((mj) => !allTracks.some((t) => t.id === mj.id)),
      ...VAULT_CLASSIC_TRACKS.filter((vc) => !allTracks.some((t) => t.id === vc.id)),
    ];

    if (!pool.some((t) => (t.artistName || '').toLowerCase().includes('luther'))) {
      pool.push(LUTHER_VANDROSS_TRACK);
    }

    // Check artist match first
    const artistMatch = MOCK_ARTISTS.find(
      (a) => a.name.toLowerCase().includes(clean) || clean.includes(a.name.toLowerCase())
    );

    // 1. Exact or near artist matches
    const artistTracks = pool.filter((t) => {
      const a = (t.artistName || '').toLowerCase();
      return a.includes(clean) || (artistMatch && a.includes(artistMatch.name.toLowerCase()));
    });

    // 2. Title matches
    const titleTracks = pool.filter((t) => {
      const title = (t.title || '').toLowerCase();
      return title.includes(clean) && !artistTracks.includes(t);
    });

    // 3. Album matches
    const albumTracks = pool.filter((t) => {
      const alb = (t.albumTitle || '').toLowerCase();
      return alb.includes(clean) && !artistTracks.includes(t) && !titleTracks.includes(t);
    });

    // 4. Genre / Crate matches
    const genreTracks = pool.filter((t) => {
      const g = (t.genre || '').toLowerCase();
      return g.includes(clean) && !artistTracks.includes(t) && !titleTracks.includes(t) && !albumTracks.includes(t);
    });

    const combined = [...artistTracks, ...titleTracks, ...albumTracks, ...genreTracks];

    return {
      tracks: combined.slice(0, 20),
      artistMatch,
    };
  }

  /**
   * Search for artists.
   */
  public static searchArtists(target: string): { artists: Artist[] } {
    const clean = (target || '').toLowerCase().trim();
    if (!clean) return { artists: MOCK_ARTISTS.slice(0, 5) };

    const matching = MOCK_ARTISTS.filter((a) => {
      const name = (a.name || '').toLowerCase();
      const bio = (a.bio || '').toLowerCase();
      const genres = Array.isArray(a.genres) ? a.genres.join(' ').toLowerCase() : '';
      return name.includes(clean) || bio.includes(clean) || genres.includes(clean);
    });

    return { artists: matching };
  }

  /**
   * Search videos.
   */
  public static searchVideos(target: string): { videos: Video[] } {
    const clean = (target || '').toLowerCase().trim();
    const pool = [...MOCK_VIDEOS, ...CANONICAL_VIDEOS];

    if (!clean) return { videos: pool.slice(0, 4) };

    const matching = pool.filter((v) => {
      const title = (v.title || '').toLowerCase();
      const artist = (v.artistName || '').toLowerCase();
      const desc = (v.description || '').toLowerCase();
      return title.includes(clean) || artist.includes(clean) || desc.includes(clean);
    });

    return { videos: matching };
  }

  /**
   * Search audiobooks.
   */
  public static searchAudiobooks(target: string): { audiobooks: Audiobook[] } {
    const clean = (target || '').toLowerCase().trim();
    const pool = [...CANONICAL_AUDIOBOOKS, ...MOCK_AUDIOBOOKS];

    if (!clean) return { audiobooks: pool.slice(0, 4) };

    const matching = pool.filter((ab) => {
      const title = (ab.title || '').toLowerCase();
      const author = (ab.author || '').toLowerCase();
      const genre = (ab.genre || '').toLowerCase();
      const desc = (ab.description || '').toLowerCase();
      return title.includes(clean) || author.includes(clean) || genre.includes(clean) || desc.includes(clean);
    });

    return { audiobooks: matching };
  }

  /**
   * Search merchandise.
   */
  public static searchMerchandise(target: string): { products: Product[] } {
    const clean = (target || '').toLowerCase().trim();
    if (!clean) return { products: MOCK_PRODUCTS.slice(0, 4) };

    const matching = MOCK_PRODUCTS.filter((p) => {
      const title = (p.title || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return title.includes(clean) || desc.includes(clean) || cat.includes(clean);
    });

    return { products: matching };
  }

  /**
   * Search playlists from context summaries and server PlaylistService.
   */
  public static searchPlaylists(
    target: string,
    userId?: string,
    availablePlaylists: AvailablePlaylistSummary[] = []
  ): Playlist[] {
    const clean = (target || '').toLowerCase().trim();
    const serverPls = [
      ...(userId ? PlaylistService.getUserPlaylists(userId) : []),
      ...PlaylistService.getPublicPlaylists(),
    ];
    const byId = new Map<string, Playlist>();
    for (const pl of serverPls) byId.set(pl.id, pl);
    for (const summary of availablePlaylists) {
      if (!byId.has(summary.id)) {
        byId.set(summary.id, {
          id: summary.id,
          name: summary.name,
          description: summary.description,
          type: 'music',
          ownerId: userId || 'default-user',
          ownerName: summary.ownerName || 'ChanceTEK One Member',
          coverUrl: summary.coverUrl || '/images/studio_cover.jpg',
          visibility: 'public',
          items: (summary.trackTitles || []).map((title, idx) => ({
            id: `rag-item-${summary.id}-${idx}`,
            playlistId: summary.id,
            mediaId: `rag-media-${summary.id}-${idx}`,
            mediaType: 'music',
            title,
            artistName: summary.ownerName || 'ChanceTEK One',
            coverUrl: summary.coverUrl || '/images/studio_cover.jpg',
            duration: 180,
            position: idx,
            addedAt: new Date().toISOString(),
          })),
          itemCount: summary.itemCount,
          totalDuration: 0,
          stats: { likes: 0, saves: 0, plays: 0, shares: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const all = Array.from(byId.values());
    if (!clean) return all.slice(0, 6);

    return all
      .filter((pl) => {
        const name = (pl.name || '').toLowerCase();
        const desc = (pl.description || '').toLowerCase();
        const owner = (pl.ownerName || '').toLowerCase();
        const itemMatch = (pl.items || []).some(
          (it) =>
            (it.title || '').toLowerCase().includes(clean) ||
            (it.artistName || '').toLowerCase().includes(clean)
        );
        return name.includes(clean) || desc.includes(clean) || owner.includes(clean) || itemMatch;
      })
      .slice(0, 6);
  }

  /**
   * Formats playlist search response with human-in-the-loop verification prompt.
   */
  private static formatPlaylistResponse(
    playlists: Playlist[],
    target: string,
    isPlayIntent = false
  ): string {
    const count = playlists.length;
    let header = `Found **${count} matching ${count === 1 ? 'playlist' : 'playlists'}**`;
    if (target) header += ` for "${target}"`;
    header += `:\n\n`;

    let body = '';
    playlists.slice(0, 5).forEach((pl, i) => {
      const itemsCount = pl.itemCount ?? pl.items?.length ?? 0;
      body += `${i + 1}. **${pl.name}** — ${itemsCount} songs *(by ${pl.ownerName || 'ChanceTEK One'})*\n`;
    });

    const footer = isPlayIntent
      ? `\nPlease **verify** the playlist below and click **Confirm & Play Playlist** (or say **"yes"**) to start playback.`
      : `\nSelect any playlist below to play or mix in **DJChanceMix**!`;

    return header + body + footer;
  }

  /**
   * Formats music search response.
   */
  private static formatMusicResponse(
    tracks: Track[],
    target: string,
    artistMatch?: Artist,
    isPlayIntent = false
  ): string {
    const count = tracks.length;
    let header = `Yo! Found **${count} matching ${count === 1 ? 'track' : 'tracks'}** in the Break Beats vault`;
    if (artistMatch) {
      header += ` by **${artistMatch.name}**`;
    } else if (target) {
      header += ` matching "${target}"`;
    }
    header += `!\n\n`;

    let body = '';
    tracks.slice(0, 8).forEach((t, i) => {
      body += `${i + 1}. **${t.title}** — ${t.artistName} *(${this.formatDuration(t.duration)})*\n`;
    });

    if (tracks.length > 8) {
      body += `\n*...and ${tracks.length - 8} more tracks available below!*`;
    }

    const footer = isPlayIntent
      ? `\n\nPlease **verify** the song below and click **Confirm & Play** (or reply **"yes"**) before I start playback.`
      : `\n\nTap the **Play** button on any card below to listen in studio quality!`;

    return header + body + footer;
  }

  /**
   * Formats video search response.
   */
  private static formatVideoResponse(videos: Video[], target: string): string {
    let msg = `Yo! Found **${videos.length} 4K visual masterworks** in the cinema vault:\n\n`;
    videos.forEach((v, i) => {
      msg += `${i + 1}. **${v.title}** (${v.artistName}) — ${v.views?.toLocaleString() || 0} views\n`;
      if (v.description) {
        msg += `   > *${v.description.slice(0, 100)}...*\n`;
      }
    });
    msg += `\nHead to the **/videos** theater or tap any visual card below to watch!`;
    return msg;
  }

  /**
   * Formats audiobook search response.
   */
  private static formatAudiobookResponse(books: Audiobook[], target: string): string {
    let msg = `Yo! Here are **${books.length} cultural audiobooks & literature masterworks**:\n\n`;
    books.forEach((b, i) => {
      msg += `${i + 1}. **${b.title}** by ${b.author} (${b.chapters?.length || 1} chapters)\n`;
    });
    msg += `\nVisit **/audiobooks** to stream full multi-chapter narrations with chapter skip and bookmarking!`;
    return msg;
  }

  /**
   * Formats merch search response.
   */
  private static formatMerchResponse(products: Product[], target: string): string {
    let msg = `Yo! Here are **${products.length} exclusive merchandise and vinyl cuts**:\n\n`;
    products.forEach((p, i) => {
      msg += `${i + 1}. **${p.title}** — $${p.price} ${p.currency}\n`;
    });
    msg += `\nExplore the full store at **/merch** for limited vinyl pressings, apparel, and slipmats!`;
    return msg;
  }

  /**
   * Formats general platform overview.
   */
  private static generatePlatformOverview(
    query: string,
    memoryUpdates?: LocalRAGResult['memoryUpdates']
  ): LocalRAGResult {
    const featuredTracks = MusicCatalogService.getAllTracks().slice(0, 5);

    const content =
      `Yo! Welcome to **ChanceTEK One** by **ChanceTEK One** — the premier entertainment operating system for timeless crate digging and audio culture.\n\n` +
      `### What You Can Explore:\n` +
      `- **Music Crates (/music):** High-definition 12-bit SP-1200 beats, Soul, Funk, R&B, Golden Era Hip Hop, and Latin Freestyle.\n` +
      `- **Cinema Theater (/videos):** Mini-documentaries, live performances, and 4K cultural masterworks.\n` +
      `- **Literature Vault (/audiobooks):** Multi-chapter narrated audiobooks covering park jams and producer memoirs.\n` +
      `- **Vinyl & Merch (/merch):** Heavyweight vinyl pressings, SP-1200 apparel, and crate slipmats.\n` +
      `- **PWA Offline Mode:** Install directly on iOS or Android for uninterrupted background audio.\n\n` +
      `Ask me to find any artist (like *Michael Jackson*, *Luther Vandross*, *Janet Jackson*), locate breakbeats, or explore the crates!`;

    return {
      content,
      toolCalls: [
        {
          toolName: 'getPlatformHelp',
          args: { topic: query },
          status: 'completed',
          result: { status: 'overview_provided' },
        },
      ],
      recommendations: {
        tracks: featuredTracks,
      },
      memoryUpdates,
    };
  }

  /**
   * Clean search target of conversational prefixes, typos, and filler words.
   */
  private static extractSearchTarget(cleanLower: string): string {
    let t = cleanLower;

    // Fix common typos
    t = t.replace(/\bfine\b/g, 'find');
    t = t.replace(/\bsong\b/g, 'songs');

    // Strip leading command phrases (longest first)
    const phrases = [
      'can you play my playlist',
      'can you play the playlist',
      'please play my playlist',
      'please play the playlist',
      'play my playlist called',
      'play the playlist called',
      'play my playlist',
      'play the playlist',
      'play playlist called',
      'play playlist',
      'mix my playlist',
      'mix the playlist',
      'mix playlist',
      'find my playlist',
      'find playlist',
      'can you play the song',
      'please play the song',
      'can you play',
      'please play',
      'play the song',
      'play the track',
      'put on the song',
      'put on',
      'queue up',
      'queue',
      'start playing',
      'find all songs by',
      'find all songs of',
      'find all tracks by',
      'find songs by',
      'find songs of',
      'find tracks by',
      'find music by',
      'find music of',
      'find videos by',
      'find audiobooks by',
      'find books by',
      'search songs by',
      'search tracks by',
      'search for',
      'search',
      'play songs by',
      'play all songs by',
      'play tracks by',
      'play music by',
      'play',
      'show me songs by',
      'show me tracks by',
      'show me',
      'show songs by',
      'show tracks by',
      'look up',
      'listen to songs by',
      'listen to',
      'what songs do you have by',
      'what tracks do you have by',
      'do you have songs by',
      'do you have tracks by',
      'do you have',
      'who is',
      'tell me about',
      'songs by',
      'tracks by',
      'music by',
      'all songs by',
      'all tracks by',
    ];

    for (const phrase of phrases) {
      if (t.startsWith(phrase)) {
        t = t.slice(phrase.length).trim();
        break;
      }
    }

    // Also strip trailing "playlist" or "song" word if user wrote e.g. "play Sunday Soul playlist"
    t = t.replace(/\b(playlist|crate|song|track)\b$/i, '').trim();

    // Strip trailing question marks and punctuation
    t = t.replace(/[?!.,;:]+$/g, '').trim();

    return t;
  }

  /**
   * Extract taste signals from user message.
   */
  private static extractMemoryInsights(query: string, cleanLower: string): LocalRAGResult['memoryUpdates'] {
    const newFacts: MemoryFact[] = [];
    const updatedTaste: Partial<TasteProfile> = {};

    if (cleanLower.includes('love') || cleanLower.includes('favorite') || cleanLower.includes('like')) {
      if (cleanLower.includes('michael jackson')) {
        newFacts.push({
          id: `fact-${Date.now()}`,
          fact: 'User loves Michael Jackson and classic 80s/90s pop and funk.',
          category: 'preference',
          timestamp: new Date().toISOString(),
        });
        updatedTaste.favoriteArtists = ['Michael Jackson'];
      }
      if (cleanLower.includes('hip hop') || cleanLower.includes('boom bap') || cleanLower.includes('breakbeat')) {
        newFacts.push({
          id: `fact-genre-${Date.now()}`,
          fact: 'User prefers Golden Era Hip Hop and heavy breakbeats.',
          category: 'preference',
          timestamp: new Date().toISOString(),
        });
        updatedTaste.favoriteGenres = ['Golden Era Hip Hop', 'Break Beats'];
      }
    }

    if (newFacts.length > 0 || Object.keys(updatedTaste).length > 0) {
      return {
        newFacts: newFacts.length > 0 ? newFacts : undefined,
        updatedTaste: Object.keys(updatedTaste).length > 0 ? updatedTaste : undefined,
      };
    }
    return undefined;
  }

  private static formatDuration(secs?: number): string {
    if (!secs || isNaN(secs)) return '3:45';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}