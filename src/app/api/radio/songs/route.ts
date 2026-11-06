// ============================================================
// Radio Songs API — /api/radio/songs
// GET: Returns the approved radio catalog
// PATCH: Admin updates song rotation/approval status
// DELETE: Admin removes a song from the catalog
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { RADIO_INITIAL_CATALOG } from '@/lib/radio/initialCatalog';

// In-memory store (extends initial catalog at runtime)
// In production this would be backed by Firestore/database
let runtimeCatalog = [...RADIO_INITIAL_CATALOG];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stationId = searchParams.get('station');
  const approvedOnly = searchParams.get('approved') !== 'false';

  let songs = [...runtimeCatalog];

  if (stationId) {
    songs = songs.filter((s) => s.stations.includes(stationId as 'hip-hop' | 'neo-soul'));
  }
  if (approvedOnly) {
    songs = songs.filter((s) => s.isApproved);
  }

  return NextResponse.json({ songs, total: songs.length });
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, updates } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Song id is required' }, { status: 400 });
    }

    const idx = runtimeCatalog.findIndex((s) => s.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    // Only allow safe admin-controlled fields
    const allowed = ['isApproved', 'inRotation', 'stations', 'title', 'artist', 'album', 'genre'];
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    runtimeCatalog[idx] = { ...runtimeCatalog[idx], ...safeUpdates };

    return NextResponse.json({ song: runtimeCatalog[idx] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'PATCH failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    const before = runtimeCatalog.length;
    runtimeCatalog = runtimeCatalog.filter((s) => s.id !== id);

    if (runtimeCatalog.length === before) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, removed: id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'DELETE failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
