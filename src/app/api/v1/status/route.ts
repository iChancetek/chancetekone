import { NextRequest, NextResponse } from 'next/server';
import {
  buildStrideIqCorsHeaders,
  optionsStrideIqResponse,
  verifyStrideIqPartnerRequest,
} from '@/lib/server/strideiqStore';
import {
  resolveServerCatalog,
  resolveServerAudiobooks,
  resolveServerPodcasts,
} from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const corsHeaders = buildStrideIqCorsHeaders(request);
  const auth = await verifyStrideIqPartnerRequest(request);

  const [tracks, audiobooks, podcasts] = await Promise.all([
    resolveServerCatalog().catch(() => []),
    resolveServerAudiobooks().catch(() => []),
    resolveServerPodcasts().catch(() => []),
  ]);

  return NextResponse.json(
    {
      ok: true,
      success: true,
      status: 'operational',
      platform: 'ChanceTEK One Streaming Ecosystem',
      version: '2.4.0-Sovereign',
      connected: auth.authorized,
      authType: auth.authorized ? auth.authType : 'unauthenticated',
      activeStagesCount: 4,
      counts: {
        tracks: tracks.length,
        audiobooks: audiobooks.length,
        podcasts: podcasts.length,
      },
      supportedPillars: [
        'One Live (Concert Stages & Real-Time Broadcasts)',
        'One Music (Authentic Studio Masters & Lossless Streaming)',
        'One Audiobooks (Spoken Literature & Cultural Series)',
        'One Podcasts (Independent Creator Audio)',
        'One Video (4K Visual Cinema & Premieres)',
        'One AI (Streaming Audio Concierge)',
      ],
      timestamp: new Date().toISOString(),
    },
    { headers: { ...corsHeaders, ...auth.rateHeaders } },
  );
}

