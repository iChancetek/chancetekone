'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X,
  Copy,
  Check,
  Share2,
  Globe,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  resolveShareMetadata,
  ShareableInput,
  ResolvedShareMetadata,
  isDefaultOrInvalidCover,
  isGenericGenreCover,
} from '@/lib/sharing/shareMetadataService';
import { AudioStorageService } from '@/lib/audio/AudioStorageService';

export interface UniversalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity?: ShareableInput;
  meta?: ResolvedShareMetadata;
}

function copyTextReliably(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openExternalUrlSafely(url: string) {
  if (typeof window === 'undefined') return;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    // Fallback if a strict PWA webview blocks window.open
    window.location.href = url;
  }
}

export const UniversalShareModal: React.FC<UniversalShareModalProps> = ({
  isOpen,
  onClose,
  entity,
  meta: explicitMeta,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTextMsg, setCopiedTextMsg] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [hydratedIdbCover, setHydratedIdbCover] = useState<string | null>(null);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  const meta = useMemo(() => {
    if (explicitMeta) return explicitMeta;
    if (entity) return resolveShareMetadata(entity);
    return resolveShareMetadata({ type: 'song', id: 'default' });
  }, [explicitMeta, entity]);

  useEffect(() => {
    setSupportsNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Reset image error and hydrate any IndexedDB embedded APIC artwork for the exact shared song
  useEffect(() => {
    setImgError(false);
    setHydratedIdbCover(null);
    setShareNotice(null);
    if (!isOpen || (meta.type !== 'song' && meta.type !== 'beat') || !meta.id) return;
    let cancelled = false;
    AudioStorageService.getCoverArt(meta.id)
      .then((cover) => {
        if (!cancelled && cover && cover.startsWith('data:image/')) {
          setHydratedIdbCover(cover);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, meta.id, meta.type, meta.coverUrl]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setShareNotice(msg);
    setTimeout(() => {
      setShareNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleCopyLink = async () => {
    await copyTextReliably(meta.canonicalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleTextMessageShare = () => {
    // Copy formatted text message synchronously for seamless pasting
    void copyTextReliably(meta.textMessageBody);
    setCopiedTextMsg(true);
    setTimeout(() => setCopiedTextMsg(false), 3000);

    // iOS uses `sms:&body=...`; Android & desktop use `sms:?body=...`
    const encodedBody = encodeURIComponent(meta.textMessageBody);
    const platformSmsUrl = isIOSDevice() ? `sms:&body=${encodedBody}` : `sms:?body=${encodedBody}`;
    try {
      window.location.href = platformSmsUrl;
    } catch {
      // Clipboard already holds the formatted message
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${meta.title} — ${meta.creator}`,
          text: `${meta.title} by ${meta.creator} on ChanceTEK One`,
          url: meta.canonicalUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
    showToast('Share link copied! Paste anywhere — the song cover art attaches automatically.');
  };

  const handleFacebookShare = () => {
    void copyTextReliably(meta.canonicalUrl);
    openExternalUrlSafely(meta.facebookUrl);
  };

  const handleMessengerShare = () => {
    void copyTextReliably(meta.canonicalUrl);
    if (isMobileDevice()) {
      showToast('Opening Messenger — link is also copied so you can paste into any chat with cover art.');
      window.location.href = meta.messengerUrl;
    } else {
      showToast('Link copied for Messenger! Paste into your Messenger chat — cover art attaches automatically.');
      openExternalUrlSafely('https://www.messenger.com/');
    }
  };

  const handleFamioShare = () => {
    const famioPost = `${meta.title} by ${meta.creator} — Listen on ChanceTEK One\n${meta.canonicalUrl}`;
    void copyTextReliably(famioPost);
    showToast('Copied for Famio.us! Opening famio.us — paste into your Famio post or chat and the cover art attaches automatically.');
    openExternalUrlSafely(meta.famioUrl);
  };

  const handleTwitterShare = () => {
    openExternalUrlSafely(meta.twitterUrl);
  };

  const handleLinkedInShare = () => {
    openExternalUrlSafely(meta.linkedInUrl);
  };

  const handleWhatsAppShare = () => {
    openExternalUrlSafely(meta.whatsAppUrl);
  };

  const handleTelegramShare = () => {
    openExternalUrlSafely(meta.telegramUrl);
  };

  const handleEmailShare = () => {
    window.location.href = meta.emailUrl;
  };

  const handleInstagramShare = () => {
    void copyTextReliably(meta.canonicalUrl);
    showToast('Link copied for Instagram! Opening Instagram — paste into your Story, Bio, or DM.');
    openExternalUrlSafely('https://www.instagram.com/');
  };

  // Resilient fallback image if image loading errors out:
  const fallbackCover = meta.type === 'video'
    ? '/images/genres/hip-hop.jpg'
    : meta.type === 'audiobook' || meta.type === 'book'
    ? '/images/audiobooks/famio.jpg'
    : meta.type === 'merch'
    ? '/images/merch/signature_hoodie.jpg'
    : '/images/genres/rnb-neo-soul.jpg';

  const preferredSongCover =
    hydratedIdbCover && (isDefaultOrInvalidCover(meta.coverUrl) || isGenericGenreCover(meta.coverUrl))
      ? hydratedIdbCover
      : meta.coverUrl;

  const resolvedCoverSrc = imgError ? fallbackCover : preferredSongCover;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9992] w-screen max-w-[100vw] h-[100dvh] overflow-x-hidden flex items-center justify-center p-3 sm:p-4 bg-black/80 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden glass-panel p-5 sm:p-7 rounded-3xl border border-brand-gold/40 space-y-5 bg-gradient-to-b from-[#161026]/98 via-[#0e0a1a]/98 to-[#07050d]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold shadow-lg shadow-brand-gold/15">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Share {meta.typeLabel}</span>
                <Sparkles className="w-4 h-4 text-brand-gold" />
              </h3>
              <p className="text-xs text-neutral-400">
                Cover art attaches automatically on social media, Messenger, SMS, and Famio.us
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Authentic Media Preview Card */}
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-4 relative z-10 shadow-inner">
          <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900 shadow-xl">
            <Image
              src={resolvedCoverSrc}
              alt={meta.title}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
              unoptimized={
                resolvedCoverSrc.startsWith('http') ||
                resolvedCoverSrc.startsWith('/api/') ||
                resolvedCoverSrc.startsWith('blob:') ||
                resolvedCoverSrc.startsWith('data:')
              }
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shrink-0">
                {meta.typeLabel}
              </span>
              {meta.metadataBadges.map((badge, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-neutral-300 border border-white/10 shrink-0"
                >
                  {badge}
                </span>
              ))}
            </div>

            <h4 className="font-extrabold text-white text-sm sm:text-base truncate" title={meta.title}>
              {meta.title}
            </h4>

            <p className="text-xs font-semibold text-brand-gold truncate" title={meta.creator}>
              {meta.creator}
            </p>

            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed" title={meta.description}>
              {meta.description}
            </p>
          </div>
        </div>

        {/* Mobile/Device Native Share Sheet (1-Tap Share to Messenger, Messages, Famio, WhatsApp, etc.) */}
        {supportsNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="relative z-10 w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-brand-gold/25 flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share via Device Apps (Messenger, Messages, Social)</span>
          </button>
        )}

        {/* Direct Link Section */}
        <div className="space-y-2 relative z-10">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-brand-gold" />
            <span>Direct Public Link</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={meta.canonicalUrl}
              className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-neutral-300 font-mono focus:outline-none focus:border-brand-gold/60 select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shrink-0 cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-brand-gold to-brand-amber text-black hover:scale-105 active:scale-95 shadow-brand-gold/20'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dedicated Text Message (SMS / iMessage) Action Card */}
        <div className="relative z-10 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-purple/10 to-brand-gold/10 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Text Message (SMS & iMessage)</span>
                {copiedTextMsg && (
                  <span className="text-[10px] text-emerald-400 font-normal">
                    • Message Copied!
                  </span>
                )}
              </h5>
              <p className="text-[11px] text-neutral-400 truncate">
                Pre-formatted with title, cover preview link & stream URL
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTextMessageShare}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer"
            title="Open in Text Messages or Copy Formatted SMS"
          >
            {copiedTextMsg ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Send className="w-3.5 h-3.5" />}
            <span>{copiedTextMsg ? 'Ready!' : 'Send Text'}</span>
          </button>
        </div>

        {/* Share Toast Notification */}
        {shareNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-100 animate-in fade-in flex items-center gap-2 relative z-10">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareNotice}</span>
          </div>
        )}

        {/* Social Media Channels Grid */}
        <div className="space-y-2 relative z-10 pt-0.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Share to Social Media, Messenger & Famio.us
          </label>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {/* Famio.us */}
            <button
              type="button"
              onClick={handleFamioShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/40 hover:border-indigo-300 text-white transition-all group cursor-pointer"
              title="Share to Famio.us"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-1 shadow-md shadow-indigo-600/40 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold">Famio.us</span>
            </button>

            {/* Facebook Messenger */}
            <button
              type="button"
              onClick={handleMessengerShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#0084FF]/15 hover:bg-[#0084FF]/25 border border-[#0084FF]/40 hover:border-[#0084FF] text-white transition-all group cursor-pointer"
              title="Send via Facebook Messenger"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0084FF] to-[#A033FF] flex items-center justify-center text-white mb-1 shadow-md shadow-[#0084FF]/30 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-4 h-4 fill-white" />
              </div>
              <span className="text-[10px] font-bold">Messenger</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={handleFacebookShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#1877F2]/20 border border-white/10 hover:border-[#1877F2]/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Post to Facebook"
            >
              <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center text-white mb-1 shadow-md shadow-[#1877F2]/30 group-hover:scale-110 transition-transform font-black text-sm">
                f
              </div>
              <span className="text-[10px] font-semibold">Facebook</span>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#25D366]/20 border border-white/10 hover:border-[#25D366]/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Share via WhatsApp"
            >
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white mb-1 shadow-md shadow-[#25D366]/30 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-4 h-4 fill-white" />
              </div>
              <span className="text-[10px] font-semibold">WhatsApp</span>
            </button>

            {/* X / Twitter */}
            <button
              type="button"
              onClick={handleTwitterShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-neutral-800 border border-white/10 hover:border-neutral-500 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Post to X (Twitter)"
            >
              <div className="w-8 h-8 rounded-full bg-black border border-white/30 flex items-center justify-center text-white mb-1 shadow-md group-hover:scale-110 transition-transform font-bold text-xs">
                X
              </div>
              <span className="text-[10px] font-semibold">X / Twitter</span>
            </button>

            {/* Instagram */}
            <button
              type="button"
              onClick={handleInstagramShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Share to Instagram"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mb-1 shadow-md shadow-pink-500/30 group-hover:scale-110 transition-transform font-bold text-[10px]">
                IG
              </div>
              <span className="text-[10px] font-semibold">Instagram</span>
            </button>

            {/* LinkedIn */}
            <button
              type="button"
              onClick={handleLinkedInShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#0A66C2]/20 border border-white/10 hover:border-[#0A66C2]/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Share to LinkedIn"
            >
              <div className="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center text-white mb-1 shadow-md shadow-[#0A66C2]/30 group-hover:scale-110 transition-transform font-bold text-[11px]">
                in
              </div>
              <span className="text-[10px] font-semibold">LinkedIn</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={handleTelegramShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#229ED9]/20 border border-white/10 hover:border-[#229ED9]/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Share to Telegram"
            >
              <div className="w-8 h-8 rounded-full bg-[#229ED9] flex items-center justify-center text-white mb-1 shadow-md shadow-[#229ED9]/30 group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold">Telegram</span>
            </button>

            {/* Email */}
            <button
              type="button"
              onClick={handleEmailShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="Share via Email"
            >
              <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white mb-1 shadow-md shadow-amber-600/30 group-hover:scale-110 transition-transform">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold">Email</span>
            </button>

            {/* More / Copy */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-brand-gold/20 border border-white/10 hover:border-brand-gold/50 text-neutral-200 hover:text-white transition-all group cursor-pointer"
              title="More Share Options"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber flex items-center justify-center text-black mb-1 shadow-md shadow-brand-gold/30 group-hover:scale-110 transition-transform">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold">More...</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 relative z-10">
          <span className="text-[11px] font-mono text-neutral-400">ChanceTEK One Universal Social Suite</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
