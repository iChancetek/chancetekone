'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import {
  X,
  Sparkles,
  LogIn,
  Disc3,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Music,
  Sliders,
  Video,
  Headphones,
  ArrowRight,
  ArrowLeft,
  FileSignature,
  Scale,
  ShieldCheck,
  RotateCcw,
  Check,
  Copy,
  PenTool,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  DistributionAgreementService,
  SignedDistributionAgreement,
} from '@/lib/agreements/DistributionAgreementService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  initialTab?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export type CreatorPersonaType = 'artist' | 'producer' | 'creator' | 'streamer';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  title = 'Sign in to ChanceTEK One Platform',
  description = 'Access custom crates, AI memory sync, exclusive vinyl, and high-fidelity streaming.',
  initialTab = 'signin',
  onSuccess,
}) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    profile,
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [signupStep, setSignupStep] = useState<'role_select' | 'credentials' | 'agreement' | 'confirmed'>('role_select');

  // Role Selection State
  const [selectedRole, setSelectedRole] = useState<CreatorPersonaType>('artist');

  // Basic Credentials Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Agreement Legal & Signature State
  const [artistLegalName, setArtistLegalName] = useState('');
  const [artistMoniker, setArtistMoniker] = useState('');
  const [entityName, setEntityName] = useState('');
  const [country, setCountry] = useState('United States');
  const [phone, setPhone] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'stripe_connect' | 'paypal_marketplaces' | 'direct_wire'>('stripe_connect');
  const [payoutRoutingIdentifier, setPayoutRoutingIdentifier] = useState('');
  const [w9Certified, setW9Certified] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Digital Signature
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type');
  const [typedSignature, setTypedSignature] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Submission / Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAgreementId, setSubmittedAgreementId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Synchronize legal fields from credentials
  useEffect(() => {
    if (displayName) {
      if (!artistLegalName) setArtistLegalName(displayName);
      if (!artistMoniker) setArtistMoniker(displayName);
      if (!typedSignature) setTypedSignature(displayName);
    }
  }, [displayName, artistLegalName, artistMoniker, typedSignature]);

  // Setup signature canvas
  useEffect(() => {
    if (signupStep === 'agreement' && signatureMode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#F59E0B'; // brand-gold
    }
  }, [signupStep, signatureMode]);

  if (!isOpen) return null;

  // Canvas drawing handlers
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

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    setLoading(false);
    if (res.success) {
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'Google sign in was cancelled or failed.');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    setLoading(true);

    const res = await signInWithEmail(email, password);
    setLoading(false);
    if (res.success) {
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'Invalid credentials. Please verify your email and password.');
    }
  };

  // Step 2 submit: Either finishes stream account creation or advances to agreement step
  const handleProceedFromCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      setError('A valid email address is mandatory for account registration.');
      return;
    }
    if (!password) {
      setError('Please provide a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError(null);

    // If Streamer/Listener: Complete registration directly
    if (selectedRole === 'streamer') {
      setLoading(true);
      const res = await signUpWithEmail(email, password, displayName || email.split('@')[0], {
        creatorType: 'streamer',
        agreementStatus: 'none',
        role: 'user',
      });
      setLoading(false);
      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Unable to complete registration. Please try again.');
      }
      return;
    }

    // For Artist, Producer, Creator: Proceed to agreement execution step
    setSignupStep('agreement');
  };

  // Step 3 submit: Signs and submits agreement to Admin for Human-in-the-Loop review
  const handleSignAndSubmitAgreement = async () => {
    if (!artistLegalName.trim() || !artistMoniker.trim()) {
      setError('Please provide your legal name and artist/creator moniker.');
      return;
    }
    if (!w9Certified) {
      setError('You must certify the W-9 / tax certification checkbox before submitting.');
      return;
    }
    if (!agreedToTerms) {
      setError('You must read and agree to all terms of the ChanceTEKone.US Distribution Agreement.');
      return;
    }

    let finalSigData = '';
    let finalSigType: 'crypto_typed' | 'digital_drawn' = 'crypto_typed';

    if (signatureMode === 'type') {
      if (!typedSignature.trim()) {
        setError('Please enter your typed digital signature.');
        return;
      }
      finalSigData = `/// ${typedSignature.trim()} [CRYPTOGRAPHIC ONBOARDING STAMP CHANCETEKONE-${Date.now().toString(36).toUpperCase()}] ///`;
      finalSigType = 'crypto_typed';
    } else {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawnSignature) {
        setError('Please draw your signature in the canvas box.');
        return;
      }
      finalSigData = canvas.toDataURL('image/png');
      finalSigType = 'digital_drawn';
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Submit agreement to DistributionAgreementService & server
      const agreementRecord = await DistributionAgreementService.submitAgreement({
        creatorType: selectedRole,
        artistLegalName: artistLegalName.trim(),
        artistMoniker: artistMoniker.trim(),
        entityName: entityName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || '+1 (555) 000-0000',
        address: 'Direct Creator Registration Portal',
        city: 'Digital Vault',
        state: 'TX',
        postalCode: '78701',
        country: country.trim() || 'United States',
        w9Certified: true,
        paymentProvider,
        payoutRoutingIdentifier: payoutRoutingIdentifier.trim() || undefined,
        signatureType: finalSigType,
        signatureData: finalSigData,
        signedDate: new Date().toISOString(),
        adminNotes: `New ${selectedRole.toUpperCase()} account onboarded via platform registration. Pending human admin review.`,
        contentTypesDeclared:
          selectedRole === 'artist'
            ? ['music']
            : selectedRole === 'producer'
            ? ['music', 'merchandise']
            : ['video', 'merchandise'],
      });

      // 2. Register/Create user account with creatorType and agreement metadata
      const res = await signUpWithEmail(email, password, artistMoniker.trim() || displayName, {
        creatorType: selectedRole,
        agreementStatus: 'submitted',
        agreementId: agreementRecord.id,
        role: 'user', // will be upgraded to 'creator' upon admin approval
      });

      setLoading(false);

      if (res.success) {
        setSubmittedAgreementId(agreementRecord.id);
        setSignupStep('confirmed');
      } else {
        setError(res.error || 'Failed to complete user registration. Your agreement was recorded.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'An error occurred while submitting your agreement.');
    }
  };

  const handleCopyAgreementId = () => {
    if (submittedAgreementId) {
      navigator.clipboard.writeText(submittedAgreementId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isWideAgreementStep = tab === 'signup' && (signupStep === 'agreement' || signupStep === 'confirmed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full ${
          isWideAgreementStep ? 'max-w-3xl' : 'max-w-md'
        } glass-panel p-5 sm:p-7 rounded-3xl border border-brand-purple/40 space-y-5 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_70px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto transition-all`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 pt-1">
          <div className="relative w-36 h-10">
            <Image
              src="/logo.png"
              alt="ChanceTEK One"
              fill
              sizes="144px"
              className="object-contain"
              priority
            />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">{title}</h3>
          <p className="text-xs text-neutral-300 max-w-sm">{description}</p>
        </div>

        {/* Live Profile Presence Preview upon Sign In */}
        {profile && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-brand-gold/40 shadow-inner">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              videoUrl={profile.profileVideoUrl}
              name={profile.name}
              size="md"
              borderClassName="border-2 border-brand-gold/70"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-black text-white truncate">
                Signed in as <span className="text-brand-gold">{profile.name}</span>
              </p>
              <p className="text-[10px] text-neutral-400 truncate">{profile.email}</p>
            </div>
            <Link
              href="/profile"
              onClick={onClose}
              className="text-[11px] font-bold text-brand-gold hover:underline whitespace-nowrap"
            >
              Settings &rarr;
            </Link>
          </div>
        )}

        {/* Auth Mode Tabs (Sign In vs Create Account) */}
        {signupStep !== 'confirmed' && (
          <div className="flex rounded-2xl bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'signin'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'signup'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: SIGN IN                                            */}
        {/* ========================================================= */}
        {tab === 'signin' && (
          <div className="space-y-4">
            {/* Google 1-Click Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase tracking-widest font-bold">
              <div className="flex-1 h-px bg-white/10" />
              <span>Or with Email & Password</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. chancellor@ichancetek.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-violet text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:scale-[1.01] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In with Email'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREATE ACCOUNT                                     */}
        {/* ========================================================= */}
        {tab === 'signup' && (
          <div>
            {/* ---------------------------------------------------- */}
            {/* STEP 1: ROLE SELECTION                               */}
            {/* "Are you an artist, producer, creator, or streamer?" */}
            {/* ---------------------------------------------------- */}
            {signupStep === 'role_select' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold bg-brand-gold/10 px-2.5 py-0.5 rounded-full border border-brand-gold/30">
                    Step 1 of 3 • Choose Your Platform Role
                  </span>
                  <h4 className="text-base font-extrabold text-white">
                    Are you an Artist, Producer, Creator, or Listener/Streamer?
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Select how you will participate on the ChanceTEK One platform.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'artist' as const,
                      title: 'Artist',
                      subtitle: 'Vocalist, Band, or Recording Act',
                      desc: 'Distribute original music, singles & albums with 80/20 royalty revenue split.',
                      icon: Music,
                      tag: 'Agreement Required',
                      tagColor: 'text-brand-gold bg-brand-gold/15 border-brand-gold/30',
                      borderActive: 'border-brand-gold bg-brand-gold/10',
                    },
                    {
                      id: 'producer' as const,
                      title: 'Producer',
                      subtitle: 'Beatmaker & Audio Engineer',
                      desc: 'Publish breakbeat instrumentals, sound libraries, and producer crates.',
                      icon: Sliders,
                      tag: 'Agreement Required',
                      tagColor: 'text-brand-gold bg-brand-gold/15 border-brand-gold/30',
                      borderActive: 'border-brand-gold bg-brand-gold/10',
                    },
                    {
                      id: 'creator' as const,
                      title: 'Creator',
                      subtitle: 'Filmmaker, Podcaster & Visual Artist',
                      desc: 'Showcase visual reels, music videos, audiobooks, and multimedia episodes.',
                      icon: Video,
                      tag: 'Agreement Required',
                      tagColor: 'text-brand-purple bg-brand-purple/20 border-brand-purple/40',
                      borderActive: 'border-brand-purple bg-brand-purple/10',
                    },
                    {
                      id: 'streamer' as const,
                      title: 'Listener / Streamer',
                      subtitle: 'Music Lover & Crate Digger',
                      desc: 'Stream high-fidelity music, watch videos, save crates, and follow artists.',
                      icon: Headphones,
                      tag: 'Instant Streaming',
                      tagColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
                      borderActive: 'border-emerald-500 bg-emerald-500/10',
                    },
                  ].map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isSelected
                            ? `${role.borderActive} shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.01]`
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-brand-gold text-black font-black'
                                : 'bg-white/5 text-neutral-300 border border-white/10'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${role.tagColor}`}
                          >
                            {role.tag}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-white">{role.title}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 font-medium leading-tight mt-0.5">
                            {role.subtitle}
                          </p>
                          <p className="text-[11px] text-neutral-300 mt-1.5 leading-relaxed">
                            {role.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setSignupStep('credentials')}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black text-xs font-black uppercase tracking-wider shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue as {selectedRole.toUpperCase()}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 2: ACCOUNT CREDENTIALS                          */}
            {/* ---------------------------------------------------- */}
            {signupStep === 'credentials' && (
              <form onSubmit={handleProceedFromCredentials} className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setSignupStep('role_select')}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Roles</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Selected:</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                      {selectedRole}
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <h4 className="text-sm font-extrabold text-white">Create Your Platform Account</h4>
                  <p className="text-xs text-neutral-400">
                    {selectedRole === 'streamer'
                      ? 'Instant streaming credentials for unlimited music & media.'
                      : `Enter credentials. Next, you will sign the official ${selectedRole} distribution agreement.`}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      {selectedRole === 'artist' || selectedRole === 'producer'
                        ? 'Artist / Producer Stage Moniker'
                        : selectedRole === 'creator'
                        ? 'Creator Brand / Channel Name'
                        : 'Display Name'}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Chancellor @ ChanceTEK One"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-gold text-black text-xs font-black uppercase tracking-wider shadow-xl hover:scale-[1.01] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {selectedRole === 'streamer'
                      ? loading
                        ? 'Creating Account...'
                        : 'Register Streaming Account'
                      : 'Continue to Distribution Agreement'}
                  </span>
                  {selectedRole !== 'streamer' && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 3: ARTIST/CREATOR DISTRIBUTION AGREEMENT        */}
            {/* To Read, Sign, and Submit to Admin for Review        */}
            {/* ---------------------------------------------------- */}
            {signupStep === 'agreement' && (
              <div className="space-y-5 animate-in fade-in">
                {/* Step Navigation Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setSignupStep('credentials')}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Credentials</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/40 flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      {selectedRole.toUpperCase()} AGREEMENT
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40">
                      80/20 Royalties
                    </span>
                  </div>
                </div>

                {/* Agreement Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#181228] to-purple-500/15 border border-amber-500/30 flex items-start gap-3">
                  <FileSignature className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-extrabold text-white">
                      ChanceTEKone.US — Music, Video &amp; Content Onboarding Agreement
                    </p>
                    <p className="text-neutral-300 text-[11px] leading-relaxed">
                      Please review the agreement below. You retain 100% of your copyright. ChanceTEK One provides distribution, high-fidelity streaming, and monthly 80/20 royalty payouts. Once signed, your agreement is submitted to admin for Human-in-the-Loop review.
                    </p>
                  </div>
                </div>

                {/* SCROLLABLE AGREEMENT READER BOX */}
                <div className="rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 max-h-56 sm:max-h-64 overflow-y-auto space-y-4 text-xs text-neutral-300 leading-relaxed font-sans shadow-inner">
                  <div className="border-b border-white/10 pb-3 text-center space-y-1">
                    <h5 className="text-sm font-black text-white uppercase tracking-wider">
                      Artist/Creator Distribution Agreement
                    </h5>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      ChanceTEK One • VERSION 1.0.0 • TEXAS JURISDICTION
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      1. Parties
                    </h6>
                    <p>
                      This Artist/Creator Distribution Agreement (&quot;Agreement&quot;) is entered into between ChanceTEK One (&quot;ChanceTEKone.US&quot; or &quot;Platform&quot;), and the undersigned artist, producer, creator, or rights holder (&quot;Artist/Creator&quot;), collectively the &quot;Parties.&quot;
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      2. Grant of Rights
                    </h6>
                    <p>
                      Artist/Creator grants Platform a non-exclusive, worldwide, royalty-bearing license to host, stream, reproduce, distribute, publicly perform, and make available for sale the musical works, sound recordings, videos, and related content (&quot;Content&quot;) that Artist uploads to the Platform, solely for the purpose of operating the Platform&apos;s streaming, download, and merchandise services.
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      This license does not transfer ownership of the underlying copyrights. Artist/Creator retains all ownership rights in the Content, subject only to the distribution license granted herein.
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      3. Term and Territory
                    </h6>
                    <p>
                      <strong className="text-white">Term:</strong> Initial term of one (1) year from the date of execution, automatically renewing for successive one-year terms unless either party gives thirty (30) days written notice of non-renewal.
                    </p>
                    <p className="mt-0.5">
                      <strong className="text-white">Territory:</strong> Worldwide.
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      4. Royalties and Revenue Share
                    </h6>
                    <p>
                      Platform will pay Artist/Creator eighty percent (80%) of Net Revenue directly attributable to Artist&apos;s Content (streams, downloads, direct fan support, exclusive crates). Platform retains twenty percent (20%) as a distribution and technology fee. Payouts are calculated monthly and distributed via approved electronic payment rails.
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      5. Representations and Warranties
                    </h6>
                    <p>
                      Artist/Creator represents and warrants that they are the sole owner of all rights in the Content or have secured all necessary licenses, permissions, and sample clearances; that the Content does not infringe upon any third-party copyright, trademark, or rights of privacy; and that Artist is at least 18 years of age (or represented by a legal guardian).
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      6. Content Standards &amp; Takedowns
                    </h6>
                    <p>
                      Content must comply with Platform community guidelines. Platform reserves the right to remove any Content that violates intellectual property laws, contains hate speech, or fails sample clearance verification.
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      7. Termination
                    </h6>
                    <p>
                      Either party may terminate this Agreement upon thirty (30) days written notice. Upon termination, Platform will remove Artist&apos;s Content from the active catalog within fourteen (14) business days. Accrued royalties earned prior to termination remain payable.
                    </p>
                  </div>

                  <div>
                    <h6 className="font-extrabold text-brand-gold uppercase text-[11px] mb-1">
                      8. Governing Law
                    </h6>
                    <p>
                      This Agreement is governed by the laws of the State of Texas, without regard to conflict of law principles. Any dispute arising hereunder shall be resolved in the state or federal courts located in Travis County, Texas.
                    </p>
                  </div>
                </div>

                {/* LEGAL DETAILS FORM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Signer Legal Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={artistLegalName}
                      onChange={(e) => setArtistLegalName(e.target.value)}
                      placeholder="e.g. Chancellor Sterling"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Artist / Producer / Creator Moniker *
                    </label>
                    <input
                      type="text"
                      required
                      value={artistMoniker}
                      onChange={(e) => setArtistMoniker(e.target.value)}
                      placeholder="e.g. Chancellor @ ChanceTEK One"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Publishing / Entity Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      placeholder="e.g. ChanceTEK LLC / BMI / ASCAP"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                      Country / Jurisdiction
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="United States"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-purple"
                    />
                  </div>
                </div>

                {/* DIGITAL SIGNATURE AREA */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-brand-gold" />
                      Execute Digital Signature
                    </label>

                    <div className="flex rounded-xl bg-white/5 p-0.5 border border-white/10 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSignatureMode('type')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          signatureMode === 'type'
                            ? 'bg-brand-gold text-black shadow'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Typed Signature
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignatureMode('draw')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          signatureMode === 'draw'
                            ? 'bg-brand-gold text-black shadow'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Draw Signature
                      </button>
                    </div>
                  </div>

                  {signatureMode === 'type' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder="Type your full legal name to sign"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                      />
                      {typedSignature && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                              Signature Preview:
                            </span>
                            <span className="text-xl font-serif italic text-brand-gold tracking-wide">
                              {typedSignature}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Verified Legal Timestamp: {new Date().toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative rounded-xl border border-dashed border-white/20 bg-black/70 overflow-hidden">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={120}
                          className="w-full h-28 touch-none cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400 text-center">
                        Draw your signature above using mouse, trackpad, or finger on mobile.
                      </p>
                    </div>
                  )}

                  {/* CERTIFICATION CHECKBOXES */}
                  <div className="space-y-2 pt-2">
                    <label className="flex items-start gap-2.5 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={w9Certified}
                        onChange={(e) => setW9Certified(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-white/5 text-brand-gold focus:ring-brand-gold"
                      />
                      <span>
                        <strong className="text-white">W-9 / Rights Certification:</strong> I certify under penalty of perjury that I am the authorized copyright holder or authorized entity representative with full authority to distribute this Content.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-white/5 text-brand-gold focus:ring-brand-gold"
                      />
                      <span>
                        I have read, understood, and accept all 8 sections of the <strong className="text-brand-gold">ChanceTEKone.US Distribution Agreement</strong> and submit this document for administrative review.
                      </span>
                    </label>
                  </div>
                </div>

                {/* SIGN & SUBMIT BUTTON */}
                <button
                  type="button"
                  onClick={handleSignAndSubmitAgreement}
                  disabled={loading || !w9Certified || !agreedToTerms}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold text-black text-xs font-black uppercase tracking-wider shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>
                    {loading ? 'Submitting to Admin for Review...' : 'Sign & Submit to Admin for Review'}
                  </span>
                </button>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 4: SUBMISSION CONFIRMATION                      */}
            {/* ---------------------------------------------------- */}
            {signupStep === 'confirmed' && (
              <div className="space-y-5 py-3 text-center animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-brand-gold/20 border-2 border-brand-gold/60 mx-auto flex items-center justify-center text-brand-gold shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Agreement Submitted • Human Review Active
                  </span>
                  <h4 className="text-xl font-black text-white">
                    Welcome to ChanceTEK One, {artistMoniker || displayName}!
                  </h4>
                  <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                    Your {selectedRole} Distribution Agreement has been digitally signed and routed to our administrative queue for Human-in-the-Loop review.
                  </p>
                </div>

                {/* AGREEMENT ID CARD */}
                {submittedAgreementId && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-w-md mx-auto space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400 font-mono">Agreement Registration ID:</span>
                      <button
                        type="button"
                        onClick={handleCopyAgreementId}
                        className="text-brand-gold hover:text-white flex items-center gap-1 cursor-pointer transition-colors font-mono text-[11px]"
                      >
                        {copiedId ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-sm font-extrabold text-white tracking-wider bg-black/60 py-2 px-3 rounded-xl border border-white/10">
                      {submittedAgreementId}
                    </p>
                    <p className="text-[10px] text-neutral-400 leading-tight">
                      A copy of this agreement has been filed in the ChanceTEKone.US tamper-evident vault.
                    </p>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 max-w-md mx-auto text-left text-xs text-emerald-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Immediate Listener Access Unlocked
                  </p>
                  <p className="text-[11px] leading-relaxed text-emerald-200/90">
                    You can start streaming, saving tracks, and exploring crates immediately. Content publishing, upload tools, and distribution privileges will activate automatically once an admin reviews and approves your agreement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onSuccess) onSuccess();
                  }}
                  className="w-full max-w-md mx-auto py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold text-black text-xs font-black uppercase tracking-wider shadow-xl hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Streaming &amp; Enter Platform</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
