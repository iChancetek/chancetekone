'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Globe,
  KeyRound,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Server,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';

type UsageGranularity = 'time' | 'hour' | 'day' | 'week' | 'year';

interface SeriesPoint {
  key: string;
  label: string;
  total: number;
  streams: number;
  byApp: Record<string, number>;
}

interface AppUsageSummary {
  appName: string;
  appType: string;
  keyPrefix: string;
  totalRequests: number;
  totalStreams: number;
  lastUsedAt: string;
  lastEndpoint: string;
  endpoints: Record<string, number>;
}

interface UserUsageSummary {
  userKey: string;
  userId: string;
  userEmail: string;
  userDisplay: string;
  apps: string[];
  keyLabels: string[];
  keyPrefixes: string[];
  totalRequests: number;
  totalStreams: number;
  lastUsedAt: string;
  lastEndpoint: string;
}

interface ApiKeyUsageSummary {
  keyId: string;
  keyLabel: string;
  keyPrefix: string;
  appName: string;
  appType: string;
  authType: string;
  users: string[];
  totalRequests: number;
  totalStreams: number;
  lastUsedAt: string;
  lastEndpoint: string;
}

interface ApiUsageEvent {
  id: string;
  timestamp: string;
  ts: number;
  appName: string;
  appType: string;
  userId: string;
  userEmail: string;
  userDisplay: string;
  keyId: string;
  keyLabel: string;
  keyPrefix: string;
  endpoint: string;
  method: string;
  authType: string;
  origin: string;
  isStream: boolean;
  statusCode: number;
}

interface UsageAnalyticsPayload {
  trackingEnabled: boolean;
  granularity: UsageGranularity;
  generatedAt: string;
  summary: {
    allTime: number;
    totalStreams: number;
    lastHour: number;
    today: number;
    thisWeek: number;
    thisYear: number;
    connectedAppCount: number;
    uniqueUserCount?: number;
    activeKeyCount?: number;
  };
  activeApps: AppUsageSummary[];
  activeUsers?: UserUsageSummary[];
  activeKeys?: ApiKeyUsageSummary[];
  topEndpoints: Array<{ endpoint: string; count: number }>;
  series: SeriesPoint[];
  recentLogs: ApiUsageEvent[];
}

const GRANULARITY_TABS: Array<{ id: UsageGranularity; label: string; subtitle: string }> = [
  { id: 'time', label: 'By Time (Live)', subtitle: 'Last 30 mins + exact timestamps' },
  { id: 'hour', label: 'By Hour', subtitle: 'Last 24 hours' },
  { id: 'day', label: 'By Day', subtitle: 'Last 14 days' },
  { id: 'week', label: 'By Week', subtitle: 'Last 12 weeks' },
  { id: 'year', label: 'By Year', subtitle: '5-year overview' },
];

const APP_COLOR_PALETTE: Record<string, string> = {
  'Famio.us': 'bg-indigo-500',
  'StrideIQ.fit': 'bg-emerald-500',
  'Media Player Stream': 'bg-cyan-500',
};

function getAppBarColor(appName: string, idx: number): string {
  if (APP_COLOR_PALETTE[appName]) return APP_COLOR_PALETTE[appName];
  const fallbacks = ['bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500'];
  return fallbacks[idx % fallbacks.length];
}

function getAppBadgeClass(appName: string): string {
  const low = appName.toLowerCase();
  if (low.includes('famio')) {
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  }
  if (low.includes('strideiq')) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
}

