"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { fetchStats } from "@/lib/botClient";
import type { Casa } from "@/lib/botClient";

type Props = {
  bot: string;
  casa: string;      // slug ("1win", "lebull", ...)
  robotId?: string;  // opcional — vindo do RobotManager
};

export function MetricsChart({ bot, casa }: Props) {
  const [greens, setGreens] = useState(0);
  const [reds, setReds] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetchStats(bot, casa as Casa).then((s) => {
      if (!mounted) return;
      setGreens(s.greens);
      setReds(s.reds);
    });
    return () => { mounted = false; };
  }, [bot, casa]);

  const data = useMemo(() => [
    { name: "Greens", value: greens },
    { name: "Reds", value: reds },
  ], [greens, reds]);

  return (
    <Card>
      <CardHeader><CardTitle>Greens x Reds</CardTitle></CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
