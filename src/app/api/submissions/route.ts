import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser, verifyServerAdmin } from '@/lib/auth/serverAuth';
import { getAllSubmissions, saveSubmission } from '@/lib/server/submissionStore';
import { CreatorSubmission, SUBMISSION_CATEGORIES } from '@/types/submission';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/submissions
 * Lists creator submissions.
 * - Administrators can view all submissions across all creators with optional filters.
 * - Creators can view ONLY their own submissions.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return auth.response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');
    const creatorFilter = searchParams.get('creatorId');

    let all = getAllSubmissions();

    // If not admin, strictly restrict to the authenticated creator's submissions
    if (!auth.isAdmin) {
      const userEmail = (auth.email || '').toLowerCase();
      all = all.filter(
        (s) =>
          s.creatorUserId === auth.userId ||
          (userEmail && s.creatorEmailSnapshot.toLowerCase() === userEmail)
      );
    } else if (creatorFilter) {
      all = all.filter((s) => s.creatorUserId === creatorFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      all = all.filter((s) => s.moderationStatus === statusFilter);
    }

    if (categoryFilter && categoryFilter !== 'all') {
      all = all.filter((s) => s.category === categoryFilter);
    }

    return NextResponse.json({
      success: true,
      totalCount: all.length,
      submissions: all,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve submissions.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/submissions
 * Creates a new creative work submission from an authenticated creator.
 * Enforces mandatory valid email, copyright ownership certification, and required metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return auth.response || NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // 1. Mandatory Email Validation
    const emailToUse = (auth.email || body.creatorEmail || '').trim().toLowerCase();
    if (!emailToUse || !EMAIL_REGEX.test(emailToUse)) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid, verified email address is mandatory to submit creative works for review.',
        },
        { status: 400 }
      );
    }

    // 2. Validate Required Fields
    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Content title is required.' },
        { status: 400 }
      );
    }

    const creatorOrArtistName = (body.creatorOrArtistName || body.artistName || '').trim();
    if (!creatorOrArtistName) {
      return NextResponse.json(
        { success: false, error: 'Creator or artist moniker is required.' },
        { status: 400 }
      );
    }

    const category = body.category;
    const validCategory = SUBMISSION_CATEGORIES.find((c) => c.id === category);
    if (!validCategory) {
      return NextResponse.json(
        { success: false, error: `Invalid content category: ${category}` },
        { status: 400 }
      );
    }

    // 3. Mandatory Copyright Declaration
    if (!body.copyrightDeclaration) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must certify the copyright and master ownership declaration before submitting.',
        },
        { status: 400 }
      );
    }

    const isDraft = body.isDraft === true;
    const submissionId =
      body.submissionId || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const submission: CreatorSubmission = {
      submissionId,
      creatorUserId: auth.userId,
      creatorEmailSnapshot: emailToUse,
      creatorDisplayNameSnapshot: body.creatorDisplayName || creatorOrArtistName,

      title,
      category,
      subtype: body.subtype || validCategory.label,
      creatorOrArtistName,
      description: (body.description || '').trim(),
      genre: (body.genre || 'Independent').trim(),
      releaseDate: body.releaseDate || new Date().toISOString().split('T')[0],
      copyrightDeclaration: true,
      copyrightNotice:
        body.copyrightNotice || `© ${new Date().getFullYear()} ${creatorOrArtistName}. All Rights Reserved.`,
      credits: body.credits || '',
      collaborators: body.collaborators || '',

      originalStoragePath: body.originalStoragePath || body.mediaUrl || '',
      previewStoragePath: body.previewStoragePath || '',
      coverUrl: body.coverUrl || '', // Honors user directive: empty string for no cover art
      fileName: body.fileName || 'creative_work',
      fileSize: Number(body.fileSize) || 0,
      detectedMimeType: body.detectedMimeType || 'application/octet-stream',
      mediaFormat: body.mediaFormat || validCategory.mediaFormat,
      durationSeconds: Number(body.durationSeconds) || 0,

      moderationStatus: isDraft ? 'draft' : 'pending_review',
      publicationStatus: 'unpublished',
      version: 1,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: isDraft ? undefined : new Date().toISOString(),

      emailNotificationStatus: 'idle',
    };

    const saved = saveSubmission(submission);

    return NextResponse.json({
      success: true,
      submissionId: saved.submissionId,
      moderationStatus: saved.moderationStatus,
      message: isDraft
        ? 'Draft saved successfully.'
        : 'Submission received and securely queued in the administrative holding area for review.',
      submission: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process submission.' },
      { status: 500 }
    );
  }
}
