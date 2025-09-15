"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import usePersistedState from "@/app/hooks/usePersistedState";
// import type { Casa } from "@/lib/botClient";

type Props = {
  bot: string;
  casa: string;      // ou: casa: Casa;
  robotId?: string;  // <-- ADICIONE ISTO
};

export function StrategyForm({ bot, casa, robotId }: Props) {
  const botKey = useMemo(() => `bot-${bot}-strat-${casa}`, [bot, casa]);

  const [stake, setStake] = usePersistedState<number>(`${botKey}-stake`, 10);
  const [martingale, setMartingale] = usePersistedState<number>(`${botKey}-mg`, 0);
  const [maxEntries, setMaxEntries] = usePersistedState<number>(`${botKey}-max`, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estratégia ({casa})</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Stake (R$)</Label>
          <Input type="number" value={stake} onChange={e => setStake(Number(e.target.value))} min={1} />
        </div>
        <div>
          <Label>Martingale</Label>
          <Input type="number" value={martingale} onChange={e => setMartingale(Number(e.target.value))} min={0} />
        </div>
        <div>
          <Label>Entradas Máx.</Label>
          <Input type="number" value={maxEntries} onChange={e => setMaxEntries(Number(e.target.value))} min={1} />
        </div>
      </CardContent>
    </Card>
  );
}
