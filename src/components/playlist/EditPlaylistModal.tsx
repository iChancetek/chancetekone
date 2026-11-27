'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import {
  PLAIN_COLOR_COVERS,
  DEFAULT_PLAIN_COLOR_COVER,
  createPlainColorCoverUrl,
  getPlainColorHex,
  isPlainColorCover,
} from '@/lib/playlist/CoverArtCatalog';
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
  const initialIsColor =
    isPlainColorCover(playlist.coverUrl) &&
    (playlist.isCustomCover === true ||
      (playlist.isCustomCover !== false && playlist.coverUrl !== DEFAULT_PLAIN_COLOR_COVER));
  const initialMode: 'first_song' | 'color' | 'custom' = initialIsColor
    ? 'color'
    : playlist.isCustomCover
    ? 'custom'
    : 'first_song';
  const [coverMode, setCoverMode] = useState<'first_song' | 'color' | 'custom'>(initialMode);
  const [selectedColorUrl, setSelectedColorUrl] = useState<string>(
    initialIsColor ? playlist.coverUrl : PLAIN_COLOR_COVERS[2].url
  );
  const [customHexColor, setCustomHexColor] = useState<string>(
    getPlainColorHex(playlist.coverUrl) || '#6d28d9'
  );
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(
    initialMode === 'custom' ? playlist.coverUrl : ''
  );
  const [showCoverPickerModal, setShowCoverPickerModal] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>(playlist.sharedWith || []);
  const [memberInput, setMemberInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentId = profile?.id || user?.uid || (isAdmin ? 'admin' : '');
    const currentEmail = (profile?.email || user?.email) || undefined;
    if (!name.trim() || !currentId || isSaving) return;

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const firstSongCover = playlist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER;
      const isExplicitCustom = coverMode === 'color' || (coverMode === 'custom' && Boolean(customCoverUrl.trim()));
      const coverUrl =
        coverMode === 'color'
          ? selectedColorUrl
          : coverMode === 'custom' && customCoverUrl.trim()
          ? customCoverUrl.trim()
          : firstSongCover;

      const res = PlaylistService.updatePlaylist(
        playlist.id,
        currentId,
        {
          name: name.trim(),
          description: description.trim(),
          type,
          visibility,
          coverUrl,
          isCustomCover: isExplicitCustom,
          sharedWith,
        },
        isAdmin,
        currentEmail
      );

      if (res.success && res.playlist) {
        await PlaylistService.syncPlaylistNow(res.playlist);
        onUpdated(res.playlist);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update playlist.');
      }
    } finally {
      setIsSaving(false);
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
    { id: 'public', label: 'Public', icon: Globe, desc: 'Visible in playlist discovery & playable by all' },
    { id: 'unlisted', label: 'Unlisted', icon: LinkIcon, desc: 'Only people with the link' },
    { id: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you & invited members' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-6 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Edit Playlist
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
                  This playlist will be completely removed from your Library and member listings. This will NOT delete the original tracks or videos from the platform.
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
                <span>Confirm Delete Playlist</span>
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

            {/* Cover Selector: First Song Cover (Default) or Plain Color */}
            {(() => {
              const firstSongCover = playlist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER;
              const activePreviewUrl =
                coverMode === 'color'
                  ? selectedColorUrl
                  : coverMode === 'custom' && customCoverUrl.trim()
                  ? customCoverUrl.trim()
                  : firstSongCover;

              return (
                <div className="space-y-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-brand-gold" />
                        <span>Playlist Cover</span>
                      </label>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Use the cover art of the first song in this playlist — or select a plain color.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setCoverMode('first_song')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          coverMode === 'first_song'
                            ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black border-brand-gold shadow-md'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                        }`}
                      >
                        First Song Cover
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverMode('color')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          coverMode === 'color'
                            ? 'bg-brand-purple text-white border-brand-neon shadow-md'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                        }`}
                      >
                        Plain Color
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCoverPickerModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
                      >
                        More
                      </button>
                    </div>
                  </div>

                  {/* Current Cover Preview Card */}
                  <div className="flex items-center gap-4 pt-1">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-gold/60 shadow-lg shrink-0 bg-[#0d0d16]">
                      <Image
                        src={activePreviewUrl}
                        alt="Selected Cover"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-xs font-bold text-white">
                        {coverMode === 'first_song'
                          ? 'Using First Song Cover Art'
                          : coverMode === 'color'
                          ? 'Plain Color Playlist Cover'
                          : 'Custom Playlist Cover'}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {coverMode === 'first_song'
                          ? playlist.items[0]
                            ? `Matched to "${playlist.items[0].title}". Updates automatically when track #1 changes.`
                            : 'Will automatically display the cover art of the first song you add.'
                          : coverMode === 'color'
                          ? 'Pick any solid color swatch or custom hex color below.'
                          : 'Using custom selected artwork.'}
                      </p>
                    </div>
                  </div>

                  {coverMode === 'color' && (
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                      {PLAIN_COLOR_COVERS.map((swatch) => {
                        const isPicked = selectedColorUrl === swatch.url;
                        return (
                          <button
                            key={swatch.id}
                            type="button"
                            onClick={() => {
                              setSelectedColorUrl(swatch.url);
                              setCustomHexColor(swatch.hex);
                            }}
                            title={swatch.name}
                            aria-label={`Select ${swatch.name} plain color`}
                            style={{ backgroundColor: swatch.hex }}
                            className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer ${
                              isPicked
                                ? 'border-brand-gold scale-110 ring-2 ring-brand-gold/50 shadow-lg'
                                : 'border-white/25 hover:scale-105 hover:border-white/70'
                            }`}
                          >
                            {isPicked && (
                              <Check
                                className={`w-4 h-4 stroke-[3] ${
                                  swatch.hex === '#e5e5e0' ? 'text-black' : 'text-white'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}

                      <label
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-neutral-200 cursor-pointer"
                        title="Pick any custom plain color"
                      >
                        <input
                          type="color"
                          value={customHexColor}
                          onChange={(e) => {
                            const hex = e.target.value;
                            setCustomHexColor(hex);
                            setSelectedColorUrl(createPlainColorCoverUrl(hex));
                          }}
                          className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                        />
                        <span>Custom</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Playlist</span>
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
          selectedUrl={
            coverMode === 'color'
              ? selectedColorUrl
              : customCoverUrl.trim() || playlist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER
          }
          onSelect={(url) => {
            if (isPlainColorCover(url)) {
              setCoverMode('color');
              setSelectedColorUrl(url);
              const hex = getPlainColorHex(url);
              if (hex) setCustomHexColor(hex);
              setCustomCoverUrl('');
            } else {
              setCoverMode('custom');
              setCustomCoverUrl(url);
            }
          }}
        />
      )}
    </div>,
    document.body
  );
};
