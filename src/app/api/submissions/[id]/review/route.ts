import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/auth/serverAuth';
import { getSubmissionById, saveSubmission, recordReview } from '@/lib/server/submissionStore';
import { EmailNotificationService } from '@/lib/server/emailService';
import { ReviewRecord } from '@/types/submission';

export const runtime = 'nodejs';

const PRODUCTION_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://chancetekone.us';

/**
 * POST /api/submissions/[id]/review
 * Human-in-the-Loop administrative review action (Approve, Reject, Request Changes).
 * Strictly requires authorized administrator credentials.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyServerAdmin(request);
    if (!auth.authorized) {
      return (
        auth.response ||
        NextResponse.json({ success: false, error: 'Administrator authority required.' }, { status: 403 })
      );
    }

    const { id } = await params;
    const submission = getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = body.action as 'approve' | 'reject' | 'changes_requested' | 'resend_email';

    // 0. Safe email notification retry
    if (action === 'resend_email') {
      const notifId = body.notificationId || submission.emailNotificationId;
      if (!notifId) {
        return NextResponse.json(
          { success: false, error: 'No notification identifier provided to resend.' },
          { status: 400 }
        );
      }
      const retried = await EmailNotificationService.retryNotification(notifId);
      return NextResponse.json({
        success: true,
        message: 'Notification resend attempted.',
        notification: retried,
      });
    }

    const adminEmail = auth.email || 'antgreene@chancetekone.com';
    const adminUserId = auth.role === 'super_admin' ? 'usr-chancellor' : 'usr-admin';
    const internalNotes = (body.internalNotes || '').trim();

    // 1. APPROVAL WORKFLOW
    if (action === 'approve') {
      if (!submission.originalStoragePath) {
        return NextResponse.json(
          { success: false, error: 'Cannot approve submission without valid storage asset path.' },
          { status: 400 }
        );
      }

      const publishedCatalogId = `${submission.category}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let publishedUrl = `${PRODUCTION_DOMAIN}/library`;

      if (submission.category === 'music' || submission.category === 'beats' || submission.category === 'album') {
        publishedUrl = `${PRODUCTION_DOMAIN}/music`;
      } else if (submission.category === 'video') {
        publishedUrl = `${PRODUCTION_DOMAIN}/videos`;
      } else if (submission.category === 'audiobook' || submission.category === 'book' || submission.category === 'manuscript') {
        publishedUrl = `${PRODUCTION_DOMAIN}/audiobooks`;
      } else if (submission.category === 'podcast') {
        publishedUrl = `${PRODUCTION_DOMAIN}/podcasts`;
      } else if (submission.category === 'artwork' || submission.category === 'painting') {
        publishedUrl = `${PRODUCTION_DOMAIN}/merch`;
      }

      submission.moderationStatus = 'approved';
      submission.publicationStatus = 'published';
      submission.publishedCatalogId = publishedCatalogId;
      submission.publishedCatalogType =
        submission.category === 'music' || submission.category === 'beats'
          ? 'track'
          : submission.category === 'album'
          ? 'album'
          : submission.category === 'video'
          ? 'video'
          : submission.category === 'audiobook' || submission.category === 'book'
          ? 'audiobook'
          : submission.category === 'podcast'
          ? 'podcast'
          : 'document';

      submission.reviewedAt = new Date().toISOString();
      submission.reviewedBy = adminEmail;
      submission.publishedAt = new Date().toISOString();
      submission.internalAdminNotes = internalNotes || submission.internalAdminNotes;
      submission.rejectionReason = undefined;

      // Record Review Audit
      const reviewRecord: ReviewRecord = {
        reviewId: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        submissionId: submission.submissionId,
        submissionVersion: submission.version,
        administratorUserId: adminUserId,
        administratorEmail: adminEmail,
        decision: 'approved',
        internalNotes,
        reviewedAt: new Date().toISOString(),
      };
      recordReview(reviewRecord);

      // Automated Transactional Email Dispatch (Approval)
      let notificationRecord;
      try {
        notificationRecord = await EmailNotificationService.sendApprovalEmail({
          submissionId: submission.submissionId,
          creatorUserId: submission.creatorUserId,
          recipientEmail: submission.creatorEmailSnapshot,
          creatorName: submission.creatorDisplayNameSnapshot || submission.creatorOrArtistName,
          contentTitle: submission.title,
          contentCategory: submission.subtype || submission.category,
          publishedUrl,
        });

        submission.emailNotificationStatus = notificationRecord.deliveryStatus;
        submission.emailNotificationId = notificationRecord.notificationId;
        submission.lastEmailSentAt = notificationRecord.sentAt;
      } catch (emailErr: any) {
        console.warn('[ReviewRoute] Approval email error:', emailErr);
        submission.emailNotificationStatus = 'failed';
        submission.lastEmailError = emailErr?.message || 'Email delivery failed';
      }

      const saved = saveSubmission(submission);

      return NextResponse.json({
        success: true,
        message: `Submission approved and successfully published to ChanceTEKone catalog. Confirmation email dispatched to ${submission.creatorEmailSnapshot}.`,
        submission: saved,
        notification: notificationRecord,
      });
    }

    // 2. REJECTION WORKFLOW
    if (action === 'reject') {
      const rejectionReason = (body.rejectionReason || body.creatorFacingReason || '').trim();

      // Mandatory validation: Rejection reason cannot be blank or whitespace-only
      if (!rejectionReason) {
        return NextResponse.json(
          {
            success: false,
            error: 'A detailed, constructive rejection reason is mandatory when rejecting a submission.',
          },
          { status: 400 }
        );
      }

      submission.moderationStatus = 'rejected';
      submission.publicationStatus = 'unpublished';
      submission.rejectionReason = rejectionReason;
      submission.internalAdminNotes = internalNotes || submission.internalAdminNotes;
      submission.reviewedAt = new Date().toISOString();
      submission.reviewedBy = adminEmail;

      // Record Review Audit
      const reviewRecord: ReviewRecord = {
        reviewId: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        submissionId: submission.submissionId,
        submissionVersion: submission.version,
        administratorUserId: adminUserId,
        administratorEmail: adminEmail,
        decision: 'rejected',
        creatorFacingReason: rejectionReason,
        internalNotes,
        reviewedAt: new Date().toISOString(),
      };
      recordReview(reviewRecord);

      // Automated Transactional Email Dispatch (Rejection with actual admin reason)
      let notificationRecord;
      try {
        notificationRecord = await EmailNotificationService.sendRejectionEmail({
          submissionId: submission.submissionId,
          creatorUserId: submission.creatorUserId,
          recipientEmail: submission.creatorEmailSnapshot,
          creatorName: submission.creatorDisplayNameSnapshot || submission.creatorOrArtistName,
          contentTitle: submission.title,
          contentCategory: submission.subtype || submission.category,
          rejectionReason,
        });

        submission.emailNotificationStatus = notificationRecord.deliveryStatus;
        submission.emailNotificationId = notificationRecord.notificationId;
        submission.lastEmailSentAt = notificationRecord.sentAt;
      } catch (emailErr: any) {
        console.warn('[ReviewRoute] Rejection email error:', emailErr);
        submission.emailNotificationStatus = 'failed';
        submission.lastEmailError = emailErr?.message || 'Email delivery failed';
      }

      const saved = saveSubmission(submission);

      return NextResponse.json({
        success: true,
        message: `Submission rejected. Rejection notification containing the actual feedback was queued for ${submission.creatorEmailSnapshot}.`,
        submission: saved,
        notification: notificationRecord,
      });
    }

    // 3. REQUEST CHANGES WORKFLOW
    if (action === 'changes_requested') {
      const changesNotes = (body.changesRequestedNotes || body.rejectionReason || '').trim();
      if (!changesNotes) {
        return NextResponse.json(
          { success: false, error: 'Please provide instructions detailing what changes are requested.' },
          { status: 400 }
        );
      }

      submission.moderationStatus = 'changes_requested';
      submission.publicationStatus = 'unpublished';
      submission.changesRequestedNotes = changesNotes;
      submission.internalAdminNotes = internalNotes || submission.internalAdminNotes;
      submission.reviewedAt = new Date().toISOString();
      submission.reviewedBy = adminEmail;

      const reviewRecord: ReviewRecord = {
        reviewId: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        submissionId: submission.submissionId,
        submissionVersion: submission.version,
        administratorUserId: adminUserId,
        administratorEmail: adminEmail,
        decision: 'changes_requested',
        creatorFacingReason: changesNotes,
        internalNotes,
        reviewedAt: new Date().toISOString(),
      };
      recordReview(reviewRecord);

      const saved = saveSubmission(submission);

      return NextResponse.json({
        success: true,
        message: 'Changes requested. Creator notified in Creator Studio.',
        submission: saved,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported review action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process review action.' },
      { status: 500 }
    );
  }
}
