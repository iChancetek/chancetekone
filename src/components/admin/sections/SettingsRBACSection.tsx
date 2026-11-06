'use client';

import React, { useState } from 'react';
import { RolePermissionRule, AdminRole } from '@/types/admin';
import {
  Shield,
  Sliders,
  Check,
  X,
  Lock,
  Globe,
  Database,
  EyeOff,
  Save,
  CheckCircle2,
} from 'lucide-react';

const ROLE_RULES: RolePermissionRule[] = [
  {
    role: 'super_admin',
    title: 'Super Administrator',
    description: 'Root platform authority with destructive privileges, audit retention management, and full RBAC assignment.',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    permissions: {
      canManageUsers: true,
      canChangeUserStatus: true,
      canResetPasswords: true,
      canDeleteAccounts: true,
      canManageRoles: true,
      canViewAnalytics: true,
      canExportReports: true,
      canManageContent: true,
      canViewAuditLogs: true,
      canPurgeLogs: true,
      canModifySystemSettings: true,
    },
  },
  {
    role: 'admin',
    title: 'Platform Administrator',
    description: 'General operational access across user profiles, content catalog, analytics dashboards, and merchandise.',
    badgeColor: 'bg-brand-purple/20 text-brand-neon border-brand-purple/40',
    permissions: {
      canManageUsers: true,
      canChangeUserStatus: true,
      canResetPasswords: true,
      canDeleteAccounts: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canExportReports: true,
      canManageContent: true,
      canViewAuditLogs: true,
      canPurgeLogs: false,
      canModifySystemSettings: false,
    },
  },
  {
    role: 'analytics_admin',
    title: 'Analytics Administrator',
    description: 'Deep business intelligence, conversion funnel access, and multi-format report exports with read-only user access.',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    permissions: {
      canManageUsers: false,
      canChangeUserStatus: false,
      canResetPasswords: false,
      canDeleteAccounts: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canExportReports: true,
      canManageContent: false,
      canViewAuditLogs: true,
      canPurgeLogs: false,
      canModifySystemSettings: false,
    },
  },
  {
    role: 'content_admin',
    title: 'Content Administrator',
    description: 'Breakbeat media curator managing song metadata, 4K video releases, audiobook chapters, and merchandise inventory.',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    permissions: {
      canManageUsers: false,
      canChangeUserStatus: false,
      canResetPasswords: false,
      canDeleteAccounts: false,
      canManageRoles: false,
      canViewAnalytics: true,
      canExportReports: false,
      canManageContent: true,
      canViewAuditLogs: false,
      canPurgeLogs: false,
      canModifySystemSettings: false,
    },
  },
  {
    role: 'support_admin',
    title: 'Support Administrator',
    description: 'Customer service authority for user lookup, account status toggles, and zero-knowledge password reset workflows.',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    permissions: {
      canManageUsers: true,
      canChangeUserStatus: true,
      canResetPasswords: true,
      canDeleteAccounts: false,
      canManageRoles: false,
      canViewAnalytics: false,
      canExportReports: false,
      canManageContent: false,
      canViewAuditLogs: false,
      canPurgeLogs: false,
      canModifySystemSettings: false,
    },
  },
];

export const SettingsRBACSection: React.FC = () => {
  const [retentionDays, setRetentionDays] = useState<'30' | '90' | '180' | '365'>('90');
  const [isAnonymized, setIsAnonymized] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveSettings = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* RBAC Overview Matrix */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-gold" />
              Role-Based Access Control (RBAC) Permission Matrix
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enforced server-side and client-side access control boundaries across platform administrative tiers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLE_RULES.map((rule) => (
            <div
              key={rule.role}
              className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-purple/40 transition-colors space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{rule.title}</h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${rule.badgeColor}`}
                >
                  {rule.role}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">{rule.description}</p>

              {/* Permission Checkmarks */}
              <div className="space-y-1.5 pt-2 border-t border-white/5 text-[11px]">
                {Object.entries(rule.permissions).map(([perm, allowed]) => (
                  <div key={perm} className="flex items-center justify-between">
                    <span className="text-neutral-400">
                      {perm.replace(/([A-Z])/g, ' $1').replace(/^can /, '')}
                    </span>
                    {allowed ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Check className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-neutral-600 font-medium">
                        <X className="w-3.5 h-3.5" /> Restricted
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System & Data Retention Settings */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-neon" />
              Telemetry Data Retention & Anonymization Policies
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Configure event lifecycle storage, IP masking protocols, and regulatory compliance standards
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5"
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4 text-black" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Settings Applied!' : 'Save Configuration'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          {/* Data Retention Period */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <span className="font-bold text-white block">Raw Event Telemetry Retention</span>
            <p className="text-neutral-400 leading-relaxed text-[11px]">
              High-frequency media streaming events are automatically compressed into daily aggregations after this threshold.
            </p>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-[#141224] border border-white/10 text-white font-mono focus:outline-none"
            >
              <option value="30">30 Days (Fastest Query Performance)</option>
              <option value="90">90 Days (Recommended Enterprise Default)</option>
              <option value="180">180 Days (Extended Auditing)</option>
              <option value="365">365 Days (Full Fiscal Year Archive)</option>
            </select>
          </div>

          {/* IP Anonymization Switch */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <span className="font-bold text-white block">IP Address Anonymization & Masking</span>
            <p className="text-neutral-400 leading-relaxed text-[11px]">
              Enforces coarse geographic resolution (city / state level) and truncates the last octet of user IP addresses.
            </p>
            <button
              onClick={() => setIsAnonymized(!isAnonymized)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                isAnonymized
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-neutral-400'
              }`}
            >
              <EyeOff className="w-4 h-4" />
              {isAnonymized ? 'IP Masking Active (GDPR/CCPA Compliant)' : 'Raw IP Logging Enabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
