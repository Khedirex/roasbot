// app/ingest/aviator/[casa]/ChartAviator.tsx
'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type Item = {
  id?: string;
  value: number;
  ts: string | number;   // vem como string/number
  createdAt?: string;
  ip?: string | null;
  userAgent?: string | null;
};

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

// ---- helpers ----
function toNumberLike(v: unknown): number {
  if (v == null) return NaN;
  const n = Number(String(v).replace(/x$/i, '')); // "2.99x" -> 2.99
  return n;
}

function coerceItems(data: any): Item[] {
  // suporta {items}, {rows}, {last}
  const arr: any[] = data?.items ?? data?.rows ?? data?.last ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((r: any) => ({
    id: r?.id ?? undefined,
    value: toNumberLike(r?.value),
    ts: r?.ts ?? r?.createdAt ?? Date.now(),
    createdAt: r?.createdAt,
    ip: r?.ip ?? null,
    userAgent: r?.userAgent ?? null,
  })).filter((r: Item) => Number.isFinite(r.value));
}

export default function ChartAviator({
  casa,
  limit = 200,
}: { casa: string; limit?: number }) {
  const { data, error, isLoading } = useSWR(
    // mantém sua rota atual
    `/api/ingest/aviator/${encodeURIComponent(casa)}?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 2000,
      dedupingInterval: 1000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const items: Item[] = useMemo(() => coerceItems(data), [data]);

  const values = useMemo(() => items.map((i) => Number(i.value)).filter(Number.isFinite), [items]);

  const stats = useMemo(() => {
    const n = values.length;
    if (!n) return { count: 0, min: 0, max: 0, avg: 0, p90: 0, p99: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((a, b) => a + b, 0) / n;
    const pick = (p: number) => {
      const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1))));
      return sorted[idx];
    };
    return { count: n, min, max, avg, p90: pick(90), p99: pick(99) };
  }, [values]);

  if (error) return <div className="p-4 text-sm text-red-600">Erro ao carregar (HTTP {String(error.message || error)}).</div>;
  if (isLoading) return <div className="animate-pulse p-4 text-sm text-gray-500">Carregando…</div>;

  const chartData = items
    .slice()
    .reverse() // mais antigo → mais recente no eixo X
    .map((i, idx) => ({
      idx,
      y: Number(i.value),
    }));

  return (
    <div className="p-6">
      {/* cards de stats (mantém o espaço para seus cards) */}
      {/* você pode renderizar com stats.count/min/max/avg/p99 se quiser */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="idx" />
            <YAxis domain={['dataMin', 'dataMax']} />
            <Tooltip />
            <Line type="monotone" dataKey="y" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
