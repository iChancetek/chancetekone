'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Camera,
  Video,
  Lock,
  Save,
  Check,
  X,
  Upload,
  ArrowLeft,
  Shield,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Play,
  Pause,
  KeyRound,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { ProfileMediaStorageService } from '@/lib/auth/ProfileMediaStorageService';
import {
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, updateUserProfile, signOut, isAdmin } = useAuth();

  // Basic Info Form
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Password Change Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Profile Media State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Save Feedback
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync initial state from current profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.name || '');
      setBio(profile.bio || '');

      // Load persistent IndexedDB media if available
      ProfileMediaStorageService.getProfileMedia(profile.id).then((saved) => {
        if (saved) {
          setMediaPreviewUrl(saved.objectUrl);
          setMediaType(saved.type);
        } else if (profile.profileVideoUrl) {
          setMediaPreviewUrl(profile.profileVideoUrl);
          setMediaType('video');
        } else if (profile.avatarUrl) {
          setMediaPreviewUrl(profile.avatarUrl);
          setMediaType('image');
        }
      });
    }
  }, [profile]);

  // Is user signed in with email/password
  const isPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password')
  );

  // Handle Display Name & Bio Save
  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!displayName.trim()) {
      setSaveError('Display name cannot be empty.');
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Update Firebase User displayName if authenticated
      if (user) {
        try {
          await updateProfile(user, { displayName: displayName.trim() });
        } catch (fbErr) {
          console.warn('Could not update Firebase displayName:', fbErr);
        }
      }

      // 2. Update local profile context & persistent storage
      updateUserProfile({
        name: displayName.trim(),
        bio: bio.trim() || undefined,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update profile settings.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Handle Media File Selection (Photo or Video up to 50MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError(null);
    setMediaSuccess(null);

    // 1. Validate 50MB size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMediaError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 50MB.`
      );
      return;
    }

    // 2. Determine type
    const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|m4v)$/i);
    const isImg = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);

    if (!isVid && !isImg) {
      setMediaError('Unsupported file type. Please upload a photo (JPG, PNG, WEBP) or video (MP4, WEBM, MOV).');
      return;
    }

    const detectedType = isVid ? 'video' : 'image';
    setMediaType(detectedType);
    setMediaFile(file);

    // Create immediate local preview
    const tempUrl = URL.createObjectURL(file);
    setMediaPreviewUrl(tempUrl);
  };

  // Save Uploaded Photo or Video to Profile
  const handleSaveMedia = async () => {
    if (!mediaFile || !profile || !mediaType) return;

    setMediaLoading(true);
    setMediaError(null);
    setMediaSuccess(null);

    try {
      // 1. Store in IndexedDB (handles up to 50MB without quota crash)
      const userId = profile.id || user?.uid || 'usr-member';
      const stored = await ProfileMediaStorageService.saveProfileMedia(
        userId,
        mediaFile,
        mediaType,
        mediaFile.name
      );

      // 2. For image: also generate a compressed data URL thumbnail for cross-device avatarUrl
      let avatarDataUrl = profile.avatarUrl;
      if (mediaType === 'image') {
        try {
          avatarDataUrl = await createCompressedThumbnail(mediaFile);
        } catch {
          avatarDataUrl = stored.objectUrl;
        }
      }

      // 3. Update AuthContext profile
      if (mediaType === 'video') {
        updateUserProfile({
          profileVideoUrl: stored.objectUrl,
          // Keep existing avatarUrl as thumbnail or use logo
          avatarUrl: avatarDataUrl || '/images/logo.png',
        });
      } else {
        updateUserProfile({
          avatarUrl: avatarDataUrl,
          profileVideoUrl: undefined,
        });
      }

      setMediaSuccess(`Profile ${mediaType === 'video' ? 'video' : 'photo'} saved and active across the platform!`);
      setMediaFile(null);
      setTimeout(() => setMediaSuccess(null), 4000);
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to save profile media.');
    } finally {
      setMediaLoading(false);
    }
  };

  // Remove Active Profile Media
  const handleRemoveMedia = async () => {
    if (!profile) return;
    setMediaLoading(true);
    try {
      await ProfileMediaStorageService.clearProfileMedia(profile.id);
      updateUserProfile({
        avatarUrl: undefined,
        profileVideoUrl: undefined,
      });
      setMediaPreviewUrl(null);
      setMediaType(null);
      setMediaFile(null);
      setMediaSuccess('Profile media removed. Default initials will now be displayed.');
      setTimeout(() => setMediaSuccess(null), 3000);
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to remove media.');
    } finally {
      setMediaLoading(false);
    }
  };

  // Helper to create small compressed image thumbnail
  const createCompressedThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new (window as any).Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 160;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (!currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      // 1. Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Apply new password
      await updatePassword(user, newPassword);

      setPasswordSuccess('Your password has been successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Incorrect current password. Please verify and try again.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordError('For security reasons, please log out and sign in again before updating your password.');
      } else {
        setPasswordError(err.message || 'Failed to update password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-neutral-400 font-mono tracking-wider">LOADING PROFILE...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-gold mx-auto">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Sign In Required</h2>
        <p className="text-sm text-neutral-400">
          Please sign in to access your profile settings, personalize your avatar, and manage your account.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-gold text-black font-extrabold text-xs uppercase tracking-wider hover:scale-105 transition-all"
        >
          <span>Return to Home & Sign In</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/'))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
        <span className="text-xs font-mono text-neutral-500">ID: {profile.id}</span>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-brand-gold/40 bg-gradient-to-br from-[#1b102b] via-[#10091d] to-[#07050d] shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Large Live Avatar Preview */}
          <div className="relative group">
            <UserAvatar
              avatarUrl={mediaType === 'image' ? mediaPreviewUrl : profile.avatarUrl}
              videoUrl={mediaType === 'video' ? mediaPreviewUrl : profile.profileVideoUrl}
              name={profile.name}
              size="2xl"
              borderClassName="border-2 border-brand-gold shadow-[0_0_25px_rgba(245,158,11,0.35)]"
            />
            {mediaType === 'video' && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/85 border border-brand-gold text-[10px] font-black text-brand-gold uppercase tracking-wider whitespace-nowrap shadow-md">
                Live Video Avatar
              </span>
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {profile.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isAdmin
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : profile.role === 'creator'
                    ? 'bg-brand-purple/30 border-brand-purple/60 text-brand-purple'
                    : 'bg-brand-gold/20 border-brand-gold/50 text-brand-gold'
                }`}
              >
                {isAdmin ? 'Platform Administrator' : profile.role === 'creator' ? 'Verified Creator' : 'Member'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 font-mono">{profile.email}</p>

            {profile.bio && (
              <p className="text-xs text-neutral-300 max-w-xl italic mt-1">&ldquo;{profile.bio}&rdquo;</p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                Member since {new Date(profile.createdAt || Date.now()).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="text-brand-gold font-bold">
                {profile.profileVideoUrl ? 'Video Profile Active' : profile.avatarUrl ? 'Photo Profile Active' : 'Default Initials'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* SECTION 1: PROFILE MEDIA STUDIO (Photo / Video up to 50MB)*/}
        {/* ========================================================= */}
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0918]/85 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-brand-gold" />
              <h2 className="text-base font-extrabold text-white">Profile Photo or Video</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold">
              Up to 50MB
            </span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Upload your personal photo or short looping video. It is displayed when you sign in, appears next to every post and comment, and follows you everywhere across the platform.
          </p>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Media Dropzone / Preview Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-brand-gold/60 bg-white/5 hover:bg-white/[0.08] transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3 group"
          >
            {mediaPreviewUrl ? (
              <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-brand-gold/70 shadow-lg bg-black">
                {mediaType === 'video' ? (
                  <video
                    src={mediaPreviewUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={mediaPreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                  <Upload className="w-4 h-4" />
                  <span>Replace</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center text-brand-gold mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-white">Click or Drag to Upload</p>
                  <p className="text-[11px] text-neutral-400">Photos (JPG, PNG, WEBP) or Videos (MP4, WEBM, MOV)</p>
                  <p className="text-[10px] text-brand-gold font-mono">Maximum file size: 50MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Error / Success Feedback */}
          {mediaError && (
            <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{mediaError}</span>
            </div>
          )}

          {mediaSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{mediaSuccess}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose File</span>
            </button>

            {mediaFile && (
              <button
                type="button"
                onClick={handleSaveMedia}
                disabled={mediaLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{mediaLoading ? 'Saving...' : 'Save Media'}</span>
              </button>
            )}

            {(profile.avatarUrl || profile.profileVideoUrl) && (
              <button
                type="button"
                onClick={handleRemoveMedia}
                disabled={mediaLoading}
                className="py-2.5 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 cursor-pointer"
                title="Remove photo/video and use default initials"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: DISPLAY NAME & PROFILE INFO                    */}
        {/* ========================================================= */}
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0918]/85 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-brand-gold" />
              <h2 className="text-base font-extrabold text-white">Display Name & Identity</h2>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Public Presence</span>
          </div>

          <form onSubmit={handleSaveProfileInfo} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Public Name or Creator Handle"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
                maxLength={60}
                required
              />
              <p className="text-[10px] text-neutral-500">
                This name is displayed next to your posts, comments, playlists, and header.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Account Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-400 text-xs cursor-not-allowed font-mono"
              />
              <p className="text-[10px] text-neutral-500">
                Your primary account email address (used for secure sign in).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Bio (Optional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short introduction or artistic bio..."
                rows={3}
                maxLength={300}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-brand-gold transition-colors resize-none"
              />
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Maximum 300 characters</span>
                <span>{bio.length} / 300</span>
              </div>
            </div>

            {saveError && (
              <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Profile info updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saveLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLoading ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: CHANGE PASSWORD (Security Credentials)         */}
        {/* ========================================================= */}
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0918]/85 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-brand-gold" />
              <h2 className="text-base font-extrabold text-white">Change Password</h2>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Security Credentials</span>
          </div>

          {isPasswordProvider ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Current Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">New Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
                    required
                    minLength={8}
                  />
                  <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Confirm New Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-brand-gold transition-colors"
                    required
                    minLength={8}
                  />
                  <Lock className="w-3.5 h-3.5 text-neutral-500 absolute right-3.5 top-3" />
                </div>
              </div>

              {passwordError && (
                <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-white/20 hover:border-brand-gold transition-all disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-brand-gold" />
                <span>{passwordLoading ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-center py-6">
              <Shield className="w-8 h-8 text-brand-gold mx-auto" />
              <p className="text-xs font-bold text-white">Single Sign-On Managed Account</p>
              <p className="text-[11px] text-neutral-400 max-w-sm mx-auto leading-relaxed">
                You are currently signed in via Google or an external provider. Your security credentials and password are encrypted and managed directly by your provider.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: SIGN-IN GREETING & POST BADGE PREVIEW          */}
        {/* ========================================================= */}
        <div className="p-6 rounded-3xl glass-panel border border-white/10 bg-[#0e0918]/85 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-gold" />
              <h2 className="text-base font-extrabold text-white">Sign-In & Post Presence</h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Live Preview</span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Here is an authentic preview of how your photo or video appears when you sign in to ChanceTEK One and next to your comments and posts across the community:
          </p>

          {/* Sample Comment Preview */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Sample Discussion Post Preview
            </div>

            <div className="flex items-start gap-3">
              <UserAvatar
                avatarUrl={mediaType === 'image' ? mediaPreviewUrl : profile.avatarUrl}
                videoUrl={mediaType === 'video' ? mediaPreviewUrl : profile.profileVideoUrl}
                name={profile.name}
                size="md"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{profile.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase">
                    {profile.role}
                  </span>
                  <span className="text-[10px] text-neutral-500">Just now</span>
                </div>
                <p className="text-xs text-neutral-300 leading-snug">
                  Listening to the authentic breakbeats and vinyl chops on ChanceTEK One!
                </p>
              </div>
            </div>
          </div>

          {/* Sign Out Shortcut */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Done updating your account?</span>
            <button
              onClick={() => signOut()}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

