import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { queryStrideIqPodcasts } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const sp = request.nextUrl.searchParams;
    const parseIntOpt = (k: string): number | undefined => {
      const v = sp.get(k);
      if (v === null || v.trim() === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const mediaRaw = sp.get('mediaType')?.trim().toLowerCase();
    const mediaType = mediaRaw === 'audio' || mediaRaw === 'video' ? mediaRaw : undefined;

    const result = await queryStrideIqPodcasts({
      publicOrigin,
      q: sp.get('q') || undefined,
      category: sp.get('category') || undefined,
      show: sp.get('show') || undefined,
      mediaType,
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

