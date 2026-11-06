import type { Metadata } from 'next';
import { ShareRedirect } from './ShareRedirect';
import { resolveShareMetadataById, isDefaultOrInvalidCover } from '@/lib/sharing/shareMetadataService';

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
  const resolved = resolveShareMetadataById('song', id);

  const title = first(sp.t) || resolved.title;
  const artist = first(sp.a) || resolved.creator;
  const paramCover = first(sp.c);
  const origin = first(sp.o) || 'https://8ofspadesworks.us';

  const cover = paramCover && !isDefaultOrInvalidCover(paramCover) ? paramCover : resolved.coverUrl;
  const fullTitle = artist ? `${title} — ${artist}` : title;
  const description = resolved.description || `Listen to ${fullTitle} on 8 OF SPADES WORKS.`;
  const image = cover.startsWith('http') ? cover : `${origin}${cover}`;
  const url = `${origin}/music/${id}`;

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: 'music.song',
      url,
      images: [{ url: image, alt: fullTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export default async function SharedTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShareRedirect id={id} />;
}
