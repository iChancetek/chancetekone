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

export interface UserUsageSummary {
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

export interface ApiKeyUsageSummary {
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
  users: Record<string, UserUsageSummary>;
  apiKeys: Record<string, ApiKeyUsageSummary>;
  updatedAt: string;
}

const MAX_RECENT_EVENTS = 2000;
const FLUSH_INTERVAL_MS = 1200;

let memoryStore: UsageStoreShape | null = null;
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;
let firestoreHydrated = false;

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
    users: {},
    apiKeys: {},
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
          users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
          apiKeys: parsed.apiKeys && typeof parsed.apiKeys === 'object' ? parsed.apiKeys : {},
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

function maskApiKey(candidateKey: string, fallbackPrefix: string): string {
  if (!candidateKey) return fallbackPrefix;
  if (candidateKey.length <= 12) return `${candidateKey.slice(0, 6)}...`;
  return `${candidateKey.slice(0, 12)}...${candidateKey.slice(-4)}`;
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
): { appName: string; appType: string; keyPrefix: string; keyLabel: string } {
  const origin = (request.headers.get('origin') || request.headers.get('referer') || '').toLowerCase();
  const explicitApp = (request.headers.get('x-app-name') || request.headers.get('x-application-name') || '').trim();
  const key = meta.candidateKey || '';
  const label = (meta.keyLabel || '').trim();
  const labelLow = label.toLowerCase();
  const hasFamioHeader = Boolean(request.headers.get('x-famio-api-key') || request.nextUrl.searchParams.get('x-famio-api-key'));
  const hasStrideIqHeader = Boolean(
    request.headers.get('x-strideiq-api-key') ||
      request.headers.get('x-strideiq-partner-key') ||
      request.nextUrl.searchParams.get('x-strideiq-api-key')
  );

  if (meta.authType === 'firebase_user') {
    return {
      appName: explicitApp || (origin.includes('famio') ? 'Famio.us' : origin.includes('strideiq') ? 'StrideIQ.fit' : 'ChanceTEK One User'),
      appType: meta.appType || 'user',
      keyPrefix: meta.keyPrefix || 'firebase-jwt',
      keyLabel: label || 'Firebase User Token',
    };
  }

  if (
    key.startsWith('sk_famio_') ||
    hasFamioHeader ||
    origin.includes('famio.us') ||
    labelLow.includes('famio') ||
    explicitApp.toLowerCase().includes('famio') ||
    meta.appType === 'social'
  ) {
    return {
      appName: explicitApp || (label && !labelLow.includes('production') ? label : 'Famio.us'),
      appType: 'social',
      keyPrefix: meta.keyPrefix || maskApiKey(key, 'sk_famio_...'),
      keyLabel: label || (meta.partnerKeyId === 'env-partner-key' ? 'Famio.us Env Key' : 'Famio.us API Key'),
    };
  }

  if (
    key.startsWith('sk_strideiq_') ||
    hasStrideIqHeader ||
    origin.includes('strideiq.fit') ||
    labelLow.includes('strideiq') ||
    explicitApp.toLowerCase().includes('strideiq') ||
    meta.appType === 'fitness' ||
    request.nextUrl.pathname.startsWith('/api/strideiq/')
  ) {
    return {
      appName: explicitApp || (label && !labelLow.includes('production') ? label : 'StrideIQ.fit'),
      appType: 'fitness',
      keyPrefix: meta.keyPrefix || maskApiKey(key, 'sk_strideiq_...'),
      keyLabel: label || (meta.partnerKeyId === 'env-partner-key' ? 'StrideIQ Env Key' : 'StrideIQ API Key'),
    };
  }

  if (label || explicitApp) {
    return {
      appName: explicitApp || label,
      appType: meta.appType || 'general',
      keyPrefix: meta.keyPrefix || maskApiKey(key, 'sk_live_...'),
      keyLabel: label || 'Partner API Key',
    };
  }

  if (meta.authType === 'stream_token') {
    const streamApp = origin.includes('famio')
      ? 'Famio.us'
      : origin.includes('strideiq')
        ? 'StrideIQ.fit'
        : 'Media Player Stream';
    return {
      appName: streamApp,
      appType: 'stream',
      keyPrefix: 'signed-token',
      keyLabel: 'Signed Stream Token',
    };
  }

  return {
    appName: 'Universal Partner App',
    appType: meta.appType || 'general',
    keyPrefix: meta.keyPrefix || maskApiKey(key, 'api-key'),
    keyLabel: meta.partnerKeyId === 'env-partner-key' ? 'Environment API Key' : 'Partner API Key',
  };
}

export function resolveUserIdentity(
  request: NextRequest,
  meta: {
    userId?: string;
    userEmail?: string;
    userName?: string;
  },
  appName: string
): { userKey: string; userId: string; userEmail: string; userDisplay: string } {
  const sp = request.nextUrl.searchParams;
  const userEmail = (
    meta.userEmail ||
    request.headers.get('x-user-email') ||
    request.headers.get('x-famio-user-email') ||
    request.headers.get('x-strideiq-user-email') ||
    sp.get('userEmail') ||
    ''
  ).trim();

  const userId = (
    meta.userId ||
    request.headers.get('x-user-id') ||
    request.headers.get('x-famio-user-id') ||
    request.headers.get('x-strideiq-user-id') ||
    request.headers.get('x-partner-user-id') ||
    sp.get('userId') ||
    sp.get('uid') ||
    ''
  ).trim();

  const userName = (
    meta.userName ||
    request.headers.get('x-user-name') ||
    request.headers.get('x-user-display-name') ||
    request.headers.get('x-famio-user-name') ||
    request.headers.get('x-strideiq-user-name') ||
    sp.get('userName') ||
    ''
  ).trim();

  const fallbackKey = `service:${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const userKey = (userEmail || userId || fallbackKey).toLowerCase();
  const userDisplay = userName || userEmail || userId || `Service (${appName})`;

  return {
    userKey,
    userId: userId || fallbackKey,
    userEmail,
    userDisplay,
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
    userId?: string;
    userEmail?: string;
    userName?: string;
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
  const userIdentity = resolveUserIdentity(request, meta, identity.appName);
  const keyId = meta.partnerKeyId || `${meta.authType}:${identity.keyPrefix}`;

  const event: ApiUsageEvent = {
    id: `usage_${ts}_${randomBytes(3).toString('hex')}`,
    timestamp: iso,
    ts,
    appName: identity.appName,
    appType: identity.appType,
    userId: userIdentity.userId,
    userEmail: userIdentity.userEmail,
    userDisplay: userIdentity.userDisplay,
    keyId,
    keyLabel: identity.keyLabel,
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

  // Update User Summary
  if (!store.users[userIdentity.userKey]) {
    store.users[userIdentity.userKey] = {
      userKey: userIdentity.userKey,
      userId: userIdentity.userId,
      userEmail: userIdentity.userEmail,
      userDisplay: userIdentity.userDisplay,
      apps: [],
      keyLabels: [],
      keyPrefixes: [],
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: iso,
      lastEndpoint: endpoint,
    };
  }
  const userRec = store.users[userIdentity.userKey];
  userRec.totalRequests += 1;
  if (isStream) userRec.totalStreams += 1;
  userRec.lastUsedAt = iso;
  userRec.lastEndpoint = endpoint;
  if (userIdentity.userEmail && !userRec.userEmail) userRec.userEmail = userIdentity.userEmail;
  if (!userRec.apps.includes(identity.appName)) userRec.apps.push(identity.appName);
  if (!userRec.keyLabels.includes(identity.keyLabel)) userRec.keyLabels.push(identity.keyLabel);
  if (!userRec.keyPrefixes.includes(identity.keyPrefix)) userRec.keyPrefixes.push(identity.keyPrefix);

  // Update API Key Summary
  if (!store.apiKeys[keyId]) {
    store.apiKeys[keyId] = {
      keyId,
      keyLabel: identity.keyLabel,
      keyPrefix: identity.keyPrefix,
      appName: identity.appName,
      appType: identity.appType,
      authType: meta.authType,
      users: [],
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: iso,
      lastEndpoint: endpoint,
    };
  }
  const keyRec = store.apiKeys[keyId];
  keyRec.totalRequests += 1;
  if (isStream) keyRec.totalStreams += 1;
  keyRec.lastUsedAt = iso;
  keyRec.lastEndpoint = endpoint;
  keyRec.keyLabel = identity.keyLabel || keyRec.keyLabel;
  keyRec.keyPrefix = identity.keyPrefix || keyRec.keyPrefix;
  if (!keyRec.users.includes(userIdentity.userDisplay)) {
    keyRec.users.push(userIdentity.userDisplay);
  }

  store.updatedAt = iso;
  scheduleFlush();

  // Non-blocking Firestore backup for cloud persistence (sampled on stream range chunks to stay fast)
  if (canUseFirebaseAdmin() && (!isStream || store.totalRequests % 5 === 1)) {
    persistUsageToFirestore(event).catch(() => {});
  }
}

function applyEventToAggregates(store: UsageStoreShape, event: ApiUsageEvent): void {
  const now = new Date(event.ts || event.timestamp);
  const hKey = getHourKey(now);
  const dKey = getDayKey(now);
  const wKey = getIsoWeekKey(now);
  const yKey = getYearKey(now);

  incrementBucket(store.hourly, hKey, `${pad2(now.getUTCHours())}:00`, event.appName, event.endpoint, event.isStream);
  incrementBucket(store.daily, dKey, dKey, event.appName, event.endpoint, event.isStream);
  incrementBucket(store.weekly, wKey, wKey, event.appName, event.endpoint, event.isStream);
  incrementBucket(store.yearly, yKey, yKey, event.appName, event.endpoint, event.isStream);

  if (!store.apps[event.appName]) {
    store.apps[event.appName] = {
      appName: event.appName,
      appType: event.appType,
      keyPrefix: event.keyPrefix,
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: event.timestamp,
      lastEndpoint: event.endpoint,
      endpoints: {},
    };
  }
  const appRec = store.apps[event.appName];
  appRec.totalRequests += 1;
  if (event.isStream) appRec.totalStreams += 1;
  if (event.timestamp > appRec.lastUsedAt) {
    appRec.lastUsedAt = event.timestamp;
    appRec.lastEndpoint = event.endpoint;
  }
  appRec.keyPrefix = event.keyPrefix || appRec.keyPrefix;
  appRec.endpoints[event.endpoint] = (appRec.endpoints[event.endpoint] || 0) + 1;

  const userKey = (event.userEmail || event.userId || `service:${event.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).toLowerCase();
  const userDisplay = event.userDisplay || event.userEmail || event.userId || `Service (${event.appName})`;
  if (!store.users[userKey]) {
    store.users[userKey] = {
      userKey,
      userId: event.userId || userKey,
      userEmail: event.userEmail || '',
      userDisplay,
      apps: [],
      keyLabels: [],
      keyPrefixes: [],
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: event.timestamp,
      lastEndpoint: event.endpoint,
    };
  }
  const userRec = store.users[userKey];
  userRec.totalRequests += 1;
  if (event.isStream) userRec.totalStreams += 1;
  if (event.timestamp > userRec.lastUsedAt) {
    userRec.lastUsedAt = event.timestamp;
    userRec.lastEndpoint = event.endpoint;
  }
  if (event.userEmail && !userRec.userEmail) userRec.userEmail = event.userEmail;
  if (!userRec.apps.includes(event.appName)) userRec.apps.push(event.appName);
  if (event.keyLabel && !userRec.keyLabels.includes(event.keyLabel)) userRec.keyLabels.push(event.keyLabel);
  if (event.keyPrefix && !userRec.keyPrefixes.includes(event.keyPrefix)) userRec.keyPrefixes.push(event.keyPrefix);

  const keyId = event.keyId || `${event.authType}:${event.keyPrefix}`;
  if (!store.apiKeys[keyId]) {
    store.apiKeys[keyId] = {
      keyId,
      keyLabel: event.keyLabel || 'Partner API Key',
      keyPrefix: event.keyPrefix,
      appName: event.appName,
      appType: event.appType,
      authType: event.authType,
      users: [],
      totalRequests: 0,
      totalStreams: 0,
      lastUsedAt: event.timestamp,
      lastEndpoint: event.endpoint,
    };
  }
  const keyRec = store.apiKeys[keyId];
  keyRec.totalRequests += 1;
  if (event.isStream) keyRec.totalStreams += 1;
  if (event.timestamp > keyRec.lastUsedAt) {
    keyRec.lastUsedAt = event.timestamp;
    keyRec.lastEndpoint = event.endpoint;
  }
  keyRec.keyLabel = event.keyLabel || keyRec.keyLabel;
  keyRec.keyPrefix = event.keyPrefix || keyRec.keyPrefix;
  if (!keyRec.users.includes(userDisplay)) {
    keyRec.users.push(userDisplay);
  }
}

export async function hydrateApiUsageFromPersistence(
  partnerKeys?: Array<{
    id: string;
    label: string;
    prefix: string;
    appType?: string;
    createdAt?: string;
    lastUsedAt?: string;
    revokedAt?: string;
  }>
): Promise<void> {
  const store = loadStore();

  if (!firestoreHydrated && canUseFirebaseAdmin()) {
    firestoreHydrated = true;
    try {
      const { adminDb } = await getFirebaseAdmin();
      const snap = await adminDb
        .collection('api_usage_events')
        .orderBy('ts', 'desc')
        .limit(500)
        .get();
      if (!snap.empty) {
        const existingIds = new Set(store.events.map((e) => e.id));
        const restored: ApiUsageEvent[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as Partial<ApiUsageEvent>;
          if (!d || !d.id || existingIds.has(d.id)) return;
          restored.push({
            id: String(d.id),
            timestamp: String(d.timestamp || new Date(d.ts || Date.now()).toISOString()),
            ts: Number(d.ts) || Date.now(),
            appName: String(d.appName || 'Universal Partner App'),
            appType: String(d.appType || 'general'),
            userId: String(d.userId || ''),
            userEmail: String(d.userEmail || ''),
            userDisplay: String(d.userDisplay || d.userEmail || d.userId || `Service (${d.appName || 'Partner'})`),
            keyId: String(d.keyId || 'partner'),
            keyLabel: String(d.keyLabel || 'Partner API Key'),
            keyPrefix: String(d.keyPrefix || 'api-key'),
            endpoint: String(d.endpoint || '/api/v1'),
            method: String(d.method || 'GET'),
            authType: String(d.authType || 'api_key'),
            origin: String(d.origin || 'direct'),
            isStream: Boolean(d.isStream),
            statusCode: Number(d.statusCode) || 200,
          });
        });

        if (restored.length > 0) {
          for (const evt of restored) {
            store.totalRequests += 1;
            if (evt.isStream) store.totalStreams += 1;
            applyEventToAggregates(store, evt);
          }
          store.events = [...store.events, ...restored]
            .sort((a, b) => b.ts - a.ts)
            .slice(0, MAX_RECENT_EVENTS);
          dirty = true;
        }
      }
    } catch {
      // Non-critical Firestore hydration
    }
  }

