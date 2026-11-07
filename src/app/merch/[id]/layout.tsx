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
    const meta = resolveShareMetadataById('merch', id);
    const rawCover = meta?.coverUrl || '/images/merch/bomber_jacket.jpg';
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
        url: meta.canonicalUrl || `https://chancetekone.us/merch/${id}`,
        images: [
          {
            url: image,
            alt: `${meta.title} Official Merch`,
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
      title: 'ChanceTEK One — Official Merchandise',
      description: 'Exclusive streetwear apparel, bomber jackets, and vinyl collector merchandise by ChanceTEK One.',
      openGraph: {
        title: 'ChanceTEK One',
        description: 'Exclusive streetwear apparel, bomber jackets, and vinyl collector merchandise by ChanceTEK One.',
        type: 'website',
        url: 'https://chancetekone.us',
        images: [{ url: 'https://chancetekone.us/images/return_of_the_break_beats_master.png' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ChanceTEK One',
        description: 'Exclusive streetwear apparel, bomber jackets, and vinyl collector merchandise by ChanceTEK One.',
        images: ['https://chancetekone.us/images/return_of_the_break_beats_master.png'],
      },
    };
  }
}

export default function MerchDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
