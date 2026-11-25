'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Music,
  BookOpen,
  Mic,
  Video,
  CheckCircle2,
  Activity,
  Clock,
  Layers,
  ExternalLink,
  Pause,
  Play,
} from 'lucide-react';

interface ReplicatedItemSummary {
  id: string;
  title: string;
  subtitle: string;
  area: 'music' | 'audiobooks' | 'podcasts' | 'videos';
  coverUrl?: string;
  replicatedAt: string;
  replicatedMs: number;
  runId?: string | null;
}

interface ReplicationSnapshotState {
  revision: number;
  counts: {
    music: number;
    audiobooks: number;
    podcasts: number;
    videos: number;
    total: number;
  };
  latestRunId: string | null;
  latestReplicatedAt: string | null;
  latestReplicatedMs: number;
  recentItems: ReplicatedItemSummary[];
}

const EMPTY_STATE: ReplicationSnapshotState = {
  revision: 0,
  counts: { music: 0, audiobooks: 0, podcasts: 0, videos: 0, total: 0 },
  latestRunId: null,
  latestReplicatedAt: null,
  latestReplicatedMs: 0,
  recentItems: [],
};

const ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

function formatRelativeTime(ms: number, nowMs: number): string {
  if (!ms) return 'No items yet';
  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function areaHref(area: ReplicatedItemSummary['area'], id: string): string {
  if (area === 'music') return `/music/${encodeURIComponent(id)}`;
  if (area === 'audiobooks') return `/audiobooks`;
  if (area === 'podcasts') return `/podcasts`;
  return `/videos`;
}

export const ReplicationStatusCard: React.FC = () => {
  const [data, setData] = useState<ReplicationSnapshotState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number>(Date.now());
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const fetchReplicationStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Catalog returned ${res.status}`);
      const json = await res.json();
      const snapshot = json?.snapshot;
      if (!snapshot?.collections) {
        setData(EMPTY_STATE);
        setError(null);
        return;
      }

      const collect = (
        docs: any[] | undefined,
        area: ReplicatedItemSummary['area']
      ): ReplicatedItemSummary[] => {
        if (!Array.isArray(docs)) return [];
        const matched: ReplicatedItemSummary[] = [];
        for (const d of docs) {
          if (!d) continue;
          const isReplicated =
            d.sourcePlatform === '8ofspadesworks' ||
            Boolean(d.replicatedAt) ||
            Boolean(d.replicationRunId);
          if (!isReplicated) continue;

          const repAt = String(d.replicatedAt || d.uploadedAt || d.updatedAt || '');
          const repMs = repAt ? Date.parse(repAt) : 0;
          matched.push({
            id: String(d.id || ''),
            title: String(d.title || 'Untitled'),
            subtitle: String(
              d.artistName || d.author || d.host || d.showTitle || 'Catalog Item'
            ),
            area,
            coverUrl: d.coverUrl || d.thumbnailUrl || undefined,
            replicatedAt: repAt,
            replicatedMs: Number.isFinite(repMs) ? repMs : 0,
            runId: d.replicationRunId || null,
          });
        }
        return matched;
      };

      const musicItems = collect(snapshot.collections.tracks, 'music');
      const audiobookItems = collect(snapshot.collections.audiobooks, 'audiobooks');
      const podcastItems = collect(snapshot.collections.podcasts, 'podcasts');
      const videoItems = collect(snapshot.collections.videos, 'videos');

      const allItems = [
        ...musicItems,
        ...audiobookItems,
        ...podcastItems,
        ...videoItems,
      ].sort((a, b) => b.replicatedMs - a.replicatedMs);

      const latest = allItems[0];

      setData({
        revision: Number(snapshot.revision || 0),
        counts: {
          music: musicItems.length,
          audiobooks: audiobookItems.length,
          podcasts: podcastItems.length,
          videos: videoItems.length,
          total: allItems.length,
        },
        latestRunId: latest?.runId || null,
        latestReplicatedAt: latest?.replicatedAt || null,
        latestReplicatedMs: latest?.replicatedMs || 0,
        recentItems: allItems.slice(0, 6),
      });
      setError(null);
      setLastCheckedAt(Date.now());
    } catch (err: any) {
      setError(err?.message || 'Unable to read replication status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchReplicationStatus(false);
  }, [fetchReplicationStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const poll = window.setInterval(() => {
      if (!document.hidden) void fetchReplicationStatus(false);
    }, 6000);
    return () => window.clearInterval(poll);
  }, [autoRefresh, fetchReplicationStatus]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(tick);
  }, []);

  const isInProgress = useMemo(
    () =>
      data.latestReplicatedMs > 0 &&
      nowMs - data.latestReplicatedMs < ACTIVE_WINDOW_MS,
    [data.latestReplicatedMs, nowMs]
  );

  const areaPill = (area: ReplicatedItemSummary['area']) => {
    switch (area) {
      case 'music':
        return { label: 'Music', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/35' };
      case 'audiobooks':
        return { label: 'Audiobook', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/35' };
      case 'podcasts':
        return { label: 'Podcast', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/35' };
      case 'videos':
        return { label: 'Video', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/35' };
    }
  };

  return (
    <div className="relative p-6 rounded-3xl bg-gradient-to-br from-[#0b1324]/95 via-[#090d1a]/98 to-[#05070f] border border-emerald-500/30 shadow-[0_12px_40px_rgba(16,185,129,0.12)] overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header Row */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Live Catalog Replication Monitor
              </h3>
              {isInProgress ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  In Progress
                </span>
              ) : data.counts.total > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-[10px] font-extrabold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  Synced &amp; Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Standby — Ready
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Endpoint <code className="text-emerald-300/90 font-mono">/api/replication/ingest</code> •
              Catalog Rev <span className="text-white font-mono font-bold">#{data.revision}</span>
              {data.latestRunId && (
                <>
                  {' '}• Run <span className="text-neutral-200 font-mono">{data.latestRunId}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-white/5 border-white/15 text-neutral-300 hover:bg-white/10'
            }`}
            title="Toggle 6-second live polling"
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Live (6s)' : 'Paused'}</span>
          </button>
          <button
            onClick={() => void fetchReplicationStatus(true)}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Area Counters */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-neutral-400 text-[11px] font-semibold mb-1">
            <span>Total Replicated</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {loading ? '—' : data.counts.total.toLocaleString()}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-500/[0.06] border border-purple-500/20">
          <div className="flex items-center justify-between text-purple-300 text-[11px] font-semibold mb-1">
            <span>Music</span>
            <Music className="w-3.5 h-3.5" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {loading ? '—' : data.counts.music.toLocaleString()}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-blue-500/[0.06] border border-blue-500/20">
          <div className="flex items-center justify-between text-blue-300 text-[11px] font-semibold mb-1">
            <span>Audiobooks</span>
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {loading ? '—' : data.counts.audiobooks.toLocaleString()}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20">
          <div className="flex items-center justify-between text-amber-300 text-[11px] font-semibold mb-1">
            <span>Podcasts</span>
            <Mic className="w-3.5 h-3.5" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {loading ? '—' : data.counts.podcasts.toLocaleString()}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-rose-300 text-[11px] font-semibold mb-1">
            <span>Videos</span>
            <Video className="w-3.5 h-3.5" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {loading ? '—' : data.counts.videos.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Latest Replicated Items Feed */}
      <div className="relative z-10">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2.5">
          <span className="font-bold uppercase tracking-wider text-[11px] text-neutral-300">
            Most Recently Replicated Items
          </span>
          <span className="flex items-center gap-1.5 text-[11px]">
            <Clock className="w-3 h-3 text-emerald-400" />
            Last arrival:{' '}
            <span className="text-white font-semibold">
              {formatRelativeTime(data.latestReplicatedMs, nowMs)}
            </span>
          </span>
        </div>

        {data.recentItems.length === 0 ? (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-neutral-400">
            No replicated items received yet. Start a replication run from the source platform—incoming songs, audiobooks, podcasts, and videos will appear here automatically.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.recentItems.map((item) => {
              const pill = areaPill(item.area);
              return (
                <Link
                  key={`${item.area}-${item.id}`}
                  href={areaHref(item.area, item.id)}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-400/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 flex items-center justify-center">
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate">{item.subtitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-1.5 py-0.2 rounded-md border text-[9px] font-bold uppercase tracking-wider ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {formatRelativeTime(item.replicatedMs, nowMs)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500">
          <span>Synced from live shared catalog snapshot</span>
          <span className="font-mono">
            Checked {formatRelativeTime(lastCheckedAt, nowMs)}
          </span>
        </div>
      </div>
    </div>
  );
};

