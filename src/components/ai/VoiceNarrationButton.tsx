'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Loader2, Play, Pause, Sparkles, Globe } from 'lucide-react';
import { useVoiceSynthesis } from '@/lib/ai/useVoiceSynthesis';

interface VoiceNarrationButtonProps {
  text: string;
  label?: string;
  voice?: 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
  language?: 'en' | 'es';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'icon' | 'badge' | 'dual';
  className?: string;
}

export const VoiceNarrationButton: React.FC<VoiceNarrationButtonProps> = ({
  text,
  label = 'Listen (Nova)',
  voice = 'nova',
  language: initialLanguage = 'en',
  size = 'sm',
  variant = 'pill',
  className = '',
}) => {
  const { speak, isPlaying, isLoading, currentText, currentLang } = useVoiceSynthesis();
  const [selectedLang, setSelectedLang] = useState<'en' | 'es'>(initialLanguage);

  const isThisPlaying = isPlaying && currentText === text && currentLang === selectedLang;
  const isThisLoading = isLoading && currentText === text && currentLang === selectedLang;

  const handleClick = (e: React.MouseEvent, lang: 'en' | 'es' = selectedLang) => {
    e.stopPropagation();
    setSelectedLang(lang);
    speak(text, { voice, language: lang });
  };

  if (variant === 'dual') {
    return (
      <div className={`inline-flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/80 border border-white/10 shadow-lg ${className}`}>
        <button
          onClick={(e) => handleClick(e, 'en')}
          disabled={isLoading && currentText === text}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isPlaying && currentText === text && currentLang === 'en'
              ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-md'
              : 'hover:bg-white/10 text-neutral-200'
          }`}
          title="Listen in English (Nova Calm Voice)"
        >
          {isLoading && currentText === text && selectedLang === 'en' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying && currentText === text && currentLang === 'en' ? (
            <div className="flex items-center gap-0.5">
              <span className="w-0.5 h-3 bg-black animate-pulse rounded-full" />
              <span className="w-0.5 h-4 bg-black animate-pulse delay-75 rounded-full" />
              <span className="w-0.5 h-2.5 bg-black animate-pulse delay-150 rounded-full" />
            </div>
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-brand-gold" />
          )}
          <span>Listen (EN)</span>
        </button>

        <button
          onClick={(e) => handleClick(e, 'es')}
          disabled={isLoading && currentText === text}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isPlaying && currentText === text && currentLang === 'es'
              ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-md'
              : 'hover:bg-white/10 text-neutral-200'
          }`}
          title="Escuchar en Español (Voz Nova Serena)"
        >
          {isLoading && currentText === text && selectedLang === 'es' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying && currentText === text && currentLang === 'es' ? (
            <div className="flex items-center gap-0.5">
              <span className="w-0.5 h-3 bg-black animate-pulse rounded-full" />
              <span className="w-0.5 h-4 bg-black animate-pulse delay-75 rounded-full" />
              <span className="w-0.5 h-2.5 bg-black animate-pulse delay-150 rounded-full" />
            </div>
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-brand-neon" />
          )}
          <span>Español (ES)</span>
        </button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => handleClick(e, selectedLang)}
        disabled={isThisLoading}
        title={isThisPlaying ? 'Pause Spoken Narration' : `Read Aloud in ${selectedLang === 'es' ? 'Spanish' : 'English'} (Nova Voice)`}
        className={`p-1.5 rounded-full transition-all flex items-center justify-center cursor-pointer ${
          isThisPlaying
            ? 'bg-brand-gold text-black shadow-lg scale-105 animate-pulse'
            : isThisLoading
            ? 'bg-brand-purple/40 text-brand-gold cursor-wait'
            : 'bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white'
        } ${className}`}
      >
        {isThisLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isThisPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        onClick={(e) => handleClick(e, selectedLang)}
        disabled={isThisLoading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
          isThisPlaying
            ? 'bg-brand-gold text-black shadow-md border border-brand-gold'
            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10'
        } ${className}`}
      >
        {isThisLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-brand-gold" />
        ) : isThisPlaying ? (
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-2.5 bg-black animate-pulse rounded-full" />
            <span className="w-1 h-3.5 bg-black animate-pulse delay-75 rounded-full" />
            <span className="w-1 h-2 bg-black animate-pulse delay-150 rounded-full" />
          </span>
        ) : (
          <Volume2 className="w-3 h-3 text-brand-gold" />
        )}
        <span>{isThisPlaying ? 'Speaking' : label}</span>
      </button>
    );
  }

  // Default 'pill' variant
  return (
    <button
      onClick={(e) => handleClick(e, selectedLang)}
      disabled={isThisLoading}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer ${
        isThisPlaying
          ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black scale-[1.02] shadow-lg'
          : isThisLoading
          ? 'bg-brand-purple/30 border border-brand-purple/50 text-brand-gold'
          : 'bg-brand-purple/30 hover:bg-brand-purple/50 text-white border border-brand-purple/40 hover:border-brand-gold/50'
      } ${className}`}
      title="Listen to spoken audio narration with Nova Calm Voice"
    >
      {isThisLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isThisPlaying ? (
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-3 bg-black animate-pulse rounded-full" />
          <span className="w-0.5 h-4 bg-black animate-pulse delay-75 rounded-full" />
          <span className="w-0.5 h-2.5 bg-black animate-pulse delay-150 rounded-full" />
        </div>
      ) : (
        <Volume2 className="w-3.5 h-3.5 text-brand-gold" />
      )}
      <span>{isThisPlaying ? 'Playing Audio' : label}</span>
    </button>
  );
};
