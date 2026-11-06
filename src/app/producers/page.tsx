'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sliders,
  CheckCircle2,
  Disc3,
  Flame,
  Wrench,
  Music,
  ExternalLink,
  Sparkles,
  Play,
  Layers,
  ArrowRight,
  Trash2,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { Producer } from '@/types/media';
import { MOCK_TRACKS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAI } from '@/lib/ai/AIContext';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { CommentSection } from '@/components/comments/CommentSection';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

const PRODUCERS_PAGE_NARRATION = `Producers and Sonic Architects Directory for 8 OF SPADES WORKS and Return of the Break Beats. Featuring master beatmakers, hardware sampler specialists, analog tape engineers, and sound designers shaping the breakbeat renaissance with E-mu SP-1200 and Akai MPC60 hardware crunch.`;

export default function ProducersPage() {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { profile, isAdmin } = useAuth();
  const { openAI } = useAI();
  const [selectedGearFilter, setSelectedGearFilter] = useState<string>('all');
  const [producers, setProducers] = useState<Producer[]>(() => ProducerCatalogService.getAllProducers());
  const [discussionProducer, setDiscussionProducer] = useState<Producer | null>(null);
  const [shareProducer, setShareProducer] = useState<Producer | null>(null);

  React.useEffect(() => {
    const refresh = () => setProducers(ProducerCatalogService.getAllProducers());
    refresh();
    const unsub = ProducerCatalogService.subscribe(refresh);
    window.addEventListener('producers-updated', refresh);
    return () => {
      unsub();
      window.removeEventListener('producers-updated', refresh);
    };
  }, []);

  const allGear = Array.from(
    new Set(producers.flatMap((p) => p.gearSetup.map((g) => g.split(' ')[0])))
  );

  const filteredProducers = selectedGearFilter === 'all'
    ? producers
    : producers.filter((p) =>
        p.gearSetup.some((g) => g.toLowerCase().includes(selectedGearFilter.toLowerCase()))
      );

  return (
    <div className="space-y-8 sm:space-y-10 py-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-10 border border-brand-gold/30 bg-gradient-to-br from-brand-purple/25 via-neutral-950/90 to-brand-gold/10 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-brand-gold" />
              <span>Studio & Crate Architects</span>
            </div>

            <VoiceNarrationButton
              text={PRODUCERS_PAGE_NARRATION}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
            DJs, Master Producers & Beat-Makers
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The sonic engineers, hardware samplers, and analog tape purists driving the sound of 8 OF SPADES WORKS. Explore their hardware rigs, signature BPM pockets, and legendary break selections.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAI('Tell me about the producers behind 8 OF SPADES WORKS, their hardware setups, and break choices!')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-purple/50 text-white text-xs font-bold shadow-md hover:scale-105 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
              <span>Ask Break Beats AI About Producers</span>
            </button>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-brand-neon" />
              <span>View Production Projects</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Gear Filter Badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Wrench className="w-3 h-3 text-brand-gold" /> Rig:
        </span>
        <button
          onClick={() => setSelectedGearFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
            selectedGearFilter === 'all'
              ? 'bg-brand-gold text-black font-extrabold shadow-md'
              : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
          }`}
        >
          All Producers ({producers.length})
        </button>
        {['SP-1200', 'MPC60', 'Tape', 'Modular', 'Neve'].map((gear) => (
          <button
            key={gear}
            onClick={() => setSelectedGearFilter(gear)}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              selectedGearFilter === gear
                ? 'bg-brand-purple text-white shadow-md border border-brand-neon/50'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
            }`}
          >
            {gear}
          </button>
        ))}
      </div>

      {/* Producers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProducers.map((producer) => {
          const featuredTracks = MusicCatalogService.getAllTracks().filter(
            (t) =>
              producer.featuredTrackIds?.includes(t.id) ||
              t.producerId === producer.id ||
              (t.producer && t.producer.toLowerCase().includes(producer.name.toLowerCase().trim())) ||
              t.artistId === producer.id ||
              (t.artistName && t.artistName.toLowerCase().trim() === producer.name.toLowerCase().trim())
          );

          return (
            <div
              key={producer.id}
              className="group glass-card rounded-3xl border border-white/10 hover:border-brand-gold/40 bg-neutral-900/50 p-6 sm:p-7 transition-all duration-300 flex flex-col justify-between space-y-6 shadow-xl"
            >
              {/* Header & Identity */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand-gold/40 shadow-lg shrink-0 bg-neutral-950">
                      <Image
                        src={producer.avatarUrl}
                        alt={producer.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-brand-gold transition-colors">
                          {producer.name}
                        </h2>
                        {producer.verified && (
                          <CheckCircle2 className="w-4 h-4 text-brand-gold fill-brand-gold/20 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-brand-neon font-mono font-semibold">{producer.handle}</p>
                      <p className="text-xs text-neutral-300 font-medium mt-0.5">{producer.role}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5">
                        {producer.label}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-[10px] font-mono font-bold">
                      {producer.signatureBpmRange}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  {producer.bio}
                </p>

                {/* Hardware & Rig Setup */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-brand-gold" /> Studio Hardware & Signal Path
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {producer.gearSetup.map((gear, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-lg bg-black/50 border border-white/10 text-neutral-200 text-[11px] font-mono"
                      >
                        {gear}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Favorite Breaks */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-brand-amber" /> Signature Break Inspirations
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {producer.favoriteBreaks.map((brk, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-lg bg-brand-purple/15 border border-brand-purple/30 text-brand-neon text-[11px]"
                      >
                        {brk}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Featured Productions */}
                {featuredTracks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                      <Music className="w-3 h-3 text-brand-neon" /> Key Productions
                    </label>
                    <div className="space-y-1.5">
                      {featuredTracks.map((trk) => {
                        const isCurrent = currentTrack?.id === trk.id;
                        return (
                          <div
                            key={trk.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                onClick={() => playTrack(trk)}
                                className="p-1.5 rounded-full bg-brand-gold text-black hover:scale-110 transition-transform shrink-0 cursor-pointer"
                                title={`Play ${trk.title}`}
                              >
                                {isCurrent && isPlaying ? (
                                  <Disc3 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{trk.title}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">
                                  {trk.bpm} BPM • {trk.genre}
                                </p>
                              </div>
                            </div>

                            <Link
                              href="/music"
                              className="text-[10px] text-brand-gold hover:underline shrink-0 ml-2 font-semibold"
                            >
                              Inspect
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                <div className="text-[11px] text-neutral-400">
                  <span className="font-bold text-white">{producer.projectCount}</span> Master Projects
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDiscussionProducer(producer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold/15 text-neutral-300 hover:text-brand-gold text-xs font-semibold border border-white/10 hover:border-brand-gold/30 transition-all cursor-pointer"
                    title={`Open discussion threads for ${producer.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                    <span className="font-mono font-bold text-brand-gold">
                      {SocialCommentService.getCommentCount(
                        producer.id,
                        buildCanonicalContentKey('producer', producer.name)
                      )}
                    </span>
                    <span className="hidden sm:inline">Discuss</span>
                  </button>
                  <button
                    onClick={() => setShareProducer(producer)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title={`Share ${producer.name} & text message`}
                  >
                    <Share2 className="w-3.5 h-3.5 hover:text-brand-gold transition-colors" />
                  </button>
                  <button
                    onClick={() =>
                      openAI(`Tell me about producer ${producer.name}, their workflow, and their work on 8 OF SPADES WORKS!`)
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-brand-gold hover:text-white text-xs font-semibold border border-white/5 transition-all cursor-pointer"
                  >
                    AI Deep Dive
                  </button>
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs shadow hover:scale-105 transition-all"
                  >
                    <span>Projects</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Community Comments & Discussion Threads */}
      <CommentSection
        contentId="producers-community-hub"
        contentType="producer"
        contentTitle="Producers & Sonic Architects Platform Community"
      />

      {/* Producer Individual Discussion Drawer */}
      {discussionProducer && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionProducer)}
          onClose={() => setDiscussionProducer(null)}
          contentId={discussionProducer.id}
          contentKey={buildCanonicalContentKey('producer', discussionProducer.name)}
          contentType="producer"
          contentTitle={discussionProducer.name}
          contentSubtitle={`Sound Architect • ${discussionProducer.gearSetup?.join(', ')}`}
          coverUrl={discussionProducer.avatarUrl}
          badgeLabel="Producer"
        />
      )}

      {/* Universal Share Modal */}
      {shareProducer && (
        <UniversalShareModal
          isOpen={Boolean(shareProducer)}
          onClose={() => setShareProducer(null)}
          entity={{
            type: 'producer',
            item: shareProducer,
          }}
        />
      )}
    </div>
  );
}
