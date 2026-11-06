'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Track } from '@/types/media';
import { MusicCatalogService, KNOWN_ALBUM_COVERS, isGenericOrVirtualAlbum } from '@/lib/music/MusicCatalogService';
import { extractCoverArtFromImageFile, optimizeCoverArtDataUrl } from '@/lib/audio/id3Parser';
import {
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
  Layers,
  AlertCircle,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';

interface PlatformChangeCoverArtModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  albumTitle?: string;
  isAlbumMode?: boolean;
  onSuccess?: (message: string, onUndo?: () => void) => void;
  adminActor?: { id?: string; name?: string };
}

export const PlatformChangeCoverArtModal: React.FC<PlatformChangeCoverArtModalProps> = ({
  isOpen,
  onClose,
  track,
  albumTitle,
  isAlbumMode = false,
  onSuccess,
  adminActor,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [applyToEntireAlbum, setApplyToEntireAlbum] = useState<boolean>(Boolean(isAlbumMode));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveAlbumTitle = albumTitle || track?.albumTitle || 'Album';
  const isVirtual = isGenericOrVirtualAlbum(effectiveAlbumTitle) || isGenericOrVirtualAlbum(track?.albumId);
  const effectiveIsAlbumMode = Boolean(isAlbumMode && !isVirtual);

  useEffect(() => {
    if (track) {
      setPreviewUrl(track.coverUrl || '');
      setUrlInput(track.coverUrl || '');
      setErrorMessage(null);
      setIsSaving(false);
      // In track mode or virtual collection, default to updating ONLY this track
      setApplyToEntireAlbum(Boolean(effectiveIsAlbumMode));
    }
  }, [track, isOpen, effectiveIsAlbumMode]);

  if (!isOpen || !track) return null;

  // Handle local file selection with client-side canvas compression for iOS / Mobile PWA
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 25MB. Please choose a smaller image.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      // Compress and optimize image to max 500x500 at 0.85 quality (~30-50KB).
      // Eliminates iOS Safari / WebKit memory crashes and localStorage quota exhaustion.
      const optimized = await extractCoverArtFromImageFile(file);
      setPreviewUrl(optimized);
      setUrlInput('');
    } catch (err: any) {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          try {
            const opt = await optimizeCoverArtDataUrl(reader.result, 500, 0.85);
            setPreviewUrl(opt);
          } catch {
            setPreviewUrl(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle URL change with auto-optimization for data URLs
  const handleApplyUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter an image URL.');
      return;
    }
    if (trimmed.startsWith('data:image')) {
      try {
        const opt = await optimizeCoverArtDataUrl(trimmed, 500, 0.85);
        setPreviewUrl(opt);
      } catch {
        setPreviewUrl(trimmed);
      }
    } else {
      setPreviewUrl(trimmed);
    }
    setErrorMessage(null);
  };

  // Handle Preset selection
  const handleSelectPreset = (coverUrl: string) => {
    setPreviewUrl(coverUrl);
    setUrlInput(coverUrl);
    setErrorMessage(null);
  };

  // Save Cover Art in Real Time
  const handleSave = async () => {
    if (!previewUrl) {
      setErrorMessage('Please provide or select a cover art image.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      let finalCover = previewUrl;
      if (finalCover.startsWith('data:image')) {
        try {
          finalCover = await optimizeCoverArtDataUrl(finalCover, 500, 0.85);
        } catch {}
      }
      const previousCover = track.coverUrl;
      const isGeneric = isGenericOrVirtualAlbum(effectiveAlbumTitle) || isGenericOrVirtualAlbum(track.albumId);
      if (effectiveIsAlbumMode && applyToEntireAlbum && !isGeneric) {
        // Update entire album and all matching tracks strictly scoped to this album and artist
        MusicCatalogService.updateAlbumCover(effectiveAlbumTitle, finalCover, adminActor, {
          artistName: track.artistName,
          albumId: track.albumId,
          trackId: track.id,
        });
        if (onSuccess) {
          onSuccess(
            `Cover art updated in real time for album "${effectiveAlbumTitle}".`,
            () => {
              if (previousCover) {
                MusicCatalogService.updateAlbumCover(effectiveAlbumTitle, previousCover, adminActor, {
                  artistName: track.artistName,
                  albumId: track.albumId,
                  trackId: track.id,
                });
              } else {
                MusicCatalogService.revertAlbumCover(effectiveAlbumTitle, track.artistName, adminActor);
              }
            }
          );
        }
      } else {
        // Update ONLY this specific track
        MusicCatalogService.updateTrack(track.id, { coverUrl: finalCover }, adminActor);
        if (onSuccess) {
          onSuccess(
            `Cover art updated in real time for track "${track.title}".`,
            () => {
              if (previousCover) {
                MusicCatalogService.updateTrack(track.id, { coverUrl: previousCover }, adminActor);
              } else {
                MusicCatalogService.revertTrackCover(track.id, adminActor);
              }
            }
          );
        }
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update cover art.');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert back to original authentic studio artwork
  const handleRevertToOriginal = () => {
    if (!track) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const previousCover = track.coverUrl;
      const isGeneric = isGenericOrVirtualAlbum(effectiveAlbumTitle) || isGenericOrVirtualAlbum(track.albumId);
      if (effectiveIsAlbumMode && !isGeneric) {
        MusicCatalogService.revertAlbumCover(effectiveAlbumTitle, track.artistName, adminActor);
        if (onSuccess) {
          onSuccess(
            `Reverted album "${effectiveAlbumTitle}" back to authentic original artwork.`,
            () => {
              if (previousCover) {
                MusicCatalogService.updateAlbumCover(effectiveAlbumTitle, previousCover, adminActor, {
                  artistName: track.artistName,
                  albumId: track.albumId,
                  trackId: track.id,
                });
              }
            }
          );
        }
      } else {
        MusicCatalogService.revertTrackCover(track.id, adminActor);
        if (onSuccess) {
          onSuccess(
            `Reverted track "${track.title}" back to authentic original artwork.`,
            () => {
              if (previousCover) {
                MusicCatalogService.updateTrack(track.id, { coverUrl: previousCover }, adminActor);
              }
            }
          );
        }
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to revert cover art.');
    } finally {
      setIsSaving(false);
    }
  };

  // Presets matching artist or general
  const trackArtistLower = String(track?.artistName || '').toLowerCase();
  const artistPresets = KNOWN_ALBUM_COVERS.filter(
    (k) => trackArtistLower.includes(String(k.artist || '').toLowerCase())
  );
  const otherPresets = KNOWN_ALBUM_COVERS.filter(
    (k) => !trackArtistLower.includes(String(k.artist || '').toLowerCase())
  ).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#181126] via-[#100a1c] to-[#0a0712] border border-brand-purple/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {isAlbumMode ? 'Change Album Artwork' : 'Change Track Artwork'}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                  {isAlbumMode ? 'Entire Album' : 'Single Song'}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isAlbumMode ? (
                  <>
                    Album: <span className="text-white font-semibold">{effectiveAlbumTitle}</span> • {track.artistName}
                  </>
                ) : (
                  <>
                    Track: <span className="text-white font-semibold">{track.title}</span> • {track.artistName}
                    {effectiveAlbumTitle !== 'Single' && (
                      <span className="text-brand-gold/80"> ({effectiveAlbumTitle})</span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-5 relative z-10">
          {/* Left Preview Box */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="relative w-44 h-44 rounded-2xl overflow-hidden border-2 border-brand-gold/40 shadow-xl bg-neutral-900 group">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Cover Art Preview"
                  fill
                  className="object-cover transition-transform group-hover:scale-105 duration-300"
                  unoptimized={previewUrl.startsWith('data:') || previewUrl.startsWith('blob:')}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <span className="text-xs">No artwork</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-white font-mono">Live Artwork Preview</span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-xs font-semibold text-white truncate max-w-[180px] block">
                {effectiveAlbumTitle}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                Square 1:1 Recommended
              </span>
            </div>
          </div>

          {/* Right Selection Tabs */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            {/* Tab Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-brand-gold text-black shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'url'
                    ? 'bg-brand-gold text-black shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Image URL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'presets'
                    ? 'bg-brand-gold text-black shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Presets</span>
              </button>
            </div>

            {/* Tab 1: Upload */}
            {activeTab === 'upload' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-brand-gold/60 bg-white/[0.02] hover:bg-brand-gold/5 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-gold/15 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-white">Click to browse image file</p>
                  <p className="text-[10px] text-neutral-400 font-mono">PNG, JPG, or WEBP up to 5MB</p>
                </button>
              </div>
            )}

            {/* Tab 2: URL */}
            {activeTab === 'url' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Direct Image URL or Public Path:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://... or /images/albums/..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-brand-purple hover:text-white text-neutral-200 text-xs font-bold transition-all"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  Tip: Supports full web URLs (`https://`) or local paths like `/images/albums/thriller.jpg`.
                </p>
              </div>
            )}

            {/* Tab 3: Presets */}
            {activeTab === 'presets' && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-300 font-semibold">Verified Catalog Presets:</p>
                <div className="max-h-40 overflow-y-auto no-scrollbar grid grid-cols-4 gap-2 p-1">
                  {[...artistPresets, ...otherPresets].map((preset, idx) => (
                    <button
                      key={`${preset.cover}-${idx}`}
                      type="button"
                      onClick={() => handleSelectPreset(preset.cover)}
                      className={`relative aspect-square rounded-xl overflow-hidden border transition-all group ${
                        previewUrl === preset.cover
                          ? 'border-brand-gold ring-2 ring-brand-gold/50 scale-95'
                          : 'border-white/10 hover:border-brand-gold/40'
                      }`}
                      title={`${preset.artist} - ${preset.album}`}
                    >
                      <Image
                        src={preset.cover}
                        alt={preset.album}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform"
                      />
                      {previewUrl === preset.cover && (
                        <div className="absolute inset-0 bg-brand-gold/30 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scope Toggle: Entire Album vs Single Track */}
            {!isAlbumMode && effectiveAlbumTitle && !isGenericOrVirtualAlbum(effectiveAlbumTitle) && !isGenericOrVirtualAlbum(track.albumId) && (
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input
                  type="checkbox"
                  checked={applyToEntireAlbum}
                  onChange={(e) => setApplyToEntireAlbum(e.target.checked)}
                  className="rounded border-white/20 text-brand-gold focus:ring-brand-gold bg-black/40 w-4 h-4"
                />
                <div className="text-xs">
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-gold" />
                    Also apply to other songs in &ldquo;{effectiveAlbumTitle}&rdquo;
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Default is off (updates only this song). Check to update the entire album.
                  </span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevertToOriginal}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Revert back to authentic original studio cover art"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Revert to Original Art</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !previewUrl}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold via-amber-500 to-brand-gold text-black text-xs font-bold hover:brightness-110 shadow-lg shadow-brand-gold/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving Cover Art...' : 'Save & Update in Real Time'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

