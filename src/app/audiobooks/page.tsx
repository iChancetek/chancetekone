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
      <div className="specular-edge relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-brand-purple/20 via-[#0c0c16]/90 to-[#080810]/95">
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-purple/20 blur-[100px]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-neon/15 border border-brand-neon/35 text-brand-neon text-[11px] font-bold uppercase tracking-[0.14em]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Audiobook Narratives &amp; Cinema</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="shimmer-cta px-4 py-2.5 rounded-full bg-gradient-to-r from-[#f7cf62] via-brand-gold to-amber-500 hover:scale-[1.03] text-[#050509] font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_6px_24px_rgba(245,195,68,0.35)] flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Audiobook &amp; PDF Book (MP3, MP4, .MOV, .PDF)</span>
              </button>
              <VoiceNarrationButton
                text="Explore immersive master audiobooks and spoken narratives by Chancellor at ChanceTEK LLC and ChanceTEK One. Featuring Agentic AI, AI Security, Healthy Living, Intermittent Fasting, iSkylar, and The Fam... Famio."
                variant="dual"
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold studio-heading-gradient tracking-tight">
            Audiobooks &amp; Spoken Masterworks
          </h1>
          <p className="text-sm sm:text-base text-neutral-300/90 mt-2.5 max-w-3xl leading-relaxed">
            Explore immersive master audiobooks and spoken narratives on Agentic AI, AI Security, Health &amp; Longevity, Neural Systems, and Cultural Heritage by Chancellor @ ChanceTEK LLC.
          </p>
        </div>
      </div>

      {/* 1. FIRST Featured Audiobook: Mi Vida Loca... By Author, Orlando Figueroa (Full-Bleed Video Card) */}
      <section className="glass-panel rounded-3xl border border-brand-gold/40 bg-[#0c0c16]/90 shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-gold shrink-0" />
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
                coverUrl: '/images/audiobooks/famio.jpg',
              })
            }
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share Mi Vida Loca"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Audiobook</span>
          </button>
        </div>
        <div className="relative w-full bg-black overflow-hidden aspect-[9/16] sm:aspect-[4/5] md:aspect-[16/10]">
          <video
            src="/videos/OrlandoFigueroa.mp4#t=0.5"
            controls
            playsInline
            preload="auto"
            onPlay={handleFeaturedVideoPlay}
            className="w-full h-full object-cover object-center block bg-black"
          />
        </div>
      </section>

      {/* 2. Saturday Night, Sunday Morning... By Author, Kwame Thompson */}
      <section className="glass-panel rounded-3xl border border-brand-gold/40 bg-[#0c0c16]/90 shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-gold shrink-0" />
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
                coverUrl: '/images/audiobooks/famio.jpg',
              })
            }
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold hover:text-amber-300 font-semibold text-xs transition-all shadow-md cursor-pointer"
            title="Share Saturday Night, Sunday Morning"
          >
            <Share2 className="w-4 h-4 text-brand-gold" />
            <span>Share Audiobook</span>
          </button>
        </div>
        <div className="relative w-full bg-black overflow-hidden aspect-[1112/830] max-h-[75vh]">
          <video
            src="/videos/Kwame Book Promo 1.mp4#t=0.5"
            controls
            playsInline
            preload="auto"
            onPlay={handleFeaturedVideoPlay}
            className="w-full h-full object-cover object-center block bg-black"
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
