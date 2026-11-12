import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { PLATFORM_CANONICAL_TRACKS } from '@/lib/music/canonicalCatalogData';
import { OFFICIAL_CRATES } from '@/types/catalog';
import {
  resolveServerAudiobooks,
  resolveServerPodcasts,
  resolveServerCatalog,
} from '@/lib/server/strideiqCatalog';
import {
  applyCatalogOps,
  getCatalogRevision,
  invalidateCatalogSnapshotCache,
} from '@/lib/server/catalogStore';
import { CatalogOp } from '@/lib/catalog/cloudShared';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    invalidateCatalogSnapshotCache();

    // 1. Gather all active tracks across canonical releases and server uploads
    const resolvedTracks = await resolveServerCatalog({ includeUnplayable: false });
    const ops: CatalogOp[] = [];

    // Map all resolved tracks into catalog ops
    for (const track of resolvedTracks) {
      ops.push({
        collection: 'tracks',
        op: 'set',
        id: track.id,
        data: {
          id: track.id,
          title: track.title,
          artistName: track.artist,
          albumTitle: track.album,
          genre: track.genre,
          bpm: track.bpm,
          duration: track.durationSeconds,
          crateId: track.crateId,
          crateName: track.crateName,
          audioUrl: track.resolvedAudioSource,
          coverUrl: track.artworkPath,
          explicit: track.explicit,
          source: track.source,
          isPublished: true,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Gather all audiobooks
    const audiobooks = await resolveServerAudiobooks();
    for (const ab of audiobooks) {
      ops.push({
        collection: 'audiobooks',
        op: 'set',
        id: ab.id,
        data: {
          id: ab.id,
          title: ab.title,
          author: ab.author,
          narrator: ab.narrator,
          description: ab.description,
          genre: ab.genre,
          coverUrl: ab.artworkPath,
          totalDuration: ab.totalDurationSeconds,
          chapters: ab.chapters,
          isPublished: true,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // 3. Gather all podcasts
    const podcasts = await resolveServerPodcasts();
    for (const pod of podcasts) {
      ops.push({
        collection: 'podcasts',
        op: 'set',
        id: pod.id,
        data: {
          id: pod.id,
          title: pod.title,
          showTitle: pod.showTitle,
          host: pod.host,
          description: pod.description,
          mediaType: pod.mediaType,
          mediaUrl: pod.resolvedSource,
          coverUrl: pod.artworkPath,
          duration: pod.durationSeconds,
          isPublished: true,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // 4. Apply all ops into server snapshot and Firestore
    const result = await applyCatalogOps(ops, auth.email || 'admin');
    const newRev = await getCatalogRevision();

    return NextResponse.json(
      {
        ok: true,
        message: 'Live platform catalog successfully synchronized with cloud and partner store.',
        revision: newRev,
        synced: {
          tracks: resolvedTracks.length,
          audiobooks: audiobooks.length,
          podcasts: podcasts.length,
          crates: OFFICIAL_CRATES.length,
        },
        opsApplied: ops.length,
      },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error('[Admin Catalog Sync API]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Catalog synchronization failed.' },
      { status: 500, headers: NO_STORE }
    );
  }
}

export async function GET(request: NextRequest) {
  // Support GET check of sync status
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  const rev = await getCatalogRevision();
  const tracks = await resolveServerCatalog({ includeUnplayable: false });
  const books = await resolveServerAudiobooks();
  const pods = await resolveServerPodcasts();

  return NextResponse.json(
    {
      ok: true,
      revision: rev,
      counts: {
        tracks: tracks.length,
        audiobooks: books.length,
        podcasts: pods.length,
      },
    },
    { headers: NO_STORE }
  );
}
