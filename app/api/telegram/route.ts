// app/api/send/telegram/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ===== CORS / JSON ===== */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-requested-with",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};
const json = (status: number, data: unknown) =>
  new NextResponse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { status, headers: JSON_HEADERS },
  );

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ===== Helpers ===== */
function requireSignalKey(req: Request) {
  const expected = (process.env.SIGNAL_API_KEY || "").trim();
  if (!expected) return true; // se não setou no .env, não exige
  const got = (req.headers.get("x-api-key") || "").trim();
  return got === expected;
}

function parseChatId(raw: unknown): string | number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // aceita -100..., números, ou @canal
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

function sanitizeParseMode(
  v: any,
): "HTML" | "Markdown" | "MarkdownV2" | undefined {
  if (v === "HTML" || v === "Markdown" || v === "MarkdownV2") return v;
  return undefined;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ===== GET (diagnóstico simples) ===== */
export async function GET() {
  return json(200, {
    ok: true,
    info: "POST this endpoint to send a Telegram message",
    env: {
      hasBotToken: !!(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
      hasAlertsChatId: !!(process.env.ALERTS_CHAT_ID || "").trim(),
      requiresApiKey: !!(process.env.SIGNAL_API_KEY || "").trim(),
    },
  });
}

/* ===== POST /api/send/telegram ===== */
export async function POST(req: Request) {
  try {
    if (!requireSignalKey(req)) {
      return json(401, { ok: false, error: "unauthorized" });
    }

    // Tenta JSON; se falhar, aceita ?text=...
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      const url = new URL(req.url);
      const t = url.searchParams.get("text");
      if (t) body.text = t;
    }

    // Defaults do .env
    const envToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const envChatRaw = (process.env.ALERTS_CHAT_ID || "").trim();

    // Aliases aceitos no body
    const botToken: string = (body?.botToken ?? body?.token ?? envToken ?? "").trim();
    const chatId: string | number | null = parseChatId(
      body?.chatId ?? body?.chat_id ?? envChatRaw,
    );
    const textRaw: string = String(body?.text ?? "").trim();

    const parse_mode = sanitizeParseMode(body?.parse_mode);
    const disable_web_page_preview: boolean = !!body?.disable_web_page_preview;
    const disable_notification: boolean = !!body?.disable_notification;
    const reply_to_message_id: number | undefined =
      Number.isFinite(+body?.reply_to_message_id)
        ? Number(body?.reply_to_message_id)
        : undefined;

    // Título opcional (prefixo)
    const title: string =
      typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "";
    const safeTitle = parse_mode === "HTML" ? escapeHtml(title) : title;
    const text = safeTitle ? `${safeTitle}\n${textRaw}` : textRaw;

    if (!botToken || !chatId || !text) {
      return json(400, {
        ok: false,
        error: "missing_params",
        need: [
          "botToken (ou TELEGRAM_BOT_TOKEN no .env)",
          "chatId (ou ALERTS_CHAT_ID no .env)",
          "text",
        ],
      });
    }

    // Timeout defensivo
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15_000);

    const resp = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode,
          disable_web_page_preview,
          disable_notification,
          reply_to_message_id,
        }),
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(id));

    let data: any = null;
    try {
      data = await resp.json();
    } catch {
      /* ignore */
    }

    if (!resp.ok || !data?.ok) {
      return json(502, {
        ok: false,
        error: "telegram_error",
        status: resp.status,
        body: data,
      });
    }

    return json(200, { ok: true, result: data.result ?? data });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "send_error",
      message: String(e?.message ?? e),
    });
  }
}
