import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';

// ── Rate Limiter ─────────────────────────────────────────────
// 20 TTS calls per hour, across all users (server-wide).
// Prevents a single session from running up hundreds of narration calls.
const MAX_TTS_PER_HOUR = 20;
const ttsRateLimit = { count: 0, windowStart: Date.now() };
function checkTtsLimit(): boolean {
  const now = Date.now();
  if (now - ttsRateLimit.windowStart > 60 * 60 * 1000) {
    ttsRateLimit.count = 0;
    ttsRateLimit.windowStart = now;
  }
  if (ttsRateLimit.count >= MAX_TTS_PER_HOUR) return false;
  ttsRateLimit.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice, language } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    // Rate limit check
    if (!checkTtsLimit()) {
      console.warn('[TTS] Rate limit reached — skipping synthesis.');
      return NextResponse.json({ error: 'TTS rate limit reached. Try again later.' }, { status: 429 });
    }

    const openai = getOpenAIClient();
    // Cap at 500 chars max (was 2000) — reduces per-call cost by 75%
    let spokenText = text.slice(0, 500);

    // If Spanish language is explicitly requested, translate if not already in Spanish
    if (language === 'es') {
      try {
        const translation = await openai.chat.completions.create({
          model: AI_CONFIG.defaultModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator for Return of the Break Beats. Translate the following text into fluent, natural, calm Spanish for audio narration. Keep all proper nouns like ChanceTEK One, Break Beats AI, and SP-1200 intact. Return only the Spanish translation.',
            },
            {
              role: 'user',
              content: spokenText,
            },
          ],
        });
        const translatedContent = translation.choices[0]?.message?.content;
        if (translatedContent) {
          spokenText = translatedContent.slice(0, 2000);
        }
      } catch (transErr) {
        console.warn('Spanish TTS translation fallback to raw text:', transErr);
      }
    }

    const mp3 = await openai.audio.speech.create({
      model: AI_CONFIG.ttsModel,
      voice: voice || 'nova', // Default to Nova calm voice
      input: spokenText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('OpenAI TTS error:', error);
    return NextResponse.json({ error: error.message || 'TTS failed' }, { status: 500 });
  }
}
