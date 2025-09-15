// lib/autoDispatch.ts
// Dispara mensagens de match automaticamente (com cooldown em memória)
// - Flag global por ENV (AUTO_DISPATCH_ENABLED=0 desliga)
// - Fallback p/ TELEGRAM_* se AUTO_* não estiverem setadas
// - Cooldown configurável (AUTO_SIGNAL_COOLDOWN_SEC)
// - Dedupe por (botId + strategyId + padrão). Só marca se enviar com sucesso
// - chatId numérico ou string (@canal), parse_mode (HTML/MarkdownV2/Markdown)
// - Limite de tamanho (truncate)
// - Snapshots de diagnóstico + reset do dedupe

import type { CasaSlug } from "@/lib/strategies";

/** ===== ENVs e Flags ===== */
const ENABLED = (process.env.AUTO_DISPATCH_ENABLED ?? "1") !== "0";

const DEF_BOT_TOKEN = (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.AUTO_TG_BOT_TOKEN ||
  ""
).trim();

const DEF_CHAT_ID_RAW = (
  process.env.ALERTS_CHAT_ID ||          // 👈 seu env real
  process.env.TELEGRAM_CHAT_ID ||        // fallback
  process.env.AUTO_TG_CHAT_ID ||
  ""
).trim();

function parseDefaultChatId(raw: string): string | number | null {
  if (!raw) return null;
  // permite "-100..." e números positivos
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw; // ex.: "@meu_canal_publico"
}
const DEF_CHAT_ID: string | number | null = parseDefaultChatId(DEF_CHAT_ID_RAW);

const COOLDOWN_SEC = Math.max(0, Number(process.env.AUTO_SIGNAL_COOLDOWN_SEC ?? "60"));
const DEFAULT_PARSE_MODE = (process.env.AUTO_TG_PARSE_MODE as
  | "HTML"
  | "MarkdownV2"
  | "Markdown") || "HTML";
const DEFAULT_TRUNCATE = Math.max(512, Number(process.env.AUTO_TG_TRUNCATE ?? "3800"));

/** ===== Estado interno =====
 * chave: `${botId}:${strategyId}:${pattern}` → epoch ms do último envio OK
 */
const lastSent = new Map<string, number>();

/** ===== Tipos ===== */
export type MatchLike = {
  strategyId: string;
  name: string;
  matchedPattern: string[]; // ex.: ["green","gray","red"]
  window: string[];
  mgCount: number;
  winAt: number;
};

type SendOpts = {
  botToken?: string;
  chatId?: string | number;
  cooldownSec?: number; // override por chamada
  titlePrefix?: string; // ex.: "[AVIATOR · LEBULL]"
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  maxLen?: number; // default DEFAULT_TRUNCATE
};

type SentItem = { kind: "sent"; match: MatchLike; text: string; response: any };
type SkippedItem = { kind: "skipped"; match: MatchLike; reason: string; detail?: any };

/** ===== Utils ===== */
function defaultTitle(game: "aviator", casa: CasaSlug) {
  return `[${game.toUpperCase()} · ${casa.toUpperCase()}]`;
}
function joinColors(xs: string[]) {
  return xs.join("-");
}
function dedupeKey(botId: string, m: MatchLike) {
  return `${botId}:${m.strategyId}:${m.matchedPattern.join("")}`;
}

/** Não altera estado; apenas verifica janela de cooldown */
function canSend(key: string, cooldownMs: number) {
  const now = Date.now();
  const last = lastSent.get(key) ?? 0;
  return now - last >= cooldownMs;
}

/** Marca envio realizado com sucesso */
function markSent(key: string) {
  lastSent.set(key, Date.now());
}

