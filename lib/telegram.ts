// Mantém sua função de escape (inalterada)
export function esc(s: string) {
  // Escape para MarkdownV2 (Telegram)
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** Opções adicionais (não obrigatórias) */
type SendTelegramOpts = {
  /** Prefixo opcional no título da msg (ex.: "⚡️ Aviator") */
  title?: string;
  /** "HTML" | "Markdown" | "MarkdownV2" (default mantém MarkdownV2) */
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  /** Desliga prévias de link (default: true) */
  disable_web_page_preview?: boolean;
  /** Notificação silenciosa */
  disable_notification?: boolean;
  /** Responder a uma msg existente */
  reply_to_message_id?: number;
  /** Não escapar o texto quando parse_mode = MarkdownV2 (você garante o escape) */
  raw?: boolean;
  /** Limite de tentativas (default 5) */
  max_attempts?: number;
  /** Timeout de cada tentativa em ms (default 8000) */
  timeout_ms?: number;
};

/**
 * Backward-compatible:
 *  - uso antigo: sendTelegram(chatId, text, token)
 *  - uso novo:   sendTelegram(chatId, text, token, { ...opts })
 */
export async function sendTelegram(
  chatId: string | number,
  text: string,
  token: string,
  opts: SendTelegramOpts = {},
) {
  const {
    title,
    parse_mode = "MarkdownV2",
    disable_web_page_preview = true,
    disable_notification,
    reply_to_message_id,
    raw = false,
    max_attempts = 5,
    timeout_ms = 8000,
  } = opts;

  // Prefixo opcional
  let finalText = title ? `${title}\n${text}` : text;

  // Mantém comportamento antigo: escapamos em MarkdownV2 por padrão
  const payloadText =
    parse_mode === "MarkdownV2" && !raw ? esc(finalText) : finalText;

  // Telegram: limite 4096 chars. Se exceder, corta com sufixo.
  const MAX = 4096;
  const SUF = "\n…";
  const safeText =
    payloadText.length > MAX ? payloadText.slice(0, MAX - SUF.length) + SUF : payloadText;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: safeText,
    parse_mode,
    disable_web_page_preview,
  };
  if (typeof disable_notification === "boolean") body.disable_notification = disable_notification;
  if (typeof reply_to_message_id === "number") body.reply_to_message_id = reply_to_message_id;

  let attempt = 0;
  /* eslint-disable no-constant-condition */
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout_ms),
    });

    if (res.ok) return await res.json();

    // Retry em 429/5xx com backoff exponencial limitado (mantém seu padrão)
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const retryAfter =
        Number(res.headers.get("retry-after")) ||
        Math.min(1000 * 2 ** attempt, 15000);
      await new Promise((r) => setTimeout(r, retryAfter));
      if (attempt < max_attempts) continue;
    }

    const errText = await res.text().catch(() => "");
    throw new Error(`Telegram error ${res.status}: ${errText}`);
  }
  /* eslint-enable no-constant-condition */
}
