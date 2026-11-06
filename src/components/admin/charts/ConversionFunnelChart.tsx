'use client';

import React from 'react';
import { FunnelStage } from '@/types/analytics';
import { ArrowDown, ShoppingBag, CheckCircle, Percent } from 'lucide-react';

interface ConversionFunnelChartProps {
  stages: FunnelStage[];
  title?: string;
  subtitle?: string;
}

export const ConversionFunnelChart: React.FC<ConversionFunnelChartProps> = ({
  stages,
  title = 'Merchandise Customer Journey Funnel',
  subtitle = 'Tracks user conversion from initial catalog impression to completed vinyl & merch order',
}) => {
  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-brand-gold" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold font-mono flex items-center gap-1">
          <Percent className="w-3 h-3" />
          Overall Conv: {stages[stages.length - 1]?.percentage || 0}%
        </span>
      </div>

      {/* Funnel Visual Steps */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === stages.length - 1;
          const widthPct = Math.max(22, stage.percentage);

          return (
            <div key={idx} className="space-y-1.5 group">
              {/* Stage Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{stage.stage}</span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span className="text-sm font-black text-white">{stage.count.toLocaleString()}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 text-brand-gold font-bold">
                    {stage.percentage}% of Top
                  </span>
                  {!isFirst && (
                    <span className="text-[10px] text-red-400 hidden sm:inline">
                      -{stage.dropoffPercentage}% Drop
                    </span>
                  )}
                </div>
              </div>

              {/* Funnel Trapezoid/Bar */}
              <div className="relative h-9 rounded-xl bg-white/5 border border-white/5 overflow-hidden flex items-center px-3">
                <div
                  className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ease-out shadow-lg opacity-85 group-hover:opacity-100"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, ${stage.color}cc, ${stage.color})`,
                  }}
                />

                <div className="relative z-10 flex items-center justify-between w-full text-xs font-semibold drop-shadow-md">
                  <span className="text-white drop-shadow">{stage.stage}</span>
                  {isLast && (
                    <span className="flex items-center gap-1 text-[11px] font-black text-white bg-black/40 px-2 py-0.5 rounded-lg">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Paid Orders
                    </span>
                  )}
                </div>
              </div>

              {/* Connecting Arrow between stages */}
              {!isLast && (
                <div className="flex justify-center -my-1 opacity-40">
                  <ArrowDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
