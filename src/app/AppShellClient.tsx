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
import { UniversalShareModal } from '@/components/social/UniversalShareModal';
import { X, Share2 } from 'lucide-react';

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
  const [showVideoShare, setShowVideoShare] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#050509] relative">
      {/* Dynamic Spatial Aurora & Studio Micro-Grid Atmosphere (desktop GPU blobs hidden on mobile for smooth 60fps PWA) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="hidden md:block absolute inset-0 spatial-canvas-grid opacity-70" />
        <div className="hidden md:block absolute -top-48 -left-32 w-[540px] h-[540px] bg-brand-purple/14 rounded-full blur-[140px] animate-aurora-slow" />
        <div className="hidden md:block absolute top-1/4 -right-40 w-[500px] h-[500px] bg-brand-gold/10 rounded-full blur-[150px] animate-aurora-reverse" />
        <div className="hidden md:block absolute -bottom-32 left-1/3 w-[560px] h-[420px] bg-cyan-500/[0.06] rounded-full blur-[150px] animate-aurora-slow" />
      </div>

      {/* Fixed Left Sidebar (Desktop) */}
      <Sidebar />

      {/* Main Viewport Container with dynamic padding based on sidebar state */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'md:pl-20' : 'md:pl-72'
          }`}
      >
        {/* Fixed Top Navigation Bar */}
        <TopNav onOpenAI={() => openAI()} />

        {/* Dynamic Page Content */}
        <main className="flex-1 pt-[calc(4.25rem+env(safe-area-inset-top))] px-4 sm:px-6 md:px-8 max-w-7xl w-full mx-auto pb-8">
          {children}
        </main>

        {/* Global Page Footer */}
        <div
          className={`transition-all duration-300 ${!currentTrack || !isPlayerVisible || isPlayerCollapsed ? 'pb-24 md:pb-10' : 'pb-56 md:pb-32'
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
            <div className="p-4 flex items-center justify-between gap-3 border-b border-white/10 bg-[#12121e]">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate max-w-xl">
                  {activeVideoModal.title}
                </h3>
                <p className="text-xs text-brand-neon truncate">{activeVideoModal.artistName}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowVideoShare(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-brand-gold/15 hover:bg-brand-gold/30 text-brand-gold hover:text-white border border-brand-gold/40 text-xs font-bold transition-all cursor-pointer"
                  title="Share playing video"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={closeVideoModal}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Close Video"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-2 sm:p-4">
              <VideoPlayer video={activeVideoModal} />
            </div>
          </div>
          {showVideoShare && (
            <UniversalShareModal
              isOpen={showVideoShare}
              onClose={() => setShowVideoShare(false)}
              entity={{ type: 'video', item: activeVideoModal }}
            />
          )}
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
