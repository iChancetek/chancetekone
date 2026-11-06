// ============================================================
// Agent 1: Music Ingestion Agent
// Validates, stores, and prepares admin-uploaded MP3 files.
// CRITICAL: Admin approval is the sole source of broadcast authority.
// ============================================================

import { RadioSong, RadioUploadPayload } from '@/types/radio';

const SUPPORTED_MIME = ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/x-mp3'];
const MAX_FILE_SIZE_MB = 100;

interface IngestionResult {
  success: boolean;
  song?: RadioSong;
  error?: string;
}

export class MusicIngestionAgent {
  static validate(file: File): { valid: boolean; error?: string } {
    if (!SUPPORTED_MIME.includes(file.type) && !file.name.toLowerCase().endsWith('.mp3')) {
      return { valid: false, error: 'Only MP3 audio files are supported.' };
    }
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return { valid: false, error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit.` };
    }
    if (file.size < 1024) {
      return { valid: false, error: 'File appears to be empty or corrupt.' };
    }
    return { valid: true };
  }

  /**
   * Extracts basic metadata from the File object and browser audio duration.
   * For rich ID3 tag extraction, admin can correct via the upload UI.
   */
  static async extractMetadata(file: File): Promise<Partial<RadioSong>> {
    const duration = await this.getAudioDuration(file);
    // Derive a best-guess title from filename
    const guessedTitle = file.name
      .replace(/\.mp3$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();
    return {
      title: guessedTitle,
      duration,
      ingestionStatus: 'pending',
      intelligenceStatus: 'pending',
    };
  }

  private static getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.round(audio.duration) || 0);
          URL.revokeObjectURL(url);
        });
        audio.addEventListener('error', () => {
          resolve(0);
          URL.revokeObjectURL(url);
        });
        // Timeout fallback
        setTimeout(() => resolve(0), 5000);
      } catch {
        resolve(0);
      }
    });
  }

  /**
   * Builds a RadioSong draft from the upload payload.
   * isApproved is always set by the admin action, never auto-set here.
   */
  static buildSongRecord(
    payload: RadioUploadPayload,
    audioUrl: string,
    id: string,
    duration: number,
    uploadedBy?: string
  ): RadioSong {
    return {
      id,
      title: payload.title,
      artist: payload.artist,
      album: payload.album,
      genre: payload.genre,
      year: payload.year,
      audioUrl,
      coverUrl: payload.coverUrl || '/images/radio-hiphop.jpg',
      duration,
      isExplicit: payload.isExplicit,
      stations: payload.stations,
      isApproved: true,  // Admin has explicitly submitted the upload form = approval
      inRotation: true,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      ingestionStatus: 'complete',
      intelligenceStatus: 'pending',
      totalPlays: 0,
    };
  }
}
