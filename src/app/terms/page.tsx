import React from 'react';
import { Scale, ShieldCheck, Cpu, ShoppingBag, Landmark, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of service, licensing covenants, and platform guidelines for ChanceTEK One.',
};

const TERMS_FULL_TEXT = `Terms of Service and Platform Covenant. Effective Date: January 1, 2026. Published by ChanceTEK One. Welcome to the ChanceTEK One Streaming Platform, an advanced cultural and sonic operating system curated and maintained by ChanceTEK One and ChanceTEK LLC. Every sound recording, drum loop composition, synchronized visual master, narrated audiobook chapter, and proprietary algorithm hosted across this ecosystem constitutes protected intellectual property. You are granted an individual license to stream media for personal enjoyment. The Break Beats AI assistant operates as an interactive cultural curator processing requests in real time. All vinyl and merchandise orders are fulfilled on a verified first-come, first-served basis.`;

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Hero Header with Dual-Language Spoken Narration */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-brand-purple/30 bg-gradient-to-br from-brand-purple/20 via-neutral-950 to-neutral-950 shadow-2xl">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs font-semibold uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5" />
              <span>Platform Covenant</span>
            </div>

            {/* Nova Calm Voice Dual-Language Spoken Narration (English & Spanish) */}
            <VoiceNarrationButton
              text={TERMS_FULL_TEXT}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
            Terms of Service
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            Effective Date: January 1, 2026 • Published by ChanceTEK One
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-neon border border-brand-purple/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Preamble and Scope of Agreement
              </h2>
            </div>
            <VoiceNarrationButton
              text="Welcome to the ChanceTEK One Streaming Platform, an advanced cultural and sonic operating system curated and maintained by ChanceTEK One and ChanceTEK LLC. By accessing, browsing, streaming, or purchasing through this platform, you enter into a legally binding covenant governed by these Terms of Service."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Welcome to the ChanceTEK One Streaming Platform, an advanced cultural and sonic operating system curated and maintained by ChanceTEK One and ChanceTEK LLC. By accessing, browsing, streaming, or purchasing through this platform, you enter into a legally binding covenant governed by these Terms of Service. If you do not consent to every provision articulated herein, your privilege to navigate or utilize this platform is immediately revoked.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-gold/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Intellectual Property, Master Lineage, and Crate Rights
              </h2>
            </div>
            <VoiceNarrationButton
              text="Every sound recording, drum loop composition, synchronized visual master, narrated audiobook chapter, typography design, digital artifact, and proprietary algorithm hosted across this ecosystem constitutes protected intellectual property owned by ChanceTEK One or licensed copyright holders. You are granted an individual license to stream media for personal enjoyment."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Every sound recording, drum loop composition, synchronized visual master, narrated audiobook chapter, typography design, digital artifact, and proprietary algorithm hosted across this ecosystem constitutes protected intellectual property owned by ChanceTEK One or licensed copyright holders.
          </p>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            You are granted an individual, revocable, non-exclusive, non-transferable license to stream audio and audiovisual media for personal, non-commercial enjoyment. Any unauthorized reproduction, reverse engineering, public broadcast, algorithmic scraping, or commercial exploitation without prior written consent from ChanceTEK One is strictly prohibited.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Autonomous AI and Memory Interaction
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Break Beats AI assistant operates as an interactive cultural curator. Queries submitted to the agent are processed in real time to provide personalized crate curation, tempo matching, and historical sample genealogy. You agree not to submit malicious prompts, attempt model extraction, or inject hostile instructions into the assistant interface."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The Break Beats AI assistant operates as an interactive cultural curator. Queries submitted to the agent are processed in real time to provide personalized crate curation, tempo matching, and historical sample genealogy. You agree not to submit malicious prompts, attempt model extraction, or inject hostile instructions into the assistant interface.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Commerce, Vinyl Orders, and Physical Merchandise
              </h2>
            </div>
            <VoiceNarrationButton
              text="All purchases of limited-edition vinyl pressings, apparel, slipmats, and analog accessories are processed securely. Due to the limited nature of archival vinyl runs, orders are fulfilled on a verified first-come, first-served basis. Defective physical goods must be reported within fourteen days of receipt for replacement or credit."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            All purchases of limited-edition vinyl pressings, apparel, slipmats, and analog accessories are processed securely. Due to the limited nature of archival vinyl runs, orders are fulfilled on a verified first-come, first-served basis. Defective physical goods must be reported within fourteen days of receipt for replacement or credit.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <Landmark className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Account Conduct, Termination, and Governing Law
              </h2>
            </div>
            <VoiceNarrationButton
              text="Users are responsible for maintaining the confidentiality of their credentials. ChanceTEK One reserves the right to suspend or permanently terminate access for conduct that violates these covenants or degrades platform integrity. These terms are construed in accordance with the laws of the State of Delaware."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Users are responsible for maintaining the confidentiality of their credentials. ChanceTEK One reserves the right to suspend or permanently terminate access for conduct that violates these covenants or degrades platform integrity. These terms are construed in accordance with the laws of the State of Delaware, United States of America.
          </p>
        </section>
      </div>

      <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-neutral-400">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/about" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>About</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/learn-more" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Learn More</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/support" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Support Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/privacy" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Privacy Policy</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-neutral-500">
          © 2026 ChanceTEK One. All rights reserved.
        </p>
      </div>
    </div>
  );
}
