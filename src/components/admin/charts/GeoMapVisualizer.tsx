'use client';

import React from 'react';
import { GeoDistributionRecord } from '@/types/analytics';
import { Globe, DollarSign, Play, Users } from 'lucide-react';

interface GeoMapVisualizerProps {
  distribution: GeoDistributionRecord[];
  title?: string;
  subtitle?: string;
}

export const GeoMapVisualizer: React.FC<GeoMapVisualizerProps> = ({
  distribution,
  title = 'Geographic Analytics & Regional Distribution',
  subtitle = 'Aggregated country & region analytics derived from secure, anonymized IP telemetry',
}) => {
  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-mono text-neutral-400">
          Privacy Policy: Coarse Geographic Aggregation Only
        </span>
      </div>

      {/* Regional Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {distribution.map((geo, idx) => {
          return (
            <div
              key={geo.countryCode}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-200 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {geo.countryCode === 'US'
                      ? '🇺🇸'
                      : geo.countryCode === 'GB'
                      ? '🇬🇧'
                      : geo.countryCode === 'DE'
                      ? '🇩🇪'
                      : geo.countryCode === 'JP'
                      ? '🇯🇵'
                      : geo.countryCode === 'CA'
                      ? '🇨🇦'
                      : geo.countryCode === 'FR'
                      ? '🇫🇷'
                      : '🌍'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">{geo.country}</p>
                    <p className="text-[10px] text-neutral-400">{geo.region}</p>
                  </div>
                </div>

                <span className="text-xs font-black text-brand-gold font-mono">
                  {geo.percentage}% of Traffic
                </span>
              </div>

              {/* Progress meter */}
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-brand-gold rounded-full"
                  style={{ width: `${geo.percentage * 2}%` }}
                />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[11px] font-mono">
                <div className="flex items-center gap-1 text-neutral-300">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>{geo.users.toLocaleString()} users</span>
                </div>
                <div className="flex items-center gap-1 text-neutral-300">
                  <Play className="w-3 h-3 text-brand-neon" />
                  <span>{(geo.plays / 1000).toFixed(0)}k plays</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 justify-end">
                  <DollarSign className="w-3 h-3" />
                  <span>${(geo.revenue / 1000).toFixed(1)}k</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
