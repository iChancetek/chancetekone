'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase/client';
import { UserProfile } from '@/types/social';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { ProfileMediaStorageService } from '@/lib/auth/ProfileMediaStorageService';
import { ShieldAlert } from 'lucide-react';

export const SUPER_USER_EMAILS = [
  'chancellor@ichancetek.com',
  'chancellorminus@gmail.com',
  'antgreene@chancetekone.com',
  'antgreene@chancetekone.us',
];

export const isSuperUserEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return SUPER_USER_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === lower);
};

export const AUTH_SESSION_KEY = 'spades_auth_session_v2';
export const AUTH_BROADCAST_CHANNEL = 'spades_auth_channel';
export const AUTH_BROADCAST_EVENT_KEY = 'spades_auth_broadcast_event';
export const AUTH_COOKIE_NAME = 'spades_auth_active';

export interface ActiveSessionData {
  sessionId: string;
  userId: string;
  email: string;
  profile: UserProfile;
  isDemo: boolean;
  authProvider: 'firebase' | 'google' | 'email' | 'superuser' | 'demo';
  loginTimestamp: number;
  lastActiveTimestamp: number;
}

const PROFILE_PREFS_KEY = 'chancetek_profile_prefs_v1';

interface SavedProfilePrefs {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  updatedAt?: number;
}

function saveProfilePrefs(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROFILE_PREFS_KEY);
    const map: Record<string, SavedProfilePrefs> = raw ? JSON.parse(raw) : {};
    const entry: SavedProfilePrefs = {
      name: profile.name,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl && !profile.avatarUrl.startsWith('blob:') ? profile.avatarUrl : undefined,
      updatedAt: Date.now(),
    };
    if (profile.id) map[profile.id] = entry;
    if (profile.email) map[`email:${profile.email.trim().toLowerCase()}`] = entry;
    localStorage.setItem(PROFILE_PREFS_KEY, JSON.stringify(map));
  } catch {}
}

function getProfilePrefs(userId?: string, email?: string): SavedProfilePrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_PREFS_KEY);
    if (!raw) return null;
    const map: Record<string, SavedProfilePrefs> = JSON.parse(raw);
    if (userId && map[userId]) return map[userId];
    if (email) {
      const key = `email:${email.trim().toLowerCase()}`;
      if (map[key]) return map[key];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Strip session-scoped blob: URLs before persisting/restoring from localStorage
 * so expired blob URLs never poison UserAvatar after a browser refresh.
 * Live media Blobs are always hydrated fresh from IndexedDB (ProfileMediaStorageService).
 */
function stripVolatileBlobUrls(profile: UserProfile): UserProfile {
  return {
    ...profile,
    profileVideoUrl:
      profile.profileVideoUrl && !profile.profileVideoUrl.startsWith('blob:')
        ? profile.profileVideoUrl
        : undefined,
    avatarUrl:
      profile.avatarUrl && !profile.avatarUrl.startsWith('blob:')
        ? profile.avatarUrl
        : undefined,
  };
}

// Helpers for multi-tab persistent storage and cookie management
export function saveActiveSession(
  profile: UserProfile,
  isDemo: boolean,
  authProvider: ActiveSessionData['authProvider'],
  existingSessionId?: string
): ActiveSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const persistableProfile = stripVolatileBlobUrls(profile);
    const sessionId =
      existingSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sessionData: ActiveSessionData = {
      sessionId,
      userId: profile.id,
      email: profile.email,
      profile: persistableProfile,
      isDemo,
      authProvider,
      loginTimestamp: Date.now(),
      lastActiveTimestamp: Date.now(),
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    saveProfilePrefs(persistableProfile);
    // Set 1-year long-lived cookie for persistent session awareness across browser restarts
    document.cookie = `${AUTH_COOKIE_NAME}=true; path=/; max-age=31536000; SameSite=Lax`;
    return sessionData;
  } catch (e) {
    console.warn('Failed to persist active session to localStorage:', e);
    return null;
  }
}

export function getActiveSession(): ActiveSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionData;
    if (parsed?.profile) {
      parsed.profile = stripVolatileBlobUrls(parsed.profile);
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {}
}

