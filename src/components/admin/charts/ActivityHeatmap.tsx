'use client';

import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface ActivityHeatmapProps {
  matrix: { day: string; hour: number; intensity: number }[];
  title?: string;
  subtitle?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  matrix,
  title = 'Platform Peak Listening & Activity Heatmap',
  subtitle = 'Interactive 7-day × 24-hour user engagement velocity matrix (UTC / local time)',
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; intensity: number } | null>(null);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getIntensityColor = (intensity: number) => {
    if (intensity < 15) return 'bg-white/5 border-transparent';
    if (intensity < 35) return 'bg-[#7b2cbf]/30 border-[#7b2cbf]/40 text-purple-200';
    if (intensity < 60) return 'bg-[#9d4edd]/60 border-[#9d4edd]/70 text-white';
    if (intensity < 80) return 'bg-[#c77dff] border-[#c77dff] text-black shadow-[0_0_8px_rgba(199,125,255,0.5)]';
    return 'bg-[#f5c344] border-[#f5c344] text-black shadow-[0_0_12px_rgba(245,195,68,0.8)] font-bold';
  };

  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-neon" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-2 text-[10px] text-neutral-400">
          <span>Low</span>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-white/5" />
            <span className="w-2.5 h-2.5 rounded bg-[#7b2cbf]/40" />
            <span className="w-2.5 h-2.5 rounded bg-[#9d4edd]/70" />
            <span className="w-2.5 h-2.5 rounded bg-[#c77dff]" />
            <span className="w-2.5 h-2.5 rounded bg-[#f5c344]" />
          </div>
          <span>Peak Surge</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto no-scrollbar pb-2">
        <div className="min-w-[650px] space-y-1.5">
          {/* Hour headers */}
          <div className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 text-[9px] text-neutral-400 font-mono text-center">
            <span className="text-left font-sans">Day</span>
            {hours.map((h) => (
              <span key={h} className={h % 4 === 0 ? 'text-white font-bold' : 'opacity-60'}>
                {h % 4 === 0 ? `${h}h` : ''}
              </span>
            ))}
          </div>

          {/* Day Rows */}
          {days.map((day) => {
            return (
              <div key={day} className="grid grid-cols-[48px_repeat(24,1fr)] gap-1 items-center">
                <span className="text-xs font-semibold text-neutral-300">{day}</span>
                {hours.map((hour) => {
                  const cell = matrix.find((m) => m.day === day && m.hour === hour) || {
                    day,
                    hour,
                    intensity: 10,
                  };
                  return (
                    <div
                      key={hour}
                      className={`h-6 rounded-md border transition-all duration-200 cursor-pointer ${getIntensityColor(
                        cell.intensity
                      )} hover:scale-125 hover:z-20`}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover Info Footer */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
        {hoveredCell ? (
          <p className="font-mono text-white">
            Surge on <span className="text-brand-gold font-bold">{hoveredCell.day}</span> at{' '}
            <span className="text-brand-neon font-bold">{hoveredCell.hour}:00</span> — Intensity Index:{' '}
            <span className="text-emerald-400 font-bold">{hoveredCell.intensity}/100</span>
          </p>
        ) : (
          <p className="italic text-neutral-500">Hover over any time slot to view exact streaming velocity</p>
        )}
        <span className="text-[11px] font-mono text-neutral-400">Timezone: UTC</span>
      </div>
    </div>
  );
};
