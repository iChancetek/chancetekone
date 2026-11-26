import type { Metadata } from 'next';
import { resolveShareMetadataById } from '@/lib/sharing/shareMetadataService';

export async function generateMetadata({
  params,
}: {
  params: any;
}): Promise<Metadata> {
  try {
    const resolvedParams = params ? await Promise.resolve(params) : {};
    const id = (resolvedParams as any)?.id || '';
    const meta = resolveShareMetadataById('project', id);
    const rawCover = meta?.coverUrl || '/images/studio_cover.jpg';
    const image = rawCover.startsWith('http')
      ? rawCover
      : `https://chancetekone.us${rawCover}`;

    return {
      title: `${meta.title} — ${meta.creator}`,
      description: meta.description,
      openGraph: {
        title: `${meta.title} — ${meta.creator}`,
        description: meta.description,
        type: 'website',
        url: meta.canonicalUrl || `https://chancetekone.us/projects#${id}`,
        images: [
          {
            url: image,
            alt: `${meta.title} on ChanceTEK One`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${meta.title} — ${meta.creator}`,
        description: meta.description,
        images: [image],
      },
    };
  } catch {
    return {
      title: 'CHANCETEK ONE: THE FOUNDATION BEATS — ChanceTEK One',
      description: 'The Forthcoming Project celebrates the classic rhythm foundations of Hip Hop Music and Culture featuring various artists and a documentary film.',
      openGraph: {
        title: 'CHANCETEK ONE: THE FOUNDATION BEATS',
        description: 'The Forthcoming Project celebrates the classic rhythm foundations of Hip Hop Music and Culture featuring various artists and a documentary film.',
        type: 'website',
        url: 'https://chancetekone.us/projects#project-1',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'CHANCETEK ONE: THE FOUNDATION BEATS',
        description: 'The Forthcoming Project celebrates the classic rhythm foundations of Hip Hop Music and Culture featuring various artists and a documentary film.',
      },
    };
  }
}

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
