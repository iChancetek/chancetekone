'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Share2, Check, SmilePlus } from 'lucide-react';
import { MediaType } from '@/types/media';
import { ReactionService, ContentReactions, UniversalReactionType } from '@/lib/social/ReactionService';
import { useAuth } from '@/lib/auth/AuthContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { ShareContentType } from '@/lib/sharing/shareMetadataService';

interface ReactionButtonsProps {
  contentId: string;
  contentKey?: string;
  contentType: MediaType | 'album' | 'artist' | 'playlist' | 'project' | 'podcast' | string;
  contentTitle?: string;
  contextLocation?: string;
  initialLikes?: number;
  initialDislikes?: number;
  variant?: 'standard' | 'compact' | 'minimal';
  showShare?: boolean;
}

const EXTENDED_EMOJI_MENU: { type: UniversalReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'thumbs_up_dark', emoji: '👍🏿', label: 'Black Thumbs Up' },
  { type: 'thumbs_down_dark', emoji: '👎🏿', label: 'Black Thumbs Down' },
  { type: 'thumbs_up', emoji: '👍', label: 'Thumbs Up' },
  { type: 'thumbs_down', emoji: '👎', label: 'Thumbs Down' },
  { type: 'clap', emoji: '👏', label: 'Applause' },
  { type: 'hundred', emoji: '💯', label: 'Hundred' },
];

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  contentId,
  contentKey,
  contentType,
  contentTitle,
  contextLocation = 'Platform Surface',
  initialLikes = 0,
  variant = 'standard',
  showShare = true,
}) => {
  const { profile } = useAuth();
  const userId = profile?.id || 'guest';
  const userName = profile?.name || profile?.email || 'Guest Listener';

  const [reactions, setReactions] = useState<ContentReactions>({
    fireCount: 0,
    heartCount: 0,
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    thumbsUpDarkCount: 0,
    thumbsDownDarkCount: 0,
    clapCount: 0,
    hundredCount: 0,
    hasFire: false,
    hasHeart: false,
    hasThumbsUp: false,
    hasThumbsDown: false,
    hasThumbsUpDark: false,
    hasThumbsDownDark: false,
    hasClap: false,
    hasHundred: false,
  });

  const [copied, setCopied] = useState(false);
  const [animatingEmoji, setAnimatingEmoji] = useState<UniversalReactionType | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch from authentic reactions engine
    const current = ReactionService.getReactions(contentId, userId, initialLikes, contentKey);
    setReactions(current);

    // Subscribe to real-time changes on both contentId and canonical contentKey
    const unsubscribe = ReactionService.subscribe(
      contentId,
      (updated) => {
        setReactions(updated);
      },
      contentKey
    );

    return () => unsubscribe();
  }, [contentId, userId, initialLikes, contentKey]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showEmojiPicker]);

  const handleToggle = (type: UniversalReactionType, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAnimatingEmoji(type);
    setTimeout(() => setAnimatingEmoji(null), 600);

    const updated = ReactionService.toggleReaction(
      contentId,
      type,
      contentType,
      userId,
      0,
      {
        contentTitle,
        userName,
        userEmail: profile?.email,
        contextLocation,
        contentKey,
      }
    );
    setReactions(updated);
    setShowEmojiPicker(false);
  };

  const mappedShareType: ShareContentType =
    contentType === 'music'
      ? 'song'
      : contentType === 'video'
      ? 'video'
      : contentType === 'podcast'
      ? 'podcast'
      : contentType === 'audiobook'
      ? 'audiobook'
      : contentType === 'book'
      ? 'book'
      : contentType === 'merch'
      ? 'merch'
      : contentType === 'producer'
      ? 'producer'
      : contentType === 'artist'
      ? 'artist'
      : contentType === 'album' || contentType === 'project'
      ? 'album'
      : contentType === 'playlist'
      ? 'playlist'
      : 'song';

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareModal(true);
  };

  // =========================================================================
  // 1. MINIMAL VARIANT (Used in track rows, table rows, compact cards)
  // =========================================================================
  if (variant === 'minimal') {
    return (
      <div className="relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* Fire */}
        <button
          type="button"
          onClick={(e) => handleToggle('fire', e)}
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
            reactions.hasFire
              ? 'bg-amber-500/25 text-amber-400 border border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : 'text-neutral-400 hover:text-amber-400 bg-white/5 hover:bg-white/10'
          }`}
          title="React with Fire 🔥"
        >
          <span className={`text-xs ${animatingEmoji === 'fire' ? 'scale-125 animate-bounce' : ''}`}>🔥</span>
          <span className="font-mono text-[11px] font-bold">{reactions.fireCount}</span>
        </button>

        {/* Heart */}
        <button
          type="button"
          onClick={(e) => handleToggle('heart', e)}
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
            reactions.hasHeart
              ? 'bg-rose-500/25 text-rose-400 border border-rose-400/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
              : 'text-neutral-400 hover:text-rose-400 bg-white/5 hover:bg-white/10'
          }`}
          title="React with Heart ❤️"
        >
          <span className={`text-xs ${animatingEmoji === 'heart' ? 'scale-125 animate-bounce' : ''}`}>❤️</span>
          <span className="font-mono text-[11px] font-bold">{reactions.heartCount}</span>
        </button>

        {/* Black Thumbs Up (shows if active or count > 0) */}
        {(reactions.hasThumbsUpDark || reactions.thumbsUpDarkCount > 0) && (
          <button
            type="button"
            onClick={(e) => handleToggle('thumbs_up_dark', e)}
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              reactions.hasThumbsUpDark
                ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'text-neutral-400 hover:text-amber-300 bg-white/5'
            }`}
            title="Black Thumbs Up 👍🏿"
          >
            <span className={`text-xs ${animatingEmoji === 'thumbs_up_dark' ? 'scale-125 animate-bounce' : ''}`}>👍🏿</span>
            <span className="font-mono text-[11px] font-bold">{reactions.thumbsUpDarkCount}</span>
          </button>
        )}

        {/* Black Thumbs Down (shows if active or count > 0) */}
        {(reactions.hasThumbsDownDark || reactions.thumbsDownDarkCount > 0) && (
          <button
            type="button"
            onClick={(e) => handleToggle('thumbs_down_dark', e)}
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              reactions.hasThumbsDownDark
                ? 'bg-neutral-800 text-neutral-300 border border-neutral-600'
                : 'text-neutral-400 hover:text-neutral-200 bg-white/5'
            }`}
            title="Black Thumbs Down 👎🏿"
          >
            <span className={`text-xs ${animatingEmoji === 'thumbs_down_dark' ? 'scale-125 animate-bounce' : ''}`}>👎🏿</span>
            <span className="font-mono text-[11px] font-bold">{reactions.thumbsDownDarkCount}</span>
          </button>
        )}

        {/* Standard Thumbs Up (shows if active or count > 0) */}
        {(reactions.hasThumbsUp || reactions.thumbsUpCount > 0) && (
          <button
            type="button"
            onClick={(e) => handleToggle('thumbs_up', e)}
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              reactions.hasThumbsUp
                ? 'bg-blue-500/25 text-blue-400 border border-blue-400/40'
                : 'text-neutral-400 hover:text-blue-400 bg-white/5'
            }`}
            title="Thumbs Up 👍"
          >
            <span className={`text-xs ${animatingEmoji === 'thumbs_up' ? 'scale-125 animate-bounce' : ''}`}>👍</span>
            <span className="font-mono text-[11px] font-bold">{reactions.thumbsUpCount}</span>
          </button>
        )}

        {/* Quick Popover Trigger for full emoji menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowEmojiPicker((p) => !p);
            }}
            className="p-1 rounded-full text-neutral-400 hover:text-brand-gold hover:bg-white/10 transition-colors cursor-pointer"
            title="Add emoji reaction (thumbs up, thumbs down, black thumbs up/down, fire, love)"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>

          {showEmojiPicker && (
            <div
              ref={pickerRef}
              className="absolute bottom-full right-0 mb-2 p-1.5 rounded-2xl bg-neutral-900/95 border border-brand-gold/40 shadow-2xl backdrop-blur-xl flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {EXTENDED_EMOJI_MENU.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={(e) => handleToggle(item.type, e)}
                  className="p-1.5 rounded-xl hover:bg-white/15 text-sm transition-all hover:scale-125 cursor-pointer"
                  title={item.label}
                >
                  <span>{item.emoji}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. COMPACT VARIANT (Used in headers, slides, project cards)
  // =========================================================================
  if (variant === 'compact') {
    return (
      <div className="relative flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {/* Fire */}
        <button
          type="button"
          onClick={(e) => handleToggle('fire', e)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            reactions.hasFire
              ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
              : 'bg-black/60 hover:bg-white/10 text-neutral-300 hover:text-amber-300 border border-white/10'
          }`}
          title="React with Fire 🔥"
        >
          <span className={`transition-transform duration-200 ${animatingEmoji === 'fire' ? 'scale-150 animate-pulse' : ''}`}>🔥</span>
          <span className="font-mono text-[11px] font-bold">{reactions.fireCount}</span>
        </button>

        {/* Heart */}
        <button
          type="button"
          onClick={(e) => handleToggle('heart', e)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            reactions.hasHeart
              ? 'bg-gradient-to-r from-rose-500/30 to-pink-500/30 text-rose-300 border border-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
              : 'bg-black/60 hover:bg-white/10 text-neutral-300 hover:text-rose-300 border border-white/10'
          }`}
          title="Love it ❤️"
        >
          <span className={`transition-transform duration-200 ${animatingEmoji === 'heart' ? 'scale-150 animate-pulse' : ''}`}>❤️</span>
          <span className="font-mono text-[11px] font-bold">{reactions.heartCount}</span>
        </button>

        {/* Black Thumbs Up 👍🏿 */}
        <button
          type="button"
          onClick={(e) => handleToggle('thumbs_up_dark', e)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            reactions.hasThumbsUpDark
              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-black/60 hover:bg-white/10 text-neutral-300 hover:text-amber-300 border border-white/10'
          }`}
          title="Black Thumbs Up 👍🏿"
        >
          <span className={`transition-transform duration-200 ${animatingEmoji === 'thumbs_up_dark' ? 'scale-150 animate-pulse' : ''}`}>👍🏿</span>
          <span className="font-mono text-[11px] font-bold">{reactions.thumbsUpDarkCount}</span>
        </button>

        {/* Black Thumbs Down 👎🏿 */}
        <button
          type="button"
          onClick={(e) => handleToggle('thumbs_down_dark', e)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            reactions.hasThumbsDownDark
              ? 'bg-neutral-800 text-white border border-neutral-500 shadow-md'
              : 'bg-black/60 hover:bg-white/10 text-neutral-400 hover:text-neutral-200 border border-white/10'
          }`}
          title="Black Thumbs Down 👎🏿"
        >
          <span className={`transition-transform duration-200 ${animatingEmoji === 'thumbs_down_dark' ? 'scale-150 animate-pulse' : ''}`}>👎🏿</span>
          <span className="font-mono text-[11px] font-bold">{reactions.thumbsDownDarkCount}</span>
        </button>

        {/* Emoji picker trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowEmojiPicker((p) => !p);
            }}
            className="p-1.5 rounded-full bg-black/60 hover:bg-white/15 text-neutral-300 hover:text-brand-gold border border-white/10 transition-colors cursor-pointer"
            title="More emojis (👍, 👎, 👏, 💯)"
          >
            <SmilePlus className="w-3.5 h-3.5 text-brand-gold" />
          </button>

          {showEmojiPicker && (
            <div
              ref={pickerRef}
              className="absolute bottom-full right-0 mb-2 p-2 rounded-2xl bg-neutral-900/98 border border-brand-gold/40 shadow-2xl backdrop-blur-xl flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {EXTENDED_EMOJI_MENU.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={(e) => handleToggle(item.type, e)}
                  className="p-2 rounded-xl hover:bg-white/15 text-sm transition-all hover:scale-125 cursor-pointer"
                  title={item.label}
                >
                  <span>{item.emoji}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. STANDARD VARIANT (Used on detail hero bars)
  // =========================================================================
  return (
    <div className="relative flex items-center gap-2.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {/* Fire */}
      <button
        type="button"
        onClick={(e) => handleToggle('fire', e)}
        className={`group flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
          reactions.hasFire
            ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-red-500/25 text-amber-300 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105'
            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-amber-400 border border-white/10 hover:border-amber-400/40'
        }`}
        title="React with Fire 🔥"
      >
        <span className={`text-sm transition-transform duration-300 group-hover:scale-125 ${animatingEmoji === 'fire' ? 'scale-150 animate-bounce' : ''}`}>
          🔥
        </span>
        <span className="uppercase text-[11px] font-black">Fire</span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono font-bold text-amber-300/90 border border-white/5">
          {reactions.fireCount.toLocaleString()}
        </span>
      </button>

      {/* Heart */}
      <button
        type="button"
        onClick={(e) => handleToggle('heart', e)}
        className={`group flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
          reactions.hasHeart
            ? 'bg-gradient-to-r from-rose-500/25 via-pink-500/25 to-red-500/25 text-rose-300 border-2 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)] scale-105'
            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-rose-400 border border-white/10 hover:border-rose-400/40'
        }`}
        title="React with Heart ❤️"
      >
        <span className={`text-sm transition-transform duration-300 group-hover:scale-125 ${animatingEmoji === 'heart' ? 'scale-150 animate-bounce' : ''}`}>
          ❤️
        </span>
        <span className="uppercase text-[11px] font-black">Love</span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono font-bold text-rose-300/90 border border-white/5">
          {reactions.heartCount.toLocaleString()}
        </span>
      </button>

      {/* Black Thumbs Up 👍🏿 */}
      <button
        type="button"
        onClick={(e) => handleToggle('thumbs_up_dark', e)}
        className={`group flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
          reactions.hasThumbsUpDark
            ? 'bg-amber-500/25 text-amber-200 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-105'
            : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-amber-300 border border-white/10'
        }`}
        title="Black Thumbs Up 👍🏿"
      >
        <span className={`text-sm transition-transform duration-300 group-hover:scale-125 ${animatingEmoji === 'thumbs_up_dark' ? 'scale-150 animate-bounce' : ''}`}>
          👍🏿
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono font-bold text-amber-200/90 border border-white/5">
          {reactions.thumbsUpDarkCount.toLocaleString()}
        </span>
      </button>

      {/* Black Thumbs Down 👎🏿 */}
      <button
        type="button"
        onClick={(e) => handleToggle('thumbs_down_dark', e)}
        className={`group flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-extrabold tracking-wide transition-all duration-200 cursor-pointer ${
          reactions.hasThumbsDownDark
            ? 'bg-neutral-800 text-white border-2 border-neutral-500 shadow-md scale-105'
            : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10'
        }`}
        title="Black Thumbs Down 👎🏿"
      >
        <span className={`text-sm transition-transform duration-300 group-hover:scale-125 ${animatingEmoji === 'thumbs_down_dark' ? 'scale-150 animate-bounce' : ''}`}>
          👎🏿
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-mono font-bold text-neutral-300 border border-white/5">
          {reactions.thumbsDownDarkCount.toLocaleString()}
        </span>
      </button>

      {/* Emoji picker trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEmojiPicker((p) => !p);
          }}
          className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-brand-gold border border-white/10 transition-colors cursor-pointer"
          title="More reaction emojis"
        >
          <SmilePlus className="w-4 h-4 text-brand-gold" />
        </button>

        {showEmojiPicker && (
          <div
            ref={pickerRef}
            className="absolute bottom-full right-0 mb-2 p-2.5 rounded-2xl bg-neutral-900/98 border border-brand-gold/40 shadow-2xl backdrop-blur-xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            {EXTENDED_EMOJI_MENU.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={(e) => handleToggle(item.type, e)}
                className="p-2 rounded-xl hover:bg-white/15 text-base transition-all hover:scale-125 cursor-pointer"
                title={item.label}
              >
                <span>{item.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Optional Share Button */}
      {showShare && (
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-300 hover:text-white transition-all shadow-sm cursor-pointer"
          title="Share link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5 text-neutral-400" />}
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>
      )}

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: mappedShareType,
            id: contentId,
            customTitle: contentTitle,
          }}
        />
      )}
    </div>
  );
};
