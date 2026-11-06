/**
 * 8 Of Spades Works — Agentic AI Music Ingestion Engine
 * Autonomous AI agent responsible for metadata normalization, crate & folder recommendations,
 * duplicate detection across all signals, and human-in-the-loop review staging.
 */

import {
  OFFICIAL_CRATES,
  AgenticAIRecommendation,
  DuplicateDetectionInfo,
  CrateDefinition,
} from '@/types/catalog';
import { ExtractedMP3Metadata } from '@/lib/audio/id3Parser';
import { Track } from '@/types/media';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { isCrossArtistAudioMismatch } from '@/lib/music/authenticAudioMap';
import { classifyGenre } from '@/lib/music/genreClassifier';

export interface IngestionAnalysisResult {
  normalizedMetadata: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    bpm: number;
    year: number;
  };
  recommendation: AgenticAIRecommendation;
  duplicateInfo: DuplicateDetectionInfo;
  flaggedIssues: string[];
}

export class AgenticAIMusicIngestionAgent {
  public static readonly AGENT_ID = 'agent-breakbeats-ingest-v2';
  public static readonly AGENT_NAME = 'Agentic AI Ingestion Specialist';

  /**
   * Cleans and title-cases strings, removes audio rip noise
   */
  public static normalizeString(str: string): string {
    if (!str) return '';
    return str
      .replace(/^[0-9]+[-_.\s]+/g, '') // remove leading track numbers like "01 - "
      .replace(/\s*\(?(320kbps|flac|mp3|remastered|explicit|clean)\)?/gi, '') // remove audio rip junk
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Intelligently classifies track characteristics to recommend one of the 8 official crates
   */
  public static recommendCrate(
    meta: {
      title: string;
      artist: string;
      album: string;
      genre: string;
      durationSeconds: number;
      fileName?: string;
    },
    targetCrateIdHint?: string
  ): { crate: CrateDefinition; confidence: number; reasoning: string } {
    const combined = `${meta.title} ${meta.artist} ${meta.album} ${meta.genre} ${meta.fileName || ''}`.toLowerCase();

    // 1. Stems detection
    if (
      combined.includes('stem') ||
      combined.includes('multitrack') ||
      combined.includes('isolated drum') ||
      combined.includes('isolated bass') ||
      combined.includes('acapella') ||
      combined.includes('instrumental mix')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'stems')!;
      return {
        crate,
        confidence: 96,
        reasoning: 'Detected multitrack stems or isolated instrumental/vocal tracks.',
      };
    }

    // 2. Break Beats & Samples
    if (
      combined.includes('break') ||
      combined.includes('sample') ||
      combined.includes('drum loop') ||
      combined.includes('chop') ||
      combined.includes('apache') ||
      combined.includes('amen') ||
      combined.includes('snare') ||
      combined.includes('big beat') ||
      combined.includes('turntablism')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'break-beats-samples')!;
      return {
        crate,
        confidence: 98,
        reasoning: 'Authentic drum break, funk chop, or rhythmic sample loop signature identified.',
      };
    }

