import { NextRequest, NextResponse } from 'next/server';
import { verifyServerUser } from '@/lib/auth/serverAuth';
import { getSubmissionById, saveSubmission, deleteSubmission } from '@/lib/server/submissionStore';
import { CreatorSubmission } from '@/types/submission';

export const runtime = 'nodejs';

/**
 * GET /api/submissions/[id]
 * Retrieves details for a specific submission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return auth.response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const submission = getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    // Access control: only submission owner or platform admin
    if (!auth.isAdmin && submission.creatorUserId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Access Denied: You do not have permission to view this submission.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      submission,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/submissions/[id]
 * Updates metadata, resubmits corrected content, or saves draft.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return auth.response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const existing = getSubmissionById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    // Access control
    if (!auth.isAdmin && existing.creatorUserId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Access Denied: You can only modify your own submissions.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Creators cannot arbitrarily mark their own content approved or published
    if (!auth.isAdmin && (body.moderationStatus === 'approved' || body.moderationStatus === 'published')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Creators cannot self-approve content.' },
        { status: 403 }
      );
    }

    const isResubmission =
      existing.moderationStatus === 'rejected' ||
      existing.moderationStatus === 'changes_requested' ||
      existing.moderationStatus === 'draft';

    const willSubmitForReview = body.submitForReview === true;

    const updated: CreatorSubmission = {
      ...existing,
      title: body.title !== undefined ? (body.title || '').trim() : existing.title,
      creatorOrArtistName:
        body.creatorOrArtistName !== undefined ? (body.creatorOrArtistName || '').trim() : existing.creatorOrArtistName,
      description: body.description !== undefined ? body.description : existing.description,
      genre: body.genre !== undefined ? body.genre : existing.genre,
      releaseDate: body.releaseDate !== undefined ? body.releaseDate : existing.releaseDate,
      credits: body.credits !== undefined ? body.credits : existing.credits,
      collaborators: body.collaborators !== undefined ? body.collaborators : existing.collaborators,
      coverUrl: body.coverUrl !== undefined ? body.coverUrl : existing.coverUrl,
      originalStoragePath: body.originalStoragePath || body.mediaUrl || existing.originalStoragePath,
      fileName: body.fileName || existing.fileName,
      fileSize: body.fileSize !== undefined ? Number(body.fileSize) : existing.fileSize,
      detectedMimeType: body.detectedMimeType || existing.detectedMimeType,
      mediaFormat: body.mediaFormat || existing.mediaFormat,
      durationSeconds: body.durationSeconds !== undefined ? Number(body.durationSeconds) : existing.durationSeconds,

      version: willSubmitForReview && isResubmission ? existing.version + 1 : existing.version,
      moderationStatus: willSubmitForReview
        ? 'pending_review'
        : body.moderationStatus || existing.moderationStatus,
      submittedAt: willSubmitForReview ? new Date().toISOString() : existing.submittedAt,

      // Clear previous rejection feedback when a new corrected version is submitted for review
      rejectionReason: willSubmitForReview ? undefined : existing.rejectionReason,
      changesRequestedNotes: willSubmitForReview ? undefined : existing.changesRequestedNotes,
    };

    const saved = saveSubmission(updated);

    return NextResponse.json({
      success: true,
      message: willSubmitForReview
        ? 'Corrected version successfully resubmitted to administrative holding area.'
        : 'Submission updated successfully.',
      submission: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update submission' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/submissions/[id]
 * Withdraws or removes a submission before publication.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await verifyServerUser(request);
    if (!auth.authenticated || !auth.userId) {
      return auth.response || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const existing = getSubmissionById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    if (!auth.isAdmin && existing.creatorUserId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Access Denied: You can only withdraw your own submissions.' },
        { status: 403 }
      );
    }

    // If already published, withdrawal requires admin authority
    if (existing.publicationStatus === 'published' && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Published content must be unlisted by platform administration.' },
        { status: 400 }
      );
    }

    // Set status to withdrawn
    existing.moderationStatus = 'withdrawn';
    existing.publicationStatus = 'unpublished';
    saveSubmission(existing);

    return NextResponse.json({
      success: true,
      message: 'Submission withdrawn from the review queue.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to withdraw submission' },
      { status: 500 }
    );
  }
}
