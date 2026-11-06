import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { PlayerProvider } from '@/lib/player/PlayerContext';
import { CartProvider } from '@/lib/commerce/CartContext';
import { AIProvider } from '@/lib/ai/AIContext';
import { PWAProvider } from '@/lib/pwa/PWAContext';
import { AppShellClient } from './AppShellClient';
import { CatalogSyncBootstrap } from '@/components/catalog/CatalogSyncBootstrap';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08080c' },
    { media: '(prefers-color-scheme: light)', color: '#08080c' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  applicationName: '8 Of Spades Works',
  title: {
    default: '8 Of Spades Works — Agentic AI Entertainment Platform',
    template: '%s · 8 Of Spades Works',
  },
  description:
    'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation with 8 Of Spades Works.',
  openGraph: {
    title: '8 Of Spades Works — Agentic AI Entertainment Platform',
    description:
      'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation.',
    siteName: '8 Of Spades Works',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '8 Of Spades Works — Agentic AI Entertainment Platform',
    description:
      'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation.',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '8 Of Spades Works',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#08080c] text-neutral-100 min-h-screen antialiased selection:bg-brand-purple selection:text-white">
        <PWAProvider>
          <AuthProvider>
            <CatalogSyncBootstrap />
            <PlayerProvider>
              <CartProvider>
                <AIProvider>
                  <AppShellClient>{children}</AppShellClient>
                </AIProvider>
              </CartProvider>
            </PlayerProvider>
          </AuthProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
