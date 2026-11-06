'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Save,
  Trash2,
  AlertTriangle,
  Globe,
  Lock,
  Link as LinkIcon,
  Check,
  Layers,
  Music,
  Video,
  BookOpen,
  Shuffle,
  Image as ImageIcon,
  Users,
  UserPlus,
} from 'lucide-react';
import { Playlist, PlaylistType, PlaylistVisibility } from '@/types/playlist';
import { PlaylistService, PRESET_COVERS } from '@/lib/playlist/PlaylistService';
import { getRandomCoverArt } from '@/lib/playlist/CoverArtCatalog';
import { CoverArtPickerModal } from '@/components/playlist/CoverArtPickerModal';
import { useAuth } from '@/lib/auth/AuthContext';

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
  onUpdated: (updated: Playlist) => void;
  onDeleted?: () => void;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onUpdated,
  onDeleted,
}) => {
  const { profile, user, isAdmin } = useAuth();

  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || '');
  const [type, setType] = useState<PlaylistType>(playlist.type);
  const [visibility, setVisibility] = useState<PlaylistVisibility>(playlist.visibility);
  const [selectedCover, setSelectedCover] = useState<string>(playlist.coverUrl);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('');
  const [showCoverPickerModal, setShowCoverPickerModal] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>(playlist.sharedWith || []);
  const [memberInput, setMemberInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMember = () => {
    const val = memberInput.trim();
    if (val && !sharedWith.includes(val)) {
      setSharedWith([...sharedWith, val]);
      setMemberInput('');
    }
  };

  const handleRemoveMember = (member: string) => {
    setSharedWith(sharedWith.filter((m) => m !== member));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
    const currentEmail = (profile?.email || user?.email) || undefined;
    if (!name.trim() || !currentId) return;

    setErrorMessage(null);
    const coverUrl = customCoverUrl.trim() || selectedCover;

    const res = PlaylistService.updatePlaylist(
      playlist.id,
      currentId,
      {
        name: name.trim(),
        description: description.trim(),
        type,
        visibility,
        coverUrl,
        sharedWith,
      },
      isAdmin,
      currentEmail
    );

    if (res.success && res.playlist) {
      onUpdated(res.playlist);
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to update playlist.');
    }
  };

  const handleDelete = () => {
    const currentId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
    const currentEmail = (profile?.email || user?.email) || undefined;
    if (!currentId) return;

    const res = PlaylistService.deletePlaylist(playlist.id, currentId, isAdmin, currentEmail);
    if (res.success) {
      if (onDeleted) onDeleted();
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to delete playlist.');
    }
  };

  const TYPE_OPTIONS: Array<{ id: PlaylistType; label: string; icon: any }> = [
    { id: 'mixed', label: 'Mixed Media', icon: Layers },
    { id: 'music', label: 'Music Only', icon: Music },
    { id: 'video', label: 'Videos Only', icon: Video },
    { id: 'audiobook', label: 'Audiobooks', icon: BookOpen },
  ];

  const VISIBILITY_OPTIONS: Array<{ id: PlaylistVisibility; label: string; icon: any; desc: string }> = [
    { id: 'public', label: 'Public', icon: Globe, desc: 'Visible in crate discovery & playable by all' },
    { id: 'unlisted', label: 'Unlisted', icon: LinkIcon, desc: 'Only people with the link' },
    { id: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you & invited members' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-6 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Edit Crate Playlist
              </h3>
              <p className="text-xs text-neutral-400">
                Update name, cover art, visibility, and member sharing permissions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {showDeleteConfirm ? (
          <div className="space-y-4 p-5 rounded-2xl bg-red-950/50 border border-red-500/50 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Permanently delete "{playlist.name}"?</h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  This crate will be completely removed from your library and community listings. This will NOT delete the original tracks or videos from the platform.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:scale-105 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete Crate</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Playlist Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Playlist Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Description
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold resize-none"
              />
            </div>

            {/* Visibility Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Privacy & Visibility
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = visibility === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVisibility(opt.id)}
                      className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                        isSelected
                          ? 'bg-brand-purple/30 border-brand-neon text-white shadow-md'
                          : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-brand-neon' : 'text-neutral-400'}`} />
                      <div>
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className="text-[9px] text-neutral-400 leading-tight mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Member Sharing Section */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-neon" />
                  <span>Shared Members ({sharedWith.length})</span>
                </label>
              </div>
              <p className="text-[11px] text-neutral-400">
                Enter usernames or emails of members who can access this playlist.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                  placeholder="Enter member email or username..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-neon"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!memberInput.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-neon/20 hover:bg-brand-neon/30 border border-brand-neon/50 text-brand-neon hover:text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {sharedWith.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sharedWith.map((member) => (
                    <span
                      key={member}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white"
                    >
                      <span>{member}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        className="text-neutral-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cover Selector with 100 Artworks Gallery */}
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-brand-gold" />
                    <span>Cover Artwork</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-mono border border-brand-gold/30">
                      100 Curated Arts
                    </span>
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Select from 100 Big Beat, SP-1200 hardware, and crate visuals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCover(getRandomCoverArt())}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
                    title="Choose random cover art"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-brand-gold" />
                    <span>Surprise Me</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCoverPickerModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Browse 100 Covers</span>
                  </button>
                </div>
              </div>

              {/* Current Cover Preview Card */}
              <div className="flex items-center gap-4 pt-1">
                <div
                  onClick={() => setShowCoverPickerModal(true)}
                  className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-gold/60 shadow-lg cursor-pointer group shrink-0"
                >
                  <Image
                    src={customCoverUrl.trim() || selectedCover}
                    alt="Selected Cover"
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                    Change
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 min-w-0">
                  <p className="text-xs font-bold text-white">Active Artwork</p>
                  <p className="text-[11px] text-neutral-400">
                    Click the thumbnail or "Browse 100 Covers" to switch styles.
                  </p>
                  <input
                    type="url"
                    value={customCoverUrl}
                    onChange={(e) => setCustomCoverUrl(e.target.value)}
                    placeholder="Or paste external image URL..."
                    className="w-full max-w-sm px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Crate</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {showCoverPickerModal && (
        <CoverArtPickerModal
          isOpen={showCoverPickerModal}
          onClose={() => setShowCoverPickerModal(false)}
          selectedUrl={customCoverUrl.trim() || selectedCover}
          onSelect={(url) => {
            setSelectedCover(url);
            setCustomCoverUrl('');
          }}
        />
      )}
    </div>
  );
};
