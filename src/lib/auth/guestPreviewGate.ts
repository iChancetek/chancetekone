/**
 * ChanceTEK One — 2-Listen Guest Preview Gate for Shared Music Links
 *
 * Allows visitors without an account who arrive via a shared music link up to 2 listens,
 * then automatically gates playback and redirects them to sign up with the required message:
 * "To continue enjoying music like this, please create an account on the platform."
 */

export const GUEST_SIGNUP_GATE_MESSAGE =
  'To continue enjoying music like this, please create an account on the platform.';

export const MAX_GUEST_SHARED_LISTENS = 2;

const GUEST_PREVIEW_STORAGE_KEY = 'chancetek_guest_shared_preview_v1';
const GUEST_SHARED_SESSION_KEY = 'chancetek_shared_music_arrival_v1';
const GUEST_PREVIEW_EVENT = 'chancetek-guest-preview-updated';

interface StoredGuestPreviewData {
  listenCount: number;
  listenedTrackIds: string[];
  sharedArrival: boolean;
  firstOpenedAt: number;
  lastTrackId?: string;
  limitReachedAt?: number;
}

export interface GuestPreviewState {
  isSharedGuest: boolean;
  listensUsed: number;
  listensRemaining: number;
  limitReached: boolean;
  maxListens: number;
  lastTrackId?: string;
}

function readStoredData(): StoredGuestPreviewData {
  if (typeof window === 'undefined') {
    return {
      listenCount: 0,
      listenedTrackIds: [],
      sharedArrival: false,
      firstOpenedAt: Date.now(),
    };
  }
  try {
    const raw = window.localStorage.getItem(GUEST_PREVIEW_STORAGE_KEY);
    if (!raw) {
      return {
        listenCount: 0,
        listenedTrackIds: [],
        sharedArrival: false,
        firstOpenedAt: Date.now(),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      listenCount: Math.max(0, Number(parsed?.listenCount) || 0),
      listenedTrackIds: Array.isArray(parsed?.listenedTrackIds) ? parsed.listenedTrackIds : [],
      sharedArrival: Boolean(parsed?.sharedArrival),
      firstOpenedAt: Number(parsed?.firstOpenedAt) || Date.now(),
      lastTrackId: typeof parsed?.lastTrackId === 'string' ? parsed.lastTrackId : undefined,
      limitReachedAt: typeof parsed?.limitReachedAt === 'number' ? parsed.limitReachedAt : undefined,
    };
  } catch {
    return {
      listenCount: 0,
      listenedTrackIds: [],
      sharedArrival: false,
      firstOpenedAt: Date.now(),
    };
  }
}

function writeStoredData(data: StoredGuestPreviewData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_PREVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(GUEST_PREVIEW_EVENT));
  } catch {}
}

/**
 * Records that the current browser visitor arrived via a shared music link.
 */
export function markSharedMusicArrival(trackId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      GUEST_SHARED_SESSION_KEY,
      JSON.stringify({
        active: true,
        trackId: trackId || '',
        openedAt: Date.now(),
      })
    );
  } catch {}

  const current = readStoredData();
  writeStoredData({
    ...current,
    sharedArrival: true,
    lastTrackId: trackId || current.lastTrackId,
  });
}

/**
 * Returns true if the current unauthenticated visitor arrived via a shared music link.
 */
export function isSharedMusicGuestSession(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const search = window.location.search || '';
    const pathname = window.location.pathname || '';
    if (
      pathname.startsWith('/share/track/') ||
      search.includes('shared=1') ||
      search.includes('from=shared')
    ) {
      return true;
    }
  } catch {}

  try {
    const rawSession = window.sessionStorage.getItem(GUEST_SHARED_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.active) return true;
    }
  } catch {}

  return readStoredData().sharedArrival;
}

/**
 * Returns the live 2-listen guest preview gate status.
 */
export function getGuestPreviewState(): GuestPreviewState {
  const data = readStoredData();
  const isSharedGuest = isSharedMusicGuestSession();
  const listensUsed = Math.max(0, data.listenCount);
  const listensRemaining = Math.max(0, MAX_GUEST_SHARED_LISTENS - listensUsed);
  return {
    isSharedGuest,
    listensUsed,
    listensRemaining,
    limitReached: listensUsed >= MAX_GUEST_SHARED_LISTENS,
    maxListens: MAX_GUEST_SHARED_LISTENS,
    lastTrackId: data.lastTrackId,
  };
}

/**
 * Attempts to consume 1 of the visitor's 2 allowed guest preview listens.
 * Returns `{ allowed: true }` for listens 1 and 2; `{ allowed: false }` once 2 listens are exhausted.
 */
export function consumeGuestPreviewListen(trackId: string): {
  allowed: boolean;
  listensUsed: number;
  listensRemaining: number;
  justReachedLimit: boolean;
} {
  const data = readStoredData();
  if (data.listenCount >= MAX_GUEST_SHARED_LISTENS) {
    return {
      allowed: false,
      listensUsed: data.listenCount,
      listensRemaining: 0,
      justReachedLimit: false,
    };
  }

  const nextCount = data.listenCount + 1;
  const nextList = [...data.listenedTrackIds.slice(-9), trackId];
  const justReachedLimit = nextCount >= MAX_GUEST_SHARED_LISTENS;

  writeStoredData({
    ...data,
    sharedArrival: true,
    listenCount: nextCount,
    listenedTrackIds: nextList,
    lastTrackId: trackId,
    limitReachedAt: justReachedLimit ? Date.now() : data.limitReachedAt,
  });

  return {
    allowed: true,
    listensUsed: nextCount,
    listensRemaining: Math.max(0, MAX_GUEST_SHARED_LISTENS - nextCount),
    justReachedLimit,
  };
}

/**
 * Clears guest preview session flags once a visitor signs in or creates an account.
 */
export function clearGuestSharedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(GUEST_SHARED_SESSION_KEY);
  } catch {}
  try {
    window.localStorage.removeItem(GUEST_PREVIEW_STORAGE_KEY);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(GUEST_PREVIEW_EVENT));
  } catch {}
}

/**
 * Subscribes to real-time updates to guest preview count across components and tabs.
 */
export function subscribeGuestPreview(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(GUEST_PREVIEW_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(GUEST_PREVIEW_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Builds the automatic sign-up redirect URL preserving the shared track context.
 */
export function buildGuestSignupRedirectUrl(trackId?: string): string {
  const params = new URLSearchParams();
  params.set('from', 'shared');
  if (trackId) params.set('track', trackId);
  return `/signup?${params.toString()}`;
}

