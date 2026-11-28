'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
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
  Image as ImageIcon,
  Users,
  UserPlus,
  ListMusic,
  Eye,
  Edit3,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  Play,
  GripVertical,
  Sparkles,
  Mic,
} from 'lucide-react';
import { Playlist, PlaylistItem, PlaylistType, PlaylistVisibility } from '@/types/playlist';
import { MediaType } from '@/types/media';
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
import { usePlayer } from '@/lib/player/PlayerContext';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { MOCK_VIDEOS, MOCK_AUDIOBOOKS } from '@/lib/mockData';
import { filterAndRankTracks, matchesGenericMediaSearch } from '@/lib/search/universalSearch';

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
  onUpdated: (updated: Playlist) => void;
  onDeleted?: () => void;
  /** Default view: 'songs' (Edit Songs for owner), 'view' (View Songs read-only), or 'details' */
  initialTab?: 'songs' | 'view' | 'details';
}

function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onUpdated,
  onDeleted,
  initialTab,
}) => {
  const { profile, user } = useAuth();
  const { playPlaylist } = usePlayer();

  const currentUserId = profile?.id || user?.uid || '';
  const currentEmail = (profile?.email || user?.email || '').toLowerCase().trim() || undefined;
  // STRICT OWNER-ONLY ENFORCEMENT: only the owner of the playlist can make changes.
  const isOwner = PlaylistService.isPlaylistOwner(playlist, currentUserId, currentEmail);

  const resolvedDefaultTab: 'songs' | 'view' | 'details' = !isOwner
    ? 'view'
    : initialTab || 'songs';

  const [activeTab, setActiveTab] = useState<'songs' | 'view' | 'details'>(resolvedDefaultTab);
  const [livePlaylist, setLivePlaylist] = useState<Playlist>(playlist);
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Add Songs Browser state (Edit Songs tab)
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [addMediaType, setAddMediaType] = useState<MediaType | 'podcast'>('music');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep modal synced when playlist prop changes
  useEffect(() => {
    setLivePlaylist(playlist);
    setName(playlist.name);
    setDescription(playlist.description || '');
    setType(playlist.type);
    setVisibility(playlist.visibility);
    setSharedWith(playlist.sharedWith || []);
    if (!PlaylistService.isPlaylistOwner(playlist, currentUserId, currentEmail)) {
      setActiveTab('view');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [playlist, currentUserId, currentEmail, initialTab]);

  const catalogItems = useMemo(() => {
    if (!showAddSongs) return [];
    if (addMediaType === 'music') {
      return filterAndRankTracks(MusicCatalogService.getAllTracks(), addSearchQuery).slice(0, 40);
    }
    if (addMediaType === 'video') {
      const vids = MediaCatalogService.getAllVideos();
      const list = vids.length > 0 ? vids : MOCK_VIDEOS;
      return list.filter((v) => matchesGenericMediaSearch(v, addSearchQuery)).slice(0, 30);
    }
    if (addMediaType === 'audiobook') {
      const books = MediaCatalogService.getAllAudiobooks();
      const list = books.length > 0 ? books : MOCK_AUDIOBOOKS;
      return list.filter((b) => matchesGenericMediaSearch(b, addSearchQuery)).slice(0, 30);
    }
    if (addMediaType === 'podcast') {
      return MediaCatalogService.getAllPodcasts()
        .filter((p) => matchesGenericMediaSearch(p, addSearchQuery))
        .slice(0, 30);
    }
    return [];
  }, [showAddSongs, addMediaType, addSearchQuery]);

  if (!isOpen || !mounted) return null;

  const refreshLatestPlaylist = async (syncCloud = false) => {
    const res = PlaylistService.getPlaylistById(livePlaylist.id, currentUserId, currentEmail, false);
    if (res.playlist) {
      setLivePlaylist(res.playlist);
      onUpdated(res.playlist);
      if (syncCloud) {
        await PlaylistService.syncPlaylistNow(res.playlist);
      }
    }
  };

  const flashNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice((cur) => (cur === msg ? null : cur)), 2500);
  };

  // ── Song Editing Operations (Owner-Only) ────────────────────────────

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if (!isOwner) {
      setErrorMessage('Only the playlist owner can rearrange songs.');
      return;
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= livePlaylist.items.length) return;

    const reorderedIds = livePlaylist.items.map((it) => it.id);
    const [moved] = reorderedIds.splice(index, 1);
    reorderedIds.splice(target, 0, moved);

    const res = PlaylistService.reorderPlaylistItems(
      livePlaylist.id,
      currentUserId,
      reorderedIds,
      false,
      currentEmail
    );
    if (res.success) {
      setErrorMessage(null);
      await refreshLatestPlaylist(true);
    } else {
      setErrorMessage(res.error || 'Could not reorder songs.');
    }
  };

  const handleDropReorder = async (fromIndex: number, toIndex: number) => {
    if (!isOwner || fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= livePlaylist.items.length || toIndex >= livePlaylist.items.length) {
      return;
    }
    const reorderedIds = livePlaylist.items.map((it) => it.id);
    const [moved] = reorderedIds.splice(fromIndex, 1);
    reorderedIds.splice(toIndex, 0, moved);

    const res = PlaylistService.reorderPlaylistItems(
      livePlaylist.id,
      currentUserId,
      reorderedIds,
      false,
      currentEmail
    );
    if (res.success) {
      setErrorMessage(null);
      await refreshLatestPlaylist(true);
      flashNotice('Updated song order.');
    } else {
      setErrorMessage(res.error || 'Could not reorder songs.');
    }
  };

  const handleRemoveItem = async (item: PlaylistItem) => {
    if (!isOwner) {
      setErrorMessage('Only the playlist owner can delete songs.');
      return;
    }
    const res = PlaylistService.removeItemFromPlaylist(
      livePlaylist.id,
      currentUserId,
      item.id,
      false,
      currentEmail
    );
    if (res.success) {
      setErrorMessage(null);
      await refreshLatestPlaylist(true);
      flashNotice(`Removed "${item.title}" from playlist.`);
    } else {
      setErrorMessage(res.error || 'Could not delete song.');
    }
  };

  const handleAddCatalogItem = async (item: any) => {
    if (!isOwner) {
      setErrorMessage('Only the playlist owner can add songs.');
      return;
    }
    const title = item.title;
    const artistName =
      item.artistName ||
      item.author ||
      (item.showTitle ? `${item.showTitle} • ${item.host || ''}`.trim() : item.host) ||
      'ChanceTEK One';
    const coverUrl = item.coverUrl || item.thumbnailUrl || '/images/studio_cover.jpg';

    const res = PlaylistService.addItemToPlaylist(
      livePlaylist.id,
      currentUserId,
      {
        mediaId: item.id,
        mediaType: addMediaType,
        title,
        artistName,
        coverUrl,
        duration: item.duration,
        audioUrl:
          item.audioUrl ||
          (addMediaType === 'podcast' && item.mediaType !== 'video' ? item.mediaUrl : undefined),
        videoUrl:
          item.videoUrl ||
          (addMediaType === 'podcast' && item.mediaType === 'video' ? item.mediaUrl : undefined),
        genre: item.genre || item.category,
      },
      false,
      currentEmail
    );

    if (res.success) {
      setErrorMessage(null);
      await refreshLatestPlaylist(true);
      flashNotice(`Added "${title}" to playlist.`);
    } else {
      setErrorMessage(res.error || 'Could not add song.');
    }
  };

  // ── Details / Metadata Operations (Owner-Only) ──────────────────────

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

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setErrorMessage('Only the playlist owner can make changes to this playlist.');
      return;
    }
    if (!name.trim() || !currentUserId || isSaving) return;

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const firstSongCover = livePlaylist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER;
      const isExplicitCustom =
        coverMode === 'color' || (coverMode === 'custom' && Boolean(customCoverUrl.trim()));
      const coverUrl =
        coverMode === 'color'
          ? selectedColorUrl
          : coverMode === 'custom' && customCoverUrl.trim()
            ? customCoverUrl.trim()
            : firstSongCover;

      const res = PlaylistService.updatePlaylist(
        livePlaylist.id,
        currentUserId,
        {
          name: name.trim(),
          description: description.trim(),
          type,
          visibility,
          coverUrl,
          isCustomCover: isExplicitCustom,
          sharedWith,
        },
        false,
        currentEmail
      );

      if (res.success && res.playlist) {
        await PlaylistService.syncPlaylistNow(res.playlist);
        setLivePlaylist(res.playlist);
        onUpdated(res.playlist);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update playlist.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlaylist = () => {
    if (!isOwner || !currentUserId) return;
    const res = PlaylistService.deletePlaylist(livePlaylist.id, currentUserId, false, currentEmail);
    if (res.success) {
      if (onDeleted) onDeleted();
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to delete playlist.');
    }
  };

  const VISIBILITY_OPTIONS: Array<{ id: PlaylistVisibility; label: string; icon: any; desc: string }> = [
    { id: 'public', label: 'Public', icon: Globe, desc: 'Visible in playlist discovery & playable by all' },
    { id: 'unlisted', label: 'Unlisted', icon: LinkIcon, desc: 'Only people with the link' },
    { id: 'private', label: 'Private', icon: Lock, desc: 'Only visible to you & invited members' },
  ];

  const hasMusic = livePlaylist.items.some((it) => it.mediaType === 'music');

  return createPortal(
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl glass-panel p-5 sm:p-7 rounded-3xl border border-brand-purple/40 space-y-5 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-brand-gold/40 shrink-0 bg-neutral-900">
              <Image
                src={livePlaylist.coverUrl || DEFAULT_PLAIN_COLOR_COVER}
                alt={livePlaylist.name}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                  {livePlaylist.name}
                </h3>
                {!isOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold text-neutral-300">
                    View Only · Owner: {livePlaylist.ownerName}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                {livePlaylist.items.length} {livePlaylist.items.length === 1 ? 'song' : 'songs'} ·{' '}
                {formatDuration(livePlaylist.totalDuration)} ·{' '}
                <span className="capitalize">{livePlaylist.visibility}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs: Edit Songs (Owner) | View Songs (Everyone) | Details & Cover (Owner) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('songs')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'songs'
                    ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:text-white'
                  }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Songs ({livePlaylist.items.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'view'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-neutral-300 hover:text-white'
                }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Songs ({livePlaylist.items.length})</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'details'
                    ? 'bg-brand-purple text-white shadow-md'
                    : 'text-neutral-300 hover:text-white'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Details &amp; Cover</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {livePlaylist.items.length > 0 && (
              <button
                type="button"
                onClick={() => playPlaylist(livePlaylist)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-brand-gold hover:text-black text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </button>
            )}
            {hasMusic && (
              <Link
                href={`/djchancemix?playlist=${encodeURIComponent(livePlaylist.id)}`}
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-cyan-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                <span>Mix Now</span>
              </Link>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {actionNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: VIEW SONGS (READ-ONLY — AVAILABLE TO ALL USERS & OWNERS) */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'view' && (
          <div className="space-y-3">
            {!isOwner && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] text-neutral-300 flex items-center justify-between gap-2">
                <span>
                  Viewing all songs in <strong>{livePlaylist.name}</strong>. Only the playlist owner ({livePlaylist.ownerName}) can make changes.
                </span>
              </div>
            )}

            {livePlaylist.items.length === 0 ? (
              <div className="py-12 text-center space-y-2 text-neutral-400">
                <ListMusic className="w-9 h-9 mx-auto text-neutral-600" />
                <p className="text-sm font-bold text-white">No songs in this playlist yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto pr-1 rounded-2xl bg-white/[0.02] border border-white/10">
                {livePlaylist.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-mono font-bold text-neutral-400 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                        <Image
                          src={item.coverUrl || '/images/studio_cover.jpg'}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{item.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {item.artistName}
                          {item.genre ? ` · ${item.genre}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-neutral-400">
                        {formatDuration(item.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={() => playPlaylist(livePlaylist, idx)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-brand-gold hover:text-black text-brand-gold transition-colors cursor-pointer"
                        title={`Play "${item.title}"`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: EDIT SONGS (STRICTLY OWNER-ONLY — REORDER, DELETE, ADD)  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'songs' && isOwner && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-300">
                Drag songs or use the up/down arrows to rearrange order, remove tracks, or add new songs.
              </p>
              <button
                type="button"
                onClick={() => setShowAddSongs((v) => !v)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${showAddSongs
                    ? 'bg-brand-gold text-black border-brand-gold'
                    : 'bg-brand-purple/25 hover:bg-brand-purple/40 text-white border-brand-purple/50'
                  }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddSongs ? 'Hide Catalog Picker' : 'Add Songs'}</span>
              </button>
            </div>

            {/* Inline Add Songs Catalog Picker */}
            {showAddSongs && (
              <div className="p-4 rounded-2xl bg-black/50 border border-brand-gold/30 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['music', 'video', 'audiobook', 'podcast'] as const).map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setAddMediaType(mt)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold capitalize cursor-pointer flex items-center gap-1 ${addMediaType === mt
                          ? 'bg-brand-gold text-black'
                          : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                        }`}
                    >
                      {mt === 'music' && <Music className="w-3 h-3" />}
                      {mt === 'video' && <Video className="w-3 h-3" />}
                      {mt === 'audiobook' && <BookOpen className="w-3 h-3" />}
                      {mt === 'podcast' && <Mic className="w-3 h-3" />}
                      <span>{mt}</span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    placeholder={`Search ${addMediaType} to add to "${livePlaylist.name}"...`}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-gold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {catalogItems.map((item: any) => {
                    const alreadyIn = livePlaylist.items.some((it) => it.mediaId === item.id);
                    const cover = item.coverUrl || item.thumbnailUrl || '/images/studio_cover.jpg';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={alreadyIn}
                        onClick={() => void handleAddCatalogItem(item)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-left transition-all ${alreadyIn
                            ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200 opacity-80 cursor-default'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white cursor-pointer'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-neutral-900">
                            <Image src={cover} alt={item.title} fill unoptimized className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{item.title}</p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {item.artistName || item.author || item.host || 'ChanceTEK One'}
                            </p>
                          </div>
                        </div>
                        <span className="p-1 rounded-lg bg-white/10 shrink-0">
                          {alreadyIn ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-brand-gold" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Playlist Songs List with Rearrange, Up/Down & Delete */}
            {livePlaylist.items.length === 0 ? (
              <div className="py-10 text-center space-y-2 rounded-2xl bg-white/[0.02] border border-white/10">
                <ListMusic className="w-9 h-9 mx-auto text-neutral-500" />
                <p className="text-sm font-bold text-white">No songs in this playlist yet</p>
                <button
                  type="button"
                  onClick={() => setShowAddSongs(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-gold text-black text-xs font-extrabold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Your First Song</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto pr-1 rounded-2xl bg-white/[0.02] border border-white/10">
                {livePlaylist.items.map((item, idx) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null) {
                        void handleDropReorder(dragIdx, idx);
                        setDragIdx(null);
                      }
                    }}
                    onDragEnd={() => setDragIdx(null)}
                    className={`p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-all ${dragIdx === idx ? 'bg-brand-gold/15 border border-brand-gold/40' : 'hover:bg-white/[0.04]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="text-neutral-500 hover:text-brand-gold cursor-grab active:cursor-grabbing shrink-0"
                        title="Drag to rearrange song order"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="w-5 text-center text-xs font-mono font-bold text-brand-gold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                        <Image
                          src={item.coverUrl || '/images/studio_cover.jpg'}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">{item.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {item.artistName} · {formatDuration(item.duration)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleMoveItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move song up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMoveItem(idx, 'down')}
                        disabled={idx === livePlaylist.items.length - 1}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move song down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveItem(item)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/25 text-neutral-400 hover:text-red-400 cursor-pointer"
                        title="Delete song from playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[11px] text-neutral-400">
                Changes save &amp; sync automatically to your playlist.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-amber-500 text-black text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: PLAYLIST DETAILS, VISIBILITY, COVER & DELETE (OWNER)     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'details' && isOwner && (
          <>
            {showDeleteConfirm ? (
              <div className="space-y-4 p-5 rounded-2xl bg-red-950/50 border border-red-500/50 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white">
                      Permanently delete &ldquo;{livePlaylist.name}&rdquo;?
                    </h4>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      This playlist will be removed from your Library and member listings. Original tracks on the platform are NOT affected.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeletePlaylist}
                    className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete Playlist</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitDetails} className="space-y-5">
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
                    Privacy &amp; Visibility
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
                          className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${isSelected
                              ? 'bg-brand-purple/30 border-brand-neon text-white shadow-md'
                              : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white'
                            }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-brand-neon' : 'text-neutral-400'
                              }`}
                          />
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
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-neon" />
                    <span>Shared Members ({sharedWith.length})</span>
                  </label>
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
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-brand-neon"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={!memberInput.trim()}
                      className="px-3.5 py-2 rounded-xl bg-brand-neon/20 hover:bg-brand-neon/30 border border-brand-neon/40 text-brand-neon text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
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
                            className="text-neutral-400 hover:text-red-400 cursor-pointer"
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
                  const firstSongCover = livePlaylist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER;
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
                            Defaults to the first song&apos;s cover art — or choose any plain color.
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setCoverMode('first_song')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${coverMode === 'first_song'
                                ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black border-brand-gold shadow-md'
                                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                              }`}
                          >
                            First Song Cover
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverMode('color')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${coverMode === 'color'
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
                              ? livePlaylist.items[0]
                                ? `Matched to "${livePlaylist.items[0].title}". Updates automatically when track #1 changes.`
                                : 'Will automatically display the cover art of the first song you add.'
                              : coverMode === 'color'
                                ? 'Pick any curated plain color swatch or custom hex color below.'
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
                                style={{ backgroundColor: swatch.hex }}
                                className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer ${isPicked
                                    ? 'border-brand-gold scale-110 ring-2 ring-brand-gold/50 shadow-lg'
                                    : 'border-white/25 hover:scale-105 hover:border-white/70'
                                  }`}
                              >
                                {isPicked && (
                                  <Check
                                    className={`w-4 h-4 stroke-[3] ${swatch.hex === '#e5e5e0' ? 'text-black' : 'text-white'
                                      }`}
                                  />
                                )}
                              </button>
                            );
                          })}

                          <label className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-neutral-200 cursor-pointer">
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

                {/* Footer Actions */}
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
                      className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!name.trim() || isSaving}
                      className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {showCoverPickerModal && isOwner && (
        <CoverArtPickerModal
          isOpen={showCoverPickerModal}
          onClose={() => setShowCoverPickerModal(false)}
          selectedUrl={
            coverMode === 'color'
              ? selectedColorUrl
              : customCoverUrl.trim() || livePlaylist.items[0]?.coverUrl || DEFAULT_PLAIN_COLOR_COVER
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
