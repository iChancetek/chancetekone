'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Disc3,
  Music,
  Play,
  Clock,
  Sparkles,
  Search,
  Filter,
  Eye,
  ChevronRight,
  Flame,
  Crown,
  Disc,
  Sliders,
  Radio,
  CheckCircle2,
  X,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  Edit3,
  FolderInput,
  ArrowRight,
  ArrowRightLeft,
  Save,
} from 'lucide-react';
import {
  OFFICIAL_CRATES,
  DIRECT_MUSIC_CRATE,
  CrateDefinition,
} from '@/types/catalog';
import { Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { ChangeCoverArtModal } from '@/components/admin/modals/ChangeCoverArtModal';
import { CatalogArtworkScannerModal } from '@/components/admin/modals/CatalogArtworkScannerModal';

export const CrateManagementSection: React.FC = () => {
  const { profile } = useAuth();
  const { playTrack } = usePlayer();
  const [selectedCrateId, setSelectedCrateId] = useState<string>('golden-era-hip-hop');
  const [crates, setCrates] = useState<CrateDefinition[]>(OFFICIAL_CRATES);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Crate Rename & Edit State
  const [isEditCrateOpen, setIsEditCrateOpen] = useState(false);
  const [editCrateName, setEditCrateName] = useState('');
  const [editCrateSubtitle, setEditCrateSubtitle] = useState('');
  const [editCrateDesc, setEditCrateDesc] = useState('');
  const [editCrateBpm, setEditCrateBpm] = useState('');
  const [editCrateBadge, setEditCrateBadge] = useState('');
  const [editCrateAccentColor, setEditCrateAccentColor] = useState('');

  // Track Moving State
  const [trackToMove, setTrackToMove] = useState<Track | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [targetMoveCrateId, setTargetMoveCrateId] = useState<string>('oldschool-rnb-soul');

  // Removal State
  const [trackToRemove, setTrackToRemove] = useState<Track | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cover Art Edit State
  const [trackForCoverEdit, setTrackForCoverEdit] = useState<Track | null>(null);
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const refreshData = () => {
      setCrates(MusicCatalogService.getOfficialCrates());
      setTracks(MusicCatalogService.getTracksByCrate(selectedCrateId));
    };

    refreshData();
    const unsub = MusicCatalogService.subscribe(refreshData);
    return () => unsub();
  }, [selectedCrateId]);

  const activeCrate = crates.find((c) => c.id === selectedCrateId) || crates[0];

  const handleConfirmRemoveTrack = () => {
    if (!trackToRemove) return;
    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';
    MusicCatalogService.removeTrack(trackToRemove.id, { id: adminId, name: adminName }, removeReason.trim() || undefined);
    showToast(`Track "${trackToRemove.title}" quarantined to 45-day recovery vault.`);
    setTrackToRemove(null);
    setRemoveReason('');
  };

  // Handler: Save Crate Renaming / Metadata Updates (takes effect immediately)
  const handleSaveCrateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCrateName.trim()) return;

    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';

    MusicCatalogService.updateCrate(
      activeCrate.id,
      {
        name: editCrateName.trim(),
        subtitle: editCrateSubtitle.trim(),
        description: editCrateDesc.trim(),
        bpmRange: editCrateBpm.trim(),
        badge: editCrateBadge.trim(),
        accentColor: editCrateAccentColor.trim() || activeCrate.accentColor,
      },
      { id: adminId, name: adminName }
    );

    showToast(`Crate renamed to "${editCrateName.trim()}"! Changes take effect immediately.`);
    setIsEditCrateOpen(false);
  };

  // Handler: Toggle single track selection
  const handleToggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  // Handler: Toggle all tracks selection
  const handleToggleSelectAll = () => {
    if (selectedTrackIds.size === filteredTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredTracks.map((t) => t.id)));
    }
  };

  // Handler: Confirm Move Single Track
  const handleConfirmMoveTrack = () => {
    if (!trackToMove) return;
    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';

    const targetDef = MusicCatalogService.getCrateById(targetMoveCrateId) || DIRECT_MUSIC_CRATE;
    MusicCatalogService.moveTrackToCrate(trackToMove.id, targetMoveCrateId, {
      id: adminId,
      name: adminName,
    });

    showToast(`Moved "${trackToMove.title}" to ${targetDef.name}!`);
    setTrackToMove(null);
  };

  // Handler: Confirm Bulk Move Tracks
  const handleConfirmBulkMove = () => {
    if (selectedTrackIds.size === 0) return;
    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';

    const targetDef = MusicCatalogService.getCrateById(targetMoveCrateId) || DIRECT_MUSIC_CRATE;
    MusicCatalogService.moveTracksToCrate(Array.from(selectedTrackIds), targetMoveCrateId, {
      id: adminId,
      name: adminName,
    });

    showToast(`Successfully moved ${selectedTrackIds.size} tracks to ${targetDef.name}!`);
    setSelectedTrackIds(new Set());
    setIsBulkMoveOpen(false);
  };

  // Handler: Confirm Bulk Delete Tracks
  const handleConfirmBulkDelete = () => {
    if (selectedTrackIds.size === 0) return;
    const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
    const adminId = profile?.id || 'usr-chancellor';
    const trackIdsArray = Array.from(selectedTrackIds);

    const count = MusicCatalogService.removeTracks(
      trackIdsArray,
      { id: adminId, name: adminName },
      bulkDeleteReason.trim() || `Bulk removed ${trackIdsArray.length} songs from crate "${activeCrate.name}"`
    );

    showToast(`Successfully quarantined ${count} songs from ${activeCrate.name} to the 45-day recovery vault.`);
    setSelectedTrackIds(new Set());
    setIsBulkDeleteOpen(false);
    setBulkDeleteReason('');
  };

  const filteredTracks = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.albumTitle || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-gradient-to-r from-[#170e28] via-[#100a1c] to-[#0a0712] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-black uppercase tracking-wider">
              <Disc3 className="w-3.5 h-3.5" />
              Official Crate Architecture · 8 Curated Vaults
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Master Crate & Track Management
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Explore and govern the eight official 8 Of Spades Works crates. Manage artists, songs, release artwork, BPM tempo, and master track audio across all crates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto shrink-0">
            <button
              onClick={() => setIsAiScannerOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold via-amber-500 to-amber-600 hover:scale-105 active:scale-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-gold/20 transition-all flex items-center gap-2"
              title="Autonomous AI scan for tracks and albums missing authentic cover art"
            >
              <Sparkles className="w-4 h-4 text-black animate-pulse" />
              <span>AI Artwork Scanner</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8 Official Crates Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {crates.map((crate) => {
          const isSelected = selectedCrateId === crate.id;
          return (
            <button
              key={crate.id}
              onClick={() => setSelectedCrateId(crate.id)}
              className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[110px] ${
                isSelected
                  ? 'bg-brand-gold/20 border-brand-gold shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-[1.03]'
                  : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: crate.accentColor }}
                />
                <span className="text-[9px] font-extrabold uppercase text-neutral-400">
                  {crate.badge}
                </span>
              </div>

              <div>
                <p className="text-xs font-black text-white truncate">{crate.name}</p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  {crate.totalTracks} tracks
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Crate Hero Showcase */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#140e24] via-[#0d0918] to-[#07050d] shadow-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeCrate.accentColor }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Active Crate Inspection
              </span>
              <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-extrabold text-[10px] border border-brand-gold/40">
                {activeCrate.badge}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl sm:text-4xl font-black text-white">{activeCrate.name}</h3>
              <button
                type="button"
                onClick={() => {
                  setEditCrateName(activeCrate.name);
                  setEditCrateSubtitle(activeCrate.subtitle);
                  setEditCrateDesc(activeCrate.description);
                  setEditCrateBpm(activeCrate.bpmRange);
                  setEditCrateBadge(activeCrate.badge);
                  setEditCrateAccentColor(activeCrate.accentColor);
                  setIsEditCrateOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-brand-gold hover:text-black border border-white/15 text-white font-extrabold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                title="Rename crate and update crate details immediately"
              >
                <Sliders className="w-3.5 h-3.5 text-brand-gold" />
                <span>Rename / Edit Crate</span>
              </button>
            </div>
            <p className="text-sm font-semibold text-brand-gold">{activeCrate.subtitle}</p>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              {activeCrate.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-neutral-300 font-mono">
              <div>
                BPM Tempo: <span className="text-white font-bold">{activeCrate.bpmRange}</span>
              </div>
              <div>•</div>
              <div>
                Total Tracks: <span className="text-white font-bold">{tracks.length}</span>
              </div>
            </div>
          </div>

          {/* Crate Visual Artwork Frame */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shrink-0 self-center md:self-auto">
            <Image
              src={activeCrate.artworkUrl}
              alt={activeCrate.name}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* Crate Tracks List */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Tracks in {activeCrate.name} ({filteredTracks.length})
            </h4>
            <p className="text-xs text-neutral-400">
              Live playable tracks inside this crate.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredTracks.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedTrackIds.size === filteredTracks.length
                    ? 'bg-brand-gold/20 border-brand-gold text-brand-gold'
                    : 'bg-white/5 border-white/10 text-neutral-300 hover:border-white/25 hover:bg-white/10'
                }`}
                title="Select or deselect all tracks in this crate"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold" />
                <span>
                  {selectedTrackIds.size === filteredTracks.length
                    ? 'Deselect All'
                    : `Select All (${filteredTracks.length})`}
                </span>
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter tracks by title/artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedTrackIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-brand-purple/20 via-brand-violet/20 to-black border border-brand-purple/40 text-xs shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2 text-white font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-pulse" />
              <span>
                {selectedTrackIds.size === filteredTracks.length
                  ? `All ${selectedTrackIds.size} songs selected in ${activeCrate.name}`
                  : `${selectedTrackIds.size} of ${filteredTracks.length} tracks selected`}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const defaultTarget = crates.find((c) => c.id !== activeCrate.id)?.id || 'direct-music-library';
                  setTargetMoveCrateId(defaultTarget);
                  setIsBulkMoveOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-black text-xs uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Move Selected ({selectedTrackIds.size}) to Crate...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkDeleteReason(`Bulk removed from crate "${activeCrate.name}"`);
                  setIsBulkDeleteOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg shadow-red-950/40 cursor-pointer"
                title={`Delete ${selectedTrackIds.size === filteredTracks.length ? 'all' : 'selected'} tracks in ${activeCrate.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedTrackIds.size === filteredTracks.length
                    ? `Delete All (${selectedTrackIds.size}) Songs`
                    : `Delete Selected (${selectedTrackIds.size})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTrackIds(new Set())}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Tracks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase tracking-wider">
                <th className="pb-3 pl-3 w-8">
                  <input
                    type="checkbox"
                    checked={filteredTracks.length > 0 && selectedTrackIds.size === filteredTracks.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-white/20 bg-white/10 text-brand-gold focus:ring-0 cursor-pointer"
                    title="Select all tracks"
                  />
                </th>
                <th className="pb-3">#</th>
                <th className="pb-3">Cover</th>
                <th className="pb-3">Title & Artist</th>
                <th className="pb-3">Album / Collection</th>
                <th className="pb-3">Duration</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTracks.map((track, i) => (
                <tr key={track.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pl-3">
                    <input
                      type="checkbox"
                      checked={selectedTrackIds.has(track.id)}
                      onChange={() => handleToggleSelectTrack(track.id)}
                      className="rounded border-white/20 bg-white/10 text-brand-gold focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 font-mono text-neutral-500">{i + 1}</td>
                  
                  {/* Interactive Cover Art */}
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => setTrackForCoverEdit(track)}
                      className="group relative w-10 h-10 rounded-xl overflow-hidden border border-white/15 hover:border-brand-gold bg-black/50 shrink-0 transition-all cursor-pointer block"
                      title="Click to add or change cover art"
                    >
                      <Image
                        src={track.coverUrl || '/images/logo.png'}
                        alt={track.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                      </div>
                    </button>
                  </td>

                  <td className="py-3 max-w-[200px]">
                    <p className="font-extrabold text-white truncate">{track.title}</p>
                    <p className="text-[11px] text-brand-gold truncate">{track.artistName}</p>
                  </td>
                  <td className="py-3 text-neutral-300 max-w-[160px] truncate">
                    {track.albumTitle || 'Vault Cuts'}
                  </td>
                  <td className="py-3 font-mono text-neutral-400">
                    {Math.floor((track.duration || 180) / 60)}:{String((track.duration || 180) % 60).padStart(2, '0')}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => playTrack(track, filteredTracks)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold hover:text-black text-white transition-all inline-flex items-center gap-1"
                        title="Play track"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-bold">Play</span>
                      </button>
                      <button
                        onClick={() => {
                          setTrackToMove(track);
                          const defaultTarget = crates.find((c) => c.id !== activeCrate.id)?.id || 'direct-music-library';
                          setTargetMoveCrateId(defaultTarget);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple hover:text-white border border-white/10 text-neutral-300 font-bold text-[10px] inline-flex items-center gap-1 transition-all cursor-pointer"
                        title="Move track to another crate"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-brand-gold" />
                        <span>Move</span>
                      </button>
                      <button
                        onClick={() => setTrackForCoverEdit(track)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-brand-purple hover:text-white border border-white/10 text-neutral-300 font-bold text-[10px] inline-flex items-center gap-1 transition-all"
                        title="Change track cover art"
                      >
                        <ImageIcon className="w-3 h-3 text-brand-gold" />
                        <span>Cover Art</span>
                      </button>
                      <button
                        onClick={() => setTrackToRemove(track)}
                        className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold text-[10px] inline-flex items-center gap-1 transition-all"
                        title="Remove track to 45-day recovery vault"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTracks.length === 0 && (
            <div className="p-8 text-center text-neutral-400 text-xs">
              No tracks found in this crate matching search.
            </div>
          )}
        </div>
      </div>


      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal: Remove Track Confirmation */}
      {trackToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a15] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-extrabold text-white">Remove Track to 45-Day Vault</h3>
              </div>
              <button
                onClick={() => {
                  setTrackToRemove(null);
                  setRemoveReason('');
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={trackToRemove.coverUrl || '/images/default-cover.jpg'}
                  alt={trackToRemove.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm truncate">{trackToRemove.title}</p>
                <p className="text-xs text-brand-gold truncate">{trackToRemove.artistName}</p>
                <p className="text-[11px] text-neutral-400 truncate">{trackToRemove.albumTitle || 'Vault Cuts'}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                45-Day Recovery Policy
              </p>
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                This track will be removed from the public catalog and moved to the Recovery Vault. Administrators have 45 days to restore it before permanent deletion.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-neutral-300">Reason for Removal (Logged in Audit Trail)</label>
              <input
                type="text"
                placeholder="e.g. Master replaced, licensing change, admin curation..."
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/60"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => {
                  setTrackToRemove(null);
                  setRemoveReason('');
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveTrack}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Quarantine</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Track Cover Art */}
      {trackForCoverEdit && (
        <ChangeCoverArtModal
          isOpen={Boolean(trackForCoverEdit)}
          onClose={() => setTrackForCoverEdit(null)}
          title={`Update Cover Art — ${trackForCoverEdit.title}`}
          subtitle={`${trackForCoverEdit.artistName} • ${trackForCoverEdit.albumTitle || 'Vault Cuts'}`}
          currentCoverUrl={trackForCoverEdit.coverUrl}
          crateDefaultUrl={activeCrate.artworkUrl}
          onSave={(newCoverUrl) => {
            const adminName = profile?.name || profile?.email || 'Chancellor (Admin)';
            const adminId = profile?.id || 'usr-chancellor';
            MusicCatalogService.updateTrackCover(trackForCoverEdit.id, newCoverUrl, {
              id: adminId,
              name: adminName,
            });
            showToast(`Cover art updated for "${trackForCoverEdit.title}"!`);
            setTrackForCoverEdit(null);
          }}
        />
      )}


      {/* Modal: Rename & Edit Crate Details (Takes Effect Immediately) */}
      {isEditCrateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleSaveCrateEdit}
            className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-gold/50 bg-[#120a22] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-gold" />
                <h3 className="text-base font-extrabold text-white">
                  Rename & Edit Crate: {activeCrate.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCrateOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-xs text-brand-gold space-y-0.5">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                Live Immediate Effect
              </p>
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                Renaming this crate will immediately update navigation, crate badges, upload ingestion targets, track categorization, and member vault views without reloading.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Crate Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Timeless R&B | Soul Music"
                  value={editCrateName}
                  onChange={(e) => setEditCrateName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-extrabold focus:outline-none focus:border-brand-gold/60"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Subtitle / Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Motown, Stax & Rare 70s Crate Vinyl"
                  value={editCrateSubtitle}
                  onChange={(e) => setEditCrateSubtitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-gold/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Badge Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Analog Reel, VIP Master"
                    value={editCrateBadge}
                    onChange={(e) => setEditCrateBadge(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-gold/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">BPM Tempo Range</label>
                  <input
                    type="text"
                    placeholder="e.g. 82 - 118 BPM"
                    value={editCrateBpm}
                    onChange={(e) => setEditCrateBpm(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-gold/60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the sonic vibe, lineage, and atmosphere of this crate..."
                  value={editCrateDesc}
                  onChange={(e) => setEditCrateDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-gold/60 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editCrateAccentColor || '#eab308'}
                    onChange={(e) => setEditCrateAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={editCrateAccentColor}
                    onChange={(e) => setEditCrateAccentColor(e.target.value)}
                    placeholder="#eab308"
                    className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-brand-gold/60"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsEditCrateOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber hover:from-brand-amber hover:to-brand-gold text-black font-black text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Crate Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Move Single Track to Crate */}
      {trackToMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-purple/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-gold" />
                <h3 className="text-base font-extrabold text-white">Move Track to Another Crate</h3>
              </div>
              <button
                onClick={() => setTrackToMove(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/15 bg-black/60 shrink-0">
                <Image
                  src={trackToMove.coverUrl || '/images/logo.png'}
                  alt={trackToMove.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-white text-sm truncate">{trackToMove.title}</p>
                <p className="text-xs text-brand-gold truncate">{trackToMove.artistName}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Current Crate: <span className="text-white font-bold">{activeCrate.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 block">
                Select Destination Crate or Music Area:
              </label>

              {/* Direct to General Music Area */}
              <button
                type="button"
                onClick={() => setTargetMoveCrateId('direct-music-library')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  targetMoveCrateId === 'direct-music-library'
                    ? 'bg-brand-purple/30 border-brand-purple shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:border-brand-purple/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Direct Music Library</p>
                    <p className="text-[10px] text-neutral-400">General Catalog (No Crate Restriction)</p>
                  </div>
                </div>
                {targetMoveCrateId === 'direct-music-library' && (
                  <CheckCircle2 className="w-4 h-4 text-brand-purple shrink-0" />
                )}
              </button>

              {/* All 8 Crates Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {crates.map((c) => {
                  const isCurrent = c.id === activeCrate.id;
                  const isSelected = targetMoveCrateId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => setTargetMoveCrateId(c.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[64px] ${
                        isCurrent
                          ? 'opacity-40 bg-white/5 border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'bg-brand-gold/20 border-brand-gold shadow-[0_0_12px_rgba(245,158,11,0.3)] scale-[1.02] cursor-pointer'
                          : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.accentColor }}
                        />
                        <span className="text-[9px] font-bold text-neutral-400">
                          {isCurrent ? 'Current' : c.badge}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white truncate mt-1">{c.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setTrackToMove(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveTrack}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-105 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Confirm Move</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Move Tracks to Crate */}
      {isBulkMoveOpen && selectedTrackIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-purple/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-gold" />
                <h3 className="text-base font-extrabold text-white">
                  Bulk Move {selectedTrackIds.size} Tracks
                </h3>
              </div>
              <button
                onClick={() => setIsBulkMoveOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-300 space-y-1">
              <p className="font-bold text-white">
                Moving {selectedTrackIds.size} tracks from <span className="text-brand-gold">{activeCrate.name}</span>
              </p>
              <p className="text-[11px] text-neutral-400">
                All selected tracks will be moved to the destination crate with immediate effect and logged in the immutable audit trail.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 block">
                Select Destination:
              </label>

              {/* Direct to General Music Area */}
              <button
                type="button"
                onClick={() => setTargetMoveCrateId('direct-music-library')}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  targetMoveCrateId === 'direct-music-library'
                    ? 'bg-brand-purple/30 border-brand-purple shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.01]'
                    : 'bg-white/5 border-white/10 hover:border-brand-purple/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Direct Music Library</p>
                    <p className="text-[10px] text-neutral-400">General Catalog (No Crate Restriction)</p>
                  </div>
                </div>
                {targetMoveCrateId === 'direct-music-library' && (
                  <CheckCircle2 className="w-4 h-4 text-brand-purple shrink-0" />
                )}
              </button>

              {/* All 8 Crates Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {crates.map((c) => {
                  const isCurrent = c.id === activeCrate.id;
                  const isSelected = targetMoveCrateId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => setTargetMoveCrateId(c.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[64px] ${
                        isCurrent
                          ? 'opacity-40 bg-white/5 border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'bg-brand-gold/20 border-brand-gold shadow-[0_0_12px_rgba(245,158,11,0.3)] scale-[1.02] cursor-pointer'
                          : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.accentColor }}
                        />
                        <span className="text-[9px] font-bold text-neutral-400">
                          {isCurrent ? 'Current' : c.badge}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white truncate mt-1">{c.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsBulkMoveOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkMove}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Move All ({selectedTrackIds.size}) Tracks</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Delete Tracks Confirmation */}
      {isBulkDeleteOpen && selectedTrackIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-red-500/40 bg-[#140a15] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-extrabold text-white">
                  {selectedTrackIds.size === filteredTracks.length
                    ? `Delete All ${selectedTrackIds.size} Songs from ${activeCrate.name}`
                    : `Delete ${selectedTrackIds.size} Selected Songs`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setBulkDeleteReason('');
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  {selectedTrackIds.size === filteredTracks.length ? 'Entire Crate Purge' : 'Batch Deletion'}
                </span>
                <span className="font-mono text-brand-gold font-bold">{selectedTrackIds.size} song(s)</span>
              </div>
              <p className="text-xs text-neutral-300">
                You are about to remove{' '}
                <span className="text-white font-bold">{selectedTrackIds.size}</span> tracks from{' '}
                <span className="text-brand-gold font-bold">{activeCrate.name}</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                45-Day Recovery Policy & Permanent Deletion Guard
              </p>
              <p className="text-neutral-300 text-[11px] leading-relaxed">
                All selected tracks will be quarantined immediately to the 45-day Recovery Vault. If unrecovered after 45 days, they will be permanently purged. All platform playback will halt immediately.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-neutral-300">Reason for Removal (Logged in Audit Trail)</label>
              <input
                type="text"
                placeholder="e.g. Crate flush, duplicate removal, re-curating crate..."
                value={bulkDeleteReason}
                onChange={(e) => setBulkDeleteReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500/60"
              />
            </div>

            {/* Scrollable list preview of tracks to be deleted */}
            <div className="space-y-1">
              <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Preview of Tracks to be Deleted ({Math.min(5, selectedTrackIds.size)} of {selectedTrackIds.size}):
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl bg-black/40 border border-white/5 p-2">
                {filteredTracks
                  .filter((t) => selectedTrackIds.has(t.id))
                  .slice(0, 5)
                  .map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-b-0">
                      <span className="text-white font-medium truncate max-w-[240px]">{t.title}</span>
                      <span className="text-neutral-400 text-[11px] truncate">{t.artistName}</span>
                    </div>
                  ))}
                {selectedTrackIds.size > 5 && (
                  <p className="text-[11px] text-neutral-500 text-center pt-1 italic">
                    ...and {selectedTrackIds.size - 5} more tracks
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setBulkDeleteReason('');
                }}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 font-bold text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {selectedTrackIds.size === filteredTracks.length
                    ? `Confirm Delete All (${selectedTrackIds.size}) Songs`
                    : `Confirm Delete (${selectedTrackIds.size}) Songs`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autonomous AI Cover Art Scanner Modal */}
      <CatalogArtworkScannerModal
        isOpen={isAiScannerOpen}
        onClose={() => setIsAiScannerOpen(false)}
        initialCrateId={selectedCrateId}
      />
    </div>
  );
};
