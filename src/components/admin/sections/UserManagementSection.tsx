'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AdminUserRecord, UserAccountStatus, AdminRole } from '@/types/admin';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  KeyRound,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  RotateCcw,
  Clock,
  MapPin,
  Eye,
  AlertTriangle,
  LogOut,
  CheckCircle2,
} from 'lucide-react';

interface UserManagementSectionProps {
  users: AdminUserRecord[];
  onOpenUserDetail: (user: AdminUserRecord) => void;
  onOpenCreateUser: () => void;
  onOpenEditUser: (user: AdminUserRecord) => void;
  onOpenPasswordReset: (user: AdminUserRecord) => void;
  onRefresh: () => void;
}

export const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  users,
  onOpenUserDetail,
  onOpenCreateUser,
  onOpenEditUser,
  onOpenPasswordReset,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userToDelete, setUserToDelete] = useState<AdminUserRecord | null>(null);
  const [userToForceLogout, setUserToForceLogout] = useState<AdminUserRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchRole = roleFilter === 'all' || u.role === roleFilter;

    return matchSearch && matchStatus && matchRole;
  });

  const handleToggleStatus = (user: AdminUserRecord, newStatus: UserAccountStatus) => {
    AdminUserManager.setUserStatus(user.id, newStatus);
    onRefresh();
    if (newStatus === 'suspended' || newStatus === 'disabled') {
      setActionFeedback(`Account for "${user.name}" marked as ${newStatus}. All active sessions terminated.`);
    } else {
      setActionFeedback(`Account for "${user.name}" status updated to ${newStatus}.`);
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    const targetName = userToDelete.name;
    AdminUserManager.deleteUser(userToDelete.id);
    setUserToDelete(null);
    onRefresh();
    setActionFeedback(`Account for "${targetName}" deleted. All active sessions terminated.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleConfirmForceLogout = () => {
    if (!userToForceLogout) return;
    const targetName = userToForceLogout.name;
    AdminUserManager.logoutUserSessions(
      userToForceLogout.id,
      'Administrator manually terminated active sessions from user control center'
    );
    setUserToForceLogout(null);
    onRefresh();
    setActionFeedback(`All active sessions for "${targetName}" terminated. Any open tabs were logged out.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const getStatusBadge = (status: UserAccountStatus) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'disabled':
        return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
      case 'suspended':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'deleted':
        return 'bg-red-950/40 text-red-300 border-red-800/40';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'admin':
        return 'bg-brand-purple/20 text-brand-neon border-brand-purple/40';
      case 'music_manager':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'moderator':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'agentic_ai':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'analytics_admin':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'content_admin':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'support_admin':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'creator':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-white/5 text-neutral-300 border-white/10';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Search and Create Button */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-gold" />
              Platform User & Administrator Directory
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Comprehensive role-based access management, account auditing, status controls, and zero-knowledge password resets
            </p>
          </div>

          <button
            onClick={onOpenCreateUser}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Create User / Admin
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-2 border-t border-white/5">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, email, user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          {/* Status & Role Selectors */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
              <option value="deleted">Deleted</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="p-2 rounded-xl bg-[#141224] border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Administrator</option>
              <option value="admin">Administrator</option>
              <option value="analytics_admin">Analytics Admin</option>
              <option value="content_admin">Content Admin</option>
              <option value="support_admin">Support Admin</option>
              <option value="creator">Creator</option>
              <option value="user">Platform User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action feedback banner */}
      {actionFeedback && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{actionFeedback}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Users matching filters ({filteredUsers.length})
          </span>
          <span className="text-xs text-neutral-400 font-mono">Total System Users: {users.length}</span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-3">User & Email</th>
                <th className="py-3 px-3">Assigned Role</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Created Location</th>
                <th className="py-3 px-3 text-right">Streams</th>
                <th className="py-3 px-3 text-right">Merch Spent</th>
                <th className="py-3 px-3 text-right">Last Login</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                  {/* User Profile */}
                  <td className="py-3 px-3 font-sans">
                    <div
                      onClick={() => onOpenUserDetail(u)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900">
                        <Image src={u.avatarUrl} alt={u.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white group-hover:text-brand-gold transition-colors truncate">
                          {u.name}
                        </p>
                        <p className="text-[11px] text-neutral-400 font-mono truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(
                        u.role
                      )}`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                        u.status
                      )}`}
                    >
                      {u.status}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="py-3 px-3 text-neutral-300 font-sans">
                    <div className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-brand-gold shrink-0" />
                      <span className="truncate">
                        {u.createdLocation.city}, {u.createdLocation.country}
                      </span>
                    </div>
                  </td>

                  {/* Streams */}
                  <td className="py-3 px-3 text-right font-bold text-white">
                    {u.stats.songsPlayed.toLocaleString()}
                  </td>

                  {/* Merch Spent */}
                  <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                    ${u.stats.totalSpent.toFixed(2)}
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-3 text-right text-neutral-400 text-[11px]">
                    {new Date(u.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenUserDetail(u)}
                        title="View Full Profile & Timeline"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onOpenPasswordReset(u)}
                        title="Trigger Password Reset"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-purple/30 text-neutral-300 hover:text-brand-neon transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      {/* Force Logout / Terminate Sessions Button */}
                      <button
                        onClick={() => setUserToForceLogout(u)}
                        title="Terminate All Active Sessions (Force Logout)"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/25 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>

                      {u.status !== 'active' ? (
                        <button
                          onClick={() => handleToggleStatus(u, 'active')}
                          title="Activate Account"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u, 'suspended')}
                          title="Suspend Account (Terminates all sessions)"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {u.status !== 'deleted' && (
                        <button
                          onClick={() => setUserToDelete(u)}
                          title="Delete Account"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for Destructive Deletion */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl glass-panel border border-red-500/50 bg-[#120a14] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Account Deletion</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to soft-delete account <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email})? This action will immediately terminate all active sessions and be logged in the immutable audit repository.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase shadow-lg transition-transform hover:scale-105 cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Force Terminating Sessions */}
      {userToForceLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl glass-panel border border-amber-500/50 bg-[#140e08] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <LogOut className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Terminate Active Sessions</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to terminate all active sessions for <strong className="text-white">{userToForceLogout.name}</strong> ({userToForceLogout.email})?
            </p>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-neutral-400 space-y-1">
              <p>• The user will be immediately logged out of all open tabs, windows, and devices.</p>
              <p>• This action is logged in the administrative audit record.</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setUserToForceLogout(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmForceLogout}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Terminate Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
