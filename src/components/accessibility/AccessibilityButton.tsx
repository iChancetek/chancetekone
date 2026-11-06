'use client';

import React from 'react';
import { Type, Sparkles } from 'lucide-react';
import { useAccessibility } from '@/lib/accessibility/AccessibilityContext';

interface AccessibilityButtonProps {
  variant?: 'nav' | 'icon' | 'badge' | 'footer';
  className?: string;
}

export const AccessibilityButton: React.FC<AccessibilityButtonProps> = ({
  variant = 'nav',
  className = '',
}) => {
  const { openModal, fontScale, highContrast } = useAccessibility();

  if (variant === 'icon') {
    return (
      <button
        onClick={openModal}
        className={`p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-brand-gold border border-white/5 transition-all cursor-pointer ${className}`}
        title={`Text & Font Size (${fontScale}%)`}
        aria-label="Adjust font size and visibility"
      >
        <Type className="w-4 h-4" />
      </button>
    );
  }

  if (variant === 'footer') {
    return (
      <button
        onClick={openModal}
        className={`text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 cursor-pointer text-left ${className}`}
        title="Adjust text size and accessibility"
      >
        <Type className="w-3.5 h-3.5 text-brand-gold" />
        <span>Text Size & Visibility ({fontScale}%)</span>
      </button>
    );
  }

  // Default 'nav' variant
  return (
    <button
      onClick={openModal}
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 hover:border-brand-gold/40 text-neutral-200 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer ${
        fontScale !== 100 || highContrast ? 'border-brand-gold/60 text-brand-gold bg-brand-gold/10' : ''
      } ${className}`}
      title={`Adjust Text & Font Size for Enhanced Visibility (Current: ${fontScale}%)`}
      aria-label="Text size and visibility settings"
    >
      <Type className="w-3.5 h-3.5 text-brand-gold" />
      <span className="font-bold">Aa</span>
      <span className="hidden sm:inline text-[10px] font-mono opacity-80">{fontScale}%</span>
    </button>
  );
};
