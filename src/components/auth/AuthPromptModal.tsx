'use client';

import React from 'react';
import { AuthModal } from './AuthModal';
import { GUEST_SIGNUP_GATE_MESSAGE } from '@/lib/auth/guestPreviewGate';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  initialTab?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  description = GUEST_SIGNUP_GATE_MESSAGE,
  initialTab = 'signup',
  ...props
}) => {
  return <AuthModal description={description} initialTab={initialTab} {...props} />;
};
