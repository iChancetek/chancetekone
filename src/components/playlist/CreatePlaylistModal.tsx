'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Mic,
} from 'lucide-react';
import { Playlist, PlaylistType, PlaylistVisibility } from '@/types/playlist';
import { MediaType } from '@/types/media';
import { PlaylistService, PlaylistMediaInput } from '@/lib/playlist/PlaylistService';
import {
  PLAIN_COLOR_COVERS,
  DEFAULT_PLAIN_COLOR_COVER,
  createPlainColorCoverUrl,
  getPlainColorHex,
  isPlainColorCover,
} from '@/lib/playlist/CoverArtCatalog';
import { CoverArtPickerModal } from '@/components/playlist/CoverArtPickerModal';
import { MOCK_TRACKS, MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';
import { useAuth } from '@/lib/auth/AuthContext';

interface SelectedMedia {
  mediaId: string;
  mediaType: MediaType | 'podcast';
  title: string;
  artistName: string;
  coverUrl: string;
  duration?: number;
  audioUrl?: string;
  videoUrl?: string;
  genre?: string;
}

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newPlaylist: Playlist) => void;
  initialMediaItem?: PlaylistMediaInput;
}

function resolveInitialSelectedMedia(initialMediaItem?: PlaylistMediaInput): SelectedMedia[] {
  if (!initialMediaItem) return [];

  if (initialMediaItem.mediaType === 'podcast') {
    const pod = MediaCatalogService.getAllPodcasts().find((p) => p.id === initialMediaItem.mediaId);
    if (pod) {
      return [
        {
          mediaId: pod.id,
          mediaType: 'podcast',
          title: pod.title,
          artistName: `${pod.showTitle} • ${pod.host}`,
          coverUrl: pod.coverUrl || '/images/studio_cover.jpg',
          duration: pod.duration,
          audioUrl: pod.mediaType === 'video' ? undefined : pod.mediaUrl,
          videoUrl: pod.mediaType === 'video' ? pod.mediaUrl : undefined,
          genre: pod.category,
        },
      ];
    }
  }

  const track =
    MusicCatalogService.getTrackById(initialMediaItem.mediaId) ||
    MOCK_TRACKS.find((t) => t.id === initialMediaItem.mediaId);
  const video =
    MediaCatalogService.getAllVideos().find((v) => v.id === initialMediaItem.mediaId) ||
    MOCK_VIDEOS.find((v) => v.id === initialMediaItem.mediaId);
  const audiobook =
    MediaCatalogService.getAllAudiobooks().find((a) => a.id === initialMediaItem.mediaId) ||
    MOCK_AUDIOBOOKS.find((a) => a.id === initialMediaItem.mediaId);
  const podcast = MediaCatalogService.getAllPodcasts().find((p) => p.id === initialMediaItem.mediaId);

  const item: any = track || video || audiobook || podcast;
  if (item) {
    return [
      {
        mediaId: item.id,
        mediaType: initialMediaItem.mediaType,
        title: item.title,
        artistName: item.artistName || item.author || item.host || initialMediaItem.artistName || '',
        coverUrl: item.coverUrl || item.thumbnailUrl || initialMediaItem.coverUrl || '/images/studio_cover.jpg',
        duration: item.duration ?? initialMediaItem.duration,
        audioUrl: item.audioUrl ?? initialMediaItem.audioUrl,
        videoUrl: item.videoUrl ?? initialMediaItem.videoUrl,
        genre: item.genre || item.category || initialMediaItem.genre,
      },
    ];
  }

  if (initialMediaItem.title) {
    return [
      {
        mediaId: initialMediaItem.mediaId,
        mediaType: initialMediaItem.mediaType,
        title: initialMediaItem.title,
        artistName: initialMediaItem.artistName || 'ChanceTEK One',
        coverUrl: initialMediaItem.coverUrl || '/images/studio_cover.jpg',
        duration: initialMediaItem.duration,
        audioUrl: initialMediaItem.audioUrl,
        videoUrl: initialMediaItem.videoUrl,
        genre: initialMediaItem.genre,
      },
    ];
  }

  return [];
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialMediaItem,
}) => {
  const { profile, user, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PlaylistType>(
    initialMediaItem
      ? initialMediaItem.mediaType === 'podcast'
        ? 'mixed'
        : initialMediaItem.mediaType
      : 'mixed'
  );
  const [visibility, setVisibility] = useState<PlaylistVisibility>(
    profile?.defaultPlaylistVisibility || 'private'
  );
  // Default: automatically use the cover art of the first song in the playlist!
  // Users can also switch to Plain Color (any curated swatch or custom color picker) or custom artwork.
  const [coverMode, setCoverMode] = useState<'first_song' | 'color' | 'custom'>('first_song');
  const [selectedColorUrl, setSelectedColorUrl] = useState<string>(PLAIN_COLOR_COVERS[2].url);
  const [customHexColor, setCustomHexColor] = useState<string>('#6d28d9');
  const [customCoverUrl, setCustomCoverUrl] = useState<string>('');
  const [showCoverPickerModal, setShowCoverPickerModal] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media browser state
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>(() =>
    resolveInitialSelectedMedia(initialMediaItem)
  );
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogType, setCatalogType] = useState<MediaType | 'podcast'>('music');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && initialMediaItem) {
      setSelectedMedia(resolveInitialSelectedMedia(initialMediaItem));
      setType(initialMediaItem.mediaType === 'podcast' ? 'mixed' : initialMediaItem.mediaType);
      setCoverMode('first_song');
    }
  }, [isOpen, initialMediaItem]);

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
    const effectiveOwnerId = profile?.id || user?.uid || (isAdmin ? 'admin' : 'usr-member');
    const effectiveOwnerName = profile?.name || user?.displayName || (isAdmin ? 'Administrator' : 'Platform Member');
    const effectiveOwnerEmail = (profile?.email || user?.email) || undefined;
    const effectiveAvatar = profile?.avatarUrl || user?.photoURL || undefined;

    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const firstSongCover = selectedMedia[0]?.coverUrl || initialMediaItem?.coverUrl;
      const isExplicitCustom = coverMode === 'color' || (coverMode === 'custom' && Boolean(customCoverUrl.trim()));
      const coverUrl =
        coverMode === 'color'
          ? selectedColorUrl
          : coverMode === 'custom' && customCoverUrl.trim()
          ? customCoverUrl.trim()
          : firstSongCover || DEFAULT_PLAIN_COLOR_COVER;

      const initialItems: PlaylistMediaInput[] = selectedMedia.map((m) => ({
        mediaId: m.mediaId,
        mediaType: m.mediaType,
        title: m.title,
        artistName: m.artistName,
        coverUrl: m.coverUrl,
        duration: m.duration,
        audioUrl: m.audioUrl,
        videoUrl: m.videoUrl,
        genre: m.genre,
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
        isCustomCover: isExplicitCustom,
        initialItems,
        sharedWith,
      });

      // Guarantee server/Firestore persistence completes before closing modal so mobile browsers never drop it
      await PlaylistService.syncPlaylistNow(newPl);

      onCreated(newPl);
      onClose();
      // Reset
      setName('');
      setDescription('');
      setType('mixed');
      setVisibility(profile?.defaultPlaylistVisibility || 'private');
      setCoverMode('first_song');
      setCustomCoverUrl('');
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

  const isSelected = (mediaId: string, mediaType: MediaType | 'podcast') =>
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
    if (catalogType === 'podcast') {
      const allPodcasts = MediaCatalogService.getAllPodcasts();
      return allPodcasts.filter((p) => matchesGenericMediaSearch(p, catalogQuery));
    }
    return [];
  };

  const TYPE_OPTIONS: Array<{ id: PlaylistType; label: string; icon: any; desc: string }> = [
    { id: 'mixed', label: 'Mixed Media', icon: Layers, desc: 'Music, Videos & Audiobooks' },
    { id: 'music', label: 'Music Only', icon: Music, desc: 'Songs, Albums & Singles' },
    { id: 'video', label: 'Videos Only', icon: Video, desc: 'Studio Masterclasses & Sessions' },
    { id: 'audiobook', label: 'Audiobooks', icon: BookOpen, desc: 'Chapters & Narratives' },
  ];

  const VISIBILITY_OPTIONS: Array<{ id: PlaylistVisibility; label: string; icon: any; desc: string }> = [
    { id: 'public', label: 'Public', icon: Globe, desc: 'Discoverable by platform members' },
    { id: 'unlisted', label: 'Unlisted', icon: LinkIcon, desc: 'Only people with the link' },
    { id: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you' },
  ];

  const filteredCatalog = getFilteredCatalog();

  return createPortal(
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl glass-panel p-6 sm:p-8 rounded-3xl border border-brand-purple/40 space-y-5 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Create New Playlist
              </h3>
              <p className="text-xs text-neutral-400">
                Build your personal private or public playlists across music, videos, and audiobooks.
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
              placeholder="Tell listeners what makes this playlist special..."
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
              <button
                type="button"
                onClick={() => setCatalogType('podcast')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  catalogType === 'podcast' ? 'bg-brand-purple text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Mic className="w-3 h-3" />
                Podcasts
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
                const artistName =
                  item.artistName ||
                  item.author ||
                  (item.showTitle ? `${item.showTitle} • ${item.host || ''}`.trim() : item.host) ||
                  '';
                const coverUrl = item.coverUrl || item.thumbnailUrl || '/images/studio_cover.jpg';
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
                        duration: item.duration,
                        audioUrl: item.audioUrl || (catalogType === 'podcast' && item.mediaType !== 'video' ? item.mediaUrl : undefined),
                        videoUrl: item.videoUrl || (catalogType === 'podcast' && item.mediaType === 'video' ? item.mediaUrl : undefined),
                        genre: item.genre || item.category,
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
                ? 'Your playlist is public for all members to discover, and you can also share it directly with specific member accounts.'
                : 'Your playlist is private. Only you and the specific members you add here will be able to view and play it.'}
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

          {/* Cover Artwork: First Song Cover (Default) or Plain Color Selector */}
          {(() => {
            const firstSongCover = selectedMedia[0]?.coverUrl || initialMediaItem?.coverUrl;
            const activePreviewUrl =
              coverMode === 'color'
                ? selectedColorUrl
                : coverMode === 'custom' && customCoverUrl.trim()
                ? customCoverUrl.trim()
                : firstSongCover || DEFAULT_PLAIN_COLOR_COVER;

            return (
              <div className="space-y-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-brand-gold" />
                      <span>Playlist Cover</span>
                    </label>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Automatically uses the cover art of your first song — or pick any plain color.
                    </p>
                  </div>

                  {/* Cover Mode Switcher */}
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

                {/* Live Cover Preview */}
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
                        ? firstSongCover
                          ? 'Using First Song Cover Art'
                          : 'Auto: First Song Cover Art'
                        : coverMode === 'color'
                        ? 'Plain Color Playlist Cover'
                        : 'Custom Playlist Cover'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {coverMode === 'first_song'
                        ? firstSongCover
                          ? `Matched to "${selectedMedia[0]?.title || initialMediaItem?.title || 'First track'}". Updates automatically when your first song changes.`
                          : 'Add your first song above (or after creating) and its cover art will appear here automatically.'
                        : coverMode === 'color'
                        ? 'Select any curated solid color swatch or pick a custom plain color below.'
                        : 'Using custom selected artwork.'}
                    </p>
                  </div>
                </div>

                {/* Plain Color Palette & Custom Color Picker */}
                {coverMode === 'color' && (
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
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

                      {/* Custom Any-Color Picker */}
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
                  </div>
                )}
              </div>
            );
          })()}

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
              <span>Create Playlist {selectedMedia.length > 0 && `(${selectedMedia.length} items)`}</span>
            </button>
          </div>
        </form>
      </div>

      {showCoverPickerModal && (
        <CoverArtPickerModal
          isOpen={showCoverPickerModal}
          onClose={() => setShowCoverPickerModal(false)}
          selectedUrl={
            coverMode === 'color'
              ? selectedColorUrl
              : customCoverUrl.trim() || selectedMedia[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER
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
