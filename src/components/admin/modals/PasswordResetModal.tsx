'use client';

import React, { useState } from 'react';
import { AdminUserRecord } from '@/types/admin';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { X, KeyRound, ShieldCheck, CheckCircle2, Lock, AlertCircle } from 'lucide-react';

interface PasswordResetModalProps {
  user: AdminUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ user, isOpen, onClose }) => {
  const [isDispatched, setIsDispatched] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleDispatchReset = () => {
    const res = AdminUserManager.initiatePasswordReset(user.id);
    if (res.success) {
      setIsDispatched(true);
      setTokenInfo(res.secureLinkToken);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl glass-panel border border-brand-purple/40 bg-[#0d0d16] shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-neon">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Secure Password Reset</h3>
              <p className="text-[11px] text-neutral-400">Target User: {user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4 text-brand-gold" />
            <span>Zero-Knowledge Security Standard</span>
          </div>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Existing user passwords are encrypted with bcrypt/Argon2 and are NEVER visible to administrators. Triggering a reset dispatches a cryptographically secure token via Firebase Auth.
          </p>
        </div>

        {isDispatched ? (
          <div className="space-y-3 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Reset Link Dispatched</h4>
            <p className="text-xs text-neutral-300">
              A secure password reset email with single-use verification link has been transmitted to <strong className="text-brand-gold">{user.email}</strong>.
            </p>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-400 select-all">
              Token ID: {tokenInfo}
            </div>
            <button
              onClick={() => {
                setIsDispatched(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-neutral-300">
              Confirm sending a password reset authorization email to <span className="text-white font-semibold">{user.email}</span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatchReset}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet text-white font-bold uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5"
              >
                <KeyRound className="w-4 h-4 text-brand-gold" />
                Dispatch Reset Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
