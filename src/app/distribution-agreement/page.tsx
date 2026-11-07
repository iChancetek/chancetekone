'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Scale,
  ShieldCheck,
  FileCheck,
  PenTool,
  CheckCircle2,
  DollarSign,
  Globe,
  Lock,
  ArrowRight,
  Download,
  Printer,
  Sparkles,
  AlertCircle,
  FileText,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  HelpCircle,
  Clock,
  Send,
  RotateCcw,
  BadgeCheck,
} from 'lucide-react';
import {
  DistributionAgreementService,
  SignedDistributionAgreement,
} from '@/lib/agreements/DistributionAgreementService';
import { useAuth } from '@/lib/auth/AuthContext';

export default function DistributionAgreementPage() {
  const { profile } = useAuth();

  // Form State
  const [artistLegalName, setArtistLegalName] = useState('');
  const [artistMoniker, setArtistMoniker] = useState('');
  const [entityName, setEntityName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [w9Certified, setW9Certified] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<
    'stripe_connect' | 'paypal_marketplaces' | 'direct_wire'
  >('stripe_connect');
  const [payoutRoutingIdentifier, setPayoutRoutingIdentifier] = useState('');

  // Declared Content Types
  const [contentTypes, setContentTypes] = useState<{
    music: boolean;
    video: boolean;
    audiobook: boolean;
    merchandise: boolean;
  }>({
    music: true,
    video: false,
    audiobook: false,
    merchandise: false,
  });

  // Signature State
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('type');
  const [typedSignature, setTypedSignature] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [agreedToAllTerms, setAgreedToAllTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<SignedDistributionAgreement | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Canvas Ref for Drawn Signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Pre-fill user profile info if logged in
  useEffect(() => {
    if (profile) {
      if (profile.name && !artistLegalName) setArtistLegalName(profile.name);
      if (profile.email && !email) setEmail(profile.email);
    }
  }, [profile]);

  // Canvas drawing handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#F59E0B'; // brand-gold
  }, [signatureMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasDrawnSignature(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!artistLegalName.trim()) {
      setFormError('Please enter the Artist/Creator full legal name.');
      return;
    }
    if (!artistMoniker.trim()) {
      setFormError('Please enter your Artist moniker, project, or stage name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid business email address.');
      return;
    }
    if (!w9Certified) {
      setFormError('Please certify the tax and legal representation in Section 5.');
      return;
    }
    if (!agreedToAllTerms) {
      setFormError('You must review and agree to all terms of this Distribution Agreement.');
      return;
    }

    let finalSigData = '';
    if (signatureMode === 'draw') {
      if (!hasDrawnSignature || !canvasRef.current) {
        setFormError('Please draw your digital signature on the signature pad.');
        return;
      }
      finalSigData = canvasRef.current.toDataURL('image/png');
    } else {
      if (!typedSignature.trim()) {
        setFormError('Please type your legal electronic signature.');
        return;
      }
      finalSigData = typedSignature.trim();
    }

    setSubmitting(true);

    try {
      const activeContentTypes: Array<'music' | 'video' | 'audiobook' | 'merchandise'> = [];
      if (contentTypes.music) activeContentTypes.push('music');
      if (contentTypes.video) activeContentTypes.push('video');
      if (contentTypes.audiobook) activeContentTypes.push('audiobook');
      if (contentTypes.merchandise) activeContentTypes.push('merchandise');

      const result = await DistributionAgreementService.submitAgreement({
        artistLegalName: artistLegalName.trim(),
        artistMoniker: artistMoniker.trim(),
        entityName: entityName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        w9Certified,
        paymentProvider,
        payoutRoutingIdentifier: payoutRoutingIdentifier.trim() || undefined,
        signatureType: signatureMode === 'draw' ? 'digital_drawn' : 'crypto_typed',
        signatureData: finalSigData,
        signedDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        contentTypesDeclared: activeContentTypes.length > 0 ? activeContentTypes : ['music'],
      });

      setSubmissionSuccess(result);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit agreement. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayString = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-14 px-4 sm:px-6 space-y-12 text-white">
      {/* Hero Presentation Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#18112e] via-[#0d091a] to-[#06040a] p-8 sm:p-14 shadow-2xl space-y-6">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-black uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5" />
              <span>Official Creator Covenant</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-brand-violet text-xs font-black uppercase tracking-wider">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>80 / 20 Creator Royalty Split</span>
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
            Artist / Creator Distribution Agreement
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-3xl leading-relaxed">
            ChanceTEKone.US — Music, Video & Content Onboarding. Execute your distribution covenant online and submit directly to the ChanceTEKone administrative council to authorize streaming, physical merchandise distribution, and automated royalty settlements.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-400">
            <span>Platform: ChanceTEKone.US</span>
            <span>•</span>
            <span>Jurisdiction: State of New York</span>
            <span>•</span>
            <span>Version: 1.0.0</span>
          </div>
        </div>
      </div>

      {/* Key Deal Terms At-A-Glance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-brand-gold/20 text-brand-gold flex items-center justify-center border border-brand-gold/30">
            <DollarSign className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white">80% Creator Net Share</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            80% share of net revenue from downloads and merchandise routed to your connected account.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-brand-purple/20 text-brand-violet flex items-center justify-center border border-brand-purple/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white">100% Copyright Retention</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Non-exclusive license only. You retain complete ownership of all underlying compositions and master recordings.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-brand-neon/20 text-brand-neon flex items-center justify-center border border-brand-neon/30">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white">Worldwide Distribution</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Global high-fidelity streaming, offline PWA access, 4K video exhibition, and collector vinyl pressings.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white">Direct Admin Submission</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Execute digitally with legal certificate and instant automated onboarding into the platform approval catalog.
          </p>
        </div>
      </div>

      {/* Main Legal Agreement Document (Sections 1 through 12) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-gold" />
            <span>Complete Legal Covenant</span>
          </h2>
          <span className="text-xs text-neutral-400 font-mono">12 Articles • Executable</span>
        </div>

        {/* Section 1: Parties */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">01</span>
            <h3 className="text-lg font-black text-white">Parties</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This Artist/Creator Distribution Agreement (&quot;Agreement&quot;) is entered into between ChanceTEKone (&quot;ChanceTEKone.US&quot;), and the undersigned artist/creator or rights holder (&quot;Artist/Creator&quot;), collectively the &quot;Parties.&quot;
          </p>
        </section>

        {/* Section 2: Grant of Rights */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">02</span>
            <h3 className="text-lg font-black text-white">Grant of Rights</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator grants Platform a non-exclusive, worldwide, royalty-bearing license to host, stream, reproduce, distribute, publicly perform, and make available for sale the musical works, sound recordings, videos, and related content (&quot;Content&quot;) that Artist uploads to the Platform, solely for the purpose of operating the Platform&apos;s streaming, download, and merchandise services.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This license does not transfer ownership of the underlying copyrights. Artist/Creator retains all ownership rights in the Content, subject only to the license granted here.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator may terminate this license as to specific Content by removing it from the Platform, subject to Section 7 (Term &amp; Termination).
          </p>
        </section>

        {/* Section 3: Artist/Creator Representations & Warranties */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">03</span>
            <h3 className="text-lg font-black text-white">Artist/Creator Representations &amp; Warranties</h3>
          </div>
          <ul className="space-y-2.5 text-sm text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>Artist/Creator owns or controls all necessary rights (composition, master recording, and audiovisual rights, as applicable) to grant the license in Section 2.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>The Content does not infringe the intellectual property, publicity, or privacy rights of any third party.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>If Content includes a cover, sample, or interpolation of another work, Artist/Creator has obtained or will obtain all necessary licenses (such as mechanical or sync licenses) before uploading.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>If Content includes previously label-owned recordings, Artist/Creator warrants that all rights have reverted to Artist/Creator (for instance, via statutory copyright termination) or Artist otherwise holds clear title, and will provide documentation upon request.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>Artist/Creator is legally entitled to enter into this Agreement.</span>
            </li>
          </ul>
        </section>

        {/* Section 4: Copyright & Content Responsibility */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">04</span>
            <h3 className="text-lg font-black text-white">Copyright &amp; Content Responsibility</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator represents and warrants that they own or have obtained all necessary rights, licenses, permissions, and clearances for all Content submitted to the Platform, including music, recordings, compositions, artwork, videos, samples, and other third-party material. Artist/Creator is solely responsible for any copyright infringement claims, disputes, or liabilities arising from their Content and agrees to indemnify and hold the Platform harmless from any such claims, except to the extent caused by the Platform&apos;s own unauthorized use of the Content.
          </p>
        </section>

        {/* Section 5: Revenue Share & Payment */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">05</span>
            <h3 className="text-lg font-black text-white">Revenue Share &amp; Payment</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Platform shall pay Artist/Creator an 80% share of net revenue generated from downloads and any merchandise sales attributable to Artist/Creator Content, as set out in the applicable Rate Schedule.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Payments will be processed through the Platform&apos;s designated payment infrastructure, including Stripe Connect, PayPal for Marketplaces, or comparable payment providers, which may automatically deduct the Platform&apos;s applicable share and route the Artist/Creator&apos;s portion to their designated connected payment account.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator must complete any required identity, banking, and tax verification, including providing a Form W-9 for U.S. persons. Payments will be made according to the Platform&apos;s applicable payout schedule and minimum-threshold requirements.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator is responsible for providing accurate tax information and for their own tax obligations arising from payments received.
          </p>
        </section>

        {/* Section 6: Content Standards */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">06</span>
            <h3 className="text-lg font-black text-white">Content Standards</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator agrees not to upload Content that is unlawful, infringing, defamatory, obscene, or that violates the Platform&apos;s content policies as updated from time to time. Platform reserves the right to remove Content that violates this Agreement or applicable law.
          </p>
        </section>

        {/* Section 7: Term & Termination */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">07</span>
            <h3 className="text-lg font-black text-white">Term &amp; Termination</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This Agreement remains in effect until terminated by either Party with written notice. Platform may suspend or remove Content immediately upon reasonable belief of infringement, illegality, or breach of this Agreement.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Upon termination, accrued and unpaid amounts owed to Artist remain payable.
          </p>
        </section>

        {/* Section 8: Indemnification */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">08</span>
            <h3 className="text-lg font-black text-white">Indemnification</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator agrees to indemnify and hold harmless Platform from any claims, damages, or expenses (including reasonable attorneys&apos; fees) arising from a breach of Artist/Creator&apos;s representations and warranties in Section 3, including third-party claims that Artist/Creator&apos;s Content infringes their rights.
          </p>
        </section>

        {/* Section 9: DMCA / Takedown Cooperation */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">09</span>
            <h3 className="text-lg font-black text-white">DMCA / Takedown Cooperation</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Artist/Creator agrees to cooperate with Platform&apos;s notice-and-takedown process under the Digital Millennium Copyright Act and to promptly respond to any takedown notice or counter-notice procedures involving their Content.
          </p>
        </section>

        {/* Section 10: Limitation of Liability */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">10</span>
            <h3 className="text-lg font-black text-white">Limitation of Liability</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            To the maximum extent permitted by law, Platform&apos;s liability to Artist/Creator under this Agreement is limited to amounts actually owed and unpaid to Artist/Creator under Section 4. Platform is not liable for indirect, incidental, or consequential damages.
          </p>
        </section>

        {/* Section 11: Governing Law */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">11</span>
            <h3 className="text-lg font-black text-white">Governing Law</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This Agreement is governed by the laws of the State of New York, without regard to conflict-of-law principles.
          </p>
        </section>

        {/* Section 12: General Provisions */}
        <section className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-white/10 text-brand-gold font-mono text-xs font-bold">12</span>
            <h3 className="text-lg font-black text-white">General Provisions</h3>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This Agreement, together with any referenced exhibits and the Platform&apos;s published policies, constitutes the entire agreement between the Parties.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            This Agreement may not be assigned by Artist without Platform&apos;s written consent.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Notices shall be sent to the contact information provided during onboarding.
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed">
            If any provision is found unenforceable, the remaining provisions remain in full force.
          </p>
        </section>
      </div>

      {/* Confirmation & Executed Certificate View (if already submitted) */}
      {submissionSuccess ? (
        <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-950 p-8 sm:p-12 shadow-2xl space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/30 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Executed &amp; Submitted to Council
                </span>
                <h3 className="text-2xl font-black text-white">Distribution Agreement Confirmed</h3>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  Registration ID: <span className="text-brand-gold">{submissionSuccess.id}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/20 transition-all self-start sm:self-auto"
            >
              <Printer className="w-4 h-4 text-brand-gold" />
              <span>Print Executed Certificate</span>
            </button>
          </div>

          {/* Certificate Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/40 p-6 rounded-2xl border border-white/10 text-xs">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                Artist / Rights Holder Signature
              </h4>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Legal Name:</span> {submissionSuccess.artistLegalName}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Moniker / Project:</span> {submissionSuccess.artistMoniker}
              </p>
              {submissionSuccess.entityName && (
                <p className="text-neutral-300">
                  <span className="text-neutral-500">Legal Entity:</span> {submissionSuccess.entityName}
                </p>
              )}
              <p className="text-neutral-300">
                <span className="text-neutral-500">Signatory Email:</span> {submissionSuccess.email}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Execution Date:</span> {submissionSuccess.signedDate}
              </p>

              <div className="pt-2">
                <span className="text-neutral-500 block mb-1">Electronic Signature:</span>
                {submissionSuccess.signatureType === 'digital_drawn' ? (
                  <img
                    src={submissionSuccess.signatureData}
                    alt="Digital Signature"
                    className="max-h-16 p-2 rounded-lg bg-neutral-900 border border-white/10"
                  />
                ) : (
                  <p className="font-serif italic text-lg text-brand-gold font-bold">
                    /{submissionSuccess.signatureData}/
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t md:border-t-0 md:border-l border-white/10 md:pl-6 pt-4 md:pt-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold">
                ChanceTEKone Countersignature
              </h4>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Authorized Agent:</span> {submissionSuccess.countersignedBy}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Title:</span> {submissionSuccess.countersignedTitle}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Countersigned Date:</span> {submissionSuccess.signedDate}
              </p>
              <p className="text-neutral-300">
                <span className="text-neutral-500">Revenue Split:</span> 80% to Artist / 20% to Platform
              </p>

              <div className="pt-2">
                <span className="text-neutral-500 block mb-1">Platform Institutional Seal:</span>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-gold/10 border border-brand-gold/40 text-brand-gold font-serif italic text-sm">
                  <BadgeCheck className="w-4 h-4 text-brand-gold" />
                  <span>/s/ ChanceTEKone Institutional Master Seal</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <p className="text-xs text-neutral-400">
              Your distribution agreement is registered and routed to platform administrators. You may now upload and administer your catalog.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-gold/20 flex items-center gap-2"
              >
                <span>Proceed to Admin Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Digital Signing & Submission Studio */
        <div className="rounded-3xl border border-brand-gold/30 bg-gradient-to-br from-[#191129] via-[#0d0918] to-[#08050e] p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="space-y-2 border-b border-white/10 pb-6">
            <div className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-wider">
              <PenTool className="w-4 h-4" />
              <span>Digital Signature Execution Studio</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Execute &amp; Submit Agreement
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300">
              Complete the signatory verification details below. Upon execution, your submission will be routed to the ChanceTEKone administration council.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {formError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Step 1: Signatory & Entity Information */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Signatory &amp; Identity Credentials</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Artist / Creator Legal Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johnathan Christopher Doe"
                    value={artistLegalName}
                    onChange={(e) => setArtistLegalName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Artist Moniker / Stage Name / Project *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DJ Cipher Voltage / Luna Brass"
                    value={artistMoniker}
                    onChange={(e) => setArtistMoniker(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Publishing Entity / LLC / Corporation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Concrete Groove Records LLC"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Contact Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="artist@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 019-2834"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Jurisdiction / Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Content Declarations & Payment Setup */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Declared Content &amp; 80% Royalty Payment Routing</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-neutral-200 block">
                    Content Categories to Onboard
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentTypes.music}
                        onChange={(e) => setContentTypes({ ...contentTypes, music: e.target.checked })}
                        className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0"
                      />
                      <span>Musical Works</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentTypes.video}
                        onChange={(e) => setContentTypes({ ...contentTypes, video: e.target.checked })}
                        className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0"
                      />
                      <span>Videos &amp; 4K</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentTypes.audiobook}
                        onChange={(e) => setContentTypes({ ...contentTypes, audiobook: e.target.checked })}
                        className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0"
                      />
                      <span>Audiobooks</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentTypes.merchandise}
                        onChange={(e) => setContentTypes({ ...contentTypes, merchandise: e.target.checked })}
                        className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0"
                      />
                      <span>Merchandise / Vinyl</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-neutral-200 block">
                    Payment Gateway Selection
                  </span>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentProvider === 'stripe_connect'}
                        onChange={() => setPaymentProvider('stripe_connect')}
                        className="text-brand-gold focus:ring-0"
                      />
                      <span>Stripe Connect (Instant Direct Deposit / Debit)</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentProvider === 'paypal_marketplaces'}
                        onChange={() => setPaymentProvider('paypal_marketplaces')}
                        className="text-brand-gold focus:ring-0"
                      />
                      <span>PayPal for Marketplaces (Global Wallet)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Electronic Signature Pad */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  <span>Execution &amp; Digital Signature</span>
                </h4>

                <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('type')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      signatureMode === 'type' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Type Legal Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      signatureMode === 'draw' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Draw Signature Pad
                  </button>
                </div>
              </div>

              {signatureMode === 'draw' ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl border border-white/20 bg-black/60 p-2 overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={680}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-32 touch-none cursor-crosshair rounded-xl bg-[#090611]"
                    />
                    {!hasDrawnSignature && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-neutral-500 font-serif italic">
                        Draw your digital signature here with mouse or stylus
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-neutral-400 hover:text-brand-gold flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Pad</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Type your full legal name to generate electronic cryptographic signature..."
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-base font-serif italic text-brand-gold placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
                  />
                  {typedSignature && (
                    <p className="text-xs text-neutral-400 font-mono">
                      Legal signature rendering: <span className="text-brand-gold">/{typedSignature}/</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step 4: Legal Certifications & Acceptance Checkboxes */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <label className="flex items-start gap-3 text-xs text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={w9Certified}
                  onChange={(e) => setW9Certified(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0 mt-0.5"
                />
                <span className="leading-relaxed">
                  <strong>Tax &amp; Identity Verification Certification:</strong> I certify under penalty of perjury that I will provide required identity and tax documentation (including Form W-9 for U.S. persons) and that I am solely responsible for all tax liabilities arising from my 80% revenue share.
                </span>
              </label>

              <label className="flex items-start gap-3 text-xs text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreedToAllTerms}
                  onChange={(e) => setAgreedToAllTerms(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0 mt-0.5"
                />
                <span className="leading-relaxed">
                  <strong>Execution Covenant:</strong> I have read and agree to all 12 provisions of this ChanceTEKone Artist/Creator Distribution Agreement. I warrant that I possess clear title and authority to grant the non-exclusive distribution licenses articulated herein.
                </span>
              </label>
            </div>

            {/* Step 5: Submission Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
              <div className="text-xs text-neutral-400 font-mono">
                Execution Date: <span className="text-white">{todayString}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-amber-500 to-amber-600 hover:scale-105 active:scale-95 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-brand-gold/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-black" />
                    <span>Executing &amp; Registering Agreement...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-black" />
                    <span>Sign &amp; Submit to Admins</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
