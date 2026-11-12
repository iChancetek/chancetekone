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
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  durationSeconds: number;
  workoutPhase?: string;
  streamUrl: string | null;
}

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

export const StrideIqIntegrationCard: React.FC = () => {
  const { user, profile } = useAuth();

  const [baseUrl, setBaseUrl] = useState('https://chancetekone.us/api/strideiq/v1');
  const [playableCount, setPlayableCount] = useState<number | null>(null);
  const [keys, setKeys] = useState<PublicKeyRecord[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySummary>({
    totalStreams: 0,
    totalCompleted: 0,
    byActivity: {},
  });

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [keyLabel, setKeyLabel] = useState('StrideIQ.fit Production App');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive Mix Preview
  const [testActivity, setTestActivity] = useState('running');
  const [testDuration, setTestDuration] = useState(30);
  const [testCadence, setTestCadence] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    averageBpm: number;
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
      const res = await fetch('/api/strideiq/v1/keys', {
        method: 'POST',
        headers: await buildAdminHeaders(),
        body: JSON.stringify({
          label: keyLabel.trim() || 'StrideIQ.fit Production App',
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

  const snippetCode = `// StrideIQ.fit Client Example (Web / React Native / TypeScript)
const res = await fetch('${baseUrl}/workout-mix', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-strideiq-api-key': process.env.STRIDEIQ_CHANCETEK_API_KEY!,
  },
  body: JSON.stringify({
    activity: 'running', // walking | running | biking | hiit | strength | cooldown
    targetDurationMinutes: 45,
    cadenceSpm: 172,
    structure: 'warmup_main_cooldown',
  }),
});

const { mix } = await res.json();
// Stream tracks directly using signed HTTP 206 streamUrl (no custom headers needed in audio player):
const firstTrack = mix.tracks[0];
const audio = new Audio(firstTrack.streamUrl);
await audio.play();`;

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
              <h3 className="text-lg font-serif text-white">StrideIQ.fit Partner Streaming API</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                API v1 Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Powers Running, Walking, Biking, HIIT &amp; Cool-Down workout audio streaming from ChanceTEK One directly inside StrideIQ.fit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <p className="text-xl font-semibold text-white mt-1">
            {playableCount !== null ? `${playableCount} Tracks` : '—'}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {[
          { id: 'base', label: 'Base Partner URL', val: baseUrl },
          { id: 'openapi', label: 'OpenAPI 3.1 Schema', val: `${baseUrl}/openapi.json` },
          { id: 'mix', label: 'Workout Mix Generator (POST/GET)', val: `${baseUrl}/workout-mix` },
          { id: 'stream', label: 'Range Stream (HTTP 206)', val: `${baseUrl}/stream/{trackId}?token=...` },
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
        <div className="p-4 rounded-2xl bg-zinc-950/90 border border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              StrideIQ.fit Integration Code
            </span>
            <button
              type="button"
              onClick={() => handleCopy('snippet', snippetCode)}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1"
            >
              {copiedId === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Snippet
            </button>
          </div>
          <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            {snippetCode}
          </pre>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Partner Key Issuer */}
      <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-medium text-white">Partner API Keys</h4>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="Key label (e.g., StrideIQ.fit iOS & Web)"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={handleCreateKey}
            disabled={creating}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {creating ? 'Generating...' : 'Generate StrideIQ API Key'}
          </button>
        </div>

        {revealedKey && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> New StrideIQ Partner Key (copy now — shown once)
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
            No StrideIQ.fit partner keys issued yet. Generate one above to authorize the fitness application.
          </p>
        )}
      </div>

      {/* Live Workout Mix Tester */}
      <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-white">Workout Cadence Mix Simulator</h4>
            <p className="text-xs text-zinc-400">
              Preview the exact BPM-matched Warm-Up -&gt; Main -&gt; Cool-Down queue returned to StrideIQ.fit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                Queue: <strong className="text-white">{testResult.tracks.length} tracks</strong> · Avg{' '}
                <strong className="text-amber-300">{testResult.averageBpm} BPM</strong>
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
                      {t.workoutPhase && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] uppercase tracking-wider text-zinc-300">
                          {t.workoutPhase}
                        </span>
                      )}
                      <span className="text-white font-medium truncate">{t.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {t.artist} · {t.bpm} BPM · {t.genre}
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
    </div>
  );
};

