'use client';

import React from 'react';
import { Track } from '@/types/media';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';

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

  return (
    <UniversalShareModal
      isOpen={isOpen}
      onClose={onClose}
      entity={{
        type: 'song',
        item: track,
      }}
    />
  );
};
