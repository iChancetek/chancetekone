/**
 * ChanceTEK One — Tavily Cover Art Discovery Engine
 * Autonomous search and verification of high-resolution album and track artwork
 * using real-time internet search via Tavily.
 */

import { TavilySearchClient } from './tavilySearch';
import { findImageHeaderIndex, bytesToDataUrl, extractCleanImageBytes } from '../audio/id3Parser';
import { dataUrlToImageBytes } from '../audio/id3Writer';

export interface CoverArtCandidate {
  url: string;
  source: string;
  title: string;
  domain: string;
  confidenceScore: number; // 0 - 100
  dimensions?: { width: number; height: number };
  mimeType?: string;
}

export interface CoverArtSearchQuery {
  artist: string;
  album?: string;
  title?: string;
  genre?: string;
}

// Trusted music databases and high-res album artwork CDNs
const HIGH_PRIORITY_DOMAINS = [
  'discogs.com',
  'i.discogs.com',
  'scdn.co',            // Spotify CDN
  'mzstatic.com',        // Apple Music CDN
  'is1-ssl.mzstatic.com',
  'musicbrainz.org',
  'coverartarchive.org', // MusicBrainz CAA
  'bandcamp.com',
  'last.fm',
  'lastfm.freetls.fastly.net',
  'albumartexchange.com',
  'genius.com',
  'wikimedia.org',
  'wikipedia.org',
  'tidal.com',
  'allmusic.com',
];

export class TavilyCoverArtService {
  /**
   * Formulates optimized music cover search queries
   */
  public static buildSearchQueries(params: CoverArtSearchQuery): string[] {
    const cleanArtist = (params.artist || '').trim();
    const cleanAlbum = (params.album || '').trim();
    const cleanTitle = (params.title || '').trim();

    const queries: string[] = [];

    // 1. Album-specific query
    if (cleanArtist && cleanAlbum && cleanAlbum !== 'Single Release / Vault Cuts' && cleanAlbum !== 'Master Crate Vault') {
      queries.push(`"${cleanArtist}" "${cleanAlbum}" album cover art high resolution`);
      queries.push(`${cleanArtist} ${cleanAlbum} cover art 3000x3000`);
    }

    // 2. Track / Single query
    if (cleanArtist && cleanTitle) {
      queries.push(`"${cleanArtist}" "${cleanTitle}" single cover art high resolution`);
    }

    // 3. Fallback query
    if (queries.length === 0 && cleanArtist) {
      queries.push(`"${cleanArtist}" vinyl cover art album artwork`);
    }

    return queries;
  }

