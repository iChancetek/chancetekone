import { MediaType, Track, Video, Audiobook, AudiobookChapter } from './media';

export type PlaylistType = 'music' | 'video' | 'audiobook' | 'mixed';
export type PlaylistVisibility = 'public' | 'private' | 'unlisted';

export interface PlaylistItem {
  id: string; // Unique item instance in playlist
  playlistId: string;
  mediaId: string;
  mediaType: MediaType;
  title: string;
  artistName: string;
  coverUrl: string;
  duration: number; // in seconds
  position: number; // 0-indexed order
  addedAt: string;
  audioUrl?: string;
  videoUrl?: string;
  chapterIndex?: number;
  bpm?: number;
  genre?: string;
}

export interface PlaylistStats {
  plays: number;
  saves: number;
  likes: number;
  shares: number;
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl?: string;
  ownerEmail?: string;
  name: string;
  description?: string;
  type: PlaylistType;
  visibility: PlaylistVisibility;
  coverUrl: string;
  items: PlaylistItem[];
  itemCount: number;
  totalDuration: number; // in seconds
  createdAt: string;
  updatedAt: string;
  stats: PlaylistStats;
  sharedWith?: string[];
  isFeatured?: boolean;
  isDeleted?: boolean;
}

export interface PlaylistSave {
  userId: string;
  playlistId: string;
  savedAt: string;
}

export interface PlaylistFilter {
  type?: 'all' | PlaylistType;
  visibility?: 'all' | PlaylistVisibility;
  searchQuery?: string;
  sortBy?: 'recent' | 'popular' | 'tracks' | 'name';
}
