'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Music,
  Video,
  BookOpen,
  Mic,
  Users,
  Disc3,
  ListMusic,
  ShoppingBag,
  Sparkles,
  Heart,
  History,
  Radio,
  Library,
  Download,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Info,
  Type,
  Sliders,
  FolderKanban,
  Compass,
  Share2,
  ExternalLink,
  X,
  LogOut,
  FileText,
  FileSignature,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAI } from '@/lib/ai/AIContext';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { usePWA } from '@/lib/pwa/PWAContext';
import { useSidebar } from '@/lib/navigation/SidebarContext';
import { useAccessibility } from '@/lib/accessibility/AccessibilityContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isExternal?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Music', href: '/music', icon: Music },
  { label: 'Videos', href: '/videos', icon: Video },
  { label: 'Audiobooks', href: '/audiobooks', icon: BookOpen },
  { label: 'Podcasts', href: '/podcasts', icon: Mic },
  { label: 'Artists', href: '/artists', icon: Users },
  { label: 'Producers', href: '/producers', icon: Sliders },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Albums', href: '/albums', icon: Disc3 },
  { label: 'Playlists', href: '/playlists', icon: ListMusic },
  { label: 'Brands & Collections', href: '/merch', icon: ShoppingBag, badge: 'By Members' },
  { label: 'The Fam... Famio', href: 'https://famio.us', icon: Share2, isExternal: true, badge: 'Social Media' },
  { label: 'AI Radio', href: '/radio', icon: Radio, badge: 'NEW' },
];

const LIBRARY_ITEMS = [
  { label: 'Your Library', href: '/library', icon: Library },
  { label: 'Account Profile & Settings', href: '/profile', icon: UserIcon },
  { label: 'Creator Studio', href: '/studio', icon: Sparkles, badge: 'Studio' },
  { label: 'Liked Tracks', href: '/library?tab=liked', icon: Heart },
  { label: 'Listening History', href: '/library?tab=history', icon: History },
];

