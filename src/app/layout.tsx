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
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://chancetekone.us'),
  applicationName: 'ChanceTEK One',
  title: {
    default: 'ChanceTEK One — Listen. Watch. Discover.',
    template: '%s · ChanceTEK One',
  },
  description:
    'Listen. Watch. Discover. Experience next-generation music, 4K videos, audiobooks, podcasts, exclusive vinyl merch, and Agentic AI curation with ChanceTEK One.',
  keywords: [
    'ChanceTEK One',
    'Listen. Watch. Discover.',
    'Music Streaming',
    '4K Videos',
    'Audiobooks',
    'Podcasts',
    'AI Radio',
    'Independent Artists',
  ],
  icons: {
    icon: '/images/chancetekone_icon.png',
    shortcut: '/images/chancetekone_icon.png',
    apple: '/images/chancetekone_icon.png',
  },
  openGraph: {
    title: 'ChanceTEK One — Listen. Watch. Discover.',
    description:
      'Listen. Watch. Discover. Experience next-generation music, 4K videos, audiobooks, podcasts, exclusive vinyl merch, and Agentic AI curation.',
    siteName: 'ChanceTEK One',
    url: 'https://chancetekone.us',
    type: 'website',
    images: [
      {
        url: '/images/chancetekone_logo.jpg',
        width: 1200,
        height: 675,
        alt: 'ChanceTEK One — Listen. Watch. Discover.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChanceTEK One — Listen. Watch. Discover.',
    description:
      'Listen. Watch. Discover. Experience next-generation music, 4K videos, audiobooks, podcasts, exclusive vinyl merch, and Agentic AI curation.',
    images: ['/images/chancetekone_logo.jpg'],
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
