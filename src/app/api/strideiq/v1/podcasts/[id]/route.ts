import { NextRequest, NextResponse } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { getStrideIqPodcastById } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const decodedId = decodeURIComponent(id || '').trim();

  return withStrideIqPartnerAuth(request, async ({ publicOrigin, headers }) => {
    const podcast = await getStrideIqPodcastById(decodedId, publicOrigin, {
      includeUnplayable: request.nextUrl.searchParams.get('playableOnly') === 'false',
    });

    if (!podcast) {
      return NextResponse.json(
        { ok: false, error: `Podcast episode "${decodedId}" not found or unavailable.` },
        { status: 404, headers },
      );
    }

    return {
      ok: true,
      podcast,
    };
  });
}

