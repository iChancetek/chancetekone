'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  FileSignature,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Printer,
  ExternalLink,
  DollarSign,
  User,
  Scale,
  BadgeCheck,
} from 'lucide-react';
import {
  DistributionAgreementService,
  SignedDistributionAgreement,
} from '@/lib/agreements/DistributionAgreementService';
import { useAuth } from '@/lib/auth/AuthContext';

interface ViewDistributionAgreementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ViewDistributionAgreementsModal({
  isOpen,
  onClose,
}: ViewDistributionAgreementsModalProps) {
  const { profile } = useAuth();
  const [agreements, setAgreements] = useState<SignedDistributionAgreement[]>([]);
  const [selectedAgreement, setSelectedAgreement] = useState<SignedDistributionAgreement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAgreements = async () => {
    // 1. Load from local client service
    const local = DistributionAgreementService.getSubmittedAgreements();
    
    // 2. Try fetching from server API
    try {
      const res = await fetch('/api/agreements/submit').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.agreements)) {
          // Merge unique by id
          const map = new Map<string, SignedDistributionAgreement>();
          local.forEach((a) => map.set(a.id, a));
          data.agreements.forEach((a: SignedDistributionAgreement) => map.set(a.id, a));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          );
          setAgreements(merged);
          return;
        }
      }
    } catch {}

    setAgreements(local);
  };

  useEffect(() => {
    if (isOpen) {
      loadAgreements();
      const unsub = DistributionAgreementService.subscribe(() => {
        loadAgreements();
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = agreements.filter((a) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.artistLegalName.toLowerCase().includes(q) ||
      a.artistMoniker.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  const handleUpdateStatus = (id: string, status: SignedDistributionAgreement['status']) => {
    DistributionAgreementService.updateAgreementStatus(
      id,
      status,
      undefined,
      { id: profile?.id || 'usr-admin', name: profile?.name || 'Administrator' }
    );
    loadAgreements();
    if (selectedAgreement && selectedAgreement.id === id) {
      setSelectedAgreement({ ...selectedAgreement, status });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#0c0915] text-white shadow-2xl overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-brand-gold/15 via-black to-brand-purple/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Artist &amp; Creator Distribution Agreements</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                  80/20 Royalties
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Official onboarding records executed by artists and creators for music, video, audiobooks, and merchandise.
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

        {/* Search and Filter Bar */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4 bg-white/[0.02]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by artist moniker, legal name, email, or agreement ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold/50"
            />
          </div>

          <span className="text-xs text-neutral-400 font-mono">
            Total Executed: <strong className="text-white">{agreements.length}</strong>
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {agreements.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 space-y-3 bg-white/[0.02] rounded-2xl border border-white/5">
              <Scale className="w-10 h-10 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-white">No Signed Agreements Found Yet</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                When creators visit the footer link and submit the Artist/Creator Distribution Agreement, their executed covenants and digital signatures will appear here.
              </p>
              <div className="pt-2">
                <a
                  href="/distribution-agreement"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-gold hover:underline font-bold"
                >
                  <span>Open Agreement Page in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-brand-gold/40 transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">{item.artistMoniker}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Legal: <span className="text-neutral-200">{item.artistLegalName}</span>
                        {item.entityName && ` (${item.entityName})`}
                      </p>
                    </div>

                    <span className="text-[10px] text-brand-gold font-mono font-bold bg-brand-gold/10 px-2 py-1 rounded-lg border border-brand-gold/20">
                      {item.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-300 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-mono">Email:</span>
                      <span className="truncate block">{item.email}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-mono">Payment Routing:</span>
                      <span className="capitalize block">{item.paymentProvider.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-mono">Execution Date:</span>
                      <span className="block">{item.signedDate}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase font-mono">Tax W-9 Certified:</span>
                      <span className={item.w9Certified ? 'text-emerald-400 font-bold' : 'text-neutral-400'}>
                        {item.w9Certified ? 'Certified' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Signature display */}
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-mono block mb-1">
                      Signatory Digital Record:
                    </span>
                    {item.signatureType === 'digital_drawn' ? (
                      <div className="p-2 rounded-xl bg-black border border-white/10 inline-block">
                        <img src={item.signatureData} alt="Signature" className="max-h-12" />
                      </div>
                    ) : (
                      <p className="font-serif italic text-brand-gold text-sm font-bold bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 inline-block">
                        /{item.signatureData}/
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'verified_active')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] border border-emerald-500/40"
                      >
                        Verify &amp; Activate
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'under_review')}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 font-bold text-[11px]"
                      >
                        Review
                      </button>
                    </div>

                    <a
                      href="/distribution-agreement"
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-400 hover:text-white flex items-center gap-1"
                    >
                      <span>Form</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-brand-gold" />
            <span>Governed by the State of New York · 80% Creator Net Royalties</span>
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
