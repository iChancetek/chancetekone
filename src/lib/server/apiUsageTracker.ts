/**
 * ChanceTEK One — Real-Time Partner API Usage & Application Telemetry Tracker
 *
 * Tracks live API usage across all partner applications (Famio.us, StrideIQ.fit, custom apps)
 * across multiple time granularities: exact time (live), hour, day, week, and year.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';

export type UsageGranularity = 'time' | 'hour' | 'day' | 'week' | 'year';

export interface ApiUsageEvent {
  id: string;
  timestamp: string;
  ts: number;
  appName: string;
  appType: string;
  keyId: string;
  keyPrefix: string;
  endpoint: string;
  method: string;
  authType: string;
  origin: string;
  isStream: boolean;
  statusCode: number;
}

export interface UsageBucket {
  key: string;
  label: string;
  total: number;
  streams: number;
  byApp: Record<string, number>;
  byEndpoint: Record<string, number>;
}

export interface AppUsageSummary {
  appName: string;
  appType: string;
  keyPrefix: string;
  totalRequests: number;
  totalStreams: number;
  lastUsedAt: string;
  lastEndpoint: string;
  endpoints: Record<string, number>;
}

interface UsageStoreShape {
  trackingEnabled: boolean;
  totalRequests: number;
  totalStreams: number;
  events: ApiUsageEvent[];
  hourly: Record<string, UsageBucket>;
  daily: Record<string, UsageBucket>;
  weekly: Record<string, UsageBucket>;
  yearly: Record<string, UsageBucket>;
  apps: Record<string, AppUsageSummary>;
  updatedAt: string;
}

const MAX_RECENT_EVENTS = 2000;
const FLUSH_INTERVAL_MS = 1200;

let memoryStore: UsageStoreShape | null = null;
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

function canUseFirebaseAdmin(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
  );
}

function getUsageStorePath(): string {
  return path.join(process.cwd(), '.data', 'api_usage_store.json');
}

function emptyStore(): UsageStoreShape {
  return {
    trackingEnabled: true,
    totalRequests: 0,
    totalStreams: 0,
    events: [],
    hourly: {},
    daily: {},
    weekly: {},
    yearly: {},
    apps: {},
    updatedAt: new Date().toISOString(),
  };
}

function loadStore(): UsageStoreShape {
  if (memoryStore) return memoryStore;
  try {
    const file = getUsageStorePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        memoryStore = {
          trackingEnabled: parsed.trackingEnabled !== false,
          totalRequests: Number(parsed.totalRequests) || 0,
          totalStreams: Number(parsed.totalStreams) || 0,
          events: Array.isArray(parsed.events) ? parsed.events : [],
          hourly: parsed.hourly && typeof parsed.hourly === 'object' ? parsed.hourly : {},
          daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
          weekly: parsed.weekly && typeof parsed.weekly === 'object' ? parsed.weekly : {},
          yearly: parsed.yearly && typeof parsed.yearly === 'object' ? parsed.yearly : {},
          apps: parsed.apps && typeof parsed.apps === 'object' ? parsed.apps : {},
          updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        };
        return memoryStore;
      }
    }
  } catch {
    // Fallback to fresh store
  }
  memoryStore = emptyStore();
  return memoryStore;
}

function flushStoreSync(): void {
  if (!memoryStore || !dirty) return;
  try {
    const file = getUsageStorePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Trim old buckets to keep file compact
    pruneOldBuckets(memoryStore);

    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(memoryStore, null, 2), 'utf-8');
    fs.renameSync(tmp, file);
    dirty = false;
  } catch {
    // Ignore disk write errors in read-only environments
  }
}

function scheduleFlush(): void {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushStoreSync();
  }, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

function pruneOldBuckets(store: UsageStoreShape): void {
  const keepLatest = (record: Record<string, UsageBucket>, maxKeys: number) => {
    const keys = Object.keys(record).sort();
    if (keys.length <= maxKeys) return;
    const toRemove = keys.slice(0, keys.length - maxKeys);
    for (const k of toRemove) delete record[k];
  };
  keepLatest(store.hourly, 168); // 7 days of hourly buckets
  keepLatest(store.daily, 366);  // 1 year of daily buckets
  keepLatest(store.weekly, 104); // 2 years of weekly buckets
  keepLatest(store.yearly, 20);  // 20 years of yearly buckets
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function getHourKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}`;
}

export function getDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

export function getYearKey(d: Date): string {
  return `${d.getUTCFullYear()}`;
}

function normalizeEndpointPath(pathname: string): string {
  if (pathname.includes('/stream/')) {
    return pathname.startsWith('/api/v1') ? '/api/v1/stream' : '/api/strideiq/v1/stream';
  }
  if (pathname.includes('/tracks/')) {
    return pathname.startsWith('/api/v1') ? '/api/v1/tracks/[id]' : '/api/strideiq/v1/tracks/[id]';
  }
  if (pathname.includes('/audiobooks/')) {
    return pathname.startsWith('/api/v1') ? '/api/v1/audiobooks/[id]' : '/api/strideiq/v1/audiobooks/[id]';
  }
  if (pathname.includes('/podcasts/')) {
    return pathname.startsWith('/api/v1') ? '/api/v1/podcasts/[id]' : '/api/strideiq/v1/podcasts/[id]';
  }
  return pathname || '/api/v1';
}

export function resolveApplicationIdentity(
  request: NextRequest,
  meta: {
    authType: string;
    partnerKeyId?: string;
    keyLabel?: string;
    keyPrefix?: string;
    appType?: string;
    candidateKey?: string;
  }
): { appName: string; appType: string; keyPrefix: string } {
  const origin = (request.headers.get('origin') || request.headers.get('referer') || '').toLowerCase();
  const key = meta.candidateKey || '';
  const label = (meta.keyLabel || '').trim();
  const labelLow = label.toLowerCase();
  const hasFamioHeader = Boolean(request.headers.get('x-famio-api-key') || request.nextUrl.searchParams.get('x-famio-api-key'));
  const hasStrideIqHeader = Boolean(
    request.headers.get('x-strideiq-api-key') ||
      request.headers.get('x-strideiq-partner-key') ||
      request.nextUrl.searchParams.get('x-strideiq-api-key')
  );

  if (
    key.startsWith('sk_famio_') ||
    hasFamioHeader ||
    origin.includes('famio.us') ||
    labelLow.includes('famio') ||
    meta.appType === 'social'
  ) {
    return {
      appName: label && !labelLow.includes('production') ? label : 'Famio.us',
      appType: 'social',
      keyPrefix: meta.keyPrefix || (key ? `${key.slice(0, 12)}...` : 'sk_famio_...'),
    };
  }

  if (
    key.startsWith('sk_strideiq_') ||
    hasStrideIqHeader ||
    origin.includes('strideiq.fit') ||
    labelLow.includes('strideiq') ||
    meta.appType === 'fitness' ||
    request.nextUrl.pathname.startsWith('/api/strideiq/')
  ) {
    return {
      appName: label && !labelLow.includes('production') ? label : 'StrideIQ.fit',
      appType: 'fitness',
      keyPrefix: meta.keyPrefix || (key ? `${key.slice(0, 14)}...` : 'sk_strideiq_...'),
    };
  }

  if (label) {
    return {
      appName: label,
      appType: meta.appType || 'general',
      keyPrefix: meta.keyPrefix || (key ? `${key.slice(0, 12)}...` : 'sk_live_...'),
    };
  }

  if (meta.authType === 'stream_token') {
    return {
      appName: origin.includes('famio') ? 'Famio.us' : origin.includes('strideiq') ? 'StrideIQ.fit' : 'Media Player Stream',
      appType: 'stream',
      keyPrefix: 'signed-token',
    };
  }

  return {
    appName: 'Universal Partner App',
    appType: meta.appType || 'general',
    keyPrefix: meta.keyPrefix || (key ? `${key.slice(0, 12)}...` : 'api-key'),
  };
}

function incrementBucket(
  map: Record<string, UsageBucket>,
  key: string,
  label: string,
  appName: string,
  endpoint: string,
  isStream: boolean
): void {
  if (!map[key]) {
    map[key] = {
      key,
      label,
      total: 0,
      streams: 0,
      byApp: {},
      byEndpoint: {},
    };
  }
  const bucket = map[key];
  bucket.total += 1;
  if (isStream) bucket.streams += 1;
  bucket.byApp[appName] = (bucket.byApp[appName] || 0) + 1;
  bucket.byEndpoint[endpoint] = (bucket.byEndpoint[endpoint] || 0) + 1;
}

/**
 * Records an API request in real time across hour, day, week, year, and exact timestamp logs.
 */
