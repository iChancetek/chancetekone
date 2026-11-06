'use client';

import React, { useState, useEffect } from 'react';
import {
  EngagementMetricsService,
  AuthenticLikeEvent,
  EngagementSummary,
  ContentPillar,
} from '@/lib/analytics/EngagementMetricsService';
import {
  Heart,
  Flame,
  Music,
  Video,
  BookOpen,
  ListMusic,
  Disc3,
  Users,
  Search,
  Filter,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  Radio,
  Trash2,
  TrendingUp,
} from 'lucide-react';

interface HeartsLikesTelemetrySectionProps {
  onNavigateToTab?: (tab: string) => void;
}

export const HeartsLikesTelemetrySection: React.FC<HeartsLikesTelemetrySectionProps> = ({
  onNavigateToTab,
}) => {
  const [summary, setSummary] = useState<EngagementSummary>(() =>
    EngagementMetricsService.getMetricsSummary()
  );
  const [events, setEvents] = useState<AuthenticLikeEvent[]>(() =>
    EngagementMetricsService.getAllEvents()
  );
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const handleUpdate = () => {
      setSummary(EngagementMetricsService.getMetricsSummary());
      setEvents(EngagementMetricsService.getAllEvents());
    };

    const unsubscribe = EngagementMetricsService.subscribe(handleUpdate);
    return () => unsubscribe();
  }, []);

  const filteredEvents = events.filter((e) => {
    const matchesPillar =
      selectedPillar === 'all' || e.contentType.toLowerCase() === selectedPillar.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      e.contentTitle.toLowerCase().includes(query) ||
      e.userName.toLowerCase().includes(query) ||
      (e.userEmail && e.userEmail.toLowerCase().includes(query)) ||
      e.contextLocation.toLowerCase().includes(query);
    return matchesPillar && matchesSearch;
  });

  const getPillarBadge = (pillar: ContentPillar) => {
    switch (pillar) {
      case 'music':
        return {
          bg: 'bg-brand-purple/20 text-brand-neon border-brand-purple/40',
          icon: Music,
          label: 'Music Track',
        };
      case 'video':
        return {
          bg: 'bg-red-500/20 text-red-300 border-red-500/40',
          icon: Video,
          label: '4K Video',
        };
      case 'audiobook':
        return {
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: BookOpen,
          label: 'Audiobook',
        };
      case 'podcast':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: Radio,
          label: 'Podcast',
        };
      case 'playlist':
        return {
          bg: 'bg-brand-gold/20 text-brand-gold border-brand-gold/40',
          icon: ListMusic,
          label: 'Playlist / Crate',
        };
      case 'album':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: Disc3,
          label: 'Album',
        };
      default:
        return {
          bg: 'bg-white/10 text-neutral-300 border-white/20',
          icon: Sparkles,
          label: pillar,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-[#180a22]/70 to-[#0e0416] relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/20">
              <Heart className="w-6 h-6 fill-current animate-pulse text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white">Authentic Hearts & Likes Telemetry</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  100% Real User Generated Only
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 max-w-2xl">
                Real-time tracking of every heart and like selected by verified users and platform listeners.
                Zero synthetic data or fake bot numbers — all counts reflect genuine community interactions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs font-mono text-neutral-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              Buffer: <strong className="text-white">{events.length}</strong> real events
            </span>
          </div>
        </div>
      </div>

      {/* 6 Key Engagement KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl glass-panel border border-rose-500/30 bg-rose-500/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Total Hearts</span>
            <Heart className="w-4 h-4 text-rose-400 fill-current" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{summary.totalAuthenticHearts.toLocaleString()}</p>
          <span className="text-[10px] text-neutral-400 block font-sans">Active genuine hearts</span>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-brand-purple/30 bg-brand-purple/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">Music Songs</span>
            <Music className="w-4 h-4 text-brand-neon" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{summary.byContentType.music.toLocaleString()}</p>
          <span className="text-[10px] text-neutral-400 block font-sans">Track interactions</span>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-red-500/30 bg-red-500/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">4K Videos</span>
            <Video className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{summary.byContentType.video.toLocaleString()}</p>
          <span className="text-[10px] text-neutral-400 block font-sans">Video likes</span>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-blue-500/30 bg-blue-500/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">Audiobooks</span>
            <BookOpen className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {(summary.byContentType.audiobook + summary.byContentType.podcast).toLocaleString()}
          </p>
          <span className="text-[10px] text-neutral-400 block font-sans">Audio & Podcast hearts</span>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-brand-gold/30 bg-brand-gold/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold">Playlists</span>
            <ListMusic className="w-4 h-4 text-brand-gold" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{summary.byContentType.playlist.toLocaleString()}</p>
          <span className="text-[10px] text-neutral-400 block font-sans">Crate likes</span>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/30 bg-emerald-500/5 space-y-1">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Unique Users</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{summary.uniqueActiveUsers.toLocaleString()}</p>
          <span className="text-[10px] text-neutral-400 block font-sans">Individual accounts</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/5 bg-white/5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-brand-gold" />
            Media Filter:
          </span>
          {[
            { id: 'all', label: 'All Content' },
            { id: 'music', label: 'Music Tracks' },
            { id: 'video', label: '4K Videos' },
            { id: 'audiobook', label: 'Audiobooks' },
            { id: 'podcast', label: 'Podcasts' },
            { id: 'playlist', label: 'Playlists' },
            { id: 'album', label: 'Albums' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedPillar(pill.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedPillar === pill.id
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user, title or surface..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-400"
          />
        </div>
      </div>

      {/* Real-time Interaction Event Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400 fill-current" />
              Verified Real-Time User Engagement Log
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live audit record detailing the exact user, content piece, surface location, and date/time of every like.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Displaying {filteredEvents.length} events
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <Heart className="w-6 h-6 text-rose-400" />
            </div>
            <h4 className="text-sm font-bold text-white">No Fake or Synthetic Hearts Found</h4>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              All synthetic numbers have been purged. This log will populate in real time as registered users and
              listeners click the Heart or Fire button across music players, album pages, 4K videos, and playlists.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">User Name & Account</th>
                  <th className="py-3 px-3">Content Title</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Where Liked (Surface)</th>
                  <th className="py-3 px-3 text-center">Action</th>
                  <th className="py-3 px-3 text-right">Time & Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {filteredEvents.map((evt, idx) => {
                  const badge = getPillarBadge(evt.contentType);
                  const BadgeIcon = badge.icon;
                  const isPositive = evt.isLiked;

                  return (
                    <tr key={evt.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-3 text-neutral-500 font-bold">#{idx + 1}</td>

                      {/* User Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-purple/30 border border-brand-purple/50 flex items-center justify-center text-[10px] font-black text-brand-gold shrink-0">
                            {evt.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white font-sans block truncate max-w-[160px]">
                              {evt.userName}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono block">
                              {evt.userEmail || evt.userId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Content Title */}
                      <td className="py-3 px-3 font-sans">
                        <span className="font-bold text-white group-hover:text-brand-gold transition-colors block truncate max-w-[220px]">
                          {evt.contentTitle}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">ID: {evt.contentId}</span>
                      </td>

                      {/* Content Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Where Liked (Context Location) */}
                      <td className="py-3 px-3 text-neutral-300 font-sans">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px] text-neutral-300">
                          <MapPin className="w-3 h-3 text-brand-gold shrink-0" />
                          <span className="truncate max-w-[150px]">{evt.contextLocation}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        {isPositive ? (
                          evt.reactionType === 'fire' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                              🔥 Dropped Fire
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                              ❤️ Hearted
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-white/10 text-[10px] font-bold">
                            💔 Removed
                          </span>
                        )}
                      </td>

                      {/* Timestamp & Date */}
                      <td className="py-3 px-3 text-right">
                        <span className="text-white font-bold block">{evt.formattedDateTime}</span>
                        <span className="text-neutral-500 text-[10px] block">
                          {new Date(evt.timestamp).toISOString().split('T')[0]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
