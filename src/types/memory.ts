export interface TasteProfile {
  favoriteGenres: string[];
  bpmSweetSpot: {
    min: number;
    max: number;
    preferred?: number;
  };
  eraPreferences: string[];
  favoriteArtists: string[];
  gearInterests: string[];
  vibeTags: string[];
}

export interface MemoryFact {
  id: string;
  fact: string;
  category: 'preference' | 'bio' | 'equipment' | 'general';
  timestamp: string;
  source?: 'user_stated' | 'agent_inferred';
}

export interface ShortTermMemory {
  sessionId: string;
  activePath?: string;
  activeTrackId?: string;
  activeTrackTitle?: string;
  activeArtistName?: string;
  activeBpm?: number;
  activeGenre?: string;
  activeVideoId?: string;
  activeAudiobookId?: string;
  sessionWorkingNotes: string[];
  recentQueries: string[];
  lastInteractionTime: string;
}

export interface LongTermMemory {
  userId: string;
  userName?: string;
  tasteProfile: TasteProfile;
  explicitFacts: MemoryFact[];
  historicalSummary?: string;
  totalInteractions: number;
  lastUpdated: string;
}
