import { NextRequest, NextResponse } from 'next/server';
import { optimizePlaylistFlow, planTransition } from '@/lib/djchancemix/transitionIntelligence';
import { emitWyresTraceAsync } from '@/lib/telemetry/wyres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/djchancemix/plan
 * Supports:
 * - action: 'transition' (default) -> evaluates optimal transition between Track A & Track B
 * - action: 'sequence' -> computes AI DJ Flow harmonic + BPM playlist order
 */
export async function POST(req: NextRequest) {
  const startedMs = Date.now();
  const startTime = new Date(startedMs).toISOString();

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (body.action === 'sequence') {
      const { tracks, analyses = {}, config, anchorTrackId, userId } = body;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        return NextResponse.json({ ok: false, error: 'tracks array is required' }, { status: 400 });
      }

      const result = optimizePlaylistFlow(tracks, analyses, config, anchorTrackId);
      const endedMs = Date.now();

      emitWyresTraceAsync({
        name: 'djchancemix:ai-dj-flow-sequence',
        runType: 'agent',
        provider: 'chancetek-agent',
        model: 'djchancemix-flow-v1',
        category: 'agentic_agent',
        feature: 'djchancemix-playlist-sequencing',
        userId: typeof userId === 'string' ? userId : undefined,
        startTime,
        endTime: new Date(endedMs).toISOString(),
        latencyMs: endedMs - startedMs,
        input: { tracksCount: tracks.length, anchorTrackId: anchorTrackId || null },
        output: {
          orderedCount: result.orderedTracks.length,
          avgCompatibility: result.avgCompatibility,
        },
        tags: ['djchancemix', 'ai-dj-flow', 'harmonic-sequencing'],
      });

      return NextResponse.json({ ok: true, ...result });
    }

    // Default: evaluate transition pair
    const { fromTrack, toTrack, fromAnalysis, toAnalysis, config, modeOverride, userId } = body;
    if (!fromTrack || !toTrack || !fromAnalysis || !toAnalysis) {
      return NextResponse.json(
        { ok: false, error: 'fromTrack, toTrack, fromAnalysis, and toAnalysis are required' },
        { status: 400 }
      );
    }

    const plan = planTransition({
      fromTrack,
      toTrack,
      fromAnalysis,
      toAnalysis,
      config,
      modeOverride,
    });
    const endedMs = Date.now();

    emitWyresTraceAsync({
      name: 'djchancemix:plan-transition',
      runType: 'agent',
      provider: 'chancetek-agent',
      model: 'djchancemix-intelligence-v1',
      category: 'agentic_agent',
      feature: 'djchancemix-transition-plan',
      userId: typeof userId === 'string' ? userId : undefined,
      startTime,
      endTime: new Date(endedMs).toISOString(),
      latencyMs: endedMs - startedMs,
      input: {
        fromTrack: fromTrack.title,
        toTrack: toTrack.title,
        mode: plan.mode,
      },
      output: {
        compatibilityScore: plan.compatibilityScore,
        confidence: plan.confidence,
        transitionType: plan.transitionType,
        beatSyncEnabled: plan.beatSyncEnabled,
        harmonicRelation: plan.harmonicRelation,
      },
      tags: ['djchancemix', plan.mode, plan.transitionType],
    });

    return NextResponse.json({ ok: true, plan });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Transition planning failed' },
      { status: 500 }
    );
  }
}

