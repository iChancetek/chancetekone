'use client';

import React, { useState } from 'react';
import { AuditLogItem } from '@/types/admin';
import { AuditLogger } from '@/lib/admin/AuditLogger';
import { AuditDetailModal } from '../modals/AuditDetailModal';
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Lock,
} from 'lucide-react';

interface AuditLogsSectionProps {
  logs: AuditLogItem[];
  onRefresh: () => void;
}

export const AuditLogsSection: React.FC<AuditLogsSectionProps> = ({ logs, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const eventTypes = ['all', ...Array.from(new Set(logs.map((l) => l.eventType)))];

  const filteredLogs = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !searchQuery ||
      l.action.toLowerCase().includes(q) ||
      l.adminName.toLowerCase().includes(q) ||
      l.resource.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q);

    const matchType = eventTypeFilter === 'all' || l.eventType === eventTypeFilter;
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  const handleExportCSV = () => {
    const csvContent = AuditLogger.exportLogsToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `8ofspades_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = AuditLogger.exportLogsToJSON();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `8ofspades_audit_logs_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center text-brand-neon">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Immutable Platform Audit Logs</h2>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Append-Only Integrity
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Every administrative modification, user status change, password reset, and catalog sync is permanently audited
              </p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-brand-gold" />
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5 text-brand-neon" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-2 border-t border-white/5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search audit action, admin ID, event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none"
            >
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All Event Types' : t}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Audit Entries ({filteredLogs.length})
          </span>
          <span className="text-xs text-neutral-400 font-mono">Timezone: UTC Normalized</span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-2">Event ID</th>
                <th className="py-3 px-3">Timestamp (UTC)</th>
                <th className="py-3 px-3">Admin Actor</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3">Action Description</th>
                <th className="py-3 px-3">Origin (IP & Geo)</th>
                <th className="py-3 px-3 text-right">Status</th>
                <th className="py-3 px-3 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredLogs.map((log) => {
                const isSuccess = log.status === 'SUCCESS';
                const isWarning = log.status === 'WARNING';

                return (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-2 text-brand-gold font-bold">{log.id}</td>
                    <td className="py-3 px-3 text-neutral-300">
                      {new Date(log.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-sans font-bold text-white">{log.adminName}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          log.eventType.includes('UPLOAD')
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : log.eventType.includes('REMOV') || log.eventType.includes('PURGE')
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : log.eventType.includes('RESTOR')
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : 'bg-white/10 text-brand-neon border-white/10'
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-neutral-200 max-w-xs truncate">{log.action}</td>
                    <td className="py-3 px-3 text-neutral-400 text-[11px]">
                      {log.geo} ({log.ip})
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                        {isWarning && <AlertTriangle className="w-3 h-3" />}
                        {!isSuccess && !isWarning && <XCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-colors text-[11px] font-mono flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3 text-brand-gold" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      <AuditDetailModal
        log={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};
