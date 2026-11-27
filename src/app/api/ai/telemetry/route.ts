import { NextRequest, NextResponse } from 'next/server';
import {
  emitWyresTrace,
  getWyresStatus,
  WyresTracePayload,
  WyresRunType,
} from '@/lib/telemetry/wyres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_RUN_TYPES = new Set<WyresRunType>([
  'llm',
  'agent',
  'tool',
  'chain',
  'retriever',
  'embedding',
]);

// Lightweight per-process rate limiter (240 client telemetry batches per minute)
const MAX_BATCHES_PER_MINUTE = 240;
let windowStart = Date.now();
let batchCount = 0;

function allowTelemetryBatch(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    batchCount = 0;
  }
  if (batchCount >= MAX_BATCHES_PER_MINUTE) return false;
  batchCount += 1;
  return true;
}

/**
 * GET /api/ai/telemetry
 * Returns live Wyres connection status & counters (never exposes the secret API key).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      wyres: getWyresStatus(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

/**
 * POST /api/ai/telemetry
 * Receives batched or single client-side AI Agent / Copilot / Assistant / Radio AI spans
 * and forwards them securely server-side with WYRES_API_KEY to https://wyres.us/v1/traces.
 */
export async function POST(req: NextRequest) {
  try {
    if (!allowTelemetryBatch()) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const rawEvents: any[] = Array.isArray((body as any).events)
      ? (body as any).events.slice(0, 20)
      : [(body as any)];

    const validEvents: WyresTracePayload[] = rawEvents
      .filter((e) => e && typeof e === 'object' && typeof e.name === 'string' && e.name.trim().length > 0)
      .map((e) => {
        const runType: WyresRunType = ALLOWED_RUN_TYPES.has(e.runType) ? e.runType : 'agent';
        return {
          id: typeof e.id === 'string' ? e.id : undefined,
          traceId: typeof e.traceId === 'string' ? e.traceId : undefined,
          parentRunId: typeof e.parentRunId === 'string' ? e.parentRunId : null,
          name: String(e.name).slice(0, 140),
          runType,
          provider: typeof e.provider === 'string' ? e.provider.slice(0, 80) : 'chancetek-agent',
          model: typeof e.model === 'string' ? e.model.slice(0, 80) : 'agent-runtime',
          category: e.category || 'agentic_agent',
          feature: typeof e.feature === 'string' ? e.feature.slice(0, 100) : String(e.name).slice(0, 100),
          status: e.status === 'error' ? 'error' : 'success',
          startTime: typeof e.startTime === 'string' ? e.startTime : undefined,
          endTime: typeof e.endTime === 'string' ? e.endTime : undefined,
          latencyMs: typeof e.latencyMs === 'number' ? e.latencyMs : undefined,
          promptTokens: typeof e.promptTokens === 'number' ? e.promptTokens : 0,
          completionTokens: typeof e.completionTokens === 'number' ? e.completionTokens : 0,
          totalTokens: typeof e.totalTokens === 'number' ? e.totalTokens : undefined,
          input: e.input && typeof e.input === 'object' ? e.input : null,
          output: e.output && typeof e.output === 'object' ? e.output : null,
          error: typeof e.error === 'string' ? e.error.slice(0, 500) : null,
          tags: Array.isArray(e.tags) ? e.tags.map((t: any) => String(t).slice(0, 48)).slice(0, 12) : [],
          userId: typeof e.userId === 'string' ? e.userId.slice(0, 128) : undefined,
          metadata: {
            ...(e.metadata && typeof e.metadata === 'object' ? e.metadata : {}),
            forwardedVia: '/api/ai/telemetry',
          },
        };
      });

    if (validEvents.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid AI trace events supplied' }, { status: 400 });
    }

    const results = await Promise.all(validEvents.map((evt) => emitWyresTrace(evt)));
    const delivered = results.filter((r) => r.ok).length;

    return NextResponse.json(
      {
        ok: true,
        accepted: validEvents.length,
        delivered,
        traceIds: results.map((r) => r.traceId),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to forward Wyres telemetry' },
      { status: 500 }
    );
  }
}

