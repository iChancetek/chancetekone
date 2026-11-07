'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Disc3,
  Sliders,
  Cpu,
  Layers,
  Volume2,
  Brain,
  RefreshCw,
  ArrowRight,
  Music,
  CheckCircle2,
} from 'lucide-react';
import { Track } from '@/types/media';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { useAI } from '@/lib/ai/AIContext';

interface SampleGenealogyCardProps {
  track: Track;
  compact?: boolean;
  className?: string;
}

export const SampleGenealogyCard: React.FC<SampleGenealogyCardProps> = ({
  track,
  compact = false,
  className = '',
}) => {
  const { openAI } = useAI();
  const [loading, setLoading] = useState(false);
  const [genealogy, setGenealogy] = useState<{
    breakName: string;
    originalMaster: {
      title: string;
      artist: string;
      drummer: string;
      releaseYear: number;
      label: string;
      originalBpm: number;
      breakTimestamp: string;
    };
    samplerLore: {
      machineName: string;
      bitDepth: string;
      tuningTechnique: string;
      sonicSignature: string;
    };
    famousFlips: Array<{
      songTitle: string;
      artist: string;
      year: number;
      producer: string;
    }>;
    culturalStory: string;
    djMixingTip: string;
  } | null>(null);

  const fetchGenealogy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/sample-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackTitle: track.title,
          artistName: track.artistName,
          genre: track.genre,
          bpm: track.bpm,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGenealogy(data);
      }
    } catch (err) {
      console.warn('Failed to fetch sample breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  // No auto-fetch — user must click to trigger (cost control).

  return (
    <div
      className={`glass-panel rounded-3xl border border-brand-purple/40 bg-gradient-to-b from-[#160f2c]/95 via-[#0d0918]/95 to-[#080810]/95 p-5 sm:p-7 shadow-2xl space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-purple via-brand-violet to-brand-gold flex items-center justify-center border border-brand-gold/40 shadow-lg shrink-0">
            <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">Sample Detective & Break Genealogist</h3>
            </div>
            <p className="text-xs text-neutral-300">
              Drum Break DNA analysis for <span className="text-brand-gold font-bold">{track.title}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {genealogy?.breakName && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-brand-purple/30 text-brand-neon border border-brand-purple/50 font-bold uppercase tracking-wider">
              {genealogy.breakName}
            </span>
          )}
          <button
            onClick={fetchGenealogy}
            disabled={loading}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
            title="Re-analyze Drum Break Lineage"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-gold' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-gold animate-spin" />
          <p className="text-xs font-mono text-brand-neon">
            Digging through 1970s vinyl crates & vintage sampler matrices...
          </p>
        </div>
      ) : genealogy ? (
        <div className="space-y-5">
          {/* Section 1: Original Funk Master Recording */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-wider">
                <Disc3 className="w-4 h-4 text-brand-gold" />
                <span>Original 1970s Master Source</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-white">
                  "{genealogy.originalMaster.title}" by {genealogy.originalMaster.artist}
                </p>
                <p className="text-xs text-neutral-300 font-mono">
                  Drummer: <span className="text-brand-neon font-bold">{genealogy.originalMaster.drummer}</span>
                </p>
                <p className="text-[11px] text-neutral-400">
                  Released {genealogy.originalMaster.releaseYear} on {genealogy.originalMaster.label} • Break at {genealogy.originalMaster.breakTimestamp} ({genealogy.originalMaster.originalBpm} BPM)
                </p>
              </div>
            </div>

            {/* Section 2: Sampler Hardware Lore */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-brand-neon text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-brand-neon" />
                <span>Vintage Sampler & Chop Specs</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-white">{genealogy.samplerLore.machineName}</p>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-brand-neon/20 text-brand-neon font-mono font-bold">
                    {genealogy.samplerLore.bitDepth}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  {genealogy.samplerLore.tuningTechnique}
                </p>
                <p className="text-[10px] text-brand-gold font-mono">
                  Sound: {genealogy.samplerLore.sonicSignature}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Cultural Story & Spoken Narration */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-brand-neon" />
                <span>The Crate Lineage & Breakbeat Evolution</span>
              </span>
              <VoiceNarrationButton
                text={genealogy.culturalStory}
                label="Listen to Break Lore"
                variant="pill"
                voice="onyx"
              />
            </div>
            <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed whitespace-pre-line font-serif italic">
              {genealogy.culturalStory}
            </p>
          </div>

          {/* Section 4: Famous Flips Timeline */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-gold" />
              <span>Classic Songs That Flipped This Exact Same Break</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {genealogy.famousFlips.map((flip, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-purple/40 hover:bg-white/10 transition-all space-y-1"
                >
                  <p className="text-xs font-bold text-white truncate">"{flip.songTitle}"</p>
                  <p className="text-[11px] text-brand-neon truncate">{flip.artist} ({flip.year})</p>
                  <p className="text-[10px] text-neutral-400 truncate">Prod by {flip.producer}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: DJ EQ & Mixing Tip */}
          {genealogy.djMixingTip && (
            <div className="p-3.5 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-start gap-3">
              <Sliders className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-brand-gold uppercase tracking-wider">
                  Live DJ Set & Blending Advice
                </p>
                <p className="text-xs text-neutral-200 mt-0.5 leading-relaxed">
                  {genealogy.djMixingTip}
                </p>
              </div>
            </div>
          )}

          {/* Ask Agent Deeper Questions */}
          <div className="pt-2 flex items-center justify-between border-t border-white/5">
            <span className="text-[11px] text-neutral-400">
              Want to see more classic chops or SP-1200 drum tutorials?
            </span>
            <button
              onClick={() =>
                openAI(
                  `Tell me more about the drum break "${genealogy.breakName}" from "${genealogy.originalMaster.title}" by ${genealogy.originalMaster.artist}. How was it chopped in the SP-1200 and who else sampled it?`
                )
              }
              className="text-xs text-brand-gold hover:text-white font-bold flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              <span>Ask ChanceTEK One AI for Deep Crate History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
