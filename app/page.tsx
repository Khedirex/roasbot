// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/* ================= Tipos ================= */
type Game = "aviator" | "bacbo";
type CasaSlug = "1win" | "lebull";

type BotMeta = {
  id: string;      // "aviator-1win"
  game: Game;
  casa: CasaSlug;
  label: string;   // "Aviator @ 1Win"
};

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

/* ================= Utils ================= */
function labelOf(game: Game, casa: CasaSlug) {
  const g = game === "aviator" ? "Aviator" : "Bac Bo";
  const c = casa === "1win" ? "1Win" : "LeBull";
  return `${g} @ ${c}`;
}

function toBotUrl(meta: BotMeta) {
  return `/bots?game=${meta.game}&casa=${meta.casa}`;
}

function timeShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Descobre *apenas* bots que possuam uma lista real em:
 *   roasbot:robots:<game>-<casa>:list
 * e filtra para as casas suportadas (1win/lebull).
 */
function discoverBotsWithRealRobots(): BotMeta[] {
  if (typeof window === "undefined") return [];
  const metas: BotMeta[] = [];

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) || "";
      const m = key.match(/^roasbot:robots:(aviator|bacbo)-(1win|lebull):list$/i);
      if (!m) continue;

      const game = m[1].toLowerCase() as Game;
      const casa = m[2].toLowerCase() as CasaSlug;
      const id = `${game}-${casa}`;

      const raw = window.localStorage.getItem(key);
      const arr: Robot[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length > 0) {
        metas.push({ id, game, casa, label: labelOf(game, casa) });
      }
    }
  } catch {}

  // remove duplicados
  const map = new Map(metas.map((b) => [b.id, b]));
  return Array.from(map.values());
}

function readRobots(botId: string): Robot[] {
  try {
    const key = `roasbot:robots:${botId}:list`;
    const raw = window.localStorage.getItem(key);
    const arr: Robot[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function anyRobotEnabled(botId: string, robots: Robot[]) {
  try {
    return robots.some((r) => {
      const k = `roasbot:${botId}:${r.id}:enabled`;
      return window.localStorage.getItem(k) === "true";
    });
  } catch {
    return false;
  }
}

/* ================= Página ================= */
export default function Home() {
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<
    Array<{
      meta: BotMeta;
      robots: Robot[];
      enabled: boolean;
      totals: { strategies: number; wins: number; reds: number; lastSignalAt?: string };
    }>
  >([]);

  function refresh() {
    const metas = discoverBotsWithRealRobots();
    const snap = metas.map((meta) => {
      const robots = readRobots(meta.id);
      const enabled = anyRobotEnabled(meta.id, robots);

      const strategies = robots.reduce((acc, r) => acc + (r.strategies?.length || 0), 0);
      const wins = robots.reduce((acc, r) => acc + (r.metrics?.greens || 0), 0);
      const reds = robots.reduce((acc, r) => acc + (r.metrics?.reds || 0), 0);

      return { meta, robots, enabled, totals: { strategies, wins, reds, lastSignalAt: undefined } };
    });

    setSnapshot(snap);
  }

  useEffect(() => {
    refresh();
    function onStorage(e: StorageEvent) {
      if (!e.key) return;
      if (/^roasbot:(robots|aviator|bacbo)/.test(e.key)) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const hasBots = snapshot.length > 0;

  const totals = useMemo(() => {
    const all = snapshot.length;
    const on = snapshot.filter((s) => s.enabled).length;
    const off = all - on;
    const wins = snapshot.reduce((acc, s) => acc + s.totals.wins, 0);
    const reds = snapshot.reduce((acc, s) => acc + s.totals.reds, 0);
    const total = wins + reds;
    const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
    return { all, on, off, winRate };
  }, [snapshot]);

  const activeBots = snapshot.filter((s) => s.enabled);

  return (
    <section className="space-y-8">
      {/* KPIs topo (somente dados reais) */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Bots totais", value: totals.all },
          { label: "Ativos", value: totals.on },
          { label: "Desligados", value: totals.off },
          { label: "Win rate (hoje)", value: `${totals.winRate}%` },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-2xl border bg-white shadow-sm">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {!hasBots && (
        <div className="rounded-2xl border bg-white p-6 text-gray-700">
          <h2 className="text-lg font-semibold mb-1">Nenhum bot com robôs cadastrados</h2>
          <p className="mb-4">
            Crie um robô em <span className="font-medium">/bots</span> para que ele apareça aqui.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/bots?game=aviator&casa=1win")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Criar Aviator @ 1Win
            </button>
            <button
              type="button"
              onClick={() => router.push("/bots?game=bacbo&casa=lebull")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Criar Bac Bo @ LeBull
            </button>
          </div>
        </div>
      )}

      {/* Bots ativos (reais) */}
      {hasBots && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Bots ativos</h2>
          {activeBots.length === 0 && (
            <p className="text-gray-500">Nenhum bot ativo no momento.</p>
          )}
          <div className="flex flex-wrap gap-3">
            {activeBots.map(({ meta, totals }) => (
              <button
                key={meta.id}
                type="button"
                onClick={() => router.push(toBotUrl(meta))}
                className="px-4 py-2 rounded-full bg-black text-white text-sm hover:opacity-90 transition"
              >
                {meta.label}
                <span className="ml-2 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {totals.strategies} estratégias
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status dos robots — somente dados reais */}
      {hasBots && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Status dos robots</h2>
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  {["Bot", "Ativo", "Estratégias", "Wins", "Reds", "Último sinal", "Ações"].map(
                    (h) => (
                      <th key={h} className="p-3 font-medium text-gray-600">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {snapshot.map(({ meta, enabled, totals }) => (
                  <tr key={meta.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => router.push(toBotUrl(meta))}
                        className="font-medium hover:underline"
                      >
                        {meta.label}
                      </button>
                      <div className="mt-1 flex gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                          game: {meta.game}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                          casa: {meta.casa}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {enabled ? "Ligado" : "Desligado"}
                      </span>
                    </td>
                    <td className="p-3">{totals.strategies}</td>
                    <td className="p-3">{totals.wins}</td>
                    <td className="p-3">{totals.reds}</td>
                    <td className="p-3">{timeShort(totals.lastSignalAt)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => router.push(toBotUrl(meta))}
                        className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocos auxiliares */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-2xl border bg-white shadow-sm space-y-2">
          <div className="text-sm text-gray-500">Ações rápidas</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/bots?game=aviator&casa=1win")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Abrir Aviator @ 1Win
            </button>
            <button
              type="button"
              onClick={() => router.push("/bots?game=bacbo&casa=lebull")}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
            >
              Abrir Bac Bo @ LeBull
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Alertas</div>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Sem oportunidade no Aviator @ LeBull (bot pode estar desligado).</li>
            <li>Verificar taxa de RED no Bac Bo @ LeBull.</li>
          </ul>
        </div>

        <div className="p-4 rounded-2xl border bg-white shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Próximos passos</div>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Revisar mensagens de estratégia do Aviator.</li>
            <li>Ativar estratégias extras no Bac Bo.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
