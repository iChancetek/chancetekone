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
  Sun,
  Moon,
} from 'lucide-react';
import { useCart } from '@/lib/commerce/CartContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePWA } from '@/lib/pwa/PWAContext';
import { useSidebar } from '@/lib/navigation/SidebarContext';
import { useTheme } from '@/lib/theme/ThemeContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { GlobalVoiceSearchModal } from '@/components/navigation/GlobalVoiceSearchModal';
import { AccessibilityButton } from '@/components/accessibility/AccessibilityButton';
import { UserAvatar } from '@/components/navigation/UserAvatar';

export const TopNav: React.FC<{ onOpenAI?: () => void }> = ({ onOpenAI }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const { profile, isAdmin, signOut } = useAuth();
  const { isInstallable, installPWA } = usePWA();
  const { isCollapsed, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { isLight, toggleTheme } = useTheme();
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
        className={`h-[calc(4.25rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] fixed top-0 right-0 left-0 border-b border-white/[0.07] z-30 px-3 md:px-6 flex items-center justify-between gap-3 bg-[#050509]/80 backdrop-blur-2xl shadow-[0_10px_30px_-15px_rgba(0,0,0,0.8)] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:left-20' : 'md:left-72'
        }`}
      >
        {/* Left Side: Back Navigation Button, Mobile Menu Button, Desktop Collapse Toggle & Natural Search */}
        <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
          {/* Universal Back Navigation Arrow Button (Navigates to previous page across all pages) */}
          <button
            onClick={handleGoBack}
            className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] active:bg-white/20 text-brand-gold hover:text-white border border-white/[0.09] hover:border-brand-gold/40 transition-all hover:scale-105 shrink-0 flex items-center justify-center cursor-pointer min-w-[40px] min-h-[40px] md:min-w-[42px] md:min-h-[42px] touch-manipulation group"
            title="Go Back to Previous Page"
            aria-label="Go Back to Previous Page"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-brand-gold group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
          </button>

          {/* Mobile Drawer Hamburger Button (Visible on phones & vertical mobile viewports) */}
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] active:bg-white/20 text-brand-gold hover:text-white border border-white/[0.09] transition-colors shrink-0 flex items-center justify-center cursor-pointer min-w-[42px] min-h-[42px] touch-manipulation"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-brand-gold" />
          </button>

          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex p-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-neutral-300 hover:text-white transition-all shrink-0 cursor-pointer"
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
            <div className="relative flex items-center group">
              <Search className="w-4 h-4 text-neutral-400 group-focus-within:text-brand-gold absolute left-4 pointer-events-none transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search music, 4K cinema, audiobooks, BPMs or vibes...'
                className="w-full pl-11 pr-11 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-[#0e0e18] border border-white/[0.1] focus:border-brand-gold/50 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-xs md:text-sm text-white placeholder-neutral-400 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setIsVoiceSearchOpen(true)}
                title="Whisper Voice Search & Agent Commands"
                className="absolute right-2 p-1.5 rounded-full bg-white/[0.05] hover:bg-brand-purple/40 text-brand-gold hover:text-white transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
          {/* PWA Install Trigger */}
          {isInstallable && (
            <button
              onClick={installPWA}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.05] hover:bg-brand-gold/15 text-brand-gold text-xs font-bold border border-brand-gold/30 hover:border-brand-gold/60 transition-all hover:scale-105 cursor-pointer"
              title="Install Break Beats Application"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Apple Music Light / Dark Mode Switcher */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-neutral-200 hover:text-brand-gold border border-white/[0.09] hover:border-brand-gold/40 transition-all hover:scale-105 cursor-pointer"
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Apple Music Light Mode'}
            aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Apple Music Light Mode'}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-brand-gold" />
            ) : (
              <Sun className="w-4 h-4 text-brand-gold" />
            )}
            <span className="hidden lg:inline text-xs font-bold">
              {isLight ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Text & Font Visibility Accessibility Trigger */}
          <AccessibilityButton variant="nav" />

          {/* ChanceTEK One AI Assistant Button */}
          <button
            onClick={onOpenAI}
            className="shimmer-cta flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-brand-purple via-violet-600 to-indigo-600 hover:from-brand-purple hover:to-brand-gold text-white text-xs font-bold shadow-[0_4px_20px_rgba(157,78,221,0.4)] transition-all border border-white/20 hover:scale-105 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-spin-slow" />
            <span className="hidden sm:inline">ChanceTEK One AI</span>
          </button>

          {/* Shopping Cart Trigger */}
          <button
            onClick={openCart}
            className="relative p-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-neutral-200 hover:text-white border border-white/[0.09] transition-all cursor-pointer"
            title="Merch Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-gold text-[#050509] text-[10px] font-black flex items-center justify-center shadow-[0_0_12px_rgba(245,195,68,0.8)] animate-bounce">
                {itemCount}
              </span>
            )}
          </button>

          {/* User Account / Profile */}
          <div className="relative">
            {profile ? (
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-2 p-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] transition-all cursor-pointer ${
                  isAdmin ? 'ring-2 ring-red-500/40' : 'ring-1 ring-white/15 hover:ring-brand-gold/50'
                }`}
                title={`${profile.name} — Account Profile & Settings`}
              >
                <UserAvatar
                  avatarUrl={profile.avatarUrl}
                  videoUrl={profile.profileVideoUrl}
                  name={profile.name}
                  size="sm"
                  borderClassName={
                    isAdmin
                      ? 'border border-red-500/70'
                      : 'border border-brand-gold/70'
                  }
                />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="shimmer-cta px-4 py-2 rounded-full bg-gradient-to-r from-[#f7cf62] via-brand-gold to-amber-500 hover:scale-105 text-[#050509] text-xs font-extrabold border border-amber-200/40 transition-all shadow-[0_4px_20px_rgba(245,195,68,0.35)] cursor-pointer"
              >
                Sign In
              </button>
            )}

            {/* Profile Dropdown Menu */}
            {showProfileMenu && profile && (
              <div className="absolute right-0 mt-2.5 w-60 rounded-2xl glass-panel border border-white/15 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.9)] space-y-1 bg-[#0c0c16]/98 z-50">
                <Link
                  href="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="px-3 py-2 border-b border-white/5 block hover:bg-white/5 rounded-xl transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      avatarUrl={profile.avatarUrl}
                      videoUrl={profile.profileVideoUrl}
                      name={profile.name}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white truncate group-hover:text-brand-gold transition-colors">
                          {profile.name}
                        </p>
                        {isAdmin && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold border border-red-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400 truncate">{profile.email}</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-brand-gold" />
                  <span>Account Profile & Settings</span>
                </Link>

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
