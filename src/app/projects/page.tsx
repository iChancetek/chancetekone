'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FolderKanban,
  Disc3,
  Sparkles,
  Flame,
  Wrench,
  Music,
  Play,
  Share2,
  Heart,
  Layers,
  ArrowRight,
  Sliders,
  CheckCircle2,
  FileAudio,
  Video as VideoIcon,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Project } from '@/types/media';
import { MOCK_PROJECTS, MOCK_TRACKS, MOCK_VIDEOS } from '@/lib/mockData';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAI } from '@/lib/ai/AIContext';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';
import { MediaCard } from '@/components/media/MediaCard';
import { ReactionButtons } from '@/components/social/ReactionButtons';
import { UniversalDiscussionModal } from '@/components/social/UniversalDiscussionModal';
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { SocialCommentService, buildCanonicalContentKey } from '@/lib/social/SocialCommentService';

const PROJECTS_PAGE_NARRATION = `The multi-format production masterworks of ChanceTEK One: Explore New & Upcoming Projects by Artists & Creators such as Studio Albums, EPs, Music Videos, Documentaries And More.`;

export default function ProjectsPage() {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { openAI } = useAI();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [discussionProject, setDiscussionProject] = useState<Project | null>(null);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [, setCommentRefresh] = useState(0);

  useEffect(() => {
    const unsub = SocialCommentService.subscribeAll(() => {
      setCommentRefresh((p) => p + 1);
    });
    return () => unsub();
  }, []);

  const getProjectCanonicalKey = (p: Project) => {
    if (p.id === 'project-1') {
      return buildCanonicalContentKey('project', 'ChanceTEK One: The Foundation Beats', 'ChanceTEK One');
    }
    if (p.id === 'project-chancetek') {
      return buildCanonicalContentKey('project', 'ChanceTEK The Master Series', 'Chancellor');
    }
    return buildCanonicalContentKey('project', p.title, p.producerName);
  };

  useEffect(() => {
    const handleHashScroll = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      }
    };

    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, []);

  const filteredProjects = selectedStatus === 'all'
    ? MOCK_PROJECTS
    : MOCK_PROJECTS.filter((p) => p.status.toLowerCase() === selectedStatus.toLowerCase());

  return (
    <div className="space-y-8 sm:space-y-10 py-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-10 border border-brand-purple/30 bg-gradient-to-br from-brand-purple/25 via-neutral-950/90 to-brand-gold/10 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/15 border border-brand-neon/40 text-brand-neon text-xs font-bold uppercase tracking-wider">
              <FolderKanban className="w-3.5 h-3.5" />
              <span>NEW & UPCOMING PROJECTS</span>
            </div>

            <VoiceNarrationButton
              text={PROJECTS_PAGE_NARRATION}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
            Projects & Masterworks
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The multi-format production masterworks of ChanceTEK One:
            <br />
            Explore New & Upcoming Projects by Artists & Creators such as Studio Albums, EPs, Music Videos, Documentaries And More.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAI('Tell me about the production projects in ChanceTEK One, how they were recorded, and the sample sources used!')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-purple/50 text-white text-xs font-bold shadow-md hover:scale-105 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
              <span>Ask AI About New Projects</span>
            </button>
            <Link
              href="/producers"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-brand-gold" />
              <span>Meet the Producers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Layers className="w-3 h-3 text-brand-gold" /> Status:
        </span>
        {[
          { label: 'All Projects', value: 'all', count: MOCK_PROJECTS.length },
          { label: 'Released', value: 'released' },
          { label: 'Archival Vault', value: 'archival vault' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              selectedStatus === tab.value
                ? 'bg-brand-gold text-black font-extrabold shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5'
            }`}
          >
            {tab.label} {tab.count ? `(${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* Projects List */}
      <div className="space-y-8">
        {filteredProjects.map((project) => {
          const projectTracks = MusicCatalogService.getAllTracks().filter((t) => project.trackIds.includes(t.id));
          const projectVideos = (project.videoIds || [])
            .map((vidId) => MOCK_VIDEOS.find((v) => v.id === vidId))
            .filter((v): v is (typeof MOCK_VIDEOS)[0] => Boolean(v));
          const isChanceTEK =
            project.id === 'project-chancetek' ||
            project.title.toLowerCase().includes('chancetek') ||
            Boolean(project.isAdvertisement);

          return (
            <div
              key={project.id}
              id={project.id}
              className="group glass-card rounded-3xl border border-white/10 hover:border-brand-gold/40 target:border-brand-gold target:ring-2 target:ring-brand-gold/50 target:shadow-[0_0_40px_rgba(245,195,68,0.35)] scroll-mt-24 bg-neutral-900/50 p-6 sm:p-8 transition-all duration-300 shadow-2xl space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
                {/* Left Column: Artwork & Vinyl Badge */}
                <div className="lg:col-span-4 space-y-3">
                  {isChanceTEK ? (
                    <a
                      href="https://ichancetek.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-video rounded-2xl overflow-hidden border border-brand-gold/40 shadow-2xl bg-black flex items-center justify-center hover:border-brand-gold hover:scale-[1.02] transition-all cursor-pointer block group/cover"
                      title="Visit ChanceTEK (iChanceTEK.com) - Your AI Solutions Partner"
                    >
                      <Image
                        src={project.coverUrl}
                        alt={project.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-contain transition-transform duration-500 group-hover/cover:scale-105"
                      />
                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-brand-gold/50 text-[10px] font-black text-brand-gold uppercase tracking-wider flex items-center gap-1 shadow-lg opacity-90 group-hover/cover:opacity-100 transition-opacity">
                        <span>iChanceTEK.com</span>
                        <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    </a>
                  ) : (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black flex items-center justify-center group-hover:border-brand-gold/30 transition-colors">
                      <Image
                        src={project.coverUrl}
                        alt={project.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-[10px] font-mono font-bold uppercase">
                      {project.status}
                    </span>
                    <span className="font-mono font-bold text-white">{project.bpm} BPM</span>
                    <span className="text-neutral-400 font-medium">{project.releaseYear}</span>
                  </div>

                  {/* Vinyl Pressing Badge */}
                  {project.vinylPressing && (
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-brand-purple/20 to-brand-gold/15 border border-brand-gold/30 flex items-center gap-2.5">
                      <Disc3 className="w-5 h-5 text-brand-gold animate-spin-slow shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">
                          {project.vinylPressing.edition}
                        </p>
                        <p className="text-[10px] text-brand-gold">
                          Heavyweight {project.vinylPressing.weight} Audiophile Pressing
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Narrative, Details & Tracklist */}
                <div className="lg:col-span-8 space-y-5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-brand-gold font-bold uppercase tracking-wider">
                        {project.presenter || project.label}
                      </span>
                      <span className="text-neutral-500">•</span>
                      <span className="text-xs text-neutral-400">{project.genre}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight group-hover:text-brand-gold transition-colors">
                      {isChanceTEK ? (
                        <>
                          ChanceTEK One PRESENTS:{' '}
                          <a
                            href="https://ichancetek.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-gold hover:text-white underline decoration-brand-gold/60 hover:decoration-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                            title="Visit iChanceTEK.com - Your AI Solutions Partner"
                          >
                            <span>ChanceTEK</span>
                            <ExternalLink className="w-4 h-4 inline-block stroke-[2.5] text-brand-gold" />
                          </a>
                        </>
                      ) : (
                        project.title
                      )}
                    </h2>
                    <p className="text-sm font-semibold text-brand-neon">{project.subtitle}</p>

                    {/* Advertisement Disclosure Card for ChanceTEK */}
                    {isChanceTEK && (
                      <div className="pt-2">
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-gold/20 via-[#180f26]/90 to-brand-purple/30 border border-brand-gold/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_4px_25px_rgba(245,158,11,0.15)]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/50 flex items-center justify-center text-brand-gold shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40 text-[9px] font-black uppercase tracking-wider">
                                <span>Featured Partner</span>
                                <span>•</span>
                                <span>Advertisement Ad</span>
                              </div>
                              <p className="text-xs sm:text-sm text-neutral-200 font-medium leading-relaxed">
                                This is an advertisement ad for{' '}
                                <a
                                  href="https://ichancetek.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-gold hover:text-white font-black underline decoration-brand-gold hover:decoration-white transition-colors cursor-pointer"
                                  title="Visit iChanceTEK.com"
                                >
                                  ChanceTEK
                                </a>
                                , Your AI Solutions Partner.
                              </p>
                            </div>
                          </div>

                          <a
                            href="https://ichancetek.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black text-xs font-black uppercase tracking-wider hover:scale-105 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all shrink-0 cursor-pointer"
                            title="Visit iChanceTEK.com - Your AI Solutions Partner"
                          >
                            <span>Connect to iChanceTEK.com</span>
                            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                          </a>
                        </div>
                      </div>
                    )}

                    {project.creditsLines && project.creditsLines.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        {project.creditsLines.map((credit, i) => (
                          <p key={i} className="text-xs text-neutral-300 font-semibold">
                            {credit}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">
                        Produced & Engineered by{' '}
                        {isChanceTEK ? (
                          <span className="text-white font-bold">
                            Chancellor @{' '}
                            <a
                              href="https://ichancetek.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-gold hover:underline"
                              title="Visit iChanceTEK.com"
                            >
                              ChanceTEK LLC
                            </a>
                          </span>
                        ) : (
                          <span className="text-white font-bold">{project.producerName}</span>
                        )}
                      </p>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                    {project.narrativeOverview}
                  </p>

                  {/* Hardware & Sample Lineage Tags */}
                  {((project.sampleSources && project.sampleSources.length > 0) ||
                    (project.equipmentUsed && project.equipmentUsed.length > 0)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                      {project.sampleSources && project.sampleSources.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-brand-amber" /> Sample Origins & Lineage
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {project.sampleSources.map((src, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-neutral-300 text-[10px] font-mono"
                              >
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {project.equipmentUsed && project.equipmentUsed.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-brand-gold" /> Studio Hardware Rig
                          </label>
                          <div className="flex flex-wrap gap-1">
                            {project.equipmentUsed.map((eq, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-brand-purple/20 border border-brand-purple/30 text-brand-neon text-[10px] font-mono"
                              >
                                {eq}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Project Tracks */}
                  {projectTracks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                        <Music className="w-3 h-3 text-brand-gold" /> {project.tracklistTitle || 'Album Tracklist'}
                      </label>
                      <div className="divide-y divide-white/5 rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
                        {projectTracks.map((track, idx) => {
                          const isCurrent = currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              className="p-2.5 sm:p-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-mono text-neutral-500 w-4 text-center">
                                  {idx + 1}
                                </span>
                                <button
                                  onClick={() => playTrack(track)}
                                  className="p-1.5 rounded-full bg-brand-gold text-black hover:scale-110 transition-transform shrink-0 cursor-pointer"
                                  title={`Play ${track.title}`}
                                >
                                  {isCurrent && isPlaying ? (
                                    <Disc3 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                                    {track.title}
                                  </p>
                                  <p className="text-[10px] text-neutral-400 font-mono">
                                    {track.artistName} • {track.bpm} BPM
                                  </p>
                                </div>
                              </div>

                              <span className="text-xs font-mono text-neutral-400 shrink-0">
                                {Math.floor(track.duration / 60)}:
                                {String(track.duration % 60).padStart(2, '0')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Project Videos */}
                  {projectVideos.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                        <VideoIcon className="w-3 h-3 text-red-400" /> Project Cinema & Video Productions ({projectVideos.length})
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {projectVideos.map((vid) => (
                          <MediaCard key={vid.id} item={vid} type="video" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    {isChanceTEK && (
                      <a
                        href="https://ichancetek.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer"
                        title="Visit iChanceTEK.com - Your AI Solutions Partner"
                      >
                        <span>Visit ChanceTEK (iChanceTEK.com)</span>
                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                      </a>
                    )}

                    {projectTracks.length > 0 && (
                      <button
                        onClick={() => playTrack(projectTracks[0])}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Master Project</span>
                      </button>
                    )}

                    <button
                      onClick={() =>
                        openAI(`Tell me about the project "${project.title}" (${project.subtitle}) by ${project.producerName}, including its sample chops and SP-1200 gear!`)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-brand-gold hover:text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
                      <span>Ask AI About Project</span>
                    </button>

                    <Link
                      href="/merch"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-bold transition-all"
                    >
                      <Disc3 className="w-3.5 h-3.5 text-brand-neon" />
                      <span>Vinyl & Merch</span>
                    </Link>

                    {/* Emoji Reactions */}
                    <ReactionButtons
                      contentId={project.id}
                      contentKey={getProjectCanonicalKey(project)}
                      contentType="project"
                      contentTitle={project.title}
                      contextLocation="Projects & Masterworks Page"
                      variant="compact"
                      showShare={false}
                    />

                    {/* Project Discussion Comments & Threads */}
                    {(() => {
                      const projKey = getProjectCanonicalKey(project);
                      const count = SocialCommentService.getCommentCount(project.id, projKey);
                      return (
                        <button
                          type="button"
                          onClick={() => setDiscussionProject(project)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-brand-gold/20 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-brand-gold text-xs font-bold transition-all cursor-pointer shadow-sm"
                          title={`${count} Discussion Comments & Threads on ${project.title}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-brand-gold" />
                          <span className="font-mono font-bold text-brand-gold">{count}</span>
                          <span>Discuss</span>
                        </button>
                      );
                    })()}

                    {/* Share Project & Text Message */}
                    <button
                      type="button"
                      onClick={() => setShareProject(project)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-gold/40 text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                      title={`Share ${project.title} & text message`}
                    >
                      <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {discussionProject && (
        <UniversalDiscussionModal
          isOpen={Boolean(discussionProject)}
          onClose={() => setDiscussionProject(null)}
          contentId={discussionProject.id}
          contentKey={getProjectCanonicalKey(discussionProject)}
          contentType="project"
          contentTitle={discussionProject.title}
          contentSubtitle={`${discussionProject.subtitle || ''} • Produced by ${discussionProject.producerName}`}
          coverUrl={
            discussionProject.id === 'project-1'
              ? '/images/chancetek_banner.png'
              : discussionProject.coverUrl || '/images/chancetek_banner.png'
          }
          badgeLabel="Featured Project"
        />
      )}

      {shareProject && (
        <UniversalShareModal
          isOpen={Boolean(shareProject)}
          onClose={() => setShareProject(null)}
          entity={{
            type: 'project',
            id: shareProject.id,
            item: shareProject,
            customTitle: shareProject.title,
            customCreator: shareProject.producerName,
            customDescription: shareProject.description || shareProject.narrativeOverview,
            customCoverUrl:
              shareProject.id === 'project-1'
                ? '/images/chancetek_banner.png'
                : shareProject.coverUrl || '/images/chancetek_banner.png',
          }}
        />
      )}
    </div>
  );
}
