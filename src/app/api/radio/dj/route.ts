// ============================================================
// Radio DJ API Route — /api/radio/dj
// Generates AI DJ intro scripts and converts them to speech via TTS.
// Only called server-side by the RadioOrchestrator.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';
import { AIDjAgent } from '@/lib/radio/agents/AIDjAgent';
import { RADIO_STATIONS, RADIO_INITIAL_CATALOG } from '@/lib/radio/initialCatalog';

// ── Server-side Rate Limiter ───────────────────────────────────
// In-memory counters reset every hour. Prevents runaway TTS costs
// if the client-side loop guard ever fails (defense in depth).
const MAX_PER_STATION_PER_HOUR = 12;  // welcome + bumps + occasional song intros
const MAX_TOTAL_PER_HOUR = 30;        // hard ceiling across both stations combined

const rateLimitState = {
  counts: {} as Record<string, number>, // stationId → count this window
  totalCount: 0,
  windowStart: Date.now(),
};

function checkRateLimit(stationId: string): boolean {
  const now = Date.now();
  // Reset window every hour
  if (now - rateLimitState.windowStart > 60 * 60 * 1000) {
    rateLimitState.counts = {};
    rateLimitState.totalCount = 0;
    rateLimitState.windowStart = now;
  }

  if (rateLimitState.totalCount >= MAX_TOTAL_PER_HOUR) return false;
  if ((rateLimitState.counts[stationId] ?? 0) >= MAX_PER_STATION_PER_HOUR) return false;

  rateLimitState.counts[stationId] = (rateLimitState.counts[stationId] ?? 0) + 1;
  rateLimitState.totalCount += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { stationId, script, upcomingSongId, previousSongId } = await req.json();

    if (!stationId) {
      return NextResponse.json({ error: 'stationId is required' }, { status: 400 });
    }

    const station = RADIO_STATIONS.find((s) => s.id === stationId);
    if (!station) {
      return NextResponse.json({ error: 'Unknown station' }, { status: 400 });
    }

    // ── Rate limit check ──────────────────────────────────────
    // If over budget, skip TTS gracefully — music plays without an intro.
    if (!checkRateLimit(stationId)) {
      console.warn(`[Radio DJ API] Rate limit reached for station "${stationId}" — skipping TTS.`);
      return NextResponse.json({ audioUrl: null, script: script || '' });
    }

    // Use pre-built script if provided, otherwise generate via AI
    let finalScript = script;
    if (!finalScript) {
      const upcoming = RADIO_INITIAL_CATALOG.find((s) => s.id === upcomingSongId);
      const previous = previousSongId
        ? RADIO_INITIAL_CATALOG.find((s) => s.id === previousSongId) ?? null
        : null;

      if (upcoming) {
        // Try AI-generated commentary first
        try {
          const openai = getOpenAIClient();
          const { system, user } = AIDjAgent.buildAIPrompt(station, upcoming, previous ?? null);
          const completion = await openai.chat.completions.create({
            model: AI_CONFIG.defaultModel,
            max_completion_tokens: 100,
            temperature: 0.9,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          });
          finalScript = completion.choices[0]?.message?.content?.trim() ?? '';
        } catch (aiError) {
          console.warn('[Radio DJ API] AI generation failed, using heuristic script:', aiError);
          const result = AIDjAgent.generateIntroScript(station, upcoming, previous ?? null, true);
          finalScript = result.script;
        }
      }
    }

    if (!finalScript) {
      return NextResponse.json({ audioUrl: null, script: '' });
    }

    // Convert script to speech — cap input length to minimise TTS token cost
    const openai = getOpenAIClient();
    const mp3 = await openai.audio.speech.create({
      model: AI_CONFIG.ttsModel,
      voice: station.djVoice,
      input: finalScript.slice(0, 200), // hard cap: 200 chars max per intro
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return NextResponse.json({ audioUrl, script: finalScript });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'DJ route error';
    console.error('[Radio DJ API] Error:', msg);
    // Graceful degradation: return null audio so music continues uninterrupted
    return NextResponse.json({ audioUrl: null, script: '', error: msg });
  }
}
