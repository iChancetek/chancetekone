'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Play, ArrowUpRight, ListMusic } from 'lucide-react';
import { Playlist } from '@/types/playlist';
import { PlaylistService } from '@/lib/playlist/PlaylistService';
import { usePlayer } from '@/lib/player/PlayerContext';

/**
 * Displays Public Member Playlists directly on the Home page so any visitor
 * or member can immediately discover and stream community-created public playlists.
 */
export const PublicPlaylistsShelf: React.FC = () => {
  const { playPlaylist } = usePlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    const sync = () => {
      const pub = PlaylistService.getPublicPlaylists({ sortBy: 'recent' });
      setPlaylists(pub.slice(0, 8));
    };
    sync();
    void PlaylistService.syncFromServer(true);
    const unsub = PlaylistService.subscribe(sync);
    window.addEventListener('playlists-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      unsub();
      window.removeEventListener('playlists-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (playlists.length === 0) return null;

  return (
    <section className="glass-panel p-5 sm:p-7 rounded-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-brand-gold/15 border border-emerald-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Public Member Playlists
            </h3>
            <p className="text-xs text-neutral-400">
              Open community playlists created by ChanceTEK One members · Tap to stream
            </p>
          </div>
        </div>

        <Link
          href="/playlists"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.05] hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/40 text-xs font-bold text-brand-gold transition-all"
        >
          <span>All Playlists</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="group glass-card p-3 sm:p-3.5 rounded-2xl border border-white/5 hover:border-brand-gold/40 transition-all flex flex-col justify-between"
          >
            <Link href={`/playlists/${pl.id}`} className="block">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 border border-white/10 bg-black/50">
                <Image
                  src={pl.coverUrl || '/images/studio_cover.jpg'}
                  alt={pl.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Public</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    playPlaylist(pl);
                  }}
                  disabled={pl.items.length === 0}
                  aria-label={`Play ${pl.name}`}
                  className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black flex items-center justify-center shadow-[0_6px_20px_rgba(245,158,11,0.55)] hover:scale-110 active:scale-95 transition-transform disabled:opacity-40 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                {pl.name}
              </h4>
            </Link>

            <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-neutral-400">
              <span className="truncate">By {pl.ownerName}</span>
              <span className="inline-flex items-center gap-1 text-brand-neon font-mono shrink-0">
                <ListMusic className="w-3 h-3" />
                {pl.itemCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

