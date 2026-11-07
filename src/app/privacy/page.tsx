import React from 'react';
import { Lock, Shield, Database, Cookie, KeyRound, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Global privacy standards, memory vault security, and data stewardship for ChanceTEKone.',
};

const PRIVACY_FULL_TEXT = `Privacy Policy and Global Data Stewardship. Effective Date: January 1, 2026. Published by ChanceTEKone. At ChanceTEKone, we regard user privacy as an essential civil liberty rather than an afterthought. We design our technology to minimize data footprint while delivering a transcendent, personalized listening experience. We never monetize, rent, or sell your personal identifiers to third-party data brokers. We collect only the telemetry and profile attributes required to power platform playback, persistent crate curation, and secure transactions. Preferred tempos and taste facts provided to Break Beats AI are stored with client-side isolation and user-controlled deletion. You retain full sovereignty over your digital footprint and may export or erase your archive at any time.`;

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Hero Header with Dual-Language Spoken Narration */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-brand-purple/30 bg-gradient-to-br from-brand-purple/20 via-neutral-950 to-neutral-950 shadow-2xl">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-neon/10 border border-brand-neon/30 text-brand-neon text-xs font-semibold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>Data Stewardship</span>
            </div>

            {/* Nova Calm Voice Dual-Language Spoken Narration (English & Spanish) */}
            <VoiceNarrationButton
              text={PRIVACY_FULL_TEXT}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            Effective Date: January 1, 2026 • Published by ChanceTEKone
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Our Fundamental Commitment to Privacy
              </h2>
            </div>
            <VoiceNarrationButton
              text="At ChanceTEKone, we regard user privacy as an essential civil liberty rather than an afterthought. We design our technology to minimize data footprint while delivering a transcendent, personalized listening experience. We never monetize, rent, or sell your personal identifiers to third-party data brokers."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            At ChanceTEKone, we regard user privacy as an essential civil liberty rather than an afterthought. We design our technology to minimize data footprint while delivering a transcendent, personalized listening experience. We never monetize, rent, or sell your personal identifiers to third-party data brokers.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-gold/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Information We Collect and How It Is Handled
              </h2>
            </div>
            <VoiceNarrationButton
              text="We collect only the telemetry and profile attributes required to power platform playback, persistent crate curation, and secure transactions: Identity and Authentication managed through Firebase, Musical DNA stored with user-controlled deletion, Commerce receipts with cryptographic encryption, and Device Telemetry for offline streaming."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            We collect only the telemetry and profile attributes required to power platform playback, persistent crate curation, and secure transactions:
          </p>
          <ul className="space-y-3 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-start gap-2.5">
              <span className="text-brand-gold mt-1">•</span>
              <span>
                <strong>Identity and Authentication</strong>: Email addresses, display names, and authentication tokens managed securely through Firebase Authentication.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-brand-gold mt-1">•</span>
              <span>
                <strong>Musical DNA and Memory Vault</strong>: Preferred tempos, favorite drum break lineages, and explicit taste facts provided to Break Beats AI, stored with client-side isolation and user-controlled deletion.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-brand-gold mt-1">•</span>
              <span>
                <strong>Commerce and Billing Records</strong>: Shipping addresses and transaction receipts stored with industry-standard cryptographic encryption. Raw payment card data is processed directly by PCI-DSS compliant gateways and is never stored on our local servers.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-brand-gold mt-1">•</span>
              <span>
                <strong>Device and Offline Telemetry</strong>: Progressive Web App cache status and playback position cached locally on your device to facilitate uninterrupted offline streaming.
              </span>
            </li>
          </ul>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <Cookie className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Cookie Usage and Local Storage Protocols
              </h2>
            </div>
            <VoiceNarrationButton
              text="We deploy local storage and essential session tokens solely for authentication persistence, cart synchronization, and active audio playback states. We do not deploy invasive third-party cross-site trackers or behavioral advertising cookies."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            We deploy local storage and essential session tokens solely for authentication persistence, cart synchronization, and active audio playback states. We do not deploy invasive third-party cross-site trackers or behavioral advertising cookies.
          </p>
        </section>

        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <KeyRound className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Your Sovereign Rights and Data Control
              </h2>
            </div>
            <VoiceNarrationButton
              text="You retain full sovereignty over your digital footprint. At any moment, you may export your musical memory archive, update your profile attributes, or request complete account erasure by contacting our privacy compliance desk."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            You retain full sovereignty over your digital footprint. At any moment, you may export your musical memory archive, update your profile attributes, or request complete account erasure by contacting our privacy compliance desk.
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
          <Link href="/terms" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Terms of Service</span>
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
