'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Scale,
  Lock,
  Disc3,
  Video as VideoIcon,
  Music,
  ShoppingBag,
  Radio,
  ChevronRight,
  Compass,
  FileSignature,
  PenTool,
} from 'lucide-react';
import { useAI } from '@/lib/ai/AIContext';
import { AccessibilityButton } from '@/components/accessibility/AccessibilityButton';

export const Footer: React.FC = () => {
  const { openAI } = useAI();

  return (
    <footer className="relative z-20 w-full mt-12 sm:mt-16 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-6 sm:p-10 md:p-12 space-y-12 shadow-2xl">
        {/* Top Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10">
          {/* Column 1: Brand & Platform Narrative (Spans 2 columns on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl overflow-hidden border border-brand-gold/40 shadow-lg shrink-0">
                <Image
                  src="/logo.png"
                  alt="ChanceTEKone."
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide font-display">
                  ChanceTEKone.
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md">
              The definitive breakbeat ecosystem uniting master-quality audio streaming, 4K cultural documentaries, narrated audiobooks, limited collector vinyl pressings, and autonomous AI crate digging.
            </p>

            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={() => openAI()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/40 text-brand-neon hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
                <span>Ask Break Beats AI</span>
              </button>
            </div>
          </div>

          {/* Column 2: Editorial & Governance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
              Editorial & Governance
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <Compass className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>About ChanceTEKone</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/learn-more"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <BookOpen className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>Learn More & Manifesto</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>Support Center</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <Scale className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>Terms of Service</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <Lock className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/distribution-agreement"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center justify-between group py-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <FileSignature className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                    <span className="font-semibold text-white group-hover:text-brand-gold">Creator Distribution Agreement</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm">
                    Sign
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/advertisement"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold group-hover:translate-x-0.5 transition-transform" />
                  <span>ChanceTEK Advertisement</span>
                </Link>
              </li>
              <li className="pt-1">
                <AccessibilityButton variant="footer" />
              </li>
            </ul>
          </div>

          {/* Column 3: Media & Discovery */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
              Media & Crates
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link
                  href="/music"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <Music className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Music Tracks & BPMs</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/videos"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <VideoIcon className="w-3.5 h-3.5 text-neutral-400" />
                  <span>4K Documentaries</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/audiobooks"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Narrated Audiobooks</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/merch"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Vinyl & Merch Store</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Platform & Curation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-brand-gold">
              Platform & Curation
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link
                  href="/artists"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <Disc3 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Featured Artists</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/producers"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <span>Master Producers</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/projects"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <span>Production Projects</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/playlists"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Curated Crates</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/offline"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>PWA Offline Mode</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/distribution-agreement"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <PenTool className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Artist Onboarding Agreement</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/library"
                  className="text-neutral-300 hover:text-brand-gold transition-colors flex items-center gap-1.5"
                >
                  <span>Your Vault</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Creator Distribution Agreement Highlight Strip */}
        <div className="rounded-2xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-brand-purple/15 to-white/[0.02] p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center shrink-0 shadow-sm">
              <FileSignature className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2 justify-center sm:justify-start">
                <span>Artist &amp; Creator Distribution Agreement</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                  80% Royalty Share
                </span>
              </h4>
              <p className="text-xs text-neutral-300 mt-0.5">
                Retain 100% of your copyright ownership while streaming, selling, and distributing your music, 4K video, audiobooks, and vinyl pressings globally.
              </p>
            </div>
          </div>
          <Link
            href="/distribution-agreement"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-600 hover:scale-105 active:scale-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-gold/20 transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>Sign &amp; Submit Agreement</span>
            <ChevronRight className="w-4 h-4 text-black" />
          </Link>
        </div>

        {/* Universal Copyright and Developer Credit */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-xs text-neutral-300 font-medium tracking-wide">
            © 2026 ChanceTEKone. All rights reserved. Developed by Chancellor @ ChanceTEK LLC
          </p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold"></span>
            <span>ChanceTEKone Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
