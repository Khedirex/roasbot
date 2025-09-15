// lib/dispatchRouter.ts

export type Target = {
  id: string;
  botToken: string;
  chatId: string;
  casas?: string[];        // ex.: ["1win","lebull"]
  strategies?: string[];   // ex.: ["mg2"]
  tags?: string[];         // rótulos livres (opcional)
  cooldownSec?: number;    // evita flood por alvo
  dedupeWindowSec?: number;// evita repetir a MESMA msg no intervalo
};

export type DispatchMsg = {
  casa: string;
  strategyId?: string | null;
  text: string;
  parse_mode?: "HTML" | "MarkdownV2";
  tags?: string[]; // ✅ adiciona aqui
};


const memoryCooldown = new Map<string, number>(); // key: targetId -> lastSentMs
const memoryDedupe  = new Map<string, Array<{ ts: number; hash: string }>>(); // key: targetId -> janela

const nowMs = () => Date.now();

// hash simples só pra dedupe (não-crítico)
function hashFast(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return String(h);
}

function readTargetsFromEnv(): Target[] {
  const raw = process.env.TELEGRAM_TARGETS || "[]";
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    console.error("[dispatchRouter] TELEGRAM_TARGETS inválido (não é JSON). Valor bruto:", raw);
    return [];
  }
}

function matchTarget(t: Target, casa: string, strategyId?: string | null) {
  if (t.casas && t.casas.length && !t.casas.includes(casa)) return false;
  if (t.strategies && t.strategies.length && (!strategyId || !t.strategies.includes(strategyId))) return false;
  return true;
}

function passCooldown(t: Target): boolean {
  const cd = Math.max(0, t.cooldownSec ?? 0) * 1000;
  if (!cd) return true;
  const last = memoryCooldown.get(t.id) || 0;
  if (nowMs() - last < cd) return false;
  memoryCooldown.set(t.id, nowMs());
  return true;
}

function passDedupe(t: Target, text: string): boolean {
  const windowMs = Math.max(0, t.dedupeWindowSec ?? 0) * 1000;
  if (!windowMs) return true;
  const key = t.id;
  const list = memoryDedupe.get(key) || [];
  const cutoff = nowMs() - windowMs;
  const pruned = list.filter(it => it.ts >= cutoff);
  const h = hashFast(text);
  const exists = pruned.some(it => it.hash === h);
  if (exists) { memoryDedupe.set(key, pruned); return false; }
  pruned.push({ ts: nowMs(), hash: h });
  memoryDedupe.set(key, pruned);
  return true;
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",             // <— destaque
      disable_web_page_preview: true,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: !!data?.ok, data };
}

/**
 * Dispara a mensagem para todos os alvos que casarem com (casa, strategyId),
 * respeitando cooldown e dedupe por alvo.
 */
export async function dispatchToTargets(msg: DispatchMsg) {
  const targets = readTargetsFromEnv();
  const selected = targets.filter(t => matchTarget(t, msg.casa, msg.strategyId));

  const results: Array<{ targetId: string; ok: boolean; reason?: string; data?: any }> = [];

  await Promise.allSettled(selected.map(async (t) => {
    if (!passCooldown(t)) { results.push({ targetId: t.id, ok: false, reason: "cooldown" }); return; }
    if (!passDedupe(t, msg.text)) { results.push({ targetId: t.id, ok: false, reason: "dedupe" }); return; }

    try {
      const r = await sendTelegram(t.botToken, t.chatId, msg.text);
      results.push({ targetId: t.id, ok: r.ok, data: r.data, ...(r.ok ? {} : { reason: "telegram_error" }) });
    } catch (e: any) {
      results.push({ targetId: t.id, ok: false, reason: String(e?.message || e) });
    }
  }));

  return { count: selected.length, results };
}
