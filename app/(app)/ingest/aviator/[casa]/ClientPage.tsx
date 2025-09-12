'use client';

import dynamic from 'next/dynamic';

// carrega o ChartAviator no cliente
const ChartAviator = dynamic(() => import('./ChartAviator'), { ssr: false });

export default function ClientPage({ casa }: { casa: string }) {
  return <ChartAviator casa={casa} />;
}
