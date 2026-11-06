import { Track, Artist, Video, Audiobook, Project, Producer } from './media';
import { Product } from './commerce';
import { ShortTermMemory, LongTermMemory, MemoryFact, TasteProfile } from './memory';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: {
    toolName: string;
    args: Record<string, any>;
    status: 'executing' | 'completed' | 'failed';
    result?: any;
  }[];
  mediaRecommendations?: {
    tracks?: Track[];
    artists?: Artist[];
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
  audioUrl?: string; // If TTS voice synthesis is enabled
}

export interface AgentContextPayload {
  currentPath?: string;
  currentTrackId?: string;
  currentTrackTitle?: string;
  currentArtistName?: string;
  currentBpm?: number;
  currentGenre?: string;
  currentArtistId?: string;
  currentVideoId?: string;
  currentAudiobookId?: string;
  userId?: string;
  userName?: string;
  language?: 'en' | 'es';
  shortTermMemory?: ShortTermMemory;
  longTermMemory?: LongTermMemory;
}

export interface SearchIntentResult {
  query: string;
  category?: 'music' | 'video' | 'audiobook' | 'artist' | 'album' | 'merch' | 'all';
  filters?: {
    genre?: string;
    mood?: string;
    tempo?: string;
    era?: string;
  };
}
