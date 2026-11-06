'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ProjectRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id as string;
    if (id) {
      router.replace(`/projects#${id}`);
    } else {
      router.replace('/projects');
    }
  }, [params, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
    </div>
  );
}
