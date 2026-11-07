/**
 * ChanceTEK One — Creator Content Submission & Moderation Data Models
 * Defines types for creator uploads, category metadata, review holding area,
 * human-in-the-loop decisions, and transactional email notifications.
 */

export type SubmissionCategory =
  | 'music'
  | 'beats'
  | 'album'
  | 'video'
  | 'audiobook'
  | 'podcast'
  | 'book'
  | 'manuscript'
  | 'script'
  | 'artwork'
  | 'painting';

export type SubmissionStatus =
  | 'draft'
  | 'uploading'
  | 'processing'
  | 'pending_review'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'publishing'
  | 'published'
  | 'publication_failed'
  | 'withdrawn';

export type MediaFormat = 'audio' | 'video' | 'pdf' | 'document' | 'image';

export type EmailDeliveryStatus = 'idle' | 'queued' | 'sending' | 'sent' | 'failed' | 'retrying';

export interface CreatorSubmission {
  submissionId: string;
  creatorUserId: string;
  creatorEmailSnapshot: string;
  creatorDisplayNameSnapshot: string;

  // Metadata
  title: string;
  category: SubmissionCategory;
  subtype?: string;
  creatorOrArtistName: string;
  description: string;
  genre: string;
  releaseDate?: string;
  copyrightDeclaration: boolean;
  copyrightNotice?: string;
  credits?: string;
  collaborators?: string;

  // Media & Storage
  originalStoragePath: string; // URL or path to media file
  previewStoragePath?: string; // Transcoded/preview path if applicable
  coverUrl: string; // Empty string if "No Cover Art" selected
  fileName: string;
  fileSize: number;
  detectedMimeType: string;
  mediaFormat: MediaFormat;
  durationSeconds?: number;

  // Workflow & Moderation
  moderationStatus: SubmissionStatus;
  publicationStatus: 'unpublished' | 'publishing' | 'published' | 'publication_failed';
  publishedCatalogId?: string;
  publishedCatalogType?: 'track' | 'album' | 'video' | 'audiobook' | 'podcast' | 'document';

  // Timestamps & Audit
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  publishedAt?: string;

  // Decision & Feedback
  rejectionReason?: string; // Mandatory non-empty when rejected
  changesRequestedNotes?: string;
  internalAdminNotes?: string; // Kept private from creator

  version: number;

  // Email Notification Tracking
  emailNotificationStatus: EmailDeliveryStatus;
  emailNotificationId?: string;
  lastEmailSentAt?: string;
  lastEmailError?: string;
}

export interface ReviewRecord {
  reviewId: string;
  submissionId: string;
  submissionVersion: number;
  administratorUserId: string;
  administratorEmail: string;
  decision: 'approved' | 'rejected' | 'changes_requested';
  creatorFacingReason?: string;
  internalNotes?: string;
  reviewedAt: string;
}

export interface NotificationRecord {
  notificationId: string;
  eventId: string;
  submissionId: string;
  creatorUserId: string;
  recipientEmail: string;
  creatorName: string;
  contentTitle: string;
  contentCategory: string;
  notificationType: 'approval' | 'rejection';
  subject: string;
  bodyHtml: string;
  bodyText: string;
  rejectionReason?: string;
  publishedUrl?: string;
  deliveryStatus: EmailDeliveryStatus;
  attemptCount: number;
  queuedAt: string;
  sentAt?: string;
  lastErrorCode?: string;
  lastError?: string;
}

export const SUBMISSION_CATEGORIES: {
  id: SubmissionCategory;
  label: string;
  description: string;
  supportedFormats: string[];
  acceptedExtensions: string;
  mediaFormat: MediaFormat;
}[] = [
  {
    id: 'music',
    label: 'Music Single & Audio',
    description: 'Master studio singles, original recordings, and high-fidelity audio tracks.',
    supportedFormats: ['MP3', 'WAV', 'AAC'],
    acceptedExtensions: '.mp3, .wav, .aac, audio/mpeg, audio/wav, audio/x-wav, audio/aac',
    mediaFormat: 'audio',
  },
  {
    id: 'beats',
    label: 'Beats & Instrumentals',
    description: 'Producer beats, instrumental stems, loop packages, and beat tapes.',
    supportedFormats: ['MP3', 'WAV'],
    acceptedExtensions: '.mp3, .wav, audio/mpeg, audio/wav, audio/x-wav',
    mediaFormat: 'audio',
  },
  {
    id: 'album',
    label: 'Album & EP Project',
    description: 'Multi-track studio albums, EPs, or audio bundles.',
    supportedFormats: ['MP3', 'WAV'],
    acceptedExtensions: '.mp3, .wav, audio/mpeg, audio/wav',
    mediaFormat: 'audio',
  },
  {
    id: 'video',
    label: 'Video & Film (MP4 / MOV)',
    description: 'High-definition 4K video, cinema releases, music videos, and documentaries.',
    supportedFormats: ['MP4', 'MOV'],
    acceptedExtensions: '.mp4, .mov, .MOV, video/mp4, video/quicktime',
    mediaFormat: 'video',
  },
  {
    id: 'audiobook',
    label: 'Audiobook & Narrative',
    description: 'Spoken word literature, author readings, and multimedia book series.',
    supportedFormats: ['MP3', 'MP4', 'MOV', 'PDF'],
    acceptedExtensions: '.mp3, .mp4, .mov, .pdf, audio/mpeg, video/mp4, video/quicktime, application/pdf',
    mediaFormat: 'audio',
  },
  {
    id: 'podcast',
    label: 'Podcast & Show Episodes',
    description: 'Audio and video talk show broadcasts, cultural interviews, and series.',
    supportedFormats: ['MP3', 'MP4', 'MOV'],
    acceptedExtensions: '.mp3, .mp4, .mov, audio/mpeg, video/mp4, video/quicktime',
    mediaFormat: 'audio',
  },
  {
    id: 'book',
    label: 'Book & Digital Literature',
    description: 'Published books, eBooks, and digital literature formatted for reading.',
    supportedFormats: ['PDF', 'EPUB', 'DOCX'],
    acceptedExtensions: '.pdf, .epub, .docx, application/pdf, application/epub+zip, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mediaFormat: 'pdf',
  },
  {
    id: 'manuscript',
    label: 'Manuscript & Book Draft',
    description: 'Literary manuscripts, book drafts, and author review submissions.',
    supportedFormats: ['PDF', 'DOCX', 'EPUB'],
    acceptedExtensions: '.pdf, .docx, .epub, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mediaFormat: 'document',
  },
  {
    id: 'script',
    label: 'Screenplay & Drama Script',
    description: 'Cinema screenplays, episodic television scripts, and theatrical stage plays.',
    supportedFormats: ['PDF', 'DOCX'],
    acceptedExtensions: '.pdf, .docx, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mediaFormat: 'document',
  },
  {
    id: 'artwork',
    label: 'Visual Artwork & Design',
    description: 'Graphic design, digital illustrations, album covers, and portfolio media.',
    supportedFormats: ['JPEG', 'PNG', 'WEBP'],
    acceptedExtensions: '.jpg, .jpeg, .png, .webp, image/jpeg, image/png, image/webp',
    mediaFormat: 'image',
  },
  {
    id: 'painting',
    label: 'Fine Art & Paintings',
    description: 'Original canvas paintings, digital fine art, and visual masterworks.',
    supportedFormats: ['JPEG', 'PNG'],
    acceptedExtensions: '.jpg, .jpeg, .png, image/jpeg, image/png',
    mediaFormat: 'image',
  },
];