export function recordApiUsage(
  request: NextRequest,
  meta: {
    authType: string;
    partnerKeyId?: string;
    keyLabel?: string;
    keyPrefix?: string;
    appType?: string;
    candidateKey?: string;
    statusCode?: number;
  }
): void {
  const store = loadStore();
  if (!store.trackingEnabled) return;

  const now = new Date();
  const ts = now.getTime();
  const iso = now.toISOString();
  const endpoint = normalizeEndpointPath(request.nextUrl.pathname);
  const isStream = endpoint.includes('/stream');
  const identity = resolveApplicationIdentity(request, meta);

  const event: ApiUsageEvent = {
    id: `usage_${ts}_${randomBytes(3).toString('hex')}`,
    timestamp: iso,
    ts,
    appName: identity.appName,
    appType: identity.appType,
    keyId: meta.partnerKeyId || meta.authType || 'partner',
    keyPrefix: identity.keyPrefix,
    endpoint,
    method: request.method || 'GET',
    authType: meta.authType,
    origin: request.headers.get('origin') || request.headers.get('host') || 'direct',
    isStream,
    statusCode: meta.statusCode || (isStream ? 206 : 200),
  };

  store.totalRequests += 1;
  if (isStream) store.totalStreams += 1;
  store.events.unshift(event);
  if (store.events.length > MAX_RECENT_EVENTS) {
    store.events.length = MAX_RECENT_EVENTS;
  }

  // Update Time Buckets
  const hKey = getHourKey(now);
  const dKey = getDayKey(now);
  const wKey = getIsoWeekKey(now);
  const yKey = getYearKey(now);

  incrementBucket(store.hourly, hKey, `${pad2(now.getUTCHours())}:00`, identity.appName, endpoint, isStream);
  incrementBucket(store.daily, dKey, dKey, identity.appName, endpoint, isStream);
  incrementBucket(store.weekly, wKey, wKey, identity.appName, endpoint, isStream);
  incrementBucket(store.yearly, yKey, yKey, identity.appName, endpoint, isStream);

  // Update App Summary
  if (!store.apps[identity.appName]) {
    store.apps[identity.appName] = {
      appName: identity.appName,
      appType: identity.appType,
      keyPrefix: identity.keyPrefix,
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: iso,
      lastEndpoint: endpoint,
      endpoints: {},
    };
  }
  const appRec = store.apps[identity.appName];
  appRec.totalRequests += 1;
  if (isStream) appRec.totalStreams += 1;
  appRec.lastUsedAt = iso;
  appRec.lastEndpoint = endpoint;
  appRec.keyPrefix = identity.keyPrefix || appRec.keyPrefix;
  appRec.endpoints[endpoint] = (appRec.endpoints[endpoint] || 0) + 1;

  store.updatedAt = iso;
  scheduleFlush();

  // Non-blocking Firestore backup for cloud persistence (sampled on stream range chunks to stay fast)
  if (canUseFirebaseAdmin() && (!isStream || store.totalRequests % 5 === 1)) {
    persistUsageToFirestore(event).catch(() => {});
  }
}