const INFO_ITEMS = [
  { label: 'Advertisement', href: '/advertisement', icon: Radio, badge: 'ChanceTEK' },
  { label: 'Membership Plans', href: '/membership', icon: Sparkles, badge: 'VIP' },
  { label: 'About Platform', href: '/about', icon: Compass },
  { label: 'Learn More', href: '/learn-more', icon: Info },
  { label: 'Support Center', href: '/support', icon: HelpCircle },
  { label: 'Terms of Service', href: '/terms', icon: FileText },
  { label: 'Privacy Policy', href: '/privacy', icon: ShieldAlert },
  { label: 'Artist Agreement', href: '/distribution-agreement', icon: FileSignature, badge: 'Sign' },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isAdmin, signInAsDemo, signOut } = useAuth();
  const { openAI } = useAI();
  const { isInstallable, installPWA } = usePWA();
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();
  const { openModal: openAccessibilityModal, fontScale } = useAccessibility();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPendingHref(null);
    if (navWatchdogRef.current) {
      clearTimeout(navWatchdogRef.current);
      navWatchdogRef.current = null;
    }
  }, [pathname]);

  const handleIntentPrefetch = useCallback(
    (href: string, isExternal?: boolean) => {
      if (isExternal || !href.startsWith('/') || prefetchedSetRef.current.has(href)) return;
      prefetchedSetRef.current.add(href);
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    },
    [router]
  );

  const handleMenuNavigate = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string, isExternal?: boolean, fromMobileDrawer = false) => {
      if (isExternal) {
        if (fromMobileDrawer) closeMobileSidebar();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();

      const targetPathOnly = href.split('?')[0];
      const currentFull =
        typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : pathname;

      if (currentFull === href || (pathname === href && !href.includes('?'))) {
        setPendingHref(null);
        if (fromMobileDrawer) closeMobileSidebar();
        return;
      }

      setPendingHref(href);
      if (fromMobileDrawer) {
        setTimeout(() => closeMobileSidebar(), 40);
      }

      try {
        router.push(href);
      } catch {
        if (typeof window !== 'undefined') {
          window.location.assign(href);
          return;
        }
      }

      if (typeof window !== 'undefined') {
        if (navWatchdogRef.current) clearTimeout(navWatchdogRef.current);
        const startFull = `${window.location.pathname}${window.location.search}`;
        navWatchdogRef.current = setTimeout(() => {
          const nowFull = `${window.location.pathname}${window.location.search}`;
          if (nowFull === startFull && window.location.pathname !== targetPathOnly) {
            window.location.assign(href);
          }
        }, 900);
      }
    },
    [pathname, router, closeMobileSidebar]
  );

  const activePath = pendingHref ? pendingHref.split('?')[0] : pathname;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP & LANDSCAPE SIDEBAR (>= md)                                    */}
      {/* ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col h-[100dvh] fixed top-0 left-0 glass-panel border-r border-white/5 z-50 bg-[#0c0c14]/95 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-72'
          }`}
      >
        {/* Brand Header with Toggle */}
        <div
          className={`p-3 border-b border-white/5 flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'
            }`}
        >
          <Link
            href="/"
            prefetch={false}
            onClick={(e) => handleMenuNavigate(e, '/', false, false)}
            className="group flex items-center gap-2 transition-transform hover:scale-105"
          >
            {isCollapsed ? (
              <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-brand-gold/40 shadow-lg">
                <Image src="/logo.png" alt="ChanceTEK One" fill sizes="36px" className="object-cover" priority />
              </div>
            ) : (
              <div className="relative w-40 h-11">
                <Image
                  src="/logo.png"
                  alt="ChanceTEK One"
                  fill
                  sizes="160px"
                  className="object-contain drop-shadow-[0_0_15px_rgba(245,195,68,0.4)]"
                  priority
                />
              </div>
            )}
          </Link>

          {/* Sidebar Collapse Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer touch-manipulation"
            title={isCollapsed ? 'Expand Sidebar (Show Labels)' : 'Collapse Sidebar (More Screen Space)'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-brand-gold" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Sections with Momentum Touch Scrolling and bottom clearance */}
        <div className="flex-1 touch-scroll-y px-2.5 py-3 space-y-5 pb-28">
          {/* Discover Menu */}
          <div>
            {!isCollapsed && (
              <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Discover
              </div>
            )}
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  !item.isExternal &&
                  (activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href)));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    target={item.isExternal ? '_blank' : undefined}
                    rel={item.isExternal ? 'noopener noreferrer' : undefined}
                    onMouseEnter={() => handleIntentPrefetch(item.href, item.isExternal)}
                    onTouchStart={() => handleIntentPrefetch(item.href, item.isExternal)}
                    onClick={(e) => handleMenuNavigate(e, item.href, item.isExternal, false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center touch-manipulation ${isCollapsed ? 'justify-center p-2.5' : 'justify-between gap-3 px-3 py-2'
                      } rounded-xl text-xs font-medium transition-all ${isActive
                        ? 'bg-gradient-to-r from-brand-purple/40 to-brand-violet/20 text-white border border-brand-purple/50 shadow-sm'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 mr-1.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-gold' : 'text-neutral-400 group-hover:text-white'}`} />
                      {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-bold border border-brand-gold/30 shrink-0 ml-auto whitespace-nowrap">
                        {item.badge}
                      </span>
                    )}

                    {!isCollapsed && item.isExternal && !item.badge && (
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-brand-gold transition-colors shrink-0 ml-1.5 opacity-60 group-hover:opacity-100" />
                    )}

                    {/* Tooltip in Collapsed Mode */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-white/10 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Your Library Menu */}
          <div>
            {!isCollapsed && (
              <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Your Space
              </div>
            )}
            <nav className="space-y-0.5">
              {LIBRARY_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = (pendingHref || pathname) === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onMouseEnter={() => handleIntentPrefetch(item.href)}
                    onTouchStart={() => handleIntentPrefetch(item.href)}
                    onClick={(e) => handleMenuNavigate(e, item.href, false, false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center touch-manipulation ${isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                      } rounded-xl text-xs font-medium transition-all ${isActive
                        ? 'bg-white/10 text-white border border-white/10'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Icon className="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}

                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-white/10 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}

              {/* Quick Create Playlist Shortcut */}
              <Link
                href="/playlists"
                prefetch={false}
                onMouseEnter={() => handleIntentPrefetch('/playlists')}
                onTouchStart={() => handleIntentPrefetch('/playlists')}
                onClick={(e) => handleMenuNavigate(e, '/playlists', false, false)}
                title={isCollapsed ? 'Create Playlist' : undefined}
                className={`group relative flex items-center touch-manipulation ${isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                  } rounded-xl text-xs font-black bg-gradient-to-r from-[#ffd700]/15 to-[#f59e0b]/15 hover:from-[#ffd700] hover:to-[#f59e0b] text-brand-gold hover:text-black border border-brand-gold/40 hover:border-white shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all`}
              >
                <ListMusic className="w-4 h-4 text-brand-gold group-hover:text-black shrink-0" />
                {!isCollapsed && <span>+ Create Playlist</span>}

                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-brand-gold/40 text-brand-gold text-[11px] font-bold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    + Create Playlist
                  </div>
                )}
              </Link>

              {/* Admin Operations shortcut for Super Users */}
              {isAdmin && (
                <Link
                  href="/admin"
                  prefetch={false}
                  onMouseEnter={() => handleIntentPrefetch('/admin')}
                  onTouchStart={() => handleIntentPrefetch('/admin')}
                  onClick={(e) => handleMenuNavigate(e, '/admin', false, false)}
                  title={isCollapsed ? 'Operations Center (Super Admin)' : undefined}
                  className={`group relative flex items-center touch-manipulation ${isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
                    } rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 border border-red-500/30 hover:border-red-500/60 transition-all`}
                >
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                  {!isCollapsed && <span>Admin Ops</span>}

                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-red-950 border border-red-500/40 text-red-200 text-[11px] font-bold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                      Admin Operations Center
                    </div>
                  )}
                </Link>
              )}
            </nav>
          </div>

          {/* Info & Support Menu */}
          <div>
            {!isCollapsed && (
              <div className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Platform & Support
              </div>
            )}
            <nav className="space-y-0.5">
              {INFO_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onMouseEnter={() => handleIntentPrefetch(item.href)}
                    onTouchStart={() => handleIntentPrefetch(item.href)}
                    onClick={(e) => handleMenuNavigate(e, item.href, false, false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center touch-manipulation ${isCollapsed ? 'justify-center p-2.5' : 'justify-start gap-2.5 px-3 py-2'
                      } rounded-xl text-xs font-medium transition-all ${isActive
                        ? 'bg-gradient-to-r from-brand-purple/40 to-brand-violet/20 text-white border border-brand-purple/50 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-gold' : 'text-neutral-400 group-hover:text-white'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}

                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-white/10 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}

              {/* Accessibility & Font Size Controls Button */}
              <button
                onClick={openAccessibilityModal}
                title={isCollapsed ? `Text Size (${fontScale}%)` : undefined}
                className={`group relative flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                  } rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all w-full cursor-pointer`}
              >
                <div className="flex items-center gap-2.5">
                  <Type className="w-4 h-4 shrink-0 text-brand-gold" />
                  {!isCollapsed && <span>Text Size</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-brand-gold font-mono font-bold">
                    {fontScale}%
                  </span>
                )}

                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-brand-gold/30 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    Text Size ({fontScale}%)
                  </div>
                )}
              </button>
            </nav>
          </div>

          {/* AI Assistant Quick Card / Icon Trigger */}
          {isCollapsed ? (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => openAI()}
                className="group relative p-2.5 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-gold text-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
                title="Open ChanceTEK One AI Assistant"
              >
                <Sparkles className="w-4 h-4 text-brand-gold animate-spin-slow" />
                <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-[#141224] border border-brand-purple/40 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                  ChanceTEK One AI
                </div>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-purple/30 via-brand-dark to-brand-gold/10 border border-brand-purple/40 space-y-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center text-black">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">ChanceTEK One AI</p>
                  <p className="text-[10px] text-brand-neon font-medium">Agentic Assistant</p>
                </div>
              </div>
              <p className="text-[11px] text-neutral-300 leading-snug">
                Crate digger & culture assistant with dual memory.
              </p>
              <button
                onClick={() => openAI()}
                className="w-full py-1.5 px-3 rounded-xl bg-brand-purple/50 hover:bg-brand-purple text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-brand-gold" />
                Ask AI Assistant
              </button>
            </div>
          )}

          {/* PWA Install Card (when applicable) */}
          {isInstallable && !isCollapsed && (
            <div className="p-2.5 rounded-2xl bg-white/5 border border-brand-gold/30 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                  <Download className="w-3 h-3" />
                </div>
                <p className="text-[11px] font-bold text-white">Install App</p>
              </div>
              <p className="text-[9px] text-neutral-400 leading-tight">
                Standalone audio & lock-screen controls.
              </p>
              <button
                onClick={installPWA}
                aria-label="Install ChanceTEK One App"
                className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,195,68,0.5)] hover:shadow-[0_0_22px_rgba(245,195,68,0.8)] border border-amber-200/60 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[3] text-[#08080c]" />
                <span>Install</span>
              </button>
            </div>
          )}
        </div>

        {/* User Footer Profile */}
        <div className="p-2.5 border-t border-white/5 bg-[#08080c]/60">
          {profile ? (
            <div
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'
                } p-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-brand-gold/40 transition-all`}
              title={isCollapsed ? `${profile.name} — Account Profile & Settings` : undefined}
            >
              <Link
                href="/profile"
                className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-90 transition-opacity"
              >
                <UserAvatar
                  avatarUrl={profile.avatarUrl}
                  videoUrl={profile.profileVideoUrl}
                  name={profile.name}
                  size="sm"
                  borderClassName="border border-brand-gold/50"
                />
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-white truncate hover:text-brand-gold transition-colors">
                      {profile.name}
                    </p>
                    <p className="text-[10px] text-brand-gold truncate">
                      {profile.role === 'admin' ? 'Super Admin' : profile.role || 'Member'}
                    </p>
                  </div>
                )}
              </Link>

              {!isCollapsed && (
                <button
                  onClick={signOut}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            !isCollapsed && (
              <button
                onClick={signInAsDemo}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-brand-purple text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                Demo Session
              </button>
            )
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. FULL MOBILE & PORTRAIT TABLET SLIDE-OVER DRAWER                        */}
      {/* ========================================================================= */}
      {/* Backdrop */}
      <div
        onClick={closeMobileSidebar}
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] transition-opacity duration-200 touch-manipulation ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        aria-hidden={!isMobileOpen}
      />

      {/* Slide Drawer Panel */}
      <aside
        className={`fixed inset-y-0 left-0 w-[88vw] sm:w-96 max-w-sm glass-panel border-r border-white/10 z-[80] bg-[#0c0c16]/98 flex flex-col h-[100dvh] shadow-[0_0_50px_rgba(0,0,0,0.9)] transition-transform duration-200 ease-out ${isMobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
          }`}
        aria-label="Mobile Navigation Menu"
      >
        {/* Mobile Drawer Header */}
        <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 flex items-center justify-between bg-[#10101c]/80">
          <Link
            href="/"
            prefetch={false}
            onClick={(e) => handleMenuNavigate(e, '/', false, true)}
            className="flex items-center gap-2.5 transition-transform active:scale-95 touch-manipulation"
          >
            <div className="relative w-36 h-10">
              <Image
                src="/logo.png"
                alt="ChanceTEK One"
                fill
                sizes="144px"
                className="object-contain drop-shadow-[0_0_15px_rgba(245,195,68,0.4)]"
                priority
              />
            </div>
          </Link>

          {/* Close Button with generous touch target */}
          <button
            onClick={closeMobileSidebar}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-neutral-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer touch-manipulation"
            title="Close Menu"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Mobile Drawer Scrollable Body */}
        <div className="flex-1 touch-scroll-y px-3 py-4 space-y-6 pb-28">
          {/* Discover Section */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
              <span>Discover</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  !item.isExternal &&
                  (activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href)));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    target={item.isExternal ? '_blank' : undefined}
                    rel={item.isExternal ? 'noopener noreferrer' : undefined}
                    onMouseEnter={() => handleIntentPrefetch(item.href, item.isExternal)}
                    onTouchStart={() => handleIntentPrefetch(item.href, item.isExternal)}
                    onClick={(e) => handleMenuNavigate(e, item.href, item.isExternal, true)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation ${isActive
                        ? 'bg-gradient-to-r from-brand-purple/40 to-brand-violet/20 text-white border border-brand-purple/50 shadow-sm'
                        : 'text-neutral-200 hover:text-white hover:bg-white/5 active:bg-white/10'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 mr-1.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-gold' : 'text-neutral-400'}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold font-bold border border-brand-gold/30 shrink-0 ml-auto whitespace-nowrap">
                        {item.badge}
                      </span>
                    )}

                    {item.isExternal && !item.badge && (
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Your Space Section */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
              <span>Your Space</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <nav className="space-y-1">
              {LIBRARY_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = (pendingHref || pathname) === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onMouseEnter={() => handleIntentPrefetch(item.href)}
                    onTouchStart={() => handleIntentPrefetch(item.href)}
                    onClick={(e) => handleMenuNavigate(e, item.href, false, true)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation ${isActive
                        ? 'bg-white/10 text-white border border-white/15'
                        : 'text-neutral-200 hover:text-white hover:bg-white/5 active:bg-white/10'
                      }`}
                  >
                    <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {/* Create Playlist Button */}
              <Link
                href="/playlists"
                prefetch={false}
                onMouseEnter={() => handleIntentPrefetch('/playlists')}
                onTouchStart={() => handleIntentPrefetch('/playlists')}
                onClick={(e) => handleMenuNavigate(e, '/playlists', false, true)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#ffd700]/20 to-[#f59e0b]/20 active:from-[#ffd700] active:to-[#f59e0b] text-brand-gold active:text-black border border-brand-gold/40 shadow-sm transition-all mt-1 touch-manipulation"
              >
                <ListMusic className="w-4 h-4 text-brand-gold shrink-0" />
                <span>+ Create Playlist</span>
              </Link>

              {/* Admin Operations shortcut for Super Users */}
              {isAdmin && (
                <Link
                  href="/admin"
                  prefetch={false}
                  onMouseEnter={() => handleIntentPrefetch('/admin')}
                  onTouchStart={() => handleIntentPrefetch('/admin')}
                  onClick={(e) => handleMenuNavigate(e, '/admin', false, true)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 border border-red-500/40 active:border-red-500/70 transition-all mt-1 touch-manipulation"
                >
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                  <span>Admin Operations Center</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Platform & Support Section */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <span>Platform & Support</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <nav className="space-y-1">
              {INFO_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onMouseEnter={() => handleIntentPrefetch(item.href)}
                    onTouchStart={() => handleIntentPrefetch(item.href)}
                    onClick={(e) => handleMenuNavigate(e, item.href, false, true)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation ${isActive
                        ? 'bg-gradient-to-r from-brand-purple/40 to-brand-violet/20 text-white border border-brand-purple/50 shadow-sm'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5 active:bg-white/10'
                      }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-gold' : 'text-neutral-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {/* Accessibility Font Scale Modal Trigger */}
              <button
                onClick={() => {
                  closeMobileSidebar();
                  openAccessibilityModal();
                }}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/5 active:bg-white/10 transition-all w-full cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Type className="w-4 h-4 shrink-0 text-brand-gold" />
                  <span>Text Size & Legibility</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-brand-gold font-mono font-bold">
                  {fontScale}%
                </span>
              </button>
            </nav>
          </div>

          {/* ChanceTEK One AI Assistant Interactive Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-purple/30 via-brand-dark to-brand-gold/10 border border-brand-purple/40 space-y-2 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center text-black">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">ChanceTEK One AI</p>
                <p className="text-[10px] text-brand-neon font-medium">Agentic Assistant</p>
              </div>
            </div>
            <p className="text-xs text-neutral-300 leading-snug">
              Crate digger & culture assistant with dual memory.
            </p>
            <button
              onClick={() => {
                closeMobileSidebar();
                openAI();
              }}
              className="w-full py-2 px-3 rounded-xl bg-brand-purple hover:bg-brand-violet active:scale-98 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
              Ask AI Assistant
            </button>
          </div>

          {/* PWA Cross-Platform Install Action */}
          {isInstallable && (
            <div className="p-3 rounded-2xl bg-white/5 border border-brand-gold/40 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Install Application</p>
                  <p className="text-[10px] text-neutral-400">Lock-screen audio & offline playback</p>
                </div>
              </div>
              <button
                onClick={() => {
                  closeMobileSidebar();
                  installPWA();
                }}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,195,68,0.5)] active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[3] text-[#08080c]" />
                <span>Install ChanceTEK One</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Drawer Footer with User Profile & Sign Out */}
        <div className="p-3.5 border-t border-white/10 bg-[#08080c]/90 pb-safe">
          {profile ? (
            <div className="flex items-center justify-between p-2 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-gold/40 transition-all">
              <Link
                href="/profile"
                onClick={closeMobileSidebar}
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
              >
                <UserAvatar
                  avatarUrl={profile.avatarUrl}
                  videoUrl={profile.profileVideoUrl}
                  name={profile.name}
                  size="sm"
                  borderClassName="border border-brand-gold/50"
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-white truncate hover:text-brand-gold transition-colors">
                    {profile.name}
                  </p>
                  <p className="text-[10px] text-brand-gold truncate">
                    {profile.role === 'admin' ? 'Super Admin' : profile.role || 'Member'}
                  </p>
                </div>
              </Link>

              <button
                onClick={() => {
                  signOut();
                  closeMobileSidebar();
                }}
                title="Sign Out"
                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 active:bg-red-500/30 text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1 text-xs cursor-pointer ml-1"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                signInAsDemo();
                closeMobileSidebar();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet active:scale-98 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand-gold" />
              Demo Session
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
