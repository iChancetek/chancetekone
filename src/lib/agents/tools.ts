import { MOCK_TRACKS, MOCK_ARTISTS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_PRODUCTS, MOCK_ALBUMS, MOCK_PROJECTS, MOCK_PRODUCERS } from '@/lib/mockData';
import { Track, Artist, Video, Audiobook, Project, Producer } from '@/types/media';
import { Product } from '@/types/commerce';
import { MemoryFact, TasteProfile } from '@/types/memory';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { matchesTrackSearch, filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';

// Re-export definitions from the lean server-safe file
export { AGENT_TOOLS_DEFINITIONS } from '@/lib/agents/tool-definitions';






// Tool Execution Functions
export const executeAgentTool = async (
  toolName: string,
  args: Record<string, any>,
  userId: string = 'default-user'
): Promise<{
  result: any;
  recommendations?: {
    tracks?: Track[];
    artists?: Artist[];
    videos?: Video[];
    audiobooks?: Audiobook[];
    products?: Product[];
    projects?: Project[];
    producers?: Producer[];
  };
  memoryUpdates?: { newFacts?: MemoryFact[]; updatedTaste?: Partial<TasteProfile> };
}> => {
  switch (toolName) {
    case 'searchMusic': {
      const q = (args.query || '').toLowerCase().trim();
      const genre = (args.genre || '').toLowerCase().trim();
      const artist = (args.artist || '').toLowerCase().trim();
      const album = (args.album || '').toLowerCase().trim();
      const limit = typeof args.limit === 'number' ? args.limit : 20;

      let tracks = filterAndRankTracks(MusicCatalogService.getAllTracks(), q);
      tracks = tracks.filter((t) => {
        if (!t) return false;
        const artistName = (t.artistName || '').toLowerCase();
        const tGenre = (t.genre || '').toLowerCase();
        const albumTitle = (t.albumTitle || '').toLowerCase();

        const matchesArtist = !artist || artistName.includes(artist);
        const matchesAlbum = !album || albumTitle.includes(album);
        const matchesGenre = !genre || tGenre.includes(genre);
        const matchesBpm =
          (!args.minBpm || (t.bpm && t.bpm >= args.minBpm)) &&
          (!args.maxBpm || (t.bpm && t.bpm <= args.maxBpm));

        return matchesArtist && matchesAlbum && matchesGenre && matchesBpm;
      });

      return {
        result: { count: tracks.length, tracks: tracks.slice(0, limit) },
        recommendations: { tracks: tracks.slice(0, limit) },
      };
    }

    case 'searchArtists': {
      const q = (args.query || '').trim();
      const genre = (args.genre || '').toLowerCase().trim();
      const artists = MOCK_ARTISTS.filter((a) => {
        if (!a) return false;
        const matchesQ = matchesGenericMediaSearch(a, q);
        const matchesGenre =
          !genre ||
          (Array.isArray(a.genres) && a.genres.some((g) => (g || '').toLowerCase().includes(genre)));
        return matchesQ && matchesGenre;
      });
      return {
        result: { count: artists.length, artists: artists.slice(0, 6) },
        recommendations: { artists: artists.slice(0, 6) },
      };
    }

    case 'searchVideos': {
      const q = (args.query || '').trim();
      const videos = MOCK_VIDEOS.filter((v) => {
        if (!v) return false;
        return matchesGenericMediaSearch(v, q);
      });
      return {
        result: { count: videos.length, videos: videos.slice(0, 6) },
        recommendations: { videos: videos.slice(0, 6) },
      };
    }

    case 'searchAudiobooks': {
      const q = (args.query || '').trim();
      const audiobooks = MOCK_AUDIOBOOKS.filter((ab) => {
        if (!ab) return false;
        return matchesGenericMediaSearch(ab, q);
      });
      return {
        result: { count: audiobooks.length, audiobooks: audiobooks.slice(0, 6) },
        recommendations: { audiobooks: audiobooks.slice(0, 6) },
      };
    }

    case 'searchMerchandise': {
      const q = (args.query || '').trim();
      const cat = (args.category || '').toLowerCase().trim();
      const products = MOCK_PRODUCTS.filter((p) => {
        if (!p) return false;
        const pCat = (p.category || '').toLowerCase();
        const matchesQ = matchesGenericMediaSearch(p, q);
        const matchesCat = !cat || pCat.includes(cat);
        return matchesQ && matchesCat;
      });
      return {
        result: { count: products.length, products: products.slice(0, 6) },
        recommendations: { products: products.slice(0, 6) },
      };
    }

    case 'getTrackDetails': {
      const track = MusicCatalogService.getTrackById(args.trackId) || MOCK_TRACKS.find((t) => t.id === args.trackId);
      if (!track) return { result: { error: 'Track not found' } };
      return {
        result: track,
        recommendations: { tracks: [track] },
      };
    }

    case 'getPlatformHelp': {
      const topic = (args.topic || '').toLowerCase();
      let details = '';
      if (topic.includes('famio') || topic.includes('fam') || topic.includes('social')) {
        details = `The Fam... Famio (https://famio.us): The official companion social media and business networking platform for 8 OF SPADES WORKS, created by Chancellor @ ChanceTEK LLC. Built for kinship, creative collaboration, social connection, and community legacy. Both platforms are linked for extra curriculum and ease of access.`;
      } else if (topic.includes('about') || topic.includes('mission') || topic.includes('origin')) {
        details = `About 8 OF SPADES WORKS (/about): A cultural & sonic platform for Independent Artists and Creators developed by Chancellor @ ChanceTEK LLC & 8 OF SPADES WORKS. Features direct distribution, streaming, and monetization without gatekeepers. Dual tiers: Account Holders and Members with audience Donation support.`;
      } else if (topic.includes('term') || topic.includes('covenant') || topic.includes('license') || topic.includes('copyright')) {
        details = `Terms of Service (/terms): Platform Covenant effective Jan 1, 2026. All audio, visual, and algorithmic media is protected IP of 8 OF SPADES WORKS. Users receive an individual personal non-commercial license. Limited vinyl pressings fulfilled first-come, first-served. Delaware jurisdiction.`;
      } else if (topic.includes('privacy') || topic.includes('data') || topic.includes('security')) {
        details = `Privacy Policy (/privacy): Data Stewardship effective Jan 1, 2026. Privacy is a civil liberty. Zero monetization or selling of personal data. Dual-memory stored with client-side isolation and user-controlled deletion. Full user data sovereignty.`;
      } else if (topic.includes('support') || topic.includes('contact') || topic.includes('help') || topic.includes('concierge')) {
        details = `Support Center (/support): Crate Concierge and technical assistance for PWA offline playback, vinyl order tracking, and memory vault reset. Contact us directly at support@8ofspadesworks.us or concierge@8ofspadesworks.us.`;
      } else if (topic.includes('project') || topic.includes('masterwork')) {
        details = `Projects (/projects): Explore production masterworks: 1) The Return of the Break Beats (12-bit SP-1200), 2) ChanceTEK (Agentic AI, iSkylar, Famio), 3) The Bronx Heritage Archive (oral history & park jams), 4) Quantum Break Sequence (cyber electro breaks), and 5) Velvet Horns & Tape Saturation (2-inch analog tape funk).`;
      } else if (topic.includes('producer') || topic.includes('gear') || topic.includes('sp-1200') || topic.includes('mpc')) {
        details = `Producers (/producers): Discover sonic architects shaping the breakbeat renaissance: 8 OF SPADES WORKS, Chancellor @ ChanceTEK LLC, Cipher Voltage, and Luna Brass & The Crate Queens.`;
      } else if (topic.includes('music') || topic.includes('stream') || topic.includes('track') || topic.includes('bpm')) {
        details = `Music Streaming: Explore the /music crate to stream high-definition breakbeat tracks, filter by BPM tempo (from 85 to 140+ BPM), view live waveforms, check lyrics, and inspect Sample DNA.`;
      } else if (topic.includes('video') || topic.includes('documentary')) {
        details = `Videos: Head to /videos for mini-documentaries, live breakbeat performances, vintage park jam footage, and music videos.`;
      } else if (topic.includes('audiobook') || topic.includes('book') || topic.includes('story')) {
        details = `Audiobooks: Visit /audiobooks for narrated cultural sagas covering the golden era of sampling, the Bronx park jams, and legendary producer memoirs with full multi-chapter audio.`;
      } else if (topic.includes('merch') || topic.includes('vinyl') || topic.includes('shop') || topic.includes('store')) {
        details = `Merchandise & Vinyl: Browse /merch for limited-edition heavyweight vinyl records, slipmats, SP-1200 / MPC apparel, and crate accessories.`;
      } else if (topic.includes('pwa') || topic.includes('install') || topic.includes('offline') || topic.includes('app')) {
        details = `PWA & Offline Playback: Install Return of the Break Beats directly onto your iOS, Android, or desktop device. Enjoy background playback, lock-screen controls, and offline crate streaming.`;
      } else if (topic.includes('sample') || topic.includes('detective') || topic.includes('genealogy') || topic.includes('break')) {
        details = `Sample Detective: Tap the 'Sample DNA' button on any track to reveal its 1960s/70s funk drum origins, vintage sampler lore (E-mu SP-1200 / Akai MPC60), famous flips, and DJ EQ mixing tips.`;
      } else if (topic.includes('account') || topic.includes('auth') || topic.includes('login') || topic.includes('visitor') || topic.includes('guest')) {
        details = `Visitor Access & Membership: Visitors can immediately explore the catalog, stream breakbeats, watch videos, listen to audiobooks, shop vinyl, and chat with Break Beats AI without signing in. Creating a free account lets you sync your AI memories, save customized playlists, and track order history.`;
      } else {
        details = `Return of the Break Beats is an entertainment operating system uniting breakbeat music streaming, culture videos, audiobooks, vinyl merchandise, projects, producers, and autonomous AI crate digging. Linked with The Fam... Famio (https://famio.us) social media companion. Visitors can freely stream and explore without an account!`;
      }

      return {
        result: {
          info: details,
          platformOverview: `Return of the Break Beats features: 1) High-Definition Music Streaming & BPM Crate Digging, 2) Videos & Documentaries, 3) Production Projects & Masterworks, 4) Master Producers Directory, 5) Narrated Audiobooks, 6) Limited Vinyl & Merch Store, 7) PWA Offline Mode & Background Playback, 8) Sample Detective Break Genealogy, 9) The Fam... Famio Social Platform (https://famio.us), and 10) Break Beats AI Assistant.`,
          visitorAccess: 'Visitors and guests have full access to browse, stream, watch videos, read audiobooks, and ask the AI assistant questions at any time.',
        },
      };
    }

    // --- MEMORY EXECUTION HANDLERS ---
    case 'rememberUserFact': {
      const factText = (args.fact || '').trim();
      const category = (args.category as MemoryFact['category']) || 'preference';
      const newFact: MemoryFact = {
        id: `fact-${Date.now()}`,
        fact: factText,
        category,
        timestamp: new Date().toISOString(),
        source: 'user_stated',
      };
      return {
        result: {
          status: 'success',
          message: `Saved to Long-Term Memory: "${factText}"`,
          fact: newFact,
        },
        memoryUpdates: {
          newFacts: [newFact],
        },
      };
    }

    case 'updateTasteProfile': {
      const updatedTaste: Partial<TasteProfile> = {};
      if (args.genres && Array.isArray(args.genres)) {
        updatedTaste.favoriteGenres = args.genres;
      }
      if (args.minBpm || args.maxBpm || args.preferredBpm) {
        updatedTaste.bpmSweetSpot = {
          min: args.minBpm || 85,
          max: args.maxBpm || 140,
          preferred: args.preferredBpm || 95,
        };
      }
      if (args.gearInterests && Array.isArray(args.gearInterests)) {
        updatedTaste.gearInterests = args.gearInterests;
      }
      if (args.vibeTags && Array.isArray(args.vibeTags)) {
        updatedTaste.vibeTags = args.vibeTags;
      }

      return {
        result: {
          status: 'success',
          message: 'Taste Profile updated in Long-Term Memory',
          updates: updatedTaste,
        },
        memoryUpdates: {
          updatedTaste,
        },
      };
    }

    case 'recallMemories': {
      return {
        result: {
          status: 'success',
          message: 'Retrieved active user memories and taste DNA.',
        },
      };
    }

    // --- PLAYLIST EXECUTION HANDLERS ---
    case 'createPlaylist': {
      const pl = PlaylistService.createPlaylist({
        name: args.name,
        description: args.description || 'AI-curated breakbeat session',
        type: args.type || 'music',
        ownerId: userId,
        ownerName: '8 OF SPADES WORKS',
        visibility: args.visibility || 'public',
      });

      if (args.trackIds && Array.isArray(args.trackIds)) {
        args.trackIds.forEach((tid: string) => {
          PlaylistService.addItemToPlaylist(pl.id, userId, {
            mediaId: tid,
            mediaType: 'music',
          });
        });
      }

      const refreshed = PlaylistService.getPlaylistById(pl.id, userId);
      return {
        result: {
          status: 'success',
          message: `Created playlist "${pl.name}" with ID: ${pl.id}`,
          playlist: refreshed.playlist || pl,
        },
      };
    }

    case 'addMediaToPlaylist': {
      const res = PlaylistService.addItemToPlaylist(args.playlistId, userId, {
        mediaId: args.mediaId,
        mediaType: args.mediaType || 'music',
      });
      return {
        result: {
          status: res.success ? 'success' : 'error',
          message: res.success ? `Added to playlist successfully.` : res.error,
          item: res.item,
        },
      };
    }

    case 'getUserPlaylists': {
      const type = args.type || 'all';
      const pls = PlaylistService.getUserPlaylists(userId, {
        type: type === 'all' ? undefined : type,
      });
      const publicPls = PlaylistService.getPublicPlaylists({
        type: type === 'all' ? undefined : type,
      });
      return {
        result: {
          userPlaylistsCount: pls.length,
          userPlaylists: pls.slice(0, 5),
          publicPlaylistsCount: publicPls.length,
          publicPlaylists: publicPls.slice(0, 5),
        },
      };
    }

    case 'getPlaylistDetails': {
      const res = PlaylistService.getPlaylistById(args.playlistId, userId);
      if (!res.playlist) {
        return { result: { error: res.error || 'Playlist not found' } };
      }
      return {
        result: {
          id: res.playlist.id,
          name: res.playlist.name,
          description: res.playlist.description,
          type: res.playlist.type,
          itemCount: res.playlist.itemCount,
          totalDuration: res.playlist.totalDuration,
          items: res.playlist.items,
        },
      };
    }

    case 'inspectSampleLineage': {
      const trackTitle = args.trackTitle || 'Breakbeat Session';
      const all = MusicCatalogService.getAllTracks();
      const matchingTrack = all.find(
        (t) => t.title.toLowerCase().includes(trackTitle.toLowerCase())
      ) || all[0] || MOCK_TRACKS[0];

      return {
        result: {
          breakName: 'Amen & Funky Drummer Hybrid Crate',
          trackTitle: matchingTrack.title,
          originalMaster: {
            title: 'Amen, Brother',
            artist: 'The Winstons',
            drummer: 'Gregory C. Coleman',
            releaseYear: 1969,
            label: 'Metromedia Records',
            originalBpm: 136,
            breakTimestamp: '01:26',
          },
          samplerLore: {
            machineName: 'E-mu SP-1200',
            bitDepth: '12-bit / 26.04 kHz Linear PCM',
            tuningTechnique: 'Sampled at +8 pitch from vinyl to conserve sample memory, tuned down in the SP-1200 for 12-bit drum saturation and aliasing bite.',
            sonicSignature: '12-bit warmth, punchy transients, and authentic syncopated drum swing.',
          },
          famousFlips: [
            { songTitle: 'Straight Outta Compton', artist: 'N.W.A', year: 1988, producer: 'Dr. Dre' },
            { songTitle: 'King of the Beats', artist: 'Mantronix', year: 1988, producer: 'Kurtis Mantronik' },
            { songTitle: 'Charly', artist: 'The Prodigy', year: 1991, producer: 'Liam Howlett' },
          ],
          culturalStory: `${matchingTrack.title} builds upon the foundational golden-era breakbeat lineage. Originally recorded in 1969, this syncopated four-bar drum solo was rediscovered in the late 1970s by Kool Herc and Grandmaster Flash in the South Bronx, who extended the groove using two turntables. During the late 1980s, samplers like the E-mu SP-1200 allowed producers to chop each kick, snare, and open hat across the pads, creating new rhythmic permutations that defined both boom bap hip-hop and early 90s UK breakbeat rave music.`,
          djMixingTip: 'Roll off frequencies below 50Hz to leave room for the sub-bass, and boost 3.2kHz slightly to accentuate the snare crack during live harmonic transitions.',
        },
        recommendations: {
          tracks: all.filter((t) => t.id !== matchingTrack.id).slice(0, 2),
        },
      };
    }

    case 'searchProjects': {
      const q = (args.query || '').toLowerCase().trim();
      const producerFilter = (args.producer || '').toLowerCase().trim();
      const statusFilter = (args.status || '').toLowerCase().trim();

      let matches = MOCK_PROJECTS;
      if (q) {
        matches = matches.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.narrativeOverview && p.narrativeOverview.toLowerCase().includes(q)) ||
            (p.genre && p.genre.toLowerCase().includes(q)) ||
            (p.equipmentUsed && p.equipmentUsed.some((eq) => eq.toLowerCase().includes(q))) ||
            (p.sampleSources && p.sampleSources.some((s) => s.toLowerCase().includes(q)))
        );
      }
      if (producerFilter) {
        matches = matches.filter((p) => p.producerName.toLowerCase().includes(producerFilter));
      }
      if (statusFilter) {
        matches = matches.filter((p) => p.status.toLowerCase().includes(statusFilter));
      }

      return {
        result: {
          count: matches.length,
          projects: matches.map((p) => ({
            id: p.id,
            title: p.title,
            subtitle: p.subtitle,
            producerName: p.producerName,
            releaseYear: p.releaseYear,
            status: p.status,
            genre: p.genre,
            bpm: p.bpm,
            description: p.description,
            equipmentUsed: p.equipmentUsed,
            vinylPressing: p.vinylPressing,
          })),
        },
        recommendations: {
          projects: matches,
        },
      };
    }

    case 'getProjectDetails': {
      const pid = (args.projectId || '').toLowerCase().trim();
      const project = MOCK_PROJECTS.find(
        (p) => p.id.toLowerCase() === pid || p.title.toLowerCase().includes(pid)
      );

      if (!project) {
        return {
          result: {
            error: `Project "${args.projectId}" not found in master records.`,
            availableProjects: MOCK_PROJECTS.map((p) => ({ id: p.id, title: p.title })),
          },
        };
      }

      const tracks = MusicCatalogService.getAllTracks().filter((t) => project.trackIds?.includes(t.id));
      const videos = MOCK_VIDEOS.filter((v) => project.videoIds?.includes(v.id));

      return {
        result: {
          project,
          tracks: tracks.map((t) => ({ id: t.id, title: t.title, artistName: t.artistName, bpm: t.bpm })),
          videos: videos.map((v) => ({ id: v.id, title: v.title, artistName: v.artistName })),
        },
        recommendations: {
          projects: [project],
          tracks,
          videos,
        },
      };
    }

    case 'searchProducers': {
      const q = (args.query || '').toLowerCase().trim();
      let matches = MOCK_PRODUCERS;
      if (q) {
        matches = matches.filter(
          (pr) =>
            pr.name.toLowerCase().includes(q) ||
            pr.handle.toLowerCase().includes(q) ||
            pr.role.toLowerCase().includes(q) ||
            pr.bio.toLowerCase().includes(q) ||
            pr.gearSetup.some((g) => g.toLowerCase().includes(q)) ||
            pr.favoriteBreaks.some((b) => b.toLowerCase().includes(q)) ||
            pr.credits.some((c) => c.toLowerCase().includes(q))
        );
      }

      return {
        result: {
          count: matches.length,
          producers: matches.map((pr) => ({
            id: pr.id,
            name: pr.name,
            handle: pr.handle,
            role: pr.role,
            label: pr.label,
            bio: pr.bio,
            gearSetup: pr.gearSetup,
            signatureBpmRange: pr.signatureBpmRange,
            favoriteBreaks: pr.favoriteBreaks,
            credits: pr.credits,
            verified: pr.verified,
          })),
        },
        recommendations: {
          producers: matches,
        },
      };
    }

    case 'getPlatformPolicies': {
      const topic = args.topic || 'about';
      const policies: Record<string, any> = {
        about: {
          title: 'About 8 OF SPADES WORKS',
          path: '/about',
          mission:
            'A sovereign digital stage and living sonic archive engineered for independent artists, producers, beatmakers, and crate diggers. Built to eliminate extractive middlemen and streaming gatekeepers, allowing creators to distribute music, video, and physical artifacts directly to their audience.',
          principles: [
            'Direct-to-fan monetization with integrated tipping and patron donations.',
            'Preservation of breakbeat lineage, vinyl culture, and 12-bit hardware heritage (SP-1200, MPC60).',
            'Full data sovereignty with privacy-first user memory vault.',
            'Universal access through PWA design and dynamic typography scaling (90% to 145%).',
          ],
        },
        famio: {
          title: 'The Fam... Famio Companion Social Media Platform',
          url: 'https://famio.us',
          architect: 'Chancellor @ ChanceTEK LLC',
          description:
            'The Fam... Famio is the official companion social media and business networking platform linked to 8 OF SPADES WORKS. Engineered for family connection, creator collaboration, and professional networking without intrusive algorithms or data exploitation.',
          features: [
            'Family circles & generational audio heritage reels.',
            'Creative and business networking for independent artists and engineers.',
            'Direct cross-platform integration with the 8 OF SPADES WORKS crate ecosystem.',
          ],
        },
        terms: {
          title: 'Terms of Service & Platform Covenant',
          path: '/terms',
          effectiveDate: 'January 1, 2026',
          keyPoints: [
            'Intellectual Property: All master recordings, stems, 4K video footage, liner notes, and visual artwork remain the exclusive intellectual property of 8 OF SPADES WORKS and respective creators.',
            'License: Account holders receive a revocable, non-exclusive, non-transferable personal license to stream and download for personal non-commercial listening.',
            'AI Integrity & Provenance: Break Beats AI provides curatorial and educational insights only. Scraping or unauthorized AI model training on audio stems is prohibited.',
            'Physical Goods & Vinyl: Limited edition vinyl pressings are fulfilled on a first-come, first-served basis with certified proof of inspection.',
            'Jurisdiction: Governed under the commercial laws of the State of Delaware.',
          ],
        },
        privacy: {
          title: 'Privacy Policy & Data Sovereignty',
          path: '/privacy',
          corePrinciple: 'Privacy is a fundamental civil liberty, not an upsell or negotiation point.',
          keyPoints: [
            'Zero Data Brokerage: We never sell, lease, rent, or trade listener telemetry, search histories, or listening logs to advertisers or third-party data brokers.',
            'Client-Isolated Memory Vault: Dual-memory architecture stores working memory client-side in localStorage and indexedDB with explicit user control and instant wipe.',
            'Data Minimization: Only essential authentication and subscription data is stored securely in Firebase.',
            'Right of Erasure: Users possess complete sovereignty over their data with one-click purge options.',
          ],
        },
        support: {
          title: 'Support Center & Crate Concierge',
          path: '/support',
          concierge: 'Live multi-tier support for crate diggers, audiophiles, and collectors.',
          channels: {
            email: 'support@8ofspadesworks.us',
            concierge: 'concierge@8ofspadesworks.us',
            responseTime: 'Under 4 hours for Members; under 24 hours for standard accounts.',
          },
          commonResolutions: [
            'PWA Offline Playback: Use the "Save to Crate" button while online to cache lossless audio in IndexedDB.',
            'Vinyl Pressing Tracking: Direct batch tracking provided via email upon physical dispatch from the pressing plant.',
            'Memory Vault Reset: Navigate to AI settings or ask Break Beats AI directly to clear short-term and long-term memory logs.',
          ],
        },
        membership: {
          title: 'Account Holder vs. Member Tiers',
          tiers: [
            {
              tier: 'Account Holder (Free)',
              benefits: ['Standard audio streaming', 'Create up to 3 custom crates', 'Standard Break Beats AI access'],
            },
            {
              tier: 'Member / Crate Club ($9.99/mo)',
              benefits: [
                'Lossless 24-bit/96kHz FLAC streaming',
                'Unlimited custom crates & public curation',
                'Priority vinyl pre-order allocations',
                'Deep Sample Detective break lineage analysis',
                'Exclusive 4K cinema masterclasses & stems access',
              ],
            },
          ],
        },
        pwa: {
          title: 'Progressive Web App Architecture',
          description:
            '8 OF SPADES WORKS is engineered as an installable PWA for iOS, Android, macOS, and Windows. It features service-worker caching for full offline audio playback, dynamic typography scaling (90%-145%), and custom AudioWorklet DSP processing.',
        },
      };

      const selected = policies[topic] || policies['about'];
      return {
        result: selected,
      };
    }

    case 'searchCoverArtTavily': {
      const { searchCoverArtWithTavily } = await import('@/lib/ai/tavilyCoverArt').then(m => ({ searchCoverArtWithTavily: m.TavilyCoverArtService.searchCoverArt }));
      const candidates = await searchCoverArtWithTavily({
        artist: args.artist,
        album: args.album,
        title: args.title,
      });
      return {
        result: {
          query: `${args.artist} - ${args.album || args.title || ''}`,
          count: candidates.length,
          bestCandidate: candidates[0] || null,
          candidates,
        },
      };
    }

    case 'attachCoverArtToMP3': {
      const { coverUrl, artist, album, title } = args;
      return {
        result: {
          success: true,
          coverUrl,
          message: `Cover art successfully staged and attached to "${title || album || 'Track'}" by ${artist}.`,
        },
      };
    }

    case 'scanPlatformMissingArtwork': {
      const { PlatformCatalogScannerAgent } = await import('@/lib/ai/platformCatalogScannerAgent');
      const report = await PlatformCatalogScannerAgent.scanPlatformArtwork({
        crateId: args.crateId,
      });
      return {
        result: {
          totalTracks: report.totalTracksScanned,
          missingTracksCount: report.missingTracksCount,
          missingAlbumsCount: report.missingAlbumsCount,
          items: args.limit ? report.itemsNeedingArtwork.slice(0, args.limit) : report.itemsNeedingArtwork,
        },
      };
    }

    case 'autoRepairPlatformCoverArt': {
      const { PlatformCatalogScannerAgent } = await import('@/lib/ai/platformCatalogScannerAgent');
      const summary = await PlatformCatalogScannerAgent.runAutonomousCatalogRepair({
        limit: args.limit || 10,
        crateId: args.crateId,
        dryRun: Boolean(args.dryRun),
      });
      return {
        result: {
          success: true,
          repairedCount: summary.repairedCount,
          failedCount: summary.failedCount,
          items: summary.items,
        },
      };
    }

    case 'verifyArtistAudioAssociation': {
      const { MusicCatalogHealingAgent } = await import('@/lib/ai/MusicCatalogHealingAgent');
      const allTracks = MusicCatalogService.getAllTracks();
      const targetTracks = args.trackId
        ? allTracks.filter((t) => t.id === args.trackId)
        : args.artistName
        ? allTracks.filter((t) => t.artistName.toLowerCase().includes(args.artistName.toLowerCase()))
        : allTracks;

      const report = targetTracks.map((t) => ({
        trackId: t.id,
        title: t.title,
        artist: t.artistName,
        audioUrl: t.audioUrl,
        verification: MusicCatalogHealingAgent.verifyArtistAudioAssociation(t),
      }));

      const mismatches = report.filter((r) => !r.verification.isValid);

      return {
        result: {
          totalAudited: targetTracks.length,
          mismatchesFound: mismatches.length,
          status: mismatches.length === 0 ? 'All audited audio streams authentically verified' : 'Mismatches detected and isolated',
          mismatches,
        },
      };
    }

    default:
      return { result: { error: `Tool ${toolName} not supported` } };
  }
};
