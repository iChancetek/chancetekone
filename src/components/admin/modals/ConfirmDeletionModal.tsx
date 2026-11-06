'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Trash2,
  X,
  ShieldAlert,
  CheckCircle2,
  Music,
  Disc3,
  BookOpen,
  Mic,
  Video,
  Sliders,
  ShoppingBag,
  ListMusic,
} from 'lucide-react';

export type DeletableItemType =
  | 'song'
  | 'album'
  | 'playlist'
  | 'audiobook'
  | 'podcast'
  | 'video'
  | 'producer'
  | 'merch';

export interface DeletableItem {
  id: string;
  type: DeletableItemType;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  meta?: string;
  trackCount?: number;
  price?: number;
}

interface ConfirmDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, options?: { removeAssociatedTracks?: boolean }) => void;
  item: DeletableItem | null;
  isDeleting?: boolean;
}

const TYPE_CONFIG: Record<
  DeletableItemType,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  song: {
    label: 'Music Track',
    icon: Music,
    color: 'text-brand-purple',
    bg: 'bg-brand-purple/20',
    border: 'border-brand-purple/40',
  },
  album: {
    label: 'Album Release',
    icon: Disc3,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/40',
  },
  playlist: {
    label: 'Member / Curator Playlist',
    icon: ListMusic,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
  },
  audiobook: {
    label: 'Audiobook Narrative',
    icon: BookOpen,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
  },
  podcast: {
    label: 'Podcast Episode',
    icon: Mic,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
  },
  video: {
    label: '4K Cinema Video',
    icon: Video,
    color: 'text-rose-400',
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/40',
  },
  producer: {
    label: 'Producer Profile',
    icon: Sliders,
    color: 'text-brand-gold',
    bg: 'bg-brand-gold/20',
    border: 'border-brand-gold/40',
  },
  merch: {
    label: 'Merchandise SKU',
    icon: ShoppingBag,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
  },
};

export const ConfirmDeletionModal: React.FC<ConfirmDeletionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  isDeleting = false,
}) => {
  const [reason, setReason] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [removeAssociatedTracks, setRemoveAssociatedTracks] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setConfirmedCheckbox(false);
      setRemoveAssociatedTracks(true);
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.song;
  const TypeIcon = config.icon;

  const handleConfirm = () => {
    if (!confirmedCheckbox) return;
    const effectiveReason = reason.trim() || `Administrative deletion of ${config.label.toLowerCase()}`;
    onConfirm(effectiveReason, { removeAssociatedTracks });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg p-6 sm:p-7 rounded-3xl glass-panel border border-red-500/50 bg-gradient-to-b from-[#180a1c] via-[#110515] to-[#0a020d] shadow-[0_20px_70px_rgba(239,68,68,0.35)] space-y-5 animate-in zoom-in-95 duration-200 text-left">
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-black uppercase tracking-wider">
                  Irreversible Action
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${config.bg} ${config.color} ${config.border}`}>
                  <TypeIcon className="w-3 h-3" />
                  <span>{config.label}</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Confirm Content Deletion
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Summary Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
          {item.coverUrl ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/15 bg-neutral-900 shrink-0 shadow-md">
              <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
            </div>
          ) : (
            <div className={`w-16 h-16 rounded-xl border flex items-center justify-center shrink-0 ${config.bg} ${config.border} ${config.color}`}>
              <TypeIcon className="w-8 h-8" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-neutral-400">Target Item</span>
              {item.price !== undefined && (
                <span className="text-xs font-mono font-bold text-brand-gold">${item.price.toFixed(2)}</span>
              )}
            </div>
            <h3 className="text-base font-bold text-white truncate">{item.title}</h3>
            {item.subtitle && <p className="text-xs text-neutral-300 truncate">{item.subtitle}</p>}
            {item.meta && <p className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{item.meta}</p>}
            {item.type === 'album' && item.trackCount !== undefined && (
              <p className="text-[11px] text-amber-300 font-mono mt-0.5">
                Contains {item.trackCount} track(s)
              </p>
            )}
          </div>
        </div>

        {/* Impact Warning Notice */}
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-xs text-neutral-300 space-y-1.5">
          <p className="font-bold text-red-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>Platform Impact Notice:</span>
          </p>
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            {item.type === 'song' &&
              'Removing this song immediately takes it off the live platform. It will be moved to the 45-day Recovery Vault for safe quarantine before permanent deletion.'}
            {item.type === 'album' &&
              `Deleting this album will remove the entire collection and move all ${item.trackCount || 0} associated song tracks into the 45-day Recovery Vault.`}
            {item.type === 'playlist' &&
              'Deleting this playlist immediately takes it off all member discovery feeds, public crates, and active queues. It is archived in the 45-day Playlist Recovery Vault for safe restoration anytime.'}
            {item.type === 'audiobook' &&
              'Deleting this audiobook will remove it from all listener libraries, playlists, audio player streams, and search results immediately.'}
            {item.type === 'podcast' &&
              'Deleting this podcast episode will remove audio/video playback and show feeds across the platform immediately.'}
            {item.type === 'video' &&
              'Deleting this 4K video will remove it from the visual cinema showcase and user watch queues immediately.'}
            {item.type === 'producer' &&
              'Deleting this producer profile will remove them from the featured sound engineers roster on the live platform.'}
            {item.type === 'merch' &&
              'Deleting this merchandise item will remove the SKU from the official store, cart checkouts, and customer inventory immediately.'}
          </p>
        </div>

        {/* Producer specific toggle */}
        {item.type === 'producer' && (
          <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-200">
            <input
              type="checkbox"
              checked={removeAssociatedTracks}
              onChange={(e) => setRemoveAssociatedTracks(e.target.checked)}
              className="mt-0.5 rounded border-white/20 text-brand-gold focus:ring-brand-gold"
            />
            <span>
              Also remove all tracks & albums produced or credited to this creator from the live platform
            </span>
          </label>
        )}

        {/* Reason for Deletion */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-neutral-300">
            Reason for Deletion <span className="text-neutral-500 font-normal">(Recorded in Immutable Audit Log)</span>:
          </label>
          <input
            type="text"
            placeholder="e.g. Licensing expiration, creator request, master re-cut, or administrative deprecation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder-neutral-500 focus:border-red-500 focus:outline-none text-xs"
          />
        </div>

        {/* Safety Confirmation Checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
          <input
            type="checkbox"
            checked={confirmedCheckbox}
            onChange={(e) => setConfirmedCheckbox(e.target.checked)}
            className="mt-0.5 rounded border-red-400 text-red-600 focus:ring-red-500 w-4 h-4"
          />
          <span className="font-semibold text-white select-none">
            I confirm that I want to delete{' '}
            <span className="text-red-300 font-bold">&ldquo;{item.title}&rdquo;</span> from the 8 Of Spades platform.
          </span>
        </label>

        {/* Actions Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmedCheckbox || isDeleting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/40 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Confirm Deletion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
