'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { AnalyticsAggregator } from '@/lib/analytics/AnalyticsAggregator';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import {
  AnalyticsEvent,
  TimeRangeKey,
  KPICardData,
  ChartDataPoint,
} from '@/types/analytics';
import { AdminUserRecord, AuditLogItem } from '@/types/admin';

// Dynamically loaded Admin Sections for fast initial load and instant tab switching
const OverviewSection = dynamic(() => import('@/components/admin/sections/OverviewSection').then((m) => m.OverviewSection));
const MusicAnalyticsSection = dynamic(() => import('@/components/admin/sections/MusicAnalyticsSection').then((m) => m.MusicAnalyticsSection));
const VideoAudiobookSection = dynamic(() => import('@/components/admin/sections/VideoAudiobookSection').then((m) => m.VideoAudiobookSection));
const PlaylistAnalyticsSection = dynamic(() => import('@/components/admin/sections/PlaylistAnalyticsSection').then((m) => m.PlaylistAnalyticsSection));
const TrendingSection = dynamic(() => import('@/components/admin/sections/TrendingSection').then((m) => m.TrendingSection));
const MerchandiseSection = dynamic(() => import('@/components/admin/sections/MerchandiseSection').then((m) => m.MerchandiseSection));
const VisitorSessionsSection = dynamic(() => import('@/components/admin/sections/VisitorSessionsSection').then((m) => m.VisitorSessionsSection));
const UserManagementSection = dynamic(() => import('@/components/admin/sections/UserManagementSection').then((m) => m.UserManagementSection));
const LiveActivitySection = dynamic(() => import('@/components/admin/sections/LiveActivitySection').then((m) => m.LiveActivitySection));
const AuditLogsSection = dynamic(() => import('@/components/admin/sections/AuditLogsSection').then((m) => m.AuditLogsSection));
const SettingsRBACSection = dynamic(() => import('@/components/admin/sections/SettingsRBACSection').then((m) => m.SettingsRBACSection));
const RadioManagementSection = dynamic(() => import('@/components/admin/sections/RadioManagementSection').then((m) => m.RadioManagementSection));
const MusicUploadCenterSection = dynamic(() => import('@/components/admin/sections/MusicUploadCenterSection').then((m) => m.MusicUploadCenterSection));
const ApprovalReviewSection = dynamic(() => import('@/components/admin/sections/ApprovalReviewSection').then((m) => m.ApprovalReviewSection));
const CrateManagementSection = dynamic(() => import('@/components/admin/sections/CrateManagementSection').then((m) => m.CrateManagementSection));
const MusicRecoverySection = dynamic(() => import('@/components/admin/sections/MusicRecoverySection').then((m) => m.MusicRecoverySection));
const MembershipAnalyticsSection = dynamic(() => import('@/components/admin/sections/MembershipAnalyticsSection').then((m) => m.MembershipAnalyticsSection));
const ContentDeletionHubSection = dynamic(() => import('@/components/admin/sections/ContentDeletionHubSection').then((m) => m.ContentDeletionHubSection));
const DistributionAgreementsSection = dynamic(() => import('@/components/admin/sections/DistributionAgreementsSection').then((m) => m.DistributionAgreementsSection));
const CreatorHoldingSection = dynamic(() => import('@/components/admin/sections/CreatorHoldingSection').then((m) => m.CreatorHoldingSection));
const DuplicateDetectionSection = dynamic(() => import('@/components/admin/sections/DuplicateDetectionSection').then((m) => m.DuplicateDetectionSection));
const UnplayableAudioSection = dynamic(() => import('@/components/admin/sections/UnplayableAudioSection').then((m) => m.UnplayableAudioSection));
const CommentsModerationSection = dynamic(() => import('@/components/admin/sections/CommentsModerationSection').then((m) => m.CommentsModerationSection));
const StrideIqIntegrationCard = dynamic(() => import('@/components/admin/StrideIqIntegrationCard').then((m) => m.StrideIqIntegrationCard));
const ApiUsageMonitorSection = dynamic(() => import('@/components/admin/ApiUsageMonitorSection').then((m) => m.ApiUsageMonitorSection));
import { MusicRecoveryService } from '@/lib/music/MusicRecoveryService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { DistributionAgreementService } from '@/lib/agreements/DistributionAgreementService';
import { DuplicateDetectionService } from '@/lib/admin/DuplicateDetectionService';
import { UnplayableAudioDetectionService } from '@/lib/admin/UnplayableAudioDetectionService';
import { CloudCatalogSyncBanner } from '@/components/admin/CloudCatalogSyncBanner';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import { auth } from '@/lib/firebase/client';

