'use client';

import React from 'react';
import { AuditLogItem } from '@/types/admin';
import { X, Shield, FileCode, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface AuditDetailModalProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ log, isOpen, onClose }) => {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl glass-panel border border-brand-purple/40 bg-[#0d0d16] shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-gold">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Audit Record Payload Inspector</h3>
              <p className="text-[11px] font-mono text-neutral-400">Event ID: {log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-neutral-400">Event Type</span>
            <p className="font-bold text-white font-mono mt-0.5">{log.eventType}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-neutral-400">Admin Actor</span>
            <p className="font-bold text-brand-gold font-mono mt-0.5">{log.adminName}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-neutral-400">Execution Status</span>
            <p
              className={`font-bold font-mono mt-0.5 ${
                log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {log.status}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-neutral-400">IP & Geo Origin</span>
            <p className="font-mono text-neutral-200 mt-0.5">
              {log.ip} ({log.geo})
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 col-span-2">
            <span className="text-[10px] text-neutral-400">Exact UTC Timestamp</span>
            <p className="font-mono text-white mt-0.5">{log.timestamp}</p>
          </div>
        </div>

        {/* Action description */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Action Narrative</span>
          <p className="text-xs text-neutral-200">{log.action}</p>
        </div>

        {/* JSON Payload viewer */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
            Raw State Diff & Payload (JSON)
          </span>
          <pre className="p-3 rounded-2xl bg-[#06060a] border border-white/10 text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-48 select-all">
            {JSON.stringify(
              {
                id: log.id,
                timestamp: log.timestamp,
                adminId: log.adminId,
                adminRole: log.adminRole,
                eventType: log.eventType,
                resource: log.resource,
                resourceId: log.resourceId,
                previousValue: log.previousValue || null,
                newValue: log.newValue || null,
                ip: log.ip,
                geo: log.geo,
                status: log.status,
              },
              null,
              2
            )}
          </pre>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
