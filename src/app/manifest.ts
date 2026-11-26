import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ChanceTEK One',
    short_name: 'ChanceTEK One',
    description:
      'The Algorithm of Timeless Music. ChanceTEK One Music Streaming, 4K Video Sessions, Cultural Audiobooks, Podcasts & Merchandise Operating System.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080c',
    theme_color: '#08080c',
    orientation: 'any',
    scope: '/',
    id: 'chancetek-one-pwa',
    categories: ['music', 'entertainment', 'audio'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      {
        src: '/images/chancetekone_icon.png?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
    shortcuts: [
      {
        name: 'Stream Music',
        short_name: 'Music',
        description: 'Stream curated tracks, albums, and studio masters',
        url: '/music',
      },
      {
        name: '4K Video Sessions',
        short_name: 'Videos',
        description: 'Watch 4K studio sessions and cultural documentaries',
        url: '/videos',
      },
      {
        name: 'Audiobooks',
        short_name: 'Audiobooks',
        description: 'Explore cultural history and narrated audiobooks',
        url: '/audiobooks',
      },
      {
        name: 'Playlists',
        short_name: 'Playlists',
        description: 'Create and enjoy member playlists',
        url: '/playlists',
      },
    ],
  };
}
