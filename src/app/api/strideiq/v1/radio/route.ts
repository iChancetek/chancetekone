import { NextRequest } from 'next/server';
import {
  withStrideIqPartnerAuth,
  optionsStrideIqResponse,
} from '@/lib/server/strideiqHttp';
import { getStrideIqRadioFeed } from '@/lib/server/strideiqCatalog';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  return withStrideIqPartnerAuth(request, async ({ publicOrigin }) => {
    const stations = await getStrideIqRadioFeed(publicOrigin);
    return {
      ok: true,
      total: stations.length,
      stations,
    };
  });
}

