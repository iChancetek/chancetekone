'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, CloudCheck, RefreshCw, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CloudCatalogClient, CatalogSyncStatus } from '@/lib/catalog/CloudCatalogClient';

export function CloudCatalogSyncBanner() {
  const [status, setStatus] = useState<CatalogSyncStatus>(CloudCatalogClient.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    const unsub = CloudCatalogClient.onStatusChange(() => {
      setStatus(CloudCatalogClient.getStatus());
    });
    return unsub;
  }, []);

  const handleSyncNow = async () => {
    setIsManualSyncing(true);
    try {
      await CloudCatalogClient.syncNow();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  const isSyncing = status.state === 'syncing' || isManualSyncing;
  const isOffline = status.state === 'offline';
  const hasError = Boolean(status.error);
  const hasWarnings = status.warnings && status.warnings.length > 0;

  return (
    <div className="w-full rounded-2xl border border-brand-purple/30 bg-[#0d091a]/80 backdrop-blur-md p-3 sm:p-4 text-xs shadow-lg transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isSyncing
                ? 'bg-brand-purple/20 border-brand-purple/50 text-brand-purple animate-pulse'
                : isOffline
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : hasError
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-brand-purple" />
            ) : isOffline ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : hasError ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-xs sm:text-sm">
                Shared Cloud Catalog
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isSyncing
                    ? 'bg-brand-purple/20 text-brand-purple border-brand-purple/40'
                    : isOffline
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : hasError
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {isSyncing
                  ? `Syncing (${status.pending} pending)`
                  : isOffline
                  ? 'Offline'
                  : hasError
                  ? 'Sync Alert'
                  : `Live Rev #${status.revision}`}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {status.isWriter
                ? 'Admin Writer Active — uploads and deletions synchronize automatically across Chancellor, Ant Greene, and all members.'
                : 'Member Mode — viewing authoritative real-time cloud catalog.'}
              {status.lastSyncedAt && (
                <span className="ml-1.5 opacity-60">
                  Last checked {new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {hasWarnings && (
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{status.warnings.length} notice{status.warnings.length > 1 ? 's' : ''}</span>
            </button>
          )}

          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-brand-purple/20 hover:bg-brand-purple/30 border border-brand-purple/50 text-white text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Warnings Accordion */}
      {showWarnings && hasWarnings && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
            <span>Sync Notices</span>
            <button
              onClick={() => {
                CloudCatalogClient.clearWarnings();
                setShowWarnings(false);
              }}
              className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Dismiss all
            </button>
          </div>
          <ul className="space-y-1 text-[11px] text-neutral-300">
            {status.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
