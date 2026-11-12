import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { queryStrideIqAudiobooks } from '@/lib/server/strideiqCatalog';

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

    const result = await queryStrideIqAudiobooks({
      publicOrigin,
      q: sp.get('q') || undefined,
      genre: sp.get('genre') || undefined,
      author: sp.get('author') || undefined,
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

