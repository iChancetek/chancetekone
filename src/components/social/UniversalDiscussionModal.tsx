'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { X, MessageSquare, Disc3, ExternalLink } from 'lucide-react';
import { UniversalContentType } from '@/types/social';
import { CommentSection } from '@/components/comments/CommentSection';
import { SocialCommentService } from '@/lib/social/SocialCommentService';

interface UniversalDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentKey?: string;
  contentType: UniversalContentType;
  contentTitle?: string;
  contentSubtitle?: string;
  coverUrl?: string;
  badgeLabel?: string;
}

export const UniversalDiscussionModal: React.FC<UniversalDiscussionModalProps> = ({
  isOpen,
  onClose,
  contentId,
  contentKey,
  contentType,
  contentTitle = 'Content Discussion',
  contentSubtitle,
  coverUrl,
  badgeLabel,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commentCount = SocialCommentService.getCommentCount(contentId, contentKey);

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative z-10 w-full max-w-xl h-full bg-[#0d0914] border-l border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {coverUrl ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 shadow-md">
                <Image src={coverUrl} alt={contentTitle} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-gold/20 to-brand-amber/10 border border-brand-gold/40 flex items-center justify-center text-brand-gold flex-shrink-0 shadow-md">
                <Disc3 className="w-6 h-6 animate-spin-slow" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-brand-gold/15 border border-brand-gold/40 text-[10px] font-extrabold text-brand-gold uppercase tracking-wider">
                  {badgeLabel || contentType}
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  {commentCount} {commentCount === 1 ? 'thread' : 'threads'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-1">
                {contentTitle}
              </h2>
              {contentSubtitle && (
                <p className="text-xs text-neutral-400 truncate">{contentSubtitle}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title="Close discussion drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Comments & Threads Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <CommentSection
            contentId={contentId}
            contentKey={contentKey}
            contentType={contentType}
            contentTitle={contentTitle}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  );
};

