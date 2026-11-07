'use client';

import React, { useState, useMemo } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import {
  resolveShareMetadata,
  ShareableInput,
  ResolvedShareMetadata,
  ShareContentType,
} from '@/lib/sharing/shareMetadataService';

export interface UniversalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity?: ShareableInput;
  meta?: ResolvedShareMetadata;
}

export const UniversalShareModal: React.FC<UniversalShareModalProps> = ({
  isOpen,
  onClose,
  entity,
  meta: explicitMeta,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTextMsg, setCopiedTextMsg] = useState(false);
  const [instagramNotice, setInstagramNotice] = useState(false);
  const [imgError, setImgError] = useState(false);

  const meta = useMemo(() => {
    if (explicitMeta) return explicitMeta;
    if (entity) return resolveShareMetadata(entity);
    return resolveShareMetadata({ type: 'song', id: 'default' });
  }, [explicitMeta, entity]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meta.canonicalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = meta.canonicalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleTextMessageShare = async () => {
    // Attempt to open device SMS app:
    if (typeof window !== 'undefined') {
      try {
        // Try to trigger native SMS protocol:
        window.location.href = meta.smsUrl;
      } catch (e) {
        // Fallback
      }
    }
    // Also copy formatted text message to clipboard for seamless pasting:
    try {
      await navigator.clipboard.writeText(meta.textMessageBody);
      setCopiedTextMsg(true);
      setTimeout(() => setCopiedTextMsg(false), 3000);
    } catch {
      // Ignored
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${meta.title} - ${meta.creator}`,
          text: meta.shareText,
          url: meta.canonicalUrl,
        });
      } catch {
        // User cancelled or sheet closed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleFacebookShare = () => {
    window.open(meta.facebookUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleTwitterShare = () => {
    window.open(meta.twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleLinkedInShare = () => {
    window.open(meta.linkedInUrl, '_blank', 'noopener,noreferrer,width=600,height=600');
  };

  const handleWhatsAppShare = () => {
    window.open(meta.whatsAppUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    window.open(meta.telegramUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    window.location.href = meta.emailUrl;
  };

  const handleInstagramShare = async () => {
    await handleCopyLink();
    setInstagramNotice(true);
    setTimeout(() => {
      setInstagramNotice(false);
      window.open('https://instagram.com', '_blank', 'noopener,noreferrer');
    }, 1500);
  };

  // Resilient fallback image if image loading errors out:
  const fallbackCover = meta.type === 'video'
    ? '/images/genres/hip-hop.jpg'
    : meta.type === 'audiobook' || meta.type === 'book'
    ? '/images/audiobooks/famio.jpg'
    : meta.type === 'merch'
    ? '/images/merch/signature_hoodie.jpg'
    : '/images/genres/rnb-neo-soul.jpg';

  const resolvedCoverSrc = imgError ? fallbackCover : meta.coverUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass-panel p-6 sm:p-7 rounded-3xl border border-brand-gold/40 space-y-5 bg-gradient-to-b from-[#161026]/98 via-[#0e0a1a]/98 to-[#07050d]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden"
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
                Share authentic media across social media, text messages, and direct links
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
              unoptimized={resolvedCoverSrc.startsWith('http') || resolvedCoverSrc.startsWith('blob:') || resolvedCoverSrc.startsWith('data:')}
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
                Pre-formatted with title, creator, description, and stream link
              </p>
            </div>
          </div>

          <button
            onClick={handleTextMessageShare}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer"
            title="Open in Text Messages or Copy Formatted SMS"
          >
            {copiedTextMsg ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Send className="w-3.5 h-3.5" />}
            <span>{copiedTextMsg ? 'Ready to Send!' : 'Send Text'}</span>
          </button>
        </div>

        {/* Instagram Notice Toast */}
        {instagramNotice && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-pink-500/40 text-[11px] text-pink-200 animate-in fade-in flex items-center gap-2 relative z-10">
            <Sparkles className="w-4 h-4 text-brand-gold shrink-0" />
            <span>Link copied to clipboard! Paste it into your Instagram Story, Bio, or DM.</span>
          </div>
        )}

        {/* Social Media Channels Grid */}
        <div className="space-y-2 relative z-10 pt-0.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Post Directly to Social Media
          </label>

          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
            {/* Facebook */}
            <button
              onClick={handleFacebookShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#1877F2]/20 border border-white/10 hover:border-[#1877F2]/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Post to Facebook"
            >
              <div className="w-7 h-7 rounded-full bg-[#1877F2] flex items-center justify-center text-white mb-1 shadow-md shadow-[#1877F2]/30 group-hover:scale-110 transition-transform font-bold text-xs">
                f
              </div>
              <span className="text-[10px] font-semibold">Facebook</span>
            </button>

            {/* X / Twitter */}
            <button
              onClick={handleTwitterShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-neutral-800 border border-white/10 hover:border-neutral-500 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Post to X (Twitter)"
            >
              <div className="w-7 h-7 rounded-full bg-black border border-white/30 flex items-center justify-center text-white mb-1 shadow-md group-hover:scale-110 transition-transform font-bold text-xs">
                𝕏
              </div>
              <span className="text-[10px] font-semibold">X (Twitter)</span>
            </button>

            {/* LinkedIn */}
            <button
              onClick={handleLinkedInShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#0A66C2]/20 border border-white/10 hover:border-[#0A66C2]/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Share to LinkedIn"
            >
              <div className="w-7 h-7 rounded-full bg-[#0A66C2] flex items-center justify-center text-white mb-1 shadow-md shadow-[#0A66C2]/30 group-hover:scale-110 transition-transform font-bold text-[11px]">
                in
              </div>
              <span className="text-[10px] font-semibold">LinkedIn</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#25D366]/20 border border-white/10 hover:border-[#25D366]/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Share via WhatsApp"
            >
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center text-white mb-1 shadow-md shadow-[#25D366]/30 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-3.5 h-3.5 fill-white" />
              </div>
              <span className="text-[10px] font-semibold">WhatsApp</span>
            </button>

            {/* Instagram */}
            <button
              onClick={handleInstagramShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Share to Instagram"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mb-1 shadow-md shadow-pink-500/30 group-hover:scale-110 transition-transform font-bold text-[10px]">
                IG
              </div>
              <span className="text-[10px] font-semibold">Instagram</span>
            </button>

            {/* Telegram */}
            <button
              onClick={handleTelegramShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-[#229ED9]/20 border border-white/10 hover:border-[#229ED9]/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Share to Telegram"
            >
              <div className="w-7 h-7 rounded-full bg-[#229ED9] flex items-center justify-center text-white mb-1 shadow-md shadow-[#229ED9]/30 group-hover:scale-110 transition-transform">
                <Send className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-semibold">Telegram</span>
            </button>

            {/* Email */}
            <button
              onClick={handleEmailShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="Share via Email"
            >
              <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-white mb-1 shadow-md shadow-amber-600/30 group-hover:scale-110 transition-transform">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-semibold">Email</span>
            </button>

            {/* Device Native Share */}
            <button
              onClick={handleNativeShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 hover:bg-brand-gold/20 border border-white/10 hover:border-brand-gold/50 text-neutral-300 hover:text-white transition-all group cursor-pointer"
              title="More Share Options (Device Sheet)"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber flex items-center justify-center text-black mb-1 shadow-md shadow-brand-gold/30 group-hover:scale-110 transition-transform">
                <Share2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-semibold">More...</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 relative z-10">
          <span className="text-[11px] font-mono text-neutral-400">ChanceTEKone Universal Social Suite</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

