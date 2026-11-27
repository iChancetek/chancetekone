'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  X,
  Search,
  Check,
  Sparkles,
  Shuffle,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';
import {
  COVER_ART_CATALOG,
  COVER_ART_CATEGORIES,
  PLAIN_COLOR_COVERS,
  createPlainColorCoverUrl,
  getPlainColorHex,
  getRandomCoverArt,
} from '@/lib/playlist/CoverArtCatalog';

interface CoverArtPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUrl: string;
  onSelect: (url: string) => void;
}

export const CoverArtPickerModal: React.FC<CoverArtPickerModalProps> = ({
  isOpen,
  onClose,
  selectedUrl,
  onSelect,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('plain_colors');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customHex, setCustomHex] = useState<string>(getPlainColorHex(selectedUrl) || '#6d28d9');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredCovers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (activeCategory === 'plain_colors') return [];
    return COVER_ART_CATALOG.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchQuery]);

  const filteredPlainColors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return PLAIN_COLOR_COVERS;
    return PLAIN_COLOR_COVERS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.hex.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen || !mounted) return null;

  const handleSelectCover = (url: string) => {
    onSelect(url);
    onClose();
  };

  const handleRandomSelect = () => {
    const randomUrl = getRandomCoverArt();
    onSelect(randomUrl);
    onClose();
  };

  const handleApplyCustomUrl = () => {
    if (customUrlInput.trim()) {
      onSelect(customUrlInput.trim());
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl glass-panel rounded-3xl border border-brand-purple/40 bg-gradient-to-b from-[#141024]/98 via-[#0c0916]/98 to-[#08080c]/98 shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Select Playlist Artwork</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold font-mono">
                  100 Available
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Choose from authentic studio hardware, turntablism, and vinyl visuals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRandomSelect}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-purple/30 hover:bg-brand-purple/50 border border-brand-neon/40 text-brand-neon hover:text-white text-xs font-bold transition-all"
              title="Select random artwork"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Surprise Me</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 sm:px-6 space-y-3 border-b border-white/5 bg-black/30 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cover styles (e.g. drums, sp1200, turntable, cassette, vinyl, neon)..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {COVER_ART_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-brand-gold to-brand-amber text-black shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid of Covers / Plain Colors */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeCategory === 'plain_colors' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">Custom Plain Color</p>
                  <p className="text-[11px] text-neutral-400">
                    Choose any custom solid color for your playlist cover.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-white/20 bg-transparent cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectCover(createPlainColorCoverUrl(customHex))}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black text-xs font-black uppercase tracking-wider cursor-pointer hover:scale-105 transition-transform"
                  >
                    Use {customHex.toUpperCase()}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {filteredPlainColors.map((swatch) => {
                  const isSelected = selectedUrl === swatch.url;
                  const isLightSwatch = swatch.hex === '#e5e5e0';
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => handleSelectCover(swatch.url)}
                      style={{ backgroundColor: swatch.hex }}
                      className={`group relative rounded-2xl aspect-square border-2 p-3 flex flex-col justify-between text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-brand-gold ring-2 ring-brand-gold shadow-[0_0_20px_rgba(255,215,0,0.4)] scale-[0.98]'
                          : 'border-white/15 hover:border-white/70 hover:scale-[1.02]'
                      }`}
                    >
                      <div className="flex justify-end">
                        {isSelected && (
                          <div className="w-7 h-7 rounded-full bg-brand-gold text-black flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`px-2 py-1 rounded-lg backdrop-blur-sm ${
                          isLightSwatch ? 'bg-black/10 text-black' : 'bg-black/35 text-white'
                        }`}
                      >
                        <p className="text-xs font-bold leading-snug">{swatch.name}</p>
                        <p className="text-[10px] font-mono opacity-80">{swatch.hex.toUpperCase()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : filteredCovers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-neutral-500 mx-auto" />
              <p className="text-sm font-semibold text-white">No cover art matches your filter</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="text-xs text-brand-gold hover:underline font-bold"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredCovers.map((cover) => {
                const isSelected = selectedUrl === cover.url;
                return (
                  <button
                    key={cover.id}
                    onClick={() => handleSelectCover(cover.url)}
                    className={`group relative rounded-2xl overflow-hidden aspect-square border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-gold ring-2 ring-brand-gold shadow-[0_0_20px_rgba(255,215,0,0.4)] scale-[0.98]'
                        : 'border-white/10 hover:border-brand-neon/60 hover:scale-[1.02]'
                    }`}
                  >
                    <Image
                      src={cover.url}
                      alt={cover.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-3 opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end">
                        {isSelected && (
                          <div className="w-7 h-7 rounded-full bg-brand-gold text-black flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                          {cover.title}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {cover.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1 rounded bg-black/60 text-brand-neon"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Custom URL option */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <LinkIcon className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="url"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="Or paste a custom image URL (https://...)"
              className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
            />
            {customUrlInput.trim() && (
              <button
                onClick={handleApplyCustomUrl}
                className="px-3 py-1.5 rounded-xl bg-brand-gold text-black text-xs font-bold hover:scale-105 transition-all"
              >
                Use URL
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
