export interface CrateDefinition {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  badge: string;
  iconName: string;
  accentColor: string;
  bpmRange: string;
  description: string;
  totalTracks: number;
  totalAlbums: number;
  totalFolders: number;
  artworkUrl: string;
}

export const OFFICIAL_CRATES: CrateDefinition[] = [
  {
    id: 'slow-jams',
    name: 'Slow Jams',
    slug: 'slow-jams',
    subtitle: 'Late-Night Quiet Storm, 80s & 90s Soul',
    badge: 'VIP Master',
    iconName: 'Flame',
    accentColor: '#f43f5e',
    bpmRange: '68 - 92 BPM',
    description: 'Sensual late-night quiet storm, 80s & 90s electric piano soul, and deep-pocket basslines for midnight sessions.',
    totalTracks: 148,
    totalAlbums: 12,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'disco',
    name: 'Disco',
    slug: 'disco',
    subtitle: 'Studio 54 Classics & 12" Extended Mixes',
    badge: 'Club Vault',
    iconName: 'Sparkles',
    accentColor: '#ec4899',
    bpmRange: '115 - 128 BPM',
    description: 'Glittering Studio 54 mirrorball anthems, 12" extended test pressings, Philadelphia International strings, and disco-funk grooves.',
    totalTracks: 176,
    totalAlbums: 14,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'oldschool-rnb-soul',
    name: 'Timeless R&B | Soul Music',
    slug: 'oldschool-rnb-soul',
    subtitle: 'Motown, Stax & Rare 70s Crate Vinyl',
    badge: 'Analog Reel',
    iconName: 'Disc3',
    accentColor: '#eab308',
    bpmRange: '82 - 118 BPM',
    description: 'Motown, Stax, Muscle Shoals, and obscure 1970s deep crate vinyl pressed with analog tube warmth and gospel-rooted melodies.',
    totalTracks: 210,
    totalAlbums: 18,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'golden-era-hip-hop',
    name: 'Golden Era Hip Hop',
    slug: 'golden-era-hip-hop',
    subtitle: '90-96 BPM Boom Bap & SP-1200 Heat',
    badge: '12-Bit Vintage',
    iconName: 'Crown',
    accentColor: '#a855f7',
    bpmRange: '90 - 96 BPM',
    description: 'Classic 12-bit SP-1200 drum chops, grit-soaked boom bap snares, vinyl crackle, and raw East Coast street poetry.',
    totalTracks: 245,
    totalAlbums: 20,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'break-beats-samples',
    name: 'Break Beats & Samples',
    slug: 'break-beats-samples',
    subtitle: 'Open Drum Solos, Chops & Funk Loops',
    badge: 'Rare Breaks',
    iconName: 'Disc',
    accentColor: '#3b82f6',
    bpmRange: '92 - 136 BPM',
    description: 'Isolated open drum solos, syncopated funk breaks, Apache mastercuts, and raw sampler fodder straight from the original acetates.',
    totalTracks: 312,
    totalAlbums: 26,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'discographys',
    name: 'Discographys',
    slug: 'discographys',
    subtitle: 'Full Artist Archives & Unreleased B-Sides',
    badge: 'Complete Vault',
    iconName: 'Layers',
    accentColor: '#06b6d4',
    bpmRange: 'Various BPM',
    description: 'Unabridged artist catalog collections, chronologically organized studio discographies, white label B-sides, and rare EP releases.',
    totalTracks: 188,
    totalAlbums: 16,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'stems',
    name: 'Stems',
    slug: 'stems',
    subtitle: 'Isolated Multitracks: Drums, Bass, Vocals',
    badge: 'Studio Stems',
    iconName: 'Sliders',
    accentColor: '#10b981',
    bpmRange: '80 - 140 BPM',
    description: 'Lossless studio multitracks decomposed into pristine isolated stem stems: Drums, Bass, Instruments, Vocals, and FX for producers and remixers.',
    totalTracks: 134,
    totalAlbums: 11,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'miscellaneous',
    name: 'Miscellaneous',
    slug: 'miscellaneous',
    subtitle: 'White Labels, Promos & Soundboard Sessions',
    badge: 'Exclusive Archive',
    iconName: 'Radio',
    accentColor: '#f97316',
    bpmRange: 'Various BPM',
    description: 'Underground white label dubplates, secret soundboard recordings, radio station promos, DJ scratch acetates, and audio oddities.',
    totalTracks: 112,
    totalAlbums: 9,
    totalFolders: 0,
    artworkUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
  },
];

