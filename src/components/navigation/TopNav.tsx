'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  Mic,
  Download,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ArrowLeft,
} from 'lucide-react';
import { useCart } from '@/lib/commerce/CartContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePWA } from '@/lib/pwa/PWAContext';
import { useSidebar } from '@/lib/navigation/SidebarContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { GlobalVoiceSearchModal } from '@/components/navigation/GlobalVoiceSearchModal';
import { AccessibilityButton } from '@/components/accessibility/AccessibilityButton';

export const TopNav: React.FC<{ onOpenAI?: () => void }> = ({ onOpenAI }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const { profile, isAdmin, signOut } = useAuth();
  const { isInstallable, installPWA } = usePWA();
  const { isCollapsed, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/music');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      <header
        className={`h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] fixed top-0 right-0 left-0 glass-panel border-b border-white/5 z-30 px-3 md:px-6 flex items-center justify-between gap-3 bg-[#08080c]/90 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:left-20' : 'md:left-72'
        }`}
      >
        {/* Left Side: Back Navigation Button, Mobile Menu Button, Desktop Collapse Toggle & Natural Search */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Universal Back Navigation Arrow Button (Navigates to previous page across all pages) */}
          <button
            onClick={handleGoBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-brand-gold hover:text-white border border-white/10 transition-all hover:scale-105 shrink-0 flex items-center justify-center cursor-pointer min-w-[40px] min-h-[40px] md:min-w-[44px] md:min-h-[44px] touch-manipulation group"
            title="Go Back to Previous Page"
            aria-label="Go Back to Previous Page"
          >
            <ArrowLeft className="w-5 h-5 text-brand-gold group-hover:text-white transition-colors" />
          </button>

          {/* Mobile Drawer Hamburger Button (Visible on phones & vertical mobile viewports) */}
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-brand-gold hover:text-white border border-white/10 transition-colors shrink-0 flex items-center justify-center cursor-pointer min-w-[44px] min-h-[44px] touch-manipulation"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-brand-gold" />
          </button>

          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar Menu' : 'Collapse Sidebar Menu'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-brand-gold" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Global Natural Language Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search: "90s boom bap with heavy horn samples" or track...'
                className="w-full pl-10 pr-10 py-2 rounded-full bg-white/5 border border-white/10 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple text-xs md:text-sm text-white placeholder-neutral-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setIsVoiceSearchOpen(true)}
                title="Whisper Voice Search & Agent Commands"
                className="absolute right-2.5 p-1 rounded-full text-brand-gold hover:text-white hover:bg-brand-purple/30 transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* PWA Install Trigger */}
          {isInstallable && (
            <button
              onClick={installPWA}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-brand-gold text-xs font-semibold border border-brand-gold/30 hover:border-brand-gold/60 transition-all hover:scale-105"
              title="Install Break Beats Application"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Text & Font Visibility Accessibility Trigger */}
          <AccessibilityButton variant="nav" />

          {/* Break Beats AI Assistant Button */}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-purple/80 to-brand-violet hover:from-brand-purple hover:to-brand-gold text-white text-xs font-semibold shadow-sm transition-all border border-brand-neon/40 hover:scale-105"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
            <span className="hidden sm:inline">Break Beats AI</span>
          </button>

          {/* Shopping Cart Trigger */}
          <button
            onClick={openCart}
            className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5 transition-all"
            title="Merch Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-gold text-black text-[10px] font-bold flex items-center justify-center shadow-md animate-bounce">
                {itemCount}
              </span>
            )}
          </button>

          {/* User Account / Profile */}
          <div className="relative">
            {profile ? (
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-2 p-1 rounded-full bg-white/5 hover:bg-white/10 border transition-all ${
                  isAdmin ? 'border-red-500/60 ring-2 ring-red-500/20' : 'border-white/10'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    isAdmin
                      ? 'bg-gradient-to-tr from-red-600 to-brand-gold'
                      : 'bg-brand-purple/40 border border-brand-gold'
                  }`}
                >
                  {profile.name[0]}
                </div>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet hover:scale-105 text-white text-xs font-bold border border-white/10 transition-all shadow-md"
              >
                Sign In
              </button>
            )}

            {/* Profile Dropdown Menu */}
            {showProfileMenu && profile && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl glass-panel border border-white/10 p-2 shadow-2xl space-y-1 bg-[#12121c] z-50">
                <div className="px-3 py-2 border-b border-white/5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate">{profile.name}</p>
                    {isAdmin && (
                      <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold border border-red-500/30">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate">{profile.email}</p>
                </div>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Operations Center</span>
                  </Link>
                )}

                <Link
                  href="/studio"
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Creator Studio</span>
                </Link>

                <Link
                  href="/library"
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full block text-left px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Your Library
                </Link>

                <button
                  onClick={() => {
                    signOut();
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Full Dual-Mode Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Whisper Global Voice Search & Command Modal */}
      <GlobalVoiceSearchModal
        isOpen={isVoiceSearchOpen}
        onClose={() => setIsVoiceSearchOpen(false)}
      />
    </>
  );
};
