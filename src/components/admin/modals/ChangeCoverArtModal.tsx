'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  Upload,
  Link as LinkIcon,
  Disc3,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Search,
  Globe,
  Loader2,
} from 'lucide-react';
import { extractCoverArtFromImageFile } from '@/lib/audio/id3Parser';

interface ChangeCoverArtModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currentCoverUrl?: string;
  crateDefaultUrl?: string;
  onSave: (newCoverUrl: string) => void | Promise<void>;
}

export const ChangeCoverArtModal: React.FC<ChangeCoverArtModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  currentCoverUrl,
  crateDefaultUrl,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'ai_search' | 'url'>('ai_search');
  const [previewUrl, setPreviewUrl] = useState<string>(currentCoverUrl || '');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Tavily search state
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiCandidates, setAiCandidates] = useState<Array<{ url: string; domain: string; title: string; confidenceScore: number }>>([]);
  const [isSearchingAi, setIsSearchingAi] = useState<boolean>(false);
  const [selectedCandidateUrl, setSelectedCandidateUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentCoverUrl || '');
      setUrlInput(currentCoverUrl && !currentCoverUrl.startsWith('data:') ? currentCoverUrl : '');
      setErrorMsg(null);
      setSelectedCandidateUrl(null);
      const initialQ = `${subtitle || ''} ${title || ''}`.trim();
      setAiQuery(initialQ);
      // Auto-trigger AI search if current cover is missing or generic
      if (!currentCoverUrl || currentCoverUrl.includes('images.unsplash.com')) {
        setActiveTab('ai_search');
      }
    }
  }, [isOpen, currentCoverUrl, title, subtitle]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);
      const dataUrl = await extractCoverArtFromImageFile(file);
      setPreviewUrl(dataUrl);
    } catch (err: any) {
      setErrorMsg('Failed to process image file. Please try another image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an image URL.');
      return;
    }
    setErrorMsg(null);
    setPreviewUrl(trimmed);
  };

  const handleSearchTavily = async () => {
    const q = aiQuery.trim();
    if (!q) {
      setErrorMsg('Please enter an artist or track name to search.');
      return;
    }
    setIsSearchingAi(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/cover-art-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          artist: subtitle || q,
          title: title || q,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.candidates)) {
        setAiCandidates(data.candidates);
        if (data.candidates.length === 0) {
          setErrorMsg('No cover art found via Tavily search. Try refining the search query.');
        }
      } else {
        setErrorMsg(data.error || 'Failed to search cover art via Tavily.');
      }
    } catch (err: any) {
      setErrorMsg('Network error while searching Tavily: ' + (err.message || 'Error'));
    } finally {
      setIsSearchingAi(false);
    }
  };

  const handleSelectCandidate = async (candidateUrl: string) => {
    setSelectedCandidateUrl(candidateUrl);
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/cover-art-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_image',
          imageUrl: candidateUrl,
        }),
      });
      const data = await res.json();
      if (data.success && data.dataUrl) {
        setPreviewUrl(data.dataUrl);
      } else {
        setPreviewUrl(candidateUrl);
      }
    } catch (err) {
      setPreviewUrl(candidateUrl);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseCrateArt = () => {
    if (crateDefaultUrl) {
      setPreviewUrl(crateDefaultUrl);
      setUrlInput(crateDefaultUrl);
      setErrorMsg(null);
    }
  };

  const handleResetToCurrent = () => {
    setPreviewUrl(currentCoverUrl || '');
    setUrlInput(currentCoverUrl && !currentCoverUrl.startsWith('data:') ? currentCoverUrl : '');
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (!previewUrl) {
      setErrorMsg('Please select or specify a cover image.');
      return;
    }
    setIsProcessing(true);
    try {
      await onSave(previewUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg('Failed to save cover art: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl glass-panel border border-brand-gold/40 bg-[#120a22] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Agentic Cover Art Search
            </div>
            <h3 className="text-base font-extrabold text-white truncate max-w-sm sm:max-w-md">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-neutral-400 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Preview Display */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-brand-gold/60 shadow-xl bg-black/60 shrink-0 group">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Cover Preview"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                <Disc3 className="w-8 h-8 mb-1" />
                <span className="text-[10px] font-bold">No Art</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                Active Preview
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div>
              <p className="text-xs font-bold text-white">Cover Artwork Preview</p>
              <p className="text-[11px] text-neutral-400">
                Artwork is optimized for ultra high-fidelity vinyl display, music player, and catalog grids.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
              {crateDefaultUrl && (
                <button
                  type="button"
                  onClick={handleUseCrateArt}
                  className="px-2.5 py-1 rounded-lg bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold font-bold text-[10px] border border-brand-gold/40 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Use Crate Art</span>
                </button>
              )}
              {currentCoverUrl && (
                <button
                  type="button"
                  onClick={handleResetToCurrent}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ai_search');
              if (aiCandidates.length === 0 && !isSearchingAi) {
                handleSearchTavily();
              }
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'ai_search'
                ? 'bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold text-black font-black shadow-md'
                : 'text-amber-400/90 hover:text-brand-gold hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Search (Tavily)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-brand-purple text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'url'
                ? 'bg-brand-purple text-white shadow-md'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>URL</span>
          </button>
        </div>

        {/* Tab: AI Tavily Internet Search */}
        {activeTab === 'ai_search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Artist & Album/Title search query..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchTavily();
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-gold/60"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchTavily}
                disabled={isSearchingAi}
                className="px-4 py-2.5 rounded-xl bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/40 text-brand-gold font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shrink-0"
              >
                {isSearchingAi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Search Web</span>
                  </>
                )}
              </button>
            </div>

            {/* Candidates Grid */}
            {aiCandidates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-neutral-300">
                  Select Authentic Cover Art from Tavily Web Search:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {aiCandidates.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectCandidate(c.url)}
                      className={`relative group rounded-xl overflow-hidden border p-1 text-left transition-all cursor-pointer ${
                        selectedCandidateUrl === c.url
                          ? 'border-brand-gold bg-brand-gold/10 ring-2 ring-brand-gold'
                          : 'border-white/10 hover:border-brand-gold/60 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-black/60 mb-1">
                        <Image
                          src={c.url}
                          alt={c.title || 'Candidate'}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                          unoptimized
                        />
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-black text-brand-gold">
                          {c.confidenceScore}%
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-white truncate">{c.domain}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Upload Image File */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-white/20 hover:border-brand-gold/60 rounded-2xl bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white">
                Click to browse or drop cover art image
              </p>
              <p className="text-[10px] text-neutral-400">
                Supports PNG, JPEG, WebP (Square 1:1 ratio recommended)
              </p>
            </button>
          </div>
        )}

        {/* Tab 2: URL Input */}
        {activeTab === 'url' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-300">Image Web Address (URL)</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://images.unsplash.com/... or /images/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUrlApply();
                  }
                }}
                className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-gold/60"
              />
              <button
                type="button"
                onClick={handleUrlApply}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors shrink-0"
              >
                Apply
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">
              Press Apply to test the image URL in the preview before saving.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || !previewUrl}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold via-amber-400 to-brand-gold hover:opacity-95 text-black font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{isProcessing ? 'Saving...' : 'Save Cover Art'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
