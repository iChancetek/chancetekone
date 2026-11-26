import type { Metadata } from 'next';
import { lookupAudiobookForShareMetadata } from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const resolved = await lookupAudiobookForShareMetadata(id);
    const pageUrl = `${resolved.origin}/audiobooks/${encodeURIComponent(resolved.id)}`;

    const isWidescreenThumb = resolved.ogImageUrl.includes('OrlandoFigueroa_share') || resolved.ogImageUrl.includes('/video-thumbs/');

    return {
      title: `${resolved.title} — ${resolved.artist}`,
      description: resolved.description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${resolved.title} — ${resolved.artist}`,
        description: resolved.description,
        type: 'book',
        url: pageUrl,
        siteName: 'ChanceTEK One',
        images: [
          {
            url: resolved.ogImageUrl,
            secureUrl: resolved.ogImageUrl,
            type: resolved.ogImageType,
            width: isWidescreenThumb ? 1280 : 1200,
            height: isWidescreenThumb ? 720 : 1200,
            alt: `${resolved.title} by ${resolved.artist}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${resolved.title} — ${resolved.artist}`,
        description: resolved.description,
        images: [
          {
            url: resolved.ogImageUrl,
            alt: `${resolved.title} by ${resolved.artist}`,
          },
        ],
      },
      other: {
        'og:image:secure_url': resolved.ogImageUrl,
        'og:image:type': resolved.ogImageType,
      },
    };
  } catch {
    return {
      title: 'ChanceTEK One — Spoken Literature & Audiobooks',
      description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One — Audiobooks',
        description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us/audiobooks',
        images: [
          {
            url: 'https://chancetekone.us/images/audiobooks/famio.jpg',
            secureUrl: 'https://chancetekone.us/images/audiobooks/famio.jpg',
            type: 'image/jpeg',
            width: 1200,
            height: 1200,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One — Audiobooks',
        description: 'Stream author literature, master audiobooks, and chapter narratives on ChanceTEK One.',
        images: ['https://chancetekone.us/images/audiobooks/famio.jpg'],
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
