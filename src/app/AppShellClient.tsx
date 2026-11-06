'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/navigation/Sidebar';
import { TopNav } from '@/components/navigation/TopNav';
import { MobileNav } from '@/components/navigation/MobileNav';
import { GlobalMusicPlayer } from '@/components/player/GlobalMusicPlayer';
import { PWARegister } from '@/components/pwa/PWARegister';
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner';
import { Footer } from '@/components/navigation/Footer';
import { SidebarProvider, useSidebar } from '@/lib/navigation/SidebarContext';
import { AccessibilityProvider } from '@/lib/accessibility/AccessibilityContext';
import { usePlayer } from '@/lib/player/PlayerContext';
import { useAI } from '@/lib/ai/AIContext';
import { X } from 'lucide-react';

const FullScreenPlayer = dynamic(
  () => import('@/components/player/FullScreenPlayer').then((m) => m.FullScreenPlayer),
  { ssr: false }
);
const BreakBeatsAssistant = dynamic(
  () => import('@/components/ai/BreakBeatsAssistant').then((m) => m.BreakBeatsAssistant),
  { ssr: false }
);
const CartDrawer = dynamic(
  () => import('@/components/commerce/CartDrawer').then((m) => m.CartDrawer),
  { ssr: false }
);
const VideoPlayer = dynamic(
  () => import('@/components/player/VideoPlayer').then((m) => m.VideoPlayer),
  { ssr: false }
);
const AccessibilityControlsModal = dynamic(
  () => import('@/components/accessibility/AccessibilityControlsModal').then((m) => m.AccessibilityControlsModal),
  { ssr: false }
);

const AppShellInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOpen: isAIOpen, closeAI, openAI } = useAI();
  const { isPlayerCollapsed, isPlayerVisible, currentTrack, activeVideoModal, closeVideoModal } = usePlayer();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex flex-col bg-[#08080c] relative">
      {/* Ambient background glows for glassmorphic depth across all pages */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-purple/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-brand-gold/10 rounded-full blur-[128px]" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-brand-violet/15 rounded-full blur-[140px]" />
      </div>

      {/* Fixed Left Sidebar (Desktop) */}
      <Sidebar />

      {/* Main Viewport Container with dynamic padding based on sidebar state */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:pl-20' : 'md:pl-72'
        }`}
      >
        {/* Fixed Top Navigation Bar */}
        <TopNav onOpenAI={() => openAI()} />

        {/* Dynamic Page Content */}
        <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top))] px-4 sm:px-6 md:px-8 max-w-7xl w-full mx-auto pb-8">
          {children}
        </main>

        {/* Global Page Footer */}
        <div
          className={`transition-all duration-300 ${
            !currentTrack || !isPlayerVisible || isPlayerCollapsed ? 'pb-24 md:pb-10' : 'pb-44 md:pb-32'
          }`}
        >
          <Footer />
        </div>
      </div>

      {/* Persistent Audio Player (Bottom) */}
      <GlobalMusicPlayer />

      {/* Mobile Tab Navigation */}
      <MobileNav onOpenAI={() => openAI()} />

      {/* Full-Screen Immersive Player */}
      <FullScreenPlayer onAskAI={(prompt) => openAI(prompt)} />

      {/* Video Modal Player (for mixed playlists & direct video triggers) */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in">
          <div className="relative w-full max-w-5xl rounded-3xl overflow-hidden glass-panel border border-brand-purple/40 bg-[#0a0a12] shadow-[0_25px_80px_rgba(0,0,0,0.9)]">
            <div className="p-4 flex items-center justify-between border-b border-white/10 bg-[#12121e]">
              <div>
                <h3 className="text-sm font-bold text-white truncate max-w-xl">
                  {activeVideoModal.title}
                </h3>
                <p className="text-xs text-brand-neon">{activeVideoModal.artistName}</p>
              </div>
              <button
                onClick={closeVideoModal}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Close Video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <VideoPlayer video={activeVideoModal} />
            </div>
          </div>
        </div>
      )}

      {/* Floating Agentic AI Assistant */}
      <BreakBeatsAssistant isOpen={isAIOpen} onClose={closeAI} />

      {/* Merchandise Cart Drawer */}
      <CartDrawer />

      {/* Text & Font Visibility Accessibility Controls Modal */}
      <AccessibilityControlsModal />

      {/* PWA Service Worker Auto-Registration & Updates */}
      <PWARegister />

      {/* PWA Cross-Platform Install Banner */}
      <PWAInstallBanner />
    </div>
  );
};

export const AppShellClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AccessibilityProvider>
      <SidebarProvider>
        <AppShellInner>{children}</AppShellInner>
      </SidebarProvider>
    </AccessibilityProvider>
  );
};
