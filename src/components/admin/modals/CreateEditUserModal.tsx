'use client';

import React, { useState, useEffect } from 'react';
import { AdminUserRecord, AdminRole, UserAccountStatus } from '@/types/admin';
import { AdminUserManager } from '@/lib/admin/AdminUserManager';
import { X, UserPlus, CheckCircle2 } from 'lucide-react';

interface CreateEditUserModalProps {
  userToEdit: AdminUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const CreateEditUserModal: React.FC<CreateEditUserModalProps> = ({
  userToEdit,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole | 'user' | 'creator'>('user');
  const [status, setStatus] = useState<UserAccountStatus>('active');
  const [country, setCountry] = useState('United States');
  const [city, setCity] = useState('Austin');

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setStatus(userToEdit.status);
      setCountry(userToEdit.createdLocation.country);
      setCity(userToEdit.createdLocation.city);
    } else {
      setName('');
      setEmail('');
      setRole('user');
      setStatus('active');
      setCountry('United States');
      setCity('Austin');
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    if (userToEdit) {
      AdminUserManager.updateUser(userToEdit.id, {
        name,
        email,
        role,
        status,
      });
    } else {
      AdminUserManager.createUser({
        name,
        email,
        role,
        status,
        country,
        city,
      });
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel border border-brand-purple/40 bg-[#0d0d16] shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-gold" />
            <h3 className="text-base font-bold text-white">
              {userToEdit ? `Edit User: ${userToEdit.name}` : 'Create Platform User / Admin'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marcus Breakmaster"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@breakbeats.io"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-[#141224] border border-white/10 text-white focus:border-brand-gold focus:outline-none"
              >
                <option value="user">Platform User</option>
                <option value="creator">Verified Creator</option>
                <option value="support_admin">Support Admin</option>
                <option value="content_admin">Content Admin</option>
                <option value="music_manager">Music Manager</option>
                <option value="analytics_admin">Analytics Admin</option>
                <option value="moderator">Moderator</option>
                <option value="agentic_ai">Agentic AI Agent</option>
                <option value="admin">Administrator</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-[#141224] border border-white/10 text-white focus:border-brand-gold focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
          </div>

          {!userToEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-brand-gold focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-gold to-brand-amber text-black font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {userToEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
