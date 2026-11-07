// ============================================================
// Radio Domain Types — ChanceTEKone Agentic AI Radio
// ============================================================

export type RadioStationId = 'hip-hop' | 'neo-soul';

export interface RadioStation {
  id: RadioStationId;
  name: string;
  tagline: string;
  description: string;
  genre: string;
  artworkUrl: string;
  accentColor: string;         // Tailwind-safe hex or CSS var
  djVoice: 'nova' | 'onyx' | 'echo' | 'shimmer' | 'alloy' | 'fable';
  isLive: boolean;
  listenerCount: number;
}

export interface RadioSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  subgenre?: string;
  year?: number;
  audioUrl: string;
  coverUrl: string;
  duration: number;            // seconds
  isExplicit: boolean;
  stations: RadioStationId[];  // which stations can play this
  isApproved: boolean;         // admin-approved for broadcast
  inRotation: boolean;         // toggled by admin
  uploadedAt: string;          // ISO 8601
  uploadedBy?: string;
  // Musical intelligence (filled by MusicIntelligenceAgent)
  bpm?: number;
  energy?: 'low' | 'medium' | 'high';
  mood?: string;
  // Agent processing state
  ingestionStatus: 'pending' | 'processing' | 'complete' | 'error';
  intelligenceStatus: 'pending' | 'processing' | 'complete' | 'error';
  // Play stats
  totalPlays: number;
  lastPlayedAt?: string;
}

export interface RadioQueueItem {
  song: RadioSong;
  djIntroScript?: string;
  djIntroAudioUrl?: string;
  hasIntro: boolean;
  scheduledAt?: string;
}

export interface RadioStationState {
  station: RadioStation;
  currentItem: RadioQueueItem | null;
  upNext: RadioQueueItem[];
  recentlyPlayed: RadioSong[];
  playbackState: 'idle' | 'dj-intro' | 'playing' | 'transitioning' | 'error';
  currentTime: number;
  currentDuration: number;
}

export interface RadioAgentState {
  name: string;
  status: 'idle' | 'running' | 'error';
  lastActivity: string;
  detail: string;
}

export interface RadioOrchestratorState {
  stations: Record<RadioStationId, RadioStationState>;
  catalog: RadioSong[];
  agents: Record<string, RadioAgentState>;
  initialized: boolean;
}

export interface RadioUploadPayload {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year?: number;
  isExplicit: boolean;
  stations: RadioStationId[];
  coverUrl?: string;
}
