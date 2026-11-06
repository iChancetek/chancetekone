'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePlayer } from '@/lib/player/PlayerContext';


interface VoiceSynthesisOptions {
  voice?: 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
  language?: 'en' | 'es';
  onEnded?: () => void;
}

export const useVoiceSynthesis = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<'en' | 'es'>('en');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Read platform master volume so AI narration respects the global slider
  const { volume, isMuted } = usePlayer();

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentText(null);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Keep active narration audio in sync with platform volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const speak = useCallback(
    async (text: string, options?: VoiceSynthesisOptions) => {
      if (!text || text.trim() === '') return;
      const lang = options?.language || 'en';

      // If currently playing the exact same text and language, toggle pause/play
      if (isPlaying && currentText === text && currentLang === lang && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      cleanup();
      setIsLoading(true);
      setCurrentText(text);
      setCurrentLang(lang);

      try {
        const res = await fetch('/api/ai/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.slice(0, 2000),
            voice: options?.voice || 'nova', // Default to Nova calm voice
            language: lang,
          }),
        });

        if (!res.ok) {
          throw new Error(`TTS failed with status ${res.status}`);
        }

        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        // Apply platform master volume on creation
        audio.volume = isMuted ? 0 : volume;
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
        };

        audio.onpause = () => {
          setIsPlaying(false);
        };

        audio.onended = () => {
          cleanup();
          if (options?.onEnded) options.onEnded();
        };

        audio.onerror = (e) => {
          console.warn('Audio playback error:', e);
          cleanup();
        };

        await audio.play();
      } catch (err) {
        console.error('Voice synthesis error:', err);
        cleanup();
      }
    },
    [cleanup, isPlaying, currentText, currentLang]
  );

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    currentText,
    currentLang,
  };
};
