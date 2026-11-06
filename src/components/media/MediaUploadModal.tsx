'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileAudio,
  FileVideo,
  FileText,
  EyeOff,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
  Mic,
  Video,
} from 'lucide-react';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { Audiobook, Video as VideoItem, PodcastEpisode } from '@/types/media';
import { useAuth } from '@/lib/auth/AuthContext';

interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaType: 'audiobook' | 'podcast' | 'video';
  onSuccess?: () => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  isOpen,
  onClose,
  mediaType,
  onSuccess,
}) => {
  const { profile, user } = useAuth();
  const [title, setTitle] = useState('');
  const [creatorOrAuthor, setCreatorOrAuthor] = useState('');
  const [narratorOrHost, setNarratorOrHost] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [noCoverArt, setNoCoverArt] = useState<boolean>(true);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Supported formats: MP3, MP4, .MOV, and PDF (for books/audiobooks)
  const acceptedMediaExtensions = mediaType === 'audiobook' ? '.mp3, .mp4, .mov, .pdf' : '.mp3, .mp4, .mov';
  const acceptedMediaMime =
    mediaType === 'audiobook'
      ? '.mp3, .mp4, .mov, .MOV, .pdf, .PDF, audio/mpeg, audio/mp3, audio/mp4, video/mp4, video/quicktime, application/pdf'
      : '.mp3, .mp4, .mov, .MOV, audio/mpeg, audio/mp3, audio/mp4, video/mp4, video/quicktime';

  const modalTitle =
    mediaType === 'audiobook'
      ? 'Upload Audiobook & Book (.mp3, .mp4, .mov, .pdf)'
      : mediaType === 'podcast'
      ? 'Upload Podcast (.mp3, .mp4, .mov)'
      : 'Upload Video (.mp3, .mp4, .mov)';

  const Icon =
    mediaType === 'audiobook' ? BookOpen : mediaType === 'podcast' ? Mic : Video;

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = mediaType === 'audiobook' ? ['mp3', 'mp4', 'mov', 'pdf'] : ['mp3', 'mp4', 'mov'];

    if (!ext || !validExts.includes(ext)) {
      setErrorMessage(
        `Invalid file format. ${
          mediaType === 'audiobook' ? 'Audiobooks and Books' : mediaType === 'video' ? 'Videos' : 'Podcasts'
        } must be in ${validExts.map((x) => '.' + x).join(', ')} format.`
      );
      setMediaFile(null);
      return;
    }

    setErrorMessage(null);
    setMediaFile(file);
    if (ext === 'pdf' && !category) {
      setCategory('Book | PDF Document');
    }
    if (!title) {
      // Auto-populate title from clean filename
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ');
      setTitle(cleanName);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Cover art must be a valid image file (JPG, PNG, WebP).');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) {
      setErrorMessage(`Please select a ${acceptedMediaExtensions} file to upload.`);
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please provide a title.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', mediaFile);
      formData.append('mediaType', mediaType);
      if (!noCoverArt && coverFile) {
        formData.append('cover', coverFile);
      }

      let mediaUrl = '';
      let coverUrl = !noCoverArt && coverFile ? coverPreview || '' : '';

      const adminEmail = profile?.email || user?.email || 'antgreene@8ofspadesworks.com';
      const headers: Record<string, string> = {
        'x-admin-role': 'admin',
        'x-admin-email': adminEmail,
      };
      try {
        if (user) {
          const token = await user.getIdToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        /* fallback to header auth */
      }

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          mediaUrl = data.mediaUrl || data.videoUrl || data.audioUrl || data.pdfUrl;
          if (data.coverUrl && !noCoverArt) {
            coverUrl = data.coverUrl;
          }
        }
      }

      if (!mediaUrl) {
        let errDetail = 'Failed to store file in cloud storage. Please check server status and size limits (max 30MB).';
        try {
          const data = await res.json();
          if (data?.error) errDetail = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(errDetail);
      }

      const generatedId = `${mediaType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const isPdfBook = mediaFile.name.toLowerCase().endsWith('.pdf') || mediaFile.type === 'application/pdf';
      const isVideoAudiobook =
        mediaFile.name.toLowerCase().endsWith('.mp4') || mediaFile.name.toLowerCase().endsWith('.mov');

      // Strict user directive: Add no cover art option. Do NOT add use default cover. Remove it.
      const finalCover = !noCoverArt && coverFile && coverUrl ? coverUrl : '';

      if (mediaType === 'audiobook') {
        const newAudiobook: Audiobook = {
          id: generatedId,
          title: title.trim(),
          author: creatorOrAuthor.trim() || 'Chancellor @ ChanceTEK LLC',
          narrator: narratorOrHost.trim() || 'Chancellor @ ChanceTEK LLC',
          coverUrl: finalCover,
          duration: isPdfBook ? 0 : 360, // Default estimated seconds
          genre:
            category.trim() ||
            (isPdfBook
              ? 'Book | PDF Document'
              : isVideoAudiobook
              ? 'Book | AudioBook'
              : 'Audiobook & Narrative'),
          description:
            description.trim() ||
            (isPdfBook
              ? 'Digital literature and PDF book publication.'
              : 'Spoken masterwork by independent creator.'),
          pdfUrl: isPdfBook ? mediaUrl : undefined,
          mediaFormat: isPdfBook ? 'pdf' : isVideoAudiobook ? 'video' : 'audio',
          chapters: [
            {
              id: `ch-${generatedId}-1`,
              chapterIndex: 1,
              title: isPdfBook ? `Full Document: ${title.trim()}` : `Chapter 1: ${title.trim()}`,
              duration: isPdfBook ? 0 : 360,
              audioUrl: mediaUrl,
              pdfUrl: isPdfBook ? mediaUrl : undefined,
            },
          ],
          likeCount: 0,
          rating: 5.0,
          releaseYear: new Date().getFullYear(),
        };
        MediaCatalogService.addAudiobook(newAudiobook);
      } else if (mediaType === 'podcast') {
        const isVideoPodcast =
          mediaFile.name.toLowerCase().endsWith('.mp4') || mediaFile.name.toLowerCase().endsWith('.mov');

        const newPodcast: PodcastEpisode = {
          id: generatedId,
          title: title.trim(),
          showTitle: creatorOrAuthor.trim() || '8 Of Spades Podcasts',
          host: narratorOrHost.trim() || 'Chancellor @ ChanceTEK LLC',
          description: description.trim() || 'Exclusive podcast episode release.',
          mediaUrl: mediaUrl,
          mediaType: isVideoPodcast ? 'video' : 'audio',
          coverUrl: finalCover,
          duration: 1800,
          releaseDate: new Date().toISOString().split('T')[0],
          category: category.trim() || (isVideoPodcast ? 'Video Podcast & Visual Talk' : 'Spoken Word & Culture'),
          playCount: 0,
          likeCount: 0,
        };
        MediaCatalogService.addPodcast(newPodcast);
      } else if (mediaType === 'video') {
        const isAudioTrack = mediaFile.name.toLowerCase().endsWith('.mp3');

        const newVideo: VideoItem = {
          id: generatedId,
          title: title.trim(),
          artistId: 'producer-chancellor',
          artistName: creatorOrAuthor.trim() || 'Chancellor @ ChanceTEK LLC',
          label: 'ChanceTEK LLC & 8 OF SPADES WORKS',
          videoUrl: mediaUrl,
          thumbnailUrl: finalCover,
          duration: 120,
          views: 1,
          likeCount: 0,
          dislikeCount: 0,
          commentCount: 0,
          description:
            description.trim() ||
            (isAudioTrack ? 'High-fidelity audio soundtrack cinema visual.' : 'Cinema visual release.'),
          category: category.trim() || (isAudioTrack ? 'Audio Cinema' : 'Visual Cinema'),
          releaseDate: new Date().toISOString().split('T')[0],
        };
        MediaCatalogService.addVideo(newVideo);
      }

      setSuccessMessage(`${title} uploaded successfully and published to live library!`);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setIsUploading(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Media upload error:', err);
      setErrorMessage(err.message || 'Failed to upload media file.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-gold/40 bg-[#120a1c] shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">{modalTitle}</h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                Accepted: <span className="text-brand-gold font-bold">{acceptedMediaExtensions}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Media File Dropzone */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">
              Select Media File ({acceptedMediaExtensions}) *
            </label>
            <input
              type="file"
              ref={mediaInputRef}
              accept={acceptedMediaMime}
              onChange={handleMediaFileChange}
              className="hidden"
            />
            <div
              onClick={() => mediaInputRef.current?.click()}
              className={`p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-2 ${
                mediaFile
                  ? 'border-brand-gold/60 bg-brand-gold/10 text-white'
                  : 'border-white/20 hover:border-brand-gold/40 bg-white/5 text-neutral-400'
              }`}
            >
              {(() => {
                const ext = mediaFile?.name.split('.').pop()?.toLowerCase();
                const isPdf = ext === 'pdf';
                const isVideoFile = ext === 'mp4' || ext === 'mov' || (!mediaFile && mediaType === 'video');
                if (isPdf) {
                  return <FileText className={`w-8 h-8 ${mediaFile ? 'text-rose-400' : 'text-neutral-400'}`} />;
                }
                return isVideoFile ? (
                  <FileVideo className={`w-8 h-8 ${mediaFile ? 'text-brand-gold' : 'text-neutral-400'}`} />
                ) : (
                  <FileAudio className={`w-8 h-8 ${mediaFile ? 'text-brand-gold' : 'text-neutral-400'}`} />
                );
              })()}
              {mediaFile ? (
                <div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {mediaFile.name.toLowerCase().endsWith('.pdf') && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                        PDF Book Document
                      </span>
                    )}
                    {(mediaFile.name.toLowerCase().endsWith('.mp4') || mediaFile.name.toLowerCase().endsWith('.mov')) && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-[10px] font-bold">
                        Video Cinema
                      </span>
                    )}
                    {mediaFile.name.toLowerCase().endsWith('.mp3') && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-neon/20 border border-brand-neon/40 text-brand-neon text-[10px] font-bold">
                        Audio Master
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-white text-xs">{mediaFile.name}</p>
                  <p className="text-[10px] text-brand-gold font-mono">
                    {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB • Ready
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-neutral-200">
                    Click to browse {acceptedMediaExtensions} file
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {mediaType === 'audiobook'
                      ? 'Upload spoken literature or PDF books in MP3, MP4, .MOV, or PDF format'
                      : mediaType === 'video'
                      ? 'Upload visual cinema in MP3, MP4, or .MOV format'
                      : 'Upload podcast episode in MP3, MP4, or .MOV format'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder={
                mediaType === 'audiobook'
                  ? 'e.g. Saturday Night, Sunday Morning'
                  : mediaType === 'podcast'
                  ? 'e.g. Episode 4: The 12-Bit Renaissance'
                  : 'e.g. ChanceTEK HQ Visual Master'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-brand-gold focus:outline-none"
            />
          </div>

          {/* Author / Show / Creator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                {mediaType === 'audiobook'
                  ? 'Author'
                  : mediaType === 'podcast'
                  ? 'Podcast Show Title'
                  : 'Director / Creator'}
              </label>
              <input
                type="text"
                placeholder={
                  mediaType === 'audiobook'
                    ? 'e.g. Kwame Thompson'
                    : mediaType === 'podcast'
                    ? 'e.g. ChanceTEK Masterminds'
                    : 'e.g. Chancellor @ ChanceTEK LLC'
                }
                value={creatorOrAuthor}
                onChange={(e) => setCreatorOrAuthor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                {mediaType === 'audiobook'
                  ? 'Narrator'
                  : mediaType === 'podcast'
                  ? 'Host Name'
                  : 'Category / Tag'}
              </label>
              <input
                type="text"
                placeholder={
                  mediaType === 'audiobook'
                    ? 'e.g. Chancellor'
                    : mediaType === 'podcast'
                    ? 'e.g. Chancellor & Guests'
                    : 'e.g. 4K Cinema / Motion'
                }
                value={narratorOrHost}
                onChange={(e) => setNarratorOrHost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Category & Description */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                Category / Genre
              </label>
              <input
                type="text"
                placeholder="e.g. Agentic AI, Hip Hop Heritage, Visual Cinema, Health"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                Synopsis / Description
              </label>
              <textarea
                rows={2}
                placeholder="Brief summary or chapter notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:border-brand-gold focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Optional Companion Cover Art with Explicit No Cover Art Option */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-neutral-300">
                Artwork / Poster Option
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {noCoverArt ? 'Native Video / Slate' : 'Custom Cover'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setNoCoverArt(true);
                  setCoverFile(null);
                  setCoverPreview(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  noCoverArt
                    ? 'bg-brand-gold/20 border border-brand-gold/60 text-brand-gold shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>No Cover Art (Native Video / Slate)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNoCoverArt(false);
                  coverInputRef.current?.click();
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  !noCoverArt
                    ? 'bg-brand-gold text-black shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Custom Cover Image</span>
              </button>
            </div>

            <input
              type="file"
              ref={coverInputRef}
              accept="image/jpeg, image/png, image/webp"
              onChange={(e) => {
                setNoCoverArt(false);
                handleCoverFileChange(e);
              }}
              className="hidden"
            />

            {!noCoverArt && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-brand-gold" />
                  <span>{coverFile ? 'Change Cover Image' : 'Choose Cover Image'}</span>
                </button>
                {coverPreview ? (
                  <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-brand-gold/50">
                      <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">Image Attached</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview(null);
                        setNoCoverArt(true);
                      }}
                      className="text-[10px] text-rose-400 hover:underline ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-amber-300">Select JPG, PNG, or WebP</span>
                )}
              </div>
            )}
            {noCoverArt && (
              <p className="text-[10px] text-neutral-400 italic">
                Clean visual: No default cover is applied. Video media will display native video frames directly without any poster image.
              </p>
            )}
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold via-brand-amber to-brand-neon hover:scale-105 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading & Publishing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish to Platform</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
