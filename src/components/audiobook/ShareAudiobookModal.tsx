'use client';

import React from 'react';
import { Audiobook } from '@/types/media';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';

interface ShareAudiobookModalProps {
  isOpen: boolean;
  onClose: () => void;
  audiobook: {
    id: string;
    title: string;
    author?: string;
    narrator?: string;
    description?: string;
    coverUrl?: string;
  } | Audiobook;
}

export const ShareAudiobookModal: React.FC<ShareAudiobookModalProps> = ({
  isOpen,
  onClose,
  audiobook,
}) => {
  if (!isOpen || !audiobook) return null;

  return (
    <UniversalShareModal
      isOpen={isOpen}
      onClose={onClose}
      entity={{
        type: 'audiobook',
        item: audiobook,
        id: audiobook.id,
        customTitle: audiobook.title,
        customCreator: audiobook.author || audiobook.narrator,
        customDescription: (audiobook as any).description || (audiobook as any).synopsis,
        customCoverUrl: audiobook.coverUrl,
      }}
    />
  );
};
