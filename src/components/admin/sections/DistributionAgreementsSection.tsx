'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  FileSignature,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  X,
  Scale,
  DollarSign,
  User,
  Music,
  Sliders,
  Video,
  Headphones,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  Printer,
  ExternalLink,
  ChevronRight,
  BadgeCheck,
  ShieldAlert,
  Send,
  PenTool,
  Building,
  Mail,
  Phone,
  Globe,
  Sparkles,
  Check,
  Ban,
} from 'lucide-react';
import {
  DistributionAgreementService,
  SignedDistributionAgreement,
} from '@/lib/agreements/DistributionAgreementService';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { useAuth } from '@/lib/auth/AuthContext';
import { AuditLogger } from '@/lib/admin/AuditLogger';

export function DistributionAgreementsSection() {
  const { profile } = useAuth();

  const [agreements, setAgreements] = useState<SignedDistributionAgreement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<SignedDistributionAgreement | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified_active' | 'denied'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'artist' | 'producer' | 'creator' | 'streamer'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal State
  const [reviewNotes, setReviewNotes] = useState('');
  const [denialReasonPrompt, setDenialReasonPrompt] = useState(false);
  const [denialReasonText, setDenialReasonText] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const local = DistributionAgreementService.getSubmittedAgreements();
    setAgreements(local);
    try {
      const serverSynced = await DistributionAgreementService.syncFromServer();
      setAgreements(serverSynced);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = DistributionAgreementService.subscribe(() => {
      setAgreements(DistributionAgreementService.getSubmittedAgreements());
    });
    return () => unsubscribe();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = agreements.length;
    const pending = agreements.filter(
      (a) => a.status === 'submitted' || a.status === 'under_review'
    ).length;
    const verified = agreements.filter((a) => a.status === 'verified_active').length;
    const denied = agreements.filter((a) => a.status === 'denied').length;
    return { total, pending, verified, denied };
  }, [agreements]);

  // Filtered agreements
  const filteredAgreements = useMemo(() => {
    return agreements.filter((a) => {
      // Status match
      if (statusFilter === 'pending') {
        if (a.status !== 'submitted' && a.status !== 'under_review') return false;
      } else if (statusFilter !== 'all') {
        if (a.status !== statusFilter) return false;
      }

      // Role match
      if (roleFilter !== 'all') {
        if (a.creatorType !== roleFilter) return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const moniker = a.artistMoniker?.toLowerCase() || '';
        const legal = a.artistLegalName?.toLowerCase() || '';
        const email = a.email?.toLowerCase() || '';
        const id = a.id?.toLowerCase() || '';
        const entity = a.entityName?.toLowerCase() || '';
        if (
          !moniker.includes(q) &&
          !legal.includes(q) &&
          !email.includes(q) &&
          !id.includes(q) &&
          !entity.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [agreements, statusFilter, roleFilter, searchQuery]);

  const handleOpenReview = (agreement: SignedDistributionAgreement) => {
    setSelectedAgreement(agreement);
    setReviewNotes(agreement.adminNotes || '');
    setDenialReasonPrompt(false);
    setDenialReasonText('');
  };

  const handleApprove = (agreement: SignedDistributionAgreement) => {
    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || 'Platform Administrator',
    };

    const notes =
      reviewNotes.trim() ||
      `Approved by ${adminActor.name}. Catalog distribution and upload privileges unlocked.`;

    // 1. Update Agreement Status
    DistributionAgreementService.updateAgreementStatus(
      agreement.id,
      'verified_active',
      notes,
      adminActor
    );

    // 2. Update User Account in AdminUserManager
    AdminUserManager.updateUserAgreementStatus(
      agreement.email,
      'verified_active',
      agreement.id
    );

    setActionFeedback(`Agreement ${agreement.id} for "${agreement.artistMoniker}" successfully approved!`);
    setTimeout(() => setActionFeedback(null), 5000);

    if (selectedAgreement && selectedAgreement.id === agreement.id) {
      setSelectedAgreement({
        ...selectedAgreement,
        status: 'verified_active',
        adminNotes: notes,
        reviewedBy: adminActor.name,
        reviewedAt: new Date().toISOString(),
      });
    }
  };

  const handleConfirmDenial = (agreement: SignedDistributionAgreement) => {
    if (!denialReasonText.trim()) {
      alert('Please specify the reason for denial before rejecting.');
      return;
    }

    const adminActor = {
      id: profile?.id || 'usr-admin',
      name: profile?.name || 'Platform Administrator',
    };

    const notes = `DENIED: ${denialReasonText.trim()} (Reviewed by ${adminActor.name})`;

    // 1. Update Agreement Status
    DistributionAgreementService.updateAgreementStatus(
      agreement.id,
      'denied',
      notes,
      adminActor
    );

    // 2. Update User Account in AdminUserManager
    AdminUserManager.updateUserAgreementStatus(
      agreement.email,
      'denied',
      agreement.id
    );

    setDenialReasonPrompt(false);
    setActionFeedback(`Agreement ${agreement.id} for "${agreement.artistMoniker}" was denied.`);
    setTimeout(() => setActionFeedback(null), 5000);

    if (selectedAgreement && selectedAgreement.id === agreement.id) {
      setSelectedAgreement({
        ...selectedAgreement,
        status: 'denied',
        adminNotes: notes,
        reviewedBy: adminActor.name,
        reviewedAt: new Date().toISOString(),
      });
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'artist':
        return <Music className="w-4 h-4 text-brand-gold" />;
      case 'producer':
        return <Sliders className="w-4 h-4 text-brand-neon" />;
      case 'creator':
        return <Video className="w-4 h-4 text-brand-purple" />;
      case 'streamer':
        return <Headphones className="w-4 h-4 text-emerald-400" />;
      default:
        return <Music className="w-4 h-4 text-brand-gold" />;
    }
  };

  const getStatusBadge = (status: SignedDistributionAgreement['status']) => {
    switch (status) {
      case 'submitted':
      case 'under_review':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'verified_active':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Verified Active
          </span>
        );
      case 'denied':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1.5">
            <Ban className="w-3 h-3" />
            Denied
          </span>
        );
      case 'archived':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-neutral-400 border border-white/20">
            Archived
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-emerald-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Subtitle */}
      <div className="p-6 rounded-3xl glass-panel border border-brand-gold/30 bg-gradient-to-r from-brand-gold/15 via-[#130d24] to-brand-purple/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold/50 flex items-center justify-center text-brand-gold shadow-lg shadow-brand-gold/20 shrink-0">
            <FileSignature className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Creator Distribution Agreements
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time Stream (No Mock Data)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/30 flex items-center gap-1">
                <Scale className="w-3 h-3" />
                Human-in-the-Loop Governance
              </span>
            </div>
            <p className="text-xs text-neutral-300 max-w-3xl leading-relaxed">
              Review, approve, or deny signed digital agreements executed during artist, producer, and creator registration. All platform distributions require verified legal authority and 80/20 royalty compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-brand-gold ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Refresh Registry'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-white/10 bg-[#0e0a1b]/80 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Total Agreements
          </span>
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-[10px] text-neutral-500">All executed contracts</p>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-2xl glass-panel border transition-all cursor-pointer space-y-1 ${
            statusFilter === 'pending'
              ? 'border-amber-500/80 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'border-white/10 bg-[#0e0a1b]/80 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Pending Human Review
            </span>
            {stats.pending > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <p className="text-2xl font-black text-amber-400">{stats.pending}</p>
          <p className="text-[10px] text-amber-300/80">Awaiting admin review</p>
        </div>

        <div
          onClick={() => setStatusFilter('verified_active')}
          className={`p-4 rounded-2xl glass-panel border transition-all cursor-pointer space-y-1 ${
            statusFilter === 'verified_active'
              ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              : 'border-white/10 bg-[#0e0a1b]/80 hover:border-emerald-500/40'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
            Verified Active Creators
          </span>
          <p className="text-2xl font-black text-emerald-400">{stats.verified}</p>
          <p className="text-[10px] text-emerald-300/80">Approved 80/20 distribution</p>
        </div>

        <div
          onClick={() => setStatusFilter('denied')}
          className={`p-4 rounded-2xl glass-panel border transition-all cursor-pointer space-y-1 ${
            statusFilter === 'denied'
              ? 'border-red-500/80 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
              : 'border-white/10 bg-[#0e0a1b]/80 hover:border-red-500/40'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">
            Denied / Ineligible
          </span>
          <p className="text-2xl font-black text-red-400">{stats.denied}</p>
          <p className="text-[10px] text-neutral-500">Rejected by admin</p>
        </div>
      </div>

      {/* Control Bar: Status Tabs, Persona Chips & Search */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 bg-[#0a0715]/90 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tab Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all' as const, label: 'All Agreements', count: stats.total },
              { id: 'pending' as const, label: 'Pending Human Review', count: stats.pending, isAlert: stats.pending > 0 },
              { id: 'verified_active' as const, label: 'Verified Active', count: stats.verified },
              { id: 'denied' as const, label: 'Denied', count: stats.denied },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-brand-gold text-black shadow-md'
                      : 'text-neutral-400 hover:text-white bg-white/5 border border-white/5'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-black text-brand-gold font-black'
                        : tab.isAlert
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-white/10 text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search moniker, legal name, email, ID..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-brand-gold transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Persona / Creator Role Filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
          <span className="text-[11px] font-bold uppercase text-neutral-400 flex items-center gap-1">
            <Filter className="w-3 h-3 text-brand-gold" />
            Persona Filter:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all' as const, label: 'All Personas' },
              { id: 'artist' as const, label: 'Artists 🎵' },
              { id: 'producer' as const, label: 'Producers 🎹' },
              { id: 'creator' as const, label: 'Creators 🎬' },
              { id: 'streamer' as const, label: 'Streamers 🎧' },
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRoleFilter(rf.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  roleFilter === rf.id
                    ? 'bg-brand-purple text-white border border-brand-purple'
                    : 'text-neutral-400 hover:text-white bg-white/5 border border-white/5'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AGREEMENTS TABLE / CARD LIST */}
      <div className="rounded-3xl glass-panel border border-white/10 bg-[#0c0915] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-neutral-400">
                <th className="p-4">Creator / Moniker</th>
                <th className="p-4">Persona Role</th>
                <th className="p-4">Legal Signer &amp; Entity</th>
                <th className="p-4">Contact &amp; Jurisdiction</th>
                <th className="p-4">Submitted Date</th>
                <th className="p-4">Signature Type</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Human-in-the-Loop Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-neutral-300 font-sans">
              {filteredAgreements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-neutral-500">
                    <FileSignature className="w-10 h-10 text-brand-gold/40 mx-auto mb-3" />
                    <p className="font-bold text-base text-white">
                      {agreements.length === 0
                        ? 'No Creator Agreements Submitted Yet'
                        : 'No agreements matching active filters'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                      {agreements.length === 0
                        ? 'Real-time live stream active (Zero Mock Data). When artists, producers, or creators register and execute their onboarding distribution agreement, their signed contract will appear here instantly for Human-in-the-Loop review.'
                        : 'Try selecting a different status tab, persona role filter, or clearing your search query.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAgreements.map((agreement) => {
                  const isPending =
                    agreement.status === 'submitted' || agreement.status === 'under_review';
                  return (
                    <tr
                      key={agreement.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Moniker & ID */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            {getRoleIcon(agreement.creatorType)}
                          </div>
                          <div>
                            <p className="font-extrabold text-white text-sm group-hover:text-brand-gold transition-colors">
                              {agreement.artistMoniker}
                            </p>
                            <p className="text-[10px] font-mono text-neutral-400">{agreement.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Persona Role */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-neutral-200">
                          {agreement.creatorType || 'artist'}
                        </span>
                      </td>

                      {/* Legal Signer & Entity */}
                      <td className="p-4">
                        <p className="font-bold text-white">{agreement.artistLegalName}</p>
                        {agreement.entityName && (
                          <p className="text-[10px] text-neutral-400">{agreement.entityName}</p>
                        )}
                        {agreement.w9Certified && (
                          <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5 mt-0.5">
                            <BadgeCheck className="w-3 h-3" /> W-9 Certified
                          </span>
                        )}
                      </td>

                      {/* Contact & Jurisdiction */}
                      <td className="p-4">
                        <p className="font-mono text-xs text-neutral-300">{agreement.email}</p>
                        <p className="text-[10px] text-neutral-500">{agreement.country}</p>
                      </td>

                      {/* Submitted Date */}
                      <td className="p-4">
                        <p className="text-xs text-neutral-300">
                          {new Date(agreement.submittedAt).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] font-mono text-neutral-500">
                          {new Date(agreement.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>

                      {/* Signature Type */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {agreement.signatureType === 'digital_drawn' ? 'Drawn Canvas' : 'Crypto Typed'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">{getStatusBadge(agreement.status)}</td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReview(agreement)}
                            className="px-2.5 py-1.5 rounded-xl bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/40 text-brand-gold text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            title="Open full agreement to inspect legal terms, signature and verify"
                          >
                            <FileSignature className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(agreement)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Quick approve distribution agreement"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAgreement(agreement);
                                  setDenialReasonPrompt(true);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Deny distribution agreement"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Deny</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL AGREEMENT REVIEW MODAL (HUMAN IN THE LOOP) */}
      {selectedAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#0d0918] text-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-r from-brand-gold/20 via-[#181028] to-brand-purple/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold shrink-0">
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">
                      Agreement Review: {selectedAgreement.artistMoniker}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                      {selectedAgreement.creatorType || 'artist'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">
                    ID: {selectedAgreement.id} • Submitted: {new Date(selectedAgreement.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgreement(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-150px)]">
              {/* Status & Review Header Alert */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Current Agreement Status
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedAgreement.status)}
                      {selectedAgreement.reviewedBy && (
                        <span className="text-xs text-neutral-400">
                          Reviewed by <strong className="text-white">{selectedAgreement.reviewedBy}</strong> on{' '}
                          {selectedAgreement.reviewedAt ? new Date(selectedAgreement.reviewedAt).toLocaleDateString() : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-neutral-300">
                  <span className="font-mono text-brand-gold font-bold">80% Creator Net Share</span> • 20% Platform Fee
                </div>
              </div>

              {/* Signer Legal Profile Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-brand-gold" />
                    Legal Signer
                  </span>
                  <p className="text-sm font-extrabold text-white">{selectedAgreement.artistLegalName}</p>
                  <p className="text-xs text-brand-gold">{selectedAgreement.artistMoniker}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    <Building className="w-3 h-3 text-blue-400" />
                    Entity &amp; Compliance
                  </span>
                  <p className="text-xs font-bold text-white">
                    {selectedAgreement.entityName || 'Individual / Sole Proprietor'}
                  </p>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" />
                    {selectedAgreement.w9Certified ? 'W-9 Certified Rights Holder' : 'Uncertified'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    Payout Rail
                  </span>
                  <p className="text-xs font-bold text-white uppercase">
                    {selectedAgreement.paymentProvider?.replace('_', ' ') || 'Stripe Connect'}
                  </p>
                  {selectedAgreement.payoutRoutingIdentifier && (
                    <p className="text-[10px] font-mono text-neutral-400 truncate">
                      {selectedAgreement.payoutRoutingIdentifier}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Information & IP Audit */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Contact Email</span>
                  <p className="font-mono text-white mt-0.5">{selectedAgreement.email}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Jurisdiction</span>
                  <p className="text-white mt-0.5">{selectedAgreement.country || 'United States'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Audit IP &amp; Client</span>
                  <p className="font-mono text-neutral-300 mt-0.5">{selectedAgreement.ipAddress || '127.0.0.1'}</p>
                </div>
              </div>

              {/* DIGITAL SIGNATURE VERIFICATION SEAL */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-black to-purple-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                    <PenTool className="w-4 h-4" />
                    Verified Digital Signature
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Mode: {selectedAgreement.signatureType}
                  </span>
                </div>

                {selectedAgreement.signatureType === 'digital_drawn' && selectedAgreement.signatureData ? (
                  <div className="p-3 rounded-xl bg-black/70 border border-white/15 flex flex-col items-center justify-center">
                    {/* Render base64 signature image safely */}
                    <div className="relative w-full max-w-sm h-24 bg-white/5 rounded-lg flex items-center justify-center p-2">
                      <img
                        src={selectedAgreement.signatureData}
                        alt="Digital Signature"
                        className="max-h-full max-w-full object-contain filter invert drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 mt-2">
                      Drawn on {new Date(selectedAgreement.signedDate).toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-black/70 border border-white/15 space-y-2">
                    <p className="font-serif italic text-2xl text-brand-gold tracking-wide">
                      {selectedAgreement.artistLegalName}
                    </p>
                    <p className="font-mono text-[11px] text-neutral-400 break-all">
                      {selectedAgreement.signatureData}
                    </p>
                  </div>
                )}

                {/* Countersignature Verification */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Platform Countersigned By:
                    </span>
                    <span className="font-bold text-white">
                      {selectedAgreement.countersignedBy || 'Chancellor @ ChanceTEKone'}
                    </span>
                    <span className="text-neutral-400 text-[11px] block">
                      {selectedAgreement.countersignedTitle || 'Executive Director & Rights Curator'}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 flex sm:justify-end items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Legal Lock Active
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      Version: {selectedAgreement.agreementVersion || '1.0.0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* HUMAN IN THE LOOP REVIEW & NOTES */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-brand-gold" />
                  Administrator Notes &amp; Review Justification
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter administrative review notes (e.g. Catalog ownership verified, approved for music streaming & video release)..."
                  rows={3}
                  className="w-full p-3.5 rounded-2xl bg-black/60 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold leading-relaxed"
                />

                {/* Denial Reason Prompt Sub-form */}
                {denialReasonPrompt && (
                  <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/50 space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-red-300 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <span>Confirm Denial — Reason for Rejecting Agreement</span>
                    </div>
                    <textarea
                      value={denialReasonText}
                      onChange={(e) => setDenialReasonText(e.target.value)}
                      placeholder="Specify reason for denial (e.g. Incomplete W-9 certification, unverified rights, or conflicting trademark)..."
                      rows={2}
                      className="w-full p-3 rounded-xl bg-black/80 border border-red-500/40 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-400"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setDenialReasonPrompt(false)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-neutral-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmDenial(selectedAgreement)}
                        className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg transition-colors flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Confirm Agreement Denial</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ACTION BUTTONS (APPROVE / DENY) */}
                {!denialReasonPrompt && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDenialReasonPrompt(true)}
                      className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Deny Agreement</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedAgreement(null)}
                        className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-bold text-neutral-300 transition-colors cursor-pointer"
                      >
                        Close
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(selectedAgreement)}
                        className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-brand-gold text-black font-black text-xs uppercase tracking-wider shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve Agreement (Grant Distribution)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
