import type { Metadata } from 'next';
import { lookupTrackForShareMetadata } from '@/lib/server/shareTrackLookup';

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

    return {
      title: `${fullTitle} | ChanceTEK One`,
      description: resolved.description,
      openGraph: {
        title: fullTitle,
        description: resolved.description,
        siteName: 'ChanceTEK One',
        type: 'music.song',
        url: `${resolved.origin}/music/${encodeURIComponent(id)}`,
        images: [
          {
            url: resolved.ogImageUrl,
            secureUrl: resolved.ogImageUrl,
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
        images: [resolved.ogImageUrl],
      },
      other: {
        'og:image:secure_url': resolved.ogImageUrl,
      },
    };
  } catch {
    return {
      title: 'ChanceTEK One — Master Track',
      description: 'Stream master music and audio on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream master music and audio on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream master music and audio on ChanceTEK One.',
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
