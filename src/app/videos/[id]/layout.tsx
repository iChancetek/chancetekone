import type { Metadata } from 'next';
import { lookupVideoForShareMetadata } from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const resolved = await lookupVideoForShareMetadata(id);
    const pageUrl = `${resolved.origin}/videos/${encodeURIComponent(resolved.id)}`;

    return {
      title: `${resolved.title} — ${resolved.artist}`,
      description: resolved.description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${resolved.title} — ${resolved.artist}`,
        description: resolved.description,
        type: 'video.other',
        url: pageUrl,
        siteName: 'ChanceTEK One',
        images: [
          {
            url: resolved.ogImageUrl,
            secureUrl: resolved.ogImageUrl,
            type: resolved.ogImageType,
            width: 1200,
            height: 675,
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
      title: 'ChanceTEK One — 4K Cinema & Visual Vault',
      description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One — 4K Videos',
        description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us/videos',
        images: [
          {
            url: 'https://chancetekone.us/images/genres/hip-hop.jpg',
            secureUrl: 'https://chancetekone.us/images/genres/hip-hop.jpg',
            type: 'image/jpeg',
            width: 1200,
            height: 675,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One — 4K Videos',
        description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
        images: ['https://chancetekone.us/images/genres/hip-hop.jpg'],
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
