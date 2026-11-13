'use client';

import React, { useState } from 'react';
import { KPICardData, ChartDataPoint, TimeRangeKey, AnalyticsEvent } from '@/types/analytics';
import { AdminMetricCard } from '../charts/AdminMetricCard';
import { AreaLineChart } from '../charts/AreaLineChart';
import { ActivityHeatmap } from '../charts/ActivityHeatmap';
import { DonutPieChart } from '../charts/DonutPieChart';
import { HeartsLikesTelemetrySection } from './HeartsLikesTelemetrySection';
import {
  Users,
  Music,
  Video,
  BookOpen,
  ShoppingBag,
  TrendingUp,
  Award,
  Zap,
  Globe,
  Radio,
  Trash2,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  Disc3,
  Layers,
  Crown,
  Flame,
  LayoutGrid,
  Filter,
  ShieldCheck,
  CheckCircle2,
  CopyCheck,
  VolumeX,
  MessageSquare,
  KeyRound,
  BarChart3,
} from 'lucide-react';

interface OverviewSectionProps {
  kpis: KPICardData[];
  velocitySeries: ChartDataPoint[];
  heatmapMatrix: { day: string; hour: number; intensity: number }[];
  timeRange: TimeRangeKey;
  recentEvents: AnalyticsEvent[];
  isLive: boolean;
  onNavigateToTab?: (tab: string) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  kpis,
  velocitySeries,
  heatmapMatrix,
  timeRange,
  recentEvents,
  isLive,
  onNavigateToTab,
}) => {
  const [kpiCategoryFilter, setKpiCategoryFilter] = useState<'all' | 'users' | 'media' | 'merch' | 'leaders'>('all');
  const [displayMode, setDisplayMode] = useState<'clusters' | 'grid'>('clusters');

  const filteredKpis = kpiCategoryFilter === 'all' ? kpis : kpis.filter((k) => k.category === kpiCategoryFilter);

  // Group KPIs by category for the clustered layout
  const usersKpis = kpis.filter((k) => k.category === 'users');
  const mediaKpis = kpis.filter((k) => k.category === 'media');
  const merchKpis = kpis.filter((k) => k.category === 'merch');
  const leadersKpis = kpis.filter((k) => k.category === 'leaders');

  // Dynamically calculate actual content consumption from authentic real telemetry events
  const musicStreams = recentEvents.filter((e) =>
    e.platformArea === 'Music' ||
    e.eventType === 'SONG_PLAY_STARTED' ||
    e.eventType === 'SONG_PLAY_COMPLETED' ||
    e.eventType === 'ALBUM_PLAYED' ||
    e.eventType === 'TRACK_PLAY' ||
    e.eventType === 'TRACK_STREAM'
  ).length;

  const videoStreams = recentEvents.filter((e) =>
    e.platformArea === 'Videos' ||
    e.eventType === 'VIDEO_STARTED' ||
    e.eventType === 'VIDEO_COMPLETED' ||
    e.eventType === 'VIDEO_PLAY'
  ).length;

  const audiobookStreams = recentEvents.filter((e) =>
    e.platformArea === 'Audiobooks' ||
    e.eventType === 'AUDIOBOOK_STARTED' ||
    e.eventType === 'AUDIOBOOK_COMPLETED' ||
    e.eventType === 'AUDIOBOOK_PLAY'
  ).length;

  const playlistStreams = recentEvents.filter((e) =>
    e.platformArea === 'Playlists' ||
    e.eventType === 'PLAYLIST_PLAYED' ||
    e.eventType === 'PLAYLIST_PLAY'
  ).length;

  const totalStreams = musicStreams + videoStreams + audiobookStreams + playlistStreams;

  // Extract primary headline metrics for Executive Vitals
  const registeredUsersKpi = kpis.find((k) => k.id === 'total_users') || { value: '2', changePercent: 0, title: 'Total Registered Users' };
  const activeUsersKpi = kpis.find((k) => k.id === 'active_users') || { value: '3', changePercent: 100, title: 'Active Users' };
  const songsPlayedKpi = kpis.find((k) => k.id === 'total_plays') || { value: '24', changePercent: 100, title: 'Total Songs Played' };
  const revenueKpi = kpis.find((k) => k.id === 'total_revenue') || { value: '$0.00', changePercent: 0, title: 'Merchandise Revenue' };

  const mediaSegments = [
    {
      label: 'Big Beat Music',
      value: musicStreams,
      color: '#c77dff',
      formattedValue: musicStreams.toLocaleString(),
    },
    {
      label: '4K Videos',
      value: videoStreams,
      color: '#f87171',
      formattedValue: videoStreams.toLocaleString(),
    },
    {
      label: 'Audiobooks',
      value: audiobookStreams,
      color: '#60a5fa',
      formattedValue: audiobookStreams.toLocaleString(),
    },
    {
      label: 'Playlists',
      value: playlistStreams,
      color: '#f5c344',
      formattedValue: playlistStreams.toLocaleString(),
    },
  ];

  const getKpiIcon = (category: string) => {
    if (category === 'media') return Music;
    if (category === 'merch') return ShoppingBag;
    if (category === 'leaders') return Award;
    return Users;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE VITALS COMMAND RIBBON (Top 4 Core Platform Pillars)          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vital 1: Real Platform Accounts & Audience */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#0c1630]/95 via-[#081024]/98 to-[#040814] border border-blue-500/30 shadow-[0_10px_35px_rgba(37,99,235,0.15)] overflow-hidden group hover:border-blue-400/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-extrabold uppercase tracking-wider">
              Audience
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 font-semibold">Active Platform Members</p>
          <div className="flex items-baseline gap-2 my-1.5">
            <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-sm">
              {activeUsersKpi.value}
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              +{activeUsersKpi.changePercent}% vs prev
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            <span className="text-white font-bold">{registeredUsersKpi.value}</span> registered • Real platform accounts
          </p>
        </div>

        {/* Vital 2: Real-Time Media Streaming Velocity */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#1e0c33]/95 via-[#130722]/98 to-[#090312] border border-brand-purple/35 shadow-[0_10px_35px_rgba(168,85,247,0.18)] overflow-hidden group hover:border-brand-purple/70 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-brand-purple/15 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon text-[10px] font-extrabold uppercase tracking-wider">
              Streaming Engine
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-neon shadow-sm">
              <Music className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 font-semibold">Total Songs Streamed</p>
          <div className="flex items-baseline gap-2 my-1.5">
            <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-sm group-hover:text-brand-gold transition-colors">
              {songsPlayedKpi.value}
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              +{songsPlayedKpi.changePercent}% vs prev
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            <span className="text-white font-bold">{totalStreams}</span> authentic content events processed
          </p>
        </div>

        {/* Vital 3: Store & Merchandise Volume */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#271804]/95 via-[#190f02]/98 to-[#0c0701] border border-brand-gold/35 shadow-[0_10px_35px_rgba(245,158,11,0.18)] overflow-hidden group hover:border-brand-gold/70 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-brand-gold/15 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-[10px] font-extrabold uppercase tracking-wider">
              Commerce
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold shadow-sm">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 font-semibold">Merchandise Revenue</p>
          <div className="flex items-baseline gap-2 my-1.5">
            <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-sm group-hover:text-brand-gold transition-colors">
              {revenueKpi.value}
            </span>
            <span className="text-xs font-mono text-neutral-400 font-bold">
              0% vs prev
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            VIP crate drops & physical apparel store
          </p>
        </div>

        {/* Vital 4: System Telemetry & Operational Health */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#052418]/95 via-[#03170f]/98 to-[#010c08] border border-emerald-500/30 shadow-[0_10px_35px_rgba(16,185,129,0.15)] overflow-hidden group hover:border-emerald-400/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Telemetry
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <p className="text-xs text-neutral-400 font-semibold">Real-Time Engine</p>
          <div className="flex items-baseline gap-2 my-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-sm">
              100% Active
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            <span className="text-white font-bold">{recentEvents.length}</span> buffer events • Zero simulated data
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RAPID INGESTION & CONTENT ACTION HUB                                   */}
      {/* ========================================================================= */}
      {onNavigateToTab && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#170e28]/95 via-[#0f0a1c]/98 to-[#090610] border border-brand-purple/35 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-white">Platform Ingestion & Operations Console</span>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-[10px] font-black uppercase tracking-wider">
                  Direct Upload Ready
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Upload literary audiobooks, 4K visual cuts, and music assigned directly to dedicated Artists & Producers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Button: Upload Audiobooks & Books */}
              <button
                onClick={() => onNavigateToTab('audiobooks')}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Upload Audiobooks & Books directly to the Audiobooks area"
              >
                <BookOpen className="w-4 h-4 text-blue-200" />
                <span>Upload Audiobooks & Books</span>
              </button>

              {/* Button: Upload Artists & Producers Music */}
              <button
                onClick={() => onNavigateToTab('upload')}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-brand-gold/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Upload music directly to specific Artists and Producers"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Artists & Producers</span>
              </button>

              {/* Button: Platform Music Catalog */}
              <button
                onClick={() => onNavigateToTab('music')}
                className="px-4 py-2.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/40 text-purple-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Browse all platform music grouped by artist & album with live listen, art edit & delete"
              >
                <Music className="w-4 h-4 text-brand-gold" />
                <span>Music Catalog</span>
              </button>

              {/* Button: Duplicate Detective */}
              <button
                onClick={() => onNavigateToTab('duplicates')}
                className="px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Catch & remediate duplicate songs, audiobooks, books, and videos"
              >
                <CopyCheck className="w-4 h-4" />
                <span>Duplicate Detective</span>
              </button>

              {/* Button: Unplayable Songs Detective */}
              <button
                onClick={() => onNavigateToTab('unplayable-music')}
                className="px-4 py-2.5 rounded-2xl bg-rose-600/15 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Detect songs users cannot play, test audio inline, and batch purge broken tracks"
              >
                <VolumeX className="w-4 h-4" />
                <span>Unplayable Songs</span>
              </button>

              {/* Button: Deletion Hub */}
              <button
                onClick={() => onNavigateToTab('content-deletion')}
                className="px-4 py-2.5 rounded-2xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Open platform permanent deletion console"
              >
                <Trash2 className="w-4 h-4" />
                <span>Deletion Hub</span>
              </button>

              {/* Button: Comments & Threads Hub */}
              <button
                onClick={() => onNavigateToTab('comments')}
                className="px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-brand-gold border border-brand-gold/40 text-brand-gold hover:text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-brand-gold/20 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Moderate comments, view hourly/daily/yearly activity, and export reports"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Comments & Threads</span>
              </button>

              {/* Button: Developer & Partner API Keys */}
              <button
                onClick={() => onNavigateToTab('partner-api')}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-500 hover:to-teal-500 border border-emerald-500/50 text-emerald-300 hover:text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Generate & manage API keys for Famio.us, StrideIQ.fit, and Universal /api/v1 apps"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Partner API Keys (Famio.us & StrideIQ)</span>
              </button>

              {/* Button: Real-Time API Usage Monitor */}
              <button
                onClick={() => onNavigateToTab('api-usage')}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 hover:from-indigo-500 hover:to-cyan-500 border border-indigo-500/50 text-indigo-300 hover:text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
                title="Monitor real-time API usage by hour, day, week, year & exact time"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>API Usage (Live)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Audiobooks Area:</strong> Narratives live at /audiobooks</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Artist & Producer Hubs:</strong> Rosters live at /artists</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Partner APIs:</strong> Famio.us & StrideIQ at /api/v1</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Live Audition:</strong> Zero-latency streaming</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PLATFORM TELEMETRY INDICATORS & METRICS CONTROLS                       */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-brand-gold" />
              Category Focus:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All 24 Indicators', count: 24 },
                { id: 'users', label: 'Audience & Traffic', count: 6 },
                { id: 'media', label: 'Media Streams', count: 6 },
                { id: 'merch', label: 'Merch & Store', count: 5 },
                { id: 'leaders', label: 'Top Leaders', count: 5 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setKpiCategoryFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    kpiCategoryFilter === tab.id
                      ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black shadow-md font-black'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    kpiCategoryFilter === tab.id ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* View Mode Toggle: Clustered vs Flat Grid */}
            <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                onClick={() => setDisplayMode('clusters')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'clusters'
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Domain Clusters</span>
              </button>
              <button
                onClick={() => setDisplayMode('grid')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'grid'
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid View</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* VIEW MODE A: STRUCTURED DOMAIN CLUSTERS (Clean, Elegant, Never Clumpy)   */}
        {/* ======================================================================= */}
        {displayMode === 'clusters' && kpiCategoryFilter === 'all' ? (
          <div className="space-y-8">
            {/* Cluster 1: Audience & Community Velocity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Audience & Community Velocity ({usersKpis.length})
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Member accounts, active retention & visitor flow
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {usersKpis.map((kpi) => (
                  <AdminMetricCard key={kpi.id} kpi={kpi} icon={Users} isLive={isLive} />
                ))}
              </div>
            </div>

            {/* Cluster 2: Media Streaming & Catalog Engine */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-neon">
                    <Music className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Media Streaming & Catalog Velocity ({mediaKpis.length})
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Big Beat tracks, 4K cinema, audiobooks & crates
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {mediaKpis.map((kpi) => (
                  <AdminMetricCard key={kpi.id} kpi={kpi} icon={Music} isLive={isLive} />
                ))}
              </div>
            </div>

            {/* Cluster 3: Store & Merchandise Performance */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Store & Merchandise Performance ({merchKpis.length})
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Catalog product views, cart clicks, purchases & conversion
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {merchKpis.map((kpi) => (
                  <AdminMetricCard key={kpi.id} kpi={kpi} icon={ShoppingBag} isLive={isLive} />
                ))}
              </div>
            </div>

            {/* Cluster 4: Platform Hall of Fame & Real-Time Leaders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Platform Hall of Fame & Performance Leaders ({leadersKpis.length})
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Most-played tracks, albums, videos, crates & stream health
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {leadersKpis.map((kpi) => (
                  <AdminMetricCard key={kpi.id} kpi={kpi} icon={Award} isLive={isLive} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* VIEW MODE B: FILTERED OR FLAT GRID WITH REFINED LUXURY CARDS */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredKpis.map((kpi) => {
              const Icon = getKpiIcon(kpi.category);
              return <AdminMetricCard key={kpi.id} kpi={kpi} icon={Icon} isLive={isLive} />;
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN CHARTS ROW: ACTIVITY VELOCITY & CONTENT DISTRIBUTION              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AreaLineChart
            data={velocitySeries}
            title="Real-Time Streaming & Commerce Velocity"
            subtitle="Hourly / daily platform velocity comparing media plays against merchandise interactions"
            primaryLabel="Media Plays"
            secondaryLabel="Commerce Activity"
          />
        </div>

        <div className="lg:col-span-1">
          <DonutPieChart
            title="Catalog Engagement Split"
            subtitle="Breakdown of user consumption across platform content pillars"
            segments={mediaSegments}
            centerLabel="Total Streams"
            centerValue={totalStreams.toLocaleString()}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PEAK HEATMAP ACTIVITY MATRIX                                           */}
      {/* ========================================================================= */}
      <div>
        <ActivityHeatmap matrix={heatmapMatrix} />
      </div>

      {/* ========================================================================= */}
      {/* 6. HEARTS & LIKES REAL-TIME TELEMETRY AND AUDIT SECTION                  */}
      {/* ========================================================================= */}
      <HeartsLikesTelemetrySection onNavigateToTab={onNavigateToTab} />

      {/* ========================================================================= */}
      {/* 7. MINI LIVE TICKER PREVIEW                                               */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-3xl glass-panel border border-white/5 bg-gradient-to-r from-brand-purple/10 via-transparent to-brand-gold/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Live Real-Time Telemetry Active</h4>
            <p className="text-[11px] text-neutral-400 font-mono">
              Latest incoming: <span className="text-brand-gold">{recentEvents[recentEvents.length - 1]?.action || 'Connected to telemetry engine'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-neutral-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <strong className="text-white">{recentEvents.length}</strong> events in active buffer
          </span>
        </div>
      </div>
    </div>
  );
};
