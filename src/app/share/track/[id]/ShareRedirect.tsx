'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const ShareRedirect = ({ id }: { id: string }) => {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/music/${id}`);
  }, [id, router]);
  return <p className="py-20 text-center text-sm text-neutral-400">Opening track…</p>;
};
