import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, AI_CONFIG } from '@/lib/openai/config';

// ── Rate Limiter ─────────────────────────────────────────────
// 15 sample breakdown analyses per hour (server-wide).
const MAX_BREAKDOWN_PER_HOUR = 15;
const breakdownRateLimit = { count: 0, windowStart: Date.now() };
function checkBreakdownLimit(): boolean {
  const now = Date.now();
  if (now - breakdownRateLimit.windowStart > 60 * 60 * 1000) {
    breakdownRateLimit.count = 0;
    breakdownRateLimit.windowStart = now;
  }
  if (breakdownRateLimit.count >= MAX_BREAKDOWN_PER_HOUR) return false;
  breakdownRateLimit.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { trackTitle, artistName, genre, bpm } = await req.json();

    if (!trackTitle) {
      return NextResponse.json({ error: 'trackTitle is required' }, { status: 400 });
    }

    // Rate limit check
    if (!checkBreakdownLimit()) {
      console.warn('[Sample Breakdown] Rate limit reached — returning 429.');
      return NextResponse.json({ error: 'Rate limit reached. Try again later.' }, { status: 429 });
    }

    const openai = getOpenAIClient();

    const systemPrompt = `You are the Master Sample Detective & Break Genealogist Agent for 'Return of the Break Beats'.
You possess exhaustive, world-class knowledge of 1960s/70s funk & soul drum breaks, vintage sampler hardware (E-mu SP-1200, Akai MPC60, Ensoniq ASR-10, Akai S950), chopping techniques, and the cultural lineage of hip-hop and breakbeat sampling.

Given a track title, artist, genre, and BPM, you must analyze its drum breaks and return a structured JSON genealogy:
{
  "breakName": "e.g. Amen Break / Funky Drummer / Impeach The President / Skull Snaps",
  "originalMaster": {
    "title": "e.g. Amen, Brother",
    "artist": "e.g. The Winstons",
    "drummer": "e.g. Gregory C. Coleman",
    "releaseYear": 1969,
    "label": "e.g. Metromedia Records",
    "originalBpm": 136,
    "breakTimestamp": "01:26"
  },
  "samplerLore": {
    "machineName": "E-mu SP-1200",
    "bitDepth": "12-bit / 26.04 kHz Linear PCM",
    "tuningTechnique": "Sampled from 33⅓ RPM vinyl pitched up +8 on Technics 1200, recorded into SP-1200 to conserve sample memory (2.5s per pad), then pitched back down internally for signature ringing filter grit.",
    "sonicSignature": "Punchy analog low-pass filtering with raw 12-bit transient crunch and natural swing."
  },
  "famousFlips": [
    {
      "songTitle": "Straight Outta Compton",
      "artist": "N.W.A",
      "year": 1988,
      "producer": "Dr. Dre & DJ Yella"
    },
    {
      "songTitle": "Charly",
      "artist": "The Prodigy",
      "year": 1991,
      "producer": "Liam Howlett"
    },
    {
      "songTitle": "I Keep Forgettin'",
      "artist": "Warren G & Nate Dogg",
      "year": 1994,
      "producer": "Warren G"
    }
  ],
  "culturalStory": "A captivating, 2-3 paragraph breakdown of how this drum break was discovered in dusty thrift shop crates, who first popularized it in the Bronx park jams, and how it evolved into the sonic backbone of golden era breakbeats and UK jungle.",
  "djMixingTip": "Practical DJ technique advice on EQ cuts (e.g. high-pass at 80Hz, boost 2.5kHz snap) and harmonic tempo blending in a live set."
}

Output STRICT JSON matching this schema only.`;

    const userPrompt = `Analyze the drum break lineage and sampler genealogy for:
- Track: ${trackTitle}
- Artist: ${artistName || 'Unknown Artist'}
- Genre: ${genre || 'Breakbeat'}
- BPM: ${bpm || 120}

Provide the complete break genealogy in strict JSON format now.`;

    const model = AI_CONFIG.defaultModel;
    const isGpt5 = model.toLowerCase().startsWith('gpt-5');

    const completionParams: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1500,
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
      console.warn('Sample Detective fallback triggered:', aiErr.message);
      parsedResult = {
        breakName: 'Amen & Funky Drummer Hybrid Crate',
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
          tuningTechnique: 'Sampled at +8 pitch from vinyl to save memory, tuned down in the SP-1200 for 12-bit drum saturation and aliasing bite.',
          sonicSignature: '12-bit warmth, punchy transients, and authentic syncopated drum swing.',
        },
        famousFlips: [
          { songTitle: 'Straight Outta Compton', artist: 'N.W.A', year: 1988, producer: 'Dr. Dre' },
          { songTitle: 'King of the Beats', artist: 'Mantronix', year: 1988, producer: 'Kurtis Mantronik' },
          { songTitle: 'Charly', artist: 'The Prodigy', year: 1991, producer: 'Liam Howlett' },
        ],
        culturalStory: `${trackTitle} builds upon the foundational golden-era breakbeat lineage. Originally recorded in 1969, this syncopated four-bar drum solo was rediscovered in the late 1970s by Kool Herc and Grandmaster Flash in the South Bronx, who extended the groove using two turntables.\n\nDuring the late 1980s, samplers like the E-mu SP-1200 allowed producers to chop each kick, snare, and open hat across the pads, creating new rhythmic permutations that defined both boom bap hip-hop and the early 90s UK breakbeat rave revolution.`,
        djMixingTip: 'Roll off frequencies below 50Hz to leave room for the sub-bass, and boost 3.2kHz slightly to accentuate the snare crack during live harmonic transitions.',
      };
    }

    return NextResponse.json(parsedResult);
  } catch (error: any) {
    console.error('Sample Detective error:', error);
    return NextResponse.json({ error: error.message || 'Sample breakdown failed' }, { status: 500 });
  }
}
