import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    serverTimestamp: new Date().toISOString(),
    operator: auth.email,
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { action, targetUserId, newRole, newStatus } = body;

    return NextResponse.json({
      success: true,
      action,
      targetUserId,
      newRole,
      newStatus,
      performedBy: auth.email,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'User management API error' },
      { status: 500 }
    );
  }
}
