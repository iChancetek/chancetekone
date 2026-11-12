'use client';

import React, { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { ProfileMediaStorageService } from '@/lib/auth/ProfileMediaStorageService';
import { Sparkles } from 'lucide-react';

interface SignInPresencePreviewProps {
  email: string;
  visible: boolean;
}

interface ResolvedPreviewProfile {
  name: string;
  avatarUrl?: string;
  profileVideoUrl?: string;
}

const PROFILE_PREFS_KEY = 'chancetek_profile_prefs_v1';

export default function SignInPresencePreview({ email, visible }: SignInPresencePreviewProps) {
  const [preview, setPreview] = useState<ResolvedPreviewProfile | null>(null);

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!visible || !trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setPreview(null);
      return;
    }

    let cancelled = false;

    const resolvePreview = async () => {
      let name = trimmed.split('@')[0] || 'Member';
      let avatarUrl: string | undefined;
      let profileVideoUrl: string | undefined;
      let localUpdatedAt = 0;

      // 1. Check local persistent profile prefs
      try {
        const raw = localStorage.getItem(PROFILE_PREFS_KEY);
        if (raw) {
          const map = JSON.parse(raw);
          const entry = map?.[`email:${trimmed}`];
          if (entry && typeof entry === 'object') {
            if (typeof entry.name === 'string' && entry.name.trim()) name = entry.name.trim();
            if (typeof entry.avatarUrl === 'string' && !entry.avatarUrl.startsWith('blob:')) {
              avatarUrl = entry.avatarUrl;
            }
            if (
              typeof entry.profileVideoUrl === 'string' &&
              !entry.profileVideoUrl.startsWith('blob:')
            ) {
              profileVideoUrl = entry.profileVideoUrl;
            }
            localUpdatedAt = Number(entry.updatedAt) || 0;
          }
        }
      } catch {}

      // 2. Check IndexedDB cached media alias for this email (supports offline + large videos)
      try {
        const idbMedia = await ProfileMediaStorageService.getProfileMedia(
          `email:${trimmed}`,
          trimmed
        );
        if (idbMedia) {
          const preferred =
            (idbMedia as { remoteUrl?: string }).remoteUrl || idbMedia.objectUrl;
          if (idbMedia.type === 'video' && !profileVideoUrl) {
            profileVideoUrl = preferred;
          } else if (idbMedia.type === 'image' && (!avatarUrl || avatarUrl === '/images/logo.png')) {
            avatarUrl = preferred;
          }
        }
      } catch {}

      if (!cancelled && (profileVideoUrl || (avatarUrl && avatarUrl !== '/images/logo.png'))) {
        setPreview({ name, avatarUrl, profileVideoUrl });
      }

      // 3. Query server / cloud profile store for durable cross-device/cross-browser preview
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const rec = data?.ok && data?.profile ? data.profile : null;
        if (!rec || cancelled) return;

        const remoteTs = rec.updatedAt ? Date.parse(rec.updatedAt) || 0 : 0;
        const remoteName =
          typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : name;
        const remoteVideo =
          typeof rec.profileVideoUrl === 'string' && !rec.profileVideoUrl.startsWith('blob:')
            ? rec.profileVideoUrl
            : undefined;
        const remoteAvatar =
          typeof rec.avatarUrl === 'string' && !rec.avatarUrl.startsWith('blob:')
            ? rec.avatarUrl
            : undefined;

        const finalVideo =
          remoteVideo || (remoteTs > localUpdatedAt + 1000 ? undefined : profileVideoUrl);
        const finalAvatar =
          remoteAvatar || (remoteTs > localUpdatedAt + 1000 ? undefined : avatarUrl);

        if (finalVideo || (finalAvatar && finalAvatar !== '/images/logo.png') || remoteName) {
          setPreview({
            name: remoteName,
            avatarUrl: finalAvatar,
            profileVideoUrl: finalVideo,
          });
        }
      } catch {}
    };

    const timer = setTimeout(resolvePreview, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [email, visible]);

  if (!visible || !preview) return null;
  const hasVisualMedia = Boolean(
    preview.profileVideoUrl || (preview.avatarUrl && preview.avatarUrl !== '/images/logo.png')
  );
  if (!hasVisualMedia) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-brand-gold/40 shadow-inner">
      <UserAvatar
        name={preview.name}
        avatarUrl={preview.avatarUrl}
        videoUrl={preview.profileVideoUrl}
        size="lg"
        borderClassName="border-2 border-brand-gold/70"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider font-black text-brand-gold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Welcome Back
        </p>
        <p className="text-sm font-bold text-white truncate">{preview.name}</p>
        <p className="text-[11px] text-zinc-400 truncate">
          {preview.profileVideoUrl ? 'Profile video active for sign-in' : 'Profile photo loaded'}
        </p>
      </div>
    </div>
  );
}
