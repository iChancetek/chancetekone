/**
 * ChanceTEK One — Server-Side Creator Submission Persistence
 * Stores creator uploads, review holding items, review audit history,
 * and maintains atomic status transitions.
 */

import fs from 'fs';
import path from 'path';
import { CreatorSubmission, ReviewRecord } from '@/types/submission';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'creator-submissions.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'submission-reviews.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function getAllSubmissions(): CreatorSubmission[] {
  try {
    ensureDataFiles();
    const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SubmissionStore] Failed to read submissions file:', err);
    return [];
  }
}

export function getSubmissionById(id: string): CreatorSubmission | null {
  const all = getAllSubmissions();
  return all.find((s) => s.submissionId === id) || null;
}

export function saveSubmission(submission: CreatorSubmission): CreatorSubmission {
  ensureDataFiles();
  const list = getAllSubmissions();
  const index = list.findIndex((s) => s.submissionId === submission.submissionId);

  const updated: CreatorSubmission = {
    ...submission,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    list[index] = updated;
  } else {
    list.unshift(updated);
  }

  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');

  // Sync to Firestore in background when configured
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    getFirebaseAdmin()
      .then(({ adminDb }) => {
        if (adminDb) {
          adminDb
            .collection('creator_submissions')
            .doc(submission.submissionId)
            .set(updated, { merge: true })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  return updated;
}

export function deleteSubmission(id: string): boolean {
  ensureDataFiles();
  const list = getAllSubmissions();
  const filtered = list.filter((s) => s.submissionId !== id);
  if (filtered.length !== list.length) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      getFirebaseAdmin()
        .then(({ adminDb }) => {
          if (adminDb) {
            adminDb
              .collection('creator_submissions')
              .doc(id)
              .delete()
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
    return true;
  }
  return false;
}

export function getAllReviews(): ReviewRecord[] {
  try {
    ensureDataFiles();
    const raw = fs.readFileSync(REVIEWS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SubmissionStore] Failed to read reviews file:', err);
    return [];
  }
}

export function recordReview(review: ReviewRecord): ReviewRecord {
  ensureDataFiles();
  const reviews = getAllReviews();
  reviews.unshift(review);
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf-8');

  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    getFirebaseAdmin()
      .then(({ adminDb }) => {
        if (adminDb) {
          adminDb
            .collection('submission_reviews')
            .doc(review.reviewId)
            .set(review, { merge: true })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  return review;
}

export function getReviewsForSubmission(submissionId: string): ReviewRecord[] {
  const reviews = getAllReviews();
  return reviews.filter((r) => r.submissionId === submissionId);
}
