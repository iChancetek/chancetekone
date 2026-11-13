import { NextRequest, NextResponse } from 'next/server';
import { requireStrideIqAdmin, optionsStrideIqResponse } from '@/lib/server/strideiqHttp';
import {
  queryApiUsageAnalytics,
  setApiUsageTrackingEnabled,
  clearApiUsageStats,
  type UsageGranularity,
} from '@/lib/server/apiUsageTracker';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsStrideIqResponse(request);
}

export async function GET(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }

  const sp = request.nextUrl.searchParams;
  const rawGranularity = (sp.get('granularity') || 'hour').toLowerCase();
  const granularity: UsageGranularity =
    rawGranularity === 'time' ||
    rawGranularity === 'hour' ||
    rawGranularity === 'day' ||
    rawGranularity === 'week' ||
    rawGranularity === 'year'
      ? rawGranularity
      : 'hour';

  const appFilter = sp.get('app')?.trim() || 'all';
  const limitRaw = Number(sp.get('limit') || '50');
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(10, limitRaw)) : 50;

  const data = queryApiUsageAnalytics({
    granularity,
    appFilter,
    limit,
  });

  return NextResponse.json(
    {
      ok: true,
      ...data,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireStrideIqAdmin(request);
  if (!admin.authorized) {
    return admin.response!;
  }

  const body = (await request.json().catch(() => ({}))) as {
    trackingEnabled?: boolean;
    action?: 'clear';
  };

  if (body.action === 'clear') {
    clearApiUsageStats();
    return NextResponse.json({
      ok: true,
      cleared: true,
      ...queryApiUsageAnalytics({ granularity: 'hour' }),
    });
  }

  if (typeof body.trackingEnabled === 'boolean') {
    const enabled = setApiUsageTrackingEnabled(body.trackingEnabled);
    return NextResponse.json({
      ok: true,
      trackingEnabled: enabled,
    });
  }

  return NextResponse.json(
    { ok: false, error: 'Missing valid trackingEnabled boolean or action.' },
    { status: 400 },
  );
}

