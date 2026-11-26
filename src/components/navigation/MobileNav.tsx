'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Music, Video, Sparkles, Library, Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useSidebar } from '@/lib/navigation/SidebarContext';
import { usePlayer } from '@/lib/player/PlayerContext';

export const MobileNav: React.FC<{ onOpenAI?: () => void }> = ({ onOpenAI }) => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isMobileOpen,
    closeMobileSidebar,
    toggleMobileSidebar,
    isMobileNavHidden,
    setMobileNavHidden,
    toggleMobileNavHidden,
  } = useSidebar();
  const { currentTrack, isPlayerVisible, isPlayerCollapsed } = usePlayer();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    setPendingHref(null);
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, [pathname]);

  const NAV_ITEMS = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Music', href: '/music', icon: Music },
    { label: 'Videos', href: '/videos', icon: Video },
    { label: 'Library', href: '/library', icon: Library },
  ];

  const activePath = pendingHref || pathname;
  const isExpandedMobilePlayerDocked = Boolean(currentTrack && isPlayerVisible && !isPlayerCollapsed);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (isMobileOpen) closeMobileSidebar();
    if (pathname === href) {
      setPendingHref(null);
      return;
    }
    setPendingHref(href);
    try {
      router.push(href);
    } catch {
      if (typeof window !== 'undefined') {
        window.location.assign(href);
        return;
      }
    }
    if (typeof window !== 'undefined') {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      const startPath = window.location.pathname;
      watchdogRef.current = setTimeout(() => {
        if (window.location.pathname === startPath && window.location.pathname !== href) {
          window.location.assign(href);
        }
      }, 900);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = endY - touchStartYRef.current;
    touchStartYRef.current = null;
    // Swipe down on the bottom bar to smoothly collapse/hide it
    if (deltaY > 28) {
      setMobileNavHidden(true);
    }
  };

  return (
    <>
      {/* Sleek 1-Tap Restore Pill when Bottom Menu Bar is Hidden (auto-hidden when full docked player shows its own restore button) */}
      {isMobileNavHidden && !isExpandedMobilePlayerDocked && !isMobileOpen && (
        <div className="md:hidden fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => setMobileNavHidden(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0b0b16]/95 border border-brand-gold/45 text-brand-gold text-[11px] font-bold shadow-[0_8px_24px_rgba(0,0,0,0.75)] active:scale-95 transition-all cursor-pointer touch-manipulation"
            title="Show Bottom Menu Bar"
            aria-label="Show Bottom Menu Bar"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
        </div>
      )}

      {/* Collapsible Bottom Navigation Bar (Mobile / PWA < md) */}
      <nav
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-hidden={isMobileNavHidden}
        className={`md:hidden fixed bottom-0 left-0 right-0 h-[calc(4.25rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-white/[0.1] z-50 px-1.5 flex items-center justify-around bg-[#07070e]/96 shadow-[0_-12px_36px_rgba(0,0,0,0.85)] transition-transform duration-200 ease-out ${
          isMobileNavHidden ? 'translate-y-full pointer-events-none invisible' : 'translate-y-0 pointer-events-auto visible'
        }`}
      >
        {/* Top-Center Compact Collapse Tab (Hide Menu Bar out of the way of music) */}
        <button
          type="button"
          onClick={toggleMobileNavHidden}
          className="absolute -top-5 left-1/2 -translate-x-1/2 h-5 px-3 rounded-t-xl bg-[#07070e]/96 border-t border-x border-white/15 text-neutral-400 hover:text-brand-gold active:text-brand-gold flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider shadow-md cursor-pointer touch-manipulation"
          title="Hide Menu Bar"
          aria-label="Hide Bottom Menu Bar"
        >
          <ChevronDown className="w-3 h-3 text-brand-gold" />
          <span>Hide</span>
        </button>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={(e) => handleNavClick(e, item.href)}
              className={`relative flex flex-col items-center gap-1 py-1.5 px-2 rounded-2xl transition-all touch-manipulation min-w-[46px] min-h-[46px] justify-center ${
                isActive && !isMobileOpen
                  ? 'text-brand-gold bg-brand-gold/10'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {isActive && !isMobileOpen && (
                <span className="absolute -top-0.5 w-5 h-[2.5px] rounded-full bg-brand-gold shadow-[0_0_10px_#f5c344]" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          );
        })}

        {/* AI Assistant Quick Trigger */}
        <button
          type="button"
          onClick={() => {
            if (isMobileOpen) closeMobileSidebar();
            onOpenAI?.();
          }}
          className="flex flex-col items-center gap-1 py-1.5 px-2 rounded-2xl bg-brand-purple/20 border border-brand-purple/35 text-brand-neon cursor-pointer touch-manipulation min-w-[46px] min-h-[46px] justify-center shadow-[0_0_16px_rgba(157,78,221,0.3)]"
          title="ChanceTEK One AI"
        >
          <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
          <span className="text-[11px] font-bold text-white">AI</span>
        </button>

        {/* Dedicated Menu Drawer Toggle (Full access to all features) */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className={`flex flex-col items-center gap-1 py-1.5 px-2 rounded-2xl transition-all cursor-pointer touch-manipulation min-w-[46px] min-h-[46px] justify-center ${
            isMobileOpen
              ? 'text-brand-gold bg-brand-gold/10 font-bold scale-105'
              : 'text-neutral-400 hover:text-white'
          }`}
          title={isMobileOpen ? 'Close Menu' : 'Open Full Menu'}
          aria-label={isMobileOpen ? 'Close Menu' : 'Open Full Menu'}
        >
          {isMobileOpen ? (
            <X className="w-5 h-5 text-brand-gold" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
          <span className="text-[11px] font-semibold">Menu</span>
        </button>
      </nav>
    </>
  );
};