// Modals
import { UserDetailModal } from '@/components/admin/modals/UserDetailModal';
import { CreateEditUserModal } from '@/components/admin/modals/CreateEditUserModal';
import { PasswordResetModal } from '@/components/admin/modals/PasswordResetModal';

// Icons
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Clock,
  Download,
  Zap,
  LayoutDashboard,
  Music,
  Video,
  ListMusic,
  Flame,
  ShoppingBag,
  Users,
  Activity,
  FileCode,
  Sliders,
  Sparkles,
  Calendar,
  Globe,
  Upload,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  Crown,
  Disc3,
  Layers,
  Trash2,
  Search,
  X,
  LayoutGrid,
  FileSignature,
  CopyCheck,
  Eye,
  EyeOff,
  AlertCircle,
  MessageSquare,
  KeyRound,
  BarChart3,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'partner-api'
  | 'api-usage'
  | 'comments'
  | 'duplicates'
  | 'unplayable-music'
  | 'content-deletion'
  | 'upload'
  | 'approval'
  | 'creator-holding'
  | 'agreements'
  | 'crates'
  | 'recovery'
  | 'music'
  | 'membership'
  | 'videos'
  | 'playlists'
  | 'trending'
  | 'merch'
  | 'visitors'
  | 'users'
  | 'activity'
  | 'audit'
  | 'settings'
  | 'radio';

