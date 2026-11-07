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
    const meta = resolveShareMetadataById('song', id);
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
        url: meta.canonicalUrl || `https://chancetekone.us/music/${id}`,
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
      title: 'ChanceTEK One — Master Track',
      description: 'Stream master breakbeat music and audio on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream master breakbeat music and audio on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [{ url: 'https://chancetekone.us/images/chancetek_banner.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream master breakbeat music and audio on ChanceTEK One.',
        images: ['https://chancetekone.us/images/chancetek_banner.png'],
      },
    };
  }
}

export default function TrackDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
