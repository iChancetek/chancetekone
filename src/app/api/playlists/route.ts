import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser } from '@/lib/auth/serverAuth';
import {
  deleteServerPlaylist,
  getPlaylistsRevision,
  getServerPlaylistById,
  listVisibleServerPlaylists,
  updateServerPlaylistStat,
  upsertServerPlaylist,
} from '@/lib/server/playlistStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

async function resolveOptionalViewer(request: NextRequest): Promise<{
  userId?: string;
  email?: string;
  isAdmin?: boolean;
}> {
  const hasAuthSignals = Boolean(
    request.headers.get('authorization') ||
      request.headers.get('x-user-id') ||
      request.headers.get('x-user-email') ||
      request.headers.get('x-admin-email')
  );
  if (!hasAuthSignals) return {};

  const auth = await verifyServerUser(request);
  if (!auth.authenticated) return {};
  return {
    userId: auth.userId,
    email: auth.email,
    isAdmin: auth.isAdmin,
  };
}

/**
 * GET /api/playlists
 *   - Always returns all Public member playlists (discoverable & playable by everyone)
 *   - Plus any private/unlisted/shared playlists visible to the authenticated viewer
 *   - Supports ?id=<playlistId> for direct single-playlist fetch
 *   - Supports ?rev=<n> for lightweight unchanged check
 */
export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveOptionalViewer(request);
    const id = request.nextUrl.searchParams.get('id')?.trim();

    if (id) {
      const playlist = await getServerPlaylistById(id, viewer);
      if (!playlist) {
        return NextResponse.json(
          { ok: false, error: 'Playlist not found or private.' },
          { status: 404, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, playlist }, { headers: NO_STORE });
    }

    const clientRevParam = request.nextUrl.searchParams.get('rev');
    if (clientRevParam !== null) {
      const clientRev = Number(clientRevParam);
      if (Number.isFinite(clientRev)) {
        const currentRev = await getPlaylistsRevision();
        if (currentRev === clientRev) {
          return NextResponse.json(
            { ok: true, unchanged: true, revision: currentRev },
            { headers: NO_STORE }
          );
        }
      }
    }

    const { revision, playlists } = await listVisibleServerPlaylists(viewer);
    return NextResponse.json(
      { ok: true, revision, playlists },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error('[/api/playlists GET] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load playlists.' },
      { status: 500, headers: NO_STORE }
    );
  }
}

/**
 * POST /api/playlists
 *   - action: 'upsert' (default) -> creates or updates a member playlist (requires auth)
 *   - action: 'delete' -> soft-deletes (or permanently purges) a playlist (owner or admin)
 *   - action: 'stat' -> increments play/like/save/share counter on a public/visible playlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON request body.' },
        { status: 400, headers: NO_STORE }
      );
    }

    const action = typeof body.action === 'string' ? body.action : 'upsert';

    // Lightweight stats counter update (allowed for any listener playing/sharing a public playlist)
    if (action === 'stat') {
      const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
      const field = body.field;
      const delta = typeof body.delta === 'number' ? body.delta : 1;
      if (
        !playlistId ||
        (field !== 'plays' && field !== 'saves' && field !== 'likes' && field !== 'shares')
      ) {
        return NextResponse.json(
          { ok: false, error: 'Invalid stat update payload.' },
          { status: 400, headers: NO_STORE }
        );
      }
      const res = await updateServerPlaylistStat(playlistId, field, delta);
      return NextResponse.json(res, { headers: NO_STORE });
    }

    const auth = await verifyServerUser(request);
    if (!auth.authenticated) {
      return (
        auth.response ||
        NextResponse.json(
          { ok: false, error: 'Authentication required.' },
          { status: 401, headers: NO_STORE }
        )
      );
    }

    const actor = {
      userId: auth.userId,
      email: auth.email,
      isAdmin: auth.isAdmin,
    };

    if (action === 'delete') {
      const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
      const permanent = Boolean(body.permanent && auth.isAdmin);
      const res = await deleteServerPlaylist(playlistId, actor, permanent);
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error },
          { status: res.status, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, revision: res.revision }, { headers: NO_STORE });
    }

    // Upsert (create or update)
    const playlistPayload = body.playlist || body;
    const res = await upsertServerPlaylist(playlistPayload, actor);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error },
        { status: res.status, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { ok: true, playlist: res.playlist, revision: res.revision },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error('[/api/playlists POST] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save playlist.' },
      { status: 500, headers: NO_STORE }
    );
  }
}

