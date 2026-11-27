import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';
import {
  emitWyresTraceAsync,
  generateWyresId,
  tracedOpenAIChatCompletion,
  tracedOpenAITts,
} from '@/lib/telemetry/wyres';

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
  const chainRunId = generateWyresId('wyr_voice');
  const traceId = chainRunId;
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();

  try {
    const { text, voice, language } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    // Rate limit check
    if (!checkTtsLimit()) {
      console.warn('[TTS] Rate limit reached — skipping synthesis.');
      emitWyresTraceAsync({
        id: chainRunId,
        traceId,
        name: 'voice-copilot:tts',
        runType: 'chain',
        provider: 'openai',
        model: AI_CONFIG.ttsModel,
        category: 'voice_ai',
        feature: 'voice-tts',
        status: 'error',
        startTime,
        endTime: new Date().toISOString(),
        latencyMs: Date.now() - startedMs,
        error: 'TTS rate limit reached (429)',
        tags: ['voice-copilot', 'tts', 'rate-limited'],
      });
      return NextResponse.json({ error: 'TTS rate limit reached. Try again later.' }, { status: 429 });
    }

    const openai = getOpenAIClient();
    // Cap at 500 chars max (was 2000) — reduces per-call cost by 75%
    let spokenText = text.slice(0, 500);

    // If Spanish language is explicitly requested, translate if not already in Spanish
    if (language === 'es') {
      try {
        const translation = await tracedOpenAIChatCompletion(
          openai,
          {
            model: AI_CONFIG.defaultModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are a professional translator for ChanceTEK One. Translate the following text into fluent, natural, calm Spanish for audio narration. Keep all proper nouns like ChanceTEK One, ChanceTEK One AI, and SP-1200 intact. Return only the Spanish translation.',
              },
              {
                role: 'user',
                content: spokenText,
              },
            ],
          },
          {
            name: 'voice-copilot:translate-es',
            feature: 'voice-tts',
            category: 'voice_ai',
            traceId,
            parentRunId: chainRunId,
            tags: ['translation', 'es'],
          }
        );
        const translatedContent = translation.choices[0]?.message?.content;
        if (translatedContent) {
          spokenText = translatedContent.slice(0, 2000);
        }
      } catch (transErr) {
        console.warn('Spanish TTS translation fallback to raw text:', transErr);
      }
    }

    const buffer = await tracedOpenAITts(
      openai,
      {
        model: AI_CONFIG.ttsModel,
        voice: voice || 'nova', // Default to Nova calm voice
        input: spokenText,
      },
      {
        name: 'voice-copilot:speech-synthesis',
        feature: 'voice-tts',
        traceId,
        parentRunId: chainRunId,
        language: language || 'en',
        tags: ['voice-copilot', 'narration'],
      }
    );

    emitWyresTraceAsync({
      id: chainRunId,
      traceId,
      name: 'voice-copilot:tts',
      runType: 'chain',
      provider: 'openai',
      model: AI_CONFIG.ttsModel,
      category: 'voice_ai',
      feature: 'voice-tts',
      startTime,
      endTime: new Date().toISOString(),
      latencyMs: Date.now() - startedMs,
      input: { voice: voice || 'nova', language: language || 'en', inputChars: spokenText.length },
      output: { audioBytes: buffer.length },
      tags: ['voice-copilot', 'tts'],
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('OpenAI TTS error:', error);
    emitWyresTraceAsync({
      id: chainRunId,
      traceId,
      name: 'voice-copilot:tts',
      runType: 'chain',
      provider: 'openai',
      model: AI_CONFIG.ttsModel,
      category: 'voice_ai',
      feature: 'voice-tts',
      status: 'error',
      startTime,
      endTime: new Date().toISOString(),
      latencyMs: Date.now() - startedMs,
      error: error?.message || 'TTS failed',
      tags: ['voice-copilot', 'tts', 'error'],
    });
    return NextResponse.json({ error: error.message || 'TTS failed' }, { status: 500 });
  }
}
