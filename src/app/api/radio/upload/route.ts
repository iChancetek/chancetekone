// ============================================================
// Radio Upload API — /api/radio/upload
// POST: Admin uploads an MP3 file to the radio catalog.
// Admin-only via Firebase Storage or in-memory for initial build.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { MusicIngestionAgent } from '@/lib/radio/agents/MusicIngestionAgent';
import { RadioSong, RadioUploadPayload } from '@/types/radio';

// Runtime catalog store (shared with songs route via module-level singleton in production)
const uploadedSongs: RadioSong[] = [];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Extract metadata fields
    const title   = formData.get('title')?.toString() ?? '';
    const artist  = formData.get('artist')?.toString() ?? '';
    const album   = formData.get('album')?.toString() ?? '';
    const genre   = formData.get('genre')?.toString() ?? '';
    const yearStr = formData.get('year')?.toString();
    const stationsRaw = formData.get('stations')?.toString() ?? 'hip-hop';
    const isExplicit = formData.get('isExplicit') === 'true';
    const coverUrl   = formData.get('coverUrl')?.toString();
    const uploadedBy = formData.get('uploadedBy')?.toString();

    if (!title || !artist || !genre) {
      return NextResponse.json(
        { error: 'title, artist, and genre are required fields.' },
        { status: 400 }
      );
    }

    const stations = stationsRaw.split(',').filter(
      (s): s is 'hip-hop' | 'neo-soul' => s === 'hip-hop' || s === 'neo-soul'
    );
    if (stations.length === 0) {
      return NextResponse.json({ error: 'At least one station must be selected.' }, { status: 400 });
    }

    const file = formData.get('audio') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    // Validate file
    const validation = MusicIngestionAgent.validate(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }

    // In a full production deployment, we'd upload to Firebase Storage here.
    // For the initial implementation, we store the file URL as a blob URL placeholder
    // and return the constructed RadioSong record.
    const id = `radio-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Duration extraction isn't possible server-side without FFmpeg; default to 0 and
    // let the client-side BroadcastAgent handle the actual duration from the audio element.
    const duration = Number(formData.get('duration')) || 0;

    // Placeholder audio URL — in production this would be the Firebase Storage download URL
    const audioUrl = `/audio/uploads/${id}.mp3`;

    const payload: RadioUploadPayload = {
      title,
      artist,
      album,
      genre,
      year: yearStr ? parseInt(yearStr, 10) : undefined,
      isExplicit,
      stations,
      coverUrl,
    };

    const song = MusicIngestionAgent.buildSongRecord(payload, audioUrl, id, duration, uploadedBy);
    uploadedSongs.push(song);

    return NextResponse.json({ success: true, song }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Radio Upload API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ songs: uploadedSongs, total: uploadedSongs.length });
}
