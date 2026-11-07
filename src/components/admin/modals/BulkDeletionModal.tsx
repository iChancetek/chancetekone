'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import {
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
  CheckCircle2,
  Music,
  Disc3,
  BookOpen,
  Mic,
  Video,
  Sliders,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  Layers,
  Info,
  Check,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AdminRole } from '@/types/admin';
import { MusicCatalogService } from '@/lib/music/MusicCatalogService';
import { MediaCatalogService } from '@/lib/media/MediaCatalogService';
import { ProducerCatalogService } from '@/lib/producers/ProducerCatalogService';
import { MerchCatalogService } from '@/lib/commerce/MerchCatalogService';
import {
  planBulkDeletion,
  executeBulkPlan,
  BulkSelectionItem,
  CatalogSnapshot,
  AlbumTrackPolicy,
  ProducerTrackPolicy,
  BulkJobProgress,
  PlannedOperation,
  BulkContentType,
} from '@/lib/admin/bulkDeletion';
import { DeletableItem } from './ConfirmDeletionModal';

interface BulkDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: DeletableItem[];
  onComplete: () => void;
}

const TYPE_CONFIG: Record<
  BulkContentType,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  song: {
    label: 'Music Songs',
    icon: Music,
    color: 'text-brand-purple',
    bg: 'bg-brand-purple/20',
    border: 'border-brand-purple/40',
  },
  album: {
    label: 'Albums',
    icon: Disc3,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/40',
  },
  audiobook: {
    label: 'Audiobooks',
    icon: BookOpen,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/40',
  },
  podcast: {
    label: 'Podcasts',
    icon: Mic,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
  },
  video: {
    label: '4K Videos',
    icon: Video,
    color: 'text-rose-400',
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/40',
  },
  producer: {
    label: 'Producers',
    icon: Sliders,
    color: 'text-brand-gold',
    bg: 'bg-brand-gold/20',
    border: 'border-brand-gold/40',
  },
  merch: {
    label: 'Merchandise',
    icon: ShoppingBag,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
  },
};

const REASON_PRESETS = [
  'Administrative catalogue cleanup',
  'Licensing window expired',
  'Duplicate or superseded catalogue versions',
  'Quality assurance / broken audio asset',
  'Creator account migration',
];

