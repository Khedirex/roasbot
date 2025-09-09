"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
// usa o botClient se existir; caso contrário, o fallback cobre:
import { fetchStats as fetchStatsFromClient } from "@/lib/botClient";

type Props = {
  bot: string;            // ex.: "aviator"
  casa: string;           // ex.: "1win" | "lebull"
  robotId?: string;       // opcional — se você segmenta múltiplos robôs
  autoRefreshMs?: number; // opcional — padrão 15s
};

/** Formato interno esperado pelo gráfico */
type Stats = {
  greens: number;
  reds: number;
  jogadas?: number;
  lastSignalAt?: string; // ISO opcional
};

type RobotStatus = {
  botId: string;
  active: boolean;
  strategyCount: number;
  winsToday: number;
  redsToday: number;
  lastSignalAt?: string;
  stake?: number;
};

const STATUS_KEY = "roasbot.home.statuses:v2";
const BOTS_KEY = "roasbot.bots"; // usado só para validar existência

function readStatuses(): RobotStatus[] {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as RobotStatus[]) : [];
  } catch {
    return [];
  }
}
function writeStatuses(arr: RobotStatus[]) {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(arr));
  } catch {}
}
function upsertStatus(botId: string, patch: Partial<RobotStatus>) {
  const arr = readStatuses();
  const i = arr.findIndex((s) => s.botId === botId);
  const base: RobotStatus = {
    botId,
    active: false,
    strategyCount: 0,
    winsToday: 0,
    redsToday: 0,
    lastSignalAt: undefined,
    stake: undefined,
  };
  if (i >= 0) arr[i] = { ...arr[i], ...patch };
  else arr.push({ ...base, ...patch });
  writeStatuses(arr);
}

/** Busca segura: usa botClient se disponível, senão tenta fallback via STATUS_KEY */
async function safeFetchStats(botId: string): Promise<Stats> {
  // 1) Tenta usar o botClient se estiver importável
  try {
    if (typeof fetchStatsFromClient === "function") {
      const [game, house] = botId.split("-");
      // @ts-ignore — assinatura pode variar entre projetos
      const s = await fetchStatsFromClient(game, house);

      if (s && typeof s.greens === "number" && typeof s.reds === "number") {
        // compat: aceita estruturas antigas com total/count
        type ClientStats = Partial<Stats> & Partial<Record<"total" | "count", number>>;
        const anyS = s as ClientStats;

        return {
          greens: anyS.greens ?? 0,
          reds: anyS.reds ?? 0,
          jogadas:
            anyS.jogadas ??
            anyS.total ??
            anyS.count ??
            (anyS.greens ?? 0) + (anyS.reds ?? 0),
          lastSignalAt: anyS.lastSignalAt,
        };
      }
    }
  } catch {
    // segue para fallback
  }

  // 2) Fallback: lê do STATUS_KEY (o StatusCard já mantém isso atualizado)
  const arr = readStatuses();
  const found = arr.find((s) => s.botId === botId);
  if (found) {
    const jogadas = (found.winsToday ?? 0) + (found.redsToday ?? 0);
    return {
      greens: found.winsToday ?? 0,
      reds: found.redsToday ?? 0,
      jogadas,
      lastSignalAt: found.lastSignalAt,
    };
  }

  // 3) Último fallback: zeros
  return { greens: 0, reds: 0, jogadas: 0, lastSignalAt: undefined };
}

export function MetricsChart({ bot, casa, robotId, autoRefreshMs = 15000 }: Props) {
  const game = bot.toLowerCase();
  const house = casa.toLowerCase();
  const botId = `${game}-${house}`;

  const [stats, setStats] = useState<Stats>({ greens: 0, reds: 0, jogadas: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // garante que o bot existe no registro; se não existir, registra (não bloqueia)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOTS_KEY);
      const list: Array<{ id: string }> = raw ? JSON.parse(raw) : [];
      if (!list.some((b) => b.id === botId)) {
        const label =
          `${game === "aviator" ? "Aviator" : "Bac Bo"} @ ` +
          house.replace(/^[a-z]/, (c) => c.toUpperCase());
        const next = [...list, { id: botId, game, casa: house, label }];
        localStorage.setItem(BOTS_KEY, JSON.stringify(next));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const s = await safeFetchStats(botId);
      setStats(s);
      // sincroniza com a Home
      upsertStatus(botId, {
        winsToday: s.greens,
        redsToday: s.reds,
        lastSignalAt: s.lastSignalAt,
      });
    } catch {
      setErr("Falha ao carregar métricas.");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  // primeira carga + polling
  useEffect(() => {
    load();
    if (autoRefreshMs > 0) {
      timerRef.current = setInterval(load, autoRefreshMs);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return;
  }, [load, autoRefreshMs]);

  const data = useMemo(
    () => [
      { name: "Greens", value: stats.greens },
      { name: "Reds", value: stats.reds },
    ],
    [stats.greens, stats.reds]
  );

  const total = (stats.greens ?? 0) + (stats.reds ?? 0);
  const acc = total ? Math.round(((stats.greens ?? 0) / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Greens x Reds</span>
          <span className="text-xs font-normal text-muted-foreground">
            {loading
              ? "Atualizando…"
              : `Atualizado • ${new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* KPIs auxiliares */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Total de jogadas</div>
            <div className="text-base font-semibold">{stats.jogadas ?? total}</div>
          </div>
          <div className="rounded-lg border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Assertividade</div>
            <div className="text-base font-semibold">{acc}%</div>
          </div>
          <div className="rounded-lg border bg-white p-3 text-center">
            <div className="text-xs text-gray-500">Último sinal</div>
            <div className="text-base font-semibold">
              {stats.lastSignalAt
                ? new Date(stats.lastSignalAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={42}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number) => [v, "Quantidade"]}
                labelFormatter={(l) => (l === "Greens" ? "Vitórias" : "Derrotas")}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Erro / ações */}
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={load}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            disabled={loading}
          >
            Recarregar
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