export const DIRECT_MUSIC_CRATE: CrateDefinition = {
  id: 'direct-music-library',
  name: 'Direct Music Library',
  slug: 'direct-music-library',
  subtitle: 'General Music Catalog (All Genres)',
  badge: 'Direct Upload',
  iconName: 'Music',
  accentColor: '#8b5cf6',
  bpmRange: 'All Tempos',
  description: 'Uncategorized general music catalogue available platform-wide across all searches, playlists, and recommendations without crate restrictions.',
  totalTracks: 0,
  totalAlbums: 0,
  totalFolders: 0,
  artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
};

export interface CrateFolder {
  id: string;
  crateId: string;
  name: string;
  artistName: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'ai_analyzing'
  | 'ready_for_review'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'paused'
  | 'error';

export interface UploadBatch {
  id: string;
  name: string;
  crateId: string;
  crateName?: string;
  folderId?: string;
  folderName?: string;
  destinationType?: 'crate' | 'artist' | 'producer';
  artistId?: string;
  artistName?: string;
  producerId?: string;
  producerName?: string;
  createdAt: string;
  updatedAt: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  pendingFiles: number;
  processingFiles: number;
  needsApprovalFiles: number;
  approvedFiles: number;
  totalSizeBytes: number;
  status: BatchStatus;
  actorId: string;
  actorEmail: string;
  error?: string;
  /** Multi-folder ingestion summary (spec §2). */
  folderCount?: number;
  nestedFolderCount?: number;
  unsupportedFiles?: number;
  /** Selected folders beyond the 300-per-batch limit (reported, never silently dropped). */
  rejectedFolders?: string[];
  albumCount?: number;
  artworkNeedsReviewCount?: number;
  albumsNeedingReviewCount?: number;
}

export type UploadFolderStatus = 'scanned' | 'partial' | 'empty' | 'error';

/** Folder-level record so administrators can see which folders failed and retry them. */
export interface UploadFolderRecord {
  id: string;
  batchId: string;
  path: string;
  rootFolder: string;
  depth: number;
  status: UploadFolderStatus;
  audioCount: number;
  totalAudioCount: number;
  nestedFolderCount: number;
  unsupportedCount: number;
  errors: string[];
  processedFiles: number;
  failedFiles: number;
}

export type AlbumGroupReviewStatus = 'confirmed' | 'probable' | 'needs_review' | 'unresolved';
export type ArtworkVerificationState = 'verified' | 'needs_review' | 'missing';

export interface UploadItemArtworkVerification {
  status: ArtworkVerificationState;
  source: string;
  reason: string;
  recommendation: string;
  assetHash?: string;
  distinctFromAlbum?: boolean;
  /** Set when an administrator explicitly resolved/accepted the artwork state. */
  resolvedBy?: string;
  resolvedAt?: string;
}

/** Persisted album grouping proposed by the Agentic AI (one per detected album). */
export interface UploadAlbumGroupRecord {
  id: string;
  batchId: string;
  title: string;
  albumArtist: string;
  isCompilation: boolean;
  trackIds: string[];
  discCount: number;
  confidence: number;
  status: 'confirmed' | 'probable' | 'needs_review';
  flags: string[];
  sourceFolders: string[];
  existingAlbumId?: string;
  artworkUrl?: string;
  artworkVerification?: UploadItemArtworkVerification;
  /** True once an administrator confirmed the grouping. */
  humanConfirmed?: boolean;
}

export type UploadItemStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'metadata_extracted'
  | 'ai_analyzed'
  | 'needs_approval'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'publishing'
  | 'published'
  | 'failed';

export type DuplicateAction = 'skip' | 'replace' | 'keep_both' | 'review';

export interface DuplicateDetectionInfo {
  isDuplicate: boolean;
  matchType?: 'checksum' | 'metadata' | 'filename' | 'audio_fingerprint';
  existingTrackId?: string;
  existingTitle?: string;
  existingArtist?: string;
  existingCrateId?: string;
  existingCrateName?: string;
  existingAlbum?: string;
  confidence: number;
  action?: DuplicateAction;
}

export interface AgenticAIRecommendation {
  agentId: string;
  task: string;
  recommendedCrateId: string;
  recommendedCrateName: string;
  recommendedFolderName: string;
  confidencePercent: number; // 0 - 100
  reasoning: string;
  normalizedTitle: string;
  normalizedArtist: string;
  normalizedAlbum: string;
  flaggedIssues: string[]; // e.g., 'Artwork Missing', 'Missing BPM', 'Low Bitrate'
  timestamp: string;
  approvedByHuman?: boolean;
}

export interface UploadItem {
  id: string;
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  fileHash: string; // SHA-256 Checksum
  mimeType: string;

