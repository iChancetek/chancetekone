/**
 * ChanceTEK One <-> StrideIQ.fit Partner API Store
 *
 * Manages StrideIQ.fit partner authentication (API keys + Firebase Bearer tokens + HMAC stream tokens),
 * CORS headers, rate limiting, and workout streaming telemetry.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebaseAdmin.js';
import { canUseFirebaseAdmin } from './profileStore';
import { recordApiUsage } from './apiUsageTracker';

export const STRIDEIQ_DEFAULT_PUBLIC_ORIGIN = 'https://chancetekone.us';
const PARTNER_KEYS_COLLECTION = 'strideiq_partner_keys';
const STRIDEIQ_META_COLLECTION = 'strideiq_meta';
const STRIDEIQ_META_DOC = 'config';
const STRIDEIQ_TELEMETRY_COLLECTION = 'strideiq_telemetry';

export interface PartnerApiKeyRecord {
  id: string;
  label: string;
  prefix: string;
  sha256: string;
  scopes: ('read' | 'stream' | 'telemetry')[];
  appType?: 'general' | 'mobile' | 'fitness' | 'social' | 'ai' | 'kiosk' | 'auto';
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface StrideIqTelemetryEvent {
  id: string;
  event: 'play_start' | 'heartbeat' | 'track_complete' | 'skip';
  trackId: string;
  mediaType?: 'music' | 'audiobook' | 'podcast';
  trackTitle?: string;
  artistName?: string;
  activity: string;
  sessionId?: string;
  strideiqUserId?: string;
  cadenceSpm?: number;
  paceSecondsPerKm?: number;
  heartRateBpm?: number;
  heartRateZone?: number;
  positionSeconds?: number;
  durationListenedSeconds?: number;
  timestamp: string;
  partnerKeyId?: string;
}

interface LocalStrideIqConfigShape {
  signingSecret?: string;
  keys: PartnerApiKeyRecord[];
}

interface LocalTelemetryShape {
  events: StrideIqTelemetryEvent[];
  totalStreams: number;
  totalCompleted: number;
  byActivity: Record<string, number>;
  byMediaType: Record<string, number>;
}

let cachedSigningSecret: string | null = null;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getDataDir(): string {
  return path.join(process.cwd(), '.data');
}

function getConfigPath(): string {
  return path.join(getDataDir(), 'strideiq_config.json');
}

function getTelemetryPath(): string {
  return path.join(getDataDir(), 'strideiq_telemetry.json');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function readLocalConfig(): LocalStrideIqConfigShape {
  try {
    const file = getConfigPath();
    if (!fs.existsSync(file)) return { keys: [] };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      signingSecret: typeof parsed?.signingSecret === 'string' ? parsed.signingSecret : undefined,
      keys: Array.isArray(parsed?.keys) ? parsed.keys : [],
    };
  } catch {
    return { keys: [] };
  }
}

function writeLocalConfig(config: LocalStrideIqConfigShape): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const target = getConfigPath();
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch (err) {
    if (!process.env.K_SERVICE) {
      console.warn('[strideiqStore] Local config write warning:', err);
    }
  }
}

function readLocalTelemetry(): LocalTelemetryShape {
  try {
    const file = getTelemetryPath();
    if (!fs.existsSync(file)) {
      return { events: [], totalStreams: 0, totalCompleted: 0, byActivity: {}, byMediaType: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      totalStreams: Number(parsed?.totalStreams) || 0,
      totalCompleted: Number(parsed?.totalCompleted) || 0,
      byActivity:
        parsed?.byActivity && typeof parsed.byActivity === 'object' ? parsed.byActivity : {},
      byMediaType:
        parsed?.byMediaType && typeof parsed.byMediaType === 'object' ? parsed.byMediaType : {},
    };
  } catch {
    return { events: [], totalStreams: 0, totalCompleted: 0, byActivity: {}, byMediaType: {} };
  }
}

function writeLocalTelemetry(data: LocalTelemetryShape): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const target = getTelemetryPath();
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch (err) {
    if (!process.env.K_SERVICE) {
      console.warn('[strideiqStore] Local telemetry write warning:', err);
    }
  }
}

async function getSigningSecret(): Promise<string> {
  if (cachedSigningSecret) return cachedSigningSecret;
  const envSecret =
    process.env.STRIDEIQ_SIGNING_SECRET?.trim() ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();

  if (envSecret) {
    cachedSigningSecret = createHash('sha256').update(`strideiq:${envSecret}`).digest('hex');
    return cachedSigningSecret;
  }

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const docRef = adminDb.collection(STRIDEIQ_META_COLLECTION).doc(STRIDEIQ_META_DOC);
      const snap = await docRef.get();
      if (snap.exists && typeof snap.data()?.signingSecret === 'string') {
        cachedSigningSecret = snap.data()!.signingSecret;
        return cachedSigningSecret!;
      }
      const generated = randomBytes(32).toString('hex');
      await docRef.set({ signingSecret: generated, updatedAt: new Date().toISOString() }, { merge: true });
      cachedSigningSecret = generated;
      return generated;
    } catch { }
  }

  const local = readLocalConfig();
  if (local.signingSecret) {
    cachedSigningSecret = local.signingSecret;
    return local.signingSecret;
  }

  const generated = randomBytes(32).toString('hex');
  writeLocalConfig({ ...local, signingSecret: generated });
  cachedSigningSecret = generated;
  return generated;
}

export async function signStrideIqStreamToken(
  trackId: string,
  ttlSeconds: number = 6 * 60 * 60
): Promise<string> {
  const secret = await getSigningSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${trackId}|${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${exp}.${sig}`;
}

export async function verifyStrideIqStreamToken(trackId: string, token: string): Promise<boolean> {
  if (!token || !trackId) return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return false;
  const expStr = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const secret = await getSigningSecret();
  const expected = createHmac('sha256', secret).update(`${trackId}|${exp}`).digest('base64url');
  return safeEqualHex(sig, expected);
}

export function resolvePublicOrigin(request: NextRequest): string {
  const hostHeader =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.trim() ||
    '';
  const protoHeader =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1') ? 'http' : 'https');

  if (hostHeader) {
    return `${protoHeader}://${hostHeader}`;
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return STRIDEIQ_DEFAULT_PUBLIC_ORIGIN;
}

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://strideiq.fit',
  'https://www.strideiq.fit',
  'https://app.strideiq.fit',
  'https://api.strideiq.fit',
  'https://famio.us',
  'https://www.famio.us',
  'https://app.famio.us',
  'https://api.famio.us',
  'https://chancetekone.us',
  'https://www.chancetekone.us',
  'https://chancetekone.com',
  'https://www.chancetekone.com',
]);

export function buildStrideIqCorsHeaders(request?: NextRequest): Record<string, string> {
  const origin = request?.headers.get('origin')?.trim() || '';
  const isAllowedOrigin =
    Boolean(origin) &&
    (ALLOWED_EXACT_ORIGINS.has(origin.toLowerCase()) ||
      /^https:\/\/[a-z0-9-]+\.strideiq\.fit$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.famio\.us$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.chancetekone\.us$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.chancetekone\.com$/i.test(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin));

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '*',
    ...(isAllowedOrigin ? { Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Range, Origin, Accept, x-api-key, x-famio-api-key, x-chancetek-api-key, x-strideiq-api-key, x-strideiq-partner-key, x-admin-email, x-user-id, x-user-email',
    'Access-Control-Expose-Headers':
      'Content-Length, Content-Range, Accept-Ranges, ETag, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Partner-Platform, X-StrideIQ-Partner',
    'X-Partner-Platform': 'ChanceTEK One Universal Platform API v1',
    'X-StrideIQ-Partner': 'ChanceTEK One Music API v1',
  };
}

export function optionsStrideIqResponse(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: buildStrideIqCorsHeaders(request),
  });
}

function getEnvApiKeys(): string[] {
  const keys: string[] = [
    // Pre-authorized sovereign partner platform keys (Famio.us social production)
    'sk_famio_Hj6MKnoe3G5WoUQGs9wwQGF2MpeUcrwJ',
  ];
  const envVars = [
    process.env.CHANCETEK_API_KEY,
    process.env.PARTNER_API_KEY,
    process.env.STRIDEIQ_API_KEY,
    process.env.FAMIO_API_KEY,
    process.env.CHANCETEKONE_API_KEY,
  ];
  envVars.forEach((v) => {
    if (v?.trim()) keys.push(v.trim());
  });
  const envListVars = [
    process.env.CHANCETEK_API_KEYS,
    process.env.PARTNER_API_KEYS,
    process.env.STRIDEIQ_API_KEYS,
    process.env.FAMIO_API_KEYS,
  ];
  envListVars.forEach((list) => {
    if (list?.trim()) {
      list
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((k) => keys.push(k));
    }
  });
  return keys;
}

export async function listPartnerApiKeys(): Promise<PartnerApiKeyRecord[]> {
  const local = readLocalConfig();
  const byId = new Map<string, PartnerApiKeyRecord>();
  local.keys.forEach((k) => {
    if (k && k.id) byId.set(k.id, k);
  });

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const qs = await adminDb.collection(PARTNER_KEYS_COLLECTION).get();
      qs.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data?.id) {
          byId.set(data.id, data as PartnerApiKeyRecord);
        }
      });
    } catch (err) {
      console.warn('[strideiqStore] Failed to list keys from Firestore:', err);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function createPartnerApiKey(args: {
  label: string;
  createdBy: string;
  scopes?: ('read' | 'stream' | 'telemetry')[];
  appType?: 'general' | 'mobile' | 'fitness' | 'social' | 'ai' | 'kiosk' | 'auto';
  prefix?: string;
}): Promise<{ apiKey: string; record: PartnerApiKeyRecord }> {
  const rawSecret = randomBytes(24).toString('base64url');
  const labelLower = (args.label || '').toLowerCase();
  let keyPrefix = args.prefix?.trim();
  if (!keyPrefix) {
    if (args.appType === 'social' || labelLower.includes('famio')) {
      keyPrefix = 'sk_famio_';
    } else if (args.appType === 'fitness' || labelLower.includes('strideiq')) {
      keyPrefix = 'sk_strideiq_';
    } else {
      keyPrefix = 'sk_live_';
    }
  }
  if (!keyPrefix.endsWith('_')) keyPrefix += '_';

  const apiKey = `${keyPrefix}${rawSecret}`;
  const idPrefix = (args.appType || keyPrefix.replace(/^sk_/, '').replace(/_$/, '') || 'sq').slice(0, 8);
  const id = `key_${idPrefix}_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const record: PartnerApiKeyRecord = {
    id,
    label: args.label.trim() || 'Partner Production App',
    prefix: apiKey.slice(0, 18) + '...',
    sha256: sha256Hex(apiKey),
    scopes: args.scopes && args.scopes.length > 0 ? args.scopes : ['read', 'stream', 'telemetry'],
    appType: args.appType || (labelLower.includes('famio') ? 'social' : 'fitness'),
    createdAt: new Date().toISOString(),
    createdBy: args.createdBy,
  };

  const local = readLocalConfig();
  local.keys = [record, ...local.keys.filter((k) => k.id !== record.id)];
  writeLocalConfig(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(PARTNER_KEYS_COLLECTION).doc(record.id).set(record);
    } catch (err) {
      console.warn('[strideiqStore] Failed to persist partner key to Firestore:', err);
    }
  }

  return { apiKey, record };
}

export async function revokePartnerApiKey(keyId: string): Promise<boolean> {
  const local = readLocalConfig();
  let updated = false;
  const revokedAt = new Date().toISOString();
  local.keys = local.keys.map((k) => {
    if (k.id === keyId) {
      updated = true;
      return { ...k, revokedAt };
    }
    return k;
  });
  if (updated) writeLocalConfig(local);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      const docRef = adminDb.collection(PARTNER_KEYS_COLLECTION).doc(keyId);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.set({ revokedAt }, { merge: true });
        updated = true;
      }
    } catch { }
  }

  return updated;
}

async function touchPartnerKeyLastUsed(keyId: string): Promise<void> {
  const now = new Date().toISOString();
  const local = readLocalConfig();
  const idx = local.keys.findIndex((k) => k.id === keyId);
  if (idx >= 0) {
    local.keys[idx] = { ...local.keys[idx], lastUsedAt: now };
    writeLocalConfig(local);
  }
  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(PARTNER_KEYS_COLLECTION).doc(keyId).set({ lastUsedAt: now }, { merge: true });
    } catch { }
  }
}

export interface StrideIqAuthResult {
  authorized: boolean;
  authType?: 'api_key' | 'firebase_user' | 'stream_token';
  partnerKeyId?: string;
  userId?: string;
  email?: string;
  rateHeaders: Record<string, string>;
  response?: NextResponse;
}

function checkRateLimit(bucketKey: string, limit: number): { allowed: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count++;
  rateLimitBuckets.set(bucketKey, bucket);

  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(bucket.resetAt / 1000)),
    },
  };
}

export async function verifyStrideIqPartnerRequest(
  request: NextRequest,
  options?: { trackIdForStreamToken?: string; rateLimitPerMinute?: number }
): Promise<StrideIqAuthResult> {
  const cors = buildStrideIqCorsHeaders(request);
  const limit = options?.rateLimitPerMinute || 120;

  // 1. Check signed stream token when streaming audio directly from HTML5 <audio> / mobile players
  if (options?.trackIdForStreamToken) {
    const streamToken = request.nextUrl.searchParams.get('token')?.trim() || '';
    if (streamToken) {
      const valid = await verifyStrideIqStreamToken(options.trackIdForStreamToken, streamToken);
      if (valid) {
        const rate = checkRateLimit(`stream:${options.trackIdForStreamToken}`, Math.max(limit, 300));
        if (!rate.allowed) {
          return {
            authorized: false,
            rateHeaders: rate.headers,
            response: NextResponse.json(
              { ok: false, error: 'Rate limit exceeded. Retry shortly.' },
              { status: 429, headers: { ...cors, ...rate.headers } }
            ),
          };
        }
        recordApiUsage(request, { authType: 'stream_token', statusCode: 206 });
        return { authorized: true, authType: 'stream_token', rateHeaders: rate.headers };
      }
    }
  }

  // 2. Extract API key or Bearer token (supports headers and query parameters)
  const apiKeyHeader =
    request.headers.get('x-api-key')?.trim() ||
    request.headers.get('x-famio-api-key')?.trim() ||
    request.headers.get('x-chancetek-api-key')?.trim() ||
    request.headers.get('x-strideiq-api-key')?.trim() ||
    request.headers.get('x-strideiq-partner-key')?.trim() ||
    request.nextUrl.searchParams.get('x-api-key')?.trim() ||
    request.nextUrl.searchParams.get('x-famio-api-key')?.trim() ||
    request.nextUrl.searchParams.get('x-strideiq-api-key')?.trim() ||
    request.nextUrl.searchParams.get('api_key')?.trim() ||
    request.nextUrl.searchParams.get('apiKey')?.trim() ||
    request.nextUrl.searchParams.get('key')?.trim() ||
    '';
  const authHeader = request.headers.get('authorization')?.trim() || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const candidateKey = apiKeyHeader || (bearer && !bearer.includes('.') ? bearer : '');

  if (candidateKey) {
    const candidateHash = sha256Hex(candidateKey);

    // Check env configured keys
    for (const envKey of getEnvApiKeys()) {
      if (safeEqualHex(candidateHash, sha256Hex(envKey))) {
        const rate = checkRateLimit(`key:env:${candidateHash.slice(0, 12)}`, limit);
        if (!rate.allowed) {
          return {
            authorized: false,
            rateHeaders: rate.headers,
            response: NextResponse.json(
              { ok: false, error: 'Rate limit exceeded. Retry shortly.' },
              { status: 429, headers: { ...cors, ...rate.headers } }
            ),
          };
        }
        recordApiUsage(request, {
          authType: 'api_key',
          partnerKeyId: 'env-partner-key',
          candidateKey,
        });
        return {
          authorized: true,
          authType: 'api_key',
          partnerKeyId: 'env-strideiq-key',
          rateHeaders: rate.headers,
        };
      }
    }

    // Check persisted admin-issued keys
    const storedKeys = await listPartnerApiKeys();
    const matched = storedKeys.find((k) => !k.revokedAt && safeEqualHex(candidateHash, k.sha256));
    if (matched) {
      const rate = checkRateLimit(`key:${matched.id}`, limit);
      if (!rate.allowed) {
        return {
          authorized: false,
          rateHeaders: rate.headers,
          response: NextResponse.json(
            { ok: false, error: 'Rate limit exceeded. Retry shortly.' },
            { status: 429, headers: { ...cors, ...rate.headers } }
          ),
        };
      }
      touchPartnerKeyLastUsed(matched.id).catch(() => { });
      recordApiUsage(request, {
        authType: 'api_key',
        partnerKeyId: matched.id,
        keyLabel: matched.label,
        keyPrefix: matched.prefix,
        appType: matched.appType,
        candidateKey,
      });
      return {
        authorized: true,
        authType: 'api_key',
        partnerKeyId: matched.id,
        rateHeaders: rate.headers,
      };
    }
  }

  // 3. Support Firebase ID token if a StrideIQ.fit user linked their ChanceTEK One account
  if (bearer && bearer.split('.').length === 3) {
    try {
      const { adminAuth } = await getFirebaseAdmin();
      const decoded = await adminAuth.verifyIdToken(bearer);
      if (decoded?.uid) {
        const rate = checkRateLimit(`fb:${decoded.uid}`, limit);
        recordApiUsage(request, {
          authType: 'firebase_user',
          partnerKeyId: `fb:${decoded.uid}`,
          keyLabel: 'Firebase User Token',
          keyPrefix: 'firebase-jwt',
          appType: 'user',
          userId: decoded.uid,
          userEmail: decoded.email || undefined,
          userName: typeof decoded.name === 'string' ? decoded.name : undefined,
        });
        return {
          authorized: true,
          authType: 'firebase_user',
          userId: decoded.uid,
          email: decoded.email || undefined,
          rateHeaders: rate.headers,
        };
      }
    } catch { }
  }

  const rate = checkRateLimit(`anon:${request.headers.get('x-forwarded-for') || 'unknown'}`, 30);
  const isV1Path = request.nextUrl.pathname.startsWith('/api/v1');
  const docsUrl = isV1Path
    ? `${resolvePublicOrigin(request)}/api/v1`
    : `${resolvePublicOrigin(request)}/api/strideiq/v1`;

  return {
    authorized: false,
    rateHeaders: rate.headers,
    response: NextResponse.json(
      {
        ok: false,
        error: 'Unauthorized: Missing or invalid ChanceTEK One Partner API key.',
        docsUrl,
        setupHint:
          'Send a valid key via `x-api-key`, `x-famio-api-key`, `x-strideiq-api-key`, or `Authorization: Bearer <key>`. Platform admins can issue partner keys in ChanceTEK One Admin > Developer API Keys or configure CHANCETEK_API_KEY / STRIDEIQ_API_KEY / FAMIO_API_KEY.',
      },
      {
        status: 401,
        headers: {
          ...cors,
          ...rate.headers,
          'WWW-Authenticate': 'Bearer realm="ChanceTEK One Universal Partner API"',
        },
      }
    ),
  };
}

export async function recordStrideIqTelemetry(
  eventInput: Omit<StrideIqTelemetryEvent, 'id' | 'timestamp'>
): Promise<StrideIqTelemetryEvent> {
  const record: StrideIqTelemetryEvent = {
    ...eventInput,
    id: `sqevt_${Date.now()}_${randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
  };

  const current = readLocalTelemetry();
  current.events = [record, ...current.events].slice(0, 500);
  if (record.event === 'play_start') {
    current.totalStreams += 1;
    const act = record.activity || 'running';
    current.byActivity[act] = (current.byActivity[act] || 0) + 1;
    const mt = record.mediaType || 'music';
    current.byMediaType[mt] = (current.byMediaType[mt] || 0) + 1;
  } else if (record.event === 'track_complete') {
    current.totalCompleted += 1;
  }
  writeLocalTelemetry(current);

  if (canUseFirebaseAdmin()) {
    try {
      const { adminDb } = await getFirebaseAdmin();
      await adminDb.collection(STRIDEIQ_TELEMETRY_COLLECTION).doc(record.id).set(record);
    } catch { }
  }

  return record;
}

export async function getStrideIqTelemetrySummary(): Promise<{
  totalStreams: number;
  totalCompleted: number;
  byActivity: Record<string, number>;
  byMediaType: Record<string, number>;
  recentEvents: StrideIqTelemetryEvent[];
}> {
  const local = readLocalTelemetry();
  return {
    totalStreams: local.totalStreams,
    totalCompleted: local.totalCompleted,
    byActivity: local.byActivity,
    byMediaType: local.byMediaType,
    recentEvents: local.events.slice(0, 25),
  };
}

