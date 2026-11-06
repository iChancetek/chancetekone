'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, X, Sparkles } from 'lucide-react';
import { usePWA } from '@/lib/pwa/PWAContext';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isStandalone, installPWA } = usePWA();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('breakbeats_pwa_dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('breakbeats_pwa_dismissed', 'true');
  };

  if (isStandalone || isDismissed || !isInstallable) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-24 left-4 md:left-80 z-30 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl glass-panel bg-[#120e24]/95 border border-brand-gold/40 shadow-[0_15px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl max-w-sm sm:max-w-md">
        <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0">
          <Image src="/logo.png" alt="8 Of Spades Works" fill sizes="40px" className="object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-brand-gold tracking-tight truncate">
            8 Of Spades Works
          </p>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold shrink-0" />
            <p className="text-xs font-bold text-white tracking-tight truncate">
              Install Break Beats App
            </p>
          </div>
          <p className="text-[10px] text-neutral-300 leading-tight truncate">
            Background audio, lock-screen controls & offline.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={installPWA}
            aria-label="Install Break Beats App"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,195,68,0.7),0_2px_8px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(245,195,68,0.95),0_4px_12px_rgba(0,0,0,0.6)] border border-amber-200/70 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 stroke-[3] text-[#08080c]" />
            <span>Install</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
