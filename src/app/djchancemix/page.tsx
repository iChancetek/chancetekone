import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { DJChanceMixStudio } from '@/components/djchancemix/DJChanceMixStudio';
import { Disc3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DJChanceMix — Let the music flow.',
  description:
    'Intelligent AI-powered music mixing & beat-matched AutoMix studio on ChanceTEK One. Real-time BPM sync, Camelot harmonic mixing, dual-deck waveforms, and studio loudness normalization.',
};

export default function DJChanceMixPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Disc3 className="w-8 h-8 text-brand-gold animate-spin-slow" />
          <p className="text-xs font-mono uppercase tracking-widest">
            Initializing DJChanceMix Dual-Deck DSP Engine...
          </p>
        </div>
      }
    >
      <DJChanceMixStudio />
    </Suspense>
  );
}

