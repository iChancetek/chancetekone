'use client';

import React, { useEffect, useRef } from 'react';
import { TrackAudioAnalysis } from '@/types/djchancemix';

interface WaveformCanvasProps {
  analysis: TrackAudioAnalysis | null;
  currentTime: number;
  duration: number;
  accentColor: string;
  secondaryColor: string;
  mixOutSec?: number | null;
  cueInSec?: number | null;
  transitionDurationSec?: number;
  isActiveDeck?: boolean;
  onSeek?: (seconds: number) => void;
}

const SECTION_FILL: Record<string, string> = {
  intro: 'rgba(56, 189, 248, 0.09)',
  verse: 'rgba(168, 85, 247, 0.06)',
  chorus: 'rgba(245, 195, 68, 0.10)',
  breakdown: 'rgba(124, 58, 237, 0.12)',
  bridge: 'rgba(236, 72, 153, 0.08)',
  outro: 'rgba(251, 146, 60, 0.11)',
};

/**
 * Interactive HiDPI Canvas Waveform with Beat Grid, Downbeat Bars,
 * Musical Sections, and Cue-In / Mix-Out Transition Markers.
 * Redraws strictly on state updates — zero idle animation frames for cool mobile battery life.
 */
export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  analysis,
  currentTime,
  duration,
  accentColor,
  secondaryColor,
  mixOutSec,
  cueInSec,
  transitionDurationSec = 0,
  isActiveDeck = false,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 76;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const safeDur = Math.max(1, duration || analysis?.duration || 1);
    const progress = Math.max(0, Math.min(1, currentTime / safeDur));

    // 1. Structural section backdrop shading
    if (analysis?.sections && analysis.sections.length > 0) {
      for (const sec of analysis.sections) {
        const x0 = (sec.startSec / safeDur) * width;
        const x1 = (sec.endSec / safeDur) * width;
        ctx.fillStyle = SECTION_FILL[sec.type] || 'rgba(255,255,255,0.03)';
        ctx.fillRect(x0, 0, Math.max(1, x1 - x0), height);
      }
    }

    // 2. Highlight Mix-Out / Cue-In transition pocket
    if (typeof mixOutSec === 'number' && transitionDurationSec > 0) {
      const mx0 = Math.max(0, (mixOutSec / safeDur) * width);
      const mx1 = Math.min(width, ((mixOutSec + transitionDurationSec) / safeDur) * width);
      ctx.fillStyle = 'rgba(245, 195, 68, 0.16)';
      ctx.fillRect(mx0, 0, Math.max(2, mx1 - mx0), height);
    }
    if (typeof cueInSec === 'number' && transitionDurationSec > 0) {
      const cx0 = Math.max(0, (cueInSec / safeDur) * width);
      const cx1 = Math.min(width, ((cueInSec + transitionDurationSec) / safeDur) * width);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
      ctx.fillRect(cx0, 0, Math.max(2, cx1 - cx0), height);
    }

    // 3. Beat Grid Downbeats (subtle vertical grid lines)
    if (analysis?.downbeats && analysis.downbeats.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 1;
      const step = Math.max(1, Math.floor(analysis.downbeats.length / 40));
      for (let i = 0; i < analysis.downbeats.length; i += step) {
        const x = (analysis.downbeats[i] / safeDur) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // 4. Center zero-axis
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // 5. Waveform Peak Bars
    const peaks =
      analysis?.waveformPeaks && analysis.waveformPeaks.length > 0
        ? analysis.waveformPeaks
        : Array.from({ length: 120 }, (_, i) => 0.18 + Math.abs(Math.sin(i * 0.35)) * 0.25);

    const barCount = peaks.length;
    const barGap = 1;
    const barWidth = Math.max(1.2, width / barCount - barGap);
    const playheadX = progress * width;

    for (let i = 0; i < barCount; i++) {
      const x = (i / barCount) * width;
      const amp = Math.max(0.06, Math.min(1, peaks[i]));
      const barH = amp * (height * 0.82);
      const isPlayed = x <= playheadX;

      ctx.fillStyle = isPlayed
        ? accentColor
        : isActiveDeck
        ? secondaryColor
        : 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(x, midY - barH / 2, barWidth, barH);
    }

    // 6. Cue-In Pin (Emerald) & Mix-Out Pin (Gold)
    if (typeof cueInSec === 'number' && cueInSec >= 0) {
      const cx = (cueInSec / safeDur) * width;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }
    if (typeof mixOutSec === 'number' && mixOutSec > 0 && mixOutSec < safeDur) {
      const mx = (mixOutSec / safeDur) * width;
      ctx.strokeStyle = '#f5c344';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, height);
      ctx.stroke();
    }

    // 7. Playhead Needle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.restore();
  }, [
    analysis,
    currentTime,
    duration,
    accentColor,
    secondaryColor,
    mixOutSec,
    cueInSec,
    transitionDurationSec,
    isActiveDeck,
  ]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const safeDur = duration || analysis?.duration || 0;
    if (safeDur > 0) {
      onSeek(ratio * safeDur);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`w-full h-[74px] sm:h-[84px] rounded-xl bg-black/55 border border-white/10 block ${
        onSeek ? 'cursor-pointer' : ''
      }`}
      aria-label="Audio waveform and beat grid"
    />
  );
};