export const BulkDeletionModal: React.FC<BulkDeletionModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  onComplete,
}) => {
  const { profile } = useAuth();

  // Policy options
  const [albumTrackPolicy, setAlbumTrackPolicy] = useState<AlbumTrackPolicy>('detach_tracks');
  const [producerTrackPolicy, setProducerTrackPolicy] = useState<ProducerTrackPolicy>('keep_tracks');
  const [reason, setReason] = useState<string>('Administrative catalogue cleanup');
  const [confirmPhrase, setConfirmPhrase] = useState<string>('');

  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [progress, setProgress] = useState<BulkJobProgress | null>(null);
  const [failedOps, setFailedOps] = useState<PlannedOperation[]>([]);
  const [executionDone, setExecutionDone] = useState<boolean>(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsExecuting(false);
      setProgress(null);
      setFailedOps([]);
      setExecutionDone(false);
      setConfirmPhrase('');
    }
  }, [isOpen]);

  // Build snapshot
  const snapshot: CatalogSnapshot = useMemo(() => {
    return {
      tracks: MusicCatalogService.getAllTracks().map((t) => ({
        id: t.id,
        title: t.title,
        albumId: t.albumId,
        albumTitle: t.albumTitle,
        artistId: t.artistId,
        artistName: t.artistName,
        coverUrl: t.coverUrl,
        audioUrl: t.audioUrl,
      })),
      albums: MusicCatalogService.getAllAlbums().map((a) => ({
        id: a.id,
        title: a.title,
        trackIds: a.trackIds || [],
        coverUrl: a.coverUrl,
      })),
      producers: ProducerCatalogService.getAllProducers().map((p) => ({
        id: p.id,
        name: p.name,
      })),
    };
  }, [isOpen]);

  // Compute bulk delete plan
  const plan = useMemo(() => {
    const selectionItems: BulkSelectionItem[] = selectedItems.map((it) => ({
      id: it.id,
      type: it.type as BulkContentType,
      title: it.title,
    }));

    return planBulkDeletion(selectionItems, snapshot, {
      albumTrackPolicy,
      producerTrackPolicy,
    });
  }, [selectedItems, snapshot, albumTrackPolicy, producerTrackPolicy]);

  if (!isOpen) return null;

  const hasAlbums = plan.breakdown.album > 0;
  const hasProducers = plan.breakdown.producer > 0;
  const totalSelected = selectedItems.length;

  const handleExecute = async () => {
    if (!reason.trim()) return;
    setIsExecuting(true);
    setFailedOps([]);

    const adminActor: { id: string; name: string; email: string; role: AdminRole } = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: 'admin',
    };

    try {
      const result = await executeBulkPlan(
        plan,
        async (op) => {
          if (op.type === 'song') {
            MusicCatalogService.removeTrack(op.id, adminActor, reason);
          } else if (op.type === 'album') {
            MusicCatalogService.removeAlbumById(op.id, adminActor, reason, {
              detachTracks: albumTrackPolicy === 'detach_tracks',
            });
          } else if (op.type === 'audiobook') {
            MediaCatalogService.removeAudiobook(op.id, adminActor, reason);
          } else if (op.type === 'podcast') {
            MediaCatalogService.removePodcast(op.id, adminActor, reason);
          } else if (op.type === 'video') {
            MediaCatalogService.removeVideo(op.id, adminActor, reason);
          } else if (op.type === 'producer') {
            ProducerCatalogService.removeProducer(
              op.id,
              adminActor,
              reason,
              producerTrackPolicy === 'delete_tracks'
            );
          } else if (op.type === 'merch') {
            MerchCatalogService.removeProduct(op.id, adminActor, reason);
          }
        },
        (p) => setProgress(p)
      );

      setFailedOps(result.failedOperations);
      setExecutionDone(true);
      if (result.failedOperations.length === 0) {
        setTimeout(() => {
          onComplete();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Bulk deletion execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRetryFailed = async () => {
    if (failedOps.length === 0) return;
    setIsExecuting(true);

    const adminActor: { id: string; name: string; email: string; role: AdminRole } = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || profile?.email || 'Platform Administrator',
      email: profile?.email || 'admin@chancetekone.com',
      role: 'admin',
    };

    const remainingFailed: PlannedOperation[] = [];

    for (const op of failedOps) {
      try {
        if (op.type === 'song') {
          MusicCatalogService.removeTrack(op.id, adminActor, reason);
        } else if (op.type === 'album') {
          MusicCatalogService.removeAlbumById(op.id, adminActor, reason, {
            detachTracks: albumTrackPolicy === 'detach_tracks',
          });
        } else if (op.type === 'audiobook') {
          MediaCatalogService.removeAudiobook(op.id, adminActor, reason);
        } else if (op.type === 'podcast') {
          MediaCatalogService.removePodcast(op.id, adminActor, reason);
        } else if (op.type === 'video') {
          MediaCatalogService.removeVideo(op.id, adminActor, reason);
        } else if (op.type === 'producer') {
          ProducerCatalogService.removeProducer(
            op.id,
            adminActor,
            reason,
            producerTrackPolicy === 'delete_tracks'
          );
        } else if (op.type === 'merch') {
          MerchCatalogService.removeProduct(op.id, adminActor, reason);
        }
      } catch (err) {
        remainingFailed.push(op);
      }
    }

    setFailedOps(remainingFailed);
    setIsExecuting(false);
    if (remainingFailed.length === 0) {
      setExecutionDone(true);
      setTimeout(() => {
        onComplete();
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-2xl p-6 sm:p-8 rounded-3xl glass-panel border border-red-500/40 bg-[#120618] shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-extrabold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              Administrative Bulk Deletion
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Bulk Content Deletion ({totalSelected} Items)
            </h3>
            <p className="text-xs text-neutral-300">
              Review impact scope, cascade policies, and asset retention before executing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar (during or after execution) */}
        {progress && (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
              <span>
                {progress.status === 'running'
                  ? 'Deleting Items...'
                  : progress.status === 'completed'
                  ? 'Deletion Complete'
                  : 'Completed with Errors'}
              </span>
              <span className="font-mono text-brand-gold">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1">
              <span>Deleted: {progress.deleted}</span>
              <span>Skipped: {progress.skipped}</span>
              <span className={progress.failed > 0 ? 'text-red-400 font-bold' : ''}>
                Failed: {progress.failed}
              </span>
            </div>
          </div>
        )}

        {/* Breakdown by Content Type */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Selected Content Breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(Object.keys(plan.breakdown) as BulkContentType[])
              .filter((k) => plan.breakdown[k] > 0)
              .map((typeKey) => {
                const conf = TYPE_CONFIG[typeKey];
                const Icon = conf.icon;
                return (
                  <div
                    key={typeKey}
                    className={`p-2.5 rounded-xl border ${conf.bg} ${conf.border} flex items-center justify-between gap-2`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 ${conf.color} shrink-0`} />
                      <span className="text-xs font-bold text-white truncate">{conf.label}</span>
                    </div>
                    <span className="text-xs font-black font-mono text-white">
                      {plan.breakdown[typeKey]}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Policy Options for Albums & Producers */}
        {(hasAlbums || hasProducers) && (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Cascade & Dependency Policies
            </p>

            {/* Album Track Policy */}
            {hasAlbums && (
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-neutral-300 block">Album Songs Handling:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                      albumTrackPolicy === 'detach_tracks'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                        : 'bg-black/30 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="albumPolicy"
                      checked={albumTrackPolicy === 'detach_tracks'}
                      onChange={() => setAlbumTrackPolicy('detach_tracks')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-white">Detach Tracks (Recommended)</p>
                      <p className="text-[10px] text-neutral-300">
                        Keep songs in live crates; remove album wrapper only.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                      albumTrackPolicy === 'delete_tracks'
                        ? 'bg-red-500/20 border-red-500 text-red-200'
                        : 'bg-black/30 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="albumPolicy"
                      checked={albumTrackPolicy === 'delete_tracks'}
                      onChange={() => setAlbumTrackPolicy('delete_tracks')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-white">Cascade Delete Songs</p>
                      <p className="text-[10px] text-neutral-300">
                        Move all songs in deleted albums to 45-day Recovery Vault.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Producer Track Policy */}
            {hasProducers && (
              <div className="space-y-1.5 text-xs pt-1 border-t border-white/5">
                <span className="font-bold text-neutral-300 block">Producer Tracks Handling:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                      producerTrackPolicy === 'keep_tracks'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                        : 'bg-black/30 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="producerPolicy"
                      checked={producerTrackPolicy === 'keep_tracks'}
                      onChange={() => setProducerTrackPolicy('keep_tracks')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-white">Keep Songs (Recommended)</p>
                      <p className="text-[10px] text-neutral-300">
                        Preserve music catalogue songs; delete producer profile.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                      producerTrackPolicy === 'delete_tracks'
                        ? 'bg-red-500/20 border-red-500 text-red-200'
                        : 'bg-black/30 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="producerPolicy"
                      checked={producerTrackPolicy === 'delete_tracks'}
                      onChange={() => setProducerTrackPolicy('delete_tracks')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-white">Delete Producer Songs</p>
                      <p className="text-[10px] text-neutral-300">
                        Remove tracks attributed to deleted producer.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notices & Asset Protection */}
        <div className="space-y-2">
          {plan.dependencyWarnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Dependency Notices ({plan.dependencyWarnings.length})</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-300/90 pl-1 space-y-0.5">
                {plan.dependencyWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.overlaps.length > 0 && (
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-[11px] flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                {plan.overlaps.length} item(s) skipped because parent album covers them.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-neutral-300 text-[11px] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white">45-Day Recovery Vault Protection</span>
              <p className="text-neutral-400">
                Deleted music tracks and albums remain recoverable in the 45-day Recovery Vault. Shared audio and cover assets referenced by other active content are preserved.
              </p>
            </div>
          </div>
        </div>

        {/* Audit Reason Input */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-neutral-300 block">
            Administrative Audit Reason <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Specify reason for deletion (logged to audit log)..."
            className="w-full p-2.5 rounded-xl bg-black/40 border border-white/15 text-white font-medium focus:border-red-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {REASON_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all ${
                  reason === p
                    ? 'bg-red-500/30 text-red-200 border border-red-500/50'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/5'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Failure Report with Retry */}
        {failedOps.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-red-500/20 border border-red-500/50 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-red-200">
                {failedOps.length} Operation(s) Failed
              </span>
              <button
                onClick={handleRetryFailed}
                disabled={isExecuting}
                className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry Failed</span>
              </button>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] font-mono text-red-300">
              {failedOps.map((f) => (
                <div key={f.key} className="truncate">
                  • [{f.type.toUpperCase()}] {f.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs uppercase transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting || !reason.trim() || plan.operations.length === 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:scale-105 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isExecuting
                ? 'Deleting...'
                : `Confirm & Delete (${plan.operations.length} Records)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