  for (const k of partnerKeys || []) {
    if (k.revokedAt) continue;
    const labelLow = (k.label || '').toLowerCase();
    const appName =
      k.appType === 'social' || labelLow.includes('famio')
        ? 'Famio.us'
        : k.appType === 'fitness' || labelLow.includes('strideiq')
          ? 'StrideIQ.fit'
          : k.label || 'Universal Partner App';
    const lastUsed = k.lastUsedAt || k.createdAt || store.updatedAt;

    if (!store.apiKeys[k.id]) {
      store.apiKeys[k.id] = {
        keyId: k.id,
        keyLabel: k.label || 'Partner API Key',
        keyPrefix: k.prefix || 'sk_live_...',
        appName,
        appType: k.appType || 'general',
        authType: 'api_key',
        users: [],
        totalRequests: 0,
        totalStreams: 0,
        lastUsedAt: lastUsed,
        lastEndpoint: '/api/v1',
      };
    }
    if (!store.apps[appName]) {
      store.apps[appName] = {
        appName,
        appType: k.appType || 'general',
        keyPrefix: k.prefix || 'sk_live_...',
        totalRequests: 0,
        totalStreams: 0,
        lastUsedAt: lastUsed,
        lastEndpoint: '/api/v1',
        endpoints: {},
      };
    }
  }
}

