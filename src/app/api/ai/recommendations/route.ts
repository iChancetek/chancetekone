import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS, MOCK_PRODUCTS } from '@/lib/mockData';
import { PLATFORM_CANONICAL_TRACKS } from '@/lib/music/MusicCatalogService';

// ── Rate Limiter ─────────────────────────────────────────────
// 30 recommendation calls per hour (server-wide).
const MAX_RECS_PER_HOUR = 30;
const recsRateLimit = { count: 0, windowStart: Date.now() };
function checkRecsLimit(): boolean {
  const now = Date.now();
  if (now - recsRateLimit.windowStart > 60 * 60 * 1000) {
    recsRateLimit.count = 0;
    recsRateLimit.windowStart = now;
  }
  if (recsRateLimit.count >= MAX_RECS_PER_HOUR) return false;
  recsRateLimit.count += 1;
  return true;
}

const ALL_AVAILABLE_TRACKS = [...MOCK_TRACKS, ...PLATFORM_CANONICAL_TRACKS];

export async function POST(req: NextRequest) {
  try {
    const { currentMedia, userContext } = await req.json();

    if (!currentMedia) {
      return NextResponse.json({ error: 'currentMedia is required' }, { status: 400 });
    }

    // Rate limit check — fall through to deterministic fallback if over budget
    if (!checkRecsLimit()) {
      console.warn('[Recommendations] Rate limit reached — using deterministic fallback.');
      const fallbackTracks = ALL_AVAILABLE_TRACKS.slice(0, 3);
      return NextResponse.json({
        agentName: 'Crate Digger Agent',
        agentRationale: 'Serving curated selections from the catalog.',
        vibeTag: 'Break Beats Selection',
        bpmShift: 'Aligned',
        recommendedTracks: fallbackTracks,
        recommendedVideos: MOCK_VIDEOS.slice(0, 1),
        recommendedAudiobooks: MOCK_AUDIOBOOKS.slice(0, 1),
      });
    }

    const openai = getOpenAIClient();

    // Catalog Manifest Summary for the Agent
    const catalogSummary = {
      tracks: ALL_AVAILABLE_TRACKS.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artistName,
        genre: t.genre,
        bpm: t.bpm,
        duration: t.duration,
      })),
      videos: MOCK_VIDEOS.map((v) => ({
        id: v.id,
        title: v.title,
        artist: v.artistName,
        category: v.category,
        views: v.views,
      })),
      audiobooks: MOCK_AUDIOBOOKS.map((a) => ({
        id: a.id,
        title: a.title,
        author: a.author,
        narrator: a.narrator,
        chaptersCount: a.chapters.length,
      })),
    };

    const systemPrompt = `You are the Elite Contextual Agentic Curator for 'Return of the Break Beats'.
Your mission is to perform real-time, cross-media crate curation based on what the user is actively playing/watching right now.

Given the current media context and the platform catalog, you must select:
1. 2 to 3 Harmonic Tracks (closely matched BPM +/- 6 BPM, compatible energy, or direct stylistic lineage).
2. 1 to 2 Related Videos (documentaries, studio sessions, or music videos sharing the same vibe/gear).
3. 1 to 2 Related Audiobooks (historical narratives or technical production lore relevant to this break style).

You must output STRICT JSON matching this schema:
{
  "agentName": "Crate Digger Agent",
  "agentRationale": "A concise, deep cultural explanation (2-3 sentences) on why these specific tracks, videos, and books fit seamlessly into this listening pocket.",
  "recommendedTrackIds": ["track-1", "track-3"],
  "recommendedVideoIds": ["video-1"],
  "recommendedAudiobookIds": ["audiobook-1"],
  "vibeTag": "95 BPM Golden Era Funk Pocket",
  "bpmShift": "+2 BPM"
}`;

    const userPrompt = `Active Media Context:
- Type: ${currentMedia.type || 'track'}
- Title: ${currentMedia.title}
- Artist/Author: ${currentMedia.artist || currentMedia.author || 'Unknown'}
- Genre/Category: ${currentMedia.genre || currentMedia.category || 'Breakbeat'}
- BPM: ${currentMedia.bpm || 'Unknown'}

User Profile / Memory:
- User: ${userContext?.name || '8 OF SPADES WORKS'}
- Known Facts: ${JSON.stringify(userContext?.explicitFacts || [])}
- Musical DNA: ${JSON.stringify(userContext?.tasteProfile || {})}

Platform Catalog:
${JSON.stringify(catalogSummary, null, 2)}

Provide the harmonic, cross-media recommendations in strict JSON format now.`;

    const model = AI_CONFIG.defaultModel;
    const isGpt5 = model.toLowerCase().startsWith('gpt-5');

    const completionParams: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1000,
    };

    if (isGpt5) {
      completionParams.reasoning_effort = 'none';
    }

    let parsedResult: any = null;

    try {
      const completion = await openai.chat.completions.create(completionParams);
      const text = completion.choices[0]?.message?.content || '{}';
      parsedResult = JSON.parse(text);
    } catch (aiErr: any) {
      console.warn('AI recommendations fallback triggered:', aiErr.message);
      // Deterministic cultural fallback based on BPM & Genre
      const curBpm = typeof currentMedia.bpm === 'number' ? currentMedia.bpm : 100;
      const matchingTracks = ALL_AVAILABLE_TRACKS.filter((t) => t.id !== currentMedia.id).sort(
        (a, b) => Math.abs((a.bpm || 100) - curBpm) - Math.abs((b.bpm || 100) - curBpm)
      );

      parsedResult = {
        agentName: 'Crate Digger Agent',
        agentRationale: `Locked into the ${currentMedia.genre || 'Breakbeat'} pocket at ${curBpm} BPM. These harmonic selections maintain rhythmic tension and sample lineage across the session.`,
        recommendedTrackIds: matchingTracks.slice(0, 3).map((t) => t.id),
        recommendedVideoIds: [MOCK_VIDEOS[0]?.id || 'video-1'],
        recommendedAudiobookIds: [MOCK_AUDIOBOOKS[0]?.id || 'audiobook-1'],
        vibeTag: `${curBpm} BPM Crate Selection`,
        bpmShift: 'Harmonic Flow',
      };
    }

    // Hydrate full objects from mock catalog
    const recommendedTracks = ALL_AVAILABLE_TRACKS.filter((t) =>
      parsedResult.recommendedTrackIds?.includes(t.id)
    );
    const recommendedVideos = MOCK_VIDEOS.filter((v) =>
      parsedResult.recommendedVideoIds?.includes(v.id)
    );
    const recommendedAudiobooks = MOCK_AUDIOBOOKS.filter((a) =>
      parsedResult.recommendedAudiobookIds?.includes(a.id)
    );

    return NextResponse.json({
      agentName: parsedResult.agentName || 'Crate Digger Agent',
      agentRationale: parsedResult.agentRationale || 'Curated to match current tempo and break lineage.',
      vibeTag: parsedResult.vibeTag || 'Breakbeat Flow',
      bpmShift: parsedResult.bpmShift || 'Aligned',
      recommendedTracks: recommendedTracks.length > 0 ? recommendedTracks : ALL_AVAILABLE_TRACKS.slice(0, 2),
      recommendedVideos: recommendedVideos.length > 0 ? recommendedVideos : MOCK_VIDEOS.slice(0, 1),
      recommendedAudiobooks:
        recommendedAudiobooks.length > 0 ? recommendedAudiobooks : MOCK_AUDIOBOOKS.slice(0, 1),
    });
  } catch (error: any) {
    console.error('Recommendations API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate recommendations' }, { status: 500 });
  }
}
