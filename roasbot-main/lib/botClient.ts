// lib/botClient.ts
export type Casa = "1win" | "blaze" | "crasher";

export type BotStats = {
  greens: number;
  reds: number;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  // mock inicial
  return { greens: 32, reds: 12 };
}
