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
            alt: `${meta.title} on ChanceTEKone`,
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
      title: 'ChanceTEKone — Curated Playlist Crate',
      description: 'Stream curated member playlists and breakbeat crates on ChanceTEKone.',
      openGraph: {
        title: 'ChanceTEKone',
        description: 'Stream curated member playlists and breakbeat crates on ChanceTEKone.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [{ url: 'https://chancetekone.us/images/return_of_the_break_beats_master.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEKone',
        description: 'Stream curated member playlists and breakbeat crates on ChanceTEKone.',
        images: ['https://chancetekone.us/images/return_of_the_break_beats_master.png'],
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