export const ApiUsageMonitorSection: React.FC = () => {
  const { user, profile } = useAuth();
  const [granularity, setGranularity] = useState<UsageGranularity>('hour');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [livePolling, setLivePolling] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [toggling, setToggling] = useState<boolean>(false);
  const [data, setData] = useState<UsageAnalyticsPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const buildAdminHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const email = profile?.email || user?.email;
    if (email) headers['x-admin-email'] = email;
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* session header fallback */
    }
    return headers;
  }, [profile?.email, user?.email]);

  const fetchUsage = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setErrorMsg(null);
      try {
        const headers = await buildAdminHeaders();
        const params = new URLSearchParams({
          granularity,
          app: appFilter,
          user: userFilter,
          key: keyFilter,
          limit: '60',
        });
        const res = await fetch(`/api/admin/api-usage?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'Failed to load API usage analytics.');
        }
        setData(json as UsageAnalyticsPayload);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Unable to load API usage data.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [appFilter, buildAdminHeaders, granularity, keyFilter, userFilter],
  );

  useEffect(() => {
    fetchUsage(false);
  }, [fetchUsage]);

  useEffect(() => {
    if (!livePolling) return;
    const timer = setInterval(() => {
      fetchUsage(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchUsage, livePolling]);

  const handleToggleTracking = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const headers = await buildAdminHeaders();
      const nextState = !data.trackingEnabled;
      const res = await fetch('/api/admin/api-usage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackingEnabled: nextState }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setData((prev) => (prev ? { ...prev, trackingEnabled: Boolean(json.trackingEnabled) } : prev));
      }
    } finally {
      setToggling(false);
    }
  };

  const handleClearStats = async () => {
    setToggling(true);
    try {
      const headers = await buildAdminHeaders();
      const res = await fetch('/api/admin/api-usage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'clear' }),
      });
      if (res.ok) {
        await fetchUsage(false);
      }
    } finally {
      setToggling(false);
    }
  };

  const maxBucketTotal = Math.max(1, ...(data?.series || []).map((s) => s.total));
  const distinctApps = Array.from(
    new Set((data?.activeApps || []).map((a) => a.appName)),
  );

  return (
    <div className="rounded-3xl bg-neutral-900/90 border border-white/15 p-6 sm:p-8 space-y-7 shadow-2xl">
      {/* Header & Real-Time Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                API Management
                {livePolling && data?.trackingEnabled && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Live
                  </span>
                )}
              </h3>
              <p className="text-sm text-neutral-300 mt-0.5">
                Real-time API usage by users, applications, and API keys across exact time, hour, day, week, and year.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Master Tracking Option Toggle */}
          <button
            type="button"
            disabled={toggling || !data}
            onClick={handleToggleTracking}
            className={`px-3.5 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${data?.trackingEnabled !== false
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
              }`}
            title="Enable or pause server-side API usage recording"
          >
            <Radio className="w-4 h-4" />
            <span>Tracking: {data?.trackingEnabled !== false ? 'ON' : 'PAUSED'}</span>
          </button>

          {/* Auto-Refresh Polling Toggle */}
          <button
            type="button"
            onClick={() => setLivePolling((p) => !p)}
            className={`px-3.5 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${livePolling
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:text-white'
              }`}
          >
            {livePolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{livePolling ? 'Auto-Sync (4s)' : 'Auto-Sync Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchUsage(false)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-neutral-100 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleClearStats}
            disabled={toggling}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-sm font-semibold text-neutral-300 hover:text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reset recorded API usage counters"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-black/45 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-neutral-300 font-bold">This Hour</div>
          <div className="text-3xl font-black text-emerald-400 mt-1.5">
            {(data?.summary.lastHour ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Live UTC hour window</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/45 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-neutral-300 font-bold">Today</div>
          <div className="text-3xl font-black text-white mt-1.5">
            {(data?.summary.today ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400 mt-1">24-hour UTC day</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/45 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-neutral-300 font-bold">This Week</div>
          <div className="text-3xl font-black text-indigo-400 mt-1.5">
            {(data?.summary.thisWeek ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400 mt-1">Current ISO week</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/45 border border-white/10">
          <div className="text-xs uppercase tracking-wider text-neutral-300 font-bold">This Year</div>
          <div className="text-3xl font-black text-amber-400 mt-1.5">
            {(data?.summary.thisYear ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400 mt-1">{new Date().getUTCFullYear()} total calls</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/45 border border-white/10 col-span-2 sm:col-span-1">
          <div className="text-xs uppercase tracking-wider text-neutral-300 font-bold">All-Time / Streams</div>
          <div className="text-3xl font-black text-white mt-1.5">
            {(data?.summary.allTime ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-cyan-400 mt-1 font-semibold">
            {(data?.summary.totalStreams ?? 0).toLocaleString()} media streams
          </div>
        </div>
      </div>

      {/* Granularity & Application Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Time Granularity Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-black/45 p-1.5 rounded-2xl border border-white/10">
          {GRANULARITY_TABS.map((tab) => {
            const active = granularity === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGranularity(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${active
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                title={tab.subtitle}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Application, User & Key Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-300 font-bold mr-1">App:</span>
          <button
            type="button"
            onClick={() => setAppFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${appFilter === 'all'
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-neutral-200 border-white/10 hover:bg-white/10'
              }`}
          >
            All Apps
          </button>
          {distinctApps.map((app) => (
            <button
              key={app}
              type="button"
              onClick={() => setAppFilter(app)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${appFilter === app
                  ? 'bg-indigo-500 text-white border-indigo-400'
                  : 'bg-white/5 text-neutral-200 border-white/10 hover:bg-white/10'
                }`}
            >
              {app}
            </button>
          ))}
          {userFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setUserFilter('all')}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-cyan-500/20 text-cyan-200 border-cyan-500/40 flex items-center gap-1.5 cursor-pointer hover:bg-cyan-500/30"
            >
              <span>User: {userFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {keyFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setKeyFilter('all')}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-amber-500/20 text-amber-200 border-amber-500/40 flex items-center gap-1.5 cursor-pointer hover:bg-amber-500/30"
            >
              <span>Key: {keyFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Time-Series Bar Chart */}
      <div className="rounded-2xl bg-black/50 border border-white/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="font-bold text-neutral-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <span>
              {GRANULARITY_TABS.find((t) => t.id === granularity)?.label} —{' '}
              <span className="text-neutral-300 font-normal">
                {GRANULARITY_TABS.find((t) => t.id === granularity)?.subtitle}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3.5 text-xs">
            {distinctApps.map((app, idx) => (
              <span key={app} className="flex items-center gap-1.5 text-neutral-200 font-medium">
                <span className={`w-3 h-3 rounded-sm ${getAppBarColor(app, idx)}`} />
                {app}
              </span>
            ))}
          </div>
        </div>

        <div className="h-56 flex items-end gap-1.5 sm:gap-2 pt-4 overflow-x-auto">
          {(data?.series || []).map((pt) => {
            const heightPct = Math.max(pt.total > 0 ? 6 : 2, Math.round((pt.total / maxBucketTotal) * 100));
            const appEntries = Object.entries(pt.byApp || {});
            const tooltipLines = [
              `${pt.label}: ${pt.total} reqs`,
              ...appEntries.map(([name, cnt]) => `  • ${name}: ${cnt}`),
            ].join('\n');

            return (
              <div
                key={pt.key}
                className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 group h-full justify-end"
                title={tooltipLines}
              >
                <div className="text-[11px] font-mono text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pt.total}
                </div>
                <div
                  className="w-full max-w-[38px] rounded-t-md overflow-hidden flex flex-col-reverse bg-white/[0.04] transition-all duration-300 group-hover:ring-1 group-hover:ring-amber-400/60"
                  style={{ height: `${heightPct}%` }}
                >
                  {pt.total > 0 && appEntries.length > 0 ? (
                    appEntries.map(([appName, cnt]) => {
                      const segPct = Math.max(8, Math.round((cnt / pt.total) * 100));
                      const idx = distinctApps.indexOf(appName);
                      return (
                        <div
                          key={appName}
                          className={`w-full ${getAppBarColor(appName, idx >= 0 ? idx : 0)}`}
                          style={{ height: `${segPct}%` }}
                        />
                      );
                    })
                  ) : (
                    <div className="w-full h-full bg-white/10" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-neutral-400 truncate max-w-full">
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected Apps, Active Users, API Keys & Top Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Connected Applications */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-5 space-y-3.5">
                  <h4 className="text-base font-extrabold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>Applications Using APIs ({data?.activeApps.length ?? 0})</span>
          </h4>
          {(!data?.activeApps || data.activeApps.length === 0) ? (
            <p className="text-sm text-neutral-400 py-4">
              No API calls recorded yet. Calls from Famio.us, StrideIQ.fit, or any partner app will appear here in real time.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {data.activeApps.map((app) => {
                const isSelected = appFilter === app.appName;
                return (
                  <button
                    key={app.appName}
                    type="button"
                    onClick={() => setAppFilter(isSelected ? 'all' : app.appName)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                      }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md border ${getAppBadgeClass(app.appName)}`}>
                          {app.appName}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">{app.keyPrefix}</span>
                      </div>
                      <div className="text-xs text-neutral-300 truncate">
                        Last: <span className="font-mono text-neutral-200">{app.lastEndpoint}</span> •{' '}
                        {new Date(app.lastUsedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-white">{app.totalRequests.toLocaleString()}</div>
                      <div className="text-xs text-cyan-400 font-medium">{app.totalStreams.toLocaleString()} streams</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Users Using APIs */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-5 space-y-3.5">
          <h4 className="text-base font-extrabold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Users Accessing APIs ({data?.activeUsers?.length ?? 0})</span>
          </h4>
          {(!data?.activeUsers || data.activeUsers.length === 0) ? (
            <p className="text-sm text-neutral-400 py-4">
              No user-attributed API calls recorded yet. Firebase users and partner-app user headers will appear here.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {data.activeUsers.map((usr) => {
                const isSelected = userFilter === usr.userKey;
                return (
                  <button
                    key={usr.userKey}
                    type="button"
                    onClick={() => setUserFilter(isSelected ? 'all' : usr.userKey)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                      }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{usr.userDisplay}</span>
                        {usr.apps.map((a) => (
                          <span key={a} className={`text-xs font-semibold px-2 py-0.5 rounded border ${getAppBadgeClass(a)}`}>
                            {a}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-neutral-300 truncate">
                        {usr.userEmail && usr.userEmail !== usr.userDisplay ? `${usr.userEmail} • ` : ''}
                        Keys: <span className="font-mono text-amber-300">{usr.keyPrefixes.join(', ')}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-white">{usr.totalRequests.toLocaleString()}</div>
                      <div className="text-xs text-cyan-400 font-medium">{usr.totalStreams.toLocaleString()} streams</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* API Keys Being Used */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-5 space-y-3.5">
          <h4 className="text-base font-extrabold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span>API Keys Being Used ({data?.activeKeys?.length ?? 0})</span>
          </h4>
          {(!data?.activeKeys || data.activeKeys.length === 0) ? (
            <p className="text-sm text-neutral-400 py-4">No API keys have recorded traffic yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {data.activeKeys.map((k) => {
                const isSelected = keyFilter === k.keyId;
                return (
                  <button
                    key={k.keyId}
                    type="button"
                    onClick={() => setKeyFilter(isSelected ? 'all' : k.keyId)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${isSelected
                        ? 'bg-amber-500/15 border-amber-500/40'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                      }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{k.keyLabel}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {k.keyPrefix}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getAppBadgeClass(k.appName)}`}>
                          {k.appName}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-300 truncate">
                        {k.users.length} user{k.users.length === 1 ? '' : 's'} ({k.users.slice(0, 3).join(', ')}
                        {k.users.length > 3 ? ` +${k.users.length - 3}` : ''}) • {new Date(k.lastUsedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-white">{k.totalRequests.toLocaleString()}</div>
                      <div className="text-xs text-cyan-400 font-medium">{k.totalStreams.toLocaleString()} streams</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Endpoints */}
        <div className="rounded-2xl bg-black/45 border border-white/10 p-5 space-y-3.5">
          <h4 className="text-base font-extrabold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <span>Top Endpoints Called</span>
          </h4>
          {(!data?.topEndpoints || data.topEndpoints.length === 0) ? (
            <p className="text-sm text-neutral-400 py-4">No endpoint traffic recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.topEndpoints.map((ep) => {
                const maxEp = Math.max(1, data.topEndpoints[0]?.count || 1);
                const pct = Math.max(5, Math.round((ep.count / maxEp) * 100));
                return (
                  <div key={ep.endpoint} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-neutral-100 truncate">{ep.endpoint}</span>
                      <span className="font-bold text-amber-400">{ep.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Request Stream (Exact Time) */}
      <div className="rounded-2xl bg-black/45 border border-white/10 p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-extrabold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>Live Request Stream (Exact Time)</span>
          </h4>
          <span className="text-xs font-mono text-neutral-400">
            Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '--'}
          </span>
        </div>

        {(!data?.recentLogs || data.recentLogs.length === 0) ? (
          <p className="text-sm text-neutral-400 py-3">Waiting for incoming partner API requests...</p>
        ) : (
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-neutral-400">
                  <th className="py-2.5 pr-4">Time</th>
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 pr-4">Application</th>
                  <th className="py-2.5 pr-4">API Key</th>
                  <th className="py-2.5 pr-4">Method</th>
                  <th className="py-2.5 pr-4">Endpoint</th>
                  <th className="py-2.5">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.recentLogs.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-4 font-mono text-xs text-neutral-200 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      <span className="text-xs text-neutral-400">
                        {new Date(evt.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-cyan-200">{evt.userDisplay}</div>
                      {evt.userEmail && evt.userEmail !== evt.userDisplay && (
                        <div className="text-xs text-neutral-400">{evt.userEmail}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${getAppBadgeClass(evt.appName)}`}>
                        {evt.appName}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <div className="text-sm text-neutral-100 font-medium">{evt.keyLabel}</div>
                      <div className="text-xs font-mono text-amber-300">{evt.keyPrefix}</div>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs font-bold text-emerald-400">{evt.method}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-white">{evt.endpoint}</td>
                    <td className="py-2.5 text-xs text-neutral-300 truncate max-w-[200px]">{evt.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

