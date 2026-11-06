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
    const meta = resolveShareMetadataById('video', id);
    const rawCover = meta?.coverUrl || '/images/genres/hip-hop.jpg';
    const image = rawCover.startsWith('http')
      ? rawCover
      : `https://8ofspadesworks.us${rawCover}`;

    return {
      title: `${meta.title} — ${meta.creator}`,
      description: meta.description,
      openGraph: {
        title: `${meta.title} — ${meta.creator}`,
        description: meta.description,
        type: 'website',
        url: meta.canonicalUrl || `https://8ofspadesworks.us/videos/${id}`,
        images: [
          {
            url: image,
            alt: `${meta.title} by ${meta.creator}`,
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
      title: '8 Of Spades Works — 4K Visual Cinema',
      description: 'Stream pristine 4K music videos, cinema trailers, and reels on 8 OF SPADES WORKS.',
      openGraph: {
        title: '8 Of Spades Works',
        description: 'Stream pristine 4K music videos, cinema trailers, and reels on 8 OF SPADES WORKS.',
        type: 'website',
        url: 'https://8ofspadesworks.us',
        images: [{ url: 'https://8ofspadesworks.us/images/return_of_the_break_beats_master.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: '8 Of Spades Works',
        description: 'Stream pristine 4K music videos, cinema trailers, and reels on 8 OF SPADES WORKS.',
        images: ['https://8ofspadesworks.us/images/return_of_the_break_beats_master.png'],
      },
    };
  }
}

export default function VideoDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
