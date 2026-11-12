/**
 * ChanceTEK One -> StrideIQ.fit Shared Route Wrapper
 * Eliminates duplicated auth, rate-limit, CORS, and error handling across `/api/strideiq/v1/*`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { isAdminEmail } from '@/lib/catalog/adminIdentity';
import {
  buildStrideIqCorsHeaders,
  optionsStrideIqResponse,
  resolvePublicOrigin,
  verifyStrideIqPartnerRequest,
  type StrideIqAuthResult,
} from './strideiqStore';

export { optionsStrideIqResponse };

export async function requireStrideIqAdmin(request: NextRequest): Promise<{
  authorized: boolean;
  email?: string;
  response?: NextResponse;
}> {
  const authHeader = request.headers.get('authorization')?.trim() || '';
  const adminEmailHeader = request.headers.get('x-admin-email')?.trim().toLowerCase() || '';

  // Reject completely anonymous requests even in local development
  if (!authHeader.startsWith('Bearer ') && !adminEmailHeader) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: 'Administrator credentials required.' },
        { status: 401, headers: buildStrideIqCorsHeaders(request) },
      ),
    };
  }

  // If caller only supplied x-admin-email (without Bearer JWT), reject non-admin emails strictly
  if (!authHeader.startsWith('Bearer ') && !isAdminEmail(adminEmailHeader)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: 'Access Denied: Administrator authority required.' },
        { status: 403, headers: buildStrideIqCorsHeaders(request) },
      ),
    };
  }

  const admin = await verifyServerAdmin(request);
  if (!admin.authorized || !admin.email || !isAdminEmail(admin.email)) {
    return {
      authorized: false,
      response:
        admin.response ||
        NextResponse.json(
          { ok: false, error: 'Verified administrator credentials required.' },
          { status: 403, headers: buildStrideIqCorsHeaders(request) },
        ),
    };
  }
  return { authorized: true, email: admin.email };
}

export interface StrideIqRouteContext {
  request: NextRequest;
  publicOrigin: string;
  auth: StrideIqAuthResult;
  headers: Record<string, string>;
}

export async function withStrideIqPartnerAuth(
  request: NextRequest,
  handler: (ctx: StrideIqRouteContext) => Promise<Response | NextResponse | Record<string, unknown>>,
  options?: { rateLimitPerMinute?: number },
): Promise<NextResponse> {
  const cors = buildStrideIqCorsHeaders(request);
  const auth = await verifyStrideIqPartnerRequest(request, {
    rateLimitPerMinute: options?.rateLimitPerMinute ?? 120,
  });

  if (!auth.authorized) {
    return auth.response!;
  }

  const headers = {
    ...cors,
    ...auth.rateHeaders,
    'Cache-Control': 'no-store',
  };

  try {
    const result = await handler({
      request,
      publicOrigin: resolvePublicOrigin(request),
      auth,
      headers,
    });

    if (
      result instanceof Response ||
      result instanceof NextResponse ||
      (result !== null &&
        typeof result === 'object' &&
        'status' in result &&
        typeof result.status === 'number' &&
        'headers' in result &&
        typeof (result.headers as { set?: unknown })?.set === 'function')
    ) {
      const res = result as NextResponse;
      Object.entries(headers).forEach(([k, v]) => {
        if (!res.headers.has(k)) res.headers.set(k, v);
      });
      return res;
    }

    return NextResponse.json(result, { status: 200, headers });
  } catch (err: any) {
    console.error('[StrideIQ API Error]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Internal StrideIQ partner API error.',
      },
      { status: 500, headers },
    );
  }
}

export function publicStrideIqJson(
  request: NextRequest,
  body: Record<string, unknown>,
  status: number = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...buildStrideIqCorsHeaders(request),
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    },
  });
}

