'use client';

import React, { useEffect } from 'react';
import {
  Type,
  X,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
  AlignLeft,
  ZoomIn,
  ZoomOut,
  Sliders,
  SunMedium,
} from 'lucide-react';
import {
  useAccessibility,
  FONT_SIZE_OPTIONS,
  FontSizePreset,
  LineSpacingPreset,
} from '@/lib/accessibility/AccessibilityContext';

export const AccessibilityControlsModal: React.FC = () => {
  const {
    fontScale,
    currentPreset,
    highContrast,
    lineSpacing,
    isModalOpen,
    setFontScale,
    setPreset,
    increaseFontSize,
    decreaseFontSize,
    toggleHighContrast,
    setLineSpacing,
    resetToDefault,
    closeModal,
  } = useAccessibility();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-3xl glass-panel border border-brand-gold/40 bg-[#0c0c16]/95 shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-brand-purple/25 via-neutral-950 to-brand-gold/15 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30 shadow-lg">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="accessibility-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Text & Font Visibility Settings
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] font-mono font-bold">
                  {fontScale}%
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Adjust typography scale, text spacing, and contrast for maximum reading comfort.
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Close Settings"
            aria-label="Close visibility settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Quick Preset Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-gold" />
                <span>Font Size Presets</span>
              </label>

              {/* Stepper Buttons (A- / A+) */}
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
                <button
                  onClick={decreaseFontSize}
                  disabled={fontScale <= 90}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-white/10 disabled:opacity-30 text-neutral-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  title="Decrease Font Size (A-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span>A-</span>
                </button>
                <span className="px-2 text-xs font-mono text-brand-gold font-bold">{fontScale}%</span>
                <button
                  onClick={increaseFontSize}
                  disabled={fontScale >= 145}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-white/10 disabled:opacity-30 text-neutral-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  title="Increase Font Size (A+)"
                >
                  <span>A+</span>
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {FONT_SIZE_OPTIONS.map((opt) => {
                const isSelected = fontScale === opt.scale;
                return (
                  <button
                    key={opt.preset}
                    onClick={() => setPreset(opt.preset)}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-brand-gold/20 to-brand-amber/15 border-brand-gold shadow-lg shadow-brand-gold/10 text-white scale-[1.02]'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                    }`}
                  >
                    <div className="w-full flex justify-end">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-brand-gold" />
                      ) : (
                        <div className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className="font-bold my-1 tracking-tight"
                      style={{ fontSize: `${Math.max(12, opt.scale * 0.14)}px` }}
                    >
                      Aa
                    </span>
                    <div className="space-y-0.5 mt-1">
                      <p className="text-xs font-bold truncate">{opt.label}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">{opt.sublabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: High-Contrast & Text Enhancement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* High Contrast Toggle */}
            <div className="glass-card p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4 bg-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <SunMedium className="w-4 h-4 text-brand-gold" />
                  <span>High Contrast Mode</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Boosts text brightness, sharpens borders, and deepens background contrast.
                </p>
              </div>

              <button
                onClick={toggleHighContrast}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  highContrast ? 'bg-brand-gold' : 'bg-neutral-800'
                }`}
                role="switch"
                aria-checked={highContrast}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    highContrast ? 'translate-x-5' : 'translate-x-0 bg-neutral-400'
                  }`}
                />
              </button>
            </div>

            {/* Line Spacing Selector */}
            <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-2 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <AlignLeft className="w-4 h-4 text-brand-neon" />
                  <span>Line Spacing</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-400 capitalize">{lineSpacing}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['normal', 'relaxed', 'loose'] as LineSpacingPreset[]).map((spacing) => (
                  <button
                    key={spacing}
                    onClick={() => setLineSpacing(spacing)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                      lineSpacing === spacing
                        ? 'bg-brand-purple text-white shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                    }`}
                  >
                    {spacing}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Live Interactive Sample Preview */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-gold" />
              <span>Live Preview</span>
            </label>

            <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black/50 space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Return of the Break Beats</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                ChanceTEK One: Return of the Break Beats
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                This is a live preview of how track lyrics, documentary essays, liner notes, and audiobook transcripts will render across the platform with your selected {fontScale}% font scale.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between gap-4 bg-[#0a0a10] shrink-0">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            title="Reset font size and contrast to default 100%"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <button
            onClick={closeModal}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
