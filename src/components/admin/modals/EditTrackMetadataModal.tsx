'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Track } from '@/types/media';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { OFFICIAL_CRATES, DIRECT_MUSIC_CRATE } from '@/types/catalog';
import { PLATFORM_STANDARD_GENRES } from '@/lib/music/genreClassifier';
import {
  FileEdit,
  Check,
  X,
  Disc3,
  Music,
  User,
  Calendar,
  Layers,
  Activity,
  FileText,
  AlertCircle,
  Clock,
  Archive,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface EditTrackMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  onSuccess?: (message: string) => void;
  adminActor?: { id?: string; name?: string };
}

export const EditTrackMetadataModal: React.FC<EditTrackMetadataModalProps> = ({
  isOpen,
  onClose,
  track,
  onSuccess,
  adminActor,
}) => {
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [crateId, setCrateId] = useState<string>('direct-music-library');
  const [crateName, setCrateName] = useState<string>('Direct Music Library');
  const [bpm, setBpm] = useState<number | ''>('');
  const [releaseYear, setReleaseYear] = useState<number | ''>('');
  const [uploadedAt, setUploadedAt] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Collect all available official and custom crates
  const officialCrates = MusicCatalogService.getOfficialCrates();
  const allCrates = [
    DIRECT_MUSIC_CRATE,
    ...officialCrates.filter((c) => c.id !== 'direct-music-library'),
  ];

  const selectedCrateObj =
    crateId === 'direct-music-library'
      ? DIRECT_MUSIC_CRATE
      : allCrates.find((c) => c.id === crateId || c.slug === crateId) ||
        MusicCatalogService.getCrateById(crateId) ||
        DIRECT_MUSIC_CRATE;

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtistName(track.artistName || '');
      setAlbumTitle(track.albumTitle || '');
      setGenre(track.genre || 'R&B / Soul');
      
      const initialCrateId = track.crateId || 'direct-music-library';
      setCrateId(initialCrateId);
      const matchedCrate =
        initialCrateId === 'direct-music-library'
          ? DIRECT_MUSIC_CRATE
          : MusicCatalogService.getCrateById(initialCrateId) ||
            MusicCatalogService.getCrateBySlug(initialCrateId);
      setCrateName(
        track.crateName ||
        matchedCrate?.name ||
        (initialCrateId === 'direct-music-library' ? 'Direct Music Library' : initialCrateId)
      );

      setBpm(track.bpm || '');
      setReleaseYear(track.releaseYear || 2026);
      
      // Format added date for date input (YYYY-MM-DD)
      let initialDate = '';
      if (track.uploadedAt) {
        try {
          initialDate = new Date(track.uploadedAt).toISOString().split('T')[0];
        } catch {
          initialDate = new Date().toISOString().split('T')[0];
        }
      } else {
        const match = track.id.match(/(\d{10,13})/);
        if (match) {
          const ts = parseInt(match[1], 10);
          const ms = ts < 10000000000 ? ts * 1000 : ts;
          try {
            initialDate = new Date(ms).toISOString().split('T')[0];
          } catch {
            initialDate = '2026-10-24';
          }
        } else {
          initialDate = '2026-10-24';
        }
      }
      setUploadedAt(initialDate);

      setDescription(track.description || '');
      setLyrics(track.lyrics || '');
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [track, isOpen]);

  const handleCrateChange = (newCrateId: string) => {
    setCrateId(newCrateId);
    if (newCrateId === 'direct-music-library') {
      setCrateName('Direct Music Library');
    } else {
      const matched =
        allCrates.find((c) => c.id === newCrateId) ||
        MusicCatalogService.getCrateById(newCrateId);
      setCrateName(matched?.name || newCrateId);
    }
  };

  if (!isOpen || !track) return null;

  const handleSave = () => {
    if (!title.trim()) {
      setErrorMessage('Song title is required.');
      return;
    }
    if (!artistName.trim()) {
      setErrorMessage('Artist name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updates: Partial<Track> & { customCrate?: boolean } = {
        title: title.trim(),
        artistName: artistName.trim(),
        albumTitle: albumTitle.trim() || 'Single',
        genre: genre.trim() || 'R&B / Soul',
        crateId: crateId || 'direct-music-library',
        crateName: crateName || 'Direct Music Library',
        customCrate: true,
        bpm: typeof bpm === 'number' && !isNaN(bpm) ? bpm : undefined,
        releaseYear: typeof releaseYear === 'number' && !isNaN(releaseYear) ? releaseYear : undefined,
        uploadedAt: uploadedAt ? new Date(uploadedAt).toISOString() : new Date().toISOString(),
        description: description.trim(),
        lyrics: lyrics.trim(),
      };

      const success = MusicCatalogService.updateTrack(track.id, updates, adminActor);
      if (success) {
        if (onSuccess) {
          onSuccess(`Crate changed to "${crateName}" & metadata updated in real time for "${title.trim()}".`);
        }
        onClose();
      } else {
        setErrorMessage('Could not find or update the requested song.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save metadata.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#181126] via-[#100a1c] to-[#0a0712] border border-brand-purple/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-purple">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Edit Metadata & Descriptions
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                  Live Platform Sync
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Song ID: <span className="font-mono text-neutral-300">{track.id}</span>
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
          <div className="mt-3 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body (Scrollable) */}
        <div className="mt-4 space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1 relative z-10">
          {/* Row 1: Title & Artist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-brand-gold" />
                Song Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Rock with You"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-purple" />
                Artist Name *
              </label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="e.g. Michael Jackson"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Album & Genre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Disc3 className="w-3.5 h-3.5 text-brand-gold" />
                Album Title
              </label>
              <input
                type="text"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="e.g. Off The Wall"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-purple" />
                Music Genre
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. R&B / Soul, Funk, Disco"
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
                />
                <select
                  onChange={(e) => {
                    if (e.target.value) setGenre(e.target.value);
                  }}
                  className="px-2 py-2 rounded-xl bg-[#241a38] border border-white/10 text-neutral-300 text-xs focus:border-brand-gold focus:outline-none cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Standard Genres...
                  </option>
                  <optgroup label="Official Genres">
                    {PLATFORM_STANDARD_GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Row 3: Assigned Platform Crate (Real-Time Crate Switcher) */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-brand-gold/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-brand-gold flex items-center gap-2">
                <Archive className="w-4 h-4 text-brand-gold" />
                <span>Assigned Platform Crate *</span>
                <span className="px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[9px] font-mono border border-brand-gold/30">
                  Real-Time Sync
                </span>
              </label>
              {selectedCrateObj && (
                <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
                  Crate ID: <span className="text-brand-neon">{selectedCrateObj.id}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <select
                value={crateId}
                onChange={(e) => handleCrateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1b122c] border border-brand-gold/40 text-white text-xs font-semibold focus:border-brand-gold focus:outline-none cursor-pointer shadow-inner appearance-none pr-9 transition-colors hover:border-brand-gold"
              >
                <option value="direct-music-library">
                  Direct Music Library (General Catalog — All Genres)
                </option>
                <optgroup label="Official Platform Crates">
                  {officialCrates
                    .filter((c) => c.id !== 'direct-music-library')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.subtitle || c.badge}
                      </option>
                    ))}
                </optgroup>
              </select>
              <ChevronDown className="w-4 h-4 text-brand-gold absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Live Selected Crate Identity Card */}
            {selectedCrateObj && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/50 border border-white/5 text-[11px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: selectedCrateObj.accentColor || '#f5c344' }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate flex items-center gap-1.5">
                      <span>{selectedCrateObj.name}</span>
                      <span className="text-[9px] text-brand-gold font-normal px-1.5 py-0.2 rounded-full bg-brand-gold/15 border border-brand-gold/30">
                        {selectedCrateObj.badge || 'Crate'}
                      </span>
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">{selectedCrateObj.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedCrateObj.bpmRange && (
                    <span className="text-[10px] text-brand-neon font-mono hidden sm:inline">
                      {selectedCrateObj.bpmRange}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-400 font-mono hidden md:inline">
                    {selectedCrateObj.totalTracks || 0} tracks
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Add Date, Release Year, BPM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-gold" />
                Added Date (Platform)
              </label>
              <input
                type="date"
                value={uploadedAt}
                onChange={(e) => setUploadedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                Release Year
              </label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) =>
                  setReleaseYear(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                placeholder="1979"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-gold" />
                Tempo (BPM)
              </label>
              <input
                type="number"
                value={bpm}
                onChange={(e) =>
                  setBpm(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                placeholder="116"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Description / Notes */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-purple" />
              Track Description / Editorial Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter background, mastering details, instrument credits or historical notes..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Row 5: Lyrics */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              Lyrics (Optional)
            </label>
            <textarea
              rows={3}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste synchronized or plain text lyrics..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:border-brand-gold focus:outline-none resize-none font-mono text-[11px] leading-relaxed"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between relative z-10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple via-fuchsia-600 to-brand-purple text-white text-xs font-bold hover:brightness-110 shadow-lg shadow-brand-purple/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Changes in Real Time'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

