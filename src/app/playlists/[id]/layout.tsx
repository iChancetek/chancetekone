import type { Metadata } from 'next';
import { resolveShareMetadataById } from '@/lib/sharing/shareMetadataService';
import { getServerPlaylistById } from '@/lib/server/playlistStore';

export async function generateMetadata({
  params,
}: {
  params: any;
}): Promise<Metadata> {
  try {
    const resolvedParams = params ? await Promise.resolve(params) : {};
    const id = (resolvedParams as any)?.id || '';
    const serverPl = id ? await getServerPlaylistById(id) : null;
    const meta = resolveShareMetadataById('playlist', id);

    const titleText = serverPl
      ? `${serverPl.name} — Curated by ${serverPl.ownerName}`
      : `${meta.title} — ${meta.creator}`;
    const descText = serverPl
      ? serverPl.description ||
        `Listen to "${serverPl.name}" (${serverPl.itemCount} items) curated by ${serverPl.ownerName} on ChanceTEK One.`
      : meta.description;
    const rawCover = serverPl?.coverUrl || meta?.coverUrl || '/images/genres/rnb-neo-soul.jpg';
    const image = rawCover.startsWith('http')
      ? rawCover
      : `https://chancetekone.us${rawCover}`;

    return {
      title: titleText,
      description: descText,
      openGraph: {
        title: titleText,
        description: descText,
        type: 'website',
        url: `https://chancetekone.us/playlists/${id}`,
        images: [
          {
            url: image,
            alt: `${serverPl?.name || meta.title} on ChanceTEK One`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: titleText,
        description: descText,
        images: [image],
      },
    };
  } catch {
    return {
      title: 'ChanceTEK One — Member Playlist',
      description: 'Stream curated member playlists on ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Stream curated member playlists on ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Stream curated member playlists on ChanceTEK One.',
      },
    };
  }
}

export default function PlaylistDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
