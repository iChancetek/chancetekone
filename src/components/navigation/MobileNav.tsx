'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Music, Video, Sparkles, Library, Menu, X } from 'lucide-react';
import { useSidebar } from '@/lib/navigation/SidebarContext';

export const MobileNav: React.FC<{ onOpenAI?: () => void }> = ({ onOpenAI }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobileOpen, closeMobileSidebar, toggleMobileSidebar } = useSidebar();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4.25rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-white/[0.1] z-50 px-2 flex items-center justify-around bg-[#07070e]/96 shadow-[0_-12px_36px_rgba(0,0,0,0.85)]">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={(e) => handleNavClick(e, item.href)}
            className={`relative flex flex-col items-center gap-1 py-1.5 px-2.5 rounded-2xl transition-all touch-manipulation min-w-[48px] min-h-[46px] justify-center ${
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
        onClick={() => {
          if (isMobileOpen) closeMobileSidebar();
          onOpenAI?.();
        }}
        className="flex flex-col items-center gap-1 py-1.5 px-2.5 rounded-2xl bg-brand-purple/20 border border-brand-purple/35 text-brand-neon cursor-pointer touch-manipulation min-w-[48px] min-h-[46px] justify-center shadow-[0_0_16px_rgba(157,78,221,0.3)]"
        title="ChanceTEK One AI"
      >
        <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
        <span className="text-[11px] font-bold text-white">AI</span>
      </button>

      {/* Dedicated Menu Drawer Toggle (Full access to all features) */}
      <button
        onClick={toggleMobileSidebar}
        className={`flex flex-col items-center gap-1 py-1.5 px-2.5 rounded-2xl transition-all cursor-pointer touch-manipulation min-w-[48px] min-h-[46px] justify-center ${
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
  );
};