/** Escape helpers */
function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeMdV2(s: string) {
  // Conjunto oficial de caracteres a escapar no MarkdownV2 do Telegram
  return String(s).replace(/([_\*\[\]\(\)~`>#+\-=|{}\.!\\])/g, "\\$1");
}

/** Telegram (com retry/backoff + timeout, compatível com seu helper) */
async function sendTelegram(
  botToken: string,
  chatId: string | number,
  text: string,
  parseMode: SendOpts["parseMode"] = "HTML",
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload: Record<string, any> = {
    chat_id: chatId, // aceita número ou string @canal
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) payload.parse_mode = parseMode;

  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8s (igual ao seu sendTelegram)
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // resposta pode não ser JSON em falhas de rede
    }

    if (res.ok && data?.ok) return { ok: true, data, status: res.status };

    // Retry em 429/5xx (até 5 tentativas)
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const retryAfter =
        Number(res.headers.get("retry-after")) ||
        Math.min(1000 * 2 ** attempt, 15000);
      await new Promise((r) => setTimeout(r, retryAfter));
      if (attempt < 5) continue;
    }

    return { ok: false, data: data ?? (await res.text().catch(() => "")), status: res.status };
  }
}

/** Proteção: limita mensagens muito grandes (Telegram ~4096) */
function truncateText(s: string, maxLen = DEFAULT_TRUNCATE) {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 20)) + "\n…(truncado)";
}

/** ======== API Principal ======== */
export async function dispatchMatchSignals(params: {
  game: "aviator";
  casa: CasaSlug;
  matches: MatchLike[];
  botId?: string; // aparece no rodapé e compõe a dedupeKey
  options?: SendOpts;
}) {
  const { game, casa, matches, botId = `${game}-${casa}`, options } = params;

  if (!ENABLED) {
    return {
      ok: true,
      sent: [] as SentItem[],
      skipped: matches.map((m) => ({ kind: "skipped", match: m, reason: "disabled" })) as SkippedItem[],
    };
  }

  const botToken = (options?.botToken || DEF_BOT_TOKEN).trim();
  const chatId = options?.chatId ?? DEF_CHAT_ID;

  const cooldownMs = 1000 * Math.max(0, options?.cooldownSec ?? COOLDOWN_SEC);
  const parseMode = options?.parseMode ?? DEFAULT_PARSE_MODE;
  const title = options?.titlePrefix || defaultTitle(game, casa);
  const maxLen = Math.max(512, options?.maxLen ?? DEFAULT_TRUNCATE);

  if (!botToken || chatId == null || `${chatId}`.trim() === "") {
    return {
      ok: false,
      reason: "missing_bot_or_chat",
      sent: [] as SentItem[],
      skipped: matches.map((m) => ({ kind: "skipped", match: m, reason: "no_credentials" })) as SkippedItem[],
    };
  }

  if (!Array.isArray(matches) || matches.length === 0) {
    return { ok: true, sent: [] as SentItem[], skipped: [] as SkippedItem[] };
  }

  const results: Array<SentItem | SkippedItem> = [];

  for (const m of matches) {
    const key = dedupeKey(botId, m);

    if (!canSend(key, cooldownMs)) {
      results.push({ kind: "skipped", match: m, reason: "cooldown" });
      continue;
    }

    // Montagem do texto (com escape para o parse_mode escolhido) — agora escapando também o título
    let text: string;
    if (parseMode === "MarkdownV2") {
      const safeTitle = escapeMdV2(title);
      const linha1 = `Estratégia: *${escapeMdV2(m.name)}* (mg=${m.mgCount}, winAt=${m.winAt})`;
      const linha2 = `Padrão: \`${escapeMdV2(joinColors(m.matchedPattern))}\``;
      const linha3 = `Janela: \`${escapeMdV2(joinColors(m.window))}\``;
      const rodape = `bot=${escapeMdV2(botId)} • ${escapeMdV2(new Date().toISOString())}`;
      text = `${safeTitle}\n${linha1}\n${linha2}\n${linha3}\n${rodape}`;
    } else {
      // HTML (default) ou Markdown legado
      const safeTitle = escapeHtml(title);
      const linha1 = `Estratégia: <b>${escapeHtml(m.name)}</b> (mg=${m.mgCount}, winAt=${m.winAt})`;
      const linha2 = `Padrão: <code>${escapeHtml(joinColors(m.matchedPattern))}</code>`;
      const linha3 = `Janela: <code>${escapeHtml(joinColors(m.window))}</code>`;
      const rodape = `bot=${escapeHtml(botId)} • ${new Date().toISOString()}`;
      text = `${safeTitle}\n${linha1}\n${linha2}\n${linha3}\n${rodape}`;
    }

    text = truncateText(text, maxLen);

    try {
      const res = await sendTelegram(botToken, chatId, text, parseMode);
      if (res.ok) {
        // Marca como enviado apenas se OK
        markSent(key);
        results.push({ kind: "sent", match: m, text, response: res.data });
      } else {
        results.push({
          kind: "skipped",
          match: m,
          reason: "telegram_error",
          detail: { status: res.status, body: res.data },
        });
      }
    } catch (e: any) {
      results.push({ kind: "skipped", match: m, reason: "exception", detail: String(e?.message ?? e) });
    }
  }

  const sent = results.filter((r) => r.kind === "sent") as SentItem[];
  const skipped = results.filter((r) => r.kind === "skipped") as SkippedItem[];

  return { ok: true, sent, skipped };
}

/* ===================== Diagnóstico & Reset ===================== */

/** Snapshot resumido com amostra de chaves recentes */
export function getAutoDispatchDiagnostics(options?: { limitKeys?: number }) {
  const limit = Math.max(1, options?.limitKeys ?? 100);
  const now = Date.now();
  const keys = Array.from(lastSent.keys());
  const sample = keys.slice(-limit).map((key) => {
    const lastAt = lastSent.get(key)!;
    return { key, lastAt, agoMs: now - lastAt };
  });

  return {
    ok: true as const,
    enabled: ENABLED,
    env: {
      hasBotToken: !!DEF_BOT_TOKEN,
      hasChatId: !!DEF_CHAT_ID_RAW,
      defaultCooldownSec: COOLDOWN_SEC,
      defaultParseMode: DEFAULT_PARSE_MODE as "HTML" | "MarkdownV2" | "Markdown",
      defaultTruncate: DEFAULT_TRUNCATE,
    },
    dedupe: {
      totalKeys: keys.length,
      sample,
    },
  };
}

/** Snapshot completo (compat) */
export function getAutoDispatchSnapshot() {
  const now = Date.now();
  const entries = Array.from(lastSent.entries()).map(([key, lastAt]) => ({
    key,
    lastAt,
    agoSec: Math.max(0, Math.round((now - lastAt) / 1000)),
  }));

  return {
    ok: true,
    enabled: ENABLED,
    defaults: {
      hasBotToken: !!DEF_BOT_TOKEN,
      hasChatId: !!DEF_CHAT_ID_RAW,
      cooldownSec: COOLDOWN_SEC,
      parseModeDefault: DEFAULT_PARSE_MODE as "HTML" | "MarkdownV2" | "Markdown",
      truncateDefault: DEFAULT_TRUNCATE,
    },
    counts: {
      lastSentSize: entries.length,
    },
    lastSent: entries,
  };
}

/** Limpa todo o mapa de dedupe (ou somente chaves específicas) */
export function resetAutoDispatchDedupe(keys?: string[]) {
  if (!keys || keys.length === 0) {
    const n = lastSent.size;
    lastSent.clear();
    return { ok: true as const, clearedAll: true, clearedCount: n };
  }
  let n = 0;
  for (const k of keys) if (lastSent.delete(k)) n++;
  return { ok: true as const, clearedAll: false, clearedCount: n };
}
