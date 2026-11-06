'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, ListPlus, Share2, MessageSquare } from 'lucide-react';
import { MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { AudiobookPlayer } from '@/components/player/AudiobookPlayer';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { CommentSection } from '@/components/comments/CommentSection';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { ShareAudiobookModal } from '@/components/audiobook/ShareAudiobookModal';
import { ContextualAIRecommendations } from '@/components/ai/ContextualAIRecommendations';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function AudiobookDetailPage() {
  const params = useParams();
  const audiobookId = params.id as string;
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const audiobook =
    MediaCatalogService.getAudiobookById(audiobookId) ||
    MOCK_AUDIOBOOKS.find((ab) => ab.id === audiobookId) ||
    MOCK_AUDIOBOOKS[0];

  return (
    <div className="space-y-8 py-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Audiobook Player Container */}
      <AudiobookPlayer audiobook={audiobook} />

      {/* Social Reactions & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPlaylistModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-neon hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
          >
            <ListPlus className="w-4 h-4 text-brand-gold" />
            <span>Add to Playlist</span>
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share this audiobook"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Audiobook</span>
          </button>

          <VoiceNarrationButton
            text={audiobook.description}
            label="Narrate Synopsis"
            variant="pill"
            voice="nova"
          />
        </div>

        <div className="flex items-center gap-2">
          {(() => {
            const abKey = buildCanonicalContentKey('audiobook', audiobook.title, audiobook.author);
            const count = SocialCommentService.getCommentCount(audiobook.id, abKey);
            return (
              <>
                <ReactionButtons
                  contentId={audiobook.id}
                  contentKey={abKey}
                  contentType="audiobook"
                  contentTitle={`${audiobook.title} (by ${audiobook.author})`}
                  contextLocation="Audiobook Lounge Page"
                  initialLikes={audiobook.likeCount}
                />

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('audiobook-comments-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer"
                  title={`${count} Discussion Comments & Threads`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                  <span className="font-mono text-brand-gold font-black">{count}</span>
                  <span className="hidden sm:inline">Threads</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Autonomous Contextual AI Recommendations */}
      <ContextualAIRecommendations
        autoFetch
        currentMedia={{
          id: audiobook.id,
          type: 'audiobook',
          title: audiobook.title,
          author: audiobook.author,
          category: 'Audiobook',
        }}
      />

      {/* Description */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/5 space-y-2">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
            Synopsis & Liner Notes
          </h3>
          <VoiceNarrationButton
            text={audiobook.description}
            label="Read Aloud"
            variant="badge"
            voice="nova"
          />
        </div>
        <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">{audiobook.description}</p>
      </div>

      {/* Comments */}
      <div id="audiobook-comments-section" className="pt-2">
        <CommentSection
          contentId={audiobook.id}
          contentKey={buildCanonicalContentKey('audiobook', audiobook.title, audiobook.author)}
          contentType="audiobook"
          contentTitle={`${audiobook.title} - ${audiobook.author}`}
        />
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={{
            mediaId: audiobook.id,
            mediaType: 'audiobook',
            title: audiobook.title,
            artistName: audiobook.author,
            coverUrl: audiobook.coverUrl,
            duration: audiobook.duration,
          }}
        />
      )}

      {showShareModal && (
        <ShareAudiobookModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          audiobook={audiobook}
        />
      )}
    </div>
  );
}
