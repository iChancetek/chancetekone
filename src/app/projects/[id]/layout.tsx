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
    const rawCover = meta?.coverUrl || '/images/chancetek_banner.png';
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
      title: 'THE RETURN OF THE BREAK BEATS — ChanceTEK One',
      description: 'The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artists and A Documentary Film.',
      openGraph: {
        title: 'THE RETURN OF THE BREAK BEATS',
        description: 'The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artists and A Documentary Film.',
        type: 'website',
        url: 'https://chancetekone.us/projects#project-1',
        images: [{ url: 'https://chancetekone.us/images/chancetek_banner.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'THE RETURN OF THE BREAK BEATS',
        description: 'The Forthcoming Project is based on The Classic Break Beats of Hip Hop Music and Culture Featuring Various Artists and A Documentary Film.',
        images: ['https://chancetekone.us/images/chancetek_banner.png'],
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
