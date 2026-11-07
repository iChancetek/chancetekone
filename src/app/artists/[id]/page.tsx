'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Play, CheckCircle, Users, Disc3, Video as VideoIcon, ShoppingBag, Heart, ArrowLeft, MessageSquare, Share2 } from 'lucide-react';
import { MOCK_ARTISTS, MOCK_TRACKS, MOCK_ALBUMS, MOCK_VIDEOS, MOCK_PRODUCTS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { Track, Album, Artist, Video as VideoItem } from '@/types/media';
import { usePlayer } from '@/lib/player/PlayerContext';
import { TrackRow } from '@/components/media/TrackRow';
import { MediaCard } from '@/components/media/MediaCard';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { CommentSection } from '@/components/comments/CommentSection';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

export default function ArtistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const artistId = params.id as string;
  const { playTrack } = usePlayer();

  const [isFollowing, setIsFollowing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [allTracks, setAllTracks] = useState<Track[]>(() => MusicCatalogService.getAllTracks());
  const [allAlbums, setAllAlbums] = useState<Album[]>(() => MusicCatalogService.getAllAlbums());
  const [allVideos, setAllVideos] = useState<VideoItem[]>(() => MediaCatalogService.getAllVideos());

  useEffect(() => {
    const syncData = () => {
      setAllTracks(MusicCatalogService.getAllTracks());
      setAllAlbums(MusicCatalogService.getAllAlbums());
      setAllVideos(MediaCatalogService.getAllVideos());
    };
    syncData();
    const unsubMusic = MusicCatalogService.subscribe(syncData);
    const unsubMedia = MediaCatalogService.subscribe(syncData);
    return () => {
      unsubMusic();
      unsubMedia();
    };
  }, []);

  const matchingMock = MOCK_ARTISTS.find(
    (a) => a.id === artistId || a.id.toLowerCase() === artistId.toLowerCase()
  );

  const artistTracks = allTracks.filter(
    (t) =>
      t.artistId === artistId ||
      (matchingMock && t.artistId === matchingMock.id) ||
      (matchingMock && t.artistName && t.artistName.toLowerCase().trim() === matchingMock.name.toLowerCase().trim()) ||
      (t.artistName && t.artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-') === artistId.replace(/^artist-/, ''))
  );

  const fallbackName =
    artistTracks[0]?.artistName ||
    artistId
      .replace(/^artist-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const artist: Artist = matchingMock || {
    id: artistId,
    name: fallbackName,
    label: artistTracks[0]?.label || 'ChanceTEKone',
    bio: `Official artist profile and discography on ChanceTEKone.`,
    avatarUrl:
      artistTracks[0]?.coverUrl && !artistTracks[0].coverUrl.includes('logo.png') && !artistTracks[0].coverUrl.includes('chancetekone_banner.png')
        ? artistTracks[0].coverUrl
        : '/images/genres/rnb-neo-soul.jpg',
    bannerUrl:
      artistTracks[0]?.coverUrl && !artistTracks[0].coverUrl.includes('logo.png') && !artistTracks[0].coverUrl.includes('chancetekone_banner.png')
        ? artistTracks[0].coverUrl
        : '/images/genres/rnb-neo-soul.jpg',
    genres: [artistTracks[0]?.genre || 'R&B / Soul'],
    followerCount: 0,
    popularTrackIds: artistTracks.slice(0, 5).map((t) => t.id),
    verified: true,
  };

  const artistAlbums = allAlbums.filter(
    (a) =>
      a.artistId === artist.id ||
      (a.artistName && a.artistName.toLowerCase().trim() === artist.name.toLowerCase().trim())
  );
  const artistVideos = allVideos.filter(
    (v) =>
      v.artistId === artist.id ||
      (v.artistName && v.artistName.toLowerCase().trim() === artist.name.toLowerCase().trim())
  );
  const artistMerch = MOCK_PRODUCTS.filter((p) => p.artistId === artist.id || p.artistId === 'artist-1');

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/artists');
    }
  };

  return (
    <div className="space-y-8 py-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          title="Return to Previous Page"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* Artist Hero Spotlight */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 min-h-[300px] sm:min-h-[380px] p-6 sm:p-10 flex flex-col justify-end shadow-2xl bg-gradient-to-t from-[#0c0c16] via-[#0c0c16]/70 to-transparent">
        {/* Banner image background */}
        <div className="absolute inset-0 -z-10">
          <Image
            src={artist.bannerUrl}
            alt={artist.name}
            fill
            className="object-cover opacity-40 blur-[2px]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/60 to-transparent" />
        </div>

        {/* Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 z-10">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-brand-gold shadow-2xl flex-shrink-0">
            <Image src={artist.avatarUrl} alt={artist.name} fill className="object-cover" />
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                Verified Artist
              </span>
              {artist.verified && <CheckCircle className="w-4 h-4 text-brand-gold fill-current" />}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white">{artist.name}</h1>
            {artist.label && artist.label !== artist.name && (
              <p className="text-sm sm:text-base font-bold text-brand-gold tracking-wide">
                {artist.label}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-xs sm:text-sm text-neutral-300 max-w-xl">{artist.bio}</p>
              <VoiceNarrationButton
                text={`${artist.name}. ${artist.label ? `Label: ${artist.label}. ` : ''}${artist.bio}`}
                variant="dual"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {artistTracks.length > 0 && (
                <button
                  onClick={() => playTrack(artistTracks[0], artistTracks.slice(1))}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  Play All
                </button>
              )}

              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold border transition-all ${
                  isFollowing
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow Artist'}
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
                title="Share Artist & Text Message"
              >
                <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                <span>Share Artist</span>
              </button>

              <span className="text-xs text-neutral-400 font-mono">
                {artist.followerCount.toLocaleString()} followers
              </span>

              {(() => {
                const artKey = buildCanonicalContentKey('artist', artist.name);
                const count = SocialCommentService.getCommentCount(artist.id, artKey);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('artist-comments-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/5 hover:bg-brand-gold/15 border border-white/10 hover:border-brand-gold/30 text-neutral-300 hover:text-brand-gold font-bold text-xs transition-all cursor-pointer"
                    title={`${count} Discussion Comments & Threads`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                    <span className="font-mono text-brand-gold font-black">{count}</span>
                    <span className="hidden sm:inline">Threads</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Popular Tracks */}
      <section className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4 bg-white/5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">Popular Tracks</h3>
        <div className="divide-y divide-white/5">
          {artistTracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              contextTracks={artistTracks}
            />
          ))}
        </div>
      </section>

      {/* Discography */}
      {artistAlbums.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Albums & EPs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {artistAlbums.map((album) => (
              <MediaCard key={album.id} item={album} type="album" />
            ))}
          </div>
        </section>
      )}

      {/* Videos */}
      {artistVideos.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Videos & Sets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {artistVideos.map((video) => (
              <MediaCard key={video.id} item={video} type="video" />
            ))}
          </div>
        </section>
      )}

      {/* Official Merch */}
      {artistMerch.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Official Merch</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {artistMerch.map((prod) => (
              <Link
                key={prod.id}
                href={`/merch/${prod.id}`}
                className="glass-card p-3 rounded-2xl flex flex-col justify-between group block"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3 border border-white/5">
                  <Image src={prod.images[0]} alt={prod.title} fill className="object-cover" />
                </div>
                <h4 className="text-xs font-semibold text-white truncate">{prod.title}</h4>
                <p className="text-xs text-brand-gold font-mono font-bold mt-1">${prod.price} USD</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Community Comments & Discussion Threads */}
      <div id="artist-comments-section" className="pt-2">
        <CommentSection
          contentId={artist.id}
          contentKey={buildCanonicalContentKey('artist', artist.name)}
          contentType="artist"
          contentTitle={artist.name}
        />
      </div>

      {showShareModal && (
        <UniversalShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          entity={{
            type: 'artist',
            item: artist,
          }}
        />
      )}
    </div>
  );
}