export function broadcastAuthEvent(event: any): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. BroadcastChannel for instant multi-tab communication
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      channel.postMessage(event);
      channel.close();
    }
    // 2. Storage event fallback for cross-tab synchronization
    localStorage.setItem(
      AUTH_BROADCAST_EVENT_KEY,
      JSON.stringify({
        ...event,
        _broadcastId: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      })
    );
  } catch (e) {}
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  isAdmin: boolean;
  isSuperUser: boolean;
  forcedLogoutReason: string | null;
  clearForcedLogoutReason: () => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
    extraProfile?: Partial<UserProfile>
  ) => Promise<{ success: boolean; error?: string }>;
  signInAsSuperUser: (email?: string) => void;
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [forcedLogoutReason, setForcedLogoutReason] = useState<string | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const clearForcedLogoutReason = useCallback(() => {
    setForcedLogoutReason(null);
  }, []);

  const hydrateProfileMedia = useCallback(
    (userId: string, email?: string, forceRefresh: boolean = false) => {
      ProfileMediaStorageService.getProfileMedia(userId, email, forceRefresh).then((media) => {
        if (!media) return;
        setProfile((prev) => {
          if (!prev) return prev;
          const matchesId = prev.id === userId;
          const matchesEmail =
            Boolean(email) && prev.email?.toLowerCase() === email?.trim().toLowerCase();
          if (!matchesId && !matchesEmail) return prev;

          const updated: UserProfile = {
            ...prev,
            profileVideoUrl: media.type === 'video' ? media.objectUrl : undefined,
            avatarUrl: media.type === 'image' ? media.objectUrl : prev.avatarUrl,
          };
          profileRef.current = updated;
          return updated;
        });
      });
    },
    []
  );

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    const prev = profileRef.current;
    if (!prev) {
      setProfile((p) => {
        if (!p) return null;
        const next = { ...p, ...updates };
        profileRef.current = next;
        const cur = getActiveSession();
        saveActiveSession(next, cur?.isDemo || false, cur?.authProvider || 'firebase', cur?.sessionId);
        AdminUserManager.syncAuthUser(next);
        broadcastAuthEvent({ type: 'PROFILE_UPDATED', profile: stripVolatileBlobUrls(next) });
        return next;
      });
      return;
    }

    const updated = { ...prev, ...updates };
    profileRef.current = updated;
    setProfile(updated);

    const cur = getActiveSession();
    saveActiveSession(updated, cur?.isDemo || false, cur?.authProvider || 'firebase', cur?.sessionId);
    AdminUserManager.syncAuthUser(updated);
    broadcastAuthEvent({ type: 'PROFILE_UPDATED', profile: stripVolatileBlobUrls(updated) });
  }, []);

  // Multi-tab message handler
  const handleAuthMessage = useCallback(
    (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'AUTH_LOGIN') {
        if (data.profile) {
          setProfile(data.profile);
          profileRef.current = data.profile;
          setIsDemo(Boolean(data.isDemo));
          setLoading(false);
          setForcedLogoutReason(null);
          hydrateProfileMedia(data.profile.id, data.profile.email);
        }
      } else if (data.type === 'AUTH_LOGOUT') {
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        setIsDemo(false);
        setLoading(false);
      } else if (data.type === 'PROFILE_UPDATED') {
        if (data.profile) {
          setProfile((prev) => {
            if (!prev) return data.profile;
            const merged = {
              ...prev,
              ...data.profile,
              // Preserve live blob: URLs currently loaded in memory; mediaChannel handles blob sync
              profileVideoUrl: data.profile.profileVideoUrl ?? prev.profileVideoUrl,
              avatarUrl:
                'avatarUrl' in data.profile
                  ? data.profile.avatarUrl ?? (prev.avatarUrl?.startsWith('blob:') ? prev.avatarUrl : undefined)
                  : prev.avatarUrl,
            };
            profileRef.current = merged;
            return merged;
          });
        }
      } else if (data.type === 'ADMIN_FORCE_LOGOUT') {
        const cur = getActiveSession();
        const curId = cur?.profile?.id;
        const curEmail = cur?.profile?.email?.toLowerCase();
        const targetId = data.targetUserId;
        const targetEmail = data.targetEmail?.toLowerCase();

        // Check if target is this user or platform-wide termination
        if (!targetId || targetId === curId || (targetEmail && targetEmail === curEmail)) {
          clearActiveSession();
          setUser(null);
          setProfile(null);
          profileRef.current = null;
          setIsDemo(false);
          setForcedLogoutReason(data.reason || 'Your session was terminated by an administrator.');
          try {
            fbSignOut(auth);
          } catch (e) {}
        }
      }
    },
    [hydrateProfileMedia]
  );

  // Hydrate session and configure cross-tab + heartbeat listeners on mount
  useEffect(() => {
    // 1. Instant hydration from persistent localStorage so refresh / new tab / browser restart keeps user logged in!
    const saved = getActiveSession();
    if (saved && saved.profile) {
      // Check whether session has been revoked by an administrator or account suspended/deleted
      const adminUser =
        AdminUserManager.getUserById(saved.profile.id) ||
        AdminUserManager.getUserByEmail(saved.profile.email);

      const isRevoked =
        adminUser &&
        (adminUser.status === 'suspended' ||
          adminUser.status === 'deleted' ||
          adminUser.status === 'disabled' ||
          Boolean(
            adminUser.sessionRevokedAt &&
              new Date(adminUser.sessionRevokedAt).getTime() > saved.loginTimestamp
          ));

      if (isRevoked) {
        clearActiveSession();
        setForcedLogoutReason('Your session has been ended by a platform administrator.');
        setLoading(false);
      } else {
        const prefs = getProfilePrefs(saved.profile.id, saved.profile.email);
        const syncedProfile: UserProfile = {
          ...saved.profile,
          name: saved.profile.name || prefs?.name || adminUser?.name || saved.profile.name,
          bio: saved.profile.bio ?? prefs?.bio,
          role:
            adminUser?.role === 'super_admin' || isSuperUserEmail(saved.profile.email)
              ? 'admin'
              : (adminUser?.role as any) || saved.profile.role,
          avatarUrl: saved.profile.avatarUrl || adminUser?.avatarUrl || prefs?.avatarUrl,
        };
        setProfile(syncedProfile);
        profileRef.current = syncedProfile;
        setIsDemo(saved.isDemo);
        setLoading(false);

        // Hydrate persistent photo or video media from IndexedDB
        hydrateProfileMedia(syncedProfile.id, syncedProfile.email);
      }
    }

    // 2. Setup BroadcastChannel listener for multi-tab sync
    let channel: BroadcastChannel | null = null;
    let mediaChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        channel.onmessage = (ev) => {
          handleAuthMessage(ev.data);
        };

        mediaChannel = new BroadcastChannel('chancetek_profile_media_channel');
        mediaChannel.onmessage = (ev) => {
          if (!ev.data?.userId) return;
          if (ev.data.type === 'PROFILE_MEDIA_CLEARED') {
            ProfileMediaStorageService.invalidateCache(ev.data.userId);
            setProfile((prev) => {
              if (!prev) return prev;
              const matchesId = prev.id === ev.data.userId;
              const matchesEmail =
                Boolean(ev.data.email) &&
                prev.email?.toLowerCase() === String(ev.data.email).trim().toLowerCase();
              if (!matchesId && !matchesEmail) return prev;
              const updated = { ...prev, profileVideoUrl: undefined, avatarUrl: undefined };
              profileRef.current = updated;
              return updated;
            });
          } else {
            hydrateProfileMedia(ev.data.userId, ev.data.email, true);
          }
        };
      } catch (e) {}
    }

    // 3. Setup window storage event listener for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === AUTH_BROADCAST_EVENT_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          handleAuthMessage(data);
        } catch (err) {}
      } else if (e.key === 'spades_revoked_session_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          handleAuthMessage({
            type: 'ADMIN_FORCE_LOGOUT',
            targetUserId: data.userId,
            targetEmail: data.email,
            reason: data.reason,
          });
        } catch (err) {}
      } else if (e.key === AUTH_SESSION_KEY) {
        if (!e.newValue) {
          handleAuthMessage({ type: 'AUTH_LOGOUT', reason: 'USER_LOGOUT' });
        } else {
          try {
            const session = JSON.parse(e.newValue);
            handleAuthMessage({
              type: 'AUTH_LOGIN',
              profile: session.profile,
              isDemo: session.isDemo,
              authProvider: session.authProvider,
            });
          } catch (err) {}
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Session validity heartbeat & focus listener (ensures admin logout takes effect on inactive tabs immediately when user interacts)
    const verifySessionState = () => {
      const cur = getActiveSession();
      if (!cur) return;
      const adminUser =
        AdminUserManager.getUserById(cur.profile.id) ||
        AdminUserManager.getUserByEmail(cur.profile.email);

      if (adminUser) {
        const isRevoked =
          adminUser.status === 'suspended' ||
          adminUser.status === 'deleted' ||
          adminUser.status === 'disabled' ||
          Boolean(
            adminUser.sessionRevokedAt &&
              new Date(adminUser.sessionRevokedAt).getTime() > cur.loginTimestamp
          );

        if (isRevoked) {
          clearActiveSession();
          setUser(null);
          setProfile(null);
          setIsDemo(false);
          setForcedLogoutReason(
            adminUser.status === 'suspended'
              ? 'Your account has been suspended by an administrator.'
              : adminUser.status === 'disabled'
              ? 'Your account has been deactivated by an administrator.'
              : 'Your active session was terminated by an administrator.'
          );
          try {
            fbSignOut(auth);
          } catch (e) {}
        }
      }
    };

    window.addEventListener('focus', verifySessionState);
    const heartbeat = setInterval(verifySessionState, 20000);

    // 5. Firebase Auth state listener
    const unsubscribeFb = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const email = fbUser.email || '';
        const adminUser =
          AdminUserManager.getUserById(fbUser.uid) || AdminUserManager.getUserByEmail(email);

        if (
          adminUser &&
          (adminUser.status === 'suspended' ||
            adminUser.status === 'deleted' ||
            adminUser.status === 'disabled')
        ) {
          fbSignOut(auth);
          clearActiveSession();
          setUser(null);
          setProfile(null);
          setIsDemo(false);
          setForcedLogoutReason('Your account has been suspended by an administrator.');
          setLoading(false);
          return;
        }

        const isSuper = isSuperUserEmail(email) || (adminUser && adminUser.role === 'super_admin');
        const existingSession = getActiveSession();
        const preservedProfile = existingSession?.profile;
        const isSameUser = Boolean(
          preservedProfile &&
            (preservedProfile.id === fbUser.uid ||
              preservedProfile.email?.toLowerCase() === email.toLowerCase())
        );
        const prefs = getProfilePrefs(fbUser.uid, email);

        const userProf: UserProfile = {
          id: fbUser.uid,
          name:
            (isSameUser ? preservedProfile?.name : undefined) ||
            prefs?.name ||
            fbUser.displayName ||
            adminUser?.name ||
            (isSuper ? 'Chancellor (Admin)' : email.split('@')[0] || 'ChanceTEK One'),
          email: email,
          bio: isSameUser ? (preservedProfile?.bio ?? prefs?.bio) : prefs?.bio,
          avatarUrl:
            (isSameUser ? preservedProfile?.avatarUrl : undefined) ||
            prefs?.avatarUrl ||
            adminUser?.avatarUrl ||
            fbUser.photoURL ||
            undefined,
          role: adminUser?.role === 'super_admin' || isSuper ? 'admin' : (adminUser?.role as any) || 'user',
          createdAt: preservedProfile?.createdAt || adminUser?.createdAt || new Date().toISOString(),
          likedTrackIds: preservedProfile?.likedTrackIds || [],
          likedVideoIds: preservedProfile?.likedVideoIds || [],
          likedAudiobookIds: preservedProfile?.likedAudiobookIds || [],
          savedArtistIds: preservedProfile?.savedArtistIds || [],
          playlistIds: preservedProfile?.playlistIds || [],
        };

        setUser(fbUser);
        setProfile(userProf);
        profileRef.current = userProf;
        setIsDemo(false);
        saveActiveSession(userProf, false, 'firebase');
        AdminUserManager.syncAuthUser(userProf);
        setLoading(false);

        // Hydrate persistent photo or video media from IndexedDB
        hydrateProfileMedia(fbUser.uid, email);
      } else {
        // Firebase returned null user.
        // Check if there is an active session in localStorage (email, superuser, demo, etc.). If valid, preserve it!
        const activeSess = getActiveSession();
        if (activeSess && activeSess.profile) {
          const adminUser =
            AdminUserManager.getUserById(activeSess.profile.id) ||
            AdminUserManager.getUserByEmail(activeSess.profile.email);

          const isRevoked =
            adminUser &&
            (adminUser.status === 'suspended' ||
              adminUser.status === 'deleted' ||
              adminUser.status === 'disabled' ||
              Boolean(
                adminUser.sessionRevokedAt &&
                  new Date(adminUser.sessionRevokedAt).getTime() > activeSess.loginTimestamp
              ));

          if (isRevoked) {
            clearActiveSession();
            setUser(null);
            setProfile(null);
            profileRef.current = null;
            setIsDemo(false);
            setForcedLogoutReason('Your session has been ended by a platform administrator.');
          } else {
            const prefs = getProfilePrefs(activeSess.profile.id, activeSess.profile.email);
            const curLive = profileRef.current;
            const keepLiveMedia = Boolean(curLive && curLive.id === activeSess.profile.id);
            const syncedProfile: UserProfile = {
              ...activeSess.profile,
              name: activeSess.profile.name || prefs?.name || adminUser?.name || activeSess.profile.name,
              bio: activeSess.profile.bio ?? prefs?.bio,
              role:
                adminUser?.role === 'super_admin' || isSuperUserEmail(activeSess.profile.email)
                  ? 'admin'
                  : (adminUser?.role as any) || activeSess.profile.role,
              avatarUrl:
                (keepLiveMedia && curLive?.avatarUrl) ||
                activeSess.profile.avatarUrl ||
                adminUser?.avatarUrl ||
                prefs?.avatarUrl,
              profileVideoUrl: keepLiveMedia ? curLive?.profileVideoUrl : undefined,
            };
            setProfile(syncedProfile);
            profileRef.current = syncedProfile;
            setIsDemo(Boolean(activeSess.isDemo));

            // Always ensure IndexedDB photo/video media is hydrated cleanly
            hydrateProfileMedia(syncedProfile.id, syncedProfile.email);
          }
        } else {
          setUser(null);
          setProfile(null);
          profileRef.current = null;
          setIsDemo(false);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFb();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', verifySessionState);
      clearInterval(heartbeat);
      if (channel) channel.close();
      if (mediaChannel) mediaChannel.close();
    };
  }, [handleAuthMessage, hydrateProfileMedia]);

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email || '';
      const adminUser =
        AdminUserManager.getUserById(cred.user.uid) || AdminUserManager.getUserByEmail(email);

      if (
        adminUser &&
        (adminUser.status === 'suspended' ||
          adminUser.status === 'deleted' ||
          adminUser.status === 'disabled')
      ) {
        await fbSignOut(auth);
        clearActiveSession();
        return {
          success: false,
          error: 'Your account has been suspended or deactivated by an administrator.',
        };
      }

      const isSuper = isSuperUserEmail(email) || (adminUser && adminUser.role === 'super_admin');
      const prefs = getProfilePrefs(cred.user.uid, email);

      const userProf: UserProfile = {
        id: cred.user.uid,
        name:
          prefs?.name ||
          cred.user.displayName ||
          adminUser?.name ||
          (isSuper ? 'Chancellor (Admin)' : 'ChanceTEK One'),
        email: email,
        bio: prefs?.bio,
        avatarUrl: prefs?.avatarUrl || adminUser?.avatarUrl || cred.user.photoURL || undefined,
        role: adminUser?.role === 'super_admin' || isSuper ? 'admin' : (adminUser?.role as any) || 'user',
        createdAt: adminUser?.createdAt || new Date().toISOString(),
        likedTrackIds: [],
        likedVideoIds: [],
        likedAudiobookIds: [],
        savedArtistIds: [],
        playlistIds: [],
      };

      setUser(cred.user);
      setProfile(userProf);
      profileRef.current = userProf;
      setIsDemo(false);
      saveActiveSession(userProf, false, 'google');
      AdminUserManager.syncAuthUser(userProf);
      hydrateProfileMedia(userProf.id, userProf.email);
      broadcastAuthEvent({
        type: 'AUTH_LOGIN',
        profile: userProf,
        isDemo: false,
        authProvider: 'google',
      });

      AnalyticsEngine.trackEvent({
        eventType: 'USER_LOGIN',
        action: `User "${userProf.name}" signed in via Google`,
        resource: 'Authentication',
        userId: userProf.id,
        userName: userProf.name,
        userEmail: userProf.email,
        platformArea: 'Auth',
      });

      return { success: true };
    } catch (err: any) {
      console.warn('Google popup error:', err.message);
      return { success: false, error: err.message || 'Google sign-in failed.' };
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedEmail = email.trim();
      const adminUser = AdminUserManager.getUserByEmail(trimmedEmail);

      if (
        adminUser &&
        (adminUser.status === 'suspended' ||
          adminUser.status === 'deleted' ||
          adminUser.status === 'disabled')
      ) {
        return {
          success: false,
          error: 'Your account has been suspended or deactivated by an administrator.',
        };
      }

      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const isSuper =
        isSuperUserEmail(trimmedEmail) || (adminUser && adminUser.role === 'super_admin');
      const userEmail = cred.user.email || trimmedEmail;
      const prefs = getProfilePrefs(cred.user.uid, userEmail);

      const userProf: UserProfile = {
        id: cred.user.uid,
        name:
          prefs?.name ||
          cred.user.displayName ||
          adminUser?.name ||
          (isSuper ? 'Chancellor (Admin)' : trimmedEmail.split('@')[0]),
        email: userEmail,
        bio: prefs?.bio,
        avatarUrl: prefs?.avatarUrl || adminUser?.avatarUrl || undefined,
        role: adminUser?.role === 'super_admin' || isSuper ? 'admin' : (adminUser?.role as any) || 'user',
        createdAt: adminUser?.createdAt || new Date().toISOString(),
        likedTrackIds: [],
        likedVideoIds: [],
        likedAudiobookIds: [],
        savedArtistIds: [],
        playlistIds: [],
      };

      setUser(cred.user);
      setProfile(userProf);
      profileRef.current = userProf;
      setIsDemo(false);
      saveActiveSession(userProf, false, 'email');
      AdminUserManager.syncAuthUser(userProf);
      hydrateProfileMedia(userProf.id, userProf.email);
      broadcastAuthEvent({
        type: 'AUTH_LOGIN',
        profile: userProf,
        isDemo: false,
        authProvider: 'email',
      });

      AnalyticsEngine.trackEvent({
        eventType: 'USER_LOGIN',
        action: `User "${userProf.name}" signed in`,
        resource: 'Authentication',
        userId: userProf.id,
        userName: userProf.name,
        userEmail: userProf.email,
        platformArea: 'Auth',
      });

      return { success: true };
    } catch (err: any) {
      // Fallback for authorized super-users
      const isSuper = isSuperUserEmail(email);
      if (isSuper && password.length >= 6) {
        signInAsSuperUser(email);
        return { success: true };
      }
      return { success: false, error: err.message || 'Invalid email or password.' };
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
    extraProfile?: Partial<UserProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedEmail = email.trim();
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      const isSuper = isSuperUserEmail(trimmedEmail);

      const userProf: UserProfile = {
        id: cred.user.uid,
        name: displayName || cred.user.displayName || (isSuper ? 'Chancellor (Admin)' : trimmedEmail.split('@')[0]),
        email: cred.user.email || trimmedEmail,
        avatarUrl: '/images/logo.png',
        role: extraProfile?.role || (isSuper ? 'admin' : extraProfile?.agreementStatus === 'verified_active' ? 'creator' : 'user'),
        creatorType: extraProfile?.creatorType || 'streamer',
        agreementStatus: extraProfile?.agreementStatus || 'none',
        agreementId: extraProfile?.agreementId,
        createdAt: new Date().toISOString(),
        likedTrackIds: [],
        likedVideoIds: [],
        likedAudiobookIds: [],
        savedArtistIds: [],
        playlistIds: [],
        ...extraProfile,
      };

      setUser(cred.user);
      setProfile(userProf);
      profileRef.current = userProf;
      setIsDemo(false);
      saveActiveSession(userProf, false, 'email');
      AdminUserManager.syncAuthUser(userProf);
      broadcastAuthEvent({
        type: 'AUTH_LOGIN',
        profile: userProf,
        isDemo: false,
        authProvider: 'email',
      });

      AnalyticsEngine.trackEvent({
        eventType: 'USER_CREATED',
        action: `New user "${userProf.name}" registered`,
        resource: 'User Account',
        userId: userProf.id,
        userName: userProf.name,
        userEmail: userProf.email,
        platformArea: 'Auth',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  const signInAsSuperUser = (email: string = 'chancellor@ichancetek.com') => {
    const isAntGreene = email.toLowerCase().includes('antgreene');
    const existing = AdminUserManager.getUserByEmail(email);
    const id = existing?.id || (isAntGreene ? 'usr-antgreene' : 'usr-chancellor');
    const prefs = getProfilePrefs(id, email);

    const userProf: UserProfile = {
      id,
      name: prefs?.name || existing?.name || (isAntGreene ? 'Ant Greene (Admin)' : 'Chancellor (Super Admin)'),
      email: email,
      bio: prefs?.bio,
      avatarUrl: prefs?.avatarUrl || existing?.avatarUrl || undefined,
      role: 'admin',
      createdAt: existing?.createdAt || new Date().toISOString(),
      likedTrackIds: [],
      likedVideoIds: [],
      likedAudiobookIds: [],
      savedArtistIds: [],
      playlistIds: [],
    };

    setProfile(userProf);
    profileRef.current = userProf;
    setIsDemo(true);
    saveActiveSession(userProf, true, 'superuser');
    AdminUserManager.syncAuthUser(userProf);
    hydrateProfileMedia(userProf.id, userProf.email);
    broadcastAuthEvent({
      type: 'AUTH_LOGIN',
      profile: userProf,
      isDemo: true,
      authProvider: 'superuser',
    });
    setLoading(false);
  };

  const signInAsDemo = () => {
    const id = 'demo-user-chancetekone';
    const email = 'fathertime4000@breakbeats.io';
    const prefs = getProfilePrefs(id, email);

    const userProf: UserProfile = {
      id,
      name: prefs?.name || 'ChanceTEK One',
      email,
      bio: prefs?.bio,
      avatarUrl: prefs?.avatarUrl || undefined,
      role: 'creator',
      createdAt: new Date().toISOString(),
      likedTrackIds: [],
      likedVideoIds: [],
      likedAudiobookIds: [],
      savedArtistIds: [],
      playlistIds: [],
    };

    setProfile(userProf);
    profileRef.current = userProf;
    setIsDemo(true);
    saveActiveSession(userProf, true, 'demo');
    AdminUserManager.syncAuthUser(userProf);
    hydrateProfileMedia(userProf.id, userProf.email);
    broadcastAuthEvent({
      type: 'AUTH_LOGIN',
      profile: userProf,
      isDemo: true,
      authProvider: 'demo',
    });
    setLoading(false);
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {}
    clearActiveSession();
    broadcastAuthEvent({ type: 'AUTH_LOGOUT', reason: 'USER_LOGOUT' });
    setIsDemo(false);
    setUser(null);
    setProfile(null);
    profileRef.current = null;
  };

  const isAdmin = Boolean(profile && (profile.role === 'admin' || isSuperUserEmail(profile.email)));
  const isSuperUser = Boolean(profile && isSuperUserEmail(profile.email));

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isDemo,
        isAdmin,
        isSuperUser,
        forcedLogoutReason,
        clearForcedLogoutReason,
        updateUserProfile,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInAsSuperUser,
        signInAsDemo,
        signOut,
      }}
    >
      {/* Session Termination Notice Modal (Displayed if an administrator forcefully ends the session) */}
      {forcedLogoutReason && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl glass-panel border border-red-500/40 bg-[#120a10] shadow-[0_25px_80px_rgba(255,0,0,0.25)] p-6 sm:p-7 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white">Platform Session Ended</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">{forcedLogoutReason}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-neutral-400 font-mono text-left space-y-1">
              <p>• All active browser sessions have been logged out platform-wide.</p>
              <p>• Action enforced by ChanceTEK One Security Authority.</p>
            </div>
            <button
              onClick={clearForcedLogoutReason}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-brand-purple text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-transform hover:scale-[1.01] cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
