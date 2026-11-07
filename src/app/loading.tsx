import React from 'react';

export default function RootLoading() {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 py-16 animate-in fade-in duration-150">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-brand-purple/30" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold animate-spin" />
        <div className="w-3 h-3 rounded-full bg-brand-gold animate-pulse" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Loading ChanceTEK One...
      </p>
    </div>
  );
}

