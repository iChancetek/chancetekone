import React from 'react';
import { HelpCircle, Radio, Brain, Disc3, Users, Mail, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const metadata = {
  title: 'Support Center',
  description: 'Technical assistance, crate concierge, PWA offline guide, and direct support channels.',
};

const SUPPORT_FULL_TEXT = `Support Center and Crate Concierge. Technical Assistance, Crate Navigation, and Direct Inquiries. Published by ChanceTEKone. Whether you need assistance with Progressive Web App offline caching, vinyl fulfillment, sample breakdown verification, or account synchronization, our dedicated support engineering team is available to assist you. ChanceTEKone is engineered as a modern Progressive Web App, enabling high-definition audio and audiobook playback with lock-screen controls even when offline. Break Beats AI operates a Dual-Memory architecture allowing you to inspect or clear your saved gear and genre preferences at any time. Visitors and unauthenticated guests enjoy full access to stream music tracks, watch cultural documentaries, and converse with the AI assistant without creating an account.`;

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Hero Header with Dual-Language Spoken Narration */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-brand-purple/30 bg-gradient-to-br from-brand-purple/20 via-neutral-950 to-neutral-950 shadow-2xl">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs font-semibold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Crate Concierge</span>
            </div>

            {/* Nova Calm Voice Dual-Language Spoken Narration (English & Spanish) */}
            <VoiceNarrationButton
              text={SUPPORT_FULL_TEXT}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
            Support Center
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            Technical Assistance, Crate Navigation, and Direct Inquiries • Published by ChanceTEKone
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-brand-gold" />
            <span>Welcome to the Crate Concierge</span>
          </h2>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Whether you need assistance with Progressive Web App offline caching, vinyl fulfillment, sample breakdown verification, or account synchronization, our dedicated support engineering team is available to assist you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide px-2">
            Frequently Answered Technical Topics
          </h2>

          <div className="grid grid-cols-1 gap-4">
            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/30 space-y-3 hover:border-brand-gold/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-brand-gold">
                  <Radio className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    How does offline playback operate on mobile devices?
                  </h3>
                </div>
                <VoiceNarrationButton
                  text="ChanceTEKone is engineered as a modern Progressive Web App. By selecting Install from the navigation menu on iOS, Android, or desktop, our service worker caches the core audio engine. Audio tracks and audiobook chapters can be streamed with full lock-screen playback controls even when disconnected from cellular networks."
                  variant="icon"
                />
              </div>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed pl-8">
                ChanceTEKone is engineered as a modern Progressive Web App. By selecting Install from the navigation menu on iOS, Android, or desktop, our service worker caches the core audio engine. Audio tracks and audiobook chapters can be streamed with full lock-screen playback controls even when disconnected from cellular networks.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/30 space-y-3 hover:border-brand-neon/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-brand-neon">
                  <Brain className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    How does the Break Beats AI assistant utilize my taste memory?
                  </h3>
                </div>
                <VoiceNarrationButton
                  text="Break Beats AI operates a Dual-Memory architecture. Short-Term Working Memory tracks your live session route, playing BPM, and active track. Long-Term Memory records your equipment preferences and genre favorites. You can inspect or clear this data at any time via the Memory button in the assistant header."
                  variant="icon"
                />
              </div>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed pl-8">
                Break Beats AI operates a Dual-Memory architecture. Short-Term Working Memory tracks your live session route, playing BPM, and active track. Long-Term Memory records your equipment preferences and genre favorites. You can inspect or clear this data at any time via the Memory button in the assistant header.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/30 space-y-3 hover:border-amber-400/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-amber-400">
                  <Disc3 className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    What is the tracking procedure for limited vinyl pressings?
                  </h3>
                </div>
                <VoiceNarrationButton
                  text="Upon order confirmation from the Merch Crate, our distribution warehouse generates a localized tracking number. High-grade collector packaging ensures each vinyl record arrives in pristine condition."
                  variant="icon"
                />
              </div>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed pl-8">
                Upon order confirmation from the Merch Crate, our distribution warehouse generates a localized tracking number. High-grade collector packaging ensures each vinyl record arrives in pristine condition.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-neutral-900/30 space-y-3 hover:border-brand-purple/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-brand-purple">
                  <Users className="w-5 h-5" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Do visitors need to sign in to listen to music?
                  </h3>
                </div>
                <VoiceNarrationButton
                  text="No. Visitors and unauthenticated guests enjoy full access to stream music tracks, watch cultural documentaries, listen to audiobooks, inspect Sample DNA genealogies, and converse with the AI assistant without creating an account."
                  variant="icon"
                />
              </div>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed pl-8">
                No. Visitors and unauthenticated guests enjoy full access to stream music tracks, watch cultural documentaries, listen to audiobooks, inspect Sample DNA genealogies, and converse with the AI assistant without creating an account.
              </p>
            </div>
          </div>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-gradient-to-r from-brand-purple/10 to-brand-gold/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Direct Assistance Channels
            </h2>
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            For specialized inquiries, rights management, or enterprise assistance, communicate directly with our desk:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-white/5 space-y-1">
              <p className="text-neutral-400 font-semibold">General Inquiries</p>
              <p className="text-white font-medium">support@chancetekone.us</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-white/5 space-y-1">
              <p className="text-neutral-400 font-semibold">Editorial & Licensing</p>
              <p className="text-white font-medium">licensing@chancetekone.us</p>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-white/5 space-y-1">
              <p className="text-neutral-400 font-semibold">Founder & Curator Office</p>
              <p className="text-brand-gold font-medium">ChanceTEKone.</p>
            </div>
          </div>
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
          © 2026 ChanceTEKone. All rights reserved.
        </p>
      </div>
    </div>
  );
}
