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
      <div className="border-b border-white/5 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold uppercase tracking-wider">
            <VideoIcon className="w-3.5 h-3.5" />
            Visual Cinema
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-red-600 via-brand-amber to-brand-gold hover:scale-105 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5"
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
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">ChanceTEK Cinema & Visual Productions</h1>
        <p className="text-sm text-neutral-400 mt-1">
          High-definition visual experiences, ChanceTEK HQ architecture, CyneMora cinematic series, iSkylar AI companion reveals, StrideIQ analytics, Famio legacy films, and the ChanceTEK One Remix suite by Chancellor @ ChanceTEK LLC.
        </p>
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
