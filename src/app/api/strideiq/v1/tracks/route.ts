import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import {
  queryStrideIqTracks,
  type EnergyLevel,
} from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const sp = request.nextUrl.searchParams;
    const parseIntOpt = (key: string): number | undefined => {
      const raw = sp.get(key);
      if (raw === null || raw.trim() === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    const energyRaw = sp.get('energy')?.trim().toLowerCase();
    const energy =
      energyRaw === 'low' ||
      energyRaw === 'moderate' ||
      energyRaw === 'high' ||
      energyRaw === 'peak'
        ? (energyRaw as EnergyLevel)
        : undefined;

    const result = await queryStrideIqTracks({
      publicOrigin,
      q: sp.get('q') || undefined,
      activity: sp.get('activity') || undefined,
      genre: sp.get('genre') || undefined,
      crate: sp.get('crate') || undefined,
      bpmMin: parseIntOpt('bpmMin'),
      bpmMax: parseIntOpt('bpmMax'),
      energy,
      limit: parseIntOpt('limit'),
      offset: parseIntOpt('offset'),
      includeUnplayable: sp.get('playableOnly') === 'false',
    });

    return {
      ok: true,
      ...result,
    };
  });
}

