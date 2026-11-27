import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser, isAdminEmail } from '@/lib/auth/serverAuth';
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
  const userIdHeader = request.headers.get('x-user-id')?.trim();
  const userEmailHeader = request.headers.get('x-user-email')?.trim().toLowerCase();
  const adminEmailHeader = request.headers.get('x-admin-email')?.trim().toLowerCase();
  const hasAuthSignals = Boolean(
    request.headers.get('authorization') ||
      userIdHeader ||
      userEmailHeader ||
      adminEmailHeader
  );
  if (!hasAuthSignals) return {};

  const auth = await verifyServerUser(request);
  if (auth.authenticated) {
    return {
      userId: auth.userId,
      email: auth.email,
      isAdmin: auth.isAdmin,
    };
  }
  if (userIdHeader) {
    return {
      userId: userIdHeader,
      email: userEmailHeader || undefined,
      isAdmin: Boolean(userEmailHeader && isAdminEmail(userEmailHeader)),
    };
  }
  return {};
}

async function resolveWriteActor(
  request: NextRequest,
  playlistPayload?: any
): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
  isAdmin?: boolean;
}> {
  const auth = await verifyServerUser(request);
  if (auth.authenticated) {
    return {
      authenticated: true,
      userId: auth.userId,
      email: auth.email,
      isAdmin: auth.isAdmin,
    };
  }

  // Fallback for signed-in member/demo sessions whose profile has userId/ownerId without email or expired ID token
  const userIdHeader = request.headers.get('x-user-id')?.trim();
  const userEmailHeader = request.headers.get('x-user-email')?.trim().toLowerCase();
  const payloadOwnerId =
    typeof playlistPayload?.ownerId === 'string' ? playlistPayload.ownerId.trim() : '';
  const payloadOwnerEmail =
    typeof playlistPayload?.ownerEmail === 'string'
      ? playlistPayload.ownerEmail.trim().toLowerCase()
      : undefined;

  const effectiveId = userIdHeader || payloadOwnerId;
  const effectiveEmail = userEmailHeader || payloadOwnerEmail;
  if (effectiveId && effectiveId !== 'guest') {
    return {
      authenticated: true,
      userId: effectiveId,
      email: effectiveEmail,
      isAdmin: Boolean(effectiveEmail && isAdminEmail(effectiveEmail)),
    };
  }

  return { authenticated: false };
}

/**
 * GET /api/playlists
 *   - Always returns all Public member playlists (discoverable & playable by everyone)
 *   - Plus any private/unlisted/shared playlists visible to the authenticated viewer
 *   - Supports ?id=<playlistId> for direct single-playlist fetch
 *   - Supports ?rev=<n> (when n > 0) for lightweight unchanged check
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
      // Never short-circuit unchanged when clientRev <= 0 so empty cold-start states always fetch real docs
      if (Number.isFinite(clientRev) && clientRev > 0) {
        const { revision: currentRev, cloudOk } = await getPlaylistsRevision();
        if (cloudOk && currentRev > 0 && currentRev === clientRev) {
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
 *   - action: 'upsert' (default) -> creates or updates a member playlist
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

    const playlistPayload = body.playlist || body;
    const actor = await resolveWriteActor(request, playlistPayload);
    if (!actor.authenticated) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to create or update playlists.' },
        { status: 401, headers: NO_STORE }
      );
    }

    if (action === 'delete') {
      const playlistId = typeof body.playlistId === 'string' ? body.playlistId : '';
      const permanent = Boolean(body.permanent && actor.isAdmin);
      const res = await deleteServerPlaylist(playlistId, actor, permanent);
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error },
          { status: res.status, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, revision: res.revision }, { headers: NO_STORE });
    }

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
