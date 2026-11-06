export type MediaType = 'music' | 'video' | 'audiobook';

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  label?: string;
  albumId?: string;
  albumTitle?: string;
  audioUrl: string;
  coverUrl: string;
  duration: number; // in seconds
  genre: string;
  bpm?: number;
  releaseYear?: number;
  lyrics?: string;
  description?: string;
  playCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  featured?: boolean;
  producer?: string;
  producerId?: string;
  crateId?: string;
  crateName?: string;
  uploadedAt?: string;
  uploadedByAdminName?: string;
  uploadedByAdminId?: string;
  /** Verified album artwork (may differ from `coverUrl` when the track has distinct artwork of its own). */
  albumCoverUrl?: string;
  /** Artwork provenance — never claims authenticity that was not verified. */
  coverVerification?: 'verified' | 'needs_review' | 'missing';
  coverSource?: string;
  /** Content hash of the cover; identical covers share one stored asset. */
  coverAssetHash?: string;
  /** Ingestion traceability. */
  sourceFolderPath?: string;
  uploadBatchId?: string;
  trackNumber?: number;
  discNumber?: number;
  /**
   * Authoritative description of the stored audio object this record plays. Written ONLY from the
   * server's verified upload response (never inferred from title / artist / filename).
   */
  audioAsset?: TrackAudioAsset;
  /**
   * verified     – audio object stored, read back and checksummed by the server.
   * legacy       – pre-dates asset tracking; audioUrl is the record's own reference, unverified.
   * local_only   – audio exists only in the publishing admin's browser (not yet shareable).
   * needs_review – flagged by the integrity audit; an administrator must confirm / relink.
   */
  audioStatus?: 'verified' | 'legacy' | 'local_only' | 'needs_review';
  audioReviewNote?: string;
  customCrate?: boolean;
  customCover?: boolean;
}

export interface TrackAudioAsset {
  assetId: string;
  storagePath: string;
  storageBackend: 'firebase' | 'disk' | 'legacy';
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  /** Id of the upload item that produced this object (immutable submission id). */
  uploadId?: string;
  version: number;
  verifiedAt: string;
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  label?: string;
  coverUrl: string;
  releaseYear: number;
  genre: string;
  trackIds: string[];
  description: string;
  likeCount: number;
  playCount: number;
}

export interface Artist {
  id: string;
  name: string;
  label?: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  genres: string[];
  verified: boolean;
  followerCount: number;
  popularTrackIds: string[];
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

export interface Video {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  label?: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  description: string;
  category: string;
  releaseDate: string;
}

export interface AudiobookChapter {
  id: string;
  chapterIndex: number;
  title: string;
  duration: number;
  audioUrl: string;
  pdfUrl?: string;
}

export interface Audiobook {
  id: string;
  title: string;
  author: string;
  narrator: string;
  coverUrl: string;
  duration: number;
  genre: string;
  description: string;
  chapters: AudiobookChapter[];
  likeCount: number;
  rating: number;
  releaseYear: number;
  pdfUrl?: string;
  mediaFormat?: 'audio' | 'video' | 'pdf';
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  userId: string;
  userName: string;
  isPublic: boolean;
  items: {
    mediaId: string;
    mediaType: MediaType;
    addedAt: string;
  }[];
  createdAt: string;
}

export interface UserPlaybackProgress {
  mediaId: string;
  mediaType: MediaType;
  position: number; // seconds
  duration: number;
  completed: boolean;
  chapterId?: string;
  updatedAt: string;
}

export interface Producer {
  id: string;
  name: string;
  handle: string;
  role: string;
  label: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  gearSetup: string[];
  signatureBpmRange: string;
  favoriteBreaks: string[];
  featuredTrackIds: string[];
  projectCount: number;
  credits: string[];
  verified: boolean;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  producerId: string;
  producerName: string;
  label: string;
  presenter?: string;
  creditsLines?: string[];
  tracklistTitle?: string;
  coverUrl: string;
  bannerUrl?: string;
  releaseYear: number;
  status: 'Released' | 'Archival Vault' | 'In Production' | 'Mastering';
  genre: string;
  bpm: number;
  description: string;
  narrativeOverview: string;
  trackIds: string[];
  videoIds?: string[];
  audiobookIds?: string[];
  vinylPressing?: {
    edition: string;
    weight: string;
    available: boolean;
  };
  sampleSources: string[];
  equipmentUsed: string[];
  likeCount: number;
  shareCount: number;
  websiteUrl?: string;
  isAdvertisement?: boolean;
  adText?: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  showTitle: string;
  host: string;
  description: string;
  mediaUrl: string; // .mp3 or .mp4
  mediaType: 'audio' | 'video';
  coverUrl: string;
  duration: number; // in seconds
  releaseDate: string;
  category: string;
  playCount: number;
  likeCount: number;
}

