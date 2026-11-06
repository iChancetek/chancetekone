'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';

export interface RankingItem {
  id: string;
  rank: number;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  value: number | string;
  displayValue?: string;
  trendPercent?: number;
  badge?: string;
  secondaryMetric?: string;
}

interface BarRankingChartProps {
  title: string;
  subtitle?: string;
  items: RankingItem[];
  maxCount?: number;
  icon?: LucideIcon;
  barColor?: string; // CSS color string or gradient
}

export const BarRankingChart: React.FC<BarRankingChartProps> = ({
  title,
  subtitle,
  items,
  maxCount = 5,
  icon: Icon,
  barColor = 'from-brand-purple to-brand-neon',
}) => {
  const displayItems = items.slice(0, maxCount);
  const maxVal = Math.max(
    ...displayItems.map((it) => (typeof it.value === 'number' ? it.value : parseFloat(it.value) || 1)),
    1
  );

  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-gold">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
          </div>
        </div>
        <span className="text-[11px] font-mono text-neutral-400">Top {displayItems.length}</span>
      </div>

      {/* List of Bars */}
      <div className="space-y-3.5">
        {displayItems.map((item, index) => {
          const numValue = typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0;
          const percentage = Math.min(100, Math.max(12, (numValue / maxVal) * 100));
          const isTop3 = index < 3;
          const rankColor =
            index === 0
              ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)] font-black'
              : index === 1
              ? 'bg-neutral-200 text-black shadow-[0_0_8px_rgba(229,231,235,0.5)] font-bold'
              : index === 2
              ? 'bg-amber-700 text-white shadow-[0_0_8px_rgba(180,83,9,0.4)] font-bold'
              : 'bg-white/10 text-neutral-300 font-medium';

          return (
            <div key={item.id} className="space-y-1.5 group">
              {/* Row Details */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Rank Badge */}
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] shrink-0 ${rankColor}`}
                  >
                    #{item.rank || index + 1}
                  </span>

                  {/* Optional Cover */}
                  {item.coverUrl && (
                    <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                      <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
                    </div>
                  )}

                  {/* Title & Subtitle */}
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate group-hover:text-brand-gold transition-colors">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-[10px] text-neutral-400 truncate">{item.subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Metric Value & Trend */}
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  {item.secondaryMetric && (
                    <span className="text-[10px] text-neutral-400 hidden sm:inline">
                      {item.secondaryMetric}
                    </span>
                  )}
                  <span className="font-bold text-white">
                    {item.displayValue || (typeof item.value === 'number' ? item.value.toLocaleString() : item.value)}
                  </span>
                  {item.trendPercent !== undefined && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        item.trendPercent > 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.trendPercent < 0
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-neutral-500/20 text-neutral-400'
                      }`}
                    >
                      {item.trendPercent > 0 ? (
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      ) : item.trendPercent < 0 ? (
                        <ArrowDownRight className="w-2.5 h-2.5" />
                      ) : (
                        <Minus className="w-2.5 h-2.5" />
                      )}
                      {Math.abs(item.trendPercent)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out shadow-sm`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
