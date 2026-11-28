import { NextRequest, NextResponse } from 'next/server';
import {
  getServerPlaylistMixSettings,
  saveServerPlaylistMixSettings,
} from '@/lib/server/djChanceMixStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || req.headers.get('x-user-id') || 'guest';
    const playlistId = searchParams.get('playlistId');
    if (!playlistId) {
      return NextResponse.json({ ok: false, error: 'playlistId is required' }, { status: 400 });
    }
    const settings = await getServerPlaylistMixSettings(userId, playlistId);
    return NextResponse.json(
      { ok: true, settings },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load playlist mix settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !body.settings?.playlistId) {
      return NextResponse.json(
        { ok: false, error: 'Valid settings object with playlistId is required' },
        { status: 400 }
      );
    }
    const userId = String(body.userId || req.headers.get('x-user-id') || 'guest').trim();
    const saved = await saveServerPlaylistMixSettings(userId, body.settings);
    return NextResponse.json({ ok: true, settings: saved });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save playlist mix settings' },
      { status: 500 }
    );
  }
}

