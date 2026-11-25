import type { Metadata } from 'next';
import { lookupTrackForShareMetadata } from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || '';
    const resolved = await lookupTrackForShareMetadata(id);
    const fullTitle = `${resolved.title} — ${resolved.artist}`;
    const pageUrl = `${resolved.origin}/music/${encodeURIComponent(resolved.id)}`;

    return {
      title: `${fullTitle} | ChanceTEK One`,
      description: resolved.description,
      alternates: {
        canonical: pageUrl,
      },
      openGraph: {
        title: fullTitle,
        description: resolved.description,
        siteName: 'ChanceTEK One',
        type: 'music.song',
        url: pageUrl,
        images: [
          {
            url: resolved.ogImageUrl,
            secureUrl: resolved.ogImageUrl,
            type: resolved.ogImageType,
            width: 1200,
            height: 1200,
            alt: `${resolved.title} by ${resolved.artist}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: fullTitle,
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
      title: 'ChanceTEK One — Listen. Watch. Discover.',
      description: 'Stream master music and audio on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream master music and audio on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [
          {
            url: 'https://chancetekone.us/images/chancetekone_logo.jpg',
            secureUrl: 'https://chancetekone.us/images/chancetekone_logo.jpg',
            type: 'image/jpeg',
            width: 1200,
            height: 675,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream master music and audio on ChanceTEK One.',
        images: ['https://chancetekone.us/images/chancetekone_logo.jpg'],
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
