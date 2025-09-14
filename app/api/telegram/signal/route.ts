import { NextRequest, NextResponse } from "next/server";

// ===== Config Next =====
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ===== ENVs =====
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const DEFAULT_CHAT = process.env.ALERTS_CHAT_ID?.trim();
const SINGLE_KEY = process.env.SIGNAL_API_KEY?.trim(); // compat
const MULTI_KEYS = process.env.SIGNAL_API_KEYS?.trim();

// ===== Utils =====
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-requested-with",
};

const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });

// Escape para MarkdownV2 (Telegram)
function esc(s: string) {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// Limites Telegram
const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;

type SignalPayload = {
  chatId?: string | number;
  strategy?: string;
  event?: "OPPORTUNITY" | "WIN" | "RED" | "MARTINGALE" | "MIRROR" | string;
  odds?: string | number;
  mg?: number;
  when?: string;
  note?: string;
  text?: string;      // se presente, sobrescreve o template
  imageUrl?: string;  // se presente, usa sendPhoto
  buttonText?: string;
  buttonUrl?: string;
};

// === Keys ===
function allowedKeys(): Set<string> {
  const list = [
    ...(MULTI_KEYS ? MULTI_KEYS.split(",") : []),
    ...(SINGLE_KEY ? [SINGLE_KEY] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

function readHeaderKey(req: NextRequest): string | null {
  const x = req.headers.get("x-api-key")?.trim();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return x || bearer || null;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return json(405, { ok: false, error: "method not allowed" });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // === Env sanity ===
  if (!TOKEN || !DEFAULT_CHAT) {
    return json(500, { ok: false, error: "Server misconfig: TELEGRAM_BOT_TOKEN ou ALERTS_CHAT_ID ausente" });
  }
  const keys = allowedKeys();
  if (keys.size === 0) {
    return json(500, { ok: false, error: "Server misconfig: SIGNAL_API_KEYS/KEY ausente" });
  }

  // === Auth ===
  const headerKey = readHeaderKey(req);
  if (!headerKey || !keys.has(headerKey)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  // === Body ===
  let payload: SignalPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid json" });
  }

  const chatId = payload.chatId ?? DEFAULT_CHAT;
  if (!chatId) {
    return json(400, { ok: false, error: "missing chatId and ALERTS_CHAT_ID" });
  }

  // === Monta texto ===
  let text: string;
  if (payload.text && payload.text.trim()) {
    text = payload.text;
  } else {
    const parts: string[] = [];
    const title = payload.event ? `*${esc(String(payload.event))}*` : "*Sinal*";
    parts.push(`${title}${payload.strategy ? ` — ${esc(payload.strategy)}` : ""}`);

    const line: string[] = [];
    if (payload.odds !== undefined) line.push(`🎯 *Odds:* ${esc(String(payload.odds))}`);
    if (payload.mg !== undefined) line.push(`🎲 *MG:* ${esc(String(payload.mg))}`);
    if (payload.when) line.push(`⏱️ *Hora:* ${esc(payload.when)}`);
    const SEP = " \\| ";
  if (line.length) parts.push(line.join(SEP));

  if (payload.note) parts.push(`📝 ${esc(payload.note)}`);
  text = parts.join("\n");
}

  // Trunca para evitar 400 do Telegram por tamanho
  const isPhoto = !!payload.imageUrl;
  if (isPhoto && text.length > MAX_CAPTION) text = text.slice(0, MAX_CAPTION - 1) + "…";
  if (!isPhoto && text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 1) + "…";

  // === Dry-run ===
  const { searchParams } = new URL(req.url);
  if (searchParams.get("dry") === "1") {
    return json(200, {
      ok: true,
      debug: {
        chatId,
        isPhoto,
        hasButton: !!(payload.buttonText && payload.buttonUrl),
        preview: text,
        envs: {
          TELEGRAM_BOT_TOKEN: true,
          ALERTS_CHAT_ID: true,
          SIGNAL_KEYS: keys.size,
        },
      },
    });
  }

  // === Botão opcional ===
  let reply_markup: any | undefined;
  if (payload.buttonText && payload.buttonUrl) {
    reply_markup = {
      inline_keyboard: [[{ text: payload.buttonText, url: payload.buttonUrl }]],
    };
  }

  // === Envio Telegram ===
  try {
    const endpoint = isPhoto ? "sendPhoto" : "sendMessage";
    const body: Record<string, any> = { chat_id: chatId, parse_mode: "MarkdownV2" };

    if (isPhoto) {
      body.photo = payload.imageUrl;
      body.caption = text;
    } else {
      body.text = text;
      body.disable_web_page_preview = true;
    }
    if (reply_markup) body.reply_markup = reply_markup;

    const resp = await fetch(`https://api.telegram.org/bot${TOKEN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Tente JSON; se não der, caia no texto cru para log
    let data: any = null;
    try {
      data = await resp.json();
    } catch {
      // ignore
    }

    if (!resp.ok || (data && data.ok === false)) {
      const detail = data ?? (await resp.text().catch(() => resp.statusText));
      console.error(`[signal] ${endpoint} fail:`, resp.status, detail);
      return json(502, { ok: false, error: "telegram send failed", detail });
    }

    return json(200, { ok: true, result: data?.result ?? true, elapsedMs: Date.now() - startedAt });
  } catch (e: any) {
    console.error("[signal] unhandled:", e?.stack || e);
    return json(500, { ok: false, error: e?.message ?? "send failed" });
  }
}
