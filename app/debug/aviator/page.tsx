// app/debug/aviator/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/* =================== Types =================== */
type Strategy = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  mgCount: number;
  enabled: boolean;
  winAt: number;
  pattern: Array<"R" | "G" | "B" | string>;
};

type Diagnostics = {
  ok: boolean;
  botId: string;
  greenAt: number;
  whiteAt: number;
  history: string[]; // tokens: "R" | "G" | "B"
  activeStrategies: Strategy[];
};

/* =================== Helpers =================== */
function tokenBadge(t: string) {
  const base =
    "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset";
  if (t === "G") return `${base} bg-green-100 text-green-800 ring-green-300`;
  if (t === "R") return `${base} bg-rose-100 text-rose-800 ring-rose-300`;
  if (t === "B") return `${base} bg-sky-100 text-sky-800 ring-sky-300`;
  return `${base} bg-gray-100 text-gray-700 ring-gray-300`;
}

function matchTail(history: string[], pattern: Array<string | "R" | "G" | "B">) {
  if (!history?.length || !pattern?.length) return false;
  const hLen = history.length;
  const pLen = pattern.length;
  if (pLen > hLen) return false;
  for (let i = 0; i < pLen; i++) {
    const hTok = String(history[hLen - pLen + i] ?? "").toUpperCase();
    const pTok = String(pattern[i] ?? "").toUpperCase();
    if (hTok !== pTok) return false;
  }
  return true;
}

/* =================== Page =================== */
export default function DebugAviatorPage() {
  const search = useSearchParams();
  const router = useRouter();

  const casa = (search.get("casa") || "lebull").toLowerCase();
  const botId = `aviator-${casa}`;

  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollMs, setPollMs] = useState(2000);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchDiag() {
      try {
        const res = await fetch(`/api/diagnostics/runtime?botId=${encodeURIComponent(botId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as Diagnostics;
        setData(json);
      } catch (e) {
        // noop
      } finally {
        setLoading(false);
      }
    }

    fetchDiag();
    timerRef.current = setInterval(fetchDiag, pollMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [botId, pollMs]);

  const nowMatches = useMemo(() => {
    const hist = data?.history ?? [];
    const act = data?.activeStrategies ?? [];
    return act
      .map((s) => ({
        id: s.id,
        name: s.name,
        pattern: (s.pattern ?? []).map((x) => String(x).toUpperCase()),
        matched: matchTail(hist, (s.pattern ?? []).map((x) => String(x).toUpperCase())),
      }))
      .filter((m) => m.matched);
  }, [data]);

  function onCasaChange(newCasa: string) {
    const params = new URLSearchParams(search.toString());
    params.set("casa", newCasa);
    router.replace(`/debug/aviator?${params.toString()}`);
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Debug • Aviator</h1>
          <p className="text-sm text-gray-600">
            Bot: <span className="font-mono">{botId}</span> • Poll:{" "}
            <span className="font-mono">{pollMs}ms</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700">Casa</label>
          <select
            value={casa}
            onChange={(e) => onCasaChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="lebull">lebull</option>
            <option value="1win">1win</option>
          </select>

          <label className="text-sm text-gray-700">Polling</label>
          <select
            value={String(pollMs)}
            onChange={(e) => setPollMs(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="1000">1s</option>
            <option value="2000">2s</option>
            <option value="3000">3s</option>
            <option value="5000">5s</option>
          </select>
        </div>
      </header>

      {/* Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-white">
          <h3 className="text-sm text-gray-500">Green / White thresholds</h3>
          <p className="mt-1 text-lg font-semibold">
            G≥<span className="font-mono">{data?.greenAt ?? "-"}</span> • B=
            <span className="font-mono">{data?.whiteAt ?? "-"}</span>
          </p>
        </div>
        <div className="rounded-2xl border p-4 bg-white">
          <h3 className="text-sm text-gray-500">Histórico (tokens)</h3>
          <p className="mt-1 text-lg font-semibold">
            {data ? data.history.length : "-"} itens
          </p>
        </div>
        <div className="rounded-2xl border p-4 bg-white">
          <h3 className="text-sm text-gray-500">Estratégias ativas agora</h3>
          <p className="mt-1 text-lg font-semibold">
            {data ? data.activeStrategies.length : "-"}
          </p>
        </div>
      </section>

      {/* Matches now */}
      <section className="rounded-2xl border p-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Matches (agora)</h2>
          {!loading && (
            <span
              className={
                "text-xs px-2 py-1 rounded-md " +
                (nowMatches.length
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-700")
              }
            >
              {nowMatches.length ? `${nowMatches.length} match(es)` : "Sem match"}
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {nowMatches.length > 0 ? (
            nowMatches.map((m) => (
              <div key={m.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{m.name}</div>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                    MATCH
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.pattern.map((t, i) => (
                    <span key={i} className={tokenBadge(String(t))}>
                      {String(t).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">Nenhum match com as estratégias ativas.</p>
          )}
        </div>
      </section>

      {/* History strip */}
      <section className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-semibold">Histórico (mais antigo → mais recente)</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {!data && (
            <span className="text-sm text-gray-500">Carregando histórico...</span>
          )}
          {data?.history?.length
            ? data.history.map((t, i) => (
                <span key={i} className={tokenBadge(t)}>
                  {String(t).toUpperCase()}
                </span>
              ))
            : data &&
              data.history.length === 0 && (
                <span className="text-sm text-gray-500">Sem dados ainda.</span>
              )}
        </div>
      </section>

      {/* Active strategies */}
      <section className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg font-semibold">Estratégias ativas</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.activeStrategies?.length ? (
            data.activeStrategies.map((s) => {
              const pat = (s.pattern ?? []).map((x) => String(x).toUpperCase());
              const matched = matchTail(data.history ?? [], pat);
              return (
                <div key={s.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{s.name}</div>
                    <span
                      className={
                        "text-[10px] px-2 py-1 rounded-md " +
                        (matched
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700")
                      }
                    >
                      {matched ? "MATCH" : "—"}
                    </span>
                  </div>
                  <dl className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-y-1">
                    <dt>Janela</dt>
                    <dd className="text-gray-800">
                      {s.startHour}–{s.endHour}
                    </dd>
                    <dt>MG</dt>
                    <dd className="text-gray-800">{s.mgCount}</dd>
                    <dt>Win@</dt>
                    <dd className="text-gray-800">{s.winAt}</dd>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pat.map((t, i) => (
                      <span key={i} className={tokenBadge(t)}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-600">Nenhuma estratégia ativa no momento.</p>
          )}
        </div>
      </section>
    </main>
  );
}
