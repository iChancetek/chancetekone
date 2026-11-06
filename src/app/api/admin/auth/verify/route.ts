import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: {
      email: auth.email,
      role: auth.role,
      verifiedAt: new Date().toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: {
      email: auth.email,
      role: auth.role,
      verifiedAt: new Date().toISOString(),
    },
  });
}
