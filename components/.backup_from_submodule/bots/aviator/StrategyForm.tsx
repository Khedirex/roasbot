"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import usePersistedState from "@/app/hooks/usePersistedState";

type Props = {
  bot: string;
  casa: "1win" | "lebull"; // restringe as casas
  robotId?: string;
};

export function StrategyForm({ bot, casa, robotId }: Props) {
  // só aceita se for 1win ou lebull
  const normalizedCasa = casa.toLowerCase() as "1win" | "lebull";

  const botKey = useMemo(
    () => `bot-${bot}-strat-${normalizedCasa}`,
    [bot, normalizedCasa]
  );

  const [stake, setStake] = usePersistedState<number>(`${botKey}-stake`, 10);
  const [martingale, setMartingale] = usePersistedState<number>(`${botKey}-mg`, 0);
  const [maxEntries, setMaxEntries] = usePersistedState<number>(`${botKey}-max`, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Estratégia ({normalizedCasa === "1win" ? "1Win" : "LeBull"})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Stake (R$)</Label>
          <Input
            type="number"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <Label>Martingale</Label>
          <Input
            type="number"
            value={martingale}
            onChange={(e) => setMartingale(Number(e.target.value))}
            min={0}
          />
        </div>
        <div>
          <Label>Entradas Máx.</Label>
          <Input
            type="number"
            value={maxEntries}
            onChange={(e) => setMaxEntries(Number(e.target.value))}
            min={1}
          />
        </div>
      </CardContent>
    </Card>
  );
}
