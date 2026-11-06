'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  X,
  Plus,
  Sparkles,
  Music,
  Video,
  BookOpen,
  Layers,
  Globe,
  Lock,
  Link as LinkIcon,
  Check,
  Search,
  Minus,
  Shuffle,
  Image as ImageIcon,
  Users,
  UserPlus,
} from 'lucide-react';
import { Playlist, PlaylistType, PlaylistVisibility } from '@/types/playlist';
import { MediaType } from '@/types/media';
import { PlaylistService, PRESET_COVERS } from '@/lib/playlist/PlaylistService';
import { getRandomCoverArt } from '@/lib/playlist/CoverArtCatalog';
import { CoverArtPickerModal } from '@/components/playlist/CoverArtPickerModal';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';
import { useAuth } from '@/lib/auth/AuthContext';

interface SelectedMedia {
  mediaId: string;
  mediaType: MediaType;
  title: string;
  artistName: string;
  coverUrl: string;
}

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newPlaylist: Playlist) => void;
  initialMediaItem?: { mediaId: string; mediaType: MediaType };
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialMediaItem,
}) => {
  const { profile, user, isAdmin } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PlaylistType>(
    initialMediaItem ? initialMediaItem.mediaType : 'mixed'
  );
  const [visibility, setVisibility] = useState<PlaylistVisibility>('public');
  const [selectedCover, setSelectedCover] = useState<string>(PRESET_COVERS[0]);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('');
  const [showCoverPickerModal, setShowCoverPickerModal] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media browser state
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>(() => {
    if (initialMediaItem) {
      const track =
        MusicCatalogService.getTrackById(initialMediaItem.mediaId) ||
        MOCK_TRACKS.find((t) => t.id === initialMediaItem.mediaId);
      const video = MOCK_VIDEOS.find((v) => v.id === initialMediaItem.mediaId);
      const audiobook = MOCK_AUDIOBOOKS.find((a) => a.id === initialMediaItem.mediaId);
      const item = track || video || audiobook;
      if (item) {
        return [
          {
            mediaId: item.id,
            mediaType: initialMediaItem.mediaType,
            title: item.title,
            artistName: 'artistName' in item ? item.artistName : ('author' in item ? item.author : ''),
            coverUrl: 'coverUrl' in item ? item.coverUrl : ('thumbnailUrl' in item ? (item as any).thumbnailUrl : '/images/logo.png'),
          },
        ];
      }
    }
    return [];
  });
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogType, setCatalogType] = useState<MediaType>('music');

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
    const effectiveOwnerId = profile?.id || user?.uid || (isAdmin ? 'admin' : 'usr-member');
    const effectiveOwnerName = profile?.name || user?.displayName || (isAdmin ? 'Administrator' : 'Platform Member');
    const effectiveOwnerEmail = (profile?.email || user?.email) || undefined;
    const effectiveAvatar = profile?.avatarUrl || user?.photoURL || undefined;

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const coverUrl = customCoverUrl.trim() || selectedCover;
      const initialItems = selectedMedia.map((m) => ({
        mediaId: m.mediaId,
        mediaType: m.mediaType,
      }));

      const newPl = PlaylistService.createPlaylist({
        ownerId: effectiveOwnerId,
        ownerName: effectiveOwnerName,
        ownerEmail: effectiveOwnerEmail,
        ownerAvatarUrl: effectiveAvatar,
        name: name.trim(),
        description: description.trim(),
        type,
        visibility,
        coverUrl,
        initialItems,
        sharedWith,
      });

      onCreated(newPl);
      onClose();
      // Reset
      setName('');
      setDescription('');
      setType('mixed');
      setVisibility('public');
      setSelectedMedia([]);
      setSharedWith([]);
      setMemberInput('');
    } catch (err) {
      console.error('Error creating playlist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMediaSelection = (item: SelectedMedia) => {
    setSelectedMedia((prev) => {
      const exists = prev.find((m) => m.mediaId === item.mediaId && m.mediaType === item.mediaType);
      if (exists) {
        return prev.filter((m) => !(m.mediaId === item.mediaId && m.mediaType === item.mediaType));
      }
      return [...prev, item];
    });
  };

  const isSelected = (mediaId: string, mediaType: MediaType) =>
    selectedMedia.some((m) => m.mediaId === mediaId && m.mediaType === mediaType);

  const getFilteredCatalog = () => {
    if (catalogType === 'music') {
      return filterAndRankTracks(MusicCatalogService.getAllTracks(), catalogQuery);
    }
    if (catalogType === 'video') {
      const allVideos = MediaCatalogService.getAllVideos();
      const list = allVideos.length > 0 ? allVideos : MOCK_VIDEOS;
      return list.filter((v) => matchesGenericMediaSearch(v, catalogQuery));
    }
    if (catalogType === 'audiobook') {
      const allBooks = MediaCatalogService.getAllAudiobooks();
      const list = allBooks.length > 0 ? allBooks : MOCK_AUDIOBOOKS;
      return list.filter((b) => matchesGenericMediaSearch(b, catalogQuery));
    }
    return [];
  };

  const TYPE_OPTIONS: Array<{ id: PlaylistType; label: string; icon: any; desc: string }> = [
    { id: 'mixed', label: 'Mixed Media', icon: Layers, desc: 'Music, Videos & Audiobooks' },
    { id: 'music', label: 'Music Only', icon: Music, desc: 'Tracks, Beats & Breakcuts' },
    { id: 'video', label: 'Videos Only', icon: Video, desc: 'Studio Masterclasses & Sessions' },
    { id: 'audiobook', label: 'Audiobooks', icon: BookOpen, desc: 'Chapters & Narratives' },
  ];

  const VISIBILITY_OPTIONS: Array<{ id: PlaylistVisibility; label: string; icon: any; desc: string }> = [
    { id: 'public', label: 'Public', icon: Globe, desc: 'Visible in crate discovery' },
    { id: 'unlisted', label: 'Unlisted', icon: LinkIcon, desc: 'Only people with the link' },
    { id: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you' },
  ];

  const filteredCatalog = getFilteredCatalog();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-5 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Create New Crate Playlist
              </h3>
              <p className="text-xs text-neutral-400">
                Curate custom breakbeat collections and sound sequences.
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Playlist Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
              <span>Playlist Name <span className="text-red-400">*</span></span>
              <span className="text-[10px] text-neutral-400 font-normal">{name.length}/80</span>
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Late Night 12-Bit SP-1200 Sessions"
              className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
              <span>Description <span className="text-neutral-400 text-[10px] normal-case">(Optional)</span></span>
              <span className="text-[10px] text-neutral-400 font-normal">{description.length}/300</span>
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell listeners what makes this crate special..."
              className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all resize-none"
            />
          </div>

          {/* Playlist Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Media Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setType(opt.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isActive
                        ? 'bg-brand-purple/30 border-brand-gold text-white shadow-md'
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-2 ${isActive ? 'text-brand-gold' : 'text-neutral-400'}`} />
                    <div>
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[9px] text-neutral-400 leading-tight mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== MEDIA BROWSER ===== */}
          <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                Add Media to Playlist
              </label>
              {selectedMedia.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                  {selectedMedia.length} selected
                </span>
              )}
            </div>

            {/* Catalog type tabs */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
              <button
                type="button"
                onClick={() => setCatalogType('music')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  catalogType === 'music' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Music className="w-3 h-3" />
                Music
              </button>
              <button
                type="button"
                onClick={() => setCatalogType('video')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  catalogType === 'video' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Video className="w-3 h-3" />
                Videos
              </button>
              <button
                type="button"
                onClick={() => setCatalogType('audiobook')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  catalogType === 'audiobook' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                Audiobooks
              </button>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder={`Search ${catalogType} catalog...`}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-purple transition-all"
              />
            </div>

            {/* Catalog items grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredCatalog.map((item: any) => {
                const mediaId = item.id;
                const title = item.title;
                const artistName = item.artistName || item.author || '';
                const coverUrl = item.coverUrl || item.thumbnailUrl || '/images/logo.png';
                const selected = isSelected(mediaId, catalogType);

                return (
                  <button
                    key={mediaId}
                    type="button"
                    onClick={() =>
                      toggleMediaSelection({
                        mediaId,
                        mediaType: catalogType,
                        title,
                        artistName,
                        coverUrl,
                      })
                    }
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all text-left ${
                      selected
                        ? 'bg-brand-purple/30 border-brand-gold shadow-sm'
                        : 'bg-white/5 border-white/5 hover:border-brand-purple/30 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/10">
                        <Image src={coverUrl} alt={title} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{title}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{artistName}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        selected
                          ? 'bg-brand-gold text-black'
                          : 'border border-white/20'
                      }`}
                    >
                      {selected ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <Plus className="w-3 h-3 text-neutral-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected items preview */}
            {selectedMedia.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Selected ({selectedMedia.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMedia.map((m) => (
                    <button
                      key={`${m.mediaType}-${m.mediaId}`}
                      type="button"
                      onClick={() => toggleMediaSelection(m)}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-brand-purple/30 border border-brand-purple/50 text-[10px] font-semibold text-white hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 transition-all group"
                      title={`Remove "${m.title}"`}
                    >
                      <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0">
                        <Image src={m.coverUrl} alt={m.title} fill className="object-cover" />
                      </div>
                      <span className="truncate max-w-[100px]">{m.title}</span>
                      <Minus className="w-3 h-3 text-neutral-400 group-hover:text-red-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visibility Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Privacy & Visibility
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = visibility === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVisibility(opt.id)}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      isActive
                        ? 'bg-brand-purple/30 border-brand-neon text-white'
                        : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-neon' : 'text-neutral-400'}`} />
                    <div>
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[9px] text-neutral-400 leading-tight">{opt.desc}</p>
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
                <span>Share with Members <span className="text-[10px] normal-case text-neutral-400">(Optional)</span></span>
              </label>
              {sharedWith.length > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-neon/20 text-brand-neon border border-brand-neon/40">
                  {sharedWith.length} shared
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              {visibility === 'public'
                ? 'Your crate is public for all users to discover, but you can also explicitly share it to member accounts.'
                : 'Your crate is private. Only you and the specific members you add here will be able to view and play it.'}
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

          {/* Cover Artwork with 100 Covers Gallery */}
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
                  Choose from 100 Big Beat, hardware samplers, and vinyl crate covers.
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
                <p className="text-xs font-bold text-white">Selected Crate Artwork</p>
                <p className="text-[11px] text-neutral-400">
                  Click the artwork or "Browse 100 Covers" to explore Big Beat, Turntablism, SP-1200, and Neon categories.
                </p>
                <div className="flex items-center gap-2">
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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-7 py-3 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.55)] border-2 border-white/60 hover:scale-105 hover:shadow-[0_0_35px_rgba(245,158,11,0.85)] transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-black fill-current" />
              <span>Create Crate {selectedMedia.length > 0 && `(${selectedMedia.length} items)`}</span>
            </button>
          </div>
        </form>
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
