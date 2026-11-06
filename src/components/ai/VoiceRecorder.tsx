'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscribed: (text: string) => void;
  language?: 'en' | 'es';
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscribed, language, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        await handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Microphone access error:', err);
      alert('Microphone access was not granted. Please check browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      if (language) {
        formData.append('language', language);
      }

      const res = await fetch('/api/ai/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.text) {
        onTranscribed(data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isTranscribing}
      className={`p-2 rounded-full transition-all flex items-center justify-center cursor-pointer ${
        isRecording
          ? 'bg-red-500 text-white animate-pulse shadow-lg scale-110'
          : isTranscribing
          ? 'bg-brand-purple/40 text-brand-gold cursor-wait'
          : 'bg-white/10 hover:bg-brand-purple/40 text-brand-gold hover:text-white'
      }`}
      title={isRecording ? 'Stop Recording' : `Speak in ${language === 'es' ? 'Spanish' : 'English'} (Whisper)`}
    >
      {isTranscribing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isRecording ? (
        <Square className="w-4 h-4 fill-current" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
};