  /**
   * Searches the internet using Tavily to find authentic cover art for an artist, album, and track
   */
  public static async searchCoverArt(params: CoverArtSearchQuery): Promise<CoverArtCandidate[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/cover-art-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'search', ...params }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.candidates) && data.candidates.length > 0) {
            return data.candidates;
          }
        }
      } catch (clientErr) {
        console.warn('[TavilyCoverArtService] Client proxy search fallback to direct:', clientErr);
      }
    }

    const queries = this.buildSearchQueries(params);
    if (queries.length === 0) return [];

    const candidates: CoverArtCandidate[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries.slice(0, 2)) {
      try {
        const response = await TavilySearchClient.search(query, {
          searchDepth: 'advanced',
          includeImages: true,
          includeAnswer: false,
          maxResults: 8,
        });

        // 1. Process direct Tavily image results
        if (response.images && response.images.length > 0) {
          for (const imgUrl of response.images) {
            if (!imgUrl || seenUrls.has(imgUrl) || !imgUrl.startsWith('http')) continue;
            seenUrls.add(imgUrl);

            const score = this.calculateImageRelevance(imgUrl, params);
            if (score > 30) {
              const domain = this.extractDomain(imgUrl);
              candidates.push({
                url: imgUrl,
                source: domain,
                title: `${params.artist} - ${params.album || params.title || 'Cover Art'}`,
                domain,
                confidenceScore: score,
              });
            }
          }
        }

        // 2. Extract potential image URLs mentioned in web search results (e.g. Discogs / Wikimedia / Spotify)
        if (response.results && response.results.length > 0) {
          for (const res of response.results) {
            const domain = this.extractDomain(res.url);
            const content = `${res.title} ${res.content}`;

            // Check for image URLs in content
            const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]*)?/gi;
            const matches = content.match(imgRegex) || [];

            for (const match of matches) {
              if (seenUrls.has(match)) continue;
              seenUrls.add(match);
              const score = this.calculateImageRelevance(match, params, res.title);
              if (score > 40) {
                candidates.push({
                  url: match,
                  source: domain,
                  title: res.title,
                  domain,
                  confidenceScore: score,
                });
              }
            }
          }
        }

        // If we found solid candidates, no need to exhaust secondary queries
        if (candidates.length >= 3) break;
      } catch (err) {
        console.warn(`[TavilyCoverArtService] Query "${query}" error:`, err);
      }
    }

    // Sort by confidence score descending
    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
    return candidates;
  }

  /**
   * Calculates relevance score for an image candidate based on domain authority and keywords
   */
  private static calculateImageRelevance(
    url: string,
    params: CoverArtSearchQuery,
    contextTitle?: string
  ): number {
    let score = 50;
    const lowerUrl = url.toLowerCase();
    const domain = this.extractDomain(url).toLowerCase();
    const normArtist = (params.artist || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normAlbum = (params.album || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTitle = (params.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Domain authority boost
    if (HIGH_PRIORITY_DOMAINS.some((d) => domain.includes(d))) {
      score += 25;
    }

    // Keyword matches in URL
    if (normArtist && lowerUrl.includes(normArtist)) score += 15;
    if (normAlbum && lowerUrl.includes(normAlbum)) score += 15;
    if (normTitle && lowerUrl.includes(normTitle)) score += 10;

    // Image quality signals
    if (lowerUrl.includes('cover') || lowerUrl.includes('front') || lowerUrl.includes('album')) {
      score += 10;
    }
    if (lowerUrl.includes('1000x1000') || lowerUrl.includes('1200x1200') || lowerUrl.includes('3000x3000')) {
      score += 10;
    }

    // Penalties for unwanted images
    if (lowerUrl.includes('logo') || lowerUrl.includes('banner') || lowerUrl.includes('icon') || lowerUrl.includes('avatar') || lowerUrl.includes('badge')) {
      score -= 40;
    }
    if (lowerUrl.includes('sprite') || lowerUrl.includes('thumb_50') || lowerUrl.includes('50x50')) {
      score -= 35;
    }
    if (lowerUrl.includes('images.unsplash.com')) {
      score -= 30; // prefer authentic music releases over generic unsplash stock photos
    }

    // Context match boost
    if (contextTitle) {
      const lowerContext = contextTitle.toLowerCase();
      if (params.artist && lowerContext.includes(params.artist.toLowerCase())) score += 10;
      if (params.album && lowerContext.includes(params.album.toLowerCase())) score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private static extractDomain(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

  /**
   * Downloads an image from a URL, verifies its binary signature (JPEG/PNG/WebP),
   * and converts it to a standard optimized Data URL and Uint8Array buffer.
   */
  public static async fetchAndVerifyImage(
    imageUrl: string
  ): Promise<{ dataUrl: string; bytes: Uint8Array; mimeType: string }> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/ai/cover-art-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch_image', imageUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.dataUrl) {
            const decoded = dataUrlToImageBytes(data.dataUrl);
            return {
              dataUrl: data.dataUrl,
              bytes: decoded.bytes,
              mimeType: data.mimeType || decoded.mimeType,
            };
          }
        }
      } catch (proxyErr) {
        console.warn('[TavilyCoverArtService] Client proxy image fetch fallback to direct:', proxyErr);
      }
    }

    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChanceTEK One/1.0 MusicCatalog',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download image from ${imageUrl} (${res.status} ${res.statusText})`);
    }

    const arrayBuf = await res.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuf);
    if (rawBytes.length < 100) {
      throw new Error('Downloaded file is too small to be a valid cover art image.');
    }

    const header = findImageHeaderIndex(rawBytes, 0, 128);
    const mimeType = header?.mimeType || res.headers.get('content-type') || 'image/jpeg';
    const cleanBytes = header ? extractCleanImageBytes(rawBytes, header.index, mimeType) : rawBytes;
    const dataUrl = bytesToDataUrl(cleanBytes, mimeType);

    return {
      dataUrl,
      bytes: cleanBytes,
      mimeType,
    };
  }
}
