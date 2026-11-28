import { NextRequest, NextResponse } from 'next/server';
import { getServerMixConfig, saveServerMixConfig } from '@/lib/server/djChanceMixStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId =
      searchParams.get('userId') || req.headers.get('x-user-id') || 'guest';
    const config = await getServerMixConfig(userId);
    return NextResponse.json(
      { ok: true, config },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load DJChanceMix configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    const userId = String(body.userId || req.headers.get('x-user-id') || 'guest').trim();
    const saved = await saveServerMixConfig(userId, body.config || body);
    return NextResponse.json({ ok: true, config: saved });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save DJChanceMix configuration' },
      { status: 500 }
    );
  }
}

