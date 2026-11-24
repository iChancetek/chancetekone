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
    { media: '(prefers-color-scheme: dark)', color: '#050509' },
    { media: '(prefers-color-scheme: light)', color: '#050509' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  applicationName: 'ChanceTEK One',
  title: {
    default: 'ChanceTEK One — Agentic AI Entertainment Platform',
    template: '%s · ChanceTEK One',
  },
  description:
    'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation with ChanceTEK One.',
  openGraph: {
    title: 'ChanceTEK One — Agentic AI Entertainment Platform',
    description:
      'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation.',
    siteName: 'ChanceTEK One',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChanceTEK One — Agentic AI Entertainment Platform',
    description:
      'Experience next-generation breakbeat music, 4K videos, audiobooks, exclusive vinyl merch, and Agentic AI curation.',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ChanceTEK One',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-[#050509] text-neutral-100 min-h-screen antialiased selection:bg-brand-purple/80 selection:text-white"
      >
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
