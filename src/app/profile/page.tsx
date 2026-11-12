'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Camera,
  Lock,
  Save,
  X,
  Upload,
  ArrowLeft,
  Shield,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  KeyRound,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { ProfileMediaStorageService } from '@/lib/auth/ProfileMediaStorageService';
import { UserProfile } from '@/types/social';
import {
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

interface RealTimeToastState {
  id: number;
  title: string;
  detail: string;
  kind: 'success' | 'info';
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading, updateUserProfile, signOut, isAdmin } = useAuth();

  // Basic Info Form & Saved Snapshot (for dirty tracking)
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [savedBio, setSavedBio] = useState('');

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
  const [pendingMediaRemoval, setPendingMediaRemoval] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [previewVideoError, setPreviewVideoError] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tempPreviewUrlRef = useRef<string | null>(null);

  // Refs to prevent background profile sync from overwriting active user drafts
  const hydratedProfileIdRef = useRef<string | null>(null);
  const mediaFileRef = useRef<File | null>(null);
  const pendingMediaRemovalRef = useRef<boolean>(false);
  const bypassExitGuardRef = useRef<boolean>(false);

  // Profile Save Feedback & Real-Time Toast
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [realTimeToast, setRealTimeToast] = useState<RealTimeToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unsaved Changes Exit Guard Modal
  const [exitConfirmModalOpen, setExitConfirmModalOpen] = useState(false);
  const [pendingExitHref, setPendingExitHref] = useState<string | null>(null);
  const [exitSaving, setExitSaving] = useState(false);

  useEffect(() => {
    mediaFileRef.current = mediaFile;
  }, [mediaFile]);

  useEffect(() => {
    pendingMediaRemovalRef.current = pendingMediaRemoval;
  }, [pendingMediaRemoval]);

  // Cleanup ephemeral preview URLs and timers on unmount
  useEffect(() => {
    return () => {
      if (tempPreviewUrlRef.current) {
        try {
          URL.revokeObjectURL(tempPreviewUrlRef.current);
        } catch {}
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showRealTimeToast = useCallback(
    (title: string, detail: string, kind: 'success' | 'info' = 'success') => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setRealTimeToast({ id: Date.now(), title, detail, kind });
      toastTimerRef.current = setTimeout(() => {
        setRealTimeToast(null);
      }, 5000);
    },
    []
  );

  // Hydrate saved media preview from IndexedDB or profile URLs
  const syncSavedMediaPreview = useCallback(
    async (targetProfile: UserProfile, forceRefresh = false) => {
      const saved = await ProfileMediaStorageService.getProfileMedia(
        targetProfile.id,
        targetProfile.email,
        forceRefresh
      );

      // Abort overwrite if the user picked/removed media while IDB read was in flight
      if (mediaFileRef.current || pendingMediaRemovalRef.current) return;

      if (saved) {
        setMediaPreviewUrl(saved.objectUrl);
        setMediaType(saved.type);
        setPreviewVideoError(false);
      } else if (targetProfile.profileVideoUrl && !targetProfile.profileVideoUrl.startsWith('blob:')) {
        setMediaPreviewUrl(targetProfile.profileVideoUrl);
        setMediaType('video');
        setPreviewVideoError(false);
      } else if (targetProfile.avatarUrl && !targetProfile.avatarUrl.startsWith('blob:')) {
        setMediaPreviewUrl(targetProfile.avatarUrl);
        setMediaType('image');
        setPreviewVideoError(false);
      } else {
        setMediaPreviewUrl(null);
        setMediaType(null);
        setPreviewVideoError(false);
      }
    },
    []
  );

  // Sync initial state once per profile ID; sync live media only when no unsaved draft is staged
  useEffect(() => {
    if (!profile) {
      hydratedProfileIdRef.current = null;
      return;
    }

    const isNewProfile = hydratedProfileIdRef.current !== profile.id;
    if (isNewProfile) {
      hydratedProfileIdRef.current = profile.id;
      const initialName = profile.name || '';
      const initialBio = profile.bio || '';
      setDisplayName(initialName);
      setSavedDisplayName(initialName);
      setBio(initialBio);
      setSavedBio(initialBio);
      setMediaFile(null);
      setPendingMediaRemoval(false);
      setSaveError(null);
      setMediaError(null);
    }

    if (!mediaFileRef.current && !pendingMediaRemovalRef.current) {
      if (profile.profileVideoUrl) {
        setMediaPreviewUrl(profile.profileVideoUrl);
        setMediaType('video');
        setPreviewVideoError(false);
      } else {
        syncSavedMediaPreview(profile);
      }
    }
  }, [profile, syncSavedMediaPreview]);

  // Is user signed in with email/password
  const isPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password')
  );

  // Compute dirty state for unsaved changes protection
  const hasPasswordDraft = Boolean(currentPassword || newPassword || confirmPassword);
  const hasNameDraft = Boolean(profile && displayName.trim() !== savedDisplayName.trim());
  const hasBioDraft = Boolean(profile && bio.trim() !== savedBio.trim());
  const hasMediaDraft = Boolean(mediaFile || pendingMediaRemoval);

  const hasUnsavedChanges = Boolean(
    profile && (hasMediaDraft || hasNameDraft || hasBioDraft || hasPasswordDraft)
  );

  const unsavedSummaryItems = useMemo(() => {
    const items: string[] = [];
    if (mediaFile) {
      items.push(
        mediaType === 'video'
          ? `Uploaded profile video (${mediaFile.name})`
          : `Uploaded profile photo (${mediaFile.name})`
      );
    } else if (pendingMediaRemoval) {
      items.push('Profile photo/video removal');
    }
    if (hasNameDraft) items.push('Display Name');
    if (hasBioDraft) items.push('Profile Bio');
    if (hasPasswordDraft) items.push('Password update');
    return items;
  }, [mediaFile, mediaType, pendingMediaRemoval, hasNameDraft, hasBioDraft, hasPasswordDraft]);

  // Process Selected or Dropped Media File (Photo or Video up to 50MB)
  const processSelectedFile = (file: File) => {
    setMediaError(null);
    setMediaSuccess(null);
    setSaveError(null);
    setSaveSuccess(null);
    setPreviewVideoError(false);

    // 1. Validate 50MB size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMediaError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 50MB.`
      );
      return;
    }

    // 2. Determine type cleanly (supports broad browser MIME types & extensions)
    const isVid =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|m4v|mkv|avi|ogv|ogg|3gp)$/i.test(file.name);
    const isImg =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name);

    if (!isVid && !isImg) {
      setMediaError(
        'Unsupported file type. Please upload a photo (JPG, PNG, WEBP, GIF) or video (MP4, WEBM, MOV).'
      );
      return;
    }

    if (tempPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(tempPreviewUrlRef.current);
      } catch {}
    }

    const detectedType = isVid ? 'video' : 'image';
    const tempUrl = URL.createObjectURL(file);
    tempPreviewUrlRef.current = tempUrl;

    setPendingMediaRemoval(false);
    setMediaType(detectedType);
    setMediaFile(file);
    setMediaPreviewUrl(tempUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleDropMedia = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Cancel staged local file selection without disturbing other unsaved text edits
  const handleCancelPendingMedia = () => {
    if (tempPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(tempPreviewUrlRef.current);
      } catch {}
      tempPreviewUrlRef.current = null;
    }
    setMediaFile(null);
    mediaFileRef.current = null;
    setPendingMediaRemoval(false);
    pendingMediaRemovalRef.current = false;
    setMediaError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (profile) {
      syncSavedMediaPreview(profile, true);
    }
  };

  // Stage removal of active profile media (persisted immediately via Confirm Removal or Save Profile)
  const handleStageRemoveMedia = () => {
    if (tempPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(tempPreviewUrlRef.current);
      } catch {}
      tempPreviewUrlRef.current = null;
    }
    setMediaFile(null);
    mediaFileRef.current = null;
    setPendingMediaRemoval(true);
    pendingMediaRemovalRef.current = true;
    setMediaPreviewUrl(null);
    setMediaType(null);
    setMediaError(null);
    setMediaSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Shared helper to persist staged media upload or removal durably (Server/Cloud + IndexedDB cache)
  const persistMediaChanges = async (
    activeProfile: UserProfile
  ): Promise<{
    patch: Partial<UserProfile>;
    label?: string;
    toastTitle?: string;
    inlineMsg?: string;
  }> => {
    const userId = activeProfile.id || user?.uid || 'usr-member';

    if (mediaFile && mediaType) {
      const savedType = mediaType;

      // 1. Write immediately to local IndexedDB (ArrayBuffer + Blob) for instant offline resilience
      const stored = await ProfileMediaStorageService.saveProfileMedia(
        userId,
        mediaFile,
        savedType,
        mediaFile.name,
        activeProfile.email
      );

      // 2. Upload durably to Server API (/api/profile/media -> Firebase Admin / .data) or Client Firebase Storage
      let durableUrl: string | undefined;
      try {
        const uploaded = await ProfileMediaStorageService.uploadDurableProfileMedia({
          userId,
          email: activeProfile.email,
          file: mediaFile,
          mediaType: savedType,
        });
        durableUrl = uploaded.url;
      } catch (uploadErr: any) {
        const msg = String(uploadErr?.message || '');
        const isHardRejection =
          /413|exceeds|unsupported|not authorized|authentication/i.test(msg);
        if (isHardRejection) {
          throw uploadErr;
        }
        console.warn('[ProfilePage] Durable remote upload failed, falling back locally:', uploadErr);
      }

      let avatarDataUrl =
        activeProfile.avatarUrl && !activeProfile.avatarUrl.startsWith('blob:')
          ? activeProfile.avatarUrl
          : undefined;
      const patch: Partial<UserProfile> = {};

      if (savedType === 'image') {
        if (durableUrl) {
          avatarDataUrl = durableUrl;
          if (user && durableUrl.startsWith('https://')) {
            await updateProfile(user, { photoURL: durableUrl }).catch(() => {});
          }
        } else {
          try {
            avatarDataUrl = await createCompressedThumbnail(mediaFile);
          } catch {
            avatarDataUrl = stored.objectUrl;
          }
        }
        patch.avatarUrl = avatarDataUrl;
        patch.profileVideoUrl = undefined;
      } else {
        patch.profileVideoUrl = durableUrl || stored.objectUrl;
        patch.avatarUrl = avatarDataUrl || '/images/logo.png';
      }

      if (tempPreviewUrlRef.current && tempPreviewUrlRef.current !== stored.objectUrl) {
        try {
          URL.revokeObjectURL(tempPreviewUrlRef.current);
        } catch {}
        tempPreviewUrlRef.current = null;
      }

      const activePreview = durableUrl || stored.objectUrl;
      setMediaFile(null);
      mediaFileRef.current = null;
      setPendingMediaRemoval(false);
      pendingMediaRemovalRef.current = false;
      setMediaPreviewUrl(activePreview);
      setMediaType(savedType);
      setPreviewVideoError(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const inlineMsg = durableUrl
        ? `Profile ${savedType === 'video' ? 'video' : 'photo'} saved durably across sessions, sign-in, and devices!`
        : `Profile ${savedType === 'video' ? 'video' : 'photo'} saved locally (offline mode).`;
      return {
        patch,
        label: savedType === 'video' ? 'Profile Video' : 'Profile Photo',
        toastTitle: 'Profile Media Saved',
        inlineMsg,
      };
    }

    if (pendingMediaRemoval) {
      await ProfileMediaStorageService.clearDurableProfileMedia(
        activeProfile.id,
        activeProfile.email
      );
      if (user) {
        await updateProfile(user, { photoURL: '' }).catch(() => {});
      }
      setPendingMediaRemoval(false);
      pendingMediaRemovalRef.current = false;
      setMediaPreviewUrl(null);
      setMediaType(null);

      return {
        patch: { avatarUrl: undefined, profileVideoUrl: undefined },
        label: 'Profile Media Removal',
        toastTitle: 'Profile Media Removed',
        inlineMsg: 'Profile media removed across platform and cloud storage. Default initials are now displayed.',
      };
    }

    return { patch: {} };
  };

  // Persist ONLY the uploaded/staged media immediately (Card 1 quick Save Media button)
  const handleSaveMedia = async () => {
    if (!profile || (!mediaFile && !pendingMediaRemoval)) return;

    setMediaLoading(true);
    setMediaError(null);
    setMediaSuccess(null);

    try {
      const result = await persistMediaChanges(profile);
      if (result.label) {
        updateUserProfile(result.patch);
        if (result.inlineMsg) {
          setMediaSuccess(result.inlineMsg);
          showRealTimeToast(result.toastTitle || 'Profile Media Saved', result.inlineMsg, 'success');
          setTimeout(() => setMediaSuccess(null), 4500);
        }
      }
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to save profile media.');
    } finally {
      setMediaLoading(false);
    }
  };

  // Unified Atomic Save: Saves uploaded photo/video (or removal), Display Name, Bio, and optional Password draft
  const handleSaveAllProfileChanges = async (): Promise<boolean> => {
    if (!profile) return false;

    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      setSaveError('Display name cannot be empty.');
      return false;
    }

    if (hasPasswordDraft && isPasswordProvider) {
      if (!currentPassword) {
        const msg = 'Please enter your current password to save your password change.';
        setPasswordError(msg);
        setSaveError(msg);
        return false;
      }
      if (newPassword.length < 8) {
        const msg = 'New password must be at least 8 characters long.';
        setPasswordError(msg);
        setSaveError(msg);
        return false;
      }
      if (newPassword !== confirmPassword) {
        const msg = 'New passwords do not match.';
        setPasswordError(msg);
        setSaveError(msg);
        return false;
      }
    }

    // If nothing has changed, let the user know in real time without failing silently
    if (!hasUnsavedChanges) {
      showRealTimeToast(
        'Profile Up to Date',
        'All Account Profile & Settings are already saved.',
        'info'
      );
      setSaveSuccess('Your Account Profile & Settings are up to date.');
      setTimeout(() => setSaveSuccess(null), 3500);
      return true;
    }

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(null);
    if (hasMediaDraft) {
      setMediaLoading(true);
      setMediaError(null);
      setMediaSuccess(null);
    }
    if (hasPasswordDraft && isPasswordProvider) {
      setPasswordLoading(true);
      setPasswordError(null);
      setPasswordSuccess(null);
    }

    try {
      let profilePatch: Partial<UserProfile> = {};
      const savedLabels: string[] = [];

      // 1. Persist staged photo/video or removal to IndexedDB
      if (hasMediaDraft) {
        const mediaResult = await persistMediaChanges(profile);
        profilePatch = { ...mediaResult.patch };
        if (mediaResult.label) savedLabels.push(mediaResult.label);
        if (mediaResult.inlineMsg) {
          setMediaSuccess(mediaResult.inlineMsg);
          setTimeout(() => setMediaSuccess(null), 4500);
        }
      }

      // 2. Apply password update if user filled password fields
      if (hasPasswordDraft && isPasswordProvider && user?.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess('Your password has been updated.');
        setTimeout(() => setPasswordSuccess(null), 5000);
        savedLabels.push('Password');
      }

      // 3. Apply Firebase displayName & atomic AuthContext update
      if (hasNameDraft || hasBioDraft || Object.keys(profilePatch).length > 0) {
        if (user && hasNameDraft) {
          try {
            await updateProfile(user, { displayName: trimmedName });
          } catch (fbErr) {
            console.warn('Could not update Firebase displayName:', fbErr);
          }
        }

        if (hasNameDraft) savedLabels.push('Display Name');
        if (hasBioDraft) savedLabels.push('Bio');

        updateUserProfile({
          ...profilePatch,
          name: trimmedName,
          bio: trimmedBio || undefined,
        });

        setDisplayName(trimmedName);
        setSavedDisplayName(trimmedName);
        setBio(trimmedBio);
        setSavedBio(trimmedBio);
      }

      const detailText =
        savedLabels.length > 0
          ? `Saved ${savedLabels.join(', ')}. Changes are now live across the platform.`
          : 'Your Account Profile & Settings have been saved.';

      setSaveSuccess(detailText);
      showRealTimeToast('Account Profile & Settings Saved', detailText, 'success');
      setTimeout(() => setSaveSuccess(null), 4500);
      return true;
    } catch (err: any) {
      let message = err?.message || 'Failed to save Account Profile & Settings.';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        message = 'Incorrect current password. Please verify and try again.';
        setPasswordError(message);
      } else if (err?.code === 'auth/requires-recent-login') {
        message =
          'For security reasons, please log out and sign in again before updating your password.';
        setPasswordError(message);
      }
      setSaveError(message);
      return false;
    } finally {
      setSaveLoading(false);
      setMediaLoading(false);
      setPasswordLoading(false);
    }
  };

  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveAllProfileChanges();
  };

  // Discard all staged media, text, and password edits back to last saved values
  const discardAllUnsavedChanges = () => {
    if (tempPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(tempPreviewUrlRef.current);
      } catch {}
      tempPreviewUrlRef.current = null;
    }
    setMediaFile(null);
    mediaFileRef.current = null;
    setPendingMediaRemoval(false);
    pendingMediaRemovalRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setDisplayName(savedDisplayName);
    setBio(savedBio);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSaveError(null);
    setMediaError(null);
    setPasswordError(null);

    if (profile) {
      syncSavedMediaPreview(profile, true);
    }
  };

  // Execute navigation away from /profile
  const executeExit = useCallback(
    (targetHref?: string | null) => {
      bypassExitGuardRef.current = true;
      setExitConfirmModalOpen(false);
      setPendingExitHref(null);

      if (targetHref) {
        router.push(targetHref);
      } else if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    },
    [router]
  );

  const attemptExit = useCallback(
    (targetHref?: string | null) => {
      if (hasUnsavedChanges) {
        setPendingExitHref(targetHref || null);
        setExitConfirmModalOpen(true);
      } else {
        executeExit(targetHref);
      }
    },
    [hasUnsavedChanges, executeExit]
  );

  const handleSaveAndExit = async () => {
    setExitSaving(true);
    const ok = await handleSaveAllProfileChanges();
    setExitSaving(false);
    if (ok) {
      executeExit(pendingExitHref);
    } else {
      setExitConfirmModalOpen(false);
    }
  };

  const handleDisregardAndExit = () => {
    const target = pendingExitHref;
    discardAllUnsavedChanges();
    executeExit(target);
  };

  // Warn browser tab close/reload if unsaved edits exist
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassExitGuardRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intercept in-app <Link> clicks when leaving /profile with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (bypassExitGuardRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.origin);
        if (dest.origin === window.location.origin && dest.pathname !== '/profile') {
          e.preventDefault();
          e.stopPropagation();
          setPendingExitHref(`${dest.pathname}${dest.search}${dest.hash}`);
          setExitConfirmModalOpen(true);
        }
      } catch {}
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedChanges]);

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

      const msg = 'Your password has been successfully updated.';
      setPasswordSuccess(msg);
      showRealTimeToast('Password Updated', msg, 'success');
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

  const activePreviewName = displayName.trim() || profile.name;
  const activePreviewAvatarUrl = pendingMediaRemoval
    ? undefined
    : mediaType === 'image'
    ? mediaPreviewUrl
    : mediaType === 'video'
    ? profile.avatarUrl && !profile.avatarUrl.startsWith('blob:')
      ? profile.avatarUrl
      : '/images/logo.png'
    : profile.avatarUrl;
  const activePreviewVideoUrl = pendingMediaRemoval
    ? undefined
    : mediaType === 'video'
    ? mediaPreviewUrl
    : mediaType === 'image'
    ? undefined
    : profile.profileVideoUrl;

  return (
    <div className="relative max-w-4xl mx-auto py-6 sm:py-8 space-y-8 animate-in fade-in duration-300">
      {/* Real-Time Save Confirmation Toast */}
      {realTimeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-[120] max-w-sm w-[calc(100vw-2rem)] rounded-2xl border border-emerald-400/50 bg-[#0b1812]/95 backdrop-blur-xl p-4 shadow-[0_20px_50px_rgba(16,185,129,0.28)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-emerald-200 tracking-wide uppercase">
                  {realTimeToast.title}
                </p>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-mono text-emerald-300 uppercase">
                  Saved Live
                </span>
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed">{realTimeToast.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setRealTimeToast(null)}
              aria-label="Dismiss save confirmation"
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Navigation & Account Profile & Settings Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => attemptExit()}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-400 hover:text-brand-gold transition-all duration-200 cursor-pointer group py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-white tracking-tight">
              Account Profile &amp; Settings
            </span>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] font-bold text-amber-300 animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-mono text-neutral-500 mr-1">
            ID: {profile.id}
          </span>

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => handleSaveAllProfileChanges()}
              disabled={saveLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLoading ? 'Saving...' : 'Save Profile'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => attemptExit()}
            title="Close Account Profile & Settings"
            aria-label="Close Account Profile & Settings"
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/50 text-neutral-300 hover:text-red-300 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-brand-gold/40 bg-gradient-to-br from-[#1b102b] via-[#10091d] to-[#07050d] shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Large Live Avatar Preview */}
          <div className="relative group">
            <UserAvatar
              avatarUrl={activePreviewAvatarUrl}
              videoUrl={activePreviewVideoUrl}
              name={activePreviewName}
              size="2xl"
              borderClassName="border-2 border-brand-gold shadow-[0_0_25px_rgba(245,158,11,0.35)]"
            />
            {mediaType === 'video' && !pendingMediaRemoval && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/85 border border-brand-gold text-[10px] font-black text-brand-gold uppercase tracking-wider whitespace-nowrap shadow-md">
                {mediaFile ? 'Video Preview (Unsaved)' : 'Live Video Avatar'}
              </span>
            )}
            {mediaType === 'image' && mediaFile && !pendingMediaRemoval && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/85 border border-amber-400 text-[10px] font-black text-amber-300 uppercase tracking-wider whitespace-nowrap shadow-md">
                Photo Preview (Unsaved)
              </span>
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activePreviewName}
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

            {(bio || profile.bio) && (
              <p className="text-xs text-neutral-300 max-w-xl italic mt-1">
                &ldquo;{bio || profile.bio}&rdquo;
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                Member since {new Date(profile.createdAt || Date.now()).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="text-brand-gold font-bold">
                {pendingMediaRemoval
                  ? 'Removal Pending Save'
                  : mediaFile
                  ? `Unsaved ${mediaType === 'video' ? 'Video' : 'Photo'} Selected`
                  : profile.profileVideoUrl
                  ? 'Video Profile Active'
                  : profile.avatarUrl
                  ? 'Photo Profile Active'
                  : 'Default Initials'}
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
            accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi,.ogv,.ogg,.3gp"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Media Dropzone / Preview Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingMedia(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingMedia(false);
            }}
            onDrop={handleDropMedia}
            className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3 group ${
              isDraggingMedia
                ? 'border-brand-gold bg-brand-gold/15 scale-[1.01]'
                : 'border-white/20 hover:border-brand-gold/60 bg-white/5 hover:bg-white/[0.08]'
            }`}
          >
            {mediaPreviewUrl ? (
              <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-brand-gold/70 shadow-lg bg-black">
                {mediaType === 'video' ? (
                  <video
                    key={mediaPreviewUrl}
                    src={mediaPreviewUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    onError={() => setPreviewVideoError(true)}
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

          {/* Pending Staged File Notice */}
          {mediaFile && (
            <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-400/40 text-xs text-amber-100 flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold truncate">
                  Selected: {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
                <p className="text-[11px] text-amber-200/80">
                  Pending — click <strong>Save Media</strong> or <strong>Save Profile</strong> to apply across the platform.
                </p>
                {previewVideoError && (
                  <p className="text-[11px] text-amber-300 font-medium pt-0.5">
                    Browser preview may differ for this video container, but you can still save it.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pending Media Removal Notice */}
          {pendingMediaRemoval && (
            <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-400/40 text-xs text-amber-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Profile media cleared. Click <strong>Confirm Removal</strong> or{' '}
                <strong>Save Profile</strong> to remove it across the platform.
              </span>
            </div>
          )}

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
              <span>{mediaPreviewUrl ? 'Replace File' : 'Choose File'}</span>
            </button>

            {mediaFile && (
              <>
                <button
                  type="button"
                  onClick={handleSaveMedia}
                  disabled={mediaLoading || saveLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{mediaLoading ? 'Saving...' : 'Save Media'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPendingMedia}
                  disabled={mediaLoading || saveLoading}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold border border-white/15 flex items-center gap-1.5 cursor-pointer"
                  title="Cancel staged upload"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            )}

            {pendingMediaRemoval && !mediaFile && (
              <>
                <button
                  type="button"
                  onClick={handleSaveMedia}
                  disabled={mediaLoading || saveLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/85 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{mediaLoading ? 'Removing...' : 'Confirm Removal'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPendingMedia}
                  disabled={mediaLoading || saveLoading}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              </>
            )}

            {!mediaFile &&
              !pendingMediaRemoval &&
              (mediaPreviewUrl || profile.avatarUrl || profile.profileVideoUrl) && (
                <button
                  type="button"
                  onClick={handleStageRemoveMedia}
                  disabled={mediaLoading || saveLoading}
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
              <h2 className="text-base font-extrabold text-white">Display Name &amp; Identity</h2>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Public Presence</span>
          </div>

          <form onSubmit={handleSaveProfileInfo} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
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
                onChange={(e) => {
                  setBio(e.target.value);
                  setSaveError(null);
                  setSaveSuccess(null);
                }}
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

            {hasMediaDraft && (
              <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-[11px] text-brand-gold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Clicking <strong>Save Profile</strong> will also apply your staged profile{' '}
                  {mediaFile ? (mediaType === 'video' ? 'video' : 'photo') : 'media removal'}.
                </span>
              </div>
            )}

            {saveError && (
              <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saveLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLoading ? 'Saving Profile...' : 'Save Profile'}</span>
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
              <h2 className="text-base font-extrabold text-white">Sign-In &amp; Post Presence</h2>
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
                avatarUrl={activePreviewAvatarUrl}
                videoUrl={activePreviewVideoUrl}
                name={activePreviewName}
                size="md"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{activePreviewName}</span>
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
              type="button"
              onClick={() => signOut()}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Unified Account Profile & Settings Footer Action Bar */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          hasUnsavedChanges
            ? 'border-amber-400/50 bg-[#1a1208]/90 shadow-[0_12px_40px_rgba(245,158,11,0.16)]'
            : 'border-white/10 bg-[#0e0918]/85'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {hasUnsavedChanges ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs sm:text-sm font-extrabold text-white">
              {hasUnsavedChanges
                ? 'You have unsaved Account Profile & Settings changes'
                : 'All Account Profile & Settings saved'}
            </span>
          </div>
          {hasUnsavedChanges ? (
            <p className="text-[11px] text-amber-200/85">
              Pending: {unsavedSummaryItems.join(' • ')}
            </p>
          ) : (
            <p className="text-[11px] text-neutral-400">
              Your profile media, display name, bio, and credentials are synchronized.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={discardAllUnsavedChanges}
              disabled={saveLoading}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveAllProfileChanges()}
            disabled={saveLoading}
            className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveLoading ? 'Saving Profile...' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal (Triggered on X / Back / Navigation while dirty) */}
      {exitConfirmModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-profile-exit-title"
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-3xl border border-brand-gold/40 bg-[#120b1f] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.75)] space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="unsaved-profile-exit-title"
                    className="text-base font-black text-white leading-tight"
                  >
                    Unsaved Account Profile &amp; Settings
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Do you want to save your changes before exiting?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExitConfirmModalOpen(false);
                  setPendingExitHref(null);
                }}
                aria-label="Keep editing"
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {unsavedSummaryItems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Changes Ready to Save
                </p>
                <ul className="space-y-1 text-xs text-neutral-200">
                  {unsavedSummaryItems.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />
                      <span className="truncate">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveAndExit}
                disabled={exitSaving || saveLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{exitSaving ? 'Saving & Exiting...' : 'Save & Exit'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisregardAndExit}
                disabled={exitSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Disregard Changes &amp; Exit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExitConfirmModalOpen(false);
                  setPendingExitHref(null);
                }}
                disabled={exitSaving}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

