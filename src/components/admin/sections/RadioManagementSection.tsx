'use client';

// ============================================================
// Radio Management Section — Admin Panel
// Super-user only: upload MP3s, manage rotation, view catalog
// Uses existing admin design system: glass-panel, brand colors
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Radio,
  Upload,
  Music,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Mic2,
  AlertTriangle,
  Plus,
  Volume2,
} from 'lucide-react';
import { RadioSong, RadioStationId } from '@/types/radio';
import { RADIO_INITIAL_CATALOG } from '@/lib/radio/initialCatalog';
import { MusicIngestionAgent } from '@/lib/radio/agents/MusicIngestionAgent';
import { radioOrchestrator } from '@/lib/radio/RadioOrchestrator';

const STATION_LABELS: Record<RadioStationId, { label: string; color: string }> = {
  'hip-hop': { label: 'Hip Hop Radio', color: 'text-brand-gold border-brand-gold/40 bg-brand-gold/10' },
  'neo-soul': { label: 'Neo Soul Radio', color: 'text-brand-purple border-brand-purple/40 bg-brand-purple/10' },
};

interface UploadForm {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  isExplicit: boolean;
  stations: RadioStationId[];
  coverUrl: string;
}

const EMPTY_FORM: UploadForm = {
  title: '',
  artist: 'ChanceTEK One',
  album: '',
  genre: '',
  year: new Date().getFullYear().toString(),
  isExplicit: false,
  stations: ['hip-hop'],
  coverUrl: '',
};

