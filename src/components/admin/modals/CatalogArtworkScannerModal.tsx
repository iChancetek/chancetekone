'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Music,
  Folder,
  Disc,
  ExternalLink,
  ShieldCheck,
  Zap,
  Play,
  Check,
} from 'lucide-react';
import {
  PlatformCatalogScannerAgent,
  CatalogScanItem,
  CatalogArtworkScanReport,
  ItemRepairProgress,
} from '@/lib/ai/platformCatalogScannerAgent';
import { MusicCatalogService, isMissingOrGenericCover } from '@/lib/music/MusicCatalogService';

interface CatalogArtworkScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCrateId?: string;
}

export function CatalogArtworkScannerModal({
  isOpen,
  onClose,
  initialCrateId,
}: CatalogArtworkScannerModalProps) {
  const [loadingScan, setLoadingScan] = useState(false);
  const [report, setReport] = useState<CatalogArtworkScanReport | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'track' | 'album' | 'folder'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dryRun, setDryRun] = useState(false);

  // Repair State
  const [isRepairing, setIsRepairing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<ItemRepairProgress | null>(null);
  const [repairedIds, setRepairedIds] = useState<Set<string>>(new Set());
  const [repairLogs, setRepairLogs] = useState<ItemRepairProgress[]>([]);
  const [repairLimit, setRepairLimit] = useState<number>(10);

  useEffect(() => {
    if (isOpen) {
      handleRunScan();
    } else {
      setIsRepairing(false);
      setCurrentProgress(null);
    }
  }, [isOpen, initialCrateId]);

  const handleRunScan = async () => {
    setLoadingScan(true);
    try {
      const res = await PlatformCatalogScannerAgent.scanPlatformArtwork({
        crateId: initialCrateId,
        checkStoredAudio: true,
      });
      setReport(res);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setLoadingScan(false);
    }
  };

  const handleRepairAll = async () => {
    if (!report || report.itemsNeedingArtwork.length === 0) return;
    setIsRepairing(true);
    setRepairLogs([]);

    try {
      await PlatformCatalogScannerAgent.runAutonomousCatalogRepair({
        crateId: initialCrateId,
        limit: repairLimit,
        dryRun,
        onProgress: (progress) => {
          setCurrentProgress(progress);
          if (progress.step === 'completed' || progress.step === 'failed') {
            setRepairLogs((prev) => [progress, ...prev.slice(0, 40)]);
            if (progress.step === 'completed') {
              setRepairedIds((prev) => new Set([...prev, progress.itemId]));
            }
          }
        },
      });

      // Refresh scan report after repair finishes
      await handleRunScan();
    } catch (err) {
      console.error('Autonomous repair failed:', err);
    } finally {
      setIsRepairing(false);
      setCurrentProgress(null);
    }
  };

  const handleRepairSingleItem = async (item: CatalogScanItem) => {
    if (repairedIds.has(item.id)) return;

    setCurrentProgress({
      itemId: item.id,
      type: item.type,
      title: item.title,
      artist: item.artistName,
      step: 'searching',
      message: `Searching Tavily for authentic artwork...`,
    });

    try {
      if (item.type === 'track') {
        const track = MusicCatalogService.getTrackById(item.id);
        if (track) {
          const res = await PlatformCatalogScannerAgent.enrichTrackArtwork(track, { dryRun });
          if (res.success) {
            setRepairedIds((prev) => new Set([...prev, item.id]));
            setRepairLogs((prev) => [
              {
                itemId: item.id,
                type: item.type,
                title: item.title,
                artist: item.artistName,
                step: 'completed',
                message: `Applied authentic artwork from ${res.candidate?.domain || 'web'}.`,
                candidateThumb: res.coverUrl,
                domain: res.candidate?.domain,
                confidenceScore: res.candidate?.confidenceScore,
                embeddedInMP3: res.embeddedInMP3,
              },
              ...prev,
            ]);
          }
        }
      } else {
        const res = await PlatformCatalogScannerAgent.enrichAlbumArtwork(
          { id: item.id, title: item.title, artistName: item.artistName, genre: item.genre },
          { dryRun }
        );
        if (res.success) {
          setRepairedIds((prev) => new Set([...prev, item.id]));
          setRepairLogs((prev) => [
            {
              itemId: item.id,
              type: item.type,
              title: item.title,
              artist: item.artistName,
              step: 'completed',
              message: `Applied authentic album artwork from ${res.candidate?.domain || 'web'}.`,
              candidateThumb: res.coverUrl,
              domain: res.candidate?.domain,
              confidenceScore: res.candidate?.confidenceScore,
            },
            ...prev,
          ]);
        }
      }
      await handleRunScan();
    } catch (err) {
      console.error('Failed to repair item:', err);
    } finally {
      setCurrentProgress(null);
    }
  };

  if (!isOpen) return null;

  const filteredItems = (report?.itemsNeedingArtwork || []).filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.artistName.toLowerCase().includes(q) ||
        (item.albumTitle && item.albumTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#0c0915] text-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-brand-purple/20 via-black to-brand-gold/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-gold flex items-center justify-center shadow-lg shadow-brand-gold/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">AI Catalog & MP3 Artwork Scanner</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/30 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Tavily Discovery
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Scan all platform MP3 tracks and albums lacking authentic artwork, search the web, and auto-embed ID3 APIC tags.
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

        {/* Diagnostic Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b border-white/10 bg-white/[0.02]">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Tracks Scanned</span>
              <Music className="w-4 h-4 text-brand-violet" />
            </div>
            <p className="text-2xl font-black text-white mt-2">
              {loadingScan ? '...' : report?.totalTracksScanned ?? 0}
            </p>
            <span className="text-[10px] text-neutral-500 font-mono">Platform library</span>
          </div>

          <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30">
            <div className="flex items-center justify-between text-brand-gold text-xs font-semibold">
              <span>Missing Art (Tracks)</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-brand-gold mt-2">
              {loadingScan ? '...' : report?.missingTracksCount ?? 0}
            </p>
            <span className="text-[10px] text-brand-gold/70 font-mono">Generic or unassigned</span>
          </div>

          <div className="p-4 rounded-2xl bg-brand-purple/10 border border-brand-purple/30">
            <div className="flex items-center justify-between text-brand-violet text-xs font-semibold">
              <span>Missing Art (Albums)</span>
              <Disc className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-brand-violet mt-2">
              {loadingScan ? '...' : (report?.missingAlbumsCount ?? 0) + (report?.missingFoldersCount ?? 0)}
            </p>
            <span className="text-[10px] text-brand-violet/70 font-mono">Collections & folders</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
              <span>Repaired This Session</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-2">
              {repairedIds.size}
            </p>
            <span className="text-[10px] text-emerald-400/70 font-mono">Catalog & MP3 updated</span>
          </div>
        </div>

        {/* Live Repair Progress Bar */}
        {isRepairing && (
          <div className="p-4 bg-brand-purple/10 border-b border-brand-purple/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-gold animate-spin" />
                {currentProgress ? currentProgress.message : 'Processing autonomous repair loop...'}
              </span>
              <span className="text-brand-gold font-mono font-bold">
                {currentProgress ? `${currentProgress.artist} - ${currentProgress.title}` : ''}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-gold via-brand-purple to-brand-violet animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {/* Action Controls & Filters Bar */}
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/40">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  filterType === 'all' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All ({report?.itemsNeedingArtwork.length ?? 0})
              </button>
              <button
                onClick={() => setFilterType('track')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  filterType === 'track' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Tracks ({report?.missingTracksCount ?? 0})
              </button>
              <button
                onClick={() => setFilterType('album')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  filterType === 'album' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Albums ({(report?.missingAlbumsCount ?? 0) + (report?.missingFoldersCount ?? 0)})
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by title or artist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50 w-48 sm:w-60"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-brand-gold focus:ring-0"
              />
              <span>Dry Run</span>
            </label>

            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span>Limit:</span>
              <select
                value={repairLimit}
                onChange={(e) => setRepairLimit(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
              >
                <option value={5}>5 items</option>
                <option value={10}>10 items</option>
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
              </select>
            </div>

            <button
              onClick={handleRunScan}
              disabled={loadingScan || isRepairing}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingScan ? 'animate-spin' : ''}`} />
              <span>Rescan</span>
            </button>

            <button
              onClick={handleRepairAll}
              disabled={isRepairing || !report || report.itemsNeedingArtwork.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-amber-600 hover:scale-105 active:scale-95 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-gold/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isRepairing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Agent Running...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Repair with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body: Items List & Live Event Log */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadingScan ? (
            <div className="p-12 text-center text-neutral-400 space-y-3">
              <RefreshCw className="w-8 h-8 text-brand-gold animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">Scanning Platform Catalog & MP3 Files...</p>
              <p className="text-xs text-neutral-500">Checking track records, album covers, and embedded ID3 APIC frames.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 space-y-3 bg-white/[0.02] rounded-2xl border border-white/5">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-white">All Platform Tracks & Albums Have Authentic Artwork!</p>
              <p className="text-xs text-neutral-500">No tracks or collections found with generic stock photos or missing covers.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isRepaired = repairedIds.has(item.id);
                const isCurrent = currentProgress?.itemId === item.id;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      isCurrent
                        ? 'bg-brand-purple/20 border-brand-gold shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : isRepaired
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Current Cover Preview or Placeholder */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 relative flex items-center justify-center">
                        {item.currentCoverUrl && !isMissingOrGenericCover(item.currentCoverUrl) ? (
                          <img
                            src={item.currentCoverUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-neutral-600">
                            {item.type === 'track' ? <Music className="w-5 h-5" /> : <Disc className="w-5 h-5" />}
                          </div>
                        )}
                        {item.missingReason === 'generic_stock' && (
                          <span className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-[8px] font-black uppercase text-center py-0.5">
                            Stock
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-white truncate">{item.title}</p>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-neutral-300">
                            {item.type}
                          </span>
                          {item.hasStoredAudio && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-brand-violet/20 text-brand-violet border border-brand-violet/30">
                              MP3 Cached
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {item.artistName} {item.albumTitle ? `• ${item.albumTitle}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isRepaired ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                          <span>Repaired</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded-xl border border-brand-gold/30">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Searching Tavily...</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRepairSingleItem(item)}
                          disabled={isRepairing}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                          <span>Auto-Find Art</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Session Repair Event Logs */}
          {repairLogs.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Session Repairs ({repairLogs.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {repairLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3"
                  >
                    {log.candidateThumb && (
                      <img
                        src={log.candidateThumb}
                        alt={log.title}
                        className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{log.title}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{log.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {log.domain && (
                          <span className="text-[9px] font-mono text-brand-gold bg-brand-gold/10 px-1.5 py-0.2 rounded border border-brand-gold/20">
                            {log.domain}
                          </span>
                        )}
                        {log.embeddedInMP3 && (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                            APIC Embedded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Tavily Real-time Web Search & ID3 APIC Embedding Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
