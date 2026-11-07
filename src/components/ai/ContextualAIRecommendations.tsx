'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles,
  Music,
  Video as VideoIcon,
  BookOpen,
  Play,
  Plus,
  Brain,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Track, Video, Audiobook } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAI } from '@/lib/ai/AIContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { MemoryManager } from '@/lib/agents/memory';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

interface ContextualAIRecommendationsProps {
  currentMedia?: {
    id: string;
    type: 'track' | 'video' | 'audiobook';
    title: string;
    artist?: string;
    author?: string;
    genre?: string;
    bpm?: number;
    category?: string;
  };
  compact?: boolean;
  className?: string;
  /** When true, auto-fetches once on mount. Use only on dedicated detail pages, not in players. */
  autoFetch?: boolean;
}

export const ContextualAIRecommendations: React.FC<ContextualAIRecommendationsProps> = ({
  currentMedia,
  compact = false,
  className = '',
  autoFetch = false,
}) => {
  const { playTrack, openVideoModal, addToQueue } = usePlayer();
  const { openAI } = useAI();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    agentName: string;
    agentRationale: string;
    vibeTag: string;
    bpmShift: string;
    recommendedTracks: Track[];
    recommendedVideos: Video[];
    recommendedAudiobooks: Audiobook[];
  } | null>(null);

  const fetchRecommendations = async () => {
    if (!currentMedia) return;
    setLoading(true);

    try {
      const memory = MemoryManager.getLongTermMemory(profile?.id || 'default-user', profile?.name);
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentMedia,
          userContext: {
            name: profile?.name || 'ChanceTEKone',
            explicitFacts: memory.explicitFacts,
            tasteProfile: memory.tasteProfile,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Failed to fetch contextual recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Only auto-fetch on dedicated detail pages (autoFetch=true).
  // In players, data loads only when the user clicks the recommendations button.
  useEffect(() => {
    if (autoFetch && currentMedia?.id) {
      fetchRecommendations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMedia?.id, autoFetch]);

  if (!currentMedia) return null;

  return (
    <div
      className={`glass-panel rounded-3xl border border-brand-purple/40 bg-gradient-to-b from-[#141028]/95 to-[#080810]/95 p-4 sm:p-6 shadow-2xl space-y-4 ${className}`}
    >
      {/* Agent Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-purple to-brand-gold flex items-center justify-center border border-brand-gold/40 shadow-md">
            <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {data?.agentName || 'Crate Digger Agent'}
              </h3>
            </div>
            <p className="text-[10px] text-neutral-400">
              Live harmonic recommendations matching{' '}
              <span className="text-white font-semibold">{currentMedia.title}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.vibeTag && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-purple/30 text-brand-neon border border-brand-purple/50 font-bold">
              {data.vibeTag}
            </span>
          )}

          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Refresh AI Recommendations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-gold' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cultural Rationale + Open TTS Voice Narration */}
      {data?.agentRationale && (
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1">
              <Brain className="w-3 h-3 text-brand-neon" />
              Curation Rationale
            </span>
            <VoiceNarrationButton
              text={data.agentRationale}
              label="Listen"
              variant="badge"
              voice="alloy"
            />
          </div>
          <p className="text-xs text-neutral-200 leading-relaxed italic">
            "{data.agentRationale}"
          </p>
        </div>
      )}

      {/* Cross-Media Recommendations Grid */}
      <div className="space-y-4">
        {/* 1. Recommended Harmonic Tracks */}
        {data?.recommendedTracks && data.recommendedTracks.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-brand-gold" />
              Harmonic Tracks in the Pocket
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.recommendedTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-purple/40 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                      <Image src={track.coverUrl} alt={track.title} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {track.artistName} •{' '}
                        <span className="text-brand-gold font-mono font-bold">{track.bpm} BPM</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => addToQueue(track)}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-colors"
                      title="Add to Next in Pocket Queue"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => playTrack(track)}
                      className="p-2 rounded-full bg-brand-gold text-black hover:scale-105 transition-transform shadow-md"
                      title="Play Track Now"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Related 4K Videos & Audiobooks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Video */}
          {data?.recommendedVideos && data.recommendedVideos.length > 0 && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <VideoIcon className="w-3 h-3" />
                Related Studio & Documentary
              </p>
              {data.recommendedVideos.slice(0, 1).map((vid) => (
                <div
                  key={vid.id}
                  onClick={() => openVideoModal(vid)}
                  className="flex items-center gap-2.5 cursor-pointer group hover:bg-white/5 p-1 rounded-xl transition-all"
                >
                  <div className="relative w-14 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={vid.thumbnailUrl} alt={vid.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white fill-current" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-brand-gold transition-colors">
                      {vid.title}
                    </p>
                    <p className="text-[10px] text-neutral-400">{vid.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Audiobook */}
          {data?.recommendedAudiobooks && data.recommendedAudiobooks.length > 0 && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-neon flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Culture Audiobook Chapter
              </p>
              {data.recommendedAudiobooks.slice(0, 1).map((book) => (
                <Link
                  key={book.id}
                  href={`/audiobooks/${book.id}`}
                  className="flex items-center gap-2.5 group hover:bg-white/5 p-1 rounded-xl transition-all"
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={book.coverUrl} alt={book.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-brand-gold transition-colors">
                      {book.title}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">By {book.author}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ask Agent Follow-up Button */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={() =>
            openAI(
              `Dig deeper into music and culture matching ${currentMedia.title} (${currentMedia.bpm || '120'} BPM). Recommend rare breakbeats and explain the sample history.`
            )
          }
          className="text-xs text-brand-gold hover:text-white font-semibold flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          <span>Ask Break Beats AI for Rare Cuts</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
