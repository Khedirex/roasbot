// app/bots/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RobotManager from "@/components/RobotManager";

/* ================= Tipos/Utils ================= */
type Game = "aviator" | "bacbo";
type CasaSlug = "1win" | "lebull";
type BotMeta = { id: string; game: Game; casa: CasaSlug; label: string };

type Metrics = { jogadas: number; greens: number; reds: number };
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
type Robot = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  martingale: number;
  botToken: string;
  chatId: string;
  strategies: Strategy[];
  metrics: Metrics;
};

const BOTS_KEY = "roasbot.bots";
const LIST_PREFIX = "roasbot:robots"; // roasbot:robots:<botId>:list

function labelOf(game: Game, casa: CasaSlug) {
  const g = game === "aviator" ? "Aviator" : "Bac Bo";
  const c = casa === "1win" ? "1Win" : "LeBull";
  return `${g} @ ${c}`;
}

/** Lê bots do registro, com fallback para chaves reais do storage. */
function readBots(): BotMeta[] {
  try {
    const raw = localStorage.getItem(BOTS_KEY);
    const arr: BotMeta[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  // fallback: varrer listas reais
  const found = new Map<string, BotMeta>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      const m = k.match(/^roasbot:robots:(aviator|bacbo)-(1win|lebull):list$/i);
      if (!m) continue;
      const game = m[1].toLowerCase() as Game;
      const casa = m[2].toLowerCase() as CasaSlug;
      const id = `${game}-${casa}`;
      found.set(id, { id, game, casa, label: labelOf(game, casa) });
    }
  } catch {}
  return Array.from(found.values());
}

/** Seed mínimo para quando o storage está vazio (não interfere se já houver dados). */
const DEFAULT_BOTS: BotMeta[] = [
  { id: "aviator-1win", game: "aviator", casa: "1win", label: "Aviator @ 1Win" },
  { id: "aviator-lebull", game: "aviator", casa: "lebull", label: "Aviator @ LeBull" },
  { id: "bacbo-1win", game: "bacbo", casa: "1win", label: "Bac Bo @ 1Win" },
];

/** Se não houver nada no storage, grava um básico e devolve; caso contrário, mantém. */
function ensureBotsRegistry(): BotMeta[] {
  const list = readBots();
  if (list.length) return list;
  try {
    localStorage.setItem(BOTS_KEY, JSON.stringify(DEFAULT_BOTS));
  } catch {}
  return DEFAULT_BOTS;
}