export async function persistUsageToFirestore(event: ApiUsageEvent): Promise<void> {
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
  userFilter?: string;
  keyFilter?: string;
  limit?: number;
}) {
  const store = loadStore();
  const granularity: UsageGranularity = options?.granularity || 'hour';
  const appFilter = options?.appFilter && options.appFilter !== 'all' ? options.appFilter : undefined;
  const userFilter = options?.userFilter && options.userFilter !== 'all' ? options.userFilter.toLowerCase() : undefined;
  const keyFilter = options?.keyFilter && options.keyFilter !== 'all' ? options.keyFilter : undefined;
  const now = new Date();
  const nowMs = now.getTime();

  const matchesEvent = (evt: ApiUsageEvent): boolean => {
    if (appFilter && evt.appName !== appFilter) return false;
    if (userFilter) {
      const evtUserKey = (evt.userEmail || evt.userId || `service:${evt.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).toLowerCase();
      const evtDisplay = (evt.userDisplay || '').toLowerCase();
      if (evtUserKey !== userFilter && evtDisplay !== userFilter) return false;
    }
    if (keyFilter && evt.keyId !== keyFilter && evt.keyPrefix !== keyFilter) return false;
    return true;
  };

  const hasDeepFilter = Boolean(userFilter || keyFilter);

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

  const buildEventBucketMap = (keyFn: (d: Date) => string, cutoffMs?: number) => {
    const map = new Map<string, { total: number; streams: number; byApp: Record<string, number> }>();
    for (const evt of store.events) {
      if (cutoffMs && evt.ts < cutoffMs) continue;
      if (!matchesEvent(evt)) continue;
      const k = keyFn(new Date(evt.ts));
      const cur = map.get(k) || { total: 0, streams: 0, byApp: {} };
      cur.total += 1;
      if (evt.isStream) cur.streams += 1;
      cur.byApp[evt.appName] = (cur.byApp[evt.appName] || 0) + 1;
      map.set(k, cur);
    }
    return map;
  };

  const series: Array<{
    key: string;
    label: string;
    total: number;
    streams: number;
    byApp: Record<string, number>;
  }> = [];

  if (granularity === 'time') {
    const cutoff = nowMs - 30 * 60_000;
    const buckets = buildEventBucketMap((d) => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`, cutoff);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(nowMs - i * 60_000);
      const minKey = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
      const localLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const data = buckets.get(minKey) || { total: 0, streams: 0, byApp: {} };
      series.push({ key: minKey, label: localLabel, ...data });
    }
  } else if (granularity === 'hour') {
    const eventMap = hasDeepFilter ? buildEventBucketMap(getHourKey, nowMs - 24 * 3600_000) : null;
    for (let i = 23; i >= 0; i--) {
      const d = new Date(nowMs - i * 3600_000);
      const hKey = getHourKey(d);
      const localLabel = d.toLocaleTimeString([], { hour: 'numeric' });
      const data = eventMap ? (eventMap.get(hKey) || { total: 0, streams: 0, byApp: {} }) : filterBucket(store.hourly[hKey]);
      series.push({ key: hKey, label: localLabel, ...data });
    }
  } else if (granularity === 'day') {
    const eventMap = hasDeepFilter ? buildEventBucketMap(getDayKey, nowMs - 14 * 86400_000) : null;
    for (let i = 13; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400_000);
      const dKey = getDayKey(d);
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const data = eventMap ? (eventMap.get(dKey) || { total: 0, streams: 0, byApp: {} }) : filterBucket(store.daily[dKey]);
      series.push({ key: dKey, label, ...data });
    }
  } else if (granularity === 'week') {
    const eventMap = hasDeepFilter ? buildEventBucketMap(getIsoWeekKey, nowMs - 12 * 7 * 86400_000) : null;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowMs - i * 7 * 86400_000);
      const wKey = getIsoWeekKey(d);
      const data = eventMap ? (eventMap.get(wKey) || { total: 0, streams: 0, byApp: {} }) : filterBucket(store.weekly[wKey]);
      series.push({ key: wKey, label: wKey, ...data });
    }
  } else if (granularity === 'year') {
    const eventMap = hasDeepFilter ? buildEventBucketMap(getYearKey) : null;
    const currentYear = now.getUTCFullYear();
    for (let y = currentYear - 4; y <= currentYear; y++) {
      const yKey = String(y);
      const data = eventMap ? (eventMap.get(yKey) || { total: 0, streams: 0, byApp: {} }) : filterBucket(store.yearly[yKey]);
      series.push({ key: yKey, label: yKey, ...data });
    }
  }

  const currentHourBucket = store.hourly[getHourKey(now)];
  const currentDayBucket = store.daily[getDayKey(now)];
  const currentWeekBucket = store.weekly[getIsoWeekKey(now)];
  const currentYearBucket = store.yearly[getYearKey(now)];

  const recentLogs = store.events
    .filter(matchesEvent)
    .slice(0, options?.limit || 40)
    .map((evt) => ({
      ...evt,
      userId: evt.userId || `service:${evt.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      userEmail: evt.userEmail || '',
      userDisplay: evt.userDisplay || evt.userEmail || evt.userId || `Service (${evt.appName})`,
      keyLabel: evt.keyLabel || (evt.authType === 'stream_token' ? 'Signed Stream Token' : 'Partner API Key'),
    }));

  const activeApps = Object.values(store.apps).sort((a, b) => b.totalRequests - a.totalRequests);
  const activeUsers = Object.values(store.users).sort((a, b) => b.totalRequests - a.totalRequests);
  const activeKeys = Object.values(store.apiKeys).sort((a, b) => b.totalRequests - a.totalRequests);

  const endpointTotals: Record<string, number> = {};
  if (hasDeepFilter) {
    for (const evt of store.events) {
      if (!matchesEvent(evt)) continue;
      endpointTotals[evt.endpoint] = (endpointTotals[evt.endpoint] || 0) + 1;
    }
  } else {
    for (const app of activeApps) {
      if (appFilter && app.appName !== appFilter) continue;
      for (const [ep, count] of Object.entries(app.endpoints || {})) {
        endpointTotals[ep] = (endpointTotals[ep] || 0) + count;
      }
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
      uniqueUserCount: activeUsers.length,
      activeKeyCount: activeKeys.length,
    },
    activeApps,
    activeUsers,
    activeKeys,
    topEndpoints,
    series,
    recentLogs,
  };
}

