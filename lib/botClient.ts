// lib/botClient.ts

// Casas ativas no momento (como você pediu)
export type Casa = "1win" | "lebull";

// Estatísticas completas esperadas pelo MetricsChart/Status
export type BotStats = {
  greens: number;
  reds: number;
  jogadas?: number;        // opcional
  lastSignalAt?: string;   // ISO opcional
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startBot(bot: string, casa: Casa) {
  // TODO: trocar para chamada do n8n
  await sleep(500);
  return { ok: true };
}

export async function stopBot(bot: string, casa: Casa) {
  // TODO: trocar para chamada do n8n
  await sleep(500);
  return { ok: true };
}

export async function fetchStats(bot: string, casa: Casa): Promise<BotStats> {
  // TODO: trocar para chamada do n8n
  await sleep(300);

  // mock inicial (mantém compat com MetricsChart)
  const greens = 32;
  const reds = 12;
  const jogadas = greens + reds;
  const lastSignalAt = new Date().toISOString();

  return { greens, reds, jogadas, lastSignalAt };
}
