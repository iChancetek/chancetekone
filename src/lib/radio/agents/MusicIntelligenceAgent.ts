// ============================================================
// Agent 2: Music Intelligence Agent
// Analyzes musical characteristics to enhance programming decisions.
// ============================================================

import { RadioSong, RadioStationId } from '@/types/radio';

interface IntelligenceResult {
  bpm: number;
  energy: 'low' | 'medium' | 'high';
  mood: string;
  subgenre: string;
  stationCompatibility: Record<RadioStationId, number>;  // 0-100 score
}

// Genre/subgenre keyword maps for station compatibility scoring
const HIP_HOP_KEYWORDS = [
  'hip-hop', 'hip hop', 'boom bap', 'rap', 'breaks', 'breakbeat', 'electro', 'trap',
  'drill', 'conscious', 'underground', 'east coast', 'west coast', 'jazz rap',
];
const NEO_SOUL_KEYWORDS = [
  'neo soul', 'neo-soul', 'soul', 'r&b', 'rnb', 'funk', 'smooth', 'jazz',
  'blues', 'ambient r&b', 'contemporary', 'gospel influenced',
];

export class MusicIntelligenceAgent {
  /**
   * Analyzes a RadioSong and returns musical intelligence data.
   * In production this could call the AI API for deeper analysis;
   * here it uses heuristic classification from existing metadata.
   */
  static analyze(song: RadioSong): IntelligenceResult {
    const genreLower = (song.genre + ' ' + (song.subgenre || '')).toLowerCase();

    const bpm = song.bpm ?? this.estimateBpm(genreLower);
    const energy = song.energy ?? this.estimateEnergy(bpm, genreLower);
    const mood = song.mood ?? this.classifyMood(genreLower, energy);
    const subgenre = song.subgenre ?? this.classifySubgenre(genreLower);

    const hipHopScore = this.compatibilityScore(genreLower, HIP_HOP_KEYWORDS);
    const neoSoulScore = this.compatibilityScore(genreLower, NEO_SOUL_KEYWORDS);

    return {
      bpm,
      energy,
      mood,
      subgenre,
      stationCompatibility: {
        'hip-hop': hipHopScore,
        'neo-soul': neoSoulScore,
      },
    };
  }

  static enrichSong(song: RadioSong): RadioSong {
    const result = this.analyze(song);
    return {
      ...song,
      bpm: song.bpm ?? result.bpm,
      energy: song.energy ?? result.energy,
      mood: song.mood ?? result.mood,
      subgenre: song.subgenre ?? result.subgenre,
      intelligenceStatus: 'complete',
    };
  }

  private static estimateBpm(genre: string): number {
    if (/trap|drill/.test(genre)) return Math.floor(Math.random() * 20) + 130;
    if (/boom bap|classic hip/.test(genre)) return Math.floor(Math.random() * 20) + 85;
    if (/neo.soul|smooth/.test(genre)) return Math.floor(Math.random() * 20) + 70;
    if (/funk/.test(genre)) return Math.floor(Math.random() * 20) + 100;
    if (/jazz/.test(genre)) return Math.floor(Math.random() * 30) + 80;
    return Math.floor(Math.random() * 40) + 80;
  }

  private static estimateEnergy(bpm: number, genre: string): 'low' | 'medium' | 'high' {
    if (/ambient|slow|quiet/.test(genre) || bpm < 75) return 'low';
    if (bpm >= 120) return 'high';
    return 'medium';
  }

  private static classifyMood(genre: string, energy: 'low' | 'medium' | 'high'): string {
    if (/trap|drill/.test(genre)) return 'aggressive, hard, street';
    if (/boom bap/.test(genre)) return 'raw, gritty, lyrical';
    if (/ambient/.test(genre)) return 'atmospheric, meditative, late night';
    if (/neo.soul|smooth/.test(genre) && energy === 'low') return 'warm, tender, introspective';
    if (/funk/.test(genre)) return 'groovy, funky, upbeat';
    if (energy === 'high') return 'energetic, confident, bold';
    return 'soulful, melodic, expressive';
  }

  private static classifySubgenre(genre: string): string {
    if (/boom bap/.test(genre)) return 'Boom Bap';
    if (/trap/.test(genre)) return 'Trap';
    if (/drill/.test(genre)) return 'Drill';
    if (/electro break/.test(genre)) return 'Electro Breaks';
    if (/jazz rap/.test(genre)) return 'Jazz Rap';
    if (/neo.soul/.test(genre)) return 'Neo Soul';
    if (/ambient r.b/.test(genre)) return 'Ambient R&B';
    if (/funk/.test(genre)) return 'Funk Soul';
    return 'Contemporary';
  }

  private static compatibilityScore(genre: string, keywords: string[]): number {
    let score = 0;
    for (const kw of keywords) {
      if (genre.includes(kw)) score += 30;
    }
    return Math.min(100, score);
  }
}
