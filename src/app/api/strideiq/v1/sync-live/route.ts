import { NextRequest } from 'next/server';
import { GET as syncGet, POST as syncPost, OPTIONS as syncOptions } from '../sync/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return syncOptions(request);
}

export async function GET(request: NextRequest) {
  return syncGet(request);
}

export async function POST(request: NextRequest) {
  return syncPost(request);
}

