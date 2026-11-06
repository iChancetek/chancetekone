'use client';

import React from 'react';
import { AuthModal } from './AuthModal';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = (props) => {
  return <AuthModal {...props} />;
};
