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

    const otherMeta: Record<string, string> = {
      'og:image:secure_url': resolved.ogImageUrl,
      'og:image:type': resolved.ogImageType,
      'og:image:width': '1280',
      'og:image:height': '720',
      'twitter:image:src': resolved.ogImageUrl,
    };

    if (resolved.videoUrl) {
      otherMeta['og:video'] = resolved.videoUrl;
      otherMeta['og:video:url'] = resolved.videoUrl;
      otherMeta['og:video:secure_url'] = resolved.videoUrl;
      otherMeta['og:video:type'] = 'video/mp4';
      otherMeta['og:video:width'] = '1280';
      otherMeta['og:video:height'] = '720';
    }

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
            width: 1280,
            height: 720,
            alt: `${resolved.title} by ${resolved.artist}`,
          },
        ],
        ...(resolved.videoUrl
          ? {
              videos: [
                {
                  url: resolved.videoUrl,
                  secureUrl: resolved.videoUrl,
                  type: 'video/mp4',
                  width: 1280,
                  height: 720,
                },
              ],
            }
          : {}),
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
      other: otherMeta,
    };
  } catch {
    return {
      title: 'ChanceTEK One — 4K Cinema & Visual Vault',
      description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One — 4K Videos',
        description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
        type: 'video.other',
        url: 'https://chancetekone.us/videos',
        images: [
          {
            url: 'https://chancetekone.us/images/video-thumbs/video-1.jpg',
            secureUrl: 'https://chancetekone.us/images/video-thumbs/video-1.jpg',
            type: 'image/jpeg',
            width: 1280,
            height: 720,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One — 4K Videos',
        description: 'Watch 4K music videos, visual albums, and cinema on ChanceTEK One.',
        images: ['https://chancetekone.us/images/video-thumbs/video-1.jpg'],
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
