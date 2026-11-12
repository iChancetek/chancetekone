import { NextRequest, NextResponse } from 'next/server';
import { requireStrideIqAdmin } from '@/lib/server/strideiqHttp';
import {
  listPartnerApiKeys,
  createPartnerApiKey,
  revokePartnerApiKey,
  getStrideIqTelemetrySummary,
  resolvePublicOrigin,
} from '@/lib/server/strideiqStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }

  const [keys, telemetry] = await Promise.all([
    listPartnerApiKeys(),
    getStrideIqTelemetrySummary(),
  ]);

  return NextResponse.json({
    ok: true,
    baseUrl: `${resolvePublicOrigin(request).replace(/\/$/, '')}/api/strideiq/v1`,
    keys: keys.map(({ sha256: _redacted, ...pub }) => pub),
    telemetry,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    scopes?: ('read' | 'stream' | 'telemetry')[];
  };

  const label = String(body.label || 'StrideIQ.fit Production App').trim().slice(0, 80);
  const { apiKey, record } = await createPartnerApiKey({
    label: label || 'StrideIQ.fit Production App',
    createdBy: admin.email || 'admin@chancetekone.com',
    scopes: body.scopes,
  });

  const { sha256: _redacted, ...publicRecord } = record;
  return NextResponse.json(
    {
      ok: true,
      apiKey,
      record: publicRecord,
      note: 'Store this key securely in StrideIQ.fit secrets — the full key value is shown once.',
    },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }

  const idFromQuery = request.nextUrl.searchParams.get('id')?.trim();
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const keyId = idFromQuery || String(body.id || '').trim();

  if (!keyId) {
    return NextResponse.json(
      { ok: false, error: 'Missing partner key id.' },
      { status: 400 },
    );
  }

  const revoked = await revokePartnerApiKey(keyId);
  if (!revoked) {
    return NextResponse.json(
      { ok: false, error: `Partner API key "${keyId}" not found.` },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, revokedId: keyId });
}

