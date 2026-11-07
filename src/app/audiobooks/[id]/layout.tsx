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
    const meta = resolveShareMetadataById('audiobook', id);
    const rawCover = meta?.coverUrl || '/images/audiobooks/famio.jpg';
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
        url: meta.canonicalUrl || `https://chancetekone.us/audiobooks/${id}`,
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
      title: 'ChanceTEKone — Spoken Literature & Audiobooks',
      description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEKone.',
      openGraph: {
        title: 'ChanceTEKone',
        description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEKone.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [{ url: 'https://chancetekone.us/images/return_of_the_break_beats_master.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEKone',
        description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEKone.',
        images: ['https://chancetekone.us/images/return_of_the_break_beats_master.png'],
      },
    };
  }
}

export default function AudiobookDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
