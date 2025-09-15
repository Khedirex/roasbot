// app/debug/aviator/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Debug de runtime do Aviator
 * - URL: /debug/aviator?casa=lebull
 * - Faz polling em /api/diagnostics/runtime?botId=aviator-<casa> a cada 2.5s
 * - Mostra thresholds, histórico de tokens e estratégias ativas
 */

type Strategy = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  mgCount: number;
  enabled: boolean;
  winAt: number;
  pattern: string[];
};

type RuntimeDiagnostics = {
  ok: boolean;
  botId: string;
  greenAt: number;
  whiteAt: number;
  history: ("R" | "G" | "B" | string)[];
  activeStrategies: Strategy[];
  error?: string;
};

const CASAS = ["lebull", "1win"] as const;
type Casa = (typeof CASAS)[number];

const POLL_MS = 2500;

export default function DebugAviatorPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialCasa = (sp.get("casa")?.toLowerCase() as Casa) || "lebull";
  const [casa, setCasa] = useState<Casa>(
    CASAS.includes(initialCasa) ? initialCasa : "lebull",
  );
  const botId = useMemo(() => `aviator-${casa}`, [casa]);

  const [data, setData] = useState<RuntimeDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(120); // quantos tokens mostrar
  const lastRef = useRef<number>(0);

  // Atualiza search param ao trocar casa
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("casa", casa);
    // evita empilhar histórico
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [casa, router]);

  const fetchOnce = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagnostics/runtime?botId=${encodeURIComponent(botId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as RuntimeDiagnostics;
      if (!json?.ok) {
        throw new Error(json?.error || "Resposta inválida");
      }
      setData(json);
      lastRef.current = Date.now();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  // Polling
  useEffect(() => {
    fetchOnce();
    if (paused) return;
    const id = setInterval(fetchOnce, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, paused]);

  const lastUpdated = useMemo(() => {
    if (!lastRef.current) return "-";
    const d = new Date(lastRef.current);
    return d.toLocaleTimeString();
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Debug · Aviator</h1>
          <p className="text-sm text-gray-500">Monitoramento do runtime matcher em tempo real</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Casa selector */}
          <label className="text-sm">
            Casa
            <select
              className="ml-2 rounded-md border px-2 py-1"
              value={casa}
              onChange={(e) => setCasa(e.target.value as Casa)}
            >
              {CASAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* Limit */}
          <label className="text-sm">
            Tokens
            <select
              className="ml-2 rounded-md border px-2 py-1"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[60, 120, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => fetchOnce()}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            disabled={loading}
            title="Atualizar"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>

          <button
            onClick={() => setPaused((p) => !p)}
            className={`rounded-md px-3 py-1.5 text-sm border ${
              paused ? "bg-yellow-50" : "hover:bg-gray-50"
            }`}
            title="Pausar/retomar atualizações automáticas"
          >
            {paused ? "Pausado" : "Ao vivo"}
          </button>
        </div>
      </header>

      {/* Meta */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Bot">
          <div className="font-mono text-sm">{botId}</div>
          <div className="text-xs text-gray-500">Última atualização: {lastUpdated}</div>
        </Card>

        <Card title="Thresholds">
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1">
              <Dot className="bg-green-500" /> <b>GREEN</b> ≥ {data?.greenAt ?? "-"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Dot className="bg-gray-400" /> <b>WHITE</b> = {data?.whiteAt ?? "-"}
            </span>
          </div>
        </Card>

        <Card title="Status">
          {error ? (
            <div className="text-sm text-red-600">Erro: {error}</div>
          ) : (
            <div className="text-sm text-emerald-600">OK</div>
          )}
        </Card>
      </section>

      {/* Histórico */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico (últimos {limit})</h2>
        <HistoryBar tokens={(data?.history ?? []).slice(-limit)} />
      </section>

      {/* Estratégias ativas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Estratégias ativas agora</h2>
        {data?.activeStrategies?.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.activeStrategies.map((s) => (
              <StrategyCard key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Nenhuma estratégia ativa no horário atual.</div>
        )}
      </section>
    </div>
  );
}

/* ---------------------- UI helpers ---------------------- */

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-medium text-gray-600">{props.title}</div>
      {props.children}
    </div>
  );
}

function Dot({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-3 w-3 rounded-full ${className}`} />;
}

function TokenBadge({ t }: { t: string }) {
  const map: Record<string, string> = {
    R: "bg-red-500",
    G: "bg-green-500",
    B: "bg-gray-400",
  };
  const color = map[t] ?? "bg-slate-500";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium text-white ${color}`}
      title={t}
    >
      {t}
    </span>
  );
}

function HistoryBar({ tokens }: { tokens: string[] }) {
  if (!tokens?.length) {
    return <div className="text-sm text-gray-500">Sem dados ainda — injete alguns resultados no ingest.</div>;
  }
  // Mostra em linhas quebrando de 40 em 40 para leitura
  const chunk = 40;
  const rows: string[][] = [];
  for (let i = 0; i < tokens.length; i += chunk) rows.push(tokens.slice(i, i + chunk));
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>total: {tokens.length}</span>
        <span>mais antigo → mais recente</span>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-wrap gap-1">
            {row.map((t, i) => (
              <TokenBadge key={`${idx}-${i}`} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyCard({ s }: { s: Strategy }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{s.name}</div>
          <div className="text-xs text-gray-500">
            Janela: {s.startHour}–{s.endHour} • mg={s.mgCount} • winAt={s.winAt}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            s.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {s.enabled ? "ativa" : "off"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {(s.pattern ?? []).map((p, i) => (
          <TokenBadge key={`${s.id}-p-${i}`} t={p} />
        ))}
      </div>
    </div>
  );
}
