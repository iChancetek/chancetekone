// ============================================================
// Agent 4: AI DJ Agent
// On-air personality generating station-appropriate introductions.
// Music is the primary experience — DJ speaks selectively.
// ============================================================

import { RadioSong, RadioStationId, RadioStation } from '@/types/radio';

const DJ_SPEAK_PROBABILITY = 0.10; // ~1 in 10 songs gets a DJ intro (cost control)
const MAX_INTRO_LENGTH = 200;      // characters — shorter scripts = lower TTS cost
// Station ID bump every N songs (0-indexed count: fires at 3, 6, 9, …)
export const STATION_ID_EVERY_N_SONGS = 3;

const STATION_PERSONALITIES: Record<RadioStationId, string> = {
  'hip-hop': `You are the AI DJ for Hip Hop Radio on ChanceTEK One. Your voice is authentic, knowledgeable, and energetic. You know hip-hop culture deeply — boom bap, breakbeats, the golden era, and the underground scene. Keep intros concise, sharp, and never corny. You may mention the station name, artist, album, or a relevant cultural note. Never speak more than 2-3 sentences.`,
  'neo-soul': `You are the AI DJ for Neo Soul Radio on ChanceTEK One. Your voice is smooth, warm, and soulful. You understand neo soul, R&B, funk, and jazz influences. Keep intros brief, elegant, and intimate. You may mention the station name, artist, album, or an emotional note about the music. Never speak more than 2-3 sentences.`,
};

const STATION_ID_LINES: Record<RadioStationId, string[]> = {
  'hip-hop': [
    `You're locked in to Hip Hop Radio on ChanceTEK One.`,
    `Hip Hop Radio — ChanceTEK One. We keep it authentic.`,
    `This is Hip Hop Radio, powered by ChanceTEK One. Real beats. Real culture.`,
  ],
  'neo-soul': [
    `You're riding with Neo Soul Radio on ChanceTEK One.`,
    `Neo Soul Radio — soulful vibrations, courtesy of ChanceTEK One.`,
    `This is Neo Soul Radio on ChanceTEK One. Let the groove take you.`,
  ],
};

/**
 * Spoken when the listener first presses Tune In — guaranteed to play.
 * Index 0 is the canonical greeting used every time (consistent brand voice).
 * Additional entries are kept for potential future A/B testing only.
 */
const WELCOME_SCRIPTS: Record<RadioStationId, string> = {
  'hip-hop': `Welcome to the ChanceTEK One Hip Hop AI Radio Station.`,
  'neo-soul': `Welcome to the ChanceTEK One Neo Soul AI Radio Station.`,
};

/** Periodic station ID bumps played every few songs so listeners always know where they are. */
const STATION_BUMP_LINES: Record<RadioStationId, string[]> = {
  'hip-hop': [
    `You are listening to ChanceTEK One AI Radio — Hip Hop all day.`,
    `Still here with you — this is ChanceTEK One Hip Hop Radio.`,
    `ChanceTEK One AI Radio, keeping the culture alive.`,
  ],
  'neo-soul': [
    `You are listening to ChanceTEK One AI Radio — Neo Soul for the soul.`,
    `Still vibing with you — this is ChanceTEK One Neo Soul Radio.`,
    `ChanceTEK One AI Radio. The soul never stops.`,
  ],
};

export interface DJIntroResult {
  shouldSpeak: boolean;
  script: string;
  stationType: RadioStationId;
}

export class AIDjAgent {
  /**
   * Decides whether to generate a DJ intro for the upcoming track.
   * Generates a contextual script using the OpenAI TTS pipeline.
   */
  static generateIntroScript(
    station: RadioStation,
    upcomingSong: RadioSong,
    previousSong: RadioSong | null,
    forceIntro = false
  ): DJIntroResult {
    const shouldSpeak = forceIntro || Math.random() < DJ_SPEAK_PROBABILITY;

    if (!shouldSpeak) {
      return { shouldSpeak: false, script: '', stationType: station.id };
    }

    const idLine = this.randomFrom(STATION_ID_LINES[station.id]);
    const nextLine = `Up next, ${upcomingSong.artist} with "${upcomingSong.title}"${upcomingSong.album ? ` from "${upcomingSong.album}"` : ''}.`;
    const script = `${idLine} ${nextLine}`.slice(0, MAX_INTRO_LENGTH);

    return { shouldSpeak: true, script, stationType: station.id };
  }

  /**
   * Builds the system + user prompt for AI-enhanced DJ commentary via OpenAI.
   * Used by the /api/radio/dj route when AI generation is available.
   */
  static buildAIPrompt(
    station: RadioStation,
    upcomingSong: RadioSong,
    previousSong: RadioSong | null
  ): { system: string; user: string } {
    const system = STATION_PERSONALITIES[station.id];
    const user = [
      `Station: ${station.name}`,
      `Upcoming song: "${upcomingSong.title}" by ${upcomingSong.artist} (${upcomingSong.album || 'single'})`,
      `Genre: ${upcomingSong.genre}${upcomingSong.subgenre ? ' / ' + upcomingSong.subgenre : ''}`,
      previousSong
        ? `Previous song: "${previousSong.title}" by ${previousSong.artist}`
        : null,
      `BPM: ${upcomingSong.bpm ?? 'unknown'}, Energy: ${upcomingSong.energy ?? 'unknown'}, Mood: ${upcomingSong.mood ?? 'unknown'}`,
      `Write a brief, natural-sounding DJ intro (2-3 sentences max). Do NOT use hashtags, emojis, or lists. Return only the spoken text.`,
    ]
      .filter(Boolean)
      .join('\n');

    return { system, user };
  }

  /**
   * Generates the canonical welcome greeting for when a listener first tunes in.
   * Always returns the exact station-specific phrase — no randomization.
   * Hip Hop → "Welcome to the ChanceTEK One Hip Hop Station."
   * Neo Soul → "Welcome to the ChanceTEK One Neo Soul Station."
   */
  static generateWelcomeScript(station: RadioStation): DJIntroResult {
    const script = WELCOME_SCRIPTS[station.id];
    return { shouldSpeak: true, script, stationType: station.id };
  }

  /**
   * Generates a periodic station ID bump to remind listeners where they are.
   * Called by the orchestrator every STATION_ID_EVERY_N_SONGS songs.
   */
  static generateStationBump(station: RadioStation): DJIntroResult {
    const script = this.randomFrom(STATION_BUMP_LINES[station.id]);
    return { shouldSpeak: true, script, stationType: station.id };
  }

  private static randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
