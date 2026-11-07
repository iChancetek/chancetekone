'use client';

import React, { useState } from 'react';
import { AnalyticsEvent } from '@/types/analytics';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import {
  Radio,
  Play,
  Pause,
  Zap,
  Sparkles,
  MapPin,
  Clock,
  Filter,
  Music,
  ShoppingBag,
  Video,
  BookOpen,
  User,
  Shield,
} from 'lucide-react';

interface LiveActivitySectionProps {
  events: AnalyticsEvent[];
  isSimulating?: boolean;
  onToggleSimulating?: () => void;
}

export const LiveActivitySection: React.FC<LiveActivitySectionProps> = ({
  events,
}) => {
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const displayEvents = [...events].reverse().filter((e) => {
    if (selectedAreaFilter === 'all') return true;
    return e.platformArea.toLowerCase() === selectedAreaFilter.toLowerCase();
  });

  const getEventBadge = (type: string) => {
    if (type.startsWith('SONG') || type.startsWith('ALBUM')) {
      return { bg: 'bg-brand-purple/20 text-brand-neon border-brand-purple/40', icon: Music };
    }
    if (type.startsWith('MERCH')) {
      return { bg: 'bg-brand-gold/20 text-brand-gold border-brand-gold/40', icon: ShoppingBag };
    }
    if (type.startsWith('VIDEO')) {
      return { bg: 'bg-red-500/20 text-red-300 border-red-500/40', icon: Video };
    }
    if (type.startsWith('AUDIOBOOK')) {
      return { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: BookOpen };
    }
    if (type.startsWith('USER') || type.startsWith('AUTH')) {
      return { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: User };
    }
    return { bg: 'bg-white/10 text-neutral-300 border-white/20', icon: Shield };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Control Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4 bg-gradient-to-r from-brand-purple/20 via-[#120a22] to-brand-gold/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">Live Platform Telemetry Stream</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/20 text-emerald-400 border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  100% Real Events Only
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Recording authentic actions across music playback, video watching, crate playlists, and user sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => AnalyticsEngine.clearEvents()}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-bold transition-all"
            >
              Reset Event Log
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-1">Area:</span>
            {[
              { id: 'all', label: 'All Events' },
              { id: 'music', label: 'Music' },
              { id: 'merch', label: 'Merchandise' },
              { id: 'videos', label: 'Videos' },
              { id: 'audiobooks', label: 'Audiobooks' },
              { id: 'playlists', label: 'Playlists' },
              { id: 'auth', label: 'Auth' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedAreaFilter(tab.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedAreaFilter === tab.id
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="font-mono text-neutral-400 text-[11px]">
            Buffer Depth: {displayEvents.length} events
          </span>
        </div>
      </div>

      {/* Real-Time Live Feed Stream List */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Real-Time Activity Velocity Stream
          </h3>
          <span className="text-xs text-brand-gold font-mono">Status: Connected to ChanceTEK One socket</span>
        </div>

        <div className="space-y-2.5 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
          {displayEvents.map((evt, idx) => {
            const { bg, icon: EventIcon } = getEventBadge(evt.eventType);
            const isLatest = idx === 0;

            return (
              <div
                key={evt.id}
                className={`p-3.5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLatest
                    ? 'bg-gradient-to-r from-brand-purple/25 via-[#18122c] to-brand-gold/10 border-brand-purple/50 shadow-lg scale-[1.01]'
                    : 'bg-white/5 hover:bg-white/10 border-white/5'
                }`}
              >
                {/* Event Left Description */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                    <EventIcon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs truncate">{evt.action}</span>
                      <span className={`px-2 py-0.2 rounded text-[9px] font-mono font-bold border ${bg}`}>
                        {evt.eventType}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 font-mono mt-0.5">
                      <span>User: {evt.userName || (evt.userId ? 'Authenticated' : 'Anonymous Guest')}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-gold" />
                        {evt.geo.city}, {evt.geo.countryCode} ({evt.geo.ip})
                      </span>
                      <span>Area: {evt.platformArea}</span>
                    </div>
                  </div>
                </div>

                {/* Event Timestamp */}
                <div className="text-right shrink-0 font-mono text-[11px] text-neutral-400">
                  <span className="text-white font-semibold">
                    {new Date(evt.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span className="text-neutral-500 block text-[10px]">
                    {new Date(evt.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
