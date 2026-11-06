'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  RotateCcw,
  Trash2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  Play,
  CheckCircle2,
  Sparkles,
  Music,
  Disc3,
  Calendar,
  Layers,
  ArrowRight,
  User,
  ShieldAlert,
  ListMusic,
  ExternalLink,
} from 'lucide-react';
import {
  MusicRecoveryService,
  RecoverableMusicItem,
  RETENTION_DAYS,
} from '@/lib/music/MusicRecoveryService';
import {
  PlaylistService,
  RecoverablePlaylistItem,
  PLAYLIST_RETENTION_DAYS,
} from '@/lib/playlist/PlaylistService';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { OFFICIAL_CRATES } from '@/types/catalog';

export const MusicRecoverySection: React.FC = () => {
  const { profile } = useAuth();
  const { playTrack } = usePlayer();

  // Vault Type: Music Tracks or Playlists
  const [vaultType, setVaultType] = useState<'music' | 'playlists'>('music');

  // Music state
  const [musicItems, setMusicItems] = useState<RecoverableMusicItem[]>([]);
  const [selectedMusicIds, setSelectedMusicIds] = useState<Set<string>>(new Set());
  const [crateFilter, setCrateFilter] = useState('all');

  // Playlist state
  const [playlistItems, setPlaylistItems] = useState<RecoverablePlaylistItem[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());

  // Search & Toast
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals for Music
  const [purgeTargetMusic, setPurgeTargetMusic] = useState<RecoverableMusicItem | null>(null);
  const [restoreTargetMusic, setRestoreTargetMusic] = useState<RecoverableMusicItem | null>(null);

  // Modals for Playlists
  const [purgeTargetPlaylist, setPurgeTargetPlaylist] = useState<RecoverablePlaylistItem | null>(null);
  const [restoreTargetPlaylist, setRestoreTargetPlaylist] = useState<RecoverablePlaylistItem | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshAll = () => {
    setMusicItems(MusicRecoveryService.getRecoveryItems());
    setPlaylistItems(PlaylistService.getDeletedPlaylists());
  };

  useEffect(() => {
    refreshAll();
    const unsubMusic = MusicRecoveryService.subscribe(refreshAll);
    const unsubPlaylist = PlaylistService.subscribe(refreshAll);
    window.addEventListener('playlists-updated', refreshAll);

    return () => {
      unsubMusic();
      unsubPlaylist();
      window.removeEventListener('playlists-updated', refreshAll);
    };
  }, []);

  // Music handlers
  const handleToggleSelectMusic = (id: string) => {
    const next = new Set(selectedMusicIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMusicIds(next);
  };

  const handleSelectAllMusic = () => {
    if (selectedMusicIds.size === filteredMusicItems.length) {
      setSelectedMusicIds(new Set());
    } else {
      setSelectedMusicIds(new Set(filteredMusicItems.map((it) => it.id)));
    }
  };

  const handleRestoreMusic = (item: RecoverableMusicItem) => {
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const restored = MusicRecoveryService.restoreItem(item.id, admin);
    if (restored) {
      MusicCatalogService.restoreTrack(restored.track);
      setRestoreTargetMusic(null);
      showToast(`Restored "${restored.track.title}" back to crate "${restored.originalCrateName}"!`);
      refreshAll();
    }
  };

  const handlePermanentPurgeMusic = (item: RecoverableMusicItem) => {
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const purged = MusicRecoveryService.permanentlyPurge(item.id, admin);
    if (purged) {
      setPurgeTargetMusic(null);
      showToast(`Permanently deleted "${item.track.title}".`);
      refreshAll();
    }
  };

  const handleBatchRestoreMusic = () => {
    if (selectedMusicIds.size === 0) return;
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const restoredList = MusicRecoveryService.batchRestore(Array.from(selectedMusicIds), admin);
    restoredList.forEach((it) => MusicCatalogService.restoreTrack(it.track));
    setSelectedMusicIds(new Set());
    showToast(`Restored ${restoredList.length} tracks to active catalog!`);
    refreshAll();
  };

  const handleBatchPurgeMusic = () => {
    if (selectedMusicIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedMusicIds.size} tracks? This action is irreversible.`)) return;

    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const count = MusicRecoveryService.batchPurge(Array.from(selectedMusicIds), admin);
    setSelectedMusicIds(new Set());
    showToast(`Permanently deleted ${count} tracks from the platform.`);
    refreshAll();
  };

  // Playlist handlers
  const handleToggleSelectPlaylist = (id: string) => {
    const next = new Set(selectedPlaylistIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPlaylistIds(next);
  };

  const handleSelectAllPlaylists = () => {
    if (selectedPlaylistIds.size === filteredPlaylistItems.length) {
      setSelectedPlaylistIds(new Set());
    } else {
      setSelectedPlaylistIds(new Set(filteredPlaylistItems.map((it) => it.id)));
    }
  };

  const handleRestorePlaylist = (item: RecoverablePlaylistItem) => {
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const res = PlaylistService.restorePlaylist(item.originalPlaylistId, admin);
    if (res.success) {
      setRestoreTargetPlaylist(null);
      showToast(`Restored playlist "${item.playlist.name}" back to live catalog!`);
      refreshAll();
    } else {
      alert(res.error || 'Failed to restore playlist');
    }
  };

  const handlePermanentPurgePlaylist = (item: RecoverablePlaylistItem) => {
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    const res = PlaylistService.permanentlyPurgePlaylist(item.originalPlaylistId, admin);
    if (res.success) {
      setPurgeTargetPlaylist(null);
      showToast(`Permanently purged playlist "${item.playlist.name}".`);
      refreshAll();
    } else {
      alert(res.error || 'Failed to purge playlist');
    }
  };

  const handleBatchRestorePlaylists = () => {
    if (selectedPlaylistIds.size === 0) return;
    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    let restoredCount = 0;
    selectedPlaylistIds.forEach((vaultId) => {
      const it = playlistItems.find((p) => p.id === vaultId);
      if (it) {
        const res = PlaylistService.restorePlaylist(it.originalPlaylistId, admin);
        if (res.success) restoredCount++;
      }
    });

    setSelectedPlaylistIds(new Set());
    showToast(`Restored ${restoredCount} playlists to active catalog!`);
    refreshAll();
  };

  const handleBatchPurgePlaylists = () => {
    if (selectedPlaylistIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedPlaylistIds.size} playlists? This action is irreversible.`)) return;

    const admin = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Chancellor (Admin)',
      role: 'admin' as any,
    };

    let purgedCount = 0;
    selectedPlaylistIds.forEach((vaultId) => {
      const it = playlistItems.find((p) => p.id === vaultId);
      if (it) {
        const res = PlaylistService.permanentlyPurgePlaylist(it.originalPlaylistId, admin);
        if (res.success) purgedCount++;
      }
    });

    setSelectedPlaylistIds(new Set());
    showToast(`Permanently deleted ${purgedCount} playlists.`);
    refreshAll();
  };

  // Filter music items
  const filteredMusicItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return musicItems.filter((it) => {
      const matchSearch =
        !q ||
        it.track.title.toLowerCase().includes(q) ||
        it.track.artistName.toLowerCase().includes(q) ||
        (it.track.albumTitle || '').toLowerCase().includes(q) ||
        it.removedByAdminName.toLowerCase().includes(q) ||
        it.originalCrateName.toLowerCase().includes(q);

      const matchCrate = crateFilter === 'all' || it.originalCrateId === crateFilter;
      return matchSearch && matchCrate;
    });
  }, [musicItems, searchQuery, crateFilter]);

  // Filter playlist items
  const filteredPlaylistItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return playlistItems.filter((it) => {
      if (!q) return true;
      return (
        it.playlist.name.toLowerCase().includes(q) ||
        it.playlist.ownerName.toLowerCase().includes(q) ||
        (it.playlist.ownerEmail && it.playlist.ownerEmail.toLowerCase().includes(q)) ||
        it.removedByAdminName.toLowerCase().includes(q) ||
        (it.reason && it.reason.toLowerCase().includes(q)) ||
        it.id.toLowerCase().includes(q)
      );
    });
  }, [playlistItems, searchQuery]);

  const musicExpiringSoon = musicItems.filter((it) => it.daysRemaining <= 7).length;
  const playlistsExpiringSoon = playlistItems.filter((it) => it.daysRemaining <= 7).length;
  const totalExpiringSoon = musicExpiringSoon + playlistsExpiringSoon;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet text-white text-xs font-bold shadow-2xl border border-white/20 animate-in fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-brand-gold/30 bg-gradient-to-r from-[#1c102b] via-[#120a1f] to-[#090510] shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-extrabold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              45-Day Rolling Quarantine · Authorized Admin Recovery Vault
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              45-Day Recovery Vault
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-3xl leading-relaxed">
              When administrators remove music tracks, albums, or member crates/playlists, all records are quarantined safely in this 45-day recovery vault. Full audio files, sequences, and cover art are preserved. Authorized admins can restore tracks and playlists anytime before the 45-day countdown expires.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Authority Active</span>
            </div>
          </div>
        </div>

        {/* Category Sub-Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => {
              setVaultType('music');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
              vaultType === 'music'
                ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-lg border border-brand-purple/50'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Music Tracks & Songs</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                vaultType === 'music' ? 'bg-white/20 text-white' : 'bg-white/10 text-neutral-400'
              }`}
            >
              {musicItems.length}
            </span>
          </button>

          <button
            onClick={() => {
              setVaultType('playlists');
              setSearchQuery('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
              vaultType === 'playlists'
                ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-lg border border-brand-purple/50'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Playlists & Crates</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                vaultType === 'playlists' ? 'bg-brand-gold text-black font-extrabold' : 'bg-white/10 text-neutral-400'
              }`}
            >
              {playlistItems.length}
            </span>
          </button>
        </div>

        {/* Counter KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-[10px] uppercase font-bold text-neutral-400">Total in Recovery</p>
            <p className="text-xl font-black text-white flex items-center gap-1.5">
              <span>{musicItems.length + playlistItems.length}</span>
              <span className="text-xs font-normal text-neutral-400">records</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-purple/10 border border-brand-purple/30 space-y-1">
            <p className="text-[10px] uppercase font-bold text-brand-purple/90">Current Category</p>
            <p className="text-xl font-black text-white flex items-center gap-1.5">
              <span>{vaultType === 'music' ? musicItems.length : playlistItems.length}</span>
              <span className="text-xs font-normal text-neutral-400">
                {vaultType === 'music' ? 'tracks' : 'playlists'}
              </span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-1">
            <p className="text-[10px] uppercase font-bold text-red-400">Expiring in &le; 7 Days</p>
            <p className="text-xl font-black text-red-300">
              {vaultType === 'music' ? musicExpiringSoon : playlistsExpiringSoon}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            <p className="text-[10px] uppercase font-bold text-emerald-400">Protected Integrity</p>
            <p className="text-xl font-black text-emerald-300">100% Lossless</p>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-5 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  vaultType === 'music'
                    ? 'Search song, artist, album, admin...'
                    : 'Search playlist name, curator, reason, admin...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            {/* Crate Filter (only for Music) */}
            {vaultType === 'music' && (
              <select
                value={crateFilter}
                onChange={(e) => setCrateFilter(e.target.value)}
                className="p-2 rounded-xl bg-[#140f24] border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="all">All Original Crates</option>
                {OFFICIAL_CRATES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Batch Actions for Music */}
          {vaultType === 'music' && selectedMusicIds.size > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <span className="text-xs font-bold text-brand-gold">
                {selectedMusicIds.size} selected
              </span>
              <button
                onClick={handleBatchRestoreMusic}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Selected</span>
              </button>
              <button
                onClick={handleBatchPurgeMusic}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Selected</span>
              </button>
            </div>
          )}

          {/* Batch Actions for Playlists */}
          {vaultType === 'playlists' && selectedPlaylistIds.size > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <span className="text-xs font-bold text-brand-gold">
                {selectedPlaylistIds.size} selected
              </span>
              <button
                onClick={handleBatchRestorePlaylists}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Selected</span>
              </button>
              <button
                onClick={handleBatchPurgePlaylists}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Selected</span>
              </button>
            </div>
          )}
        </div>

        {/* VAULT TYPE: MUSIC */}
        {vaultType === 'music' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-2 w-8">
                    <input
                      type="checkbox"
                      checked={filteredMusicItems.length > 0 && selectedMusicIds.size === filteredMusicItems.length}
                      onChange={handleSelectAllMusic}
                      className="rounded border-white/20"
                    />
                  </th>
                  <th className="pb-3">Song & Album</th>
                  <th className="pb-3">Original Crate</th>
                  <th className="pb-3">Removed Timestamp & Admin</th>
                  <th className="pb-3">Uploaded Timestamp</th>
                  <th className="pb-3">45-Day Retention Countdown</th>
                  <th className="pb-3 pr-2 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMusicItems.map((item) => {
                  const isSelected = selectedMusicIds.has(item.id);
                  const percentLeft = Math.round((item.daysRemaining / RETENTION_DAYS) * 100);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-brand-purple/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 pl-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectMusic(item.id)}
                          className="rounded border-white/20"
                        />
                      </td>

                      {/* Song & Album (with Cover Art) */}
                      <td className="py-3 pr-4 max-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black/60 shadow-md">
                            <Image
                              src={item.track.coverUrl || '/images/logo.png'}
                              alt={item.track.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-white truncate text-xs">
                              {item.track.title}
                            </p>
                            <p className="text-[11px] text-brand-gold truncate font-semibold">
                              {item.track.artistName}
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {item.track.albumTitle || 'Vault Archive'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Original Crate */}
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-neon font-bold text-[10px]">
                          {item.originalCrateName}
                        </span>
                      </td>

                      {/* Removal Date, Time & Removing Admin Name */}
                      <td className="py-3 pr-3 max-w-[210px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-white font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-red-400 shrink-0" />
                            <span>{new Date(item.removedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-neutral-300 text-[10px]">
                            <User className="w-3 h-3 text-brand-gold shrink-0" />
                            <span className="font-semibold text-neutral-200">
                              Removed by: {item.removedByAdminName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Upload Timestamp & Uploading Admin */}
                      <td className="py-3 pr-3 max-w-[200px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-neutral-300 font-mono text-[10px]">
                            <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{new Date(item.uploadedAt).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            Uploaded by: <span className="text-white font-semibold">{item.uploadedByAdminName}</span>
                          </div>
                        </div>
                      </td>

                      {/* 45-Day Retention Countdown */}
                      <td className="py-3 pr-3 min-w-[170px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-black uppercase tracking-wider ${
                                item.daysRemaining <= 7
                                  ? 'text-red-400 animate-pulse'
                                  : item.daysRemaining <= 15
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {item.daysRemaining} Days Left
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              of 45 Days
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                item.daysRemaining <= 7
                                  ? 'bg-red-500'
                                  : item.daysRemaining <= 15
                                  ? 'bg-amber-500'
                                  : 'bg-gradient-to-r from-brand-purple to-emerald-400'
                              }`}
                              style={{ width: `${percentLeft}%` }}
                            />
                          </div>

                          <p className="text-[9px] text-neutral-400 font-mono">
                            Expires: {new Date(item.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 pr-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Audio Preview */}
                          <button
                            onClick={() => playTrack(item.track)}
                            className="p-1.5 rounded-lg bg-brand-gold/15 hover:bg-brand-gold hover:text-black text-brand-gold transition-all"
                            title="Preview audio before decision"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>

                          {/* Restore Button */}
                          <button
                            onClick={() => setRestoreTargetMusic(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 font-black text-[10px] uppercase flex items-center gap-1 transition-all"
                            title="Restore back to active crate"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>

                          {/* Permanent Purge Button */}
                          <button
                            onClick={() => setPurgeTargetMusic(item)}
                            className="px-2 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-300 font-black text-[10px] uppercase transition-all"
                            title="Permanently wipe"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredMusicItems.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">No Music Quarantined</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  No tracks are currently quarantined. When an administrator removes music, it will be safely held here for 45 calendar days.
                </p>
              </div>
            )}
          </div>
        )}

        {/* VAULT TYPE: PLAYLISTS */}
        {vaultType === 'playlists' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-2 w-8">
                    <input
                      type="checkbox"
                      checked={filteredPlaylistItems.length > 0 && selectedPlaylistIds.size === filteredPlaylistItems.length}
                      onChange={handleSelectAllPlaylists}
                      className="rounded border-white/20"
                    />
                  </th>
                  <th className="pb-3">Playlist & Cover</th>
                  <th className="pb-3">Curator & Visibility</th>
                  <th className="pb-3">Removed Timestamp & Admin</th>
                  <th className="pb-3">Reason for Removal</th>
                  <th className="pb-3">45-Day Retention Countdown</th>
                  <th className="pb-3 pr-2 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPlaylistItems.map((item) => {
                  const isSelected = selectedPlaylistIds.has(item.id);
                  const percentLeft = Math.round((item.daysRemaining / PLAYLIST_RETENTION_DAYS) * 100);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-brand-purple/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 pl-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectPlaylist(item.id)}
                          className="rounded border-white/20"
                        />
                      </td>

                      {/* Playlist & Cover */}
                      <td className="py-3 pr-4 max-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black/60 shadow-md">
                            <Image
                              src={item.playlist.coverUrl || '/images/logo.png'}
                              alt={item.playlist.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-white truncate text-xs">
                              {item.playlist.name}
                            </p>
                            <p className="text-[11px] text-brand-gold truncate font-semibold">
                              {item.playlist.itemCount || item.playlist.items?.length || 0} tracks
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              ID: {item.originalPlaylistId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Curator & Visibility */}
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white text-xs">{item.playlist.ownerName}</p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.playlist.visibility === 'public'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}
                          >
                            {item.playlist.visibility}
                          </span>
                        </div>
                      </td>

                      {/* Removal Timestamp & Admin */}
                      <td className="py-3 pr-3 max-w-[210px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-white font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-red-400 shrink-0" />
                            <span>{new Date(item.removedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-neutral-300 text-[10px]">
                            <User className="w-3 h-3 text-brand-gold shrink-0" />
                            <span className="font-semibold text-neutral-200">
                              Removed by: {item.removedByAdminName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 pr-3 max-w-[180px]">
                        <p className="text-neutral-300 text-xs italic truncate" title={item.reason || ''}>
                          &ldquo;{item.reason || 'Administrative moderation'}&rdquo;
                        </p>
                      </td>

                      {/* 45-Day Retention Countdown */}
                      <td className="py-3 pr-3 min-w-[170px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-black uppercase tracking-wider ${
                                item.daysRemaining <= 7
                                  ? 'text-red-400 animate-pulse'
                                  : item.daysRemaining <= 15
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {item.daysRemaining} Days Left
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              of 45 Days
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                item.daysRemaining <= 7
                                  ? 'bg-red-500'
                                  : item.daysRemaining <= 15
                                  ? 'bg-amber-500'
                                  : 'bg-gradient-to-r from-brand-purple to-emerald-400'
                              }`}
                              style={{ width: `${percentLeft}%` }}
                            />
                          </div>

                          <p className="text-[9px] text-neutral-400 font-mono">
                            Expires: {new Date(item.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 pr-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Link */}
                          <Link
                            href={`/playlists/${item.originalPlaylistId}`}
                            target="_blank"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
                            title="Inspect playlist structure"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Restore Button */}
                          <button
                            onClick={() => setRestoreTargetPlaylist(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 font-black text-[10px] uppercase flex items-center gap-1 transition-all"
                            title="Restore back to live catalog"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>

                          {/* Permanent Purge Button */}
                          <button
                            onClick={() => setPurgeTargetPlaylist(item)}
                            className="px-2 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-300 font-black text-[10px] uppercase transition-all"
                            title="Permanently wipe"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredPlaylistItems.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-white">No Playlists Quarantined</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  All member and curator playlists are active. When an administrator removes a playlist, it will be safely held here for 45 calendar days.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal: Restore Music */}
      {restoreTargetMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-emerald-500/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Restore Track to Active Catalog?
                </h3>
                <p className="text-xs text-neutral-400">
                  This track will be immediately reactivated in crate &ldquo;{restoreTargetMusic.originalCrateName}&rdquo;.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <Image
                  src={restoreTargetMusic.track.coverUrl || '/images/logo.png'}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {restoreTargetMusic.track.title}
                </p>
                <p className="text-[11px] text-brand-gold truncate">
                  {restoreTargetMusic.track.artistName}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  {restoreTargetMusic.originalCrateName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreTargetMusic(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestoreMusic(restoreTargetMusic)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 transition-all"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Purge Music */}
      {purgeTargetMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/50 bg-[#15081c] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Permanently Delete Music?
                </h3>
                <p className="text-xs text-red-300 font-semibold">
                  Warning: This action bypasses the 45-day retention timer and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <Image
                  src={purgeTargetMusic.track.coverUrl || '/images/logo.png'}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {purgeTargetMusic.track.title}
                </p>
                <p className="text-[11px] text-brand-gold truncate">
                  {purgeTargetMusic.track.artistName}
                </p>
                <p className="text-[10px] text-neutral-400">
                  Removed by: {purgeTargetMusic.removedByAdminName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPurgeTargetMusic(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                Keep in 45-Day Recovery
              </button>
              <button
                onClick={() => handlePermanentPurgeMusic(purgeTargetMusic)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-all"
              >
                Permanently Destroy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore Playlist */}
      {restoreTargetPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-emerald-500/50 bg-[#120a22] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Restore Playlist to Live Platform?
                </h3>
                <p className="text-xs text-neutral-400">
                  This playlist and its complete sequence will be immediately reactivated across the platform.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <Image
                  src={restoreTargetPlaylist.playlist.coverUrl || '/images/logo.png'}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {restoreTargetPlaylist.playlist.name}
                </p>
                <p className="text-[11px] text-brand-gold truncate">
                  Curator: {restoreTargetPlaylist.playlist.ownerName}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  Tracks: {restoreTargetPlaylist.playlist.itemCount || restoreTargetPlaylist.playlist.items?.length || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreTargetPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestorePlaylist(restoreTargetPlaylist)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 transition-all"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Purge Playlist */}
      {purgeTargetPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-red-500/50 bg-[#15081c] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Permanently Delete Playlist?
                </h3>
                <p className="text-xs text-red-300 font-semibold">
                  Warning: This action bypasses the 45-day retention timer and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                <Image
                  src={purgeTargetPlaylist.playlist.coverUrl || '/images/logo.png'}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {purgeTargetPlaylist.playlist.name}
                </p>
                <p className="text-[11px] text-brand-gold truncate">
                  Curator: {purgeTargetPlaylist.playlist.ownerName}
                </p>
                <p className="text-[10px] text-neutral-400">
                  Removed by: {purgeTargetPlaylist.removedByAdminName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPurgeTargetPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                Keep in 45-Day Recovery
              </button>
              <button
                onClick={() => handlePermanentPurgePlaylist(purgeTargetPlaylist)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-all"
              >
                Permanently Destroy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
