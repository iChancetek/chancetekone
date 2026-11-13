'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  KeyRound,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiUsageMonitorSection } from './ApiUsageMonitorSection';

interface PublicKeyRecord {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface TelemetrySummary {
  totalStreams: number;
  totalCompleted: number;
  byActivity: Record<string, number>;
}

interface TestMixTrack {
  id: string;
  mediaType?: 'music' | 'audiobook_chapter' | 'podcast';
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  durationSeconds: number;
  workoutPhase?: string;
  streamUrl: string | null;
}

const MEDIA_MODES = [
  { id: 'music', label: 'Music Only' },
  { id: 'audiobook', label: 'Audiobooks & Literature' },
  { id: 'podcast', label: 'Podcasts' },
  { id: 'mixed', label: 'Mixed (Music + Spoken)' },
];

const WORKOUT_ACTIVITIES = [
  { id: 'running', label: 'Running' },
  { id: 'walking', label: 'Walking' },
  { id: 'biking', label: 'Biking / Cycling' },
  { id: 'jogging', label: 'Jogging' },
  { id: 'hiit', label: 'HIIT / Intervals' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'strength', label: 'Strength' },
  { id: 'warmup', label: 'Warm-Up' },
  { id: 'cooldown', label: 'Cool-Down / Yoga' },
];

export const StrideIqIntegrationCard: React.FC<{ hideUsageMonitor?: boolean }> = ({
  hideUsageMonitor = false,
}) => {
  const { user, profile } = useAuth();

  const [baseUrl, setBaseUrl] = useState('https://chancetekone.us/api/strideiq/v1');
  const [playableCount, setPlayableCount] = useState<number | null>(null);
  const [audiobookCount, setAudiobookCount] = useState<number | null>(null);
  const [podcastCount, setPodcastCount] = useState<number | null>(null);
  const [keys, setKeys] = useState<PublicKeyRecord[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySummary>({
    totalStreams: 0,
    totalCompleted: 0,
    byActivity: {},
  });

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<'famio' | 'strideiq' | 'universal'>('famio');
  const [snippetTab, setSnippetTab] = useState<'famio' | 'strideiq' | 'curl'>('famio');
  const [keyLabel, setKeyLabel] = useState('Famio.us Social Platform');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive Mix Preview
  const [testMediaMode, setTestMediaMode] = useState('music');
  const [testActivity, setTestActivity] = useState('running');
  const [testDuration, setTestDuration] = useState(30);
  const [testCadence, setTestCadence] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    averageBpm: number | null;
    mediaMode?: string;
    actualDurationSeconds: number;
    tracks: TestMixTrack[];
  } | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);

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
      /* session fallback header used */
    }
    return headers;
  }, [profile?.email, user?.email]);

  const loadIntegrationState = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [healthRes, keysRes] = await Promise.all([
        fetch('/api/strideiq/v1/health'),
        fetch('/api/strideiq/v1/keys', { headers: await buildAdminHeaders() }),
      ]);

      const healthData = await healthRes.json().catch(() => null);
      if (healthRes.ok && healthData?.ok) {
        setPlayableCount(healthData.catalog?.playableTracksCount ?? null);
        setAudiobookCount(healthData.catalog?.playableAudiobooksCount ?? null);
        setPodcastCount(healthData.catalog?.playablePodcastsCount ?? null);
      }

      const keysData = await keysRes.json().catch(() => null);
      if (keysRes.ok && keysData?.ok) {
        if (keysData.baseUrl) setBaseUrl(keysData.baseUrl);
        setKeys(Array.isArray(keysData.keys) ? keysData.keys : []);
        if (keysData.telemetry) setTelemetry(keysData.telemetry);
      } else if (keysRes.status === 401 || keysRes.status === 403) {
        setErrorMsg('Sign in with an administrator account to issue or revoke StrideIQ partner keys.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load StrideIQ partner configuration.');
    } finally {
      setLoading(false);
    }
  }, [buildAdminHeaders]);

  useEffect(() => {
    void loadIntegrationState();
    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {}
  };

  const handleCreateKey = async () => {
    setCreating(true);
    setErrorMsg(null);
    try {
      const appType = selectedApp === 'famio' ? 'social' : selectedApp === 'strideiq' ? 'fitness' : 'general';
      const prefix = selectedApp === 'famio' ? 'sk_famio_' : selectedApp === 'strideiq' ? 'sk_strideiq_' : 'sk_live_';
      const defaultLabel = selectedApp === 'famio' ? 'Famio.us Social Platform' : selectedApp === 'strideiq' ? 'StrideIQ.fit Production App' : 'Universal Live Platform Key';
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: await buildAdminHeaders(),
        body: JSON.stringify({
          label: keyLabel.trim() || defaultLabel,
          appType,
          prefix,
          scopes: ['read', 'stream', 'telemetry'],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to generate partner key.');
      }
      setRevealedKey(data.apiKey);
      await loadIntegrationState();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not issue partner API key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/strideiq/v1/keys?id=${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
        headers: await buildAdminHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to revoke key.');
      }
      await loadIntegrationState();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to revoke key.');
    }
  };

  const handleTestMix = async () => {
    setTestLoading(true);
    setErrorMsg(null);
    try {
      const headers = await buildAdminHeaders();
      if (revealedKey) {
        headers['x-strideiq-api-key'] = revealedKey;
      }
      const res = await fetch('/api/strideiq/v1/workout-mix', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          activity: testActivity,
          mediaMode: testMediaMode,
          targetDurationMinutes: testDuration,
          cadenceSpm: testCadence ? Number(testCadence) : undefined,
          structure: 'warmup_main_cooldown',
          limit: 6,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            'Mix preview requires either an active Firebase session token or a newly generated Partner API key.',
        );
      }
      setTestResult(data.mix);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Mix generation failed.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSyncLiveCatalog = async () => {
    setIsSyncingLive(true);
    setErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/catalog/sync', {
        method: 'POST',
        headers: await buildAdminHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Live synchronization failed.');
      }
      setSyncSuccessMsg(
        `Synchronized ${data.synced?.tracks || 0} tracks, ${data.synced?.audiobooks || 0} books, and ${data.synced?.podcasts || 0} podcasts in real time!`
      );
      setTimeout(() => setSyncSuccessMsg(null), 5000);
      await loadIntegrationState();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sync failed.');
    } finally {
      setIsSyncingLive(false);
    }
  };

  const togglePreviewTrack = (track: TestMixTrack) => {
    if (!track.streamUrl) return;
    if (previewTrackId === track.id && audioEl) {
      audioEl.pause();
      setPreviewTrackId(null);
      return;
    }
    if (audioEl) {
      audioEl.pause();
    }
    const next = new Audio(track.streamUrl);
    next.onended = () => setPreviewTrackId(null);
    next.onerror = () => setPreviewTrackId(null);
    void next.play();
    setAudioEl(next);
    setPreviewTrackId(track.id);
  };

  const famioSnippetCode = `// Famio.us Social Platform Client (Music & Audiobook Feed Streaming)
const FAMIO_API_KEY = process.env.CHANCETEK_FAMIO_API_KEY!; // sk_famio_...
const CHANCETEK_API_URL = 'https://chancetekone.us/api/v1';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': FAMIO_API_KEY, // or 'x-famio-api-key'
};

// 1. Search music tracks or crates to attach to a Famio social post
const searchRes = await fetch(\`\${CHANCETEK_API_URL}/tracks?q=nas&limit=10\`, { headers });
const { tracks } = await searchRes.json();

// 2. Fetch curated audiobooks & literature chapters
const booksRes = await fetch(\`\${CHANCETEK_API_URL}/audiobooks?limit=20\`, { headers });
const { audiobooks } = await booksRes.json();

// 3. Play stream directly in Famio post feed (HTTP 206 Byte-Range seeking):
// Every track or chapter has a pre-signed streamUrl with HMAC token for instant playback:
const audio = new Audio(tracks[0].streamUrl);
await audio.play();`;

  const strideIqSnippetCode = `// StrideIQ.fit Client (Cadence-Aware Mixes & Real-Time Sync)
const STRIDEIQ_API_KEY = process.env.STRIDEIQ_CHANCETEK_API_KEY!; // sk_strideiq_...
const CHANCETEK_API_URL = 'https://chancetekone.us/api/v1';

const headers = {
  'Content-Type': 'application/json',
  'x-strideiq-api-key': STRIDEIQ_API_KEY,
};

// 1. Generate workout queue matching cadence & activity
const mixRes = await fetch(\`\${CHANCETEK_API_URL}/workout-mix\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    activity: 'running', // walking | running | biking | hiit | strength | cooldown
    mediaMode: 'mixed',  // music | audiobook | podcast | mixed
    targetDurationMinutes: 45,
    cadenceSpm: 172,
    structure: 'warmup_main_cooldown',
  }),
});
const { mix } = await mixRes.json();

// 2. Play audio stream with AVPlayer / ExoPlayer / HTML5 Audio:
const audio = new Audio(mix.tracks[0].streamUrl);
await audio.play();`;

  const curlSnippetCode = `# 1. Test Famio.us / Universal API with API Key:
curl -H "x-api-key: sk_famio_YOUR_KEY" \\
  https://chancetekone.us/api/v1/tracks?q=nas

# 2. Real-time Live Catalog Sync (Tracks, Audiobooks, Podcasts, Crates):
curl -H "x-api-key: sk_famio_YOUR_KEY" \\
  https://chancetekone.us/api/v1/sync

# 3. Stream Audio Chunk with Byte-Range Seeking (HTTP 206):
curl -i -H "Range: bytes=0-1048576" \\
  "https://chancetekone.us/api/v1/stream/TRACK_ID?token=STREAM_TOKEN"`;

  const activeSnippet =
    snippetTab === 'famio'
      ? famioSnippetCode
      : snippetTab === 'strideiq'
      ? strideIqSnippetCode
      : curlSnippetCode;

  return (
    <div className="p-6 rounded-3xl glass-panel border border-emerald-500/20 space-y-5 bg-gradient-to-br from-emerald-950/15 via-black/40 to-amber-950/10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-serif text-white">Partner &amp; Developer API Console</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Famio.us &amp; StrideIQ.fit
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                /api/v1 Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Universal Platform API v1 for streaming verified Music, Audiobooks &amp; Podcasts across Famio.us social media feeds, StrideIQ.fit workouts, and partner applications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncLiveCatalog}
            disabled={isSyncingLive}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-105 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
            title="Push all canonical music, uploads, audiobooks, and podcasts to live partner store"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? 'animate-spin' : ''}`} />
            <span>{isSyncingLive ? 'Syncing...' : 'Sync Live Catalog'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSnippet((s) => !s)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            {showSnippet ? 'Hide SDK Snippet' : 'SDK Snippet'}
          </button>
          <button
            type="button"
            onClick={loadIntegrationState}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Playable Catalog</p>
          <p className="text-lg font-semibold text-white mt-1">
            {playableCount !== null ? `${playableCount} Tracks` : '—'}
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {audiobookCount !== null ? `${audiobookCount} Books` : '—'} ·{' '}
            {podcastCount !== null ? `${podcastCount} Podcasts` : '—'}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Active Partner Keys</p>
          <p className="text-xl font-semibold text-emerald-400 mt-1">
            {keys.filter((k) => !k.revokedAt).length}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Workout Streams</p>
          <p className="text-xl font-semibold text-amber-400 mt-1">{telemetry.totalStreams}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Completed Plays</p>
          <p className="text-xl font-semibold text-white mt-1">{telemetry.totalCompleted}</p>
        </div>
      </div>

      {/* Endpoint Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {[
          { id: 'v1base', label: 'Universal Base URL (/api/v1)', val: baseUrl.replace('/api/strideiq/v1', '/api/v1') },
          { id: 'sync', label: 'Live Catalog Sync (Full Real-Time)', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/sync` },
          { id: 'tracks', label: 'Tracks & Search (Nas, R&B, etc.)', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/tracks` },
          { id: 'audiobooks', label: 'Audiobooks & Chapters', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/audiobooks` },
          { id: 'podcasts', label: 'Podcasts Feed', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/podcasts` },
          { id: 'stream', label: 'Range Stream (HTTP 206 Seeking)', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/stream/{assetId}?token=...` },
          { id: 'openapi', label: 'OpenAPI 3.1 Schema', val: `${baseUrl.replace('/api/strideiq/v1', '/api/v1')}/openapi.json` },
          { id: 'strideiq', label: 'StrideIQ Fitness Mix Route', val: `${baseUrl}/workout-mix` },
        ].map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 p-3 rounded-xl bg-black/45 border border-white/10"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p>
              <p className="font-mono text-zinc-200 truncate mt-0.5">{item.val}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(item.id, item.val)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 shrink-0"
              title="Copy URL"
            >
              {copiedId === item.id ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}
      </div>

      {showSnippet && (
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-amber-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mr-2">
                Quick Integration SDK:
              </span>
              <button
                type="button"
                onClick={() => setSnippetTab('famio')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  snippetTab === 'famio'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Famio.us (Social Web)
              </button>
              <button
                type="button"
                onClick={() => setSnippetTab('strideiq')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  snippetTab === 'strideiq'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                StrideIQ.fit (Workouts)
              </button>
              <button
                type="button"
                onClick={() => setSnippetTab('curl')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  snippetTab === 'curl'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                cURL / REST API
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('snippet', activeSnippet)}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 self-start sm:self-auto"
            >
              {copiedId === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Snippet
            </button>
          </div>
          <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            {activeSnippet}
          </pre>
        </div>
      )}

      {syncSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Partner Key Issuer */}
      <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-medium text-white">Partner API Keys</h4>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-400 mr-1">App Preset:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedApp('famio');
                setKeyLabel('Famio.us Social Platform');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedApp === 'famio'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              Famio.us
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedApp('strideiq');
                setKeyLabel('StrideIQ.fit Production App');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedApp === 'strideiq'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              StrideIQ.fit
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedApp('universal');
                setKeyLabel('Universal Live Platform Key');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedApp === 'universal'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              Universal Key
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder={`Key label (e.g., ${
              selectedApp === 'famio'
                ? 'Famio.us Social Platform'
                : selectedApp === 'strideiq'
                ? 'StrideIQ.fit iOS & Web'
                : 'Universal Live Key'
            })`}
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={handleCreateKey}
            disabled={creating}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {creating
              ? 'Generating...'
              : `Generate ${
                  selectedApp === 'famio'
                    ? 'Famio.us'
                    : selectedApp === 'strideiq'
                    ? 'StrideIQ'
                    : 'Universal'
                } Key`}
          </button>
        </div>

        {revealedKey && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> New {revealedKey.startsWith('sk_famio_') ? 'Famio.us' : revealedKey.startsWith('sk_strideiq_') ? 'StrideIQ.fit' : 'Universal'} Key (copy now — shown once)
              </span>
              <button
                type="button"
                onClick={() => handleCopy('revealedKey', revealedKey)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-medium flex items-center gap-1"
              >
                {copiedId === 'revealedKey' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Key
              </button>
            </div>
            <p className="font-mono text-xs text-white break-all bg-black/50 p-2 rounded-lg border border-white/10">
              {revealedKey}
            </p>
          </div>
        )}

        {keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/45 border border-white/5 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{k.label}</span>
                    <span className="font-mono text-[11px] text-zinc-400">{k.prefix}...</span>
                    {k.revokedAt ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-400 border border-red-500/30">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Created {new Date(k.createdAt).toLocaleDateString()} by {k.createdBy}
                    {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {!k.revokedAt && (
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(k.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs flex items-center gap-1 self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            No partner keys issued yet. Generate a key above for Famio.us, StrideIQ.fit, or universal live access.
          </p>
        )}
      </div>

      {/* Live Workout Mix Tester */}
      <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-white">Workout Mix, Audiobook &amp; Podcast Simulator</h4>
            <p className="text-xs text-zinc-400">
              Preview Music queues, Audiobooks, Podcasts, or Mixed sessions returned to StrideIQ.fit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={testMediaMode}
              onChange={(e) => setTestMediaMode(e.target.value)}
              className="bg-black/60 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs text-emerald-200"
            >
              {MEDIA_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={testActivity}
              onChange={(e) => setTestActivity(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              {WORKOUT_ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <select
              value={testDuration}
              onChange={(e) => setTestDuration(Number(e.target.value))}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
            <input
              type="number"
              value={testCadence}
              onChange={(e) => setTestCadence(e.target.value)}
              placeholder="Cadence SPM"
              className="w-28 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleTestMix}
              disabled={testLoading}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold"
            >
              {testLoading ? 'Generating...' : 'Test Mix'}
            </button>
          </div>
        </div>

        {testResult && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                Queue: <strong className="text-white">{testResult.tracks.length} items</strong>
                {testResult.averageBpm ? (
                  <>
                    {' '}
                    · Avg <strong className="text-amber-300">{testResult.averageBpm} BPM</strong>
                  </>
                ) : (
                  <> · Spoken Audio Session</>
                )}
              </span>
              <span>{Math.round(testResult.actualDurationSeconds / 60)} min total</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testResult.tracks.map((t, idx) => (
                <div
                  key={`${t.id}-${idx}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/50 border border-white/5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.mediaType && t.mediaType !== 'music' ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] uppercase tracking-wider text-emerald-300">
                          {t.mediaType === 'audiobook_chapter' ? 'Book' : 'Podcast'}
                        </span>
                      ) : t.workoutPhase ? (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] uppercase tracking-wider text-zinc-300">
                          {t.workoutPhase}
                        </span>
                      ) : null}
                      <span className="text-white font-medium truncate">{t.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {t.artist} ·{' '}
                      {t.bpm > 0 ? `${t.bpm} BPM` : `${Math.max(1, Math.round(t.durationSeconds / 60))} min`}{' '}
                      · {t.genre}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreviewTrack(t)}
                    disabled={!t.streamUrl}
                    className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 shrink-0 disabled:opacity-40"
                    title="Audition signed StrideIQ stream"
                  >
                    {previewTrackId === t.id ? (
                      <Square className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Partner API Usage Monitor (Hour, Day, Week, Year, Exact Time) */}
      {!hideUsageMonitor && <ApiUsageMonitorSection />}
    </div>
  );
};

