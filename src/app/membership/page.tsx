'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Crown,
  Sparkles,
  Check,
  Lock,
  Unlock,
  ShieldCheck,
  Disc3,
  Sliders,
  Music,
  ArrowRight,
  Zap,
  HelpCircle,
  Radio,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';

interface Plan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceAnnual: string;
  popular?: boolean;
  badge?: string;
  features: string[];
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Account Holder',
    tagline: 'Essential access to standard catalog & public playlists',
    priceMonthly: '$0',
    priceAnnual: '$0',
    features: [
      'Stream public music catalog (320 kbps)',
      'Watch 4K community video sessions',
      'Create up to 3 custom playlists',
      'Basic ChanceTEK One AI chat assistance',
      'Standard vinyl & merchandise purchasing',
    ],
    cta: 'Start Free Account',
  },
  {
    id: 'member',
    name: 'Crate Club Member',
    tagline: 'Full all-inclusive access to all 8 Members Only Crates & 24-bit Lossless streaming',
    priceMonthly: '$9.99',
    priceAnnual: '$99/yr',
    popular: true,
    badge: 'Most Popular',
    features: [
      '✨ Unlimited access to ALL 8 Members Only Crates included:',
      '• Slow Jams, Disco & Timeless R&B | Soul Music',
      '• Golden Era Hip Hop & Break Beats & Samples',
      '• Discographys, Stems & Miscellaneous Vault',
      'Lossless 24-bit / 96kHz FLAC audio stream',
      'Unlimited custom playlists & offline cache',
      'Priority vinyl pre-orders & 10% merch discount',
      'Deep Sample Detective AI break lineage tool',
    ],
    cta: 'Subscribe — Includes All Crates',
  },
  {
    id: 'creator',
    name: 'Full Creator & Stems',
    tagline: 'For producers, DJs & artists who sample and create',
    priceMonthly: '$19.99',
    priceAnnual: '$199/yr',
    badge: 'Pro Tier',
    features: [
      'All 8 Members Only Crates & Member benefits included',
      'Downloadable studio stems & multitracks (WAV)',
      'Instant commercial sample clearance licenses',
      'Creator distribution & direct fan tipping tools',
      'Early access to test pressings & white labels',
      'Priority Agentic AI music masterclass analysis',
    ],
    cta: 'Subscribe as Creator — All Crates Included',
  },
];

function MembershipContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  const requestedCrate = searchParams.get('crate');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authActionTitle, setAuthActionTitle] = useState('Sign In to Subscribe');
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [subscribedMessage, setSubscribedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chancetekone_subscription_tier');
      if (saved) setCurrentTier(saved);
    }
  }, []);

  const handleSelectPlan = (planId: string) => {
    if (planId === 'free') {
      if (!user) {
        setAuthActionTitle('Create Free Account');
        setShowAuthModal(true);
      } else {
        router.push('/music');
      }
      return;
    }

    if (!user) {
      setAuthActionTitle(`Sign Up to Subscribe to ${planId === 'member' ? 'Crate Club' : 'Creator Tier'}`);
      setShowAuthModal(true);
      return;
    }

    // Activate subscription
    if (typeof window !== 'undefined') {
      localStorage.setItem('chancetekone_subscription_tier', planId);
    }
    setCurrentTier(planId);
    setSubscribedMessage(
      `Welcome to ${planId === 'member' ? 'Crate Club Membership' : 'Full Creator Membership'}! All Members Only Crates are now unlocked.`
    );
  };

  return (
    <div className="space-y-12 py-8 max-w-6xl mx-auto px-4 sm:px-6">
      {/* Alert Banner for Requested Locked Crate */}
      {requestedCrate && (
        <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-r from-brand-gold/25 via-[#1a1205] to-[#0d0918] border-2 border-brand-gold/60 shadow-[0_0_40px_rgba(245,158,11,0.25)] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold/50 flex items-center justify-center text-brand-gold shrink-0 shadow-lg">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] font-extrabold uppercase tracking-widest mb-1">
                  <Crown className="w-3 h-3" /> Included in All-Access Subscription
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  &ldquo;{requestedCrate}&rdquo; Is Included With All Other Crates
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300">
                  Your subscription includes full access to all 8 Members Only Crates. Subscribe below to immediately unlock &ldquo;{requestedCrate}&rdquo; and the entire crate vault.
                </p>
              </div>
            </div>
            <Link
              href="/music"
              className="text-xs text-neutral-400 hover:text-white transition-colors underline shrink-0"
            >
              Back to Music
            </Link>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {subscribedMessage && (
        <div className="p-6 rounded-3xl bg-emerald-500/20 border border-emerald-500/50 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-300">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base text-emerald-200">{subscribedMessage}</p>
              <p className="text-xs text-neutral-300">Your account is ready. Head back to the music module to listen.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/music')}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform"
          >
            Go to Music Catalog
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-bold uppercase tracking-widest shadow-md">
          <Crown className="w-4 h-4" />
          <span>Subscription Memberships</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Unlock All Members Only Crates
        </h1>
        <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
          One subscription includes the complete vault. Experience uncompressed analog sound, rare multi-tracks, and all 8 high-value crates curated for true collectors and selectors.
        </p>

        {/* Billing Toggle */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-neutral-400'}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="w-14 h-7 rounded-full bg-white/10 border border-white/20 p-1 relative transition-colors cursor-pointer"
            aria-label="Toggle billing cycle"
          >
            <div
              className={`w-5 h-5 rounded-full bg-gradient-to-r from-brand-gold to-amber-400 transition-transform ${
                billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-bold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-brand-gold' : 'text-neutral-400'}`}>
            Annual Billing
            <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] uppercase font-black">
              Save 17%
            </span>
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const isHighlighted = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                isHighlighted
                  ? 'bg-gradient-to-b from-[#1f1533]/95 via-[#130d24]/90 to-[#0c0817]/95 border-2 border-brand-gold shadow-[0_0_50px_rgba(245,158,11,0.25)] scale-[1.02]'
                  : 'glass-panel bg-white/5 border border-white/10 hover:border-white/20'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black font-black text-[11px] uppercase tracking-wider shadow-md">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">{plan.name}</h3>
                  <p className="text-xs text-neutral-400 mt-1">{plan.tagline}</p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly}
                  </span>
                  {plan.id !== 'free' && (
                    <span className="text-xs text-neutral-400 font-semibold">
                      {billingCycle === 'annual' ? 'billed annually' : '/ month'}
                    </span>
                  )}
                </div>

                <div className="h-px bg-white/10 w-full" />

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">Included Privileges:</p>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-200 leading-relaxed">
                        <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3.5 rounded-full font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : isHighlighted
                      ? 'bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#fbbf24] text-black shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : plan.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Featured Members Only Crates Overview */}
      <section className="rounded-3xl glass-panel p-8 border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 text-brand-gold text-xs font-bold uppercase tracking-wider mb-2">
              <Disc3 className="w-3.5 h-3.5" />
              <span>Exclusive Repertoire</span>
            </div>
            <h2 className="text-2xl font-black text-white">The 8 Members Only Crates</h2>
            <p className="text-xs sm:text-sm text-neutral-300 mt-1">
              Curated master tapes, isolated multitrack stems, and deep historical cuts accessible with Crate Club & Creator Memberships.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { name: 'Slow Jams', desc: 'Late-night Quiet Storm & 90s Soul' },
            { name: 'Disco', desc: 'Studio 54 anthems & 12" club mixes' },
            { name: 'Timeless R&B | Soul Music', desc: 'Stax, Motown & 70s crate vinyl' },
            { name: 'Golden Era Hip Hop', desc: 'SP-1200 boom bap classics' },
            { name: 'Break Beats & Samples', desc: 'Open drum breaks & funk loops' },
            { name: 'Discographys', desc: 'Complete archives & rare B-sides' },
            { name: 'Stems', desc: 'Isolated multi-tracks & WAV stems' },
            { name: 'Miscellaneous', desc: 'White labels, promos & live dubplates' },
          ].map((c) => (
            <div
              key={c.name}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1 hover:border-brand-gold/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{c.name}</span>
                <Lock className="w-3 h-3 text-brand-gold" />
              </div>
              <p className="text-[11px] text-neutral-400 leading-snug">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="space-y-4 max-w-3xl mx-auto">
        <h3 className="text-xl font-bold text-white text-center">Frequently Asked Questions</h3>
        <div className="space-y-3">
          {[
            {
              q: 'Does the subscription include all of the Members Only Crates?',
              a: 'Yes, absolutely. A single subscription membership includes complete, unlimited access to all 8 Members Only Crates: Slow Jams, Disco, Timeless R&B | Soul Music, Golden Era Hip Hop, Break Beats & Samples, Discographys, Stems, and Miscellaneous archives. There are no separate per-crate purchases.',
            },
            {
              q: 'Can I cancel or switch subscription plans anytime?',
              a: 'Yes, your subscription can be upgraded, downgraded, or cancelled at any time directly through your account settings with zero penalties.',
            },
            {
              q: 'What audio fidelity do members receive?',
              a: 'Crate Club and Creator members enjoy lossless 24-bit / 96kHz FLAC master streaming, delivering every needle scratch, drum transient, and bass resonance exactly as originally recorded.',
            },
          ].map((item, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-brand-gold shrink-0" />
                {item.q}
              </p>
              <p className="text-xs text-neutral-300 leading-relaxed pl-6">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title={authActionTitle}
        description="Create your account to activate your subscription membership and unlock all Members Only Crates."
        onSuccess={() => {
          setShowAuthModal(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('chancetekone_subscription_tier', 'member');
          }
          setCurrentTier('member');
          setSubscribedMessage('Welcome to Crate Club! Your membership is active.');
        }}
      />
    </div>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-neutral-400">
          <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Loading Subscription Plans...
        </div>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}
