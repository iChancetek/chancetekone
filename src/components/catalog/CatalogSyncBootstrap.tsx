'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { CloudCatalogClient } from '@/lib/catalog/CloudCatalogClient';

/**
 * CatalogSyncBootstrap connects the active authentication identity
 * to the shared CloudCatalogClient.
 *
 * It initiates the background sync loop (polling + realtime meta-doc listener)
 * and keeps the writer status updated whenever the user logs in or out.
 */
export function CatalogSyncBootstrap() {
  const { profile, user } = useAuth();
  const email = profile?.email || user?.email || null;

  useEffect(() => {
    CloudCatalogClient.start();
  }, []);

  useEffect(() => {
    CloudCatalogClient.setIdentity(email);
  }, [email]);

  return null;
}
