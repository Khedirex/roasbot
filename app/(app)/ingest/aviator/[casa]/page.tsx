"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";

type StatResp = {
  ok: boolean;
  casa: string;
  count: number;
  window: { fromTs: number | null; toTs: number | null };
  stats: { min: number | null; max: number | null; avg: number | null; p50: number | null; p90: number | null; p99: number | null };
  series: Array<{ ts: number; value: number; createdAt: string }>;
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());

export default function IngestAviatorCasaPage() {
  const params = useParams<{ casa?: string | string[] }>();
  const casa = Array.isArray(params?.casa) ? params?.casa[0] : params?.casa || "1win";

  const { data, error, isLoading } = useSWR<StatResp>(
    `/api/ingest/aviator/${casa}/stats?limit=200`,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: true }
  );

  const recent = useMemo(() => {
    if (!data?.series) return [];
    return [...data.series].slice(-20).reverse();
  }, [data?.series]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aviator • {casa}</h1>
        <SmallBadge status={isLoading ? "loading" : error ? "error" : "ok"} />
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
          Erro ao carregar estatísticas.
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi label="Pontos" value={data?.count ?? 0} />
            <Kpi label="Mín" value={fmtNum(data?.stats.min)} />
            <Kpi label="Máx" value={fmtNum(data?.stats.max)} />
            <Kpi label="Média" value={fmtNum(data?.stats.avg)} />
            <Kpi label="P50" value={fmtNum(data?.stats.p50)} />
            <Kpi label="P90" value={fmtNum(data?.stats.p90)} />
          </div>

          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">ts</th>
                  <th className="px-3 py-2 text-left">valor</th>
                  <th className="px-3 py-2 text-left">quando</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={3}>Sem dados ainda.</td>
                  </tr>
                ) : (
                  recent.map((r) => (
                    <tr key={`${r.ts}-${r.createdAt}`} className="border-t">
                      <td className="px-3 py-2">{r.ts}</td>
                      <td className="px-3 py-2">{r.value}</td>
                      <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value ?? "—"}</div>
    </div>
  );
}

function SmallBadge({ status }: { status: "loading" | "ok" | "error" }) {
  const map = {
    loading: { text: "Atualizando…", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    ok:      { text: "Ao vivo",      cls: "bg-green-100  text-green-700  border-green-300" },
    error:   { text: "Erro",         cls: "bg-red-100    text-red-700    border-red-300" },
  }[status];
  return <span className={`text-xs px-2 py-1 rounded border ${map.cls}`}>{map.text}</span>;
}

function fmtNum(n: number | null | undefined) {
  return n == null ? "—" : Number(n).toFixed(2);
}
