'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Disc3, ArrowLeft, MessageSquare, Share2 } from 'lucide-react';
import { Album, Track } from '@/types/media';
import { MOCK_ALBUMS, MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { TrackRow } from '@/components/media/TrackRow';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { CommentSection } from '@/components/comments/CommentSection';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = (params?.id as string) || '';
  const { playTrack } = usePlayer();

  const [album, setAlbum] = useState<Album>(MOCK_ALBUMS[0]);
  const [albumTracks, setAlbumTracks] = useState<Track[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const found =
        MusicCatalogService.getAlbumById(albumId) ||
        MOCK_ALBUMS.find((a) => a.id === albumId) ||
        MOCK_ALBUMS[0];
      setAlbum(found);

      const tracks = MusicCatalogService.getAlbumTracks(albumId);
      if (tracks.length > 0) {
        setAlbumTracks(tracks);
      } else {
        setAlbumTracks(MOCK_TRACKS.filter((t) => found.trackIds.includes(t.id)));
      }
    };

    refresh();
    const unsub = MusicCatalogService.subscribe(refresh);
    return () => unsub();
  }, [albumId]);

  const totalDurationSecs = albumTracks.reduce((acc, t) => acc + (t.duration || 180), 0);
  const totalMins = Math.floor(totalDurationSecs / 60);

  const resolvedCover = MusicCatalogService.resolveAlbumCover(album);

  const handlePlayAlbum = () => {
    if (albumTracks.length > 0) {
      playTrack(albumTracks[0], albumTracks.slice(1));
    }
  };

  return (
    <div className="space-y-8 py-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/albums'))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* Header */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-8 bg-white/5 shadow-2xl">
        <div className="relative w-48 h-48 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 bg-black/80 flex items-center justify-center">
          {/* Ambient blurred backdrop */}
          <Image
            src={resolvedCover}
            alt=""
            fill
            className="object-cover blur-xl opacity-40 scale-125 pointer-events-none"
            priority
            unoptimized
          />
          {/* Crisp uncropped foreground */}
          <Image
            src={resolvedCover}
            alt={album.title}
            fill
            className="object-contain p-2"
            priority
            unoptimized
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider">
            <Disc3 className="w-3.5 h-3.5" />
            {album.genre || 'Album Release'}
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{album.title}</h1>
            <Link
              href={`/artists/${album.artistId}`}
              className="text-lg text-brand-neon font-semibold hover:underline block mt-1"
            >
              {album.artistName}
            </Link>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Released {album.releaseYear || 2026} • {albumTracks.length} tracks ({totalMins} mins)
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <button
              onClick={handlePlayAlbum}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:scale-105 transition-transform"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              Play Album
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
              title="Share Album & Text Message"
            >
              <Share2 className="w-4 h-4 text-brand-gold" />
              <span>Share Album</span>
            </button>

            {(() => {
              const albumKey = buildCanonicalContentKey('album', album.title, album.artistName);
              const count = SocialCommentService.getCommentCount(album.id, albumKey);
              return (
                <>
                  <ReactionButtons
                    contentId={album.id}
                    contentKey={albumKey}
                    contentType="album"
                    contentTitle={`${album.title} - ${album.artistName}`}
                    contextLocation="Album Deep Dive Page"
                    initialLikes={album.likeCount}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('album-comments-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold font-bold text-xs transition-all shadow-md cursor-pointer"
                    title={`${count} Discussion Comments & Threads`}
                  >
                    <MessageSquare className="w-4 h-4 text-brand-gold" />
                    <span className="font-mono text-brand-gold font-black">{count}</span>
                    <span className="hidden sm:inline">Threads</span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Track Listing ({albumTracks.length})
          </h3>
          <span className="text-xs text-neutral-400">
            Click any song to play individually or play the full album above
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {albumTracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              showCover={false}
              contextTracks={albumTracks}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-white/5 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-gold">About this Album</h3>
        <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">
          {album.description || `Album collection featuring ${albumTracks.length} tracks by ${album.artistName}.`}
        </p>
      </div>

      {/* Comments */}
      <div id="album-comments-section" className="pt-2">
        <CommentSection
          contentId={album.id}
          contentKey={buildCanonicalContentKey('album', album.title, album.artistName)}
          contentType="album"
          contentTitle={`${album.title} - ${album.artistName}`}
        />
      </div>

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'album',
            item: album,
          }}
        />
      )}
    </div>
  );
}
