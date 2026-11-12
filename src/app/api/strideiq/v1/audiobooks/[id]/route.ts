import { NextRequest, NextResponse } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { getStrideIqAudiobookById } from '@/lib/server/strideiqCatalog';

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
    const audiobook = await getStrideIqAudiobookById(decodedId, publicOrigin, {
      includeUnplayable: request.nextUrl.searchParams.get('playableOnly') === 'false',
    });

    if (!audiobook) {
      return NextResponse.json(
        { ok: false, error: `Audiobook "${decodedId}" not found or unavailable for streaming.` },
        { status: 404, headers },
      );
    }

    return {
      ok: true,
      audiobook,
    };
  });
}

