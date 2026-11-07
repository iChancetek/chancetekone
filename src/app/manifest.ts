import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ChanceTEKone',
    short_name: 'ChanceTEKone',
    description:
      'Agentic AI Breakbeat Streaming, 4K Video Sessions, Cultural Audiobooks, Exclusive Vinyl & Merchandise Operating System.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080c',
    theme_color: '#08080c',
    orientation: 'any',
    scope: '/',
    id: '8-of-spades-works-pwa',
    categories: ['music', 'entertainment', 'audio'],
    lang: 'en',
    dir: 'ltr',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Stream Music',
        short_name: 'Music',
        description: 'Listen to breakbeat tracks, beats, and vinyl cuts',
        url: '/music',
        icons: [{ src: '/logo.png', sizes: '192x192' }],
      },
      {
        name: '4K Video Sessions',
        short_name: 'Videos',
        description: 'Watch 4K studio sessions and scratch masterclasses',
        url: '/videos',
        icons: [{ src: '/logo.png', sizes: '192x192' }],
      },
      {
        name: 'Audiobooks',
        short_name: 'Audiobooks',
        description: 'Explore hip-hop history and sample culture audiobooks',
        url: '/audiobooks',
        icons: [{ src: '/logo.png', sizes: '192x192' }],
      },
      {
        name: 'Breakbeat Crates',
        short_name: 'Playlists',
        description: 'Manage and discover custom curated playlists',
        url: '/playlists',
        icons: [{ src: '/logo.png', sizes: '192x192' }],
      },
    ],
  };
}
