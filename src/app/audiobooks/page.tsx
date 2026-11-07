'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, UploadCloud, Share2 } from 'lucide-react';
import { MediaCard } from '@/components/media/MediaCard';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MediaUploadModal } from '@/components/media/MediaUploadModal';
import { ShareAudiobookModal } from '@/components/audiobook/ShareAudiobookModal';
import { usePlayer } from '@/lib/player/PlayerContext';
import { Audiobook } from '@/types/media';

export default function AudiobooksPage() {
  const [audiobooks, setAudiobooks] = useState<Audiobook[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sharingAudiobook, setSharingAudiobook] = useState<any | null>(null);
  const { requireStreamAuth } = usePlayer();

  const handleFeaturedVideoPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!requireStreamAuth('watch featured video')) {
      e.currentTarget.pause();
      e.currentTarget.currentTime = 0;
    }
  };

  const syncAudiobooks = () => {
    setAudiobooks(MediaCatalogService.getAllAudiobooks());
  };

  useEffect(() => {
    syncAudiobooks();
    const unsub = MediaCatalogService.subscribe(syncAudiobooks);
    window.addEventListener('media-catalog-updated', syncAudiobooks);
    return () => {
      unsub();
      window.removeEventListener('media-catalog-updated', syncAudiobooks);
    };
  }, []);

  return (
    <div className="space-y-8 py-6">
      <div className="border-b border-white/5 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-neon/20 border border-brand-neon/40 text-brand-neon text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            Audiobook Narratives & Cinema
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber hover:scale-105 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Audiobook & PDF Book (MP3, MP4, .MOV, .PDF)</span>
            </button>
            <VoiceNarrationButton
              text="Explore immersive master audiobooks and spoken narratives by Chancellor at ChanceTEK LLC and ChanceTEKone. Featuring Agentic AI, AI Security, Healthy Living, Intermittent Fasting, iSkylar, and The Fam... Famio."
              variant="dual"
            />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Audiobooks & Spoken Masterworks</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Explore immersive master audiobooks and spoken narratives on Agentic AI, AI Security, Health & Longevity, Neural Systems, and Cultural Heritage by Chancellor @ ChanceTEK LLC.
        </p>
      </div>

      {/* Saturday Night, Sunday Morning... By Author, Kwame Thompson */}
      <section className="glass-panel p-4 sm:p-6 rounded-3xl border border-brand-gold/40 bg-black/80 shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-gold" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Saturday Night, Sunday Morning... By Author, Kwame Thompson
            </h2>
          </div>
          <button
            onClick={() =>
              setSharingAudiobook({
                id: 'audiobook-kwame-thompson',
                title: 'Saturday Night, Sunday Morning',
                author: 'Kwame Thompson',
                description:
                  'Featured Upcoming Works. Saturday Night, Sunday Morning... By Author, Kwame Thompson.',
                coverUrl: '/images/genres/literature.jpg',
              })
            }
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share Saturday Night, Sunday Morning"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Audiobook</span>
          </button>
        </div>
        <div className="relative rounded-3xl border border-brand-gold/30 bg-black/95 w-full shadow-2xl p-2 sm:p-4 flex items-center justify-center">
          <video
            src="/videos/Kwame Book Promo 1.mp4"
            controls
            playsInline
            preload="metadata"
            onPlay={handleFeaturedVideoPlay}
            style={{ aspectRatio: '1112 / 830' }}
            className="w-full h-auto max-h-[75vh] object-contain rounded-xl shadow-lg bg-black block"
          />
        </div>
      </section>

      {/* Mi Vida Loca... By Author, Orlando Figueroa */}
      <section className="glass-panel p-4 sm:p-6 rounded-3xl border border-brand-gold/40 bg-black/80 shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-gold" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Mi Vida Loca... By Author, Orlando Figueroa
            </h2>
          </div>
          <button
            onClick={() =>
              setSharingAudiobook({
                id: 'audiobook-1793148157988-bnzl3',
                title: 'Mi Vida Loca',
                author: 'Orlando Figueroa',
                description:
                  'Mi Vida Loca. Written by Orlando Figueroa. Master spoken work and cinema presentation.',
                coverUrl: '/images/genres/literature.jpg',
              })
            }
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share Mi Vida Loca"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Audiobook</span>
          </button>
        </div>
        <div className="relative rounded-3xl border border-brand-gold/40 bg-black/95 w-full shadow-2xl p-2 sm:p-3 overflow-hidden flex items-center justify-center">
          <video
            src="/videos/OrlandoFigueroa.mp4"
            controls
            playsInline
            preload="metadata"
            onPlay={handleFeaturedVideoPlay}
            className="w-full h-auto max-h-[85vh] rounded-2xl shadow-xl bg-black block object-contain"
          />
        </div>
      </section>

      {/* Spoken Masterworks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-gold" />
            <span>Complete Spoken Audiobooks Library</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {audiobooks.length} Masterworks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {audiobooks.map((audiobook) => (
            <MediaCard key={audiobook.id} item={audiobook} type="audiobook" />
          ))}
        </div>
      </div>

      {/* Upload Modal */}
      <MediaUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        mediaType="audiobook"
        onSuccess={syncAudiobooks}
      />

      {/* Share Audiobook Modal */}
      {sharingAudiobook && (
        <ShareAudiobookModal
          isOpen={Boolean(sharingAudiobook)}
          onClose={() => setSharingAudiobook(null)}
          audiobook={sharingAudiobook}
        />
      )}
    </div>
  );
}
