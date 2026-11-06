export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'analytics_admin'
  | 'content_admin'
  | 'music_manager'
  | 'moderator'
  | 'agentic_ai'
  | 'support_admin';

export type UserAccountStatus =
  | 'active'
  | 'disabled'
  | 'suspended'
  | 'pending'
  | 'deleted';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: AdminRole | 'user' | 'creator';
  status: UserAccountStatus;
  creatorType?: 'artist' | 'producer' | 'creator' | 'streamer';
  agreementStatus?: 'none' | 'submitted' | 'under_review' | 'verified_active' | 'denied';
  agreementId?: string;
  sessionRevokedAt?: string; // ISO timestamp if revoked by administrator
  createdAt: string; // ISO string
  lastLogin: string; // ISO string
  lastActivity: string; // ISO string
  createdLocation: {
    country: string;
    region: string;
    city: string;
    ip: string;
  };
  stats: {
    totalSessions: number;
    platformTimeMinutes: number;
    songsPlayed: number;
    albumsPlayed: number;
    videosWatched: number;
    audiobooksPlayed: number;
    playlistsCreated: number;
    playlistsPlayed: number;
    merchInteractions: number;
    merchPurchases: number;
    totalSpent: number;
    ratingsCount: number;
    likesCount: number;
    sharesCount: number;
  };
}

export interface UserActivityTimelineItem {
  id: string;
  timestamp: string;
  action: string;
  category: 'music' | 'video' | 'audiobook' | 'playlist' | 'merch' | 'auth' | 'admin' | 'social';
  detail: string;
  ip?: string;
  location?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  adminRole: AdminRole;
  eventType: string;
  action: string;
  resource: string;
  resourceId?: string;
  previousValue?: string | Record<string, any>;
  newValue?: string | Record<string, any>;
  ip: string;
  geo: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  details?: string;
}

export interface RolePermissionRule {
  role: AdminRole;
  title: string;
  description: string;
  badgeColor: string;
  permissions: {
    canManageUsers: boolean;
    canChangeUserStatus: boolean;
    canResetPasswords: boolean;
    canDeleteAccounts: boolean;
    canManageRoles: boolean;
    canViewAnalytics: boolean;
    canExportReports: boolean;
    canManageContent: boolean;
    canViewAuditLogs: boolean;
    canPurgeLogs: boolean;
    canModifySystemSettings: boolean;
  };
}