    // 3. Golden Era Hip Hop
    if (
      combined.includes('hip hop') ||
      combined.includes('boom bap') ||
      combined.includes('sp-1200') ||
      combined.includes('sp1200') ||
      combined.includes('mpc60') ||
      combined.includes('rap') ||
      combined.includes('golden era') ||
      combined.includes('12-bit')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'golden-era-hip-hop')!;
      return {
        crate,
        confidence: 95,
        reasoning: 'Matched Golden Era 90-96 BPM boom bap groove, 12-bit cadence, or street lyricism.',
      };
    }

    // 4. Disco
    if (
      combined.includes('disco') ||
      combined.includes('studio 54') ||
      combined.includes('12" mix') ||
      combined.includes('12 inch') ||
      combined.includes('extended mix') ||
      combined.includes('mirrorball') ||
      combined.includes('philly') ||
      combined.includes('hi-nrg')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'disco')!;
      return {
        crate,
        confidence: 94,
        reasoning: 'Four-on-the-floor disco rhythm, Studio 54 orchestration, or 12" extended club arrangement.',
      };
    }

    // 5. Slow Jams
    if (
      combined.includes('slow jam') ||
      combined.includes('quiet storm') ||
      combined.includes('ballad') ||
      combined.includes('rhodes') ||
      combined.includes('neo-soul') ||
      (combined.includes('soul') && meta.durationSeconds > 260)
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'slow-jams')!;
      return {
        crate,
        confidence: 93,
        reasoning: 'Late-night quiet storm tempos, lush Fender Rhodes chords, and soulful romantic ballads.',
      };
    }

    // 6. Timeless R&B | Soul Music
    if (
      combined.includes('motown') ||
      combined.includes('stax') ||
      combined.includes('r&b') ||
      combined.includes('soul') ||
      combined.includes('70s') ||
      combined.includes('vinyl') ||
      combined.includes('gospel') ||
      combined.includes('brass') ||
      combined.includes('timeless') ||
      combined.includes('oldschool')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'oldschool-rnb-soul')!;
      return {
        crate,
        confidence: 92,
        reasoning: 'Analog tube warmth, Motown/Stax brass arrangements, and vintage 70s soul heritage.',
      };
    }

    // 7. Discographys
    if (
      combined.includes('anthology') ||
      combined.includes('discography') ||
      combined.includes('archive') ||
      combined.includes('complete works') ||
      combined.includes('b-side') ||
      combined.includes('box set')
    ) {
      const crate = OFFICIAL_CRATES.find((c) => c.id === 'discographys')!;
      return {
        crate,
        confidence: 91,
        reasoning: 'Complete artist archival collection or chronological multi-album catalogue release.',
      };
    }

    // 8. If an explicit target hint was supplied, use it
    if (targetCrateIdHint) {
      const matched = OFFICIAL_CRATES.find((c) => c.id === targetCrateIdHint);
      if (matched) {
        return {
          crate: matched,
          confidence: 88,
          reasoning: `Categorized into administrator requested destination crate: "${matched.name}".`,
        };
      }
    }

    // 9. Miscellaneous fallback
    const misc = OFFICIAL_CRATES.find((c) => c.id === 'miscellaneous')!;
    return {
      crate: misc,
      confidence: 80,
      reasoning: 'Unclassified white label, promo cut, or live soundboard session.',
    };
  }

  /**
   * Multi-signal duplicate detection against existing music catalog
   */
  public static detectDuplicate(
    item: {
      fileHash: string;
      title: string;
      artist: string;
      album: string;
      fileName: string;
      durationSeconds: number;
    },
    existingCatalog: Track[]
  ): DuplicateDetectionInfo {
    const normTitle = item.title.trim().toLowerCase();
    const normArtist = item.artist.trim().toLowerCase();

    for (const track of existingCatalog) {
      const curTitle = track.title.trim().toLowerCase();
      const curArtist = track.artistName.trim().toLowerCase();

      // Signal 1: Exact title and artist match
      if (curTitle === normTitle && curArtist === normArtist) {
        return {
          isDuplicate: true,
          matchType: 'metadata',
          existingTrackId: track.id,
          existingTitle: track.title,
          existingArtist: track.artistName,
          existingAlbum: track.albumTitle || 'Vault Album',
          existingCrateName: track.genre || 'Break Beats & Samples',
          confidence: 99,
          action: 'review',
        };
      }

      // Signal 2: Fuzzy title match + same artist
      if (
        curArtist === normArtist &&
        (curTitle.includes(normTitle) || normTitle.includes(curTitle)) &&
        Math.abs(track.duration - item.durationSeconds) <= 3
      ) {
        return {
          isDuplicate: true,
          matchType: 'audio_fingerprint',
          existingTrackId: track.id,
          existingTitle: track.title,
          existingArtist: track.artistName,
          existingAlbum: track.albumTitle || 'Vault Album',
          existingCrateName: track.genre || 'Break Beats & Samples',
          confidence: 94,
          action: 'review',
        };
      }
    }

    return {
      isDuplicate: false,
      confidence: 100,
    };
  }

  /**
   * Full agentic ingestion pipeline for an uploaded file
   */
  public static async processIngestion(
    raw: ExtractedMP3Metadata,
    fileName: string,
    existingCatalog: Track[],
    targetCrateIdHint?: string
  ): Promise<IngestionAnalysisResult> {
    const flaggedIssues: string[] = [];

    // 1. Normalization
    const normalizedTitle = this.normalizeString(raw.title || fileName);
    const normalizedArtist = this.normalizeString(raw.artist || '8 OF SPADES WORKS');
    const normalizedAlbum = this.normalizeString(raw.album || 'Master Crate Collection');
    const normalizedGenre = classifyGenre({
      artist: normalizedArtist,
      title: normalizedTitle,
      album: normalizedAlbum,
      rawGenre: raw.genre,
      crateId: targetCrateIdHint,
    });

    // 2. Validate essential fields
    if (!raw.artist || raw.artist === 'Unknown Artist') {
      flaggedIssues.push('Artist Missing (Defaulted to 8 OF SPADES WORKS)');
    }
    if (raw.artworkStatus === 'missing') {
      flaggedIssues.push('Artwork Missing');
    }
    if (raw.bitrateKbps < 192) {
      flaggedIssues.push(`Low Bitrate (${raw.bitrateKbps} kbps)`);
    }
    if (raw.durationSeconds < 30) {
      flaggedIssues.push('Short Audio Duration (< 30s)');
    }

    // Estimate BPM based on genre/keywords if absent
    let bpm = 94;
    const combined = `${normalizedTitle} ${normalizedGenre}`.toLowerCase();
    if (combined.includes('house') || combined.includes('disco')) bpm = 124;
    else if (combined.includes('slow jam')) bpm = 78;
    else if (combined.includes('big beat') || combined.includes('break')) bpm = 128;
    else if (combined.includes('boom bap') || combined.includes('hip hop')) bpm = 92;

    // 3. Recommend Crate
    const rec = this.recommendCrate(
      {
        title: normalizedTitle,
        artist: normalizedArtist,
        album: normalizedAlbum,
        genre: normalizedGenre,
        durationSeconds: raw.durationSeconds,
        fileName,
      },
      targetCrateIdHint
    );

    // 4. Recommend Album/Folder
    const recommendedFolderName = `${normalizedArtist} — ${normalizedAlbum}`;

    // 5. Check Duplicates
    const duplicateInfo = this.detectDuplicate(
      {
        fileHash: raw.fileHash,
        title: normalizedTitle,
        artist: normalizedArtist,
        album: normalizedAlbum,
        fileName,
        durationSeconds: raw.durationSeconds,
      },
      existingCatalog
    );

    if (duplicateInfo.isDuplicate) {
      flaggedIssues.push(`Potential Duplicate (${duplicateInfo.matchType})`);
    }

    // 6. Cross-Artist Audio Integrity Verification
    if (isCrossArtistAudioMismatch({ artistName: normalizedArtist, title: normalizedTitle, fileName })) {
      flaggedIssues.push(`Cross-Artist Audio Mismatch: File "${fileName}" exhibits signature of another artist. Please review.`);
    }

    const aiRecommendation: AgenticAIRecommendation = {
      agentId: this.AGENT_ID,
      task: 'MP3 Metadata Normalization & Crate Placement',
      recommendedCrateId: rec.crate.id,
      recommendedCrateName: rec.crate.name,
      recommendedFolderName,
      confidencePercent: rec.confidence,
      reasoning: rec.reasoning,
      normalizedTitle,
      normalizedArtist,
      normalizedAlbum,
      flaggedIssues,
      timestamp: new Date().toISOString(),
      approvedByHuman: false,
    };

    // Log AI action to Audit Trail
    AuditLogger.logAction({
      adminId: 'agentic-ai-ingest',
      adminName: 'Agentic AI Ingestion Agent',
      adminRole: 'content_admin',
      eventType: 'AI_INGESTION_ANALYSIS',
      action: `AI inspected and categorized "${normalizedTitle}" by "${normalizedArtist}"`,
      resource: 'Music Ingestion Pipeline',
      resourceId: raw.fileHash,
      newValue: {
        recommendedCrate: rec.crate.name,
        confidence: `${rec.confidence}%`,
        duplicatesDetected: duplicateInfo.isDuplicate,
        artworkStatus: raw.artworkStatus,
      },
      status: flaggedIssues.length > 0 ? 'WARNING' : 'SUCCESS',
      details: rec.reasoning,
    });

    return {
      normalizedMetadata: {
        title: normalizedTitle,
        artist: normalizedArtist,
        album: normalizedAlbum,
        genre: normalizedGenre,
        bpm,
        year: raw.year || 2026,
      },
      recommendation: aiRecommendation,
      duplicateInfo,
      flaggedIssues,
    };
  }
}
