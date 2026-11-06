import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { applyCatalogOps, getCatalogRevision, readCatalogSnapshot } from '@/lib/server/catalogStore';
import { CatalogOp } from '@/lib/catalog/cloudShared';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * GET /api/catalog            → full shared catalog (public — every member needs it)
 * GET /api/catalog?rev=<n>    → { unchanged: true } if nothing changed since revision n
 */
export async function GET(request: NextRequest) {
  try {
    const clientRev = Number(request.nextUrl.searchParams.get('rev'));
    if (Number.isFinite(clientRev) && request.nextUrl.searchParams.has('rev')) {
      const current = await getCatalogRevision();
      if (current === clientRev) {
        return NextResponse.json({ ok: true, unchanged: true, revision: current }, { headers: NO_STORE });
      }
    }
    const snapshot = await readCatalogSnapshot();
    return NextResponse.json({ ok: true, snapshot }, { headers: NO_STORE });
  } catch (err: any) {
    console.error('[Catalog API GET]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Catalog unavailable' },
      { status: 503, headers: NO_STORE }
    );
  }
}

/** POST /api/catalog  { ops: CatalogOp[] }  — admin only */
export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const ops: CatalogOp[] = Array.isArray(body?.ops) ? body.ops : [];
    const result = await applyCatalogOps(ops, auth.email || 'admin');
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (err: any) {
    console.error('[Catalog API POST]', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Catalog update failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
