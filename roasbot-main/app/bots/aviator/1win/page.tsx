"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import usePersistedState from "@/app/hooks/usePersistedState";
import { StatusCard } from "@/components/bots/aviator/StatusCard";
import { MetricsChart } from "@/components/bots/aviator/MetricsChart";
import { StrategyForm } from "@/components/bots/aviator/StrategyForm";

// Mock só para o chart (1Win)
const chartData = [
  { name: "Greens", value: 32 },
  { name: "Reds", value: 12 },
];

function OneWinPanel() {
  const [enabled, setEnabled] = usePersistedState<boolean>("bot:1win:enabled", false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl">Aviator — 1Win</CardTitle>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{enabled ? "Ligado ✅" : "Desligado ❌"}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
            {/* Cartão de status (opcional) */}
            {typeof StatusCard === "function" && (
            <StatusCard bot="aviator" casa="1win" />
            )}


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico (mock) */}
            {typeof MetricsChart === "function" ? (
              <MetricsChart bot="aviator" casa="1win" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Greens x Reds</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foregrund">
                  Coloque aqui seu gráfico (MetricsChart).
                </CardContent>
              </Card>
            )}

            {/* Form de estratégia */}
            {typeof StrategyForm === "function" ? (
              <StrategyForm bot="aviator" casa="1win" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Estratégia</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Coloque aqui o formulário de estratégia (StrategyForm).
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComingSoon({ bot }: { bot: string }) {
  // Deixa o layout padrão e um toggle “indisponível” só para manter consistência visual
  const [dummy, setDummy] = usePersistedState<boolean>(`bot:${bot}:enabled`, false);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-xl">{bot} (em breve)</CardTitle>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{dummy ? "Ligado ✅" : "Desligado ❌"}</p>
          </div>
          <Switch checked={dummy} onCheckedChange={setDummy} disabled />
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Em breve você poderá controlar este bot aqui.
      </CardContent>
    </Card>
  );
}

export default function BotsHubPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <span>⚙️</span> Controle dos Bots
      </h1>

      <Tabs defaultValue="1win" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="1win">1Win</TabsTrigger>
          <TabsTrigger value="blaze">Blaze</TabsTrigger>
          <TabsTrigger value="crasher">Crasher</TabsTrigger>
        </TabsList>

        <TabsContent value="1win">
          <OneWinPanel />
        </TabsContent>

        <TabsContent value="blaze">
          <ComingSoon bot="blaze" />
        </TabsContent>

        <TabsContent value="crasher">
          <ComingSoon bot="crasher" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
