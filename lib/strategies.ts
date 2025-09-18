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
// lib/strategies.ts  (adicione no final do arquivo)

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

// 2) Normaliza qualquer objeto (DTO ou CreatePayload) para Payload de update/create
function toPayload(x: Partial<StrategyDTO> | StrategyCreatePayload): StrategyUpdatePayload {
  return {
    name: x.name,
    active: x.active,
    startHour: x.startHour,
    endHour: x.endHour,
    pattern: x.pattern,
    winAt: x.winAt,
    mgCount: x.mgCount,
    blueThreshold: x.blueThreshold ?? (x as any).blueMin ?? null,
    pinkThreshold: x.pinkThreshold ?? (x as any).pinkMax ?? null,
    messages: x.messages ?? null,
  };
}

/**
 * 3) setStrategies(botId, next):
 * Sincroniza o conjunto de estratégias de um robô com o array `next`.
 * - Apaga no banco as que não estiverem em `next`
 * - Cria as que não têm `id`
 * - Atualiza as que têm `id`
 * Retorna a lista final do banco.
 */
export async function setStrategies(
  botId: string,
  next: Array<Partial<StrategyDTO> | StrategyCreatePayload>,
): Promise<StrategyDTO[]> {
  // estado atual
  const curr = await listStrategies(botId);
  const currIds = new Set(curr.map(s => s.id));

  // ids presentes no "next" (só os que têm id)
  const nextIds = new Set(
    next.map((n: any) => (typeof n?.id === "string" && n.id.trim() ? n.id.trim() : null)).filter(Boolean) as string[]
  );

  // 3.1) apagar o que saiu
  const toDelete = curr.filter(s => !nextIds.has(s.id)).map(s => s.id);
  for (const id of toDelete) {
    await deleteStrategy(id);
  }

  // 3.2) criar/atualizar o que veio
  for (const n of next) {
    const id = (n as any).id as string | undefined;

    if (id && currIds.has(id)) {
      // update
      await updateStrategy(id, toPayload(n));
    } else {
      // create
      await createStrategy(botId, toPayload(n));
    }
  }

  // 3.3) retorna o estado final
  return listStrategies(botId);
}
// lib/strategies.ts

// ... (código existente)

export async function getStrategy(id: string) {
  const res = await fetch(`/api/strategy/${encodeURIComponent(id)}`, { cache: "no-store" });
  return j<StrategyDTO | null>(res);
}

export async function updateStrategy(id: string, payload: StrategyUpdatePayload) {
  const res = await fetch(`/api/strategy/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return j<StrategyDTO>(res);
}

export async function savePattern(id: string, pattern: UIToken[]) {
  const res = await fetch(`/api/strategy/${encodeURIComponent(id)}/pattern`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern }),
  });
  return j<UIToken[]>(res);
}

export async function deleteStrategy(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/strategy/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.ok) throw new Error(data?.error || "Erro na API ao excluir estratégia");
  return (data.data ?? { id }) as { id: string };
}