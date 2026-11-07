'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Copy, Check, Share2, MessageCircle, Send, Users, UserPlus, Trash2, Lock, Globe, ShieldCheck, Mail, Smartphone } from 'lucide-react';
import { Playlist } from '@/types/playlist';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { AdminUserRecord } from '@/types/admin';

interface SharePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
  onUpdated?: (updated: Playlist) => void;
}

export const SharePlaylistModal: React.FC<SharePlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onUpdated,
}) => {
  const { profile, user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'link' | 'members'>('link');
  const [copied, setCopied] = useState(false);
  const [instagramNotice, setInstagramNotice] = useState(false);
  const [sharedList, setSharedList] = useState<string[]>(playlist.sharedWith || []);
  const [memberInput, setMemberInput] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [knownUsers, setKnownUsers] = useState<AdminUserRecord[]>([]);

  const currentEmail = (profile?.email || user?.email) || undefined;
  const currentUserId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');

  const isOwner = Boolean(
    (profile && profile.id === playlist.ownerId) ||
    (user && user.uid === playlist.ownerId) ||
    (currentEmail && playlist.ownerEmail && currentEmail.toLowerCase() === playlist.ownerEmail.toLowerCase())
  );
  const canManage = Boolean(isOwner || isAdmin);

  useEffect(() => {
    setSharedList(playlist.sharedWith || []);
    if (typeof window !== 'undefined') {
      const allUsers = AdminUserManager.getUsers().filter((u: AdminUserRecord) => u.id !== profile?.id);
      setKnownUsers(allUsers);
    }
  }, [playlist, profile?.id]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chancetekone.us';
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local')
  );
  // Canonical public URL required by Facebook, LinkedIn, Twitter crawlers:
  const publicShareUrl = isLocalhost ? `https://chancetekone.us/playlists/${playlist.id}` : `${origin}/playlists/${playlist.id}`;
  const shareUrl = `${origin}/playlists/${playlist.id}`;
  const shareText = `Listen to "${playlist.name}" on ChanceTEK One: ${playlist.description || 'Curated music and media crate.'}`;
  const textMessageBody = `Listen to "${playlist.name}" on ChanceTEK One!

${playlist.description || 'Curated music and media crate.'}

Stream crate here:
${publicShareUrl}`;
  const smsUrl = `sms:?&body=${encodeURIComponent(textMessageBody)}`;
  const [copiedTextMsg, setCopiedTextMsg] = useState(false);

  const handleTextMessageShare = async () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    if (typeof window !== 'undefined') {
      try {
        window.location.href = smsUrl;
      } catch (e) { }
    }
    try {
      await navigator.clipboard.writeText(textMessageBody);
      setCopiedTextMsg(true);
      setTimeout(() => setCopiedTextMsg(false), 3000);
    } catch (e) { }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      PlaylistService.recordPlaylistShare(playlist.id);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: playlist.name,
          text: shareText,
          url: shareUrl,
        });
        PlaylistService.recordPlaylistShare(playlist.id);
      } catch (e) { }
    } else {
      handleCopyLink();
    }
  };

  const handleFacebookShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicShareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleLinkedInShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicShareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  };

  const handleInstagramShare = async () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    // On mobile devices, native share integrates with Instagram app
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: playlist.name,
          text: shareText,
          url: publicShareUrl,
        });
        return;
      } catch (e) {
        // User dismissed sheet or not supported; proceed to copy & web open
      }
    }
    try {
      await navigator.clipboard.writeText(publicShareUrl);
    } catch (err) { }
    setInstagramNotice(true);
    setTimeout(() => setInstagramNotice(false), 4000);
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(publicShareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleWhatsAppShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${publicShareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const url = `https://t.me/share/url?url=${encodeURIComponent(publicShareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    PlaylistService.recordPlaylistShare(playlist.id);
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(playlist.name)}&body=${encodeURIComponent(`${shareText}\n\n${publicShareUrl}`)}`;
    window.location.href = mailtoUrl;
  };

  const handleAddMember = (identifier: string) => {
    if (!currentUserId) return;
    const target = identifier.trim();
    if (!target) return;

    const res = PlaylistService.shareWithUser(playlist.id, currentUserId, target, isAdmin, currentEmail);
    if (res.success && res.sharedWith) {
      setSharedList(res.sharedWith);
      setMemberInput('');
      setMemberError(null);
      if (onUpdated) {
        onUpdated({ ...playlist, sharedWith: res.sharedWith });
      }
    } else {
      setMemberError(res.error || 'Failed to share playlist with this member.');
    }
  };

  const handleRemoveMember = (identifier: string) => {
    if (!currentUserId) return;
    const res = PlaylistService.removeSharedUser(playlist.id, currentUserId, identifier, isAdmin, currentEmail);
    if (res.success && res.sharedWith) {
      setSharedList(res.sharedWith);
      if (onUpdated) {
        onUpdated({ ...playlist, sharedWith: res.sharedWith });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-6 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-purple/30 border border-brand-neon/40 flex items-center justify-center text-brand-neon shadow-md">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Share Playlist</h3>
              <p className="text-xs text-neutral-400 truncate max-w-[260px]">{playlist.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Visible to Creator & Admins) */}
        {canManage && (
          <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'link'
                ? 'bg-brand-purple text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
                }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Social & Links</span>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'members'
                ? 'bg-brand-purple text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
                }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Share with Members ({sharedList.length})</span>
            </button>
          </div>
        )}

        {/* Tab 1: Links & Social */}
        {activeTab === 'link' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Visibility Status Badge */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${playlist.visibility === 'private' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {playlist.visibility === 'private' ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <span className="font-bold text-white capitalize">{playlist.visibility} Crate</span>
                <p className="text-neutral-400 text-[11px]">
                  {playlist.visibility === 'private'
                    ? 'Only you and explicitly invited members can access and play this playlist.'
                    : 'Public to all platform members and guests across Return of the Break Beats.'}
                </p>
              </div>
            </div>

            {/* Copy Link Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Direct Playlist Link
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-neutral-300 select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-violet text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Playlist Preview Card with Authentic Artwork */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5 shadow-inner">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-brand-purple/40 shrink-0 bg-neutral-900 shadow-md">
                <Image
                  src={
                    playlist.coverUrl && !playlist.coverUrl.includes('chancetekone_banner.png') && !playlist.coverUrl.includes('logo.png')
                      ? playlist.coverUrl
                      : '/images/genres/rnb-neo-soul.jpg'
                  }
                  alt={playlist.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-purple/20 text-brand-purple border border-brand-purple/40">
                    Crate & Playlist
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {playlist.items?.length || 0} items
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-sm truncate mt-1">{playlist.name}</h4>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  {playlist.description || 'Curated music and media crate on ChanceTEK One.'}
                </p>
              </div>
            </div>

            {/* Dedicated Text Message (SMS / iMessage) Action Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-purple/10 to-brand-gold/10 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Text Message (SMS & iMessage)</span>
                    {copiedTextMsg && (
                      <span className="text-[10px] text-emerald-400 font-normal">
                        • Copied!
                      </span>
                    )}
                  </h5>
                  <p className="text-[10px] text-neutral-400 truncate">
                    Pre-formatted with crate title, description, and link
                  </p>
                </div>
              </div>

              <button
                onClick={handleTextMessageShare}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer"
                title="Send via Text Message or Copy Formatted SMS"
              >
                {copiedTextMsg ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Send className="w-3.5 h-3.5" />}
                <span>{copiedTextMsg ? 'Ready!' : 'Send Text'}</span>
              </button>
            </div>

            {/* Social Sharing Buttons */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Share to Social Platforms
              </p>

              {instagramNotice && (
                <div className="p-3 rounded-2xl bg-amber-500/20 border border-brand-gold/40 text-brand-gold text-xs font-bold animate-in fade-in duration-200 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-brand-gold" />
                  <span>Link copied! Opening Instagram to share via Story, Post or DM...</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={handleFacebookShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to Facebook"
                >
                  <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span className="text-[11px] font-semibold">Facebook</span>
                </button>

                <button
                  onClick={handleInstagramShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-pink-600/20 border border-white/5 hover:border-pink-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to Instagram"
                >
                  <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                  <span className="text-[11px] font-semibold">Instagram</span>
                </button>

                <button
                  onClick={handleLinkedInShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-sky-600/20 border border-white/5 hover:border-sky-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to LinkedIn"
                >
                  <svg className="w-5 h-5 text-[#0A66C2] fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  <span className="text-[11px] font-semibold">LinkedIn</span>
                </button>

                <button
                  onClick={handleTwitterShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to X / Twitter"
                >
                  <svg className="w-5 h-5 text-sky-400 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span className="text-[11px] font-semibold">X / Twitter</span>
                </button>

                <button
                  onClick={handleWhatsAppShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-emerald-600/20 border border-white/5 hover:border-emerald-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to WhatsApp"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-[11px] font-semibold">WhatsApp</span>
                </button>

                <button
                  onClick={handleTelegramShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer"
                  title="Share to Telegram"
                >
                  <Send className="w-5 h-5 text-blue-400" />
                  <span className="text-[11px] font-semibold">Telegram</span>
                </button>

                <button
                  onClick={handleEmailShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-amber-600/20 border border-white/5 hover:border-amber-500/30 text-neutral-200 hover:text-white transition-all cursor-pointer col-span-2 sm:col-span-2"
                  title="Share via Email"
                >
                  <Mail className="w-5 h-5 text-amber-400" />
                  <span className="text-[11px] font-semibold">Email Link</span>
                </button>
              </div>
            </div>

            {/* Native Web Share Option */}
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                onClick={handleNativeShare}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4 text-brand-gold" />
                <span>Device Share Sheet</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Individual Member Sharing (Creator & Admin Access) */}
        {activeTab === 'members' && canManage && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Grant Private Access to Platform Members
              </label>
              <p className="text-[11px] text-neutral-400">
                Select or type the username or email of any platform member to grant them full private playback access.
              </p>
            </div>

            {/* Add Member Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={memberInput}
                onChange={(e) => {
                  setMemberInput(e.target.value);
                  setMemberError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMember(memberInput);
                }}
                placeholder="Enter member username or email..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
              />
              <button
                onClick={() => handleAddMember(memberInput)}
                disabled={!memberInput.trim()}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase tracking-wider hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Invite</span>
              </button>
            </div>

            {memberError && (
              <p className="text-xs text-red-400">{memberError}</p>
            )}

            {/* Suggested Platform Members */}
            {knownUsers.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Quick Select Active Platform Members:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {knownUsers.map((u) => {
                    const alreadyShared = sharedList.includes(u.id) || sharedList.includes(u.email.toLowerCase());
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleAddMember(u.email)}
                        disabled={alreadyShared}
                        className={`text-[11px] px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${alreadyShared
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 opacity-60'
                          : 'bg-white/5 hover:bg-brand-purple/30 border-white/10 text-neutral-300 hover:text-white cursor-pointer'
                          }`}
                      >
                        <span>{u.name}</span>
                        {alreadyShared ? (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <UserPlus className="w-3 h-3 text-brand-gold" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Currently Shared Members List */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Members With Access ({sharedList.length})
              </span>

              {sharedList.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/5 text-center text-xs text-neutral-400 border border-white/5">
                  No individual members have been granted private access yet.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {sharedList.map((target) => (
                    <div
                      key={target}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-200"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Users className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                        <span className="truncate font-mono">{target}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(target)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
