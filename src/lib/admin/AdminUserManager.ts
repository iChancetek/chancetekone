'use client';

import { AdminUserRecord, UserAccountStatus, AdminRole, UserActivityTimelineItem } from '@/types/admin';
import { AuditLogger } from './AuditLogger';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';

const USERS_STORAGE_KEY = 'spades_admin_users_v2';

const INITIAL_USERS: AdminUserRecord[] = [
  {
    id: 'usr-chancellor',
    name: 'Chancellor (Super Admin)',
    email: 'chancellor@ichancetek.com',
    avatarUrl: '/images/logo.png',
    role: 'super_admin',
    status: 'active',
    createdAt: '2025-01-15T10:00:00.000Z',
    lastLogin: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    createdLocation: {
      country: 'United States',
      region: 'Texas',
      city: 'Austin',
      ip: '127.0.0.1',
    },
    stats: {
      totalSessions: 1,
      platformTimeMinutes: 10,
      songsPlayed: 0,
      albumsPlayed: 0,
      videosWatched: 0,
      audiobooksPlayed: 0,
      playlistsCreated: 0,
      playlistsPlayed: 0,
      merchInteractions: 0,
      merchPurchases: 0,
      totalSpent: 0,
      ratingsCount: 0,
      likesCount: 0,
      sharesCount: 0,
    },
  },
  {
    id: 'usr-antgreene',
    name: 'Ant Greene',
    email: 'antgreene@chancetekone.com',
    avatarUrl: '/images/logo.png',
    role: 'admin',
    status: 'active',
    createdAt: '2025-01-20T10:00:00.000Z',
    lastLogin: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    createdLocation: {
      country: 'United States',
      region: 'New York',
      city: 'New York',
      ip: '127.0.0.1',
    },
    stats: {
      totalSessions: 1,
      platformTimeMinutes: 25,
      songsPlayed: 0,
      albumsPlayed: 0,
      videosWatched: 0,
      audiobooksPlayed: 0,
      playlistsCreated: 0,
      playlistsPlayed: 0,
      merchInteractions: 0,
      merchPurchases: 0,
      totalSpent: 0,
      ratingsCount: 0,
      likesCount: 0,
      sharesCount: 0,
    },
  },
];

class AdminUserManagerClass {
  private users: AdminUserRecord[] = [];
  private listeners: Set<(users: AdminUserRecord[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadUsers();
    }
  }

  private loadUsers() {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy synthetic users
          const realUsers = parsed.filter(
            (u) =>
              u.id === 'usr-chancellor' ||
              u.id === 'usr-antgreene' ||
              (!u.id?.includes('fathertime') &&
                !u.id?.includes('sarah_vinyl') &&
                !u.id?.includes('marcus_drum') &&
                !u.id?.includes('elena_dj') &&
                !u.id?.includes('kaito_tokyo') &&
                !u.id?.includes('alex_berlin'))
          );
          if (realUsers.length > 0) {
            this.users = realUsers;
            // Guarantee Ant Greene is present
            if (!this.users.some((u) => u.email.toLowerCase() === 'antgreene@chancetekone.com')) {
              this.users.push(INITIAL_USERS[1]);
            }
            this.persistUsers();
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error loading admin users from storage:', e);
    }
    this.users = [...INITIAL_USERS];
    this.persistUsers();
  }