  // Metadata extracted from MP3
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  producer?: string;
  copyright?: string;
  publisher?: string;
  isrc?: string;
  durationSeconds: number;
  bitrateKbps: number;
  sampleRateHz: number;
  format: string; // e.g. 'MP3 (MPEG Audio Layer 3)'
  
  // Artwork
  hasEmbeddedArtwork: boolean;
  artworkStatus: 'extracted' | 'missing' | 'custom_uploaded';
  coverUrl?: string; // Data URL or storage URL

  // Placement
  crateId: string;
  crateName: string;
  folderId?: string;
  folderName?: string;
  artistId?: string;
  producerId?: string;

  // Lifecycle & Processing
  uploadStatus: UploadItemStatus;
  progressPercent: number;
  aiRecommendation?: AgenticAIRecommendation;
  duplicateInfo?: DuplicateDetectionInfo;
  error?: string;
  
  // Audio playback preview
  previewAudioUrl?: string;
  /** Server-verified description of the stored audio object produced by THIS item's upload. */
  audioAsset?: {
    assetId: string;
    storagePath: string;
    storageBackend: 'firebase' | 'disk' | 'legacy';
    sha256: string;
    sizeBytes: number;
    mimeType: string;
    uploadId?: string;
    version: number;
    verifiedAt: string;
  };

  // Catalog linking
  publishedTrackId?: string;

  // Multi-folder traceability (spec §2)
  /** Stable id from the folder scanner (relative path + size + mtime). Drives idempotent resume. */
  scanFileId?: string;
  /** Path relative to the dropped/selected root, e.g. `Music Collection/Michael Jackson/Thriller/03 Thriller.mp3` */
  relativePath?: string;
  sourceFolderPath?: string;
  sourceRootFolder?: string;

  // Album identification (spec §3)
  albumGroupId?: string;
  albumGroupConfidence?: number;
  albumGroupStatus?: AlbumGroupReviewStatus;
  albumReviewFlags?: string[];
  /** Folder-derived hint — never applied automatically. */
  suggestedAlbum?: string;

  // Artwork verification (spec §4)
  artworkVerification?: UploadItemArtworkVerification;
  /** Verified album artwork; the track may keep distinct artwork in `coverUrl`. */
  albumCoverUrl?: string;
  artworkOrigin?: 'embedded' | 'companion' | 'manual' | 'unknown';
  /** Content hash; identical covers share one stored asset. */
  artworkAssetHash?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CrateAnalyticsRecord {
  crateId: string;
  crateName: string;
  totalPlays: number;
  uniqueListeners: number;
  completionRate: number;
  skips: number;
  repeatPlays: number;
  memberListeningHours: number;
  trend: 'up' | 'down' | 'neutral';
  trendPercent: number;
}
