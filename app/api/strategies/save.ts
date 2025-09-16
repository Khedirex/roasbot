// pages/estrategias/salvar.ts
import { uiToRuntimePattern, type UIToken } from "@/lib/patternMap";

export async function salvarEstrategia({
  botId = "aviator-1win",
  id = "S-AVIATOR-1WIN",
  name = "Aviator Pro 1win",
  uiPattern, // ex.: ["K","G","K"]
  mgCount = 2,
  enabled = true,
  winAt = 0,
  messages,
  targets,
}: {
  botId?: string;
  id?: string;
  name?: string;
  uiPattern: UIToken[];
  mgCount?: number;
  enabled?: boolean;
  winAt?: number;
  messages?: any;
  targets?: Array<{ chatId: string | number; botToken?: string }>;
}) {
  const patternRGB = uiToRuntimePattern(uiPattern); // ["R","G","R"]

  const payload = [
    {
      id,
      name,
      startHour: "00:00",
      endHour: "23:59",
      mgCount,
      enabled,
      winAt,
      pattern: patternRGB, // << matcher recebe RGB
      messages,
      targets,
    },
  ];

  const res = await fetch(`/api/strategies/${botId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || "Falha ao salvar estratégia");
  }
  return data;
}
