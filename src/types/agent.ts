import { Track, Artist, Video, Audiobook, Project, Producer } from './media';
import { Product } from './commerce';
import { Playlist } from './playlist';
import { ShortTermMemory, LongTermMemory, MemoryFact, TasteProfile } from './memory';

export interface PlaybackVerificationCandidate {
  kind: 'track' | 'playlist';
  id: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  coverColor?: string;
  bpm?: number;
  genre?: string;
  duration?: number;
  itemCount?: number;
  track?: Track;
  playlist?: Playlist;
  previewTracks?: { title: string; artistName: string }[];
}

export interface PlaybackVerificationState {
  status: 'pending' | 'confirmed' | 'cancelled';
  requestedQuery: string;
  candidates: PlaybackVerificationCandidate[];
  selectedId: string;
  confirmedMode?: 'play' | 'djchancemix';
}

export interface AvailablePlaylistSummary {
  id: string;
  name: string;
  description?: string;
  ownerName?: string;
  itemCount: number;
  coverUrl?: string;
  coverColor?: string;
  trackTitles?: string[];
}

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
    playlists?: Playlist[];
    artists?: Artist[];
    videos?: Video[];
    audiobooks?: Audiobook[];
    products?: Product[];
    projects?: Project[];
    producers?: Producer[];
  };
  playbackVerification?: PlaybackVerificationState;
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
  availablePlaylists?: AvailablePlaylistSummary[];
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
