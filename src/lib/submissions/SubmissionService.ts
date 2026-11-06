/**
 * 8 Of Spades Works — Creator Submission & Moderation Client Service
 * Coordinates communication between Creator Studio, Administrative Holding Area,
 * and backend submission APIs.
 */

import { CreatorSubmission, ReviewRecord, NotificationRecord } from '@/types/submission';

const LOCAL_CACHE_KEY = 'spades_creator_submissions_cache_v1';

class SubmissionServiceClass {
  private submissions: CreatorSubmission[] = [];
  private listeners: Set<() => void> = new Set();
  private isLoading: boolean = false;
  private lastFetchedAt: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadCached();
    }
  }

  private loadCached() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.submissions = parsed;
        }
      }
    } catch (e) {
      console.warn('[SubmissionService] Failed to load cached submissions:', e);
    }
  }

  private persistCached() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(this.submissions));
    } catch (e) {
      console.warn('[SubmissionService] Failed to persist submissions cache:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.persistCached();
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn('[SubmissionService] Listener error:', err);
      }
    });
  }

  public getCachedSubmissions(): CreatorSubmission[] {
    return this.submissions;
  }

  /**
   * Fetches submissions from the server API.
   */
  public async fetchSubmissions(options?: {
    creatorId?: string;
    status?: string;
    category?: string;
    adminEmail?: string;
    authToken?: string;
  }): Promise<CreatorSubmission[]> {
    this.isLoading = true;
    try {
      const params = new URLSearchParams();
      if (options?.creatorId) params.set('creatorId', options.creatorId);
      if (options?.status && options.status !== 'all') params.set('status', options.status);
      if (options?.category && options.category !== 'all') params.set('category', options.category);

      const headers: Record<string, string> = {};
      if (options?.adminEmail) {
        headers['x-admin-email'] = options.adminEmail;
        headers['x-admin-role'] = 'admin';
      }
      if (options?.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
      }

      const res = await fetch(`/api/submissions?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.submissions)) {
          this.submissions = data.submissions;
          this.lastFetchedAt = Date.now();
          this.notify();
          return this.submissions;
        }
      }
    } catch (err) {
      console.warn('[SubmissionService] Fetch error:', err);
    } finally {
      this.isLoading = false;
    }
    return this.submissions;
  }

  /**
   * Uploads creative work asset and companion cover
   */
  public async uploadAsset(args: {
    file: File;
    coverFile?: File | null;
    noCoverArt?: boolean;
    category: string;
    userEmail?: string;
    userId?: string;
    authToken?: string;
  }): Promise<{
    success: boolean;
    mediaUrl?: string;
    coverUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    mediaFormat?: 'audio' | 'video' | 'pdf' | 'document' | 'image';
    isMov?: boolean;
    error?: string;
  }> {
    const formData = new FormData();
    formData.append('file', args.file);
    if (args.coverFile && !args.noCoverArt) {
      formData.append('cover', args.coverFile);
    }
    if (args.noCoverArt) {
      formData.append('noCoverArt', 'true');
    }
    formData.append('category', args.category);

    const headers: Record<string, string> = {};
    if (args.userEmail) headers['x-user-email'] = args.userEmail;
    if (args.userId) headers['x-user-id'] = args.userId;
    if (args.authToken) headers['Authorization'] = `Bearer ${args.authToken}`;

    try {
      const res = await fetch('/api/submissions/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return data;
      }
      return { success: false, error: data.error || 'Upload failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Upload connection failed' };
    }
  }

  /**
   * Submits creative work for administrative review or saves draft
   */
  public async submitCreativeWork(
    payload: any,
    options?: { userEmail?: string; userId?: string; authToken?: string }
  ): Promise<{ success: boolean; submission?: CreatorSubmission; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.userEmail) headers['x-user-email'] = options.userEmail;
    if (options?.userId) headers['x-user-id'] = options.userId;
    if (options?.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.submission) {
        // Upsert into client collection
        const idx = this.submissions.findIndex((s) => s.submissionId === data.submission.submissionId);
        if (idx >= 0) {
          this.submissions[idx] = data.submission;
        } else {
          this.submissions.unshift(data.submission);
        }
        this.notify();
        return { success: true, submission: data.submission };
      }
      return { success: false, error: data.error || 'Submission failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error submitting work' };
    }
  }

  /**
   * Updates an existing submission (e.g. resubmitting corrected work)
   */
  public async updateSubmission(
    submissionId: string,
    updates: any,
    options?: { userEmail?: string; userId?: string; authToken?: string }
  ): Promise<{ success: boolean; submission?: CreatorSubmission; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.userEmail) headers['x-user-email'] = options.userEmail;
    if (options?.userId) headers['x-user-id'] = options.userId;
    if (options?.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;

    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (res.ok && data.success && data.submission) {
        const idx = this.submissions.findIndex((s) => s.submissionId === submissionId);
        if (idx >= 0) {
          this.submissions[idx] = data.submission;
        } else {
          this.submissions.unshift(data.submission);
        }
        this.notify();
        return { success: true, submission: data.submission };
      }
      return { success: false, error: data.error || 'Update failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error updating submission' };
    }
  }

  /**
   * Withdraws a submission from review
   */
  public async withdrawSubmission(
    submissionId: string,
    options?: { userEmail?: string; userId?: string; authToken?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const headers: Record<string, string> = {};
    if (options?.userEmail) headers['x-user-email'] = options.userEmail;
    if (options?.userId) headers['x-user-id'] = options.userId;
    if (options?.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;

    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const item = this.submissions.find((s) => s.submissionId === submissionId);
        if (item) {
          item.moderationStatus = 'withdrawn';
          item.publicationStatus = 'unpublished';
          this.notify();
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Withdrawal failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error withdrawing submission' };
    }
  }

  /**
   * Performs an administrative human-in-the-loop review decision
   */
  public async reviewSubmission(
    submissionId: string,
    action: 'approve' | 'reject' | 'changes_requested' | 'resend_email',
    payload: {
      rejectionReason?: string;
      internalNotes?: string;
      changesRequestedNotes?: string;
      notificationId?: string;
    },
    adminAuth: { adminEmail: string; authToken?: string }
  ): Promise<{ success: boolean; submission?: CreatorSubmission; notification?: NotificationRecord; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-email': adminAuth.adminEmail,
      'x-admin-role': 'admin',
    };
    if (adminAuth.authToken) {
      headers['Authorization'] = `Bearer ${adminAuth.authToken}`;
    }

    try {
      const res = await fetch(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.submission) {
          const idx = this.submissions.findIndex((s) => s.submissionId === submissionId);
          if (idx >= 0) {
            this.submissions[idx] = data.submission;
          } else {
            this.submissions.unshift(data.submission);
          }
          this.notify();
        }
        return {
          success: true,
          submission: data.submission,
          notification: data.notification,
        };
      }
      return { success: false, error: data.error || 'Review action failed' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during review' };
    }
  }
}

export const SubmissionService = new SubmissionServiceClass();
