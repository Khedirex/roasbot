"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import usePersistedState from "@/app/hooks/usePersistedState";

export type StatusCardProps = {
  bot: string;        // "aviator"
  casa: string;       // "1win" | "lebull" etc.
  robotId?: string;    // id do robô selecionado
  metrics?: { greens: number; reds: number; jogadas?: number };
};

function pctAssertividade(greens: number, reds: number) {
  const total = greens + reds;
  if (!total) return 0;
  return Math.round((greens / total) * 100);
}

// Conta quantas estratégias estão enabled para este robô
function useActiveStrategiesCount(bot: string, casa: string, robotId: string) {
  const key = useMemo(
    () => `roasbot:strategies:${bot}:${casa}:${robotId}`,
    [bot, casa, robotId]
  );
  const [count, setCount] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      setCount(0);
      return;
    }
    try {
      const list = JSON.parse(raw) as Array<{ enabled?: boolean }>;
      setCount(list.filter((s) => !!s.enabled).length);
    } catch {
      setCount(0);
    }
  }, [key]);

  return count;
}

export function StatusCard({ bot, casa, robotId, metrics }: StatusCardProps) {
  // status liga/desliga é por bot+casa+robô
  const enabledKey = useMemo(
    () => `bot-${bot}-enabled-${casa}-${robotId}`,
    [bot, casa, robotId]
  );
  const [enabled, setEnabled] = usePersistedState<boolean>(enabledKey, false);
  const [loading, setLoading] = useState(false);

  const activeStrategies = useActiveStrategiesCount(bot, casa, robotId ?? "default");

  const accuracy = pctAssertividade(metrics?.greens ?? 0, metrics?.reds ?? 0);

  async function toggle(next: boolean) {
    setLoading(true);
    try {
      // plugue aqui seu start/stop real, se tiver:
      // await (next ? startBot(bot, casa) : stopBot(bot, casa));
      setEnabled(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          Bot {bot[0].toUpperCase() + bot.slice(1)} — {casa}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">Status</div>
            <Switch checked={enabled} disabled={loading} onCheckedChange={toggle} />
            <div className="text-sm font-medium">{enabled ? "Ligado ✅" : "Desligado ❌"}</div>
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
          Robô selecionado: <b>{robotId}</b>
        </div>
      </CardContent>
    </Card>
  );
}
