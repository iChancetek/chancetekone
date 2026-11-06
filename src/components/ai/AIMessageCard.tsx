'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Play,
  Sparkles,
  User,
  ShoppingBag,
  BookOpen,
  Video as VideoIcon,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { AIMessage } from '@/types/agent';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useCart } from '@/lib/commerce/CartContext';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const AIMessageCard: React.FC<{ message: AIMessage }> = ({ message }) => {
  const isAssistant = message.role === 'assistant';
  const { playTrack } = usePlayer();
  const { addToCart } = useCart();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex gap-3 ${isAssistant ? 'items-start' : 'items-end flex-row-reverse'} group`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md ${
          isAssistant
            ? 'bg-gradient-to-tr from-brand-purple to-brand-gold text-white border border-brand-neon/40'
            : 'bg-white/20 text-white'
        }`}
      >
        {isAssistant ? <Sparkles className="w-3.5 h-3.5 text-brand-gold" /> : <User className="w-3.5 h-3.5" />}
      </div>

      {/* Message Box */}
      <div className={`max-w-[85%] space-y-2 select-text`}>
        <div
          className={`relative p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${
            isAssistant
              ? 'bg-white/5 border border-white/10 text-neutral-100 shadow-xl rounded-tl-sm'
              : 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-lg rounded-tr-sm'
          }`}
        >
          {/* Tool execution badge */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {message.toolCalls.map((tc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-purple/30 border border-brand-purple/50 text-[10px] font-mono text-brand-gold"
                >
                  <Sparkles className="w-2.5 h-2.5 text-brand-neon" />
                  Executed: {tc.toolName}()
                </span>
              ))}
            </div>
          )}

          <div className="whitespace-pre-wrap select-text selection:bg-brand-gold selection:text-black">
            {message.content}
          </div>

          {/* Action Buttons: Speak & Copy */}
          {message.content && (
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {isAssistant && (
                <VoiceNarrationButton
                  text={message.content}
                  variant="icon"
                  voice="alloy"
                />
              )}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-black/50 hover:bg-black/90 border border-white/10 text-neutral-400 hover:text-white transition-all shadow-md"
                title="Copy message to clipboard"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Media Recommendations (Interactive Cards) */}
        {message.mediaRecommendations && (
          <div className="space-y-2 pt-1">
            {/* Tracks */}
            {message.mediaRecommendations.tracks && message.mediaRecommendations.tracks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                  Suggested Tracks
                </p>
                {message.mediaRecommendations.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={track.coverUrl} alt={track.title} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{track.artistName}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => playTrack(track)}
                      className="p-2 rounded-full bg-brand-gold text-black hover:scale-105 transition-transform flex-shrink-0 shadow-md"
                      title="Play Track Now"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Merchandise */}
            {message.mediaRecommendations.products && message.mediaRecommendations.products.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-neon">
                  Exclusive Merch
                </p>
                {message.mediaRecommendations.products.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={prod.images[0]} alt={prod.title} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{prod.title}</p>
                        <p className="text-[10px] text-brand-gold font-mono">${prod.price} {prod.currency}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(prod)}
                      className="px-2 py-1 rounded-lg bg-brand-purple hover:bg-brand-violet text-white text-[10px] font-semibold transition-colors flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Projects */}
            {message.mediaRecommendations.projects && message.mediaRecommendations.projects.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Featured Projects
                </p>
                {message.mediaRecommendations.projects.slice(0, 3).map((proj) => (
                  <div
                    key={proj.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800">
                        {proj.coverUrl ? (
                          <Image src={proj.coverUrl} alt={proj.title} fill className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{proj.title}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{proj.producerName} • {proj.bpm || 120} BPM</p>
                      </div>
                    </div>
                    <Link
                      href="/projects"
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Producers */}
            {message.mediaRecommendations.producers && message.mediaRecommendations.producers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Producers & Architects
                </p>
                {message.mediaRecommendations.producers.slice(0, 3).map((producer) => (
                  <div
                    key={producer.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-neutral-800">
                        {producer.avatarUrl ? (
                          <Image src={producer.avatarUrl} alt={producer.name} fill className="object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{producer.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{producer.role}</p>
                      </div>
                    </div>
                    <Link
                      href="/artists"
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Profile
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
