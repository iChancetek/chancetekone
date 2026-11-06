'use client';

import React, { useState, useRef } from 'react';
import { ChartDataPoint } from '@/types/analytics';

interface AreaLineChartProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

export const AreaLineChart: React.FC<AreaLineChartProps> = ({
  data,
  title,
  subtitle,
  primaryLabel = 'Media Streams',
  secondaryLabel = 'Commerce Activity',
  height = 280,
  valuePrefix = '',
  valueSuffix = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral-400 text-xs">
        No chart data available for selected period.
      </div>
    );
  }

  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;
  const chartWidth = 700;
  const chartHeight = height;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const allValues = data.flatMap((d) => [d.value, d.secondaryValue || 0]);
  const maxValue = Math.max(...allValues, 10);
  const minValue = 0;
  const yRange = maxValue - minValue || 1;

  const getX = (index: number) => paddingLeft + (index / (data.length - 1 || 1)) * innerWidth;
  const getY = (val: number) => paddingTop + innerHeight - ((val - minValue) / yRange) * innerHeight;

  // Build Primary Curve (SVG Bezier Path)
  const primaryPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  const secondaryPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.secondaryValue || 0) }));

  const generateSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const primaryLinePath = generateSmoothPath(primaryPoints);
  const secondaryLinePath = generateSmoothPath(secondaryPoints);

  const primaryAreaPath = `${primaryLinePath} L ${primaryPoints[primaryPoints.length - 1].x} ${
    paddingTop + innerHeight
  } L ${primaryPoints[0].x} ${paddingTop + innerHeight} Z`;

  const secondaryAreaPath = `${secondaryLinePath} L ${secondaryPoints[secondaryPoints.length - 1].x} ${
    paddingTop + innerHeight
  } L ${secondaryPoints[0].x} ${paddingTop + innerHeight} Z`;

  // Y-axis grid ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((ratio) => {
    const val = Math.round(minValue + ratio * yRange);
    const y = getY(val);
    return { val, y };
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const relativeX = Math.max(0, Math.min(innerWidth, mouseX - paddingLeft));
    const index = Math.round((relativeX / innerWidth) * (data.length - 1));
    setHoverIndex(index);
  };

  const hoveredData = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  return (
    <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          {title && <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#c77dff] shadow-[0_0_8px_#c77dff]" />
            <span className="text-neutral-300">{primaryLabel}</span>
          </div>
          {secondaryLabel && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#f5c344] shadow-[0_0_8px_#f5c344]" />
              <span className="text-neutral-300">{secondaryLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Chart Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Primary Gradient (Purple Neon) */}
            <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c77dff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#7b2cbf" stopOpacity="0.0" />
            </linearGradient>

            {/* Secondary Gradient (Gold) */}
            <linearGradient id="secondaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5c344" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff9f1c" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={chartWidth - paddingRight}
                y2={tick.y}
                stroke="rgba(255, 255, 255, 0.07)"
                strokeDasharray={i === 0 ? undefined : '4 4'}
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[10px] fill-neutral-400 font-mono"
              >
                {tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : tick.val}
              </text>
            </g>
          ))}

          {/* Secondary Area & Line */}
          {secondaryLabel && (
            <>
              <path d={secondaryAreaPath} fill="url(#secondaryAreaGrad)" />
              <path
                d={secondaryLinePath}
                fill="none"
                stroke="#f5c344"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(245,195,68,0.6)]"
              />
            </>
          )}

          {/* Primary Area & Line */}
          <path d={primaryAreaPath} fill="url(#primaryAreaGrad)" />
          <path
            d={primaryLinePath}
            fill="none"
            stroke="#c77dff"
            strokeWidth="3"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_rgba(199,125,255,0.7)]"
          />

          {/* X Axis Labels (sample evenly) */}
          {data.map((d, i) => {
            const step = Math.ceil(data.length / 6);
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={getX(i)}
                y={chartHeight - 10}
                textAnchor="middle"
                className="text-[10px] fill-neutral-400 font-medium"
              >
                {d.label}
              </text>
            );
          })}

          {/* Hover Crosshair and Markers */}
          {hoverIndex !== null && hoveredData && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + innerHeight}
                stroke="#ffffff"
                strokeOpacity="0.4"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Primary point indicator */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(hoveredData.value)}
                r="6"
                fill="#c77dff"
                stroke="#ffffff"
                strokeWidth="2"
                className="drop-shadow-[0_0_8px_#c77dff]"
              />

              {/* Secondary point indicator */}
              {secondaryLabel && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(hoveredData.secondaryValue || 0)}
                  r="5"
                  fill="#f5c344"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="drop-shadow-[0_0_8px_#f5c344]"
                />
              )}
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredData && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-4 z-20 p-3 rounded-2xl bg-[#141024]/95 border border-brand-purple/40 shadow-2xl backdrop-blur-xl transition-all duration-75 min-w-[160px]"
            style={{
              left: `${Math.min(80, Math.max(15, (getX(hoverIndex) / chartWidth) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-[11px] font-bold text-neutral-300 border-b border-white/10 pb-1 mb-1.5">
              {hoveredData.label}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-neutral-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#c77dff]" />
                  {primaryLabel}:
                </span>
                <span className="font-mono font-bold text-white">
                  {valuePrefix}
                  {hoveredData.value.toLocaleString()}
                  {valueSuffix}
                </span>
              </div>
              {secondaryLabel && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-neutral-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#f5c344]" />
                    {secondaryLabel}:
                  </span>
                  <span className="font-mono font-bold text-brand-gold">
                    {valuePrefix}
                    {(hoveredData.secondaryValue || 0).toLocaleString()}
                    {valueSuffix}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
