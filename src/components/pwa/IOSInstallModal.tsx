'use client';

import React from 'react';
import Image from 'next/image';
import { X, Share, PlusSquare, Sparkles, Smartphone, Check } from 'lucide-react';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-6 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0">
              <Image src="/logo.png" alt="ChanceTEK One" fill sizes="40px" className="object-cover" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-brand-gold tracking-tight">ChanceTEK One</p>
              <h3 className="text-base font-bold text-white tracking-tight">
                Install on iOS / iPadOS
              </h3>
              <p className="text-[11px] text-neutral-400">Add to Home Screen for fullscreen audio OS</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-xl bg-brand-purple/30 text-brand-neon flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Tap the Share button in Safari</span>
                <Share className="w-4 h-4 text-brand-gold" />
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Look for the share icon at the bottom of Safari on iPhone or top-right on iPad.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-xl bg-brand-purple/30 text-brand-neon flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Select &quot;Add to Home Screen&quot;</span>
                <PlusSquare className="w-4 h-4 text-brand-gold" />
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Scroll down the Safari share sheet and tap &quot;Add to Home Screen&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-xl bg-brand-purple/30 text-brand-neon flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Tap &quot;Add&quot; in the top-right</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Launch directly from your home screen for seamless background audio and full-screen experience.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="p-3 rounded-2xl bg-brand-purple/15 border border-brand-purple/30 flex items-center gap-2.5 text-xs text-neutral-300">
          <Sparkles className="w-4 h-4 text-brand-gold shrink-0" />
          <span>Includes lock-screen controls, offline caching, and faster load times.</span>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-full bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,195,68,0.6)] hover:shadow-[0_0_30px_rgba(245,195,68,0.9)] border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          Got It!
        </button>
      </div>
    </div>
  );
};
