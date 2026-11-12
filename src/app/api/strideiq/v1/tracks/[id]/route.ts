import { NextRequest, NextResponse } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import {
  getStrideIqTrackById,
  toStrideIqTrackDto,
} from '@/lib/server/strideiqCatalog';

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
    const track = await getStrideIqTrackById(decodedId);
    if (!track) {
      return NextResponse.json(
        { ok: false, error: `Track "${decodedId}" not found or unavailable for streaming.` },
        { status: 404, headers },
      );
    }

    const dto = await toStrideIqTrackDto(track, publicOrigin);
    return {
      ok: true,
      track: dto,
    };
  });
}

