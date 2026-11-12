import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser } from '@/lib/auth/serverAuth';
import { getServerUserProfile, upsertServerUserProfile } from '@/lib/server/profileStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.trim() || undefined;
    const email = searchParams.get('email')?.trim() || undefined;

    if (!userId && !email) {
      return NextResponse.json(
        { ok: false, error: 'Missing userId or email query parameter.' },
        { status: 400 }
      );
    }

    const record = await getServerUserProfile({ userId, email });
    return NextResponse.json(
      {
        ok: true,
        profile: record
          ? {
              id: record.id,
              name: record.name,
              bio: record.bio,
              avatarUrl: record.avatarUrl,
              profileVideoUrl: record.profileVideoUrl,
              mediaType: record.mediaType,
              updatedAt: record.updatedAt,
            }
          : null,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/profile GET] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load server profile.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated) {
      return (
        auth.response ||
        NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const targetUserId =
      typeof body.userId === 'string' && body.userId.trim()
        ? body.userId.trim()
        : auth.userId || '';

    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'Missing userId.' }, { status: 400 });
    }

    const bodyEmail = typeof body.email === 'string' ? body.email.trim() : undefined;
    const authEmailLower = auth.email?.trim().toLowerCase() || '';
    const bodyEmailLower = bodyEmail?.toLowerCase() || '';

    const isAuthorized =
      Boolean(auth.isAdmin) ||
      (Boolean(auth.userId) && targetUserId === auth.userId) ||
      (Boolean(authEmailLower) && authEmailLower === bodyEmailLower);

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: 'You are not authorized to modify this profile.' },
        { status: 403 }
      );
    }

    const updated = await upsertServerUserProfile({
      userId: targetUserId,
      email: bodyEmail || auth.email,
      name: typeof body.name === 'string' ? body.name : undefined,
      bio: body.bio === null ? null : typeof body.bio === 'string' ? body.bio : undefined,
      avatarUrl:
        body.avatarUrl === null
          ? null
          : typeof body.avatarUrl === 'string'
          ? body.avatarUrl
          : undefined,
      profileVideoUrl:
        body.profileVideoUrl === null
          ? null
          : typeof body.profileVideoUrl === 'string'
          ? body.profileVideoUrl
          : undefined,
      mediaType:
        body.mediaType === null
          ? null
          : body.mediaType === 'image' || body.mediaType === 'video'
          ? body.mediaType
          : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        profile: {
          id: updated.id,
          name: updated.name,
          bio: updated.bio,
          avatarUrl: updated.avatarUrl,
          profileVideoUrl: updated.profileVideoUrl,
          mediaType: updated.mediaType,
          updatedAt: updated.updatedAt,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/profile POST] Failed:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save server profile.' },
      { status: 500 }
    );
  }
}

