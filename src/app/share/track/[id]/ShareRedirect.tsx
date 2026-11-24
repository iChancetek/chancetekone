'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Music, Sparkles, Headphones, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  GUEST_SIGNUP_GATE_MESSAGE,
  MAX_GUEST_SHARED_LISTENS,
  buildGuestSignupRedirectUrl,
  getGuestPreviewState,
  markSharedMusicArrival,
} from '@/lib/auth/guestPreviewGate';

interface ShareRedirectProps {
  id: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
}

export const ShareRedirect: React.FC<ShareRedirectProps> = ({
  id,
  title = 'Featured Track',
  artist = 'ChanceTEK One',
  coverUrl = '/images/genres/rnb-neo-soul.jpg',
}) => {
  const router = useRouter();
  const { profile, user, isAdmin, loading } = useAuth();
  const [statusNote, setStatusNote] = useState('Opening shared song preview...');

  useEffect(() => {
    if (loading) return;

    const isAuthenticated = Boolean(profile || user || isAdmin);
    if (isAuthenticated) {
      router.replace(`/music/${encodeURIComponent(id)}`);
      return;
    }

    // Mark visitor as arriving from a shared music link
    markSharedMusicArrival(id);
    const previewState = getGuestPreviewState();

    if (previewState.limitReached) {
      setStatusNote(GUEST_SIGNUP_GATE_MESSAGE);
      const timer = setTimeout(() => {
        router.replace(buildGuestSignupRedirectUrl(id));
      }, 900);
      return () => clearTimeout(timer);
    }

    setStatusNote(
      `Opening track — ${previewState.listensRemaining} of ${MAX_GUEST_SHARED_LISTENS} free guest listens remaining`
    );
    const timer = setTimeout(() => {
      router.replace(`/music/${encodeURIComponent(id)}?shared=1`);
    }, 450);
    return () => clearTimeout(timer);
  }, [id, router, profile, user, isAdmin, loading]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/40 bg-gradient-to-b from-[#17102a]/95 via-[#0f0a1d]/95 to-[#08060f]/95 shadow-2xl text-center space-y-5">
        <div className="relative w-40 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-brand-gold/50 shadow-2xl bg-neutral-900">
          <Image
            src={coverUrl}
            alt={title}
            fill
            priority
            className="object-cover"
            unoptimized={coverUrl.startsWith('http') || coverUrl.startsWith('/api/share/cover')}
          />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-[11px] font-bold uppercase tracking-wider">
            <Headphones className="w-3.5 h-3.5" />
            <span>Shared Music Link · ChanceTEK One</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{title}</h1>
          <p className="text-sm font-semibold text-brand-gold">{artist}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
          <p className="text-xs font-semibold text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold shrink-0" />
            <span>{statusNote}</span>
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {GUEST_SIGNUP_GATE_MESSAGE}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Link
            href={`/music/${encodeURIComponent(id)}?shared=1`}
            className="px-4 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 hover:scale-105 transition-transform"
          >
            <Music className="w-3.5 h-3.5" />
            <span>Open Track Now</span>
          </Link>
          <Link
            href={buildGuestSignupRedirectUrl(id)}
            className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-brand-gold" />
            <span>Create Free Account</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
