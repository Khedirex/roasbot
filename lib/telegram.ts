// lib/telegram.ts

export const defaultBotToken =
  (process.env.TELEGRAM_BOT_TOKEN ||
    process.env.AUTO_TG_BOT_TOKEN ||
    "").trim();

export const defaultChatId =
  (process.env.TELEGRAM_CHAT_ID ||
    process.env.AUTO_TG_CHAT_ID ||
    "").trim();

/**
 * Escape para MarkdownV2 (Telegram).
 * Use somente quando for enviar com parse_mode: "MarkdownV2".
 * OBS.: "<" não precisa de escape no MarkdownV2 (o problema comum é no HTML).
 */
export function esc(s: string) {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

type SendOpts = {
  /** "MarkdownV2" | "HTML"; default: undefined (sem parse_mode) */
  parseMode?: "MarkdownV2" | "HTML" | null;
  /** Se true e parseMode=MarkdownV2, aplica esc() automaticamente */
  escape?: boolean;
  /** Tempo de timeout por tentativa (ms). Default 8000 */
  timeoutMs?: number;
  /** Máximo de tentativas em 429/5xx. Default 5 */
  maxAttempts?: number;
  /** Faz fallback para form-urlencoded se JSON falhar. Default true */
  formFallback?: boolean;
  /** (Default true) Desliga preview de link */
  disableWebPagePreview?: boolean;
  /** (Default false) Envia silencioso */
  disableNotification?: boolean;
  /** Trunca a mensagem se exceder (ex.: 4096). Se não definido, não trunca. */
  truncateAt?: number;
};

const TG_BASE = "https://api.telegram.org";

function buildText(raw: string, opts: SendOpts) {
  let text = String(raw ?? "");
  if (opts.truncateAt && text.length > opts.truncateAt) {
    text = text.slice(0, Math.max(0, opts.truncateAt - 1)) + "…";
  }
  if (opts.parseMode === "MarkdownV2" && opts.escape) {
    text = esc(text);
  }
  return text;
}

async function sendJsonAttempt(
  token: string,
  chatId: string,
  text: string,
  opts: SendOpts,
): Promise<{ ok: boolean; status?: number; body?: any; error?: string; ms: number }> {
  const url = `${TG_BASE}/bot${token}/sendMessage`;
  const startedAt = Date.now();
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      disable_web_page_preview: opts.disableWebPagePreview ?? true,
      disable_notification: opts.disableNotification ?? false,
    };
    if (opts.parseMode) payload.parse_mode = opts.parseMode;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });

    const body = await res
      .json()
      .catch(async () => ({ raw: await res.text().catch(() => "") }));

    if (res.ok && body?.ok) {
      return { ok: true, status: res.status, body, ms: Date.now() - startedAt };
    }
    return {
      ok: false,
      status: res.status,
      body,
      error: body?.description || `HTTP ${res.status}`,
      ms: Date.now() - startedAt,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "FETCH_FAILED",
      ms: Date.now() - startedAt,
    };
  }
}

async function sendFormAttempt(
  token: string,
  chatId: string,
  text: string,
  opts: SendOpts,
): Promise<{ ok: boolean; status?: number; body?: any; error?: string; ms: number }> {
  const url = `${TG_BASE}/bot${token}/sendMessage`;
  const startedAt = Date.now();
  try {
    const form = new URLSearchParams();
    form.set("chat_id", chatId);
    form.set("text", text);
    form.set("disable_web_page_preview", String(opts.disableWebPagePreview ?? true));
    form.set("disable_notification", String(opts.disableNotification ?? false));
    if (opts.parseMode) form.set("parse_mode", opts.parseMode);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });

    const body = await res
      .json()
      .catch(async () => ({ raw: await res.text().catch(() => "") }));

    if (res.ok && body?.ok) {
      return { ok: true, status: res.status, body, ms: Date.now() - startedAt };
    }
    return {
      ok: false,
      status: res.status,
      body,
      error: body?.description || `HTTP ${res.status}`,
      ms: Date.now() - startedAt,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "FETCH_FAILED",
      ms: Date.now() - startedAt,
    };
  }
}

/**
 * Envia mensagem ao Telegram.
 * Assinatura compatível com o seu worker:
 *   sendTelegram(text, token?, chatId?, opts?)
 * - Se token/chatId não forem passados, usa defaults do .env.
 * - Por padrão NÃO usa parse_mode (evita erro com "<2.0").
 * - Para MarkdownV2: sendTelegram(text, token, chatId, { parseMode: "MarkdownV2", escape: true })
 * - Para HTML: sendTelegram(text, token, chatId, { parseMode: "HTML" })
 */
export async function sendTelegram(
  text: string,
  token?: string,
  chatId?: string | number,
  opts: SendOpts = {},
) {
  // depois (usa só ??, sem misturar com ||)
  const t = (token ?? defaultBotToken ?? "").toString().trim();

  const cRaw = chatId ?? defaultChatId ?? "";
  const c = String(cRaw).trim();

  if (!t || !c) throw new Error("Telegram token/chatId ausentes.");

  const maxAttempts = Math.max(1, opts.maxAttempts ?? 5);
  const msg = buildText(text, opts);

  // Tenta JSON com backoff exponencial em 429/5xx
  let attempt = 0;
  let lastJsonError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    const r = await sendJsonAttempt(t, c, msg, opts);
    if (r.ok) return r.body; // mantém retorno original da API do Telegram (retrocompatível)
    lastJsonError = r;

    // retry only if 429/5xx
    const status = r.status ?? 0;
    if (status === 429 || (status >= 500 && status < 600)) {
      const retryAfter =
        Number((r.body?.parameters && r.body.parameters.retry_after) || 0) ||
        Math.min(1000 * 2 ** attempt, 15000);
      await new Promise((resolve) => setTimeout(resolve, retryAfter));
      continue;
    }
    break; // status 4xx (exceto 429) não adianta tentar de novo
  }

  // Fallback opcional para form-urlencoded
  if (opts.formFallback !== false) {
    const rForm = await sendFormAttempt(t, c, msg, opts);
    if (rForm.ok) return rForm.body;
    // Junta diagnósticos
    const jErr = (lastJsonError && (lastJsonError.error || lastJsonError.body?.description)) || "JSON_FAILED";
    const fErr = rForm.error || rForm.body?.description || "FORM_FAILED";
    throw new Error(`Telegram send failed | json: ${jErr} | form: ${fErr}`);
  }

  // Sem fallback
  const jErr = (lastJsonError && (lastJsonError.error || lastJsonError.body?.description)) || "JSON_FAILED";
  throw new Error(`Telegram send failed (no fallback) | json: ${jErr}`);
}
