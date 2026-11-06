'use client';

import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
}

interface DonutPieChartProps {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export const DonutPieChart: React.FC<DonutPieChartProps> = ({
  title,
  subtitle,
  segments,
  centerLabel = 'Total',
  centerValue,
  size = 200,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  const radius = 70;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;
  const calculatedSegments = segments.map((seg) => {
    const percentage = seg.value / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentAngle;
    currentAngle += percentage * circumference;
    return {
      ...seg,
      percentage: Math.round(percentage * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div className="border-b border-white/5 pb-3">
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* SVG Donut & Center */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox="0 0 200 200" className="rotate-[-90deg] overflow-visible">
            {/* Background Track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />

            {/* Segments */}
            {calculatedSegments.map((seg, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <circle
                  key={idx}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 10px ${seg.color})` : undefined,
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              {hoveredIdx !== null ? calculatedSegments[hoveredIdx].label : centerLabel}
            </span>
            <span className="text-xl font-black text-white font-mono tracking-tight">
              {hoveredIdx !== null
                ? calculatedSegments[hoveredIdx].formattedValue ||
                  calculatedSegments[hoveredIdx].value.toLocaleString()
                : centerValue || total.toLocaleString()}
            </span>
            {hoveredIdx !== null && (
              <span className="text-[10px] font-bold text-brand-gold font-mono">
                {calculatedSegments[hoveredIdx].percentage}%
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 w-full max-w-[220px]">
          {calculatedSegments.map((seg, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between gap-2 p-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                hoveredIdx === idx ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-medium text-neutral-300 truncate">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <span className="text-white font-semibold">
                  {seg.formattedValue || seg.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-400">({seg.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
