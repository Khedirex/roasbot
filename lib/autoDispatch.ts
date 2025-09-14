// lib/autoDispatch.ts
// Dispara mensagens de match automaticamente (com cooldown em memória)
// Melhorias nesta versão:
// - Flag global de enable/disable por ENV (AUTO_DISPATCH_ENABLED=0 desliga).
// - Fallback automático para TELEGRAM_* se AUTO_* não estiverem setadas.
// - Cooldown configurável por chamada e por ENV (AUTO_SIGNAL_COOLDOWN_SEC).
// - Dedupe por (botId + strategyId + padrão). NÃO grava o envio se falhar.
// - Suporte a chatId numérico, parse_mode configurável (HTML/MarkdownV2).
// - Limite de segurança de tamanho da mensagem (truncate).
// - Snapshot de diagnóstico (getAutoDispatchSnapshot) sem expor credenciais.

import type { CasaSlug } from "@/lib/strategies";

/** ===== ENVs e Flags ===== */
const ENABLED = (process.env.AUTO_DISPATCH_ENABLED ?? "1") !== "0";

const DEF_BOT_TOKEN =
  (process.env.AUTO_TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();

const DEF_CHAT_ID_RAW =
  (process.env.AUTO_TG_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();

const DEF_CHAT_ID: string | number =
  DEF_CHAT_ID_RAW && !Number.isNaN(Number(DEF_CHAT_ID_RAW))
    ? Number(DEF_CHAT_ID_RAW)
    : DEF_CHAT_ID_RAW;

const COOLDOWN_SEC = Math.max(0, Number(process.env.AUTO_SIGNAL_COOLDOWN_SEC ?? "60"));

/** ===== Estado interno =====
 * chave: `${botId}:${strategyId}:${pattern}` → epoch ms do último envio bem-sucedido
 */
const lastSent = new Map<string, number>();

/** ===== Tipos ===== */
export type MatchLike = {
  strategyId: string;
  name: string;
  matchedPattern: string[];
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
  maxLen?: number; // default 3800 chars
  // Futuro: mute?: boolean; routeKey?: string; etc.
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
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escapeMdV2(s: string) {
  return String(s).replace(/([_\*\[\]\(\)~`>#+\-=|{}\.!\\])/g, "\\$1");
}

/** Telegram */
async function sendTelegram(
  botToken: string,
  chatId: string | number,
  text: string,
  parseMode: SendOpts["parseMode"] = "HTML",
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload: any = {
    chat_id: String(chatId),
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) payload.parse_mode = parseMode;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  return { ok: !!data?.ok, data };
}

/** Proteção: limita mensagens muito grandes (Telegram ~4096) */
function truncateText(s: string, maxLen = 3800) {
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
  const { game, casa, matches, botId = `${game}-${casa}` as const, options } = params;

  if (!ENABLED) {
    return {
      ok: true,
      sent: [] as SentItem[],
      skipped: matches.map((m) => ({ kind: "skipped", match: m, reason: "disabled" })) as SkippedItem[],
    };
  }

  const botToken = (options?.botToken || DEF_BOT_TOKEN).trim();
  const chatId =
    typeof options?.chatId !== "undefined" ? options!.chatId : DEF_CHAT_ID;

  const cooldownMs = 1000 * Math.max(0, options?.cooldownSec ?? COOLDOWN_SEC);
  const parseMode = options?.parseMode ?? "HTML";
  const title = options?.titlePrefix || defaultTitle(game, casa);
  const maxLen = Math.max(512, options?.maxLen ?? 3800);

  if (!botToken || chatId === undefined || chatId === null || String(chatId).trim?.() === "") {
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

    // Montagem do texto (com escape para o parse_mode escolhido)
    let text: string;
    if (parseMode === "MarkdownV2") {
      const linha1 = `Estratégia: *${escapeMdV2(m.name)}* (mg=${m.mgCount}, winAt=${m.winAt})`;
      const linha2 = `Padrão: \`${escapeMdV2(joinColors(m.matchedPattern))}\``;
      const linha3 = `Janela: \`${escapeMdV2(joinColors(m.window))}\``;
      const rodape = `bot=${escapeMdV2(botId)} • ${escapeMdV2(new Date().toISOString())}`;
      text = `${title}\n${linha1}\n${linha2}\n${linha3}\n${rodape}`;
    } else {
      // HTML (default)
      const linha1 = `Estratégia: <b>${escapeHtml(m.name)}</b> (mg=${m.mgCount}, winAt=${m.winAt})`;
      const linha2 = `Padrão: <code>${escapeHtml(joinColors(m.matchedPattern))}</code>`;
      const linha3 = `Janela: <code>${escapeHtml(joinColors(m.window))}</code>`;
      const rodape = `bot=${escapeHtml(botId)} • ${new Date().toISOString()}`;
      text = `${title}\n${linha1}\n${linha2}\n${linha3}\n${rodape}`;
    }

    text = truncateText(text, maxLen);

    try {
      const res = await sendTelegram(botToken, chatId, text, parseMode);
      if (res.ok) {
        // Marca como enviado apenas se OK
        markSent(key);
        results.push({ kind: "sent", match: m, text, response: res.data });
      } else {
        results.push({ kind: "skipped", match: m, reason: "telegram_error", detail: res.data });
      }
    } catch (e: any) {
      results.push({ kind: "skipped", match: m, reason: "exception", detail: String(e?.message ?? e) });
    }
  }

  const sent = results.filter((r) => r.kind === "sent") as SentItem[];
  const skipped = results.filter((r) => r.kind === "skipped") as SkippedItem[];

  return { ok: true, sent, skipped };
}

/* ===================== Snapshot de diagnóstico ===================== */
/** Fornece um snapshot do estado do auto-dispatch para debug/observabilidade. */
export function getAutoDispatchSnapshot() {
  const now = Date.now();
  const entries = Array.from(lastSent.entries()).map(([key, lastAt]) => ({
    key,                   // `${botId}:${strategyId}:${pattern}`
    lastAt,                // epoch ms
    agoSec: Math.max(0, Math.round((now - lastAt) / 1000)),
  }));

  return {
    ok: true,
    enabled: ENABLED,
    defaults: {
      hasBotToken: !!DEF_BOT_TOKEN,
      hasChatId: !!DEF_CHAT_ID_RAW,
      cooldownSec: COOLDOWN_SEC,
      parseModeDefault: "HTML",
    },
    counts: {
      lastSentSize: entries.length,
    },
    lastSent: entries,
  };
}
