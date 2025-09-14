export function esc(s: string) {
  // Escape para MarkdownV2 (Telegram)
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export async function sendTelegram(chatId: string | number, text: string, token: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "MarkdownV2", disable_web_page_preview: true };

  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) return await res.json();

    // Retry em 429/5xx com backoff exponencial limitado
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const retryAfter = Number(res.headers.get("retry-after")) || Math.min(1000 * 2 ** attempt, 15000);
      await new Promise(r => setTimeout(r, retryAfter));
      if (attempt < 5) continue;
    }

    const errText = await res.text().catch(() => "");
    throw new Error(`Telegram error ${res.status}: ${errText}`);
  }
}