/** Lê a lista real de robôs para um botId. */
function readRobots(botId: string): Robot[] {
  try {
    const raw = localStorage.getItem(`${LIST_PREFIX}:${botId}:list`);
    const arr: Robot[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Lê flag enabled de um robô. */
function isRobotEnabled(botId: string, robotId: string) {
  try {
    return localStorage.getItem(`roasbot:${botId}:${robotId}:enabled`) === "true";
  } catch {
    return false;
  }
}

function timeShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ================= Página ================= */
export default function BotsPage() {
  const search = useSearchParams();
  const router = useRouter();

  // params normalizados
  const gameParamRaw = (search.get("game") || "").toLowerCase();
  const casaParamRaw = (search.get("casa") || "").toLowerCase();
  const gameParam: Game | "" =
    gameParamRaw === "aviator" || gameParamRaw === "bacbo" ? (gameParamRaw as Game) : "";
  const casaParam: CasaSlug | "" =
    casaParamRaw === "1win" || casaParamRaw === "lebull" ? (casaParamRaw as CasaSlug) : "";
  const isManager = !!gameParam && !!casaParam;
  const botId = isManager ? (`${gameParam}-${casaParam}` as const) : "";

  // estado do configurador
  const [bots, setBots] = useState<BotMeta[]>([]);
  const [game, setGame] = useState<Game | "">("");
  const [casa, setCasa] = useState<CasaSlug | "">("");

  // snapshot da dash (somente quando NÃO estiver no modo manager)
  const [snapshot, setSnapshot] = useState<
    Array<{
      meta: BotMeta;
      robots: Robot[];
      enabledCount: number;
      disabledCount: number;
      totals: { strategies: number; wins: number; reds: number };
    }>
  >([]);

  useEffect(() => {
    const list = ensureBotsRegistry(); // 👈 semeia apenas se estiver vazio

    // monta snapshot agrupado apenas com bots que TÊM robôs
    if (!isManager) {
      const snap = list
        .map((meta) => {
          const robots = readRobots(meta.id);
          if (!robots.length) return null; // filtra casas sem robôs
          const enabledCount = robots.filter((r) => isRobotEnabled(meta.id, r.id)).length;
          const disabledCount = robots.length - enabledCount;
          const strategies = robots.reduce((acc, r) => acc + (r.strategies?.length || 0), 0);
          const wins = robots.reduce((acc, r) => acc + (r.metrics?.greens || 0), 0);
          const reds = robots.reduce((acc, r) => acc + (r.metrics?.reds || 0), 0);
          return {
            meta,
            robots,
            enabledCount,
            disabledCount,
            totals: { strategies, wins, reds },
          };
        })
        .filter(Boolean) as typeof snapshot;
      setSnapshot(snap);
      // o seletor usa o registro; manter, mas agora a dash só reflete o que existe de fato
      setBots(list);
    } else {
      setBots(list);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const casasOptions = useMemo(() => {
    if (!game) return [];
    const set = new Set(bots.filter((b) => b.game === game).map((b) => b.casa));
    return Array.from(set).filter((c): c is CasaSlug => c === "1win" || c === "lebull");
  }, [bots, game]);

  const selectedBot = useMemo(() => {
    if (!game || !casa) return null;
    return bots.find((b) => b.game === game && b.casa === casa) || null;
  }, [bots, game, casa]);

  /* ===== Helpers de agrupamento para a dash ===== */
  const byGame: Record<Game, Array<typeof snapshot[number]>> = useMemo(() => {
    const grouped: Record<Game, Array<typeof snapshot[number]>> = {
      aviator: [],
      bacbo: [],
    };
    snapshot.forEach((s) => grouped[s.meta.game].push(s));
    return grouped;
  }, [snapshot]);

  const totalsOverall = useMemo(() => {
    const enabled = snapshot.reduce((acc, s) => acc + s.enabledCount, 0);
    const disabled = snapshot.reduce((acc, s) => acc + s.disabledCount, 0);
    const wins = snapshot.reduce((acc, s) => acc + s.totals.wins, 0);
    const reds = snapshot.reduce((acc, s) => acc + s.totals.reds, 0);
    const totalSignals = wins + reds;
    const winRate = totalSignals ? Math.round((wins / totalSignals) * 100) : 0;
    const strategies = snapshot.reduce((acc, s) => acc + s.totals.strategies, 0);
    return { enabled, disabled, strategies, wins, reds, winRate };
  }, [snapshot]);

  return (
    <section className="space-y-6">
      {/* Título varia por modo */}
      <h1 className="text-2xl font-bold">
        {isManager ? (
          <>
            Gerenciar • {gameParam === "aviator" ? "Aviator" : "Bac Bo"} @{" "}
            {casaParam === "1win" ? "1Win" : "LeBull"}
          </>
        ) : (
          "Configurar Bots"
        )}
      </h1>

      {/* ===== MODO 1: gerenciamento ===== */}
      {isManager && (
        <>
          <div className="flex items-center justify-end">
            <button
              onClick={() => router.push("/bots")}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Voltar para Configurar
            </button>
          </div>

          <RobotManager botId={botId} casa={casaParam as CasaSlug} />
        </>
      )}

      {/* ===== MODO 2: configurador + DASH ===== */}
      {!isManager && (
        <>
          {/* Seletor simples para abrir um manager específico */}
          <div className="grid max-w-xl gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-gray-600">Jogo</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={game}
                onChange={(e) => {
                  setGame(e.target.value as Game | "");
                  setCasa("");
                }}
              >
                <option value="">Selecione um jogo…</option>
                {Array.from(new Set(bots.map((b) => b.game))).map((g) => (
                  <option key={g} value={g}>
                    {g === "aviator" ? "Aviator" : "Bac Bo"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600">Casa</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={casa}
                onChange={(e) => setCasa(e.target.value as CasaSlug | "")}
                disabled={!game}
              >
                <option value="">{game ? "Escolha a casa…" : "Escolha um jogo primeiro…"}</option>
                {casasOptions.map((c) => (
                  <option key={c} value={c}>
                    {c === "1win" ? "1Win" : "LeBull"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBot ? (
            <div className="max-w-xl rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-lg font-semibold">{selectedBot.label}</div>
              <div className="mt-2 text-sm text-gray-600">
                ID: <code>{selectedBot.id}</code>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() =>
                    router.push(`/bots?game=${selectedBot.game}&casa=${selectedBot.casa}`)
                  }
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Abrir gerenciamento
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Escolha um jogo e uma casa que já existam no registro.
            </p>
          )}

          {/* ====== DASHBOARD POR JOGO -> CASA ====== */}
          <div className="space-y-6">
            {/* KPIs gerais (com cor) — removido “Bots no registro” */}
            <div className="grid gap-4 md:grid-cols-5">
              <Kpi color="bg-emerald-600" label="Ativos" value={totalsOverall.enabled} />
              <Kpi color="bg-slate-600" label="Desligados" value={totalsOverall.disabled} />
              <Kpi color="bg-sky-600" label="Estratégias (total)" value={totalsOverall.strategies} />
              <Kpi color="bg-green-600" label="Wins (acumulado)" value={totalsOverall.wins} />
              <Kpi color="bg-indigo-600" label="Win rate" value={`${totalsOverall.winRate}%`} />
            </div>

            {/* Aviator / Bac Bo (só quando há robôs) */}
            {(["aviator", "bacbo"] as Game[]).map((g) => {
              const items = byGame[g];
              if (!items || items.length === 0) return null;

              const gameTitle = g === "aviator" ? "Aviator" : "Bac Bo";
              const headerGradient =
                g === "aviator"
                  ? "from-rose-500 to-orange-500"
                  : "from-violet-500 to-blue-500";

              const gameTotals = items.reduce(
                (acc, s) => {
                  acc.enabled += s.enabledCount;
                  acc.disabled += s.disabledCount;
                  acc.strategies += s.totals.strategies;
                  acc.wins += s.totals.wins;
                  acc.reds += s.totals.reds;
                  return acc;
                },
                { enabled: 0, disabled: 0, strategies: 0, wins: 0, reds: 0 }
              );

              return (
                <div key={g} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  {/* header colorido */}
                  <div className={`px-4 py-3 bg-gradient-to-r ${headerGradient} text-white`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">{gameTitle}</h2>
                      <div className="flex gap-3 text-sm">
                        <span className="opacity-90">ativos: <b>{gameTotals.enabled}</b></span>
                        <span className="opacity-90">desligados: <b>{gameTotals.disabled}</b></span>
                        <span className="opacity-90">estratégias: <b>{gameTotals.strategies}</b></span>
                        <span className="opacity-90">wins: <b>{gameTotals.wins}</b></span>
                        <span className="opacity-90">reds: <b>{gameTotals.reds}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* sub-caixas por casa (1Win / LeBull) */}
                  <div className="p-4 grid gap-4 md:grid-cols-2">
                    {items.map((s) => (
                      <div
                        key={s.meta.id}
                        className="rounded-xl border p-4 bg-white/80 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-gray-500">Casa</div>
                            <div className="text-base font-semibold">
                              {s.meta.casa === "1win" ? "1Win" : "LeBull"}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              router.push(`/bots?game=${s.meta.game}&casa=${s.meta.casa}`)
                            }
                            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                          >
                            Abrir
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <MiniKpi label="Robôs" value={s.robots.length} />
                          <MiniKpi label="Ativos" value={s.enabledCount} />
                          <MiniKpi label="Desligados" value={s.disabledCount} />
                          <MiniKpi label="Estratégias" value={s.totals.strategies} />
                          <MiniKpi label="Wins" value={s.totals.wins} />
                          <MiniKpi label="Reds" value={s.totals.reds} />
                        </div>

                        {/* lista compacta de robôs */}
                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-1 pr-2 font-medium">Robô</th>
                                <th className="py-1 pr-2 font-medium">Estado</th>
                                <th className="py-1 pr-2 font-medium">Estrat.</th>
                                <th className="py-1 pr-2 font-medium">Janela</th>
                                <th className="py-1 pr-2 font-medium">Wins</th>
                                <th className="py-1 pr-2 font-medium">Reds</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.robots.map((r) => {
                                const on = isRobotEnabled(s.meta.id, r.id);
                                return (
                                  <tr key={r.id} className="border-t">
                                    <td className="py-1 pr-2">{r.name}</td>
                                    <td className="py-1 pr-2">
                                      <span
                                        className={`px-2 py-0.5 rounded-full ${
                                          on
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-slate-200 text-slate-700"
                                        }`}
                                      >
                                        {on ? "Ligado" : "Desligado"}
                                      </span>
                                    </td>
                                    <td className="py-1 pr-2">{r.strategies?.length ?? 0}</td>
                                    <td className="py-1 pr-2">
                                      {r.startHour}–{r.endHour}
                                    </td>
                                    <td className="py-1 pr-2">{r.metrics?.greens ?? 0}</td>
                                    <td className="py-1 pr-2">{r.metrics?.reds ?? 0}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/* ================== UI helpers com cor ================== */
function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string; // ex: "bg-emerald-600"
}) {
  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm">
      <div className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs text-white ${color}`}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-2 text-center bg-gray-50">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
