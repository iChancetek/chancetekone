'use client';

import React from 'react';
import { GeoDistributionRecord, UserJourneyPath, SessionAnalyticsSummary, AnalyticsEvent } from '@/types/analytics';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { GeoMapVisualizer } from '../charts/GeoMapVisualizer';
import { UserJourneyFlow } from '../charts/UserJourneyFlow';
import { DonutPieChart } from '../charts/DonutPieChart';
import {
  Users,
  Clock,
  Activity,
  Globe,
  Route,
  Laptop,
  Smartphone,
  Tablet,
  ShieldCheck,
} from 'lucide-react';

interface VisitorSessionsSectionProps {
  geoDistribution: GeoDistributionRecord[];
  userJourneys: UserJourneyPath[];
  sessionSummary: SessionAnalyticsSummary;
  events?: AnalyticsEvent[];
}

export const VisitorSessionsSection: React.FC<VisitorSessionsSectionProps> = ({
  geoDistribution,
  userJourneys,
  sessionSummary,
  events: propEvents,
}) => {
  const allEvents = propEvents || AnalyticsEngine.getEvents();

  // Real authenticated vs anonymous user distribution
  const authCount = new Set(
    allEvents.filter((e) => e.isAuthenticated || Boolean(e.userId)).map((e) => e.userId || e.sessionId)
  ).size;
  const anonCount = new Set(
    allEvents.filter((e) => !e.isAuthenticated && !e.userId).map((e) => e.sessionId)
  ).size;
  const totalUsers = authCount + anonCount;

  const authSplit = [
    {
      label: 'Authenticated Accounts',
      value: authCount,
      color: '#c77dff',
      formattedValue: authCount.toLocaleString(),
    },
    {
      label: 'Anonymous Crate Visitors',
      value: anonCount,
      color: '#f5c344',
      formattedValue: anonCount.toLocaleString(),
    },
  ];

  // Real client device breakdown
  const desktopCount = allEvents.filter((e) => !e.device?.type || e.device?.type === 'desktop').length;
  const mobileCount = allEvents.filter((e) => e.device?.type === 'mobile').length;
  const tabletCount = allEvents.filter((e) => e.device?.type === 'tablet').length;
  const totalDeviceEvents = desktopCount + mobileCount + tabletCount;

  const deviceSplit = [
    {
      label: 'Desktop & Turntables',
      value: desktopCount,
      color: '#60a5fa',
      formattedValue: desktopCount.toLocaleString(),
    },
    {
      label: 'Mobile PWA & iOS',
      value: mobileCount,
      color: '#a78bfa',
      formattedValue: mobileCount.toLocaleString(),
    },
    {
      label: 'Tablet & Studio PWA',
      value: tabletCount,
      color: '#34d399',
      formattedValue: tabletCount.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Session Metrics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl glass-panel border border-brand-purple/30 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            Live Active Sessions
          </span>
          <p className="text-2xl font-black text-white font-mono">{sessionSummary.activeSessions}</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-brand-gold" />
            Avg Session Time
          </span>
          <p className="text-2xl font-black text-brand-gold font-mono">{sessionSummary.avgSessionDuration}</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            Longest Session
          </span>
          <p className="text-2xl font-black text-white font-mono">{sessionSummary.longestSession}</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Users className="w-3 h-3 text-brand-neon" />
            Daily Actives (DAU)
          </span>
          <p className="text-2xl font-black text-white font-mono">{sessionSummary.dau.toLocaleString()}</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Users className="w-3 h-3 text-purple-400" />
            Weekly Actives (WAU)
          </span>
          <p className="text-2xl font-black text-purple-300 font-mono">
            {sessionSummary.wau.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-1">
          <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
            <Users className="w-3 h-3 text-amber-400" />
            Monthly Actives (MAU)
          </span>
          <p className="text-2xl font-black text-amber-300 font-mono">
            {sessionSummary.mau.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Traffic Segments (Authenticated vs Anonymous & Devices) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutPieChart
          title="User Authentication Ratio"
          subtitle="Identified registered profiles vs anonymous guest listeners"
          segments={authSplit}
          centerLabel="Total Users"
          centerValue={totalUsers.toLocaleString()}
        />

        <DonutPieChart
          title="Client Device & Audio Stack Breakdown"
          subtitle="Platforms streaming breakbeats and interacting with the vault"
          segments={deviceSplit}
          centerLabel="Top Device"
          centerValue={
            totalDeviceEvents > 0
              ? desktopCount >= mobileCount && desktopCount >= tabletCount
                ? 'Desktop'
                : mobileCount >= tabletCount
                ? 'Mobile'
                : 'Tablet'
              : '0 Sessions'
          }
        />
      </div>

      {/* Geographic Distribution Map & Regional Data */}
      <div>
        <GeoMapVisualizer distribution={geoDistribution} />
      </div>

      {/* User Journey Flows */}
      <div>
        <UserJourneyFlow paths={userJourneys} />
      </div>
    </div>
  );
};
