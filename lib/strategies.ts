// lib/strategies.ts
// Helper isomórfico (pode ser usado em componentes Client ou Server via fetch)

export type UIToken = "X" | "K" | "P" | "W" | "G" | "A";

export type StrategyDTO = {
  id: string;
  robotId: string;
  name: string;
  active: boolean;
  startHour: string; // "HH:mm"
  endHour: string;   // "HH:mm"
  pattern: UIToken[];
  winAt: number;
  mgCount: number;
  blueThreshold: number | null;
  pinkThreshold: number | null;
  messages: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
};

export type StrategyCreatePayload = Partial<
  Pick<
    StrategyDTO,
    | "name"
    | "active"
    | "startHour"
    | "endHour"
    | "pattern"
    | "winAt"
    | "mgCount"
    | "blueThreshold"
    | "pinkThreshold"
    | "messages"
  >
>;

export type StrategyUpdatePayload = StrategyCreatePayload;

/* =========================
 * Fetch wrappers
 * ========================= */

async function j<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Erro na API");
  return data.data as T;
}

/** Lista estratégias de um robô */
export async function listStrategies(botId: string): Promise<StrategyDTO[]> {
  const res = await fetch(`/api/strategies/${botId}`, { cache: "no-store" });
  return j<StrategyDTO[]>(res);
}

/** Cria estratégia para o robô */
export async function createStrategy(
  botId: string,
  payload: StrategyCreatePayload = {},
): Promise<StrategyDTO> {
  const res = await fetch(`/api/strategies/${botId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return j<StrategyDTO>(res);
}

/** Lê uma estratégia específica (se tiver teu GET /api/strategies?id=) */
export async function getStrategy(id: string): Promise<StrategyDTO | null> {
  const res = await fetch(`/api/strategies?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  return j<StrategyDTO | null>(res);
}

/** Atualiza parcialmente (PATCH) */
export async function updateStrategy(
  id: string,
  payload: StrategyUpdatePayload,
): Promise<StrategyDTO> {
  const res = await fetch(`/api/strategies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return j<StrategyDTO>(res);
}

/** Salva somente o pattern (para autosave do PatternBuilder) */
export async function savePattern(id: string, pattern: UIToken[]): Promise<UIToken[]> {
  const res = await fetch(`/api/strategies/${id}/pattern`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern }),
  });
  return j<UIToken[]>(res);
}
