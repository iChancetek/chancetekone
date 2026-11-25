import { NextRequest, NextResponse } from 'next/server';
import {
  findAuthoritativeTrack,
  normalizeExternalCoverOrigin,
} from '@/lib/server/shareTrackLookup';
import { readCatalogDocById } from '@/lib/server/catalogStore';
import { MOCK_AUDIOBOOKS, MOCK_VIDEOS } from '@/lib/mockData';
import { SEED_PODCASTS } from '@/lib/media/seedMediaData';

export const dynamic = 'force-dynamic';

const SOURCE_PUBLIC_ORIGIN = (
  process.env.EIGHT_OF_SPADES_PUBLIC_URL || 'https://8ofspadesworks.us'
).replace(/\/+$/, '');

function normalizeMediaUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(trimmed)) {
    return trimmed.replace(
      /^https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(:\d+)?/i,
      SOURCE_PUBLIC_ORIGIN
    );
  }
  return trimmed;
}

/**
 * GET /api/share/item?type=song&id=...
 * Fast O(1) single-item resolver so recipients clicking shared links from Facebook,
 * Messenger, SMS, WhatsApp, or Famio.us immediately load the exact song/audiobook/podcast/video
 * even before the full catalog finishes hydrating in the browser.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = (sp.get('type') || 'song').toLowerCase();
    const rawId = sp.get('id') || '';
    if (!rawId) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    let id = rawId;
    try {
      id = decodeURIComponent(rawId);
    } catch {}

    if (type === 'audiobook' || type === 'book') {
      const item =
        (await readCatalogDocById('audiobooks', id)) ||
        MOCK_AUDIOBOOKS.find((a) => a.id === id) ||
        null;
      if (!item) return NextResponse.json({ ok: false, item: null }, { status: 404 });
      return NextResponse.json(
        {
          ok: true,
          item: {
            ...item,
            coverUrl: normalizeExternalCoverOrigin((item as any).coverUrl) || (item as any).coverUrl,
          },
        },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
      );
    }

    if (type === 'podcast') {
      const item =
        (await readCatalogDocById('podcasts', id)) ||
        SEED_PODCASTS.find((p) => p.id === id) ||
        null;
      if (!item) return NextResponse.json({ ok: false, item: null }, { status: 404 });
      return NextResponse.json(
        {
          ok: true,
          item: {
            ...item,
            coverUrl: normalizeExternalCoverOrigin((item as any).coverUrl) || (item as any).coverUrl,
            audioUrl: normalizeMediaUrl((item as any).audioUrl) || (item as any).audioUrl,
          },
        },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
      );
    }

    if (type === 'video') {
      const item =
        (await readCatalogDocById('videos', id)) ||
        MOCK_VIDEOS.find((v) => v.id === id) ||
        null;
      if (!item) return NextResponse.json({ ok: false, item: null }, { status: 404 });
      return NextResponse.json(
        {
          ok: true,
          item: {
            ...item,
            thumbnailUrl:
              normalizeExternalCoverOrigin((item as any).thumbnailUrl) || (item as any).thumbnailUrl,
            videoUrl: normalizeMediaUrl((item as any).videoUrl) || (item as any).videoUrl,
          },
        },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
      );
    }

    // Default: song / track
    const { track, albumCover } = await findAuthoritativeTrack(id);
    if (!track) {
      return NextResponse.json({ ok: false, item: null }, { status: 404 });
    }

    const coverUrl =
      normalizeExternalCoverOrigin(track.coverUrl) ||
      normalizeExternalCoverOrigin(albumCover) ||
      track.coverUrl;
    const audioUrl = normalizeMediaUrl(track.audioUrl) || track.audioUrl;

    return NextResponse.json(
      {
        ok: true,
        item: {
          ...track,
          coverUrl,
          audioUrl,
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('[api/share/item] GET error:', err);
    return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 });
  }
}

