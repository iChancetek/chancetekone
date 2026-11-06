'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  WifiOff,
  RotateCcw,
  Music,
  ListMusic,
  Radio,
  Sparkles,
  ArrowRight,
  Disc,
  Layers,
} from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setIsChecking(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 sm:p-8 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 1. Radar Icon */}
      <div className="relative">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-brand-purple/30 via-red-500/20 to-brand-gold/20 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl">
          <WifiOff className="w-12 h-12 text-brand-gold animate-pulse" />
        </div>
        <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-red-500/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white border border-white/20">
          Offline Mode
        </div>
      </div>

      {/* 2. Heading & Description */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-xs font-semibold">
          <Disc className="w-3.5 h-3.5 text-brand-neon animate-spin-slow" />
          <span>Progressive Web App Offline Cache Active</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          You're Off the Grid
        </h1>

        <p className="text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
          No active internet connection detected. You can still access your precached crates, saved library, and offline breakbeat sessions.
        </p>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking Connection...' : 'Try Reconnecting'}</span>
        </button>

        <Link
          href="/library"
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs sm:text-sm transition-all"
        >
          <Layers className="w-4 h-4 text-brand-gold" />
          <span>My Offline Library</span>
        </Link>
      </div>

      {/* 4. Quick Offline Shortcuts */}
      <div className="w-full pt-6 border-t border-white/10">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
          Cached Sections
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          <Link
            href="/music"
            className="p-3.5 rounded-2xl glass-card border border-white/5 hover:border-brand-purple/40 group transition-all"
          >
            <Music className="w-5 h-5 text-brand-neon mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-white">Music Catalog</p>
            <p className="text-[10px] text-neutral-400">Cached track metadata</p>
          </Link>

          <Link
            href="/playlists"
            className="p-3.5 rounded-2xl glass-card border border-white/5 hover:border-brand-purple/40 group transition-all"
          >
            <ListMusic className="w-5 h-5 text-brand-gold mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-white">Breakbeat Crates</p>
            <p className="text-[10px] text-neutral-400">Your created playlists</p>
          </Link>

          <Link
            href="/library"
            className="p-3.5 rounded-2xl glass-card border border-white/5 hover:border-brand-purple/40 group transition-all col-span-2 sm:col-span-1"
          >
            <Radio className="w-5 h-5 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-bold text-white">Saved Gems</p>
            <p className="text-[10px] text-neutral-400">Local saved content</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
