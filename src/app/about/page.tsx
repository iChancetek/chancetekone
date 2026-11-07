import React from 'react';
import {
  Compass,
  Sparkles,
  Flame,
  Radio,
  Disc3,
  Mic2,
  Film,
  Users,
  HeartHandshake,
  ChevronRight,
  ShieldCheck,
  Globe,
  Coins,
  Cpu,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const metadata = {
  title: 'About ChanceTEKone · A Cultural & Sonic Platform',
  description:
    'A Cultural & Sonic Platform for Independent Artists and Creators. Direct distribution, streaming, and monetization without gatekeepers.',
};

const ABOUT_FULL_TEXT = `ChanceTEKone. A Cultural and Sonic Platform for Independent Artists and Creators.

Introducing an advanced cultural and sonic system for Independent Artists and Creators — a platform built on Digital Arts, Entertainment, Music and Video, Streaming 4K Cultural Documentaries, Narrated Audiobooks and Podcasts. The platform also delivers DJ Playlists, Online Radio, A.I. Crate Digging, Music Downloads, Apps, Merchandise, and more. The platform is also in connection with its own Social Media Platform "The FAM" Famio.US, which will serve as a companion for Social and Business Connections. The two platforms are linked for extra curriculum and ease of access.

Our mission is to empower independent artists, producers, DJs, and creators with a single platform where they can stream, distribute, and sell their work directly to the people who value it most — their audience. At the same time creating a Standard for Good Music without compromising the integrity of the culture.

We believe culture shouldn't have to pass through gatekeepers to reach the world. That's why we've built a system that puts ownership, revenue, and creative control back in the hands of the people making the work — not just musicians, but filmmakers, documentarians, audiobook narrators, podcasters, and the DJs who shape how culture moves.

Two Ways to Join:
Start an account: Account Holders enjoy limited access to the platform — stream music, video, documentaries, podcasts, and audiobooks, and purchase from independent artists and creators. Account Holders can upgrade to Membership to have full access to platform.
Becoming a member: Members are anyone using the platform to generate income — artists, producers, DJs and creators — and receive full access to the platform's complete toolkit: distribution, sales, streaming, and monetization tools built to work for you. Every Member also has access to a built-in Donation feature, giving fans and supporters a direct way to contribute to the artists and creators they believe in.

For Independent Artists: Distribute and sell your music and videos directly to Account Holders. No middlemen, no diluted royalties — just a direct line to an audience actively seeking new, independent music from talented artists.
For Producers: Showcase your catalog, your beats and instrumentals, and connect with artists and DJs looking for original production — all within one ecosystem built for discovery and collaboration.
For DJs: Curate and publish playlists, host your own online radio segments, and tap into A.I. Crate Digging to unearth rare tracks, deep cuts, and emerging talent. As a Member, you can also receive direct support from your audience through the platform's Donation feature.
For Creators of All Kinds: Whether you're producing 4K cultural documentaries, narrating audiobooks, or hosting podcasts, our platform gives your work a home alongside music — reaching audiences who come for sound and stay for story.

We are more than a streaming service. We are a cultural infrastructure — a place where music, story, and identity converge, and where the people creating culture are the ones who profit from it, control it, and shape where it goes next. We Are The Future Of Independent Entertainment.

The Operating System:
Platform Architecture and Accessibility: Engineered as a modern Progressive Web App, ChanceTEKone offers instantaneous access to unauthenticated guests and verified collectors alike. You are never required to pass through registration gates to stream music, explore the archive, or watch cultural mini-documentaries. The platform incorporates a universal text and font scaling accessibility engine, allowing listeners to increase typeface sizing up to one hundred and forty-five percent, engage high-contrast visual modes, and activate spoken audio narration in English and Spanish across all editorial sections.
Leadership and Engineering Stewardship: ChanceTEKone is developed and maintained by Chancellor at ChanceTEK LLC. Every software component, audio processing pipeline, neural recommendation graph, and visual canvas is crafted with exacting precision to deliver a transcendent cultural experience. For technical inquiries, crate additions, master tape preservation collaborations, or physical vinyl fulfillment support, our engineering team and crate concierge can be reached directly through the Support Center.`;

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Hero Header with Master Banner Graphic at the Top */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-brand-gold/40 bg-gradient-to-br from-brand-gold/15 via-neutral-950 to-neutral-950 shadow-2xl space-y-6">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>Platform Origins & Ethos</span>
            </div>

            {/* Dual-Language Spoken Narration (English & Spanish) */}
            <VoiceNarrationButton
              text={ABOUT_FULL_TEXT}
              variant="dual"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
              ChanceTEKone
            </h1>
            <p className="text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-300 via-brand-gold to-brand-neon bg-clip-text text-transparent">
              A Cultural & Sonic Platform for Independent Artists and Creators
            </p>
          </div>

          <p className="text-sm sm:text-base text-neutral-200 leading-relaxed max-w-3xl">
            Introducing an advanced cultural and sonic system for Independent Artists & Creators — a platform
            built on Digital Arts, Entertainment, Music and Video, Streaming 4K Cultural Documentaries, Narrated
            Audiobooks and Podcasts. The platform also delivers DJ Playlists, Online Radio, A.I. Crate Digging,
            Music Downloads, Apps, Merchandise, and more.
          </p>

          {/* Companion Social Platform Link */}
          <div className="p-4 rounded-2xl bg-white/5 border border-brand-purple/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-brand-neon text-xs font-bold uppercase tracking-wider">
                <Globe className="w-4 h-4" />
                <span>Companion Social Network</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                The platform is also in connection with its own Social Media Platform <strong className="text-white">&ldquo;The FAM&rdquo; Famio.US</strong>, which will serve as a companion for Social and Business Connections. The two platforms are linked for extra curriculum and ease of access.
              </p>
            </div>
            <a
              href="https://famio.us"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple/40 to-brand-neon/20 hover:bg-brand-purple/60 text-white font-bold text-xs border border-brand-neon/50 shrink-0 transition-all hover:scale-105"
            >
              <span>Visit Famio.US</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Our Mission */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-neutral-900/40 space-y-5 hover:border-brand-gold/50 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Flame className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Our Mission
              </h2>
            </div>
            <VoiceNarrationButton
              text="Our mission is to empower independent artists, producers, DJs, and creators with a single platform where they can stream, distribute, and sell their work directly to the people who value it most — their audience. At the same time creating a Standard for Good Music without compromising the integrity of the culture. We believe culture shouldn't have to pass through gatekeepers to reach the world. That's why we've built a system that puts ownership, revenue, and creative control back in the hands of the people making the work."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Our mission is to empower independent artists, producers, DJs, and creators with a single
            platform where they can stream, distribute, and sell their work directly to the people who value it
            most — their audience. At the same time creating a Standard for Good Music without compromising the 
            integrity of the culture.
          </p>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            We believe culture shouldn&apos;t have to pass through gatekeepers to reach the world. That&apos;s why
            we&apos;ve built a system that puts ownership, revenue, and creative control back in the hands of the
            people making the work — not just musicians, but filmmakers, documentarians, audiobook
            narrators, podcasters, and the DJs who shape how culture moves.
          </p>
        </section>

        {/* Section 2: Two Ways to Join */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 rounded-xl bg-brand-purple/20 text-brand-neon border border-brand-purple/30">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Two Ways to Join
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Holders */}
            <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-neutral-900/40 space-y-4 flex flex-col justify-between hover:border-brand-gold/40 transition-colors">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-neutral-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Start an Account</span>
                </div>
                <h3 className="text-lg font-bold text-white">Account Holders</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Account Holders enjoy limited access to the platform — stream music, video, documentaries,
                  podcasts, and audiobooks, and purchase from independent artists and creators. Account Holders 
                  can upgrade to Membership to have full access to platform.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-xs font-bold text-brand-gold hover:text-amber-300 transition-colors uppercase tracking-wider"
                >
                  <span>Explore Catalog</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Becoming a Member */}
            <div className="glass-panel p-6 rounded-3xl border border-brand-gold/40 bg-gradient-to-b from-brand-gold/10 via-neutral-900/60 to-neutral-900/40 space-y-4 flex flex-col justify-between shadow-xl hover:border-brand-gold/60 transition-colors">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/50 text-brand-gold text-xs font-bold uppercase tracking-wider">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Becoming a Member</span>
                </div>
                <h3 className="text-lg font-bold text-white">Full Creator Membership</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Members are anyone using the platform to generate income — artists, producers, DJs and creators —
                  and receive full access to the platform&apos;s complete toolkit: distribution, sales, streaming, and
                  monetization tools built to work for you. Every Member also has access to a built-in Donation
                  feature, giving fans and supporters a direct way to contribute to the artists and creators they
                  believe in.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 text-xs font-bold text-brand-gold hover:text-amber-300 transition-colors uppercase tracking-wider"
                >
                  <span>Member Onboarding</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Creator Roles Grid */}
        <section className="space-y-4">
          <div className="px-2">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Built for Every Discipline in Culture
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Direct distribution and monetization engineered for creators across all media.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* For Independent Artists */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-brand-gold/40 transition-colors">
              <div className="p-2.5 rounded-2xl bg-brand-gold/15 text-brand-gold border border-brand-gold/30 w-fit">
                <Mic2 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">For Independent Artists</h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Distribute and sell your music and videos directly to Account Holders. No middlemen, no diluted
                royalties — just a direct line to an audience actively seeking new, independent music from 
                talented artists.
              </p>
            </div>

            {/* For Producers */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-brand-purple/40 transition-colors">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-neon border border-brand-purple/30 w-fit">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">For Producers</h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Showcase your catalog, your beats and instrumentals, and connect with artists and DJs
                looking for original production — all within one ecosystem built for discovery and collaboration.
              </p>
            </div>

            {/* For DJs */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-amber-400/40 transition-colors">
              <div className="p-2.5 rounded-2xl bg-amber-400/15 text-amber-400 border border-amber-400/30 w-fit">
                <Disc3 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">For DJs</h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Curate and publish playlists, host your own online radio segments, and tap into A.I. Crate
                Digging to unearth rare tracks, deep cuts, and emerging talent. As a Member, you can also
                receive direct support from your audience through the platform&apos;s Donation feature.
              </p>
            </div>

            {/* For Creators of All Kinds */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-red-400/40 transition-colors">
              <div className="p-2.5 rounded-2xl bg-red-400/15 text-red-400 border border-red-400/30 w-fit">
                <Film className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">For Creators of All Kinds</h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Whether you&apos;re producing 4K cultural documentaries, narrating audiobooks, or hosting podcasts,
                our platform gives your work a home alongside music — reaching audiences who come for
                sound and stay for story.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Cultural Infrastructure Manifesto Callout */}
        <section className="relative overflow-hidden glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/40 bg-gradient-to-r from-brand-purple/30 via-neutral-950 to-brand-gold/15 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4" />
            <span>Cultural Infrastructure Manifesto</span>
          </div>
          <blockquote className="text-base sm:text-lg font-semibold text-white leading-relaxed italic border-l-2 border-brand-gold pl-4">
            &ldquo;We are more than a streaming service. We are a cultural infrastructure — a place where
            music, story, and identity converge, and where the people creating culture are the ones
            who profit from it, control it, and shape where it goes next. We Are The Future Of Independent 
            Entertainment.&rdquo;
          </blockquote>
        </section>

        {/* Section 5: The Operating System */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 rounded-xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              The Operating System
            </h2>
          </div>

          <div className="space-y-6">
            {/* Platform Architecture and Accessibility */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-brand-neon/40 transition-colors">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Platform Architecture and Accessibility</span>
              </h3>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                Engineered as a modern Progressive Web App, ChanceTEKone offers instantaneous access 
                to unauthenticated guests and verified collectors alike. You are never required to pass 
                through registration gates to stream music, explore the archive, or watch cultural mini-documentaries.
                The platform incorporates a universal text and font scaling accessibility engine, allowing listeners 
                to increase typeface sizing up to one hundred and forty-five percent, engage high-contrast visual modes, 
                and activate spoken audio narration in English and Spanish across all editorial sections.
              </p>
            </div>

            {/* Leadership and Engineering Stewardship */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-3 hover:border-amber-500/40 transition-colors">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-gold" />
                <span>Leadership and Engineering Stewardship</span>
              </h3>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                ChanceTEKone is developed and maintained by Chancellor at ChanceTEK LLC. Every software component, 
                audio processing pipeline, neural recommendation graph, and visual canvas is crafted with exacting 
                precision to deliver a transcendent cultural experience.
              </p>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
                For technical inquiries, crate additions, master tape preservation collaborations, or physical vinyl fulfillment support, our engineering team and crate concierge can be reached directly through the Support Center.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-neutral-400">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/learn-more" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Learn More & Manifesto</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/support" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Support Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/terms" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Terms of Service</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/privacy" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Privacy Policy</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-neutral-500">
          © 2026 ChanceTEKone. All rights reserved. Developed by Chancellor @ ChanceTEK LLC
        </p>
      </div>
    </div>
  );
}
