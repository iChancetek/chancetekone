'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Send, Sparkles, X, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { UniversalContentType, Comment } from '@/types/social';
import { SocialCommentService } from '@/lib/social/SocialCommentService';
import { AuthModal } from '@/components/auth/AuthModal';

const QUICK_EMOJIS = ['🔥', '❤️', '👍🏿', '👎🏿', '👍', '👎', '👏🏿', '👏', '💯', '👑', '🎧', '⚡'];

interface CommentComposerProps {
  contentId: string;
  contentKey?: string;
  contentType: UniversalContentType;
  contentTitle?: string;
  parentCommentId?: string | null;
  replyToName?: string;
  placeholder?: string;
  buttonLabel?: string;
  autoFocus?: boolean;
  onCommentSubmitted?: (comment: Comment) => void;
  onCancel?: () => void;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  contentId,
  contentKey,
  contentType,
  contentTitle,
  parentCommentId = null,
  replyToName,
  placeholder,
  buttonLabel,
  autoFocus = false,
  onCommentSubmitted,
  onCancel,
}) => {
  const { profile, user, isAdmin } = useAuth();
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isAuthenticated = Boolean(profile || user);

  const defaultPlaceholder = parentCommentId
    ? `Reply to ${replyToName || 'thread'}...`
    : `Drop your thoughts, liner note breakdown, or beat critique...`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const email = profile?.email || user?.email || undefined;
      const handle = email ? `@${email.split('@')[0]}` : undefined;

      const newComment = SocialCommentService.addComment({
        contentId,
        contentKey,
        contentType,
        contentTitle,
        text: text.trim(),
        userId: profile?.id || user?.uid || 'usr-member',
        userName: profile?.name || user?.displayName || profile?.email?.split('@')[0] || 'ChanceTEK One MEMBER',
        userEmail: email,
        userHandle: handle,
        userAvatar: profile?.avatarUrl || user?.photoURL || '/images/logo.png',
        userRole: isAdmin ? 'admin' : (profile?.role as any) || 'user',
        creatorType: profile?.creatorType,
        parentCommentId,
      });

      setText('');
      if (onCommentSubmitted) {
        onCommentSubmitted(newComment);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-2.5 p-3.5 rounded-2xl bg-[#120f18]/80 border border-white/10 backdrop-blur-md shadow-inner transition-all focus-within:border-brand-purple/50 focus-within:shadow-[0_0_20px_rgba(182,109,255,0.15)]"
      >
        <div className="flex items-start gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-brand-purple/40 bg-brand-purple/10">
            <Image
              src={
                profile?.avatarUrl ||
                user?.photoURL ||
                '/images/logo.png'
              }
              alt="Member Avatar"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex-1 space-y-2">
            {replyToName && (
              <div className="flex items-center justify-between text-[11px] text-brand-gold font-medium">
                <span>Replying to @{replyToName}</span>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder || defaultPlaceholder}
              rows={parentCommentId ? 2 : 3}
              autoFocus={autoFocus}
              className="w-full bg-transparent text-xs text-white placeholder-neutral-400 focus:outline-none resize-none leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Quick Emojis & Submit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[10px] text-neutral-400 mr-1 flex items-center gap-0.5 font-mono">
              <Sparkles className="w-2.5 h-2.5 text-brand-gold" />
            </span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-xs flex items-center justify-center transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            {isAuthenticated ? (
              <button
                type="submit"
                disabled={!text.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-extrabold uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer"
              >
                <span>{buttonLabel || (parentCommentId ? 'Reply' : 'Post Thread')}</span>
                <Send className="w-3 h-3 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet text-white text-xs font-bold uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                <span>Sign In to Post</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Auth Gate for Visitors */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Sign In to Join the Discussion"
          description="Create your free member account or sign in to post comments, create discussion threads, and react with fire and hearts."
          initialTab="signup"
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
};
