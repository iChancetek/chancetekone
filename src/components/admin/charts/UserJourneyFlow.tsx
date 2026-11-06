'use client';

import React from 'react';
import { UserJourneyPath } from '@/types/analytics';
import { Route, ChevronRight, Zap, Clock } from 'lucide-react';

interface UserJourneyFlowProps {
  paths: UserJourneyPath[];
  title?: string;
  subtitle?: string;
}

export const UserJourneyFlow: React.FC<UserJourneyFlowProps> = ({
  paths,
  title = 'Platform Navigation Paths & User Journey Flows',
  subtitle = 'Top navigational sequences from entry to conversion or deep crate listening',
}) => {
  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Route className="w-4 h-4 text-brand-gold" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Path List */}
      <div className="space-y-3">
        {paths.map((p, idx) => (
          <div
            key={p.id}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200 space-y-2.5 group"
          >
            {/* Top row: Path meta */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-brand-gold font-bold">Path #{idx + 1}</span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-neutral-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-brand-neon" />
                  {p.frequency.toLocaleString()} Sessions
                </span>
                <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {p.conversionRate}% Conversion
                </span>
                <span className="text-neutral-400 flex items-center gap-1 hidden sm:inline-flex">
                  <Clock className="w-3 h-3" />
                  Avg: {p.avgDuration}
                </span>
              </div>
            </div>

            {/* Path Nodes */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {p.path.map((node, nodeIdx) => {
                const isLast = nodeIdx === p.path.length - 1;
                return (
                  <React.Fragment key={nodeIdx}>
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-transform group-hover:scale-105 ${
                        isLast
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                          : nodeIdx === 0
                          ? 'bg-brand-purple/20 text-brand-neon border border-brand-purple/30'
                          : 'bg-white/5 text-neutral-300 border border-white/10'
                      }`}
                    >
                      {node}
                    </span>
                    {!isLast && <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
