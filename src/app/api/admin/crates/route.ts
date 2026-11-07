import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { OFFICIAL_CRATES } from '@/types/catalog';

export async function GET(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    crates: OFFICIAL_CRATES,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyServerAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const { crateId, name, artistName, description } = body;

    if (!crateId || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: crateId and name' },
        { status: 400 }
      );
    }

    const newFolder = {
      id: `folder-${Date.now()}`,
      crateId,
      name,
      artistName: artistName || 'ChanceTEKone',
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: auth.email,
    };

    return NextResponse.json({
      success: true,
      folder: newFolder,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
