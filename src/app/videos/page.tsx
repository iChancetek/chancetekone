'use client';

import React, { useState, useEffect } from 'react';
import { Video as VideoIcon, UploadCloud } from 'lucide-react';
import { MediaCard } from '@/components/media/MediaCard';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MediaUploadModal } from '@/components/media/MediaUploadModal';
import { Video } from '@/types/media';

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const syncVideos = () => {
    setVideos(MediaCatalogService.getAllVideos());
  };

  useEffect(() => {
    syncVideos();
    const unsub = MediaCatalogService.subscribe(syncVideos);
    window.addEventListener('media-catalog-updated', syncVideos);
    return () => {
      unsub();
      window.removeEventListener('media-catalog-updated', syncVideos);
    };
  }, []);

  return (
    <div className="space-y-8 py-6">
      <div className="specular-edge relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-rose-950/30 via-[#0c0c16]/90 to-[#080810]/95">
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-rose-500/15 blur-[100px]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-bold uppercase tracking-[0.14em]">
              <VideoIcon className="w-3.5 h-3.5" />
              <span>Visual Cinema • 4K Vault</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="shimmer-cta px-4 py-2.5 rounded-full bg-gradient-to-r from-rose-600 via-brand-amber to-brand-gold hover:scale-[1.03] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_6px_24px_rgba(244,63,94,0.35)] flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Video (MP3, MP4, .MOV)</span>
              </button>
              <VoiceNarrationButton
                text="Welcome to the ChanceTEK Visual Cinema and Video Production vault. Featuring ChanceTEK HQ architectural tours, the multi-chapter CyneMora saga, iSkylar AI companion motion premieres, StrideIQ intelligent performance analytics, The Fam... Famio cultural legacy films, and the ChanceTEK One Remix visual suite by Chancellor at ChanceTEK LLC."
                variant="dual"
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold studio-heading-gradient tracking-tight">
            ChanceTEK Cinema &amp; Visual Productions
          </h1>
          <p className="text-sm sm:text-base text-neutral-300/90 mt-2.5 max-w-3xl leading-relaxed">
            High-definition visual experiences, ChanceTEK HQ architecture, CyneMora cinematic series, iSkylar AI companion reveals, StrideIQ analytics, Famio legacy films, and the ChanceTEK One Remix suite by Chancellor @ ChanceTEK LLC.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {videos.map((video) => (
          <MediaCard key={video.id} item={video} type="video" />
        ))}
      </div>

      {/* Upload Modal */}
      <MediaUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        mediaType="video"
        onSuccess={syncVideos}
      />
    </div>
  );
}
