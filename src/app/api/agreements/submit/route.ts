import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), '.data');
const AGREEMENTS_FILE = path.join(DATA_DIR, 'distribution-agreements.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AGREEMENTS_FILE)) {
    fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function isMockRecord(a: any) {
  if (!a || !a.id) return true;
  return (
    a.id.includes('TEST') ||
    a.id.includes('CHANC1') ||
    a.id.includes('LUNABR') ||
    a.id.includes('SUBZRO') ||
    a.id.includes('KINETC') ||
    a.email === 'luna.brass@breakbeatworks.net' ||
    a.email === 'marcus.vance@subzeroaudio.io' ||
    a.email === 'elena@kineticmotion.art' ||
    a.email === 'apex.sound@example.com'
  );
}

/**
 * GET /api/agreements/submit
 * Lists all submitted distribution agreements for administrators.
 */
export async function GET() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(AGREEMENTS_FILE, 'utf-8');
    const all = JSON.parse(raw);
    const agreements = Array.isArray(all) ? all.filter((a) => !isMockRecord(a)) : [];
    if (Array.isArray(all) && all.length !== agreements.length) {
      fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify(agreements, null, 2), 'utf-8');
    }
    return NextResponse.json({
      status: 'success',
      totalCount: agreements.length,
      agreements,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Failed to read agreements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/submit
 * Accepts an executed agreement and records it into server persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (!payload.artistLegalName || !payload.artistMoniker || !payload.email || !payload.signatureData) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required agreement execution fields.' },
        { status: 400 }
      );
    }

    ensureDataFile();
    const raw = fs.readFileSync(AGREEMENTS_FILE, 'utf-8');
    const list = JSON.parse(raw);

    list.unshift({
      ...payload,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Unknown Client',
      serverRecordedAt: new Date().toISOString(),
    });

    fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');

    return NextResponse.json({
      status: 'success',
      agreementId: payload.id,
      message: 'Agreement successfully submitted to ChanceTEK One administrative registry.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Failed to record agreement' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agreements/submit
 * Updates agreement status and administrative notes for Human-in-the-Loop review.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, status, adminNotes, reviewedBy } = await req.json();
    if (!id || !status) {
      return NextResponse.json(
        { status: 'error', error: 'id and status are required' },
        { status: 400 }
      );
    }

    ensureDataFile();
    const raw = fs.readFileSync(AGREEMENTS_FILE, 'utf-8');
    const list = JSON.parse(raw);
    const target = list.find((a: any) => a.id === id);
    if (!target) {
      return NextResponse.json(
        { status: 'error', error: 'Agreement not found' },
        { status: 404 }
      );
    }

    target.status = status;
    if (adminNotes !== undefined) target.adminNotes = adminNotes;
    target.reviewedBy = reviewedBy || 'Administrator';
    target.reviewedAt = new Date().toISOString();

    fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');

    return NextResponse.json({
      status: 'success',
      agreement: target,
      message: `Agreement ${id} status updated to ${status}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Failed to update agreement' },
      { status: 500 }
    );
  }
}

