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
    const meta = resolveShareMetadataById('podcast', id);
    const rawCover = meta?.coverUrl || '/images/genres/hip-hop.jpg';
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
        url: meta.canonicalUrl || `https://chancetekone.us/podcasts/${id}`,
        images: [
          {
            url: image,
            alt: `${meta.title} hosted by ${meta.creator}`,
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
      title: 'ChanceTEK One — Master Podcast Series',
      description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [{ url: 'https://chancetekone.us/images/return_of_the_break_beats_master.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
        images: ['https://chancetekone.us/images/return_of_the_break_beats_master.png'],
      },
    };
  }
}

export default function PodcastDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
