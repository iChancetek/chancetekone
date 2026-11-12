import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import {
  generateStrideIqWorkoutMix,
  type WorkoutStructure,
} from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

function parseStructure(raw?: string | null): WorkoutStructure | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'warmup_main_cooldown' || s === 'warm-up-main-cool-down' || s === 'phased') {
    return 'warmup_main_cooldown';
  }
  if (s === 'interval' || s === 'intervals' || s === 'hiit') {
    return 'interval';
  }
  return 'steady';
}

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const sp = request.nextUrl.searchParams;
    const num = (k: string) => {
      const v = sp.get(k);
      if (v === null || v.trim() === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const excludeParam = sp.get('excludeTrackIds');
    const excludeTrackIds = excludeParam
      ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const mix = await generateStrideIqWorkoutMix({
      publicOrigin,
      activity: sp.get('activity') || 'running',
      targetDurationMinutes: num('durationMinutes') ?? num('targetDurationMinutes'),
      cadenceSpm: num('cadenceSpm'),
      targetBpm: num('targetBpm'),
      bpmMin: num('bpmMin'),
      bpmMax: num('bpmMax'),
      genre: sp.get('genre') || undefined,
      crate: sp.get('crate') || undefined,
      structure: parseStructure(sp.get('structure')),
      excludeTrackIds,
      limit: num('limit'),
      allowExplicit: sp.get('allowExplicit') === 'false' ? false : true,
      allowLoop: sp.get('allowLoop') === 'false' ? false : true,
    });

    return { ok: true, mix };
  });
}

export async function POST(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;

    const mix = await generateStrideIqWorkoutMix({
      publicOrigin,
      activity: typeof body.activity === 'string' ? body.activity : 'running',
      targetDurationMinutes:
        Number(body.targetDurationMinutes ?? body.durationMinutes) || undefined,
      cadenceSpm: Number.isFinite(Number(body.cadenceSpm)) ? Number(body.cadenceSpm) : undefined,
      targetBpm: Number.isFinite(Number(body.targetBpm)) ? Number(body.targetBpm) : undefined,
      bpmMin: Number.isFinite(Number(body.bpmMin)) ? Number(body.bpmMin) : undefined,
      bpmMax: Number.isFinite(Number(body.bpmMax)) ? Number(body.bpmMax) : undefined,
      genre: typeof body.genre === 'string' ? body.genre : undefined,
      crate: typeof body.crate === 'string' ? body.crate : undefined,
      structure: parseStructure(body.structure),
      excludeTrackIds: Array.isArray(body.excludeTrackIds)
        ? body.excludeTrackIds.map(String)
        : undefined,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined,
      allowExplicit: body.allowExplicit === false ? false : true,
      allowLoop: body.allowLoop === false ? false : true,
    });

    return { ok: true, mix };
  });
}

