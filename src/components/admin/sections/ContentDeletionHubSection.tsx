'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  Music,
  Disc3,
  BookOpen,
  Mic,
  Video,
  Sliders,
  ShoppingBag,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Sparkles,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { useAuth } from '@/lib/auth/AuthContext';
import { AdminRole } from '@/types/admin';
import {
  ConfirmDeletionModal,
  DeletableItem,
  DeletableItemType,
} from '../modals/ConfirmDeletionModal';
import { BulkDeletionModal } from '../modals/BulkDeletionModal';
import { Track, Album, Producer, Video as VideoItem, Audiobook, PodcastEpisode } from '@/types/media';
import { Product } from '@/types/commerce';
import { Playlist } from '@/types/playlist';

type FilterType = 'all' | 'song' | 'album' | 'playlist' | 'audiobook' | 'podcast' | 'video' | 'producer' | 'merch';

export const ContentDeletionHubSection: React.FC = () => {
  const { profile } = useAuth();

  // Live collections
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [audiobooks, setAudiobooks] = useState<Audiobook[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastEpisode[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Search, filter & sort
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<'title' | 'type'>('type');

  // Multi-select bulk deletion state
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);

  // Deletion modal & feedback state
  const [selectedItemToDelete, setSelectedItemToDelete] = useState<DeletableItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sync all live collections
  const syncAll = () => {
    setTracks(MusicCatalogService.getAllTracks());
    setAlbums(MusicCatalogService.getAllAlbums());
    setAudiobooks(MediaCatalogService.getAllAudiobooks());
    setPodcasts(MediaCatalogService.getAllPodcasts());
    setVideos(MediaCatalogService.getAllVideos());
    setProducers(ProducerCatalogService.getAllProducers());
    setProducts(MerchCatalogService.getAllProducts());
    setPlaylists(PlaylistService.getAllPlaylists());
  };

  useEffect(() => {
    syncAll();

    const unsubMusic = MusicCatalogService.subscribe(syncAll);
    const unsubMedia = MediaCatalogService.subscribe(syncAll);
    const unsubProducers = ProducerCatalogService.subscribe(syncAll);
    const unsubMerch = MerchCatalogService.subscribe(syncAll);
    const unsubPlaylists = PlaylistService.subscribe(syncAll);

    window.addEventListener('catalog-updated', syncAll);
    window.addEventListener('media-catalog-updated', syncAll);
    window.addEventListener('producers-updated', syncAll);
    window.addEventListener('merch-catalog-updated', syncAll);
    window.addEventListener('playlists-updated', syncAll);

    return () => {
      unsubMusic();
      unsubMedia();
      unsubProducers();
      unsubMerch();
      unsubPlaylists();
      window.removeEventListener('catalog-updated', syncAll);
      window.removeEventListener('media-catalog-updated', syncAll);
      window.removeEventListener('producers-updated', syncAll);
      window.removeEventListener('merch-catalog-updated', syncAll);
      window.removeEventListener('playlists-updated', syncAll);
    };
  }, []);

  // Standardize items into a unified DeletableItem array
  const allItems: DeletableItem[] = [
    ...tracks.map((t) => ({
      id: t.id,
      type: 'song' as const,
      title: t.title,
      subtitle: `${t.artistName} • ${t.albumTitle || 'Single'}`,
      coverUrl: t.coverUrl,
      meta: `${t.genre} • ${Math.floor((t.duration || 180) / 60)}:${String((t.duration || 180) % 60).padStart(2, '0')} min • ${(t.playCount || 0).toLocaleString()} plays`,
    })),
    ...playlists.map((pl) => ({
      id: pl.id,
      type: 'playlist' as const,
      title: pl.name,
      subtitle: `Curated by ${pl.ownerName} • ${pl.visibility.toUpperCase()}`,
      coverUrl: pl.coverUrl,
      meta: `${pl.itemCount} items • ${Math.round(pl.totalDuration / 60)} mins • ${(pl.stats?.plays || 0).toLocaleString()} plays`,
    })),
    ...albums.map((a) => ({
      id: a.id,
      type: 'album' as const,
      title: a.title,
      subtitle: `${a.artistName} • ${a.genre || 'Music'}`,
      coverUrl: a.coverUrl,
      meta: `${a.trackIds?.length || 0} Tracks • Release ${a.releaseYear || 2026}`,
      trackCount: a.trackIds?.length || 0,
    })),
    ...audiobooks.map((b) => ({
      id: b.id,
      type: 'audiobook' as const,
      title: b.title,
      subtitle: `By ${b.author} • Narrated by ${b.narrator}`,
      coverUrl: b.coverUrl,
      meta: `${b.chapters?.length || 0} Chapters • ${Math.round((b.duration || 0) / 3600)} hrs • Rating: ${b.rating || 5.0}`,
    })),
    ...podcasts.map((p) => ({
      id: p.id,
      type: 'podcast' as const,
      title: p.title,
      subtitle: `${p.showTitle} • Host: ${p.host}`,
      coverUrl: p.coverUrl,
      meta: `${p.category} • ${Math.floor((p.duration || 0) / 60)} mins • ${(p.playCount || 0).toLocaleString()} streams`,
    })),
    ...videos.map((v) => ({
      id: v.id,
      type: 'video' as const,
      title: v.title,
      subtitle: `${v.artistName} • ${v.category}`,
      coverUrl: v.thumbnailUrl,
      meta: `4K Cinema • ${Math.floor((v.duration || 0) / 60)}:${String((v.duration || 0) % 60).padStart(2, '0')} • ${(v.views || 0).toLocaleString()} views`,
    })),
    ...producers.map((p) => ({
      id: p.id,
      type: 'producer' as const,
      title: p.name,
      subtitle: `${p.handle} • ${p.role}`,
      coverUrl: p.avatarUrl,
      meta: `Signature BPM: ${p.signatureBpmRange} • ${p.credits?.length || 0} credits • ${p.label}`,
    })),
    ...products.map((m) => ({
      id: m.id,
      type: 'merch' as const,
      title: m.title,
      subtitle: `${m.category.toUpperCase()} • $${m.price.toFixed(2)}`,
      coverUrl: m.images[0],
      meta: `${m.inStock ? 'In Stock' : 'Out of Stock'} • Currency: ${m.currency}`,
      price: m.price,
    })),
  ];

  // Filtering & searching
  const filteredItems = allItems.filter((item) => {
    if (activeFilter !== 'all' && item.type !== activeFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.meta && item.meta.toLowerCase().includes(q)) ||
      item.id.toLowerCase().includes(q)
    );
  });

  // Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return a.type.localeCompare(b.type);
  });

  // Multi-selection handlers
  const handleToggleSelect = (itemKey: string) => {
    const next = new Set(selectedItemKeys);
    if (next.has(itemKey)) next.delete(itemKey);
    else next.add(itemKey);
    setSelectedItemKeys(next);
  };

  const handleSelectAll = () => {
    if (selectedItemKeys.size === sortedItems.length && sortedItems.length > 0) {
      setSelectedItemKeys(new Set());
    } else {
      setSelectedItemKeys(new Set(sortedItems.map((it) => `${it.type}:${it.id}`)));
    }
  };

  const handleClearSelection = () => {
    setSelectedItemKeys(new Set());
  };

  // Handle Confirmed Deletion
  const handleConfirmDeletion = (reason: string, options?: { removeAssociatedTracks?: boolean }) => {
    if (!selectedItemToDelete) return;
    setIsDeleting(true);

    const adminActor: { id: string; name: string; email: string; role: AdminRole } = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@8ofspadesworks.com',
      role: 'admin',
    };

    const item = selectedItemToDelete;

    try {
      if (item.type === 'song') {
        MusicCatalogService.removeTrack(item.id, adminActor, reason);
        setFeedbackMessage(`Song "${item.title}" deleted from live platform and moved to 45-day Recovery Vault.`);
      } else if (item.type === 'playlist') {
        PlaylistService.deletePlaylist(item.id, adminActor.id, true, adminActor.email, reason);
        setFeedbackMessage(`Playlist "${item.title}" deleted from live platform and moved to 45-day Playlist Recovery Vault.`);
      } else if (item.type === 'album') {
        const count = MusicCatalogService.removeAlbumById(item.id, adminActor, reason, {
          detachTracks: !options?.removeAssociatedTracks,
        });
        setFeedbackMessage(`Album "${item.title}" and ${count} track(s) deleted from live platform and moved to 45-day Recovery Vault.`);
      } else if (item.type === 'audiobook') {
        MediaCatalogService.removeAudiobook(item.id, adminActor, reason);
        setFeedbackMessage(`Audiobook "${item.title}" deleted from platform.`);
      } else if (item.type === 'podcast') {
        MediaCatalogService.removePodcast(item.id, adminActor, reason);
        setFeedbackMessage(`Podcast episode "${item.title}" deleted from platform.`);
      } else if (item.type === 'video') {
        MediaCatalogService.removeVideo(item.id, adminActor, reason);
        setFeedbackMessage(`4K video "${item.title}" deleted from platform.`);
      } else if (item.type === 'producer') {
        ProducerCatalogService.removeProducer(
          item.id,
          adminActor,
          reason,
          options?.removeAssociatedTracks ?? true
        );
        setFeedbackMessage(`Producer profile "${item.title}" deleted from platform.`);
      } else if (item.type === 'merch') {
        MerchCatalogService.removeProduct(item.id, adminActor, reason);
        setFeedbackMessage(`Merchandise "${item.title}" deleted from store catalog.`);
      }

      syncAll();
      setSelectedItemToDelete(null);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (e) {
      console.error('Error during content deletion:', e);
      setFeedbackMessage('Failed to delete item. Please check permissions.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getButtonLabel = (type: DeletableItemType) => {
    switch (type) {
      case 'song':
        return 'Delete Song';
      case 'album':
        return 'Delete Album';
      case 'audiobook':
        return 'Delete Audiobook';
      case 'podcast':
        return 'Delete Podcast';
      case 'video':
        return 'Delete Video';
      case 'producer':
        return 'Delete Producer';
      case 'merch':
        return 'Delete Merch';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{feedbackMessage}</p>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs uppercase font-mono font-bold text-emerald-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-red-500/30 bg-gradient-to-r from-red-950/40 via-[#180820]/60 to-[#0e0414] shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Content Governance & Deletion Center
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Platform Content Deletion Center
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 mt-1 max-w-3xl leading-relaxed">
              Full administrative authority to delete music (songs and albums), audiobooks, podcasts, 4K videos, producers, and merchandise from the platform. Every deletion requires an explicit confirmation dialogue and is recorded in the immutable audit log.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-right">
              <span className="text-[10px] uppercase font-mono text-neutral-400 block">Total Live Catalog</span>
              <span className="text-xl font-black text-brand-gold font-mono">{allItems.length} Items</span>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          {[
            { id: 'all', label: 'All Content', count: allItems.length, icon: Layers },
            { id: 'song', label: 'Music Songs', count: tracks.length, icon: Music },
            { id: 'album', label: 'Music Albums', count: albums.length, icon: Disc3 },
            { id: 'audiobook', label: 'AudioBooks', count: audiobooks.length, icon: BookOpen },
            { id: 'podcast', label: 'Podcasts', count: podcasts.length, icon: Mic },
            { id: 'video', label: '4K Videos', count: videos.length, icon: Video },
            { id: 'producer', label: 'Producers', count: producers.length, icon: Sliders },
            { id: 'merch', label: 'Merchandise', count: products.length, icon: ShoppingBag },
          ].map((pill) => {
            const Icon = pill.icon;
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFilter(pill.id as FilterType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-500'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-black/30' : 'bg-white/10'}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Sort Controls */}
      <div className="p-4 rounded-2xl glass-panel border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by title, artist, creator, category, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-neutral-500 focus:border-red-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400 font-bold flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white text-xs font-bold focus:outline-none"
          >
            <option value="type">Group by Type</option>
            <option value="title">Alphabetical (Title A-Z)</option>
          </select>

          <span className="text-neutral-500 font-mono text-[11px] pl-2">
            Showing {sortedItems.length} item(s)
          </span>
        </div>
      </div>

      {/* Bulk Selection Floating Action Bar */}
      {selectedItemKeys.size > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-[#1c0824] to-red-950/40 border border-red-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-white">
                {selectedItemKeys.size} Item(s) Selected for Bulk Removal
              </p>
              <p className="text-[10px] text-neutral-400">
                Multi-select across music songs, albums, audiobooks, podcasts, videos, producers, and merch.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:scale-105 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedItemKeys.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Catalog Items Table & Actions */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        {sortedItems.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white">No items found matching your filter</p>
            <p className="text-xs text-neutral-400">Try adjusting your search query or switching content tabs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedItemKeys.size > 0 && selectedItemKeys.size === sortedItems.length}
                      onChange={handleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-red-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-2">Type</th>
                  <th className="py-3 px-3">Item / Creator</th>
                  <th className="py-3 px-3">Details / Metadata</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {sortedItems.map((item) => {
                  const itemKey = `${item.type}:${item.id}`;
                  const isSelected = selectedItemKeys.has(itemKey);

                  return (
                    <tr
                      key={itemKey}
                      className={`transition-colors group ${
                        isSelected ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(itemKey)}
                          className="w-3.5 h-3.5 rounded accent-red-500 cursor-pointer"
                        />
                      </td>

                      {/* Item Type Badge */}
                      <td className="py-3 px-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 bg-white/5 border-white/10 text-neutral-300">
                          {item.type === 'song' && <Music className="w-3 h-3 text-brand-purple" />}
                          {item.type === 'album' && <Disc3 className="w-3 h-3 text-indigo-400" />}
                          {item.type === 'audiobook' && <BookOpen className="w-3 h-3 text-blue-400" />}
                          {item.type === 'podcast' && <Mic className="w-3 h-3 text-amber-400" />}
                          {item.type === 'video' && <Video className="w-3 h-3 text-rose-400" />}
                          {item.type === 'producer' && <Sliders className="w-3 h-3 text-brand-gold" />}
                          {item.type === 'merch' && <ShoppingBag className="w-3 h-3 text-emerald-400" />}
                          <span>{item.type}</span>
                        </span>
                      </td>

                      {/* Title & Creator */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          {item.coverUrl ? (
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900 shadow">
                              <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0 text-neutral-400">
                              <Layers className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0 font-sans">
                            <p className="font-bold text-white truncate group-hover:text-red-300 transition-colors">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">{item.subtitle}</p>
                          </div>
                        </div>
                      </td>

                      {/* Metadata */}
                      <td className="py-3 px-3 text-neutral-300 font-sans text-[11px]">
                        {item.meta}
                      </td>

                      {/* Platform Status */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Live on Platform</span>
                        </span>
                      </td>

                      {/* Action: Delete Button */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedItemToDelete(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all shadow-sm hover:shadow-red-600/30 hover:scale-105 active:scale-95"
                          title={`Delete ${item.title} from platform`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-white" />
                          <span>{getButtonLabel(item.type)}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Item Confirmation Modal */}
      <ConfirmDeletionModal
        isOpen={Boolean(selectedItemToDelete)}
        item={selectedItemToDelete}
        onClose={() => setSelectedItemToDelete(null)}
        onConfirm={handleConfirmDeletion}
        isDeleting={isDeleting}
      />

      {/* Multi-Item Bulk Deletion Modal */}
      <BulkDeletionModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        selectedItems={allItems.filter((it) => selectedItemKeys.has(`${it.type}:${it.id}`))}
        onComplete={() => {
          syncAll();
          setSelectedItemKeys(new Set());
          setFeedbackMessage('Bulk deletion executed successfully. Records moved to 45-day Recovery Vault / soft-removed.');
          setTimeout(() => setFeedbackMessage(null), 5000);
        }}
      />
    </div>
  );
};
