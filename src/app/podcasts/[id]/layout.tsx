import type { Metadata } from 'next';
import { lookupPodcastForShareMetadata } from '@/lib/server/shareTrackLookup';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const resolved = await lookupPodcastForShareMetadata(id);
    const pageUrl = `${resolved.origin}/podcasts/${encodeURIComponent(id)}`;

    return {
      title: `${resolved.title} — ${resolved.artist}`,
      description: resolved.description,
      openGraph: {
        title: `${resolved.title} — ${resolved.artist}`,
        description: resolved.description,
        type: 'article',
        url: pageUrl,
        siteName: 'ChanceTEK One',
        images: [
          {
            url: resolved.ogImageUrl,
            secureUrl: resolved.ogImageUrl,
            width: 1200,
            height: 1200,
            alt: `${resolved.title} hosted by ${resolved.artist}`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${resolved.title} — ${resolved.artist}`,
        description: resolved.description,
        images: [resolved.ogImageUrl],
      },
    };
  } catch {
    return {
      title: 'ChanceTEK One — Master Podcast Series',
      description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One — Podcasts',
        description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us/podcasts',
        images: [{ url: 'https://chancetekone.us/images/genres/hip-hop.jpg', width: 1200, height: 1200 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One — Podcasts',
        description: 'Stream master audio podcast broadcasts and discussions on ChanceTEK One.',
        images: ['https://chancetekone.us/images/genres/hip-hop.jpg'],
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
