'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  X,
  Sparkles,
  Search,
  Music,
  Radio,
  BookOpen,
  Video,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { VoiceRecorder } from '@/components/ai/VoiceRecorder';
import { useAI } from '@/lib/ai/AIContext';

interface GlobalVoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VOICE_IDEAS = [
  'Play 95 BPM boom bap with dirty drums',
  'Tell me the history of the Amen break',
  'Show me 4K DJ performance videos',
  'Find audiobooks about crate digging',
  'Recommend vinyl releases under 120 BPM',
];

export const GlobalVoiceSearchModal: React.FC<GlobalVoiceSearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { openAI } = useAI();
  const [transcript, setTranscript] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleVoiceTranscribed = (text: string) => {
    setTranscript(text);
    setIsProcessing(true);

    const lower = text.toLowerCase().trim();

    setTimeout(() => {
      setIsProcessing(false);
      onClose();

      // Smart Voice Intent Routing
      if (
        lower.startsWith('tell me') ||
        lower.startsWith('who') ||
        lower.startsWith('what is') ||
        lower.startsWith('explain') ||
        lower.includes('history of') ||
        lower.includes('how to')
      ) {
        // Route to Break Beats AI Assistant
        openAI(text);
      } else if (lower.includes('video') || lower.includes('documentary')) {
        router.push(`/videos?q=${encodeURIComponent(text)}`);
      } else if (lower.includes('audiobook') || lower.includes('book')) {
        router.push(`/audiobooks?q=${encodeURIComponent(text)}`);
      } else if (lower.includes('playlist') || lower.includes('crate')) {
        router.push(`/playlists?q=${encodeURIComponent(text)}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(text)}`);
      }
    }, 1200);
  };

  const handleQuickPromptClick = (prompt: string) => {
    handleVoiceTranscribed(prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-6 bg-gradient-to-b from-[#140e28]/98 via-[#0c0818]/98 to-[#06060c]/98 shadow-[0_25px_80px_rgba(0,0,0,0.9)] text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/30 border border-brand-purple/50 text-brand-gold text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-brand-neon animate-spin-slow" />
            Whisper Voice Search & Agent Controls
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Speak to Dig the Crates
          </h2>
          <p className="text-xs text-neutral-300 max-w-sm mx-auto">
            Say any tempo, artist name, crate vibe, or cultural question.
          </p>
        </div>

        {/* Central Voice Recording Centerpiece */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <div className="relative p-4 rounded-full bg-gradient-to-tr from-brand-purple/40 to-brand-gold/20 border border-brand-gold/40 shadow-[0_0_40px_rgba(245,195,68,0.25)]">
            <VoiceRecorder onTranscribed={handleVoiceTranscribed} />
          </div>

          <p className="text-xs font-semibold text-brand-gold animate-pulse">
            Tap microphone above and start speaking
          </p>
        </div>

        {/* Transcript Feedback */}
        {transcript && (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-1 animate-in fade-in">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Heard via Whisper:
            </p>
            <p className="text-sm font-semibold text-white italic">"{transcript}"</p>
            {isProcessing && (
              <div className="pt-2 flex items-center gap-2 text-xs text-brand-neon font-mono font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Routing intent to Break Beats AI & Crate Search...
              </div>
            )}
          </div>
        )}

        {/* Suggested Voice Commands */}
        <div className="space-y-2 text-left pt-2 border-t border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Suggested Voice Inquiries:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => handleQuickPromptClick(idea)}
                className="text-[11px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple/30 border border-white/5 hover:border-brand-purple/40 text-neutral-300 hover:text-white transition-all text-left flex items-center gap-1.5 group"
              >
                <Sparkles className="w-3 h-3 text-brand-gold group-hover:scale-110 transition-transform" />
                <span>{idea}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
