import type { Metadata } from 'next';
import { ShareRedirect } from './ShareRedirect';
import { lookupTrackForShareMetadata } from '@/lib/server/shareTrackLookup';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
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

  // Keep og:url aligned with the shared link so Facebook, LinkedIn, WhatsApp, and iMessage
  // preserve the exact song cover image resolved on this route.
  const shareQs = new URLSearchParams();
  if (first(sp.t)) shareQs.set('t', first(sp.t));
  if (first(sp.a)) shareQs.set('a', first(sp.a));
  if (first(sp.c)) shareQs.set('c', first(sp.c));
  const shareUrl = `${resolved.origin}/share/track/${encodeURIComponent(id)}${shareQs.toString() ? `?${shareQs.toString()}` : ''}`;

  return {
    title: `${fullTitle} | ChanceTEK One`,
    description,
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
      images: [resolved.ogImageUrl],
    },
    other: {
      'og:image:secure_url': resolved.ogImageUrl,
    },
  };
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
      id={id}
      title={resolved.title}
      artist={resolved.artist}
      coverUrl={resolved.clientCoverUrl}
    />
  );
}
