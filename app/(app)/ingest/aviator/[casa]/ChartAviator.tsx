// app/ingest/aviator/[casa]/ChartAviator.tsx
'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type Item = {
  id: string;
  value: number;
  ts: string;         // vem do select: prisma devolve como string/Date -> trate no map
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
};

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => r.json());

export default function ChartAviator({ casa, limit = 200 }: { casa: string; limit?: number }) {
  const { data, error, isLoading } = useSWR(
    `/api/ingest/aviator/${encodeURIComponent(casa)}?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 2000,     // atualiza a cada 2s
      dedupingInterval: 1000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const items: Item[] = data?.items ?? [];

  const values = useMemo(() => items.map((i) => i.value), [items]);

  const stats = useMemo(() => {
    const n = values.length || 1;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / n;

    const pct = (vals: number[], p: number) => {
      if (!vals.length) return 0;
      const v = [...vals].sort((a, b) => a - b);
      const idx = Math.max(0, Math.min(v.length - 1, Math.floor((p / 100) * (v.length - 1))));
      return v[idx];
    };

    const p90 = pct(values, 90);
    const p99 = pct(values, 99);

    return { count: values.length, min, max, avg, p90, p99 };
  }, [values]);

  if (error) return <div className="p-4">Erro ao carregar.</div>;
  if (isLoading) return <div className="animate-pulse p-4">Carregando…</div>;

  const chartData = items
    .slice()
    .reverse() // para mostrar do mais antigo ao mais recente no eixo X
    .map((i, idx) => ({
      idx,
      y: i.value,
    }));

  return (
    <div className="p-6">
      {/* cards de stats… use stats.count/min/max/avg/p99 */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="idx" />
            <YAxis domain={['dataMin', 'dataMax']} />
            <Tooltip />
            <Line type="monotone" dataKey="y" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
