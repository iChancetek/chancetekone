'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaylistAnalyticsRecord } from '@/types/analytics';
import { AnalyticsAggregator } from '@/lib/analytics/AnalyticsAggregator';
import { BarRankingChart, RankingItem } from '../charts/BarRankingChart';
import {
  ListMusic,
  Share2,
  Heart,
  Users,
  Play,
  Plus,
  TrendingUp,
  Trash2,
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Lock,
  Globe,
  X,
  Sparkles,
} from 'lucide-react';
import {
  PlaylistService,
  RecoverablePlaylistItem,
  PLAYLIST_RETENTION_DAYS,
} from '@/lib/playlist/PlaylistService';
import { Playlist } from '@/types/playlist';
import { useAuth } from '@/lib/auth/AuthContext';

interface PlaylistAnalyticsSectionProps {
  playlists: PlaylistAnalyticsRecord[];
}

export const PlaylistAnalyticsSection: React.FC<PlaylistAnalyticsSectionProps> = ({ playlists: analyticsPlaylists }) => {
  const { profile } = useAuth();

  // Sub-tab navigation: Active Playlists, Recovery Vault, or Analytics Leaderboards
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'recovery' | 'analytics'>('active');

  // Live and deleted playlist state
  const [livePlaylists, setLivePlaylists] = useState<Playlist[]>(() => PlaylistService.getAllPlaylists());
  const [deletedPlaylists, setDeletedPlaylists] = useState<RecoverablePlaylistItem[]>(() =>
    PlaylistService.getDeletedPlaylists()
  );

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deletion modal state
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [deleteReason, setDeleteReason] = useState('Administrative moderation');
  const [isDeleting, setIsDeleting] = useState(false);

  // Permanent purge modal state
  const [purgeTarget, setPurgeTarget] = useState<RecoverablePlaylistItem | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const syncData = () => {
    setLivePlaylists(PlaylistService.getAllPlaylists());
    setDeletedPlaylists(PlaylistService.getDeletedPlaylists());
  };

  useEffect(() => {
    syncData();
    const unsub = PlaylistService.subscribe(syncData);
    window.addEventListener('playlists-updated', syncData);
    return () => {
      unsub();
      window.removeEventListener('playlists-updated', syncData);
    };
  }, []);

  // Filter live playlists
  const filteredLivePlaylists = useMemo(() => {
    return livePlaylists.filter((pl) => {
      if (visibilityFilter !== 'all' && pl.visibility !== visibilityFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        pl.name.toLowerCase().includes(q) ||
        pl.ownerName.toLowerCase().includes(q) ||
        (pl.ownerEmail && pl.ownerEmail.toLowerCase().includes(q)) ||
        pl.id.toLowerCase().includes(q)
      );
    });
  }, [livePlaylists, searchQuery, visibilityFilter]);

  // Filter deleted playlists
  const filteredDeletedPlaylists = useMemo(() => {
    return deletedPlaylists.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.playlist.name.toLowerCase().includes(q) ||
        item.playlist.ownerName.toLowerCase().includes(q) ||
        item.removedByAdminName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [deletedPlaylists, searchQuery]);

  // Handle Deletion
  const handleConfirmDelete = () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);

    try {
      const res = PlaylistService.deletePlaylist(
        playlistToDelete.id,
        profile?.id || 'usr-admin',
        true,
        profile?.email || 'admin@8ofspadesworks.com',
        deleteReason
      );

      if (res.success) {
        showToast(`Playlist "${playlistToDelete.name}" moved to the 45-day Recovery Vault.`);
        setPlaylistToDelete(null);
        setDeleteReason('Administrative moderation');
        syncData();
      } else {
        alert(res.error || 'Failed to delete playlist');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Restore
  const handleRestorePlaylist = (item: RecoverablePlaylistItem) => {
    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Administrator',
      role: 'admin',
    };

    const res = PlaylistService.restorePlaylist(item.originalPlaylistId, adminActor);
    if (res.success) {
      showToast(`Restored "${item.playlist.name}" back to live platform!`);
      syncData();
    } else {
      alert(res.error || 'Failed to restore playlist');
    }
  };

  // Handle Permanent Purge
  const handleConfirmPurge = () => {
    if (!purgeTarget) return;

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.email || 'Administrator',
      role: 'admin',
    };

    const res = PlaylistService.permanentlyPurgePlaylist(purgeTarget.originalPlaylistId, adminActor);
    if (res.success) {
      showToast(`Permanently deleted "${purgeTarget.playlist.name}".`);
      setPurgeTarget(null);
      syncData();
    } else {
      alert(res.error || 'Failed to purge playlist');
    }
  };

  // Analytics rankings
  const topSongsInPlaylists = AnalyticsAggregator.computeTopSongsInPlaylists();

  const topPlaylistRankingItems: RankingItem[] = analyticsPlaylists.map((pl, idx) => ({
    id: pl.id,
    rank: idx + 1,
    title: pl.title,
    subtitle: `Curated by ${pl.creator} • ${pl.itemCount} items`,
    coverUrl: pl.coverUrl,
    value: pl.plays,
    displayValue: pl.plays >= 1000 ? `${(pl.plays / 1000).toFixed(1)}k plays` : `${pl.plays} plays`,
    trendPercent: pl.trendPercent,
    secondaryMetric: `${pl.followers.toLocaleString()} followers`,
  }));

  const topSongsRankingItems: RankingItem[] = topSongsInPlaylists.map((song, idx) => ({
    id: `pl-song-${idx}`,
    rank: idx + 1,
    title: song.title,
    subtitle: song.artist,
    value: song.addCount,
    displayValue: `${song.addCount.toLocaleString()} adds`,
    trendPercent: 0,
    secondaryMetric: `${song.playlistInclusionRate}% in crates`,
  }));

  const totalLiveItems = livePlaylists.reduce((acc, p) => acc + (p.itemCount || 0), 0);
  const totalLivePlays = livePlaylists.reduce((acc, p) => acc + (p.stats?.plays || 0), 0);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Stat Deck */}
      <div className="p-6 rounded-3xl glass-panel border border-brand-gold/20 bg-gradient-to-br from-neutral-950 via-neutral-900 to-brand-gold/5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold text-[11px] font-bold uppercase tracking-wider">
              <ListMusic className="w-3.5 h-3.5 text-brand-gold" />
              <span>Crate & Playlist Operations</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
              Playlist Management, Moderation & Recovery
            </h2>
            <p className="text-xs text-neutral-400">
              Manage member and curator playlists, delete non-compliant crates, and restore deleted collections from the 45-day quarantine vault.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/playlists"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-brand-gold" />
              <span>Public Crates View</span>
            </Link>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Live Playlists</span>
            <span className="text-xl sm:text-2xl font-black text-white">{livePlaylists.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Playlist Items</span>
            <span className="text-xl sm:text-2xl font-black text-brand-gold">{totalLiveItems}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Plays</span>
            <span className="text-xl sm:text-2xl font-black text-white">{totalLivePlays.toLocaleString()}</span>
          </div>
          <div
            onClick={() => setActiveSubTab('recovery')}
            className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/15 transition-all group"
          >
            <span className="text-[10px] font-mono uppercase text-amber-300 block flex items-center justify-between">
              <span>In Recovery Vault</span>
              <RotateCcw className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-180 transition-transform duration-500" />
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-400">{deletedPlaylists.length}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'active'
              ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Active Playlists ({livePlaylists.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recovery')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'recovery'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>45-Day Recovery Vault ({deletedPlaylists.length})</span>
          {deletedPlaylists.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
              {deletedPlaylists.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeSubTab === 'analytics'
              ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Engagement Analytics & Leaderboards</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 1: ACTIVE LIVE PLAYLISTS                                */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeSubTab === 'active' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by playlist name, curator, or email..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase text-neutral-400">Visibility:</span>
              {(['all', 'public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibilityFilter(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    visibilityFilter === v
                      ? 'bg-white/15 text-white border border-white/25'
                      : 'bg-white/5 text-neutral-400 hover:text-white border border-transparent'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Active Playlists Table */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-brand-gold" />
                  <span>Platform Crates & Member Playlists ({filteredLivePlaylists.length})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Select &quot;Delete Playlist&quot; to safely quarantine any non-compliant or deleted collection into the 45-day Recovery Vault.
                </p>
              </div>
            </div>

            {filteredLivePlaylists.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <ListMusic className="w-10 h-10 text-neutral-600 mx-auto" />
                <p className="text-sm font-bold text-neutral-400">No active playlists match your search filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                      <th className="py-3 px-3">Playlist</th>
                      <th className="py-3 px-3">Curator</th>
                      <th className="py-3 px-3">Visibility</th>
                      <th className="py-3 px-3 text-right">Items</th>
                      <th className="py-3 px-3 text-right">Duration</th>
                      <th className="py-3 px-3 text-right">Plays</th>
                      <th className="py-3 px-3 text-right">Likes</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredLivePlaylists.map((pl) => (
                      <tr key={pl.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900 shadow-md">
                              <Image src={pl.coverUrl} alt={pl.name} fill className="object-cover" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white font-sans truncate block group-hover:text-brand-gold transition-colors">
                                {pl.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono block">
                                Type: {pl.type} • ID: {pl.id.slice(0, 12)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-sans">
                          <span className="text-neutral-200 font-bold block">{pl.ownerName}</span>
                          {pl.ownerEmail && (
                            <span className="text-[10px] text-neutral-400 font-mono block truncate">
                              {pl.ownerEmail}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-sans">
                          {pl.visibility === 'public' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                              <Globe className="w-3 h-3" />
                              <span>Public</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-500/15 border border-neutral-500/30 text-neutral-300 text-[10px] font-bold">
                              <Lock className="w-3 h-3" />
                              <span>Private</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-neutral-300">
                          {pl.itemCount}
                        </td>

                        <td className="py-3 px-3 text-right text-neutral-400">
                          {Math.floor(pl.totalDuration / 60)}:
                          {String(pl.totalDuration % 60).padStart(2, '0')}
                        </td>

                        <td className="py-3 px-3 text-right text-brand-gold font-bold">
                          {(pl.stats?.plays || 0).toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-right text-rose-400">
                          {(pl.stats?.likes || 0).toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-right font-sans">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/playlists/${pl.id}`}
                              target="_blank"
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
                              title="View Playlist in Platform"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            <button
                              onClick={() => setPlaylistToDelete(pl)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer"
                              title="Delete Playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 2: 45-DAY RECOVERY VAULT (DELETED PLAYLISTS)            */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeSubTab === 'recovery' && (
        <div className="space-y-4">
          {/* Recovery Information Banner */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 block">
                45-Day Safe Quarantine & Restoration Vault
              </span>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                When a playlist is deleted, it is safely moved here and quarantined for 45 days. Restoring a playlist immediately reinstates it back onto the live platform with all of its tracks, sequence order, and follower metrics completely intact.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deleted playlists..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Deleted Playlists Table */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  <span>Quarantined Playlists ({filteredDeletedPlaylists.length})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  1-click instant restoration back to active member catalog.
                </p>
              </div>
            </div>

            {filteredDeletedPlaylists.length === 0 ? (
              <div className="py-14 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
                <p className="text-sm font-bold text-neutral-300">No playlists currently in the recovery vault</p>
                <p className="text-xs text-neutral-500">Deleted playlists will be preserved here for 45 days with instant restoration</p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                      <th className="py-3 px-3">Playlist</th>
                      <th className="py-3 px-3">Curator</th>
                      <th className="py-3 px-3">Deletion Details</th>
                      <th className="py-3 px-3">Retention</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {filteredDeletedPlaylists.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900 shadow-md opacity-80 group-hover:opacity-100 transition-opacity">
                              <Image src={item.playlist.coverUrl} alt={item.playlist.name} fill className="object-cover" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white font-sans truncate block">
                                {item.playlist.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono block">
                                {item.playlist.itemCount} items • {item.playlist.type}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-sans">
                          <span className="text-neutral-200 font-bold block">{item.playlist.ownerName}</span>
                          <span className="text-[10px] text-neutral-400 font-mono block">{item.playlist.ownerEmail}</span>
                        </td>

                        <td className="py-3 px-3 font-sans">
                          <span className="text-xs text-neutral-300 block">
                            Removed by: <span className="font-bold text-brand-gold">{item.removedByAdminName}</span>
                          </span>
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            Reason: {item.reason || 'Administrative action'}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono block">
                            Date: {new Date(item.removedAt).toLocaleDateString()}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-sans">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{item.daysRemaining} days left</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-sans">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleRestorePlaylist(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore Playlist</span>
                            </button>

                            <button
                              onClick={() => setPurgeTarget(item)}
                              className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Permanently Purge"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB 3: ENGAGEMENT ANALYTICS & LEADERBOARDS                  */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-8">
          {/* Top Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarRankingChart
              title="Top Playlists & Community Crates"
              subtitle="Highest streamed user & curator breakbeat playlist collections"
              items={topPlaylistRankingItems}
              icon={ListMusic}
              barColor="from-amber-400 via-orange-500 to-brand-purple"
            />

            <BarRankingChart
              title="Most Frequently Added Songs to Playlists"
              subtitle="Tracks with highest community inclusion frequency across all crates"
              items={topSongsRankingItems}
              icon={Plus}
              barColor="from-brand-purple via-brand-neon to-brand-gold"
            />
          </div>

          {/* Playlist Detailed Performance Table */}
          <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-brand-gold" />
                  Playlist Engagement, Shares & Curation Metrics
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Tracks total playlist streams, social shares, community likes, and follower growth
                </p>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Playlist Title</th>
                    <th className="py-3 px-3">Curator</th>
                    <th className="py-3 px-3 text-right">Items</th>
                    <th className="py-3 px-3 text-right">Total Plays</th>
                    <th className="py-3 px-3 text-right">Followers</th>
                    <th className="py-3 px-3 text-right">Shares</th>
                    <th className="py-3 px-3 text-right">Likes</th>
                    <th className="py-3 px-3 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {analyticsPlaylists.map((pl, idx) => (
                    <tr key={pl.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-2 text-neutral-400 font-bold">#{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                            <Image src={pl.coverUrl} alt={pl.title} fill className="object-cover" />
                          </div>
                          <span className="font-bold text-white font-sans truncate group-hover:text-brand-gold transition-colors">
                            {pl.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-neutral-300 font-sans">{pl.creator}</td>
                      <td className="py-3 px-3 text-right text-neutral-400">{pl.itemCount}</td>
                      <td className="py-3 px-3 text-right font-bold text-white">{pl.plays.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-brand-gold font-bold">
                        {pl.followers.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-400">{pl.shares.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-rose-400">{pl.likes.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-emerald-400">+{pl.trendPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE PLAYLIST CONFIRMATION                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border border-red-500/30 bg-neutral-950 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white font-display">Delete Playlist</h3>
                  <span className="text-xs text-neutral-400 font-mono">Move to 45-Day Recovery Vault</span>
                </div>
              </div>
              <button
                onClick={() => setPlaylistToDelete(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Summary */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/15 bg-neutral-900 shrink-0">
                <Image src={playlistToDelete.coverUrl} alt={playlistToDelete.name} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-white truncate">{playlistToDelete.name}</h4>
                <p className="text-xs text-neutral-300">
                  Curated by {playlistToDelete.ownerName} • {playlistToDelete.itemCount} items
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-xs text-neutral-300 space-y-1">
              <p className="font-bold text-red-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Quarantine Protection:</span>
              </p>
              <p className="text-[11px] text-neutral-300">
                This playlist will be removed from all public crates and member discovery feeds immediately, but will be safely stored in the 45-day Recovery Vault where you can restore it anytime.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Reason for Removal:</label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Creator request, duplicate crate, moderation"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPlaylistToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Deletion'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* MODAL: PERMANENT PURGE CONFIRMATION                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel p-6 sm:p-8 border border-red-500/50 bg-neutral-950 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white font-display">Permanent Purge</h3>
                <span className="text-xs text-red-400 font-mono">Irreversible Action</span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">&quot;{purgeTarget.playlist.name}&quot;</strong> from the platform and storage? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPurgeTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 cursor-pointer"
              >
                Permanently Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
