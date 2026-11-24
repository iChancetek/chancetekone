'use client';

import React from 'react';
import { Track } from '@/types/media';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';

interface ShareTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

export const ShareTrackModal: React.FC<ShareTrackModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  if (!isOpen || !track) return null;

  const liveTrack = MusicCatalogService.getTrackById(track.id) || track;
  const exactCover = MusicCatalogService.resolveTrackCover(liveTrack);

  return (
    <UniversalShareModal
      isOpen={isOpen}
      onClose={onClose}
      entity={{
        type: 'song',
        item: { ...liveTrack, coverUrl: exactCover },
        customCoverUrl: exactCover,
      }}
    />
  );
};
