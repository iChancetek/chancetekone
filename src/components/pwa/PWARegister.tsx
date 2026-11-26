'use client';

import React, { useEffect } from 'react';

const CHUNK_RECOVERY_KEY = 'chancetekone_chunk_reload_ts';
const SW_RELOAD_KEY = 'chancetekone_sw_reload_ts';

/**
 * Silent background PWA Service Worker registration & self-healing chunk recovery.
 * Zero visual popups (no "Platform Updated / Reload" or "Install" dialogue boxes).
 */
export const PWARegister: React.FC = () => {
  useEffect(() => {
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let cleanupListeners: () => void = () => {};

    // Self-healing stale chunk / hydration mismatch recovery for installed iPhone & Android PWAs
    const recoverFromStaleChunk = () => {
      try {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || '0');
        if (Date.now() - lastReload < 30_000) return;
        sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));
      } catch {
        return;
      }

      const doReload = () => window.location.reload();
      if ('caches' in window) {
        caches
          .keys()
          .then((names) => Promise.all(names.map((n) => caches.delete(n))))
          .finally(doReload);
      } else {
        doReload();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      const msg = String(event?.message || '');
      const target = event?.target as HTMLElement | null;
      const isFailedChunkScript =
        target &&
        target.tagName === 'SCRIPT' &&
        typeof (target as HTMLScriptElement).src === 'string' &&
        (target as HTMLScriptElement).src.includes('/_next/static/');

      if (
        isFailedChunkScript ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        recoverFromStaleChunk();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event?.reason?.message || event?.reason || '');
      if (
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        recoverFromStaleChunk();
      }
    };

    window.addEventListener('error', handleWindowError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

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
        return () => {
          window.removeEventListener('error', handleWindowError, true);
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
      }

      const hadController = Boolean(navigator.serviceWorker.controller);
      const onControllerChange = () => {
        if (!hadController) return;
        try {
          const last = Number(sessionStorage.getItem(SW_RELOAD_KEY) || '0');
          if (Date.now() - last < 30_000) return;
          sessionStorage.setItem(SW_RELOAD_KEY, String(Date.now()));
        } catch {
          return;
        }
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          const activateWaitingSilently = () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          };

          const checkForUpdate = () => registration.update().catch(() => {});
          checkForUpdate();
          activateWaitingSilently();

          updateTimer = setInterval(checkForUpdate, 5 * 60 * 1000);
          const onVisible = () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          };
          document.addEventListener('visibilitychange', onVisible);
          window.addEventListener('focus', checkForUpdate);
          window.addEventListener('online', checkForUpdate);
          cleanupListeners = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', checkForUpdate);
            window.removeEventListener('online', checkForUpdate);
          };

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
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
      window.removeEventListener('error', handleWindowError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
};
