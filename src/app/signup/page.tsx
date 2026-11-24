'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, Headphones, ArrowLeft, UserPlus } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { Track } from '@/types/media';
import {
  GUEST_SIGNUP_GATE_MESSAGE,
  MAX_GUEST_SHARED_LISTENS,
  clearGuestSharedSession,
  getGuestPreviewState,
} from '@/lib/auth/guestPreviewGate';

function SignupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, user, isAdmin } = useAuth();

  const fromShared = searchParams.get('from') === 'shared';
  const trackId = searchParams.get('track') || '';
  const [modalOpen, setModalOpen] = useState(true);
  const [track, setTrack] = useState<Track | null>(null);
  const [listensUsed, setListensUsed] = useState(0);

  useEffect(() => {
    const state = getGuestPreviewState();
    setListensUsed(state.listensUsed);
    if (trackId) {
      const found = MusicCatalogService.getTrackById(trackId) || null;
      setTrack(found);
      const unsub = MusicCatalogService.subscribe(() => {
        setTrack(MusicCatalogService.getTrackById(trackId) || null);
      });
      return () => unsub();
    }
  }, [trackId]);

  useEffect(() => {
    if (profile || user || isAdmin) {
      clearGuestSharedSession();
      router.replace(trackId ? `/music/${encodeURIComponent(trackId)}` : '/music');
    }
  }, [profile, user, isAdmin, router, trackId]);

  const coverUrl = track ? MusicCatalogService.resolveTrackCover(track) : null;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-10 px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/40 bg-gradient-to-b from-[#17102a]/95 via-[#0e0a1c]/95 to-[#08060f]/95 shadow-2xl text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-black uppercase tracking-wider">
          <Headphones className="w-4 h-4" />
          <span>
            {fromShared
              ? `Free Guest Preview Complete (${Math.min(listensUsed, MAX_GUEST_SHARED_LISTENS)}/${MAX_GUEST_SHARED_LISTENS} Listens)`
              : 'Join ChanceTEK One'}
          </span>
        </div>

        {track && coverUrl && (
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-left">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900">
              <Image
                src={coverUrl}
                alt={track.title}
                fill
                className="object-cover"
                unoptimized={coverUrl.startsWith('http') || coverUrl.startsWith('data:')}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono text-brand-gold uppercase">Shared Track</p>
              <p className="text-sm font-black text-white truncate">{track.title}</p>
              <p className="text-xs text-neutral-300 truncate">{track.artistName}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Create Your Free Account
          </h1>
          <p className="text-sm font-semibold text-brand-gold leading-relaxed">
            {GUEST_SIGNUP_GATE_MESSAGE}
          </p>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Unlock unlimited high-fidelity music streaming, personal crates &amp; playlists, 4K visual
            cinema, audiobooks, and community discussions on ChanceTEK One.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:scale-105 transition-transform inline-flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Free Account Now</span>
          </button>

          <Link
            href="/music"
            className="px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-gold" />
            <span>Browse Platform</span>
          </Link>
        </div>
      </div>

      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Your ChanceTEK One Account"
        description={GUEST_SIGNUP_GATE_MESSAGE}
        initialTab="signup"
        onSuccess={() => {
          clearGuestSharedSession();
          setModalOpen(false);
          router.replace(trackId ? `/music/${encodeURIComponent(trackId)}` : '/music');
        }}
      />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm text-neutral-400">
          <Sparkles className="w-4 h-4 text-brand-gold mr-2 animate-pulse" />
          <span>{GUEST_SIGNUP_GATE_MESSAGE}</span>
        </div>
      }
    >
      <SignupRedirectContent />
    </Suspense>
  );
}

