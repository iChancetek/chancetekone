import type { Metadata } from 'next';
import { resolveShareMetadataById } from '@/lib/sharing/shareMetadataService';

export async function generateMetadata({
  params,
}: {
  params: any;
}): Promise<Metadata> {
  try {
    const resolvedParams = params ? await Promise.resolve(params) : {};
    const id = (resolvedParams as any)?.id || '';
    const meta = resolveShareMetadataById('playlist', id);
    const rawCover = meta?.coverUrl || '/images/genres/rnb-neo-soul.jpg';
    const image = rawCover.startsWith('http')
      ? rawCover
      : `https://chancetekone.us${rawCover}`;

    return {
      title: `${meta.title} — ${meta.creator}`,
      description: meta.description,
      openGraph: {
        title: `${meta.title} — ${meta.creator}`,
        description: meta.description,
        type: 'website',
        url: meta.canonicalUrl || `https://chancetekone.us/playlists/${id}`,
        images: [
          {
            url: image,
            alt: `${meta.title} on ChanceTEK One`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${meta.title} — ${meta.creator}`,
        description: meta.description,
        images: [image],
      },
    };
  } catch {
    return {
      title: 'ChanceTEK One — Member Playlist',
      description: 'Stream curated member playlists on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream curated member playlists on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream curated member playlists on ChanceTEK One.',
      },
    };
  }
}

export default function PlaylistDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
