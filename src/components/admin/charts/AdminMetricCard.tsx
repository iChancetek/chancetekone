'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';
import { KPICardData } from '@/types/analytics';

interface AdminMetricCardProps {
  kpi: KPICardData;
  icon?: LucideIcon;
  isLive?: boolean;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({ kpi, icon: Icon, isLive = false }) => {
  const isUp = kpi.trend === 'up';
  const isDown = kpi.trend === 'down';

  // Category glow, borders, and ambient shadows
  const styleConfig = {
    users: {
      card: 'from-[#0b1329]/95 via-[#070d1e]/98 to-[#030610] border-blue-500/25 hover:border-blue-400/50 shadow-[0_8px_30px_rgba(37,99,235,0.12)]',
      iconBox: 'text-blue-400 bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.25)]',
      sparklineStroke: '#60a5fa',
      sparklineGradFrom: 'rgba(96,165,250,0.35)',
      sparklineGradTo: 'rgba(96,165,250,0.0)',
      accentDot: 'bg-blue-400',
      badge: 'Audience',
    },
    media: {
      card: 'from-[#1a0c2e]/95 via-[#110620]/98 to-[#090312] border-brand-purple/30 hover:border-brand-purple/60 shadow-[0_8px_30px_rgba(168,85,247,0.15)]',
      iconBox: 'text-brand-neon bg-brand-purple/15 border-brand-purple/35 shadow-[0_0_15px_rgba(199,125,255,0.3)]',
      sparklineStroke: '#c77dff',
      sparklineGradFrom: 'rgba(199,125,255,0.35)',
      sparklineGradTo: 'rgba(199,125,255,0.0)',
      accentDot: 'bg-brand-neon',
      badge: 'Streaming',
    },
    merch: {
      card: 'from-[#221504]/95 via-[#160d02]/98 to-[#0b0601] border-brand-gold/30 hover:border-brand-gold/60 shadow-[0_8px_30px_rgba(245,158,11,0.15)]',
      iconBox: 'text-brand-gold bg-brand-gold/15 border-brand-gold/35 shadow-[0_0_15px_rgba(245,195,68,0.3)]',
      sparklineStroke: '#f5c344',
      sparklineGradFrom: 'rgba(245,195,68,0.35)',
      sparklineGradTo: 'rgba(245,195,68,0.0)',
      accentDot: 'bg-brand-gold',
      badge: 'Commerce',
    },
    leaders: {
      card: 'from-[#052117]/95 via-[#03150e]/98 to-[#010906] border-emerald-500/25 hover:border-emerald-400/50 shadow-[0_8px_30px_rgba(16,185,129,0.12)]',
      iconBox: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      sparklineStroke: isDown ? '#f87171' : '#34d399',
      sparklineGradFrom: isDown ? 'rgba(248,113,113,0.35)' : 'rgba(52,211,153,0.35)',
      sparklineGradTo: 'rgba(52,211,153,0.0)',
      accentDot: 'bg-emerald-400',
      badge: 'Leaderboard',
    },
  }[kpi.category] || {
    card: 'from-[#12121e]/95 via-[#0c0c14]/98 to-[#06060a] border-white/10 hover:border-white/20',
    iconBox: 'text-neutral-300 bg-white/10 border-white/15',
    sparklineStroke: '#94a3b8',
    sparklineGradFrom: 'rgba(148,163,184,0.35)',
    sparklineGradTo: 'rgba(148,163,184,0.0)',
    accentDot: 'bg-neutral-400',
    badge: 'Platform',
  };

  // Unique gradient ID per card
  const gradId = `spark-grad-${kpi.id}`;

  // SVG Sparkline path calculation with shaded gradient area
  const renderSparkline = () => {
    if (!kpi.sparkline || kpi.sparkline.length < 2) return null;
    const min = Math.min(...kpi.sparkline);
    const max = Math.max(...kpi.sparkline) || 1;
    const range = max - min || 1;
    const width = 84;
    const height = 28;

    const points = kpi.sparkline
      .map((val, idx) => {
        const x = (idx / (kpi.sparkline.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${x},${y}`;
      })
      .join(' ');

    const firstX = 0;
    const lastX = width;
    const areaPoints = `${firstX},${height} ${points} ${lastX},${height}`;

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={styleConfig.sparklineGradFrom} />
            <stop offset="100%" stopColor={styleConfig.sparklineGradTo} />
          </linearGradient>
        </defs>
        <polygon fill={`url(#${gradId})`} points={areaPoints} />
        <polyline
          fill="none"
          stroke={styleConfig.sparklineStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
        />
      </svg>
    );
  };

  return (
    <div
      className={`relative group p-5 rounded-3xl bg-gradient-to-b ${styleConfig.card} border backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between overflow-hidden`}
    >
      {/* Subtle top light glow reflection */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Top Row: Icon, Title, Badge, Sparkline */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200 ${styleConfig.iconBox}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${styleConfig.accentDot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {styleConfig.badge}
              </span>
            </div>
            <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors truncate">
              {kpi.title}
            </h4>
          </div>
        </div>

        {renderSparkline()}
      </div>

      {/* Center Row: Big Value */}
      <div className="my-3.5">
        <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight truncate drop-shadow-md group-hover:text-brand-gold transition-colors">
          {kpi.value}
        </p>
      </div>

      {/* Bottom Row: Trend pill and comparison */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5 text-[11px]">
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold font-mono text-[10px] shadow-sm ${
            isUp
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : isDown
              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'bg-white/5 text-neutral-400 border border-white/10'
          }`}
        >
          {isUp && <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
          {isDown && <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />}
          {!isUp && !isDown && <Minus className="w-3 h-3 stroke-[2.5]" />}
          <span>
            {isUp ? '+' : isDown ? '-' : ''}
            {kpi.changePercent}%
          </span>
        </div>

        <span className="text-[10px] text-neutral-400 font-medium truncate max-w-[140px] text-right">
          {kpi.comparisonPeriod}
        </span>
      </div>

      {/* Live Active Pulsing Indicator if Live */}
      {isLive && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
    </div>
  );
};

