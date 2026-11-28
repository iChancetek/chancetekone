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
  ShieldCheck,
  ListMusic,
  Music2,
  X,
  Disc3,
} from 'lucide-react';
import { AIMessage, PlaybackVerificationCandidate } from '@/types/agent';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useCart } from '@/lib/commerce/CartContext';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

interface AIMessageCardProps {
  message: AIMessage;
  onSelectVerificationCandidate?: (messageId: string, candidateId: string) => void;
  onConfirmPlayback?: (
    messageId: string,
    candidate: PlaybackVerificationCandidate,
    mode?: 'play' | 'djchancemix'
  ) => void;
  onCancelPlayback?: (messageId: string) => void;
}

export const AIMessageCard: React.FC<AIMessageCardProps> = ({
  message,
  onSelectVerificationCandidate,
  onConfirmPlayback,
  onCancelPlayback,
}) => {
  const isAssistant = message.role === 'assistant';
  const { playTrack, playPlaylist } = usePlayer();
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

        {/* Human-in-the-Loop Playback Verification Card */}
        {message.playbackVerification && message.playbackVerification.candidates.length > 0 && (
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#16102b] via-[#0e0c1a] to-[#0a1320] border border-brand-gold/45 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-gold shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-gold">
                  {message.playbackVerification.status === 'pending'
                    ? 'Verify Before Playing'
                    : message.playbackVerification.status === 'confirmed'
                    ? 'Verified · Playing'
                    : 'Playback Cancelled'}
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300">
                Human-in-the-Loop
              </span>
            </div>

            <div className="space-y-1.5">
              {message.playbackVerification.candidates.map((cand) => {
                const isSelected = cand.id === message.playbackVerification!.selectedId;
                const isPending = message.playbackVerification!.status === 'pending';
                return (
                  <button
                    key={cand.id}
                    type="button"
                    disabled={!isPending}
                    onClick={() => onSelectVerificationCandidate?.(message.id, cand.id)}
                    className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-brand-gold/15 border-brand-gold text-white'
                        : 'bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                    } ${isPending ? 'cursor-pointer' : 'opacity-80 cursor-default'}`}
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/15 bg-neutral-900 flex items-center justify-center">
                      {cand.coverUrl ? (
                        <Image src={cand.coverUrl} alt={cand.title} fill unoptimized className="object-cover" />
                      ) : cand.kind === 'playlist' ? (
                        <ListMusic className="w-4 h-4 text-white/85" />
                      ) : (
                        <Music2 className="w-4 h-4 text-brand-gold" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-brand-gold shrink-0">
                          {cand.kind === 'playlist' ? 'Playlist' : 'Song'}
                        </span>
                        <p className="text-xs font-bold text-white truncate">{cand.title}</p>
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">{cand.subtitle}</p>
                      {cand.previewTracks && cand.previewTracks.length > 0 && (
                        <p className="text-[9px] text-neutral-500 truncate mt-0.5">
                          Includes: {cand.previewTracks.map((t) => t.title).join(' · ')}
                        </p>
                      )}
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-brand-gold bg-brand-gold text-black' : 'border-white/25'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {message.playbackVerification.status === 'pending' && (() => {
              const selected =
                message.playbackVerification!.candidates.find(
                  (c) => c.id === message.playbackVerification!.selectedId
                ) || message.playbackVerification!.candidates[0];
              if (!selected) return null;

              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onConfirmPlayback?.(message.id, selected, 'play')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black text-[11px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-transform cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{selected.kind === 'playlist' ? 'Confirm & Play Playlist' : 'Confirm & Play'}</span>
                  </button>

                  {selected.kind === 'playlist' && (
                    <button
                      type="button"
                      onClick={() => onConfirmPlayback?.(message.id, selected, 'djchancemix')}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-brand-purple/35 hover:bg-brand-purple/55 border border-brand-purple/60 text-white text-[10px] font-bold transition-colors cursor-pointer"
                      title="Verify and launch this playlist in DJChanceMix AutoMix Studio"
                    >
                      <Disc3 className="w-3.5 h-3.5 text-brand-gold" />
                      <span>DJChanceMix</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onCancelPlayback?.(message.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/15 text-neutral-300 hover:text-red-300 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Media Recommendations (Interactive Cards) */}
        {message.mediaRecommendations && (
          <div className="space-y-2 pt-1">
            {/* Playlists */}
            {message.mediaRecommendations.playlists && message.mediaRecommendations.playlists.length > 0 && !message.playbackVerification && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                  Matching Playlists
                </p>
                {message.mediaRecommendations.playlists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 flex items-center justify-center">
                        {pl.coverUrl ? (
                          <Image src={pl.coverUrl} alt={pl.name} fill unoptimized className="object-cover" />
                        ) : (
                          <ListMusic className="w-4 h-4 text-white/80" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{pl.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {pl.itemCount ?? pl.items?.length ?? 0} songs · {pl.ownerName || 'ChanceTEK One'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => playPlaylist(pl, 0, false)}
                      className="p-2 rounded-full bg-brand-gold text-black hover:scale-105 transition-transform flex-shrink-0 shadow-md cursor-pointer"
                      title="Play Playlist"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tracks */}
            {message.mediaRecommendations.tracks && message.mediaRecommendations.tracks.length > 0 && !message.playbackVerification && (
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
