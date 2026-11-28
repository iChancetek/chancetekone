'use client';

import React from 'react';
import {
  SlidersHorizontal,
  Volume2,
  Gauge,
  Waves,
  Sparkles,
  ShieldCheck,
  MicOff,
  RotateCcw,
} from 'lucide-react';
import {
  CrossfadeCurve,
  DEFAULT_MIX_CONFIGURATION,
  MixConfiguration,
  SilenceSensitivity,
} from '@/types/djchancemix';

interface MixSettingsPanelProps {
  config: MixConfiguration;
  onChange: (partial: Partial<MixConfiguration>) => void;
  onReset: () => void;
}

const DURATION_PRESETS = [2, 4, 6, 8, 10, 12, 15];
const CURVE_OPTIONS: Array<{ id: CrossfadeCurve; label: string; desc: string }> = [
  { id: 'equal-power', label: 'Equal-Power', desc: 'Constant energy cos/sin DJ blend' },
  { id: 'adaptive', label: 'Adaptive S-Curve', desc: 'Smooth musical phrasing ramp' },
  { id: 'volume-aware', label: 'Volume-Aware', desc: 'Compensates loudness delta' },
  { id: 'linear', label: 'Linear', desc: 'Direct linear gain crossfade' },
];
const SILENCE_LEVELS: SilenceSensitivity[] = ['low', 'medium', 'high'];

export const MixSettingsPanel: React.FC<MixSettingsPanelProps> = ({
  config,
  onChange,
  onReset,
}) => {
  return (
    <section className="rounded-3xl p-5 sm:p-6 bg-[#0b0b16]/95 border border-brand-purple/30 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-brand-purple/25 border border-brand-purple/50 flex items-center justify-center text-brand-gold">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">DJ Audio Engineering & Mix Settings</h3>
            <p className="text-xs text-neutral-400">
              All adjustments apply live without interrupting playback and save to your profile.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Crossfade Duration & Curve */}
        <div className="space-y-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
              <Waves className="w-4 h-4" />
              <span>Crossfade Duration & Curve</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-200 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoTransitionDuration}
                onChange={(e) => onChange({ autoTransitionDuration: e.target.checked })}
                className="accent-brand-gold w-4 h-4 cursor-pointer"
              />
              <span>Auto Duration</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChange({ crossfadeDurationSec: sec, autoTransitionDuration: false })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  !config.autoTransitionDuration && config.crossfadeDurationSec === sec
                    ? 'bg-brand-gold text-black border-brand-gold'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Custom Transition Duration</span>
              <span className="font-mono font-bold text-white">
                {config.autoTransitionDuration ? 'AI Adaptive (Bar-Matched)' : `${config.crossfadeDurationSec}s`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={config.crossfadeDurationSec}
              onChange={(e) =>
                onChange({
                  crossfadeDurationSec: parseFloat(e.target.value),
                  autoTransitionDuration: false,
                })
              }
              className="w-full accent-brand-gold cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {CURVE_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ crossfadeCurve: c.id })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  config.crossfadeCurve === c.id
                    ? 'bg-brand-purple/25 border-brand-gold text-white'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                <p className="text-xs font-bold">{c.label}</p>
                <p className="text-[10px] text-neutral-400 leading-tight mt-0.5">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Beat Matching & Tempo Limits */}
        <div className="space-y-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Gauge className="w-4 h-4" />
            <span>Tempo Sync & Time Stretching</span>
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">Max Tempo Adjustment Limit</span>
              <span className="font-mono font-bold text-cyan-300">±{config.maxTempoAdjustmentPercent}%</span>
            </div>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={config.maxTempoAdjustmentPercent}
              onChange={(e) => onChange({ maxTempoAdjustmentPercent: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-neutral-400">
              Default ±{DEFAULT_MIX_CONFIGURATION.maxTempoAdjustmentPercent}% prevents unnatural playback speedups. Larger gaps fall back automatically.
            </p>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-white">Allow Pitch Shift (Vinyl Mode)</p>
                <p className="text-[11px] text-neutral-400">
                  Off by default — keeps vocal & instrument pitch locked while matching BPM.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.allowPitchShift}
                onChange={(e) => onChange({ allowPitchShift: e.target.checked })}
                className="accent-brand-gold w-4 h-4 mt-0.5 cursor-pointer"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Harmonic Camelot Mixing</span>
                </p>
                <p className="text-[11px] text-neutral-400">
                  Prioritizes compatible musical keys and shortens blends during key clashes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.harmonicMixingEnabled}
                onChange={(e) => onChange({ harmonicMixingEnabled: e.target.checked })}
                className="accent-brand-gold w-4 h-4 mt-0.5 cursor-pointer"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MicOff className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vocal Overlap Protection</span>
                </p>
                <p className="text-[11px] text-neutral-400">
                  Detects vocal presence in outros & intros to avoid overlapping lead vocals.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.vocalProtectionEnabled}
                onChange={(e) => onChange({ vocalProtectionEnabled: e.target.checked })}
                className="accent-brand-gold w-4 h-4 mt-0.5 cursor-pointer"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-white">Low-End Bass EQ Swap</p>
                <p className="text-[11px] text-neutral-400">
                  Smoothly ducks outgoing 140Hz sub-bass during beat-matched transitions.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.eqBassSwapEnabled}
                onChange={(e) => onChange({ eqBassSwapEnabled: e.target.checked })}
                className="accent-brand-gold w-4 h-4 mt-0.5 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 3. Loudness Normalization & True-Peak Limiting */}
        <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" />
              <span>Loudness Normalization & Limiter</span>
            </label>
            <input
              type="checkbox"
              checked={config.normalizationEnabled}
              onChange={(e) => onChange({ normalizationEnabled: e.target.checked })}
              className="accent-emerald-400 w-4 h-4 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Balances integrated loudness to <span className="text-white font-mono">{config.targetLufs} LUFS</span> using BS.1770 analysis with a brickwall <span className="text-white font-mono">-1.0 dBTP</span> limiter to prevent clipping while preserving original master files.
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Target Integrated Loudness</span>
              <span className="font-mono font-bold text-emerald-300">{config.targetLufs} LUFS</span>
            </div>
            <input
              type="range"
              min={-18}
              max={-10}
              step={1}
              value={config.targetLufs}
              disabled={!config.normalizationEnabled}
              onChange={(e) => onChange({ targetLufs: parseInt(e.target.value, 10) })}
              className="w-full accent-emerald-400 cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>

        {/* 4. Ambient-Safe Silence Detection */}
        <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Silence Detection & Gap Removal</span>
            </label>
            <input
              type="checkbox"
              checked={config.removeSilenceGaps}
              onChange={(e) => onChange({ removeSilenceGaps: e.target.checked })}
              className="accent-brand-gold w-4 h-4 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Trims dead leading/trailing silence while preserving quiet musical passages, ambient intros, and artistic reverb tails.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SILENCE_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                disabled={!config.removeSilenceGaps}
                onClick={() => onChange({ silenceSensitivity: lvl })}
                className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-40 ${
                  config.silenceSensitivity === lvl
                    ? 'bg-amber-500/20 border-brand-gold text-brand-gold'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

