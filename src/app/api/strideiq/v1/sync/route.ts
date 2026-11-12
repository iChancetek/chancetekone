import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import {
  queryStrideIqTracks,
  queryStrideIqAudiobooks,
  queryStrideIqPodcasts,
} from '@/lib/server/strideiqCatalog';
import { OFFICIAL_CRATES } from '@/types/catalog';
import {
  getCatalogRevision,
  invalidateCatalogSnapshotCache,
} from '@/lib/server/catalogStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

async function handleSyncRequest(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    // Invalidate snapshot cache to force instant evaluation of server storage and Firestore
    invalidateCatalogSnapshotCache();

    // 1. Resolve all music tracks (up to 1,000)
    const tracksResult = await queryStrideIqTracks({
      publicOrigin,
      limit: 1000,
    });

    // 2. Resolve all chaptered audiobooks
    const audiobooksResult = await queryStrideIqAudiobooks({
      publicOrigin,
      limit: 1000,
    });
    const audiobooks = audiobooksResult.audiobooks;

    // 3. Resolve all podcasts
    const podcastsResult = await queryStrideIqPodcasts({
      publicOrigin,
      limit: 1000,
    });
    const podcasts = podcastsResult.podcasts;

    // 4. Resolve official crates
    const crates = OFFICIAL_CRATES.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      trackCount: tracksResult.tracks.filter(
        (t) => t.crateId === c.id || t.crateName.toLowerCase().includes(c.name.toLowerCase())
      ).length,
    }));

    const revision = await getCatalogRevision();
    const totalChapters = audiobooks.reduce((acc, b) => acc + (b.chapters?.length || 0), 0);

    const counts = {
      totalMusicTracks: tracksResult.total,
      totalAudiobooks: audiobooks.length,
      totalAudiobookChapters: totalChapters,
      totalPodcasts: podcasts.length,
      totalCrates: crates.length,
    };

    const syncedAt = new Date().toISOString();

    return {
      ok: true,
      syncMode: 'live',
      syncedAt,
      revision,
      counts,
      // Top-level arrays for direct array access
      tracks: tracksResult.tracks,
      audiobooks,
      podcasts,
      crates,
      // Nested container for structured callers
      catalog: {
        tracks: tracksResult.tracks,
        audiobooks,
        podcasts,
        crates,
      },
    };
  });
}

export async function GET(request: NextRequest) {
  return handleSyncRequest(request);
}

export async function POST(request: NextRequest) {
  return handleSyncRequest(request);
}