async function persistUsageToFirestore(event: ApiUsageEvent): Promise<void> {
  try {
    const { adminDb } = await getFirebaseAdmin();
    await adminDb.collection('api_usage_events').doc(event.id).set(event);
  } catch {
    // Non-critical telemetry backup
  }
}

export function setApiUsageTrackingEnabled(enabled: boolean): boolean {
  const store = loadStore();
  store.trackingEnabled = enabled;
  store.updatedAt = new Date().toISOString();
  dirty = true;
  flushStoreSync();
  return store.trackingEnabled;
}

export function clearApiUsageStats(): void {
  memoryStore = {
    ...emptyStore(),
    trackingEnabled: memoryStore ? memoryStore.trackingEnabled : true,
  };
  dirty = true;
  flushStoreSync();
}

export function queryApiUsageAnalytics(options?: {
  granularity?: UsageGranularity;
  appFilter?: string;
  limit?: number;
}) {
  const store = loadStore();
  const granularity: UsageGranularity = options?.granularity || 'hour';
  const appFilter = options?.appFilter && options.appFilter !== 'all' ? options.appFilter : undefined;
  const now = new Date();
  const nowMs = now.getTime();

  const filterBucket = (b?: UsageBucket): { total: number; streams: number; byApp: Record<string, number> } => {
    if (!b) return { total: 0, streams: 0, byApp: {} };
    if (!appFilter) {
      return { total: b.total, streams: b.streams, byApp: b.byApp };
    }
    const appCount = b.byApp[appFilter] || 0;
    return {
      total: appCount,
      streams: 0,
      byApp: appCount > 0 ? { [appFilter]: appCount } : {},
    };
  };

  const series: Array<{
    key: string;
    label: string;
    total: number;
    streams: number;
    byApp: Record<string, number>;
  }> = [];

  if (granularity === 'time') {
    // Minute-by-minute over the last 30 minutes
    const buckets = new Map<string, { total: number; streams: number; byApp: Record<string, number> }>();
    const cutoff = nowMs - 30 * 60_000;
    for (const evt of store.events) {
      if (evt.ts < cutoff) continue;
      if (appFilter && evt.appName !== appFilter) continue;
      const d = new Date(evt.ts);
      const minKey = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
      const cur = buckets.get(minKey) || { total: 0, streams: 0, byApp: {} };
      cur.total += 1;
      if (evt.isStream) cur.streams += 1;
      cur.byApp[evt.appName] = (cur.byApp[evt.appName] || 0) + 1;
      buckets.set(minKey, cur);
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(nowMs - i * 60_000);
      const minKey = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
      const localLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const data = buckets.get(minKey) || { total: 0, streams: 0, byApp: {} };
      series.push({
        key: minKey,
        label: localLabel,
        ...data,
      });
    }
  } else if (granularity === 'hour') {
    // Last 24 hours
    for (let i = 23; i >= 0; i--) {
      const d = new Date(nowMs - i * 3600_000);
      const hKey = getHourKey(d);
      const localLabel = d.toLocaleTimeString([], { hour: 'numeric' });
      const data = filterBucket(store.hourly[hKey]);
      series.push({
        key: hKey,
        label: localLabel,
        ...data,
      });
    }
  } else if (granularity === 'day') {
    // Last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400_000);
      const dKey = getDayKey(d);
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const data = filterBucket(store.daily[dKey]);
      series.push({
        key: dKey,
        label,
        ...data,
      });
    }
  } else if (granularity === 'week') {
    // Last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowMs - i * 7 * 86400_000);
      const wKey = getIsoWeekKey(d);
      const data = filterBucket(store.weekly[wKey]);
      series.push({
        key: wKey,
        label: wKey,
        ...data,
      });
    }
  } else if (granularity === 'year') {
    // Last 5 years
    const currentYear = now.getUTCFullYear();
    for (let y = currentYear - 4; y <= currentYear; y++) {
      const yKey = String(y);
      const data = filterBucket(store.yearly[yKey]);
      series.push({
        key: yKey,
        label: yKey,
        ...data,
      });
    }
  }

  const currentHourBucket = store.hourly[getHourKey(now)];
  const currentDayBucket = store.daily[getDayKey(now)];
  const currentWeekBucket = store.weekly[getIsoWeekKey(now)];
  const currentYearBucket = store.yearly[getYearKey(now)];

  const recentLogs = (appFilter
    ? store.events.filter((e) => e.appName === appFilter)
    : store.events
  ).slice(0, options?.limit || 40);

  const activeApps = Object.values(store.apps).sort((a, b) => b.totalRequests - a.totalRequests);

  const endpointTotals: Record<string, number> = {};
  for (const app of activeApps) {
    if (appFilter && app.appName !== appFilter) continue;
    for (const [ep, count] of Object.entries(app.endpoints || {})) {
      endpointTotals[ep] = (endpointTotals[ep] || 0) + count;
    }
  }
  const topEndpoints = Object.entries(endpointTotals)
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    trackingEnabled: store.trackingEnabled,
    granularity,
    generatedAt: now.toISOString(),
    summary: {
      allTime: appFilter ? (store.apps[appFilter]?.totalRequests || 0) : store.totalRequests,
      totalStreams: appFilter ? (store.apps[appFilter]?.totalStreams || 0) : store.totalStreams,
      lastHour: filterBucket(currentHourBucket).total,
      today: filterBucket(currentDayBucket).total,
      thisWeek: filterBucket(currentWeekBucket).total,
      thisYear: filterBucket(currentYearBucket).total,
      connectedAppCount: activeApps.length,
    },
    activeApps,
    topEndpoints,
    series,
    recentLogs,
  };
}

