import { MediaType } from './media';

export type UniversalContentType =
  | MediaType
  | 'music'
  | 'song'
  | 'track'
  | 'video'
  | 'audiobook'
  | 'podcast'
  | 'book'
  | 'merch'
  | 'playlist'
  | 'artist'
  | 'producer'
  | 'album'
  | 'project'
  | 'station'
  | string;

export type CommentEmojiReaction =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'thumbs_up_dark'
  | 'thumbs_down_dark'
  | 'heart'
  | 'fire'
  | 'clap'
  | 'clap_dark'
  | 'hundred';

export interface CommentReactionCounts {
  thumbs_up: number;
  thumbs_down: number;
  thumbs_up_dark?: number;
  thumbs_down_dark?: number;
  heart: number;
  fire: number;
  clap: number;
  clap_dark?: number;
  hundred: number;
}

export interface Comment {
  id: string;
  contentId: string;
  contentKey?: string; // Canonical identifier (e.g., song:sailing:::avant) so comments follow content everywhere
  contentType: UniversalContentType;
  contentTitle?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userHandle?: string;
  userAvatar?: string;
  userRole?: 'user' | 'creator' | 'admin' | string;
  creatorType?: 'artist' | 'producer' | 'creator' | 'streamer' | string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  parentCommentId?: string | null;
  likeCount: number;
  dislikeCount?: number;
  replyCount: number;
  replies?: Comment[];
  reactions?: CommentReactionCounts;
  userReactions?: Record<string, CommentEmojiReaction[]>;
  isPinned?: boolean;
}

export interface Reaction {
  id: string; // `${userId}_${contentId}`
  userId: string;
  contentId: string;
  contentType: UniversalContentType;
  type: 'like' | 'dislike';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'user' | 'creator' | 'admin';
  creatorType?: 'artist' | 'producer' | 'creator' | 'streamer';
  agreementStatus?: 'none' | 'submitted' | 'under_review' | 'verified_active' | 'denied';
  agreementId?: string;
  createdAt: string;
  bio?: string;
  likedTrackIds: string[];
  likedVideoIds: string[];
  likedAudiobookIds: string[];
  savedArtistIds: string[];
  playlistIds: string[];
}
