'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  isMobileNavHidden: boolean;
  toggleMobileNavHidden: () => void;
  setMobileNavHidden: (hidden: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
  isMobileOpen: false,
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
  toggleMobileSidebar: () => {},
  isMobileNavHidden: false,
  toggleMobileNavHidden: () => {},
  setMobileNavHidden: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileNavHidden, setIsMobileNavHiddenState] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('breakbeats_sidebar_collapsed');
      if (stored !== null) {
        setIsCollapsedState(stored === 'true');
      }
      const storedMobileNav = localStorage.getItem('chancetek_mobile_nav_hidden');
      if (storedMobileNav !== null) {
        setIsMobileNavHiddenState(storedMobileNav === 'true');
      }
    } catch (e) {}
  }, []);

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle Escape key and body scroll locking
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMobileOpen]);

  const toggleSidebar = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('breakbeats_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem('breakbeats_sidebar_collapsed', String(collapsed));
    } catch (e) {}
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const toggleMobileNavHidden = useCallback(() => {
    setIsMobileNavHiddenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chancetek_mobile_nav_hidden', String(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const setMobileNavHidden = useCallback((hidden: boolean) => {
    setIsMobileNavHiddenState(hidden);
    try {
      localStorage.setItem('chancetek_mobile_nav_hidden', String(hidden));
    } catch (e) {}
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setCollapsed,
        isMobileOpen,
        openMobileSidebar,
        closeMobileSidebar,
        toggleMobileSidebar,
        isMobileNavHidden,
        toggleMobileNavHidden,
        setMobileNavHidden,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);

