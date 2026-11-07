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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] glass-panel border-t border-white/10 z-50 px-2 flex items-center justify-around bg-[#0c0c14]/95">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePath === item.href || (item.href !== '/' && activePath.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={(e) => handleNavClick(e, item.href)}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all touch-manipulation min-w-[44px] min-h-[44px] justify-center ${
              isActive && !isMobileOpen ? 'text-brand-gold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}

      {/* AI Assistant Quick Trigger */}
      <button
        onClick={() => {
          if (isMobileOpen) closeMobileSidebar();
          onOpenAI?.();
        }}
        className="flex flex-col items-center gap-1 py-1 px-2 text-brand-neon cursor-pointer touch-manipulation min-w-[44px] min-h-[44px] justify-center"
        title="ChanceTEK One AI"
      >
        <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
        <span className="text-[10px] font-semibold">AI</span>
      </button>

      {/* Dedicated Menu Drawer Toggle (Full access to all features) */}
      <button
        onClick={toggleMobileSidebar}
        className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer touch-manipulation min-w-[44px] min-h-[44px] justify-center ${
          isMobileOpen
            ? 'text-brand-gold font-bold scale-105'
            : 'text-neutral-400 hover:text-white'
        }`}
        title={isMobileOpen ? 'Close Menu' : 'Open Full Menu'}
        aria-label={isMobileOpen ? 'Close Menu' : 'Open Full Menu'}
      >
        {isMobileOpen ? (
          <X className="w-4 h-4 text-brand-gold" />
        ) : (
          <Menu className="w-4 h-4" />
        )}
        <span className="text-[10px] font-medium">Menu</span>
      </button>
    </nav>
  );
};

