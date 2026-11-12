import { NextRequest, NextResponse } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
  requireStrideIqAdmin,
} from '@/lib/server/strideiqHttp';
import {
  recordStrideIqTelemetry,
  getStrideIqTelemetrySummary,
  buildStrideIqCorsHeaders,
  type StrideIqTelemetryEvent,
} from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

const VALID_EVENTS = new Set(['play_start', 'heartbeat', 'track_complete', 'skip']);

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function POST(request: NextRequest) {
  return withStrideIqPartnerAuth(
    request,
    async ({ auth, headers }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      const eventRaw = String(body.event || '').trim();
      const trackId = String(body.trackId || '').trim();
      const activity = String(body.activity || 'running').trim();

      if (!VALID_EVENTS.has(eventRaw) || !trackId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid telemetry payload. Required: event (play_start|heartbeat|track_complete|skip) and trackId.',
          },
          { status: 400, headers },
        );
      }

      const numOpt = (v: unknown): number | undefined => {
        if (v === undefined || v === null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      const recorded = await recordStrideIqTelemetry({
        event: eventRaw as StrideIqTelemetryEvent['event'],
        trackId,
        trackTitle: typeof body.trackTitle === 'string' ? body.trackTitle : undefined,
        artistName: typeof body.artistName === 'string' ? body.artistName : undefined,
        activity,
        sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
        strideiqUserId:
          typeof body.strideiqUserId === 'string' ? body.strideiqUserId : auth.userId,
        cadenceSpm: numOpt(body.cadenceSpm),
        paceSecondsPerKm: numOpt(body.paceSecondsPerKm),
        heartRateBpm: numOpt(body.heartRateBpm),
        heartRateZone: numOpt(body.heartRateZone),
        positionSeconds: numOpt(body.positionSeconds),
        durationListenedSeconds: numOpt(body.durationListenedSeconds),
        partnerKeyId: auth.partnerKeyId,
      });

      return NextResponse.json({ ok: true, recorded }, { status: 201, headers });
    },
    { rateLimitPerMinute: 240 },
  );
}

export async function GET(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }
  const summary = await getStrideIqTelemetrySummary();
  return NextResponse.json(
    { ok: true, telemetry: summary },
    { status: 200, headers: buildStrideIqCorsHeaders(request) },
  );
}

