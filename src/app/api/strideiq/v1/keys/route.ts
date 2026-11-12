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

  const isV1Path = request.nextUrl.pathname.startsWith('/api/v1');
  const baseSegment = isV1Path ? '/api/v1' : '/api/strideiq/v1';

  return NextResponse.json({
    ok: true,
    baseUrl: `${resolvePublicOrigin(request).replace(/\/$/, '')}${baseSegment}`,
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
    appType?: 'general' | 'mobile' | 'fitness' | 'social' | 'ai' | 'kiosk' | 'auto';
    prefix?: string;
  };

  const label = String(body.label || 'Partner Production App').trim().slice(0, 80);
  const { apiKey, record } = await createPartnerApiKey({
    label: label || 'Partner Production App',
    createdBy: admin.email || 'admin@chancetekone.com',
    scopes: body.scopes,
    appType: body.appType,
    prefix: body.prefix,
  });

  const { sha256: _redacted, ...publicRecord } = record;
  const isFamio = label.toLowerCase().includes('famio') || body.appType === 'social';
  const isStrideIq = label.toLowerCase().includes('strideiq') || body.appType === 'fitness';
  const targetApp = isFamio ? 'Famio.us' : isStrideIq ? 'StrideIQ.fit' : 'Partner Application';

  return NextResponse.json(
    {
      ok: true,
      apiKey,
      record: publicRecord,
      note: `Store this key securely in ${targetApp} secrets — the full key value is shown once.`,
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