export default function AdminPage() {
  const { profile, user, isAdmin, signInWithEmail } = useAuth();
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim() || !adminPasswordInput.trim()) {
      setAuthError('Please enter both your administrator email and password.');
      return;
    }
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await signInWithEmail(adminEmailInput.trim(), adminPasswordInput);
      if (!res.success) {
        setAuthError(res.error || 'Authentication failed. Please verify your administrator credentials.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('last_30_days');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seededMessage, setSeededMessage] = useState(false);
  const [approvalBatchId, setApprovalBatchId] = useState<string | undefined>(undefined);
  const [selectedNavCategory, setSelectedNavCategory] = useState<'all' | 'operations' | 'catalog' | 'analytics' | 'governance'>('all');
  const [navSearchQuery, setNavSearchQuery] = useState<string>('');
  const [mediaSubTab, setMediaSubTab] = useState<'videos' | 'audiobooks' | 'podcasts' | 'analytics'>('videos');

  // Real-time State
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [recoveryCount, setRecoveryCount] = useState<number>(0);
  const [duplicatesCount, setDuplicatesCount] = useState<number>(0);
  const [unplayableCount, setUnplayableCount] = useState<number>(0);
  const [pendingAgreementsCount, setPendingAgreementsCount] = useState<number>(0);
  const [auditLogsList, setAuditLogsList] = useState<AuditLogItem[]>([]);
  const [refreshCount, setRefreshCount] = useState<number>(0);

  // Modals state
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserRecord | null>(null);
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUserRecord | null>(null);
  const [selectedUserForReset, setSelectedUserForReset] = useState<AdminUserRecord | null>(null);

  // Initialize and subscribe to real-time events and user updates
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab')?.toLowerCase();
      if (
        tabParam === 'partner-api' ||
        tabParam === 'api' ||
        tabParam === 'keys' ||
        tabParam === 'famio' ||
        tabParam === 'strideiq'
      ) {
        setActiveTab('partner-api');
      } else if (
        tabParam === 'api-usage' ||
        tabParam === 'api-management' ||
        tabParam === 'usage' ||
        tabParam === 'telemetry'
      ) {
        setActiveTab('api-usage');
      }
    } catch {}

    setEvents(AnalyticsEngine.getEvents());
    setUsers(AdminUserManager.getUsers());
    const refreshRecoveryCount = () => {
      const songs = MusicRecoveryService.getRecoveryCount();
      const playlists = PlaylistService.getRecoveryCount();
      setRecoveryCount(songs + playlists);
    };
    refreshRecoveryCount();
    setAuditLogsList(AuditLogger.getLogs());

    const refreshDuplicates = () => {
      try {
        const stats = DuplicateDetectionService.getStats();
        setDuplicatesCount(stats.totalClusters);
      } catch (e) {
        console.error('[AdminPage] Error reading duplicate stats:', e);
      }
    };
    refreshDuplicates();

    const refreshUnplayable = () => {
      try {
        const stats = UnplayableAudioDetectionService.getStats();
        setUnplayableCount(stats.totalUnplayable);
      } catch (e) {
        console.error('[AdminPage] Error reading unplayable stats:', e);
      }
    };
    refreshUnplayable();

    const refreshAgreementsPending = () => {
      const agrs = DistributionAgreementService.getSubmittedAgreements();
      const pending = agrs.filter((a) => a.status === 'submitted' || a.status === 'under_review').length;
      setPendingAgreementsCount(pending);
    };

    refreshAgreementsPending();
    DistributionAgreementService.syncFromServer().then(refreshAgreementsPending).catch(() => null);

    const unsubscribeAgreements = DistributionAgreementService.subscribe(() => {
      refreshAgreementsPending();
    });

    const unsubscribeEvents = AnalyticsEngine.subscribe((event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeUsers = AdminUserManager.subscribe((updatedUsers) => {
      setUsers(updatedUsers);
    });

    const unsubscribeRecovery = MusicRecoveryService.subscribe(() => {
      refreshRecoveryCount();
    });
    const unsubscribePlaylistRecovery = PlaylistService.subscribe(() => {
      refreshRecoveryCount();
    });
    window.addEventListener('playlists-updated', refreshRecoveryCount);

    const unsubscribeDuplicates = DuplicateDetectionService.subscribe(() => {
      refreshDuplicates();
    });

    const unsubscribeUnplayable = UnplayableAudioDetectionService.subscribe(() => {
      refreshUnplayable();
    });

    const unsubscribeAudit = AuditLogger.subscribe((logs) => {
      setAuditLogsList(logs);
    });

    return () => {
      unsubscribeAgreements();
      unsubscribeEvents();
      unsubscribeUsers();
      unsubscribeRecovery();
      unsubscribePlaylistRecovery();
      window.removeEventListener('playlists-updated', refreshRecoveryCount);
      unsubscribeDuplicates();
      unsubscribeUnplayable();
      unsubscribeAudit();
    };
  }, []);

  // Compute aggregated state on demand with memoization so switching tabs is instantaneous
  const filteredEvents = useMemo(
    () => AnalyticsAggregator.filterEventsByRange(events, timeRange),
    [events, timeRange]
  );
  const kpis: KPICardData[] = useMemo(
    () => (activeTab === 'overview' ? AnalyticsAggregator.computeDashboardKPIs(events, timeRange) : []),
    [activeTab, events, timeRange]
  );
  const velocitySeries: ChartDataPoint[] = useMemo(
    () => (activeTab === 'overview' ? AnalyticsAggregator.computeActivityVelocitySeries(filteredEvents, timeRange) : []),
    [activeTab, filteredEvents, timeRange]
  );
  const heatmapMatrix = useMemo(
    () => (activeTab === 'overview' ? AnalyticsAggregator.computeActivityHeatmap(filteredEvents) : []),
    [activeTab, filteredEvents]
  );
  const songAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'music' || activeTab === 'trending'
        ? AnalyticsAggregator.computeSongAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const albumAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'music' || activeTab === 'trending'
        ? AnalyticsAggregator.computeAlbumAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const videoAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'videos' || activeTab === 'trending'
        ? AnalyticsAggregator.computeVideoAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const audiobookAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'videos'
        ? AnalyticsAggregator.computeAudiobookAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const playlistAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'playlists' || activeTab === 'trending'
        ? AnalyticsAggregator.computePlaylistAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const merchFunnel = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'merch'
        ? AnalyticsAggregator.computeMerchandiseFunnel(filteredEvents, timeRange)
        : [],
    [activeTab, filteredEvents, timeRange]
  );
  const merchAnalytics = useMemo(
    () =>
      activeTab === 'overview' || activeTab === 'merch' || activeTab === 'trending'
        ? AnalyticsAggregator.computeMerchandiseAnalytics(filteredEvents)
        : [],
    [activeTab, filteredEvents]
  );
  const geoDistribution = useMemo(
    () => (activeTab === 'visitors' ? AnalyticsAggregator.computeGeoDistribution(filteredEvents) : []),
    [activeTab, filteredEvents]
  );
  const userJourneys = useMemo(
    () => (activeTab === 'visitors' ? AnalyticsAggregator.computeUserJourneyPaths(filteredEvents) : []),
    [activeTab, filteredEvents]
  );
  const sessionSummary = useMemo(
    () =>
      activeTab === 'visitors'
        ? AnalyticsAggregator.computeSessionSummary(filteredEvents)
        : AnalyticsAggregator.computeSessionSummary([]),
    [activeTab, filteredEvents]
  );
  const auditLogs = useMemo(
    () => (auditLogsList.length > 0 ? auditLogsList : AuditLogger.getLogs()),
    [auditLogsList]
  );

  const handleResetLogs = () => {
    if (confirm('Are you sure you want to clear telemetry event logs? All counts will start fresh from real platform activity.')) {
      AnalyticsEngine.clearEvents();
      setEvents([]);
    }
  };

  const handleExportFullReport = () => {
    const reportData = {
      reportGeneratedAt: new Date().toISOString(),
      configuredTimeRange: timeRange,
      timezone: timezone,
      kpis: kpis.map((k) => ({ metric: k.title, value: k.value, change: `${k.changePercent}%` })),
      topSongs: songAnalytics.slice(0, 5).map((s) => ({ title: s.title, plays: s.plays, completion: `${s.completionRate}%` })),
      merchandiseRevenueTotal: merchAnalytics.reduce((sum, p) => sum + p.revenue, 0),
      activeUsersCount: kpis.find((k) => k.id === 'kpi-active-users')?.value,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chancetekone_analytics_report_${timeRange}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSyncCatalog = async () => {
    setIsSeeding(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const email = profile?.email || user?.email || 'admin@chancetekone.com';
      if (email) headers['x-admin-email'] = email;
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}

      const res = await fetch('/api/admin/catalog/sync', {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Catalog sync failed.');
      }

      await CloudCatalogClient.syncNow().catch(() => {});

      setIsSeeding(false);
      setSeededMessage(true);
      setTimeout(() => setSeededMessage(false), 4000);
      AuditLogger.logAction({
        adminId: profile?.id || 'usr-chancellor',
        adminName: profile?.name || 'Chancellor (Admin)',
        adminRole: 'super_admin',
        eventType: 'CATALOG_SYNCED',
        action: `Synchronized live platform catalog with Firestore & partner store (${data.synced?.tracks || 0} tracks, ${data.synced?.audiobooks || 0} books, ${data.synced?.podcasts || 0} podcasts)`,
        resource: 'Catalog Database',
        status: 'SUCCESS',
      });
    } catch (err: any) {
      console.error('Catalog sync error:', err);
      setIsSeeding(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl glass-panel border border-red-500/40 bg-gradient-to-b from-[#1a0a1f] via-[#110616] to-[#09030c] shadow-[0_20px_60px_rgba(239,68,68,0.25)] space-y-6 animate-in fade-in">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto shadow-2xl">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black uppercase tracking-wider">
              Strict Admin Authorization Required
            </div>
            <h2 className="text-2xl font-black text-white">
              Restricted Admin Console
            </h2>
            <p className="text-xs text-neutral-300 leading-relaxed max-w-sm mx-auto">
              This environment is strictly reserved for authorized platform administrators. Password authentication is mandatory.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          {/* Secure Administrator Password Authentication Form */}
          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="admin@chancetekone.com"
                  className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:border-brand-gold focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:border-brand-gold focus:outline-none transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-black text-xs uppercase tracking-wider shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmittingAuth ? (
                <span>Authenticating Credentials...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate Administrator</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-center text-neutral-500">
            All administrative access attempts are cryptographically verified and audit-logged in real time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Super User Status / Verification Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-red-950/80 via-[#180e28]/90 to-brand-purple/40 border border-red-500/50 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-white">Administrator Session Active</p>
              <span className="px-2 py-0.2 rounded-full bg-red-500/30 text-red-300 text-[10px] font-bold border border-red-500/40">
                Full Platform Authority
              </span>
            </div>
            <p className="text-xs text-neutral-300 font-mono">
              Logged in as: <span className="text-brand-gold font-bold">{profile?.email || 'Platform Administrator'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Real-Time Telemetry Connected
          </span>
        </div>
      </div>

      {/* Real-time Shared Cloud Catalog Sync Banner */}
      <CloudCatalogSyncBanner />

      {/* Main Command Center Header Bar */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              Enterprise Platform Intelligence Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Platform Command & Analytics Center
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-3xl">
              Real-time multi-pillar analytics, media streaming velocity, breakbeat vault conversion funnels, user behavior CRM, and immutable audit logs.
            </p>
          </div>

          {/* Quick Actions & Live Simulator Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real-time Status Indicator */}
            <div
              className="px-3.5 py-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              title="Only authentic actions taken by registered users and visitors on the platform are logged"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>LIVE USER TELEMETRY</span>
            </div>

            {/* Reset Real Logs Button */}
            <button
              onClick={handleResetLogs}
              className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-neutral-300 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Reset telemetry logs to zero"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Reset Logs</span>
            </button>

            {/* Export Full Report */}
            <button
              onClick={handleExportFullReport}
              className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-brand-neon" />
              <span>Export Report</span>
            </button>

            {/* Sync Firestore Catalog */}
            <button
              onClick={handleSyncCatalog}
              disabled={isSeeding}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-105 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg"
            >
              {seededMessage ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{seededMessage ? 'Synced!' : isSeeding ? 'Syncing...' : 'Sync Firestore'}</span>
            </button>
          </div>
        </div>

        {/* Global Controls Row: Time Range & Timezone */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5 text-xs">
          {/* Time Range Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-400 font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-brand-gold" />
              Time Horizon:
            </span>
            <div className="flex flex-wrap bg-white/5 rounded-xl p-1 border border-white/10">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last_7_days', label: 'Last 7 Days' },
                { id: 'last_30_days', label: 'Last 30 Days' },
                { id: 'last_90_days', label: 'Last 90 Days' },
                { id: 'this_year', label: 'This Year' },
                { id: 'previous_year', label: 'Prev Year' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTimeRange(r.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    timeRange === r.id ? 'bg-brand-gold text-black shadow' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-bold flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Timezone:
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="p-1.5 rounded-xl bg-[#141224] border border-white/10 text-white font-mono text-xs focus:outline-none"
            >
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="EST">EST (Eastern Standard Time)</option>
              <option value="CST">CST (Central Standard Time)</option>
              <option value="PST">PST (Pacific Standard Time)</option>
              <option value="GMT">GMT (Greenwich Mean Time)</option>
              <option value="CET">CET (Central European Time)</option>
              <option value="JST">JST (Japan Standard Time)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executive Command Navigation Hub */}
      <div className="rounded-3xl glass-panel border border-white/10 bg-[#0c0a17]/95 backdrop-blur-2xl shadow-2xl p-4 sm:p-5 space-y-4">
        {/* Domain Navigation & Search Filter Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all' as const, label: 'All Modules', count: 22, icon: LayoutGrid },
              { id: 'operations' as const, label: 'Operations & Ingestion', count: 9, icon: Layers },
              { id: 'catalog' as const, label: 'Media & Catalog', count: 5, icon: Music },
              { id: 'analytics' as const, label: 'Intelligence & Analytics', count: 5, icon: Activity },
              { id: 'governance' as const, label: 'Governance & Security', count: 3, icon: Shield },
            ].map((cat) => {
              const isCatActive = selectedNavCategory === cat.id;
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedNavCategory(cat.id);
                    setNavSearchQuery('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isCatActive
                      ? 'bg-gradient-to-r from-brand-purple/30 to-brand-violet/30 text-white border border-brand-purple/60 shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
                  }`}
                >
                  <CatIcon className={`w-3.5 h-3.5 ${isCatActive ? 'text-brand-gold' : 'text-neutral-400'}`} />
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isCatActive ? 'bg-brand-purple text-brand-gold font-black' : 'bg-white/5 text-neutral-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Filter */}
          <div className="relative min-w-[220px] sm:min-w-[270px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              placeholder="Filter 22 admin modules..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-brand-purple/70 focus:ring-1 focus:ring-brand-purple/40 transition-all"
            />
            {navSearchQuery && (
              <button
                type="button"
                onClick={() => setNavSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 22 Navigation Modules Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'overview' as const,
              label: 'Overview',
              icon: LayoutDashboard,
              category: 'operations' as const,
              description: 'Executive KPIs & live event matrix',
            },
            {
              id: 'duplicates' as const,
              label: `Duplicate Detective (${duplicatesCount})`,
              displayLabel: 'Duplicate Detective',
              icon: CopyCheck,
              category: 'operations' as const,
              description: 'Catch duplicate songs, audiobooks, books & videos',
              badge: duplicatesCount,
              accent: 'danger' as const,
            },
            {
              id: 'unplayable-music' as const,
              label: `Unplayable Songs (${unplayableCount})`,
              displayLabel: 'Unplayable Songs',
              icon: ShieldAlert,
              category: 'operations' as const,
              description: 'Detect dead audio & 404 streams, test play, & purge batch',
              badge: unplayableCount,
              accent: 'danger' as const,
            },
            {
              id: 'content-deletion' as const,
              label: 'Delete Platform Content',
              icon: Trash2,
              category: 'operations' as const,
              description: 'Universal content deletion station',
              accent: 'danger' as const,
            },
            {
              id: 'upload' as const,
              label: 'Music Upload Center',
              icon: UploadCloud,
              category: 'operations' as const,
              description: 'Multi-folder ingestion & ID3 extraction',
              accent: 'gold' as const,
            },
            {
              id: 'approval' as const,
              label: 'Human Approval Center',
              icon: CheckCircle2,
              category: 'operations' as const,
              description: 'Human-in-the-Loop review & gating',
              accent: 'neon' as const,
            },
            {
              id: 'creator-holding' as const,
              label: 'Creator Holding & Review',
              icon: ShieldCheck,
              category: 'operations' as const,
              description: 'Human review for creator uploads & emails',
              accent: 'neon' as const,
            },
            {
              id: 'crates' as const,
              label: 'Crate Management',
              icon: Disc3,
              category: 'operations' as const,
              description: 'Official sound crates & folder vaults',
            },
            {
              id: 'recovery' as const,
              label: `45-Day Recovery Vault (${recoveryCount})`,
              displayLabel: '45-Day Recovery Vault',
              icon: Clock,
              category: 'operations' as const,
              description: 'Retention lifecycle & safe restoration',
              badge: recoveryCount,
              accent: 'gold' as const,
            },
            {
              id: 'music' as const,
              label: 'Platform Music Catalog',
              icon: Music,
              category: 'catalog' as const,
              description: 'Master discography in artist & album format • Listen, edit art & delete in real time',
              accent: 'gold' as const,
            },
            {
              id: 'videos' as const,
              label: 'Videos, Audiobooks & Podcasts',
              icon: Video,
              category: 'catalog' as const,
              description: 'Visual media, audiobooks & podcasts',
            },
            {
              id: 'merch' as const,
              label: 'Merchandise & Store',
              icon: ShoppingBag,
              category: 'catalog' as const,
              description: 'Apparel, vinyl drops & store funnels',
            },
            {
              id: 'membership' as const,
              label: 'Membership Analytics',
              icon: Crown,
              category: 'analytics' as const,
              description: 'VIP subscription cohorts & recurring MRR',
              accent: 'gold' as const,
            },
            {
              id: 'users' as const,
              label: 'User Directory & CRM',
              icon: Users,
              category: 'analytics' as const,
              description: 'Member records, RBAC roles & CRM',
            },
            {
              id: 'trending' as const,
              label: 'Popular & Trending',
              icon: Flame,
              category: 'analytics' as const,
              description: 'Real-time virality & algorithmic rank',
              accent: 'gold' as const,
            },
            {
              id: 'activity' as const,
              label: 'Live Activity Stream',
              icon: Activity,
              category: 'analytics' as const,
              description: 'Live listener sessions & telemetry',
            },
            {
              id: 'visitors' as const,
              label: 'Visitors, Geo & Sessions',
              icon: Globe,
              category: 'analytics' as const,
              description: 'Global audience maps & bounce depth',
            },
            {
              id: 'comments' as const,
              label: 'Comments & Threads',
              icon: MessageSquare,
              category: 'analytics' as const,
              description: 'Community conversation velocity, hourly/daily/yearly tracking & moderation',
              accent: 'gold' as const,
            },
            {
              id: 'playlists' as const,
              label: 'Playlists',
              icon: ListMusic,
              category: 'catalog' as const,
              description: 'Curated track sets & member mixes',
            },
            {
              id: 'agreements' as const,
              label: `Creator Agreements (${pendingAgreementsCount})`,
              displayLabel: 'Creator Agreements',
              icon: FileSignature,
              category: 'governance' as const,
              description: 'Human-in-the-Loop agreement review & approvals',
              badge: pendingAgreementsCount,
              accent: 'gold' as const,
            },
            {
              id: 'audit' as const,
              label: 'Audit Logs',
              icon: FileCode,
              category: 'governance' as const,
              description: 'Tamper-evident system audit trail',
            },
            {
              id: 'settings' as const,
              label: 'RBAC & Settings',
              icon: Sliders,
              category: 'governance' as const,
              description: 'Role permissions & platform config',
            },
            {
              id: 'partner-api' as const,
              label: 'Developer & Partner API Keys',
              displayLabel: 'Partner API & Keys',
              icon: KeyRound,
              category: 'governance' as const,
              description: 'Famio.us & StrideIQ.fit API keys, streaming & live sync',
              accent: 'neon' as const,
            },
            {
              id: 'api-usage' as const,
              label: 'API Management',
              displayLabel: 'API Management',
              icon: BarChart3,
              category: 'governance' as const,
              description: 'Real-time API usage by user, app, key, hour, day, week & year',
              accent: 'neon' as const,
            },
            {
              id: 'radio' as const,
              label: 'Radio Stations',
              icon: Radio,
              category: 'catalog' as const,
              description: '24/7 internet radio frequencies',
            },
          ]
            .filter((tab) => {
              const query = navSearchQuery.trim().toLowerCase();
              if (query) {
                return (
                  tab.label.toLowerCase().includes(query) ||
                  tab.description.toLowerCase().includes(query) ||
                  tab.id.toLowerCase().includes(query)
                );
              }
              return selectedNavCategory === 'all' || tab.category === selectedNavCategory;
            })
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`group relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-br from-brand-purple/35 via-[#1d102e] to-brand-violet/25 border-brand-purple/80 shadow-[0_0_24px_rgba(168,85,247,0.35)] scale-[1.01]'
                      : tab.accent === 'danger'
                      ? 'bg-white/[0.02] border-white/5 hover:border-red-500/40 hover:bg-red-500/10'
                      : tab.accent === 'gold'
                      ? 'bg-white/[0.02] border-white/5 hover:border-brand-gold/40 hover:bg-brand-gold/10'
                      : tab.accent === 'neon'
                      ? 'bg-white/[0.02] border-white/5 hover:border-brand-neon/40 hover:bg-brand-neon/10'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                  title={`${tab.label} — ${tab.description}`}
                >
                  {/* Top Row: Icon + Badge */}
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
                        isActive
                          ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/40'
                          : tab.accent === 'danger'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : tab.accent === 'gold'
                          ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30'
                          : tab.accent === 'neon'
                          ? 'bg-brand-purple/20 text-brand-neon border border-brand-purple/30'
                          : 'bg-white/5 text-neutral-300 border border-white/10 group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {tab.badge !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-black font-mono shrink-0 ${
                          isActive
                            ? 'bg-brand-gold text-black shadow-sm'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}

                    {tab.accent === 'danger' && !tab.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase text-red-400 bg-red-500/15 border border-red-500/30 shrink-0">
                        Protect
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: Label & Description */}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-black leading-snug ${
                        isActive ? 'text-white' : 'text-neutral-100 group-hover:text-white'
                      }`}
                    >
                      {tab.displayLabel || tab.label}
                    </p>
                    <p className="text-xs text-neutral-300/80 leading-snug line-clamp-2 mt-1 group-hover:text-neutral-200">
                      {tab.description}
                    </p>
                  </div>

                  {/* Active Neon Accent Indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
                  )}
                </button>
              );
            })}
        </div>

        {/* Live Active Context Bar */}
        <div className="px-4 py-2.5 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-neutral-400 text-xs sm:text-sm">Active Workspace:</span>
            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'duplicates', label: `Duplicate Detective (${duplicatesCount})` },
                { id: 'unplayable-music', label: `Unplayable Songs (${unplayableCount})` },
                { id: 'content-deletion', label: 'Delete Platform Content' },
                { id: 'upload', label: 'Music Upload Center' },
                { id: 'approval', label: 'Human Approval Center' },
                { id: 'crates', label: 'Crate Management' },
                { id: 'recovery', label: `45-Day Recovery Vault (${recoveryCount})` },
                { id: 'music', label: 'Songs, Albums & Producers' },
                { id: 'videos', label: 'Videos, Audiobooks & Podcasts' },
                { id: 'merch', label: 'Merchandise & Store' },
                { id: 'membership', label: 'Membership Analytics' },
                { id: 'users', label: 'User Directory & CRM' },
                { id: 'trending', label: 'Popular & Trending' },
                { id: 'activity', label: 'Live Activity Stream' },
                { id: 'visitors', label: 'Visitors, Geo & Sessions' },
                { id: 'playlists', label: 'Playlists' },
                { id: 'agreements', label: `Creator Agreements (${pendingAgreementsCount} Pending)` },
                { id: 'audit', label: 'Audit Logs' },
                { id: 'settings', label: 'RBAC & Settings' },
                { id: 'partner-api', label: 'Developer & Partner API Console (Famio.us & StrideIQ.fit)' },
                { id: 'api-usage', label: 'API Management' },
                { id: 'radio', label: 'Radio Stations' },
              ].find((t) => t.id === activeTab)?.label || 'Overview'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
            <span className="px-2 py-0.5 rounded-md bg-white/5 font-mono text-neutral-300 border border-white/10 uppercase">
              24 Modules Ready
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Operational
            </span>
          </div>
        </div>
      </div>

      {/* Tab Viewport */}
      <div>
        {activeTab === 'overview' && (
          <OverviewSection
            kpis={kpis}
            velocitySeries={velocitySeries}
            heatmapMatrix={heatmapMatrix}
            timeRange={timeRange}
            recentEvents={events}
            isLive={true}
            onNavigateToTab={(tab) => {
              if (tab === 'audiobooks') {
                setMediaSubTab('audiobooks');
                setActiveTab('videos');
              } else if (tab === 'videos') {
                setMediaSubTab('videos');
                setActiveTab('videos');
              } else {
                setActiveTab(tab as any);
              }
            }}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicateDetectionSection onNavigateToUnplayable={() => setActiveTab('unplayable-music')} />
        )}

        {activeTab === 'unplayable-music' && (
          <UnplayableAudioSection onNavigateToDuplicates={() => setActiveTab('duplicates')} />
        )}

        {activeTab === 'content-deletion' && (
          <ContentDeletionHubSection />
        )}

        {activeTab === 'upload' && (
          <MusicUploadCenterSection
            onOpenApprovalSection={(batchId) => {
              if (batchId) setApprovalBatchId(batchId);
              setActiveTab('approval');
            }}
            onOpenRecoverySection={() => setActiveTab('recovery')}
          />
        )}

        {activeTab === 'approval' && (
          <ApprovalReviewSection initialBatchId={approvalBatchId} />
        )}

        {activeTab === 'creator-holding' && (
          <CreatorHoldingSection />
        )}

        {activeTab === 'agreements' && (
          <DistributionAgreementsSection />
        )}

        {activeTab === 'crates' && (
          <CrateManagementSection />
        )}

        {activeTab === 'recovery' && (
          <MusicRecoverySection />
        )}

        {activeTab === 'music' && (
          <MusicAnalyticsSection songs={songAnalytics} albums={albumAnalytics} />
        )}

        {activeTab === 'membership' && (
          <MembershipAnalyticsSection />
        )}

        {activeTab === 'videos' && (
          <VideoAudiobookSection
            videos={videoAnalytics}
            audiobooks={audiobookAnalytics}
            initialSubTab={mediaSubTab}
          />
        )}

        {activeTab === 'playlists' && (
          <PlaylistAnalyticsSection playlists={playlistAnalytics} />
        )}

        {activeTab === 'trending' && <TrendingSection events={events} />}

        {activeTab === 'merch' && (
          <MerchandiseSection products={merchAnalytics} funnelStages={merchFunnel} />
        )}

        {activeTab === 'visitors' && (
          <VisitorSessionsSection
            geoDistribution={geoDistribution}
            userJourneys={userJourneys}
            sessionSummary={sessionSummary}
            events={events}
          />
        )}

        {activeTab === 'users' && (
          <UserManagementSection
            users={users}
            onOpenUserDetail={(u) => setSelectedUserDetail(u)}
            onOpenCreateUser={() => {
              setUserToEdit(null);
              setIsCreateEditModalOpen(true);
            }}
            onOpenEditUser={(u) => {
              setUserToEdit(u);
              setIsCreateEditModalOpen(true);
            }}
            onOpenPasswordReset={(u) => setSelectedUserForReset(u)}
            onRefresh={() => setRefreshCount((p) => p + 1)}
          />
        )}

        {activeTab === 'activity' && (
          <LiveActivitySection
            events={events}
          />
        )}

        {activeTab === 'comments' && <CommentsModerationSection />}

        {activeTab === 'audit' && (
          <AuditLogsSection logs={auditLogs} onRefresh={() => setRefreshCount((p) => p + 1)} />
        )}

        {activeTab === 'settings' && <SettingsRBACSection />}

        {activeTab === 'partner-api' && (
          <div className="space-y-6">
            <StrideIqIntegrationCard />
          </div>
        )}

        {activeTab === 'api-usage' && (
          <div className="space-y-6">
            <ApiUsageMonitorSection />
          </div>
        )}

        {activeTab === 'radio' && <RadioManagementSection />}
      </div>

      {/* Modals */}
      <UserDetailModal
        user={selectedUserDetail}
        isOpen={Boolean(selectedUserDetail)}
        onClose={() => setSelectedUserDetail(null)}
        onOpenPasswordReset={(u) => {
          setSelectedUserDetail(null);
          setSelectedUserForReset(u);
        }}
        onUserUpdated={() => setRefreshCount((p) => p + 1)}
      />

      <CreateEditUserModal
        userToEdit={userToEdit}
        isOpen={isCreateEditModalOpen}
        onClose={() => setIsCreateEditModalOpen(false)}
        onSaved={() => setRefreshCount((p) => p + 1)}
      />

      <PasswordResetModal
        user={selectedUserForReset}
        isOpen={Boolean(selectedUserForReset)}
        onClose={() => setSelectedUserForReset(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Super User Authentication"
        description="Enter credentials or select an authorized admin account."
      />
    </div>
  );
}