export function RadioManagementSection() {
  const [catalog, setCatalog] = useState<RadioSong[]>([
    ...RADIO_INITIAL_CATALOG,
    ...radioOrchestrator.getCatalog().filter(
      (s) => !RADIO_INITIAL_CATALOG.find((ic) => ic.id === s.id)
    ),
  ]);
  const [form, setForm] = useState<UploadForm>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<
    'idle' | 'validating' | 'uploading' | 'success' | 'error'
  >('idle');
  const [uploadError, setUploadError] = useState('');
  const [filterStation, setFilterStation] = useState<RadioStationId | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    const validation = MusicIngestionAgent.validate(file);
    if (!validation.valid) {
      setUploadError(validation.error ?? 'Invalid file');
      return;
    }
    setUploadError('');
    setSelectedFile(file);

    // Auto-populate title from filename
    const meta = await MusicIngestionAgent.extractMetadata(file);
    if (meta.title && !form.title) {
      setForm((f) => ({ ...f, title: meta.title ?? f.title }));
    }
  }, [form.title]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // ── Station toggle ────────────────────────────────────────
  const toggleStation = (id: RadioStationId) => {
    setForm((f) => ({
      ...f,
      stations: f.stations.includes(id)
        ? f.stations.filter((s) => s !== id)
        : [...f.stations, id],
    }));
  };

  // ── Upload ────────────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setUploadError('Please select an MP3 file.'); return; }
    if (!form.title || !form.artist || !form.genre) {
      setUploadError('Title, artist, and genre are required.');
      return;
    }
    if (form.stations.length === 0) {
      setUploadError('Select at least one station.');
      return;
    }

    setUploadState('validating');
    setUploadError('');

    const validation = MusicIngestionAgent.validate(selectedFile);
    if (!validation.valid) {
      setUploadError(validation.error ?? 'Invalid file');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');

    try {
      const fd = new FormData();
      fd.append('audio', selectedFile);
      fd.append('title', form.title);
      fd.append('artist', form.artist);
      fd.append('album', form.album);
      fd.append('genre', form.genre);
      if (form.year) fd.append('year', form.year);
      fd.append('isExplicit', String(form.isExplicit));
      fd.append('stations', form.stations.join(','));
      if (form.coverUrl) fd.append('coverUrl', form.coverUrl);
      fd.append('uploadedBy', 'admin@chancetekone.com');

      const resp = await fetch('/api/radio/upload', { method: 'POST', body: fd });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error ?? 'Upload failed');

      // Add to in-memory orchestrator and local catalog state
      radioOrchestrator.addSong(data.song);
      setCatalog((c) => [data.song, ...c]);
      setUploadState('success');
      setForm(EMPTY_FORM);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadState('idle'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      setUploadState('error');
    }
  };

  // ── Rotation toggle ───────────────────────────────────────
  const toggleRotation = async (song: RadioSong) => {
    const updated = { ...song, inRotation: !song.inRotation };
    radioOrchestrator.updateSong(song.id, { inRotation: !song.inRotation });
    setCatalog((c) => c.map((s) => (s.id === song.id ? updated : s)));

    await fetch('/api/radio/songs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id, updates: { inRotation: !song.inRotation } }),
    }).catch(() => {});
  };

  // ── Remove song ───────────────────────────────────────────
  const handleRemove = async (song: RadioSong) => {
    if (!confirm(`Remove "${song.title}" from the radio catalog?`)) return;
    radioOrchestrator.removeSong(song.id);
    setCatalog((c) => c.filter((s) => s.id !== song.id));
    await fetch(`/api/radio/songs?id=${song.id}`, { method: 'DELETE' }).catch(() => {});
  };

  const filteredCatalog = filterStation === 'all'
    ? catalog
    : catalog.filter((s) => s.stations.includes(filterStation));

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider mb-2">
            <Radio className="w-3.5 h-3.5" /> Agentic Radio Management
          </div>
          <h2 className="text-2xl font-extrabold text-white">Radio Station Control</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Upload platform-owned MP3 files, assign to stations, and control rotation.
            All songs are immediately processed by the AI Intelligence and Programming agents.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="text-center p-3 rounded-2xl glass-panel border border-white/5 min-w-[60px]">
            <p className="text-2xl font-black text-brand-gold">{catalog.filter((s) => s.stations.includes('hip-hop')).length}</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Hip Hop</p>
          </div>
          <div className="text-center p-3 rounded-2xl glass-panel border border-white/5 min-w-[60px]">
            <p className="text-2xl font-black text-brand-purple">{catalog.filter((s) => s.stations.includes('neo-soul')).length}</p>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Neo Soul</p>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <div className="glass-panel border border-white/5 rounded-3xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-gold" /> Upload New Track
        </h3>

        <form onSubmit={handleUpload} className="space-y-5">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              selectedFile
                ? 'border-brand-gold/60 bg-brand-gold/5'
                : 'border-white/10 hover:border-brand-gold/30 hover:bg-white/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,audio/mpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {selectedFile ? (
              <div className="space-y-1">
                <Music className="w-8 h-8 text-brand-gold mx-auto" />
                <p className="text-white font-semibold text-sm">{selectedFile.name}</p>
                <p className="text-neutral-400 text-xs">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB — Click to change
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-neutral-500 mx-auto" />
                <p className="text-neutral-400 text-sm">
                  Drag & drop an MP3 file here, or <span className="text-brand-gold font-semibold">click to browse</span>
                </p>
                <p className="text-neutral-600 text-xs">MP3 only — max 100MB</p>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'title', label: 'Track Title *', key: 'title' as const },
              { id: 'artist', label: 'Artist *', key: 'artist' as const },
              { id: 'album', label: 'Album', key: 'album' as const },
              { id: 'genre', label: 'Genre *', key: 'genre' as const },
              { id: 'year', label: 'Year', key: 'year' as const },
              { id: 'coverUrl', label: 'Cover Art URL (optional)', key: 'coverUrl' as const },
            ].map(({ id, label, key }) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`radio-upload-${id}`} className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                  {label}
                </label>
                <input
                  id={`radio-upload-${id}`}
                  type="text"
                  value={form[key] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={label}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-gold/50 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Station Assignment */}
          <div className="space-y-2">
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Assign to Station *</p>
            <div className="flex gap-3">
              {(['hip-hop', 'neo-soul'] as RadioStationId[]).map((sid) => {
                const { label, color } = STATION_LABELS[sid];
                const isChecked = form.stations.includes(sid);
                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => toggleStation(sid)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      isChecked ? color : 'border-white/10 text-neutral-500 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explicit toggle */}
          <label htmlFor="radio-explicit" className="flex items-center gap-3 cursor-pointer">
            <div
              id="radio-explicit"
              onClick={() => setForm((f) => ({ ...f, isExplicit: !f.isExplicit }))}
              className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${
                form.isExplicit ? 'bg-red-500' : 'bg-white/10'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isExplicit ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-xs text-neutral-400">Explicit Content</span>
          </label>

          {/* Error message */}
          {uploadError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
            </div>
          )}

          {/* Submit */}
          <button
            id="radio-upload-submit"
            type="submit"
            disabled={uploadState === 'uploading' || uploadState === 'validating'}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadState === 'validating' && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadState === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadState === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {uploadState === 'error' && <XCircle className="w-4 h-4" />}
            {uploadState === 'idle' && <Plus className="w-4 h-4" />}
            {uploadState === 'validating' ? 'Validating…' :
             uploadState === 'uploading' ? 'Processing…' :
             uploadState === 'success'   ? 'Track Added!' :
             uploadState === 'error'     ? 'Retry Upload' :
             'Upload to Radio Catalog'}
          </button>
        </form>
      </div>

      {/* Catalog Table */}
      <div className="glass-panel border border-white/5 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-brand-gold" /> Radio Catalog ({filteredCatalog.length})
          </h3>
          {/* Station filter */}
          <div className="flex gap-1.5">
            {(['all', 'hip-hop', 'neo-soul'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStation(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterStation === f
                    ? 'bg-brand-gold text-black'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
              >
                {f === 'all' ? 'All' : STATION_LABELS[f].label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {filteredCatalog.length === 0 && (
            <p className="text-neutral-500 text-sm py-6 text-center">No tracks found.</p>
          )}
          {filteredCatalog.map((song) => (
            <div key={song.id} className="flex items-center gap-3 py-3 group">
              {/* Cover */}
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Music className="w-4 h-4 text-neutral-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{song.title}</p>
                <div className="flex items-center gap-2 text-xs text-neutral-500 truncate">
                  <span>{song.artist}</span>
                  {song.album && <><span>·</span><span>{song.album}</span></>}
                  {song.duration > 0 && <><span>·</span><span>{formatDuration(song.duration)}</span></>}
                </div>
                {/* Station badges */}
                <div className="flex gap-1 mt-1">
                  {song.stations.map((sid) => (
                    <span
                      key={sid}
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATION_LABELS[sid].color}`}
                    >
                      {sid === 'hip-hop' ? 'HH' : 'NS'}
                    </span>
                  ))}
                  {song.bpm && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-neutral-500">
                      {song.bpm} BPM
                    </span>
                  )}
                  {song.energy && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] text-neutral-500 capitalize">
                      {song.energy}
                    </span>
                  )}
                </div>
              </div>

              {/* Play count */}
              <div className="text-center hidden sm:block shrink-0">
                <p className="text-white text-sm font-bold">{song.totalPlays}</p>
                <p className="text-neutral-600 text-[10px]">plays</p>
              </div>

              {/* In Rotation toggle */}
              <button
                onClick={() => toggleRotation(song)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold"
                style={{
                  borderColor: song.inRotation ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)',
                  background: song.inRotation ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  color: song.inRotation ? 'rgb(74,222,128)' : 'rgb(115,115,115)',
                }}
                title={song.inRotation ? 'Remove from rotation' : 'Add to rotation'}
              >
                {song.inRotation ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{song.inRotation ? 'In Rotation' : 'Off Rotation'}</span>
              </button>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(song)}
                className="shrink-0 p-2 rounded-xl text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                title="Remove from catalog"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Info footer */}
      <div className="glass-panel border border-white/5 rounded-2xl p-4 flex items-start gap-3">
        <Mic2 className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-500 leading-relaxed">
          All uploaded tracks are automatically processed by the Music Intelligence Agent (BPM, energy, mood analysis)
          and inserted into station queues by the Programming Agent. The AI DJ Agent will begin generating
          spoken intros for approved tracks within the next broadcast cycle.
        </p>
      </div>
    </div>
  );
}
