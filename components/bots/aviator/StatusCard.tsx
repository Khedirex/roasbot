"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { usePersistedState } from "@/app/hooks/usePersistedState";

export type StatusCardProps = {
  bot: string;        // "aviator"
  casa: string;       // "1win" | "lebull" etc.
  robotId?: string;   // id do robô selecionado (opcional)
  metrics?: { greens: number; reds: number; jogadas?: number };
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

function pctAssertividade(greens: number, reds: number) {
  const total = greens + reds;
  if (!total) return 0;
  return Math.round((greens / total) * 100);
}

/* =========================================================
 * Storage helpers (mesmo formato usado pela Home)
 * =======================================================*/
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
  return arr.find((s) => s.botId === botId)!;
}

/* =========================================================
 * Conta quantas estratégias estão enabled (compat: com/sem robotId)
 * =======================================================*/
function useActiveStrategiesCount(bot: string, casa: string, robotId?: string) {
  const keys = useMemo(() => {
    const b = bot.toLowerCase();
    const c = casa.toLowerCase();
    const list = [
      `roasbot:strategies:${b}:${c}:${robotId ?? "default"}`, // chave nova com robotId
      `roasbot:${b}:${c}:strategies`,                         // chave antiga (sem robotId)
    ];
    // remove duplicadas mantendo ordem
    return Array.from(new Set(list));
  }, [bot, casa, robotId]);

  const [count, setCount] = useState(0);

  useEffect(() => {
    let total = 0;
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const list = JSON.parse(raw) as Array<{ enabled?: boolean }>;
        total = Math.max(total, list.filter((s) => !!s.enabled).length);
      } catch {}
    }
    setCount(total);
  }, [keys]);

  return count;
}

/* =========================================================
 * StatusCard
 * =======================================================*/
export function StatusCard({ bot, casa, robotId, metrics }: StatusCardProps) {
  const game = bot.toLowerCase();
  const house = casa.toLowerCase();
  const botId = `${game}-${house}`;

  // Migração de chave antiga (mantida para compat)
  const legacyEnabledKey = useMemo(
    () => `bot-${game}-enabled-${house}-${robotId}`,
    [game, house, robotId]
  );
  const [legacyEnabled, setLegacyEnabled] = usePersistedState<boolean>(legacyEnabledKey, false);

  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStrategies = useActiveStrategiesCount(game, house, robotId);
  const accuracy = pctAssertividade(metrics?.greens ?? 0, metrics?.reds ?? 0);

  // Carrega status + migra legacyEnabled -> statuses:v2
  useEffect(() => {
    const arr = readStatuses();
    let current = arr.find((s) => s.botId === botId) || null;

    // migração: se não existe no v2 mas há legacyEnabled true/false, cria/atualiza
    if (!current) {
      current = upsertStatus(botId, { active: legacyEnabled });
    } else if (current.active !== legacyEnabled) {
      // mantém ambos em sincronia na primeira carga
      setLegacyEnabled(current.active);
    }
    setStatus(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // Sincroniza strategyCount quando mudar
  useEffect(() => {
    const updated = upsertStatus(botId, { strategyCount: activeStrategies });
    setStatus(updated);
  }, [botId, activeStrategies]);

  // Sincroniza wins/reds quando métricas mudarem
  useEffect(() => {
    if (metrics) {
      const updated = upsertStatus(botId, {
        winsToday: metrics.greens ?? 0,
        redsToday: metrics.reds ?? 0,
      });
      setStatus(updated);
    }
  }, [botId, metrics?.greens, metrics?.reds]);

  async function toggle(next: boolean) {
    setLoading(true);
    try {
      // aqui entraria start/stop real se existir
      const updated = upsertStatus(botId, { active: next });
      setStatus(updated);
      setLegacyEnabled(next); // mantém compatibilidade
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          Bot {game[0].toUpperCase() + game.slice(1)} — {house}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">Status</div>
            <Switch
              checked={!!status?.active}
              disabled={loading}
              onCheckedChange={toggle}
            />
            <div className="text-sm font-medium">
              {status?.active ? "Ligado ✅" : "Desligado ❌"}
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Estratégias ativas</span>
              <span className="font-semibold">{activeStrategies}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Assertividade</span>
              <span className="font-semibold">{accuracy}%</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Robô selecionado: <b>{robotId ?? "default"}</b>
        </div>
      </CardContent>
    </Card>
  );
}