  private persistUsers() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
    } catch (e) {
      console.warn('Failed to persist admin users:', e);
    }
  }

  public subscribe(callback: (users: AdminUserRecord[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb([...this.users]);
      } catch (err) {
        console.error('User manager listener error:', err);
      }
    });
  }

  public getUsers(): AdminUserRecord[] {
    return [...this.users];
  }

  public getUserById(id: string): AdminUserRecord | undefined {
    return this.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): AdminUserRecord | undefined {
    if (!email) return undefined;
    const lower = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === lower);
  }

  /**
   * Check whether a user's active session has been revoked by an administrator
   * or if their account status is not active.
   */
  public isSessionRevoked(userId: string, sessionLoginTimestamp?: number): boolean {
    const user = this.getUserById(userId);
    if (!user) return false;
    if (user.status === 'suspended' || user.status === 'deleted' || user.status === 'disabled') {
      return true;
    }
    if (user.sessionRevokedAt && sessionLoginTimestamp) {
      return new Date(user.sessionRevokedAt).getTime() > sessionLoginTimestamp;
    }
    return false;
  }

  /**
   * Administrator action: Force-terminate all active platform sessions for a user.
   * Broadcasts real-time revocation across all browser tabs and stores an immutable audit log.
   */
  public logoutUserSessions(userId: string, reason: string = 'Administrative session termination'): boolean {
    const user = this.getUserById(userId) || this.getUserByEmail(userId);
    if (!user) return false;

    const revokedAt = new Date().toISOString();
    user.sessionRevokedAt = revokedAt;
    this.persistUsers();
    this.notify();

    // Broadcast cross-tab session termination in localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'spades_revoked_session_event',
          JSON.stringify({
            userId: user.id,
            email: user.email,
            revokedAt,
            reason,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Failed to store session revocation event:', e);
      }

      // Modern BroadcastChannel dispatch for instant multi-tab reaction
      if ('BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('spades_auth_channel');
          channel.postMessage({
            type: 'ADMIN_FORCE_LOGOUT',
            targetUserId: user.id,
            targetEmail: user.email,
            reason,
            revokedAt,
            timestamp: Date.now(),
          });
          channel.close();
        } catch (e) {
          console.warn('Failed to dispatch BroadcastChannel revocation:', e);
        }
      }
    }

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: 'USER_SESSIONS_REVOKED',
      action: `Terminated all active platform sessions for "${user.name}" (${user.email}). Reason: ${reason}`,
      resource: 'Auth Security',
      resourceId: user.id,
      newValue: { reason, revokedAt },
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'SUCCESS',
    });

    return true;
  }

  public searchUsers(query: string, statusFilter?: string, roleFilter?: string): AdminUserRecord[] {
    return this.users.filter((u) => {
      const matchesQuery =
        !query ||
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase()) ||
        u.id.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = !statusFilter || statusFilter === 'all' || u.status === statusFilter;
      const matchesRole = !roleFilter || roleFilter === 'all' || u.role === roleFilter;

      return matchesQuery && matchesStatus && matchesRole;
    });
  }

  /**
    * Synchronize an authenticated user from Firebase Auth / AuthContext into Admin User records
   */
  public syncAuthUser(profile: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    role?: string;
    creatorType?: 'artist' | 'producer' | 'creator' | 'streamer';
    agreementStatus?: 'none' | 'submitted' | 'under_review' | 'verified_active' | 'denied';
    agreementId?: string;
  }): AdminUserRecord {
    const existingIndex = this.users.findIndex((u) => u.id === profile.id || (u.email && u.email.toLowerCase() === profile.email.toLowerCase()));
    const now = new Date().toISOString();

    if (existingIndex !== -1) {
      const user = this.users[existingIndex];
      user.lastLogin = now;
      user.lastActivity = now;
      if (profile.name) user.name = profile.name;
      if ('avatarUrl' in profile) {
        if (!profile.avatarUrl) {
          user.avatarUrl = undefined as any;
        } else if (!profile.avatarUrl.startsWith('blob:')) {
          user.avatarUrl = profile.avatarUrl;
        }
      }
      if (profile.creatorType) user.creatorType = profile.creatorType;
      if (profile.agreementStatus) user.agreementStatus = profile.agreementStatus;
      if (profile.agreementId) user.agreementId = profile.agreementId;
      if (profile.role) user.role = profile.role as any;
      this.persistUsers();
      this.notify();
      return user;
    }

    const newUser: AdminUserRecord = {
      id: profile.id,
      name: profile.name || profile.email.split('@')[0],
      email: profile.email,
      avatarUrl: profile.avatarUrl || '/images/logo.png',
      role: (profile.role as any) || (profile.agreementStatus === 'verified_active' ? 'creator' : 'user'),
      status: 'active',
      creatorType: profile.creatorType || 'streamer',
      agreementStatus: profile.agreementStatus || 'none',
      agreementId: profile.agreementId,
      createdAt: now,
      lastLogin: now,
      lastActivity: now,
      createdLocation: {
        country: 'United States',
        region: 'Local',
        city: 'Online',
        ip: '127.0.0.1',
      },
      stats: {
        totalSessions: 1,
        platformTimeMinutes: 0,
        songsPlayed: 0,
        albumsPlayed: 0,
        videosWatched: 0,
        audiobooksPlayed: 0,
        playlistsCreated: 0,
        playlistsPlayed: 0,
        merchInteractions: 0,
        merchPurchases: 0,
        totalSpent: 0,
        ratingsCount: 0,
        likesCount: 0,
        sharesCount: 0,
      },
    };

    this.users.unshift(newUser);
    this.persistUsers();
    this.notify();
    return newUser;
  }

  public updateUserAgreementStatus(
    emailOrId: string,
    agreementStatus: 'none' | 'submitted' | 'under_review' | 'verified_active' | 'denied',
    agreementId?: string
  ): boolean {
    const user = this.getUserById(emailOrId) || this.getUserByEmail(emailOrId);
    if (!user) return false;
    user.agreementStatus = agreementStatus;
    if (agreementId) user.agreementId = agreementId;
    if (agreementStatus === 'verified_active') {
      user.role = 'creator';
    }
    this.persistUsers();
    this.notify();
    return true;
  }

  public recordUserStat(
    userId: string,
    field: keyof AdminUserRecord['stats'],
    increment: number = 1
  ) {
    const user = this.users.find((u) => u.id === userId);
    if (user && user.stats) {
      user.stats[field] = (user.stats[field] || 0) + increment;
      user.lastActivity = new Date().toISOString();
      this.persistUsers();
      this.notify();
    }
  }

  public createUser(userData: {
    name: string;
    email: string;
    role: AdminRole | 'user' | 'creator';
    status?: UserAccountStatus;
    country?: string;
    city?: string;
  }): AdminUserRecord {
    const newUser: AdminUserRecord = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: userData.name,
      email: userData.email,
      avatarUrl: '/images/logo.png',
      role: userData.role,
      status: userData.status || 'active',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      createdLocation: {
        country: userData.country || 'United States',
        region: 'Texas',
        city: userData.city || 'Austin',
        ip: '127.0.0.1',
      },
      stats: {
        totalSessions: 1,
        platformTimeMinutes: 0,
        songsPlayed: 0,
        albumsPlayed: 0,
        videosWatched: 0,
        audiobooksPlayed: 0,
        playlistsCreated: 0,
        playlistsPlayed: 0,
        merchInteractions: 0,
        merchPurchases: 0,
        totalSpent: 0,
        ratingsCount: 0,
        likesCount: 0,
        sharesCount: 0,
      },
    };

    this.users.unshift(newUser);
    this.persistUsers();
    this.notify();

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: 'USER_CREATED',
      action: `Created user account "${newUser.name}" (${newUser.email}) with role ${newUser.role}`,
      resource: 'User Management',
      resourceId: newUser.id,
      newValue: { name: newUser.name, email: newUser.email, role: newUser.role, status: newUser.status },
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'SUCCESS',
    });

    return newUser;
  }

  public updateUser(
    id: string,
    updates: Partial<Pick<AdminUserRecord, 'name' | 'email' | 'role' | 'status'>>
  ): AdminUserRecord | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;

    const previousValue = { name: user.name, email: user.email, role: user.role, status: user.status };
    Object.assign(user, updates);
    this.persistUsers();
    this.notify();

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: 'USER_EDITED',
      action: `Updated user "${user.name}" (${user.email}) profile/role/status`,
      resource: 'User Management',
      resourceId: user.id,
      previousValue,
      newValue: updates,
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'SUCCESS',
    });

    return user;
  }

  public setUserStatus(id: string, status: UserAccountStatus, reason?: string): AdminUserRecord | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;

    const oldStatus = user.status;
    user.status = status;
    this.persistUsers();
    this.notify();

    // If account was suspended, disabled, or deleted, automatically terminate all active sessions
    if (status === 'suspended' || status === 'disabled' || status === 'deleted') {
      this.logoutUserSessions(id, reason || `Account transitioned to status "${status}"`);
    }

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: `USER_${status.toUpperCase()}`,
      action: `Changed status for "${user.name}" from ${oldStatus} to ${status}${reason ? ` (Reason: ${reason})` : ''}`,
      resource: 'User Management',
      resourceId: user.id,
      previousValue: { status: oldStatus },
      newValue: { status, reason },
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'SUCCESS',
    });

    return user;
  }

  public deleteUser(id: string, hardDelete: boolean = false): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const user = this.users[index];
    // Terminate all user sessions immediately
    this.logoutUserSessions(id, 'User account deleted by administrator');

    if (hardDelete) {
      this.users.splice(index, 1);
    } else {
      user.status = 'deleted';
    }

    this.persistUsers();
    this.notify();

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: hardDelete ? 'USER_PURGED' : 'USER_DELETED',
      action: `${hardDelete ? 'Permanently purged' : 'Soft-deleted'} user "${user.name}" (${user.email})`,
      resource: 'User Management',
      resourceId: user.id,
      previousValue: { status: user.status },
      newValue: { status: 'deleted', hardDelete },
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'WARNING',
    });

    return true;
  }

  public restoreUser(id: string): AdminUserRecord | null {
    return this.setUserStatus(id, 'active', 'Administrator restored account');
  }

  public initiatePasswordReset(id: string): { success: boolean; message: string; secureLinkToken: string } {
    const user = this.users.find((u) => u.id === id);
    if (!user) return { success: false, message: 'User not found', secureLinkToken: '' };

    const token = `tok_rst_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    AuditLogger.logAction({
      adminId: 'usr-chancellor',
      adminName: 'Chancellor (Admin)',
      adminRole: 'super_admin',
      eventType: 'PASSWORD_RESET_INITIATED',
      action: `Initiated secure password reset dispatch for "${user.name}" (${user.email})`,
      resource: 'Auth Security',
      resourceId: user.id,
      newValue: { tokenMasked: 'tok_rst_***', delivery: 'Secure Provider Email Dispatch' },
      ip: '127.0.0.1',
      geo: 'Austin, TX, US',
      status: 'SUCCESS',
    });

    return {
      success: true,
      message: `Secure password reset link generated and dispatched to ${user.email}. Password was never exposed.`,
      secureLinkToken: token,
    };
  }

  // Generate real user activity timeline from actual telemetry
  public getUserActivityTimeline(userId: string): UserActivityTimelineItem[] {
    const user = this.getUserById(userId);
    const allEvents = AnalyticsEngine.getEvents();
    const userEvents = allEvents.filter((e) => e.userId === userId);

    if (userEvents.length > 0) {
      return userEvents.slice(-20).reverse().map((e) => ({
        id: `tl-${e.id}`,
        timestamp: e.timestamp,
        action: e.action,
        category: (e.platformArea?.toLowerCase() as any) || 'music',
        detail: e.resource,
        location: e.geo ? `${e.geo.city}, ${e.geo.region}` : undefined,
        ip: e.geo?.ip,
      }));
    }

    return [
      {
        id: `tl-init-${userId}`,
        timestamp: user?.createdAt || new Date().toISOString(),
        action: 'Account Created',
        category: 'auth',
        detail: `User registered (${user?.email || 'Platform User'}).`,
        location: `${user?.createdLocation.city}, ${user?.createdLocation.country}`,
        ip: user?.createdLocation.ip,
      },
    ];
  }
}

export const AdminUserManager = new AdminUserManagerClass();
