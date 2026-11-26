'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Music, Video, Library, Menu, X, ChevronDown, ChevronUp, Disc3 } from 'lucide-react';
import { useSidebar } from '@/lib/navigation/SidebarContext';
import { usePlayer } from '@/lib/player/PlayerContext';

export const MobileNav: React.FC<{ onOpenAI?: () => void }> = () => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isMobileOpen,
    closeMobileSidebar,
    toggleMobileSidebar,
    isMobileNavHidden,
    setMobileNavHidden,
    toggleMobileNavHidden,
    isMobilePlayerHidden,
    setMobilePlayerHidden,
  } = useSidebar();
  const { currentTrack, isPlayerVisible, isPlaying } = usePlayer();
  const [mounted, setMounted] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const hasActiveTrack = Boolean(currentTrack && isPlayerVisible);
  const isPlayerDockedVisible = hasActiveTrack && !isMobilePlayerHidden;

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
    if (deltaY > 24) {
      setMobileNavHidden(true);
    }
  };

  if (!mounted) return null;

  const showFloatingRestoreCorner =
    !isMobileOpen && (isMobileNavHidden || (hasActiveTrack && isMobilePlayerHidden));

  const mobileNavNode = (
    <>
      {/* Unobtrusive Bottom-Right Corner Restore Pills (NEVER blocks center of song list!) */}
      {showFloatingRestoreCorner && (
        <div
          style={{
            position: 'fixed',
            right: '0.625rem',
            bottom: isPlayerDockedVisible
              ? 'calc(6.5rem + env(safe-area-inset-bottom))'
              : !isMobileNavHidden
                ? 'calc(4.35rem + env(safe-area-inset-bottom))'
                : 'calc(0.5rem + env(safe-area-inset-bottom))',
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
          }}
          className="md:hidden z-[45] flex items-center gap-1.5"
        >
          {hasActiveTrack && isMobilePlayerHidden && (
            <button
              type="button"
              onClick={() => setMobilePlayerHidden(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0b0b16]/92 border border-brand-gold/60 text-brand-gold text-[11px] font-extrabold shadow-[0_6px_20px_rgba(0,0,0,0.8)] active:scale-95 transition-all cursor-pointer touch-manipulation"
              title="Show Music Player"
              aria-label="Show Music Player"
            >
              <Disc3 className={`w-3.5 h-3.5 text-brand-gold ${isPlaying ? 'animate-spin-slow' : ''}`} />
              <span>Player</span>
            </button>
          )}

          {isMobileNavHidden && (
            <button
              type="button"
              onClick={() => setMobileNavHidden(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0b0b16]/92 border border-white/25 text-white text-[11px] font-bold shadow-[0_6px_20px_rgba(0,0,0,0.8)] active:scale-95 transition-all cursor-pointer touch-manipulation"
              title="Show Bottom Menu Bar"
              aria-label="Show Bottom Menu Bar"
            >
              <ChevronUp className="w-3.5 h-3.5 text-brand-gold" />
              <span>Menu</span>
            </button>
          )}
        </div>
      )}

      {/* Viewport-Locked Bottom Navigation Bar (Portaled to body so iOS/Android PWA NEVER scrolls it!) */}
      <nav
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-hidden={isMobileNavHidden}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          transform: isMobileNavHidden ? 'translate3d(0, 115%, 0)' : 'translate3d(0, 0, 0)',
          WebkitTransform: isMobileNavHidden ? 'translate3d(0, 115%, 0)' : 'translate3d(0, 0, 0)',
        }}
        className={`md:hidden h-[calc(3.85rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-white/[0.12] z-40 px-1 flex items-center justify-around bg-[#07070e]/98 shadow-[0_-10px_30px_rgba(0,0,0,0.88)] transition-transform duration-200 ease-out ${
          isMobileNavHidden ? 'pointer-events-none invisible' : 'pointer-events-auto visible'
        }`}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={(e) => handleNavClick(e, item.href)}
              className={`relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all touch-manipulation min-w-[44px] min-h-[44px] justify-center ${
                isActive && !isMobileOpen
                  ? 'text-brand-gold bg-brand-gold/10'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {isActive && !isMobileOpen && (
                <span className="absolute top-0 w-5 h-[2px] rounded-full bg-brand-gold shadow-[0_0_8px_#f5c344]" />
              )}
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Compact Menu Drawer Toggle */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all cursor-pointer touch-manipulation min-w-[44px] min-h-[44px] justify-center ${
            isMobileOpen
              ? 'text-brand-gold bg-brand-gold/10 font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
          title={isMobileOpen ? 'Close Menu' : 'Open Menu'}
          aria-label={isMobileOpen ? 'Close Menu' : 'Open Menu'}
        >
          {isMobileOpen ? (
            <X className="w-[18px] h-[18px] text-brand-gold" />
          ) : (
            <Menu className="w-[18px] h-[18px]" />
          )}
          <span className="text-[10px] font-semibold leading-none">Menu</span>
        </button>

        {/* Built-in 1-Tap Hide Menu Bar Button */}
        <button
          type="button"
          onClick={toggleMobileNavHidden}
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-neutral-400 hover:text-brand-gold active:text-brand-gold transition-all cursor-pointer touch-manipulation min-w-[44px] min-h-[44px] justify-center"
          title="Hide Bottom Menu Bar"
          aria-label="Hide Bottom Menu Bar"
        >
          <ChevronDown className="w-[18px] h-[18px] text-brand-gold" />
          <span className="text-[10px] font-semibold leading-none">Hide</span>
        </button>
      </nav>
    </>
  );

  return createPortal(mobileNavNode, document.body);
};
