'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AdminUserRecord } from '@/types/admin';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import {
  X,
  Shield,
  MapPin,
  Clock,
  Calendar,
  Music,
  Video,
  BookOpen,
  ShoppingBag,
  Heart,
  Share2,
  KeyRound,
  UserCheck,
  UserX,
  AlertTriangle,
  Sparkles,
  LogOut,
  CheckCircle2,
} from 'lucide-react';

interface UserDetailModalProps {
  user: AdminUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPasswordReset: (user: AdminUserRecord) => void;
  onUserUpdated: () => void;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onOpenPasswordReset,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const timeline = AdminUserManager.getUserActivityTimeline(user.id);

  const handleToggleStatus = (newStatus: 'active' | 'disabled' | 'suspended') => {
    AdminUserManager.setUserStatus(user.id, newStatus);
    onUserUpdated();
    setFeedbackMessage(`User status changed to "${newStatus}".`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleForceLogoutSessions = () => {
    AdminUserManager.logoutUserSessions(
      user.id,
      'Administrator terminated sessions from user details console'
    );
    onUserUpdated();
    setFeedbackMessage(`Terminated all active platform sessions for ${user.name}.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'disabled':
        return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/40';
      case 'suspended':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'deleted':
        return 'bg-red-950/40 text-red-300 border-red-800/40';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl glass-panel border border-brand-purple/40 bg-[#0d0d16] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-gradient-to-r from-brand-purple/20 via-transparent to-brand-gold/10">
          <div className="flex items-center gap-3.5">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-brand-gold/50 shadow-lg shrink-0">
              <Image src={user.avatarUrl} alt={user.name} fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{user.name}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                    user.status
                  )}`}
                >
                  {user.status}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-brand-purple/30 text-brand-neon text-[10px] font-bold border border-brand-purple/40">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-neutral-300 font-mono mt-0.5">{user.email}</p>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-brand-gold" />
                <span>
                  Account Created From:{' '}
                  <strong className="text-neutral-200">
                    {user.createdLocation.city}, {user.createdLocation.region}, {user.createdLocation.country}
                  </strong>{' '}
                  <span className="font-mono text-[10px] text-neutral-400">({user.createdLocation.ip})</span>
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Account Overview & Engagement
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'timeline'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Chronological Activity Timeline ({timeline.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Engagement Stats Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Lifetime Engagement Statistics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-brand-neon" />
                      Platform Time
                    </span>
                    <p className="text-lg font-black text-white font-mono">
                      {Math.floor(user.stats.platformTimeMinutes / 60)}h {user.stats.platformTimeMinutes % 60}m
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Music className="w-3.5 h-3.5 text-brand-gold" />
                      Songs Played
                    </span>
                    <p className="text-lg font-black text-white font-mono">
                      {user.stats.songsPlayed.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-red-400" />
                      Videos Watched
                    </span>
                    <p className="text-lg font-black text-white font-mono">
                      {user.stats.videosWatched.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      Merch Purchases
                    </span>
                    <p className="text-lg font-black text-emerald-400 font-mono">
                      ${user.stats.totalSpent.toFixed(2)} ({user.stats.merchPurchases})
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Metadata Details */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Account Metadata & Session History
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-400">User ID:</span>
                    <p className="font-mono text-white select-all">{user.id}</p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Account Created:</span>
                    <p className="font-mono text-white">
                      {new Date(user.createdAt).toLocaleString('en-US', { timeZoneName: 'short' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Last Login:</span>
                    <p className="font-mono text-white">
                      {new Date(user.lastLogin).toLocaleString('en-US', { timeZoneName: 'short' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-neutral-400">Last Platform Activity:</span>
                    <p className="font-mono text-white">
                      {new Date(user.lastActivity).toLocaleString('en-US', { timeZoneName: 'short' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Administrative Controls
                  </h4>
                  {feedbackMessage && (
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {feedbackMessage}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => onOpenPasswordReset(user)}
                    className="px-4 py-2 rounded-xl bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-brand-gold" />
                    Dispatch Secure Password Reset
                  </button>

                  {/* Force Terminate All User Sessions */}
                  <button
                    onClick={handleForceLogoutSessions}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Terminate All Active Browser Sessions Platform-Wide"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Terminate Active Sessions
                  </button>

                  {user.status !== 'active' ? (
                    <button
                      onClick={() => handleToggleStatus('active')}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Activate Account
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleStatus('disabled')}
                        className="px-4 py-2 rounded-xl bg-neutral-500/20 hover:bg-neutral-500/30 border border-neutral-500/40 text-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Disable Account
                      </button>
                      <button
                        onClick={() => handleToggleStatus('suspended')}
                        className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Suspend Account
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Chronological Activity Timeline */
            <div className="space-y-4">
              <div className="relative border-l-2 border-brand-purple/40 ml-4 space-y-6 py-2">
                {timeline.map((item) => (
                  <div key={item.id} className="relative pl-6 group">
                    {/* Dot on timeline */}
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-brand-dark border-2 border-brand-gold shadow-[0_0_8px_rgba(245,195,68,0.8)]" />

                    <div className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-brand-gold transition-colors">
                          {item.action}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {new Date(item.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300">{item.detail}</p>
                      {item.location && (
                        <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 pt-1">
                          <MapPin className="w-3 h-3 text-brand-neon" />
                          {item.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
