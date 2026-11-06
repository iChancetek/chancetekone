'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff, X } from 'lucide-react';

export const PWARegister: React.FC = () => {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [dismissedOfflineToast, setDismissedOfflineToast] = useState(false);

  useEffect(() => {
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let cleanupListeners: () => void = () => {};

    // 1. Monitor online/offline network connectivity
    const updateOnlineStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      if (!offline) setDismissedOfflineToast(false);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 2. Register Service Worker in production; unregister and clear caches in development to prevent Turbopack stale chunk errors
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'development') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) {
              caches.delete(name);
            }
          });
        }
        return;
      }

      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          setSwRegistration(registration);

          const checkForUpdate = () => registration.update().catch(() => {});
          checkForUpdate();
          updateTimer = setInterval(checkForUpdate, 5 * 60 * 1000);
          const onVisible = () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          };
          document.addEventListener('visibilitychange', onVisible);
          window.addEventListener('focus', checkForUpdate);
          window.addEventListener('online', checkForUpdate);
          cleanupListeners = () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', checkForUpdate);
            window.removeEventListener('online', checkForUpdate);
          };

          // Check if an update is already waiting
          if (registration.waiting) {
            setUpdateAvailable(true);
          }

          // Listen for new updates discovered in background
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    }

    return () => {
      if (updateTimer) clearInterval(updateTimer);
      cleanupListeners();
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 150);
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      {/* Offline Alert Toast */}
      {isOffline && !dismissedOfflineToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[75] animate-in slide-in-from-top duration-300 pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-red-950/90 border border-red-500/50 backdrop-blur-md shadow-2xl text-xs text-red-200">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold">Offline Mode Active — Playing from local cache</span>
            <button
              onClick={() => setDismissedOfflineToast(true)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-red-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* App Update Available Notification */}
      {updateAvailable && (
        <div className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] md:bottom-28 left-4 right-4 md:right-auto md:left-8 z-[75] animate-in slide-in-from-bottom duration-300 pointer-events-auto">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#141024]/95 border border-brand-gold/60 backdrop-blur-xl shadow-2xl text-xs text-white max-w-sm">
            <div className="p-2 rounded-xl bg-brand-gold/20 text-brand-gold shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">Platform Updated</p>
              <p className="text-[10px] text-neutral-300">Synchronized with newest features & music.</p>
            </div>
            <button
              onClick={handleUpdate}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#f5c344] via-[#ff9f1c] to-[#f5c344] text-[#08080c] font-black text-xs uppercase tracking-wider shrink-0 shadow-[0_0_15px_rgba(245,195,68,0.6)] hover:shadow-[0_0_25px_rgba(245,195,68,0.9)] border border-amber-200/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </>
  );
};
