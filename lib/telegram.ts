// lib/telegram.ts

export const defaultBotToken =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.AUTO_TG_BOT_TOKEN ||
  "";

export const defaultChatId =
  process.env.TELEGRAM_CHAT_ID ||
  process.env.AUTO_TG_CHAT_ID ||
  "";

/**
 * Escape para MarkdownV2 (Telegram).
 * Use somente quando for enviar com parse_mode: "MarkdownV2".
 * OBS.: "<" não precisa de escape no MarkdownV2 (o problema era no HTML).
 */
export function esc(s: string) {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

type SendOpts = {
  /** "MarkdownV2" para formatar; default: sem parse_mode */
  parseMode?: "MarkdownV2" | null;
  /** Se true e parseMode=MarkdownV2, aplica esc() automaticamente */
  escape?: boolean;
  /** Tempo de timeout por tentativa (ms). Default 8000 */
  timeoutMs?: number;
  /** Máximo de tentativas em 429/5xx. Default 5 */
  maxAttempts?: number;
};

/**
 * Envia mensagem ao Telegram.
 * Assinatura compatível com o worker: sendTelegram(text, token?, chatId?, opts?)
 * - Se token/chatId não forem passados, usa default do .env.
 * - Por padrão NÃO usa parse_mode (evita erro com "<2.0").
 * - Para MarkdownV2: sendTelegram(text, token, chatId, { parseMode: "MarkdownV2", escape: true })
 */
export async function sendTelegram(
  text: string,
  token?: string,
  chatId?: string | number,
  opts: SendOpts = {}
) {
  const t = token || defaultBotToken;
  const c = chatId ?? defaultChatId;

  if (!t || !c) throw new Error("Telegram token/chatId ausentes.");

  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 5);

  const url = `https://api.telegram.org/bot${t}/sendMessage`;

  const payload: any = {
    chat_id: c,
    text:
      opts.parseMode === "MarkdownV2" && opts.escape
        ? esc(text)
        : text,
    disable_web_page_preview: true,
  };
  if (opts.parseMode) payload.parse_mode = opts.parseMode;

  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) return await res.json();

    // Retry em 429/5xx com backoff exponencial limitado
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const retryAfter =
        Number(res.headers.get("retry-after")) ||
        Math.min(1000 * 2 ** attempt, 15000);
      await new Promise((r) => setTimeout(r, retryAfter));
      if (attempt < maxAttempts) continue;
    }

    const errText = await res.text().catch(() => "");
    throw new Error(`Telegram error ${res.status}: ${errText}`);
  }
}
