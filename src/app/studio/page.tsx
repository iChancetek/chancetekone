'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Music,
  Film,
  BookOpen,
  Mic,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Eye,
  Trash2,
  X,
  FileCheck,
  Layers,
  ArrowRight,
  Lock,
  Mail,
  Disc3,
  HelpCircle,
  FolderOpen,
  Send,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import {
  CreatorSubmission,
  SubmissionCategory,
  SubmissionStatus,
  SUBMISSION_CATEGORIES,
} from '@/types/submission';
import { SubmissionService } from '@/lib/submissions/SubmissionService';

type StudioTab = 'submit' | 'submissions' | 'published';

export default function CreatorStudioPage() {
  const { profile, user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<StudioTab>('submit');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<SubmissionCategory>('music');
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [credits, setCredits] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [copyrightCertified, setCopyrightCertified] = useState(false);

  // File Upload State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [noCoverArt, setNoCoverArt] = useState(true);

  // Status & Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Submissions State
  const [submissions, setSubmissions] = useState<CreatorSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [selectedSubmissionForEdit, setSelectedSubmissionForEdit] = useState<CreatorSubmission | null>(null);

  // Verified Email State Check
  const effectiveEmail = profile?.email || user?.email || '';
  const isEmailValid = Boolean(effectiveEmail && effectiveEmail.includes('@') && effectiveEmail.includes('.'));

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-populate artist moniker if logged in
  useEffect(() => {
    if (profile) {
      if (profile.name && !artistName) setArtistName(profile.name);
    }
  }, [profile]);

  // Load Submissions
  const loadCreatorSubmissions = async () => {
    if (!profile && !user) return;
    setIsLoadingSubmissions(true);
    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const list = await SubmissionService.fetchSubmissions({
      creatorId: profile?.id || user?.uid,
      authToken: token,
    });
    setSubmissions(list);
    setIsLoadingSubmissions(false);
  };

  useEffect(() => {
    loadCreatorSubmissions();
    const unsub = SubmissionService.subscribe(() => {
      setSubmissions(SubmissionService.getCachedSubmissions());
    });
    return () => unsub();
  }, [profile, user]);

  const currentCategoryConfig = SUBMISSION_CATEGORIES.find((c) => c.id === selectedCategory)!;

  const handleMediaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setFormError(null);

    if (!title) {
      const clean = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ');
      setTitle(clean);
    }
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Cover art must be a valid image file (JPG, PNG, WebP).');
      return;
    }

    setCoverFile(file);
    setNoCoverArt(false);

    const reader = new FileReader();
    reader.onload = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setFormError(null);
    setFormSuccess(null);

    if (!profile && !user) {
      setIsAuthModalOpen(true);
      return;
    }

    // 1. Mandatory Email Requirement
    if (!isEmailValid) {
      setFormError('A valid, authenticated email address is mandatory before submitting creative works.');
      return;
    }

    // 2. Required Fields Validation
    if (!title.trim()) {
      setFormError('Please provide a title for your creative work.');
      return;
    }

    if (!artistName.trim()) {
      setFormError('Please enter your creator or artist moniker.');
      return;
    }

    if (!mediaFile && !isDraft) {
      setFormError(`Please select a media file (${currentCategoryConfig.supportedFormats.join(', ')}) to upload.`);
      return;
    }

    // 3. Mandatory Copyright Certification
    if (!copyrightCertified && !isDraft) {
      setFormError('You must certify the copyright and master ownership declaration before submitting for review.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    try {
      let mediaUrl = '';
      let coverUrl = '';
      let fileSize = 0;
      let detectedMimeType = '';
      let mediaFormat = currentCategoryConfig.mediaFormat;

      // Upload media file if provided
      if (mediaFile) {
        setUploadProgress(40);
        const uploadRes = await SubmissionService.uploadAsset({
          file: mediaFile,
          coverFile: noCoverArt ? null : coverFile,
          noCoverArt,
          category: selectedCategory,
          userEmail: effectiveEmail,
          userId: profile?.id || user?.uid,
          authToken: token,
        });

        if (!uploadRes.success || !uploadRes.mediaUrl) {
          throw new Error(uploadRes.error || 'Failed to securely store media file.');
        }

        mediaUrl = uploadRes.mediaUrl;
        coverUrl = uploadRes.coverUrl || '';
        fileSize = uploadRes.fileSize || mediaFile.size;
        detectedMimeType = uploadRes.mimeType || mediaFile.type;
        mediaFormat = uploadRes.mediaFormat || currentCategoryConfig.mediaFormat;
      }

      setUploadProgress(75);

      // Create Submission Record
      const subRes = await SubmissionService.submitCreativeWork(
        {
          title: title.trim(),
          category: selectedCategory,
          creatorOrArtistName: artistName.trim(),
          creatorEmail: effectiveEmail,
          genre: genre.trim() || 'Independent',
          description: description.trim(),
          releaseDate: releaseDate || new Date().toISOString().split('T')[0],
          credits: credits.trim(),
          collaborators: collaborators.trim(),
          copyrightDeclaration: true,
          originalStoragePath: mediaUrl,
          coverUrl,
          fileName: mediaFile ? mediaFile.name : 'draft',
          fileSize,
          detectedMimeType,
          mediaFormat,
          isDraft,
        },
        {
          userEmail: effectiveEmail,
          userId: profile?.id || user?.uid,
          authToken: token,
        }
      );

      setUploadProgress(100);
      setIsUploading(false);

      if (subRes.success && subRes.submission) {
        setFormSuccess(
          isDraft
            ? '✓ Draft saved successfully in your Creator Studio.'
            : '✓ Submission received! Your content is now securely held in the administrative review queue. You will receive an automated email as soon as an administrator approves or reviews your work.'
        );

        // Reset form
        setTitle('');
        setGenre('');
        setDescription('');
        setCredits('');
        setCollaborators('');
        setMediaFile(null);
        setCoverFile(null);
        setCoverPreview(null);
        setNoCoverArt(true);
        setCopyrightCertified(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (coverInputRef.current) coverInputRef.current.value = '';

        loadCreatorSubmissions();
        setActiveTab('submissions');
      } else {
        setFormError(subRes.error || 'Submission processing failed.');
      }
    } catch (err: any) {
      setIsUploading(false);
      setFormError(err.message || 'An unexpected error occurred during submission.');
    }
  };

  const handleWithdraw = async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this submission from the review queue?')) return;
    let token: string | undefined;
    try {
      if (user) token = await user.getIdToken();
    } catch {}

    const res = await SubmissionService.withdrawSubmission(id, {
      userEmail: effectiveEmail,
      userId: profile?.id || user?.uid,
      authToken: token,
    });
    if (res.success) {
      loadCreatorSubmissions();
    } else {
      alert(res.error || 'Failed to withdraw submission');
    }
  };

  // Published Items
  const publishedSubmissions = submissions.filter(
    (s) => s.moderationStatus === 'approved' || s.publicationStatus === 'published'
  );

  return (
    <div className="min-h-screen pb-24 text-white">
      {/* Top Banner / Identity Section */}
      <div className="relative border-b border-white/5 bg-gradient-to-b from-[#141224] via-[#0c0b16] to-[#08080c] py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-brand-gold" />
                  Official Creator Studio
                </span>
                <span className="text-xs text-neutral-400 font-mono">8 Of Spades Works LLC</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Creator Upload &amp; Publishing Portal
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl">
                Submit master recordings, beats, 4K cinema videos, audiobooks, podcasts, books, and visual artwork.
                Every submission undergoes human administrative review before release, and you will receive transactional email updates on review decisions.
              </p>
            </div>

            {/* Creator Account Card */}
            <div className="p-4 rounded-2xl glass-panel border border-white/10 bg-black/40 min-w-[240px] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Authenticated Creator Account
              </div>
              {profile || user ? (
                <div>
                  <div className="text-sm font-black text-white truncate">
                    {profile?.name || user?.displayName || 'Creator'}
                  </div>
                  <div className="text-xs font-mono text-brand-gold flex items-center gap-1.5 truncate mt-0.5">
                    <Mail className="w-3 h-3 shrink-0" />
                    {effectiveEmail}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-neutral-400">Not signed in</p>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="mt-2 text-xs font-bold text-brand-gold hover:underline cursor-pointer"
                  >
                    Sign In to Submit Work &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email Requirement Warning Strip (if missing/unverified) */}
          {(profile || user) && !isEmailValid && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <strong>Valid Email Required:</strong> You must have a verified email on file to receive automated approval
                and review notices before submitting content.
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pt-4 border-t border-white/10">
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'submit'
                  ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Submit Creative Work
            </button>

            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'submissions'
                  ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              My Submissions &amp; Status ({submissions.length})
            </button>

            <button
              onClick={() => setActiveTab('published')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'published'
                  ? 'bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Published Works ({publishedSubmissions.length})
            </button>

            {isAdmin && (
              <Link
                href="/admin"
                className="ml-auto px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 border border-red-500/30 hover:border-red-500/60 flex items-center gap-1.5 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Holding Queue &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* ============================================================== */}
        {/* TAB 1: SUBMIT CREATIVE WORK WIZARD                             */}
        {/* ============================================================== */}
        {activeTab === 'submit' && (
          <div className="space-y-8">
            {/* Feedback Alerts */}
            {formSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
                <button onClick={() => setFormSuccess(null)} className="text-emerald-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {formError && (
              <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
                <button onClick={() => setFormError(null)} className="text-red-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 1: Category Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-gold text-black text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  Select Creative Content Category
                </h3>
                <span className="text-xs text-neutral-400">Multi-format support</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {SUBMISSION_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const Icon =
                    cat.id === 'video'
                      ? Film
                      : cat.id === 'audiobook' || cat.id === 'book' || cat.id === 'manuscript'
                      ? BookOpen
                      : cat.id === 'podcast'
                      ? Mic
                      : cat.id === 'artwork' || cat.id === 'painting'
                      ? ImageIcon
                      : Music;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3.5 rounded-2xl text-left transition-all border cursor-pointer ${
                        isSelected
                          ? 'border-brand-gold bg-brand-gold/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                          : 'border-white/10 hover:border-white/20 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-gold' : 'text-neutral-400'}`} />
                        <span className="text-[9px] font-mono text-neutral-400">
                          {cat.supportedFormats.join(', ')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white leading-snug">{cat.label}</div>
                      <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{cat.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Content Metadata & Files */}
            <div className="space-y-6 p-6 rounded-3xl glass-panel border border-white/10 bg-[#0c0b16]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-gold text-black text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  Content Metadata &amp; Media Assets ({currentCategoryConfig.label})
                </h3>
                <span className="text-xs text-brand-gold font-bold">{currentCategoryConfig.supportedFormats.join(', ')}</span>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Content Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Midnight Soul Groove"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                  />
                </div>

                {/* Creator / Artist Moniker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Creator or Artist Moniker *</label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g. Chancellor, Tevin Campbell"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                  />
                </div>

                {/* Genre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Genre / Classification</label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g. R&B / Soul, Cinema, Audiobook, Beat Tape"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                  />
                </div>

                {/* Release Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Release Date</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-brand-gold cursor-pointer"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Description &amp; Liner Notes</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your creative work, background narrative, or key credits..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
                />
              </div>

              {/* Media File Upload Viewport */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                  <span>Upload Master Media File ({currentCategoryConfig.supportedFormats.join(', ')}) *</span>
                  {selectedCategory === 'video' && (
                    <span className="text-[10px] text-cyan-300 font-bold">MOV &amp; MP4 Verified Containers</span>
                  )}
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-brand-gold/60 bg-black/40 hover:bg-black/60 transition-all text-center cursor-pointer space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={currentCategoryConfig.acceptedExtensions}
                    onChange={handleMediaFileSelect}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-brand-gold/15 text-brand-gold mx-auto flex items-center justify-center shadow-lg">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  {mediaFile ? (
                    <div>
                      <div className="text-xs font-black text-white">{mediaFile.name}</div>
                      <div className="text-[11px] text-brand-gold mt-0.5">
                        {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for review queue
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-white">Click or Drag &amp; Drop to Upload File</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        Supports {currentCategoryConfig.supportedFormats.join(', ')} (Up to 500MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Artwork & Cover Art Selector (Honors "No Cover Art" Option) */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">
                    Artwork &amp; Visual Cover
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={noCoverArt}
                      onChange={(e) => {
                        setNoCoverArt(e.target.checked);
                        if (e.target.checked) {
                          setCoverFile(null);
                          setCoverPreview(null);
                        }
                      }}
                      className="accent-brand-gold rounded cursor-pointer"
                    />
                    <span>No Cover Art (Use clean native format)</span>
                  </label>
                </div>

                {!noCoverArt && (
                  <div className="flex items-center gap-4">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg, image/png, image/webp"
                      onChange={handleCoverFileSelect}
                      className="hidden"
                    />
                    <div
                      onClick={() => coverInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/20 hover:border-brand-gold bg-black/60 shrink-0 flex items-center justify-center cursor-pointer transition-all"
                    >
                      {coverPreview ? (
                        <Image src={coverPreview} alt="Preview" fill className="object-cover" unoptimized />
                      ) : (
                        <div className="text-center p-2">
                          <ImageIcon className="w-6 h-6 text-brand-gold mx-auto mb-1" />
                          <span className="text-[9px] font-bold text-neutral-300">Select Image</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 space-y-1">
                      <p className="text-white font-bold">Custom Cover Art (Optional)</p>
                      <p>PNG or JPG square master graphic recommended (minimum 1400x1400px).</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Mandatory Rights Declaration */}
              <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyrightCertified}
                    onChange={(e) => setCopyrightCertified(e.target.checked)}
                    className="accent-brand-gold mt-1 w-4 h-4 rounded cursor-pointer shrink-0"
                  />
                  <div className="text-xs text-neutral-200 leading-relaxed">
                    <strong className="text-brand-gold block mb-0.5">Mandatory Copyright &amp; Master Ownership Certification *</strong>
                    I certify that I am the sole author, creator, or authorized rightsholder of this creative work. I declare that I own or control 100% of the copyrights and master recording rights, and authorize 8 Of Spades Works LLC to review and publish this content upon administrative approval.
                  </div>
                </label>
              </div>

              {/* Progress Bar during Upload */}
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-brand-gold">
                    <span>Uploading and Securing Asset...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-gold to-amber-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submission Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isUploading}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isUploading || !copyrightCertified}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-amber-600 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-black" />
                  {isUploading ? 'Securing Submission...' : 'Submit Creative Work for Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MY SUBMISSIONS & MODERATION STATUS                      */}
        {/* ============================================================== */}
        {activeTab === 'submissions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white">Your Submission History &amp; Editorial Decisions</h3>
              <button
                onClick={loadCreatorSubmissions}
                className="text-xs text-brand-gold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Refresh History
              </button>
            </div>

            {isLoadingSubmissions ? (
              <div className="p-12 text-center text-neutral-400 text-xs">Loading submission status...</div>
            ) : submissions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 bg-[#0f0e1a] space-y-3">
                <UploadCloud className="w-12 h-12 text-neutral-600 mx-auto" />
                <h4 className="text-base font-bold text-white">No creative submissions yet</h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Upload your singles, beats, cinema videos, audiobooks, or art to enter the administrative review queue.
                </p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="px-5 py-2.5 rounded-xl bg-brand-gold text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Create New Submission &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => {
                  return (
                    <div
                      key={sub.submissionId}
                      className="p-5 rounded-3xl glass-panel border border-white/10 bg-[#0f0e1a] space-y-4 shadow-xl"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-black/60 border border-white/10 shrink-0 flex items-center justify-center">
                            {sub.coverUrl ? (
                              <Image src={sub.coverUrl} alt={sub.title} fill className="object-cover" unoptimized />
                            ) : sub.category === 'video' ? (
                              <Film className="w-7 h-7 text-indigo-400" />
                            ) : sub.category === 'book' || sub.category === 'manuscript' ? (
                              <BookOpen className="w-7 h-7 text-emerald-400" />
                            ) : (
                              <Music className="w-7 h-7 text-brand-gold" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold bg-brand-gold/15 px-2 py-0.5 rounded border border-brand-gold/30">
                                {sub.subtype || sub.category}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                ID: {sub.submissionId.slice(-8)}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-white">{sub.title}</h4>
                            <p className="text-xs text-neutral-300">By {sub.creatorOrArtistName}</p>
                            <p className="text-[11px] text-neutral-400">
                              Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Draft'} • Version {sub.version}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {sub.moderationStatus === 'pending_review' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              Pending Review (Holding Queue)
                            </span>
                          )}
                          {sub.moderationStatus === 'approved' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved &amp; Published
                            </span>
                          )}
                          {sub.moderationStatus === 'rejected' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Review Decision: Not Approved
                            </span>
                          )}
                          {sub.moderationStatus === 'changes_requested' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                              Changes Requested
                            </span>
                          )}
                          {sub.moderationStatus === 'draft' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-neutral-300 border border-white/20">
                              Draft
                            </span>
                          )}
                          {sub.moderationStatus === 'withdrawn' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-800 text-neutral-400">
                              Withdrawn
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prominent Rejection Feedback Panel */}
                      {sub.moderationStatus === 'rejected' && sub.rejectionReason && (
                        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2">
                          <div className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            Editorial Review Feedback from Administrator:
                          </div>
                          <div className="p-3 rounded-xl bg-black/50 text-xs text-white leading-relaxed italic border border-white/5">
                            “{sub.rejectionReason}”
                          </div>
                          <div className="text-[11px] text-neutral-300 pt-1">
                            An update email containing this exact feedback was sent to <strong>{sub.creatorEmailSnapshot}</strong>. You may correct the identified issue and submit a new revision.
                          </div>
                        </div>
                      )}

                      {/* Changes Requested Panel */}
                      {sub.moderationStatus === 'changes_requested' && sub.changesRequestedNotes && (
                        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-2">
                          <div className="text-xs font-black uppercase tracking-wider text-purple-300">
                            Requested Revisions:
                          </div>
                          <div className="p-3 rounded-xl bg-black/50 text-xs text-white leading-relaxed">
                            {sub.changesRequestedNotes}
                          </div>
                        </div>
                      )}

                      {/* Submission Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                        <div className="text-neutral-400">
                          {sub.publicationStatus === 'published' ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              ✓ Live on 8 Of Spades Works Streaming Catalog
                            </span>
                          ) : (
                            <span>Holding privately until reviewed</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {sub.moderationStatus === 'pending_review' && (
                            <button
                              onClick={() => handleWithdraw(sub.submissionId)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Withdraw Submission
                            </button>
                          )}

                          {(sub.moderationStatus === 'rejected' ||
                            sub.moderationStatus === 'changes_requested' ||
                            sub.moderationStatus === 'draft') && (
                            <button
                              onClick={() => setSelectedSubmissionForEdit(sub)}
                              className="px-4 py-1.5 rounded-lg bg-brand-gold text-black text-xs font-black uppercase tracking-wider hover:scale-105 transition-all cursor-pointer"
                            >
                              Edit &amp; Resubmit &rarr;
                            </button>
                          )}

                          {sub.publicationStatus === 'published' && (
                            <Link
                              href={
                                sub.category === 'video'
                                  ? '/videos'
                                  : sub.category === 'audiobook' || sub.category === 'book'
                                  ? '/audiobooks'
                                  : '/music'
                              }
                              className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:scale-105 transition-all inline-flex items-center gap-1"
                            >
                              Stream Content &rarr;
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PUBLISHED MASTERWORKS                                  */}
        {/* ============================================================== */}
        {activeTab === 'published' && (
          <div className="space-y-6">
            <div className="pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white">Your Published Platform Catalog</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Creative works approved by administrators that are live and streaming to audience members worldwide.
              </p>
            </div>

            {publishedSubmissions.length === 0 ? (
              <div className="p-12 text-center rounded-3xl glass-panel border border-white/5 bg-[#0f0e1a] space-y-2">
                <CheckCircle2 className="w-12 h-12 text-neutral-600 mx-auto" />
                <h4 className="text-base font-bold text-white">No published masterworks yet</h4>
                <p className="text-xs text-neutral-400">
                  Approved creative works will automatically appear here with direct public streaming links.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publishedSubmissions.map((sub) => (
                  <div
                    key={sub.submissionId}
                    className="p-4 rounded-2xl glass-panel border border-emerald-500/30 bg-[#0f0e1a] space-y-3"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                      {sub.coverUrl ? (
                        <Image src={sub.coverUrl} alt={sub.title} fill className="object-cover" unoptimized />
                      ) : (
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-black uppercase">
                        Live
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white truncate">{sub.title}</h4>
                      <p className="text-xs text-neutral-400 truncate">By {sub.creatorOrArtistName}</p>
                    </div>

                    <Link
                      href={
                        sub.category === 'video'
                          ? '/videos'
                          : sub.category === 'audiobook' || sub.category === 'book'
                          ? '/audiobooks'
                          : '/music'
                      }
                      className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-brand-gold text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Stream in Catalog <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auth Modal for Unauthenticated Creators */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
