'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Track } from '@/types/media';
import { SampleGenealogyCard } from '@/components/ai/SampleGenealogyCard';

interface SampleGenealogyModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SampleGenealogyModal: React.FC<SampleGenealogyModalProps> = ({
  track,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl glass-panel border border-brand-purple/50 bg-[#0c0918] shadow-[0_25px_80px_rgba(0,0,0,0.9)] no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Close Sample Genealogy"
        >
          <X className="w-5 h-5" />
        </button>

        <SampleGenealogyCard track={track} />
      </div>
    </div>
  );
};
