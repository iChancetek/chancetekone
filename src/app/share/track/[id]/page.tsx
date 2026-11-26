import type { Metadata } from 'next';
import { ShareRedirect } from './ShareRedirect';
import { lookupTrackForShareMetadata } from '@/lib/server/shareTrackLookup';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const sp = await searchParams;

    const resolved = await lookupTrackForShareMetadata(id, {
      title: first(sp.t) || undefined,
      artist: first(sp.a) || undefined,
      cover: first(sp.c) || undefined,
      origin: first(sp.o) || undefined,
    });

    const fullTitle = resolved.artist ? `${resolved.title} — ${resolved.artist}` : resolved.title;
    const description = `${resolved.description} Listen free for 2 previews on ChanceTEK One.`;
    const shareUrl = `${resolved.origin}/share/track/${encodeURIComponent(resolved.id)}`;

    return {
      title: `${fullTitle} | ChanceTEK One`,
      description,
      alternates: {
        canonical: shareUrl,
      },
      openGraph: {
        title: fullTitle,
        description,
        siteName: 'ChanceTEK One',
        type: 'music.song',
        url: shareUrl,
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
        description,
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
  } catch (err) {
    console.error('[share/track] generateMetadata fallback:', err);
    return {
      title: 'Listen on ChanceTEK One — The Algorithm of Timeless Music',
      description: 'Stream music, 4K videos, audiobooks, and podcasts on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One — The Algorithm of Timeless Music',
        description: 'Stream music, 4K videos, audiobooks, and podcasts on ChanceTEK One.',
        siteName: 'ChanceTEK One',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [
          {
            url: 'https://chancetekone.us/images/chancetekone_logo.jpg',
            secureUrl: 'https://chancetekone.us/images/chancetekone_logo.jpg',
            type: 'image/jpeg',
            width: 1200,
            height: 675,
            alt: 'ChanceTEK One — The Algorithm of Timeless Music',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One — The Algorithm of Timeless Music',
        description: 'Stream music, 4K videos, audiobooks, and podcasts on ChanceTEK One.',
        images: ['https://chancetekone.us/images/chancetekone_logo.jpg'],
      },
    };
  }
}

export default async function SharedTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const resolved = await lookupTrackForShareMetadata(id, {
    title: first(sp.t) || undefined,
    artist: first(sp.a) || undefined,
    cover: first(sp.c) || undefined,
    origin: first(sp.o) || undefined,
  });

  return (
    <ShareRedirect
      id={resolved.id}
      title={resolved.title}
      artist={resolved.artist}
      coverUrl={resolved.clientCoverUrl}
    />
  );
}
