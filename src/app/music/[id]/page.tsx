'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, Disc3, Heart, Sparkles, Music, Flame, ListPlus, ArrowLeft, MessageSquare, Share2 } from 'lucide-react';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService, getDefaultCoverForTrack } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { CommentSection } from '@/components/comments/CommentSection';
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal';
import { ContextualAIRecommendations } from '@/components/ai/ContextualAIRecommendations';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { SampleGenealogyCard } from '@/components/ai/SampleGenealogyCard';
import { Track } from '@/types/media';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function TrackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.id as string;
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const [track, setTrack] = useState<Track>(() => {
    return MusicCatalogService.getTrackById(trackId) || MOCK_TRACKS.find((t) => t.id === trackId) || MOCK_TRACKS[0];
  });

  React.useEffect(() => {
    const t = MusicCatalogService.getTrackById(trackId) || MOCK_TRACKS.find((t) => t.id === trackId) || MOCK_TRACKS[0];
    setTrack(t);
    const unsub = MusicCatalogService.subscribe(() => {
      const updated = MusicCatalogService.getTrackById(trackId) || MOCK_TRACKS.find((t) => t.id === trackId) || MOCK_TRACKS[0];
      setTrack(updated);
    });
    return () => unsub();
  }, [trackId]);
  const isCurrent = currentTrack?.id === track.id;
  const [hasImgError, setHasImgError] = useState(false);

  const resolvedCover = hasImgError
    ? getDefaultCoverForTrack(track)
    : MusicCatalogService.resolveTrackCover(track);



  const linerNotesText =
    track.lyrics ||
    `${track.title} by ${track.artistName}. Engineered with authentic syncopated drum breaks at ${track.bpm || 120} BPM. Analog bassline and classic sampler grit crafted for elite DJ sets.`;

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/music');
    }
  };

  return (
    <div className="space-y-8 py-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* Hero Header */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-8 bg-white/5 shadow-2xl">
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 bg-black/80">
          <Image
            src={resolvedCover}
            alt={track.title}
            fill
            className="object-cover"
            priority
            onError={() => setHasImgError(true)}
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon text-xs font-semibold uppercase tracking-wider">
            <Music className="w-3.5 h-3.5" />
            {track.genre} {track.bpm ? `• ${track.bpm} BPM` : ''}
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{track.title}</h1>
            <Link
              href={`/artists/${track.artistId}`}
              className="text-lg text-brand-neon font-semibold hover:underline block mt-1"
            >
              {track.artistName}
            </Link>
            {track.label && track.label !== track.artistName && (
              <p className="text-xs sm:text-sm font-bold text-brand-gold mt-0.5 tracking-wide">
                {track.label}
              </p>
            )}
            {track.albumTitle && (
              <p className="text-xs text-neutral-400 mt-1">
                From album:{' '}
                <Link href={`/albums/${track.albumId}`} className="text-white hover:underline">
                  {track.albumTitle}
                </Link>{' '}
                ({track.releaseYear})
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={() => {
                if (isCurrent) togglePlay();
                else playTrack(track);
              }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,195,68,0.6),0_4px_12px_rgba(0,0,0,0.5)] hover:shadow-[0_0_35px_rgba(245,195,68,0.9),0_6px_20px_rgba(0,0,0,0.6)] border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {isCurrent && isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-[#08080c] text-[#08080c]" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#08080c] text-[#08080c] ml-0.5" />
                  <span>Play Track</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowPlaylistModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-neon hover:text-white font-semibold text-xs transition-all shadow-md"
            >
              <ListPlus className="w-4 h-4 text-brand-gold" />
              <span>Add to Playlist</span>
            </button>

            <VoiceNarrationButton
              text={linerNotesText}
              label="Narrate Liner Notes"
              variant="pill"
              voice="alloy"
            />

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
              title="Share Track & Text Message"
            >
              <Share2 className="w-4 h-4 text-brand-gold" />
              <span>Share Song</span>
            </button>

            {(() => {
              const canonicalKey = buildCanonicalContentKey('song', track.title, track.artistName);
              const count = SocialCommentService.getCommentCount(track.id, canonicalKey);
              return (
                <>
                  <ReactionButtons
                    contentId={track.id}
                    contentKey={canonicalKey}
                    contentType="music"
                    contentTitle={`${track.title} (${track.artistName})`}
                    contextLocation="Single Track Master Hub"
                    initialLikes={track.likeCount}
                    initialDislikes={track.dislikeCount}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('track-comments-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold font-bold text-xs transition-all shadow-md cursor-pointer"
                    title={`${count} Discussion Comments & Threads`}
                  >
                    <MessageSquare className="w-4 h-4 text-brand-gold" />
                    <span className="font-mono text-brand-gold font-black">{count}</span>
                    <span className="hidden sm:inline">Threads</span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Sample Detective & Break Genealogist Section */}
      <SampleGenealogyCard track={track} />

      {/* Autonomous Contextual AI Recommendations */}
      <ContextualAIRecommendations
        autoFetch
        currentMedia={{
          id: track.id,
          type: 'track',
          title: track.title,
          artist: track.artistName,
          genre: track.genre,
          bpm: track.bpm,
        }}
      />

      {/* Lyrics & Liner Notes */}
      {track.lyrics && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 space-y-3 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
              Lyrics & Sample Narrative
            </h3>
            <VoiceNarrationButton
              text={track.lyrics}
              label="Read Aloud"
              variant="badge"
              voice="onyx"
            />
          </div>
          <div className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed font-mono bg-black/30 p-4 rounded-2xl border border-white/5">
            {track.lyrics}
          </div>
        </div>
      )}

      {/* Social Comments Section */}
      <div id="track-comments-section" className="pt-2">
        <CommentSection
          contentId={track.id}
          contentKey={buildCanonicalContentKey('song', track.title, track.artistName)}
          contentType="song"
          contentTitle={`${track.title} - ${track.artistName}`}
        />
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          mediaItem={{
            mediaId: track.id,
            mediaType: 'music',
            title: track.title,
            artistName: track.artistName,
            coverUrl: track.coverUrl,
            duration: track.duration,
          }}
        />
      )}

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'song',
            item: track,
          }}
        />
      )}
    </div>
  );
}
