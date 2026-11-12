import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { getStrideIqPlaylists } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const activity = request.nextUrl.searchParams.get('activity') || undefined;
    const playlists = await getStrideIqPlaylists(publicOrigin, activity);
    return {
      ok: true,
      total: playlists.length,
      playlists,
    };
  });
}

