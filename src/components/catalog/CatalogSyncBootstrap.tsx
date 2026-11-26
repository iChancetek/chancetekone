'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';
import { PlaylistService } from '@/lib/playlist/PlaylistService';

/**
 * CatalogSyncBootstrap connects the active authentication identity
 * to the shared CloudCatalogClient and PlaylistService cloud sync.
 *
 * It initiates the background sync loops (polling + realtime meta-doc listener)
 * and keeps the writer/viewer identities updated whenever the user logs in or out.
 */
export function CatalogSyncBootstrap() {
  const { profile, user, isAdmin } = useAuth();
  const email = profile?.email || user?.email || null;
  const userId = profile?.id || user?.uid || undefined;

  useEffect(() => {
    CloudCatalogClient.start();
    PlaylistService.startCloudSync();
  }, []);

  useEffect(() => {
    CloudCatalogClient.setIdentity(email);
    PlaylistService.setSyncIdentity({
      userId,
      email: email || undefined,
      isAdmin,
    });
  }, [email, userId, isAdmin]);

  return null;
}
