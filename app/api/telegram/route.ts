// app/api/send/telegram/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

// Responde ao preflight (evita erros de CORS no browser)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "content-type,authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // aceita aliases comuns
    const botToken: string = body?.botToken ?? body?.token ?? "";
    const chatId: string | number = body?.chatId ?? body?.chat_id ?? "";
    const text: string = body?.text ?? "";
    const parse_mode: "HTML" | "Markdown" | "MarkdownV2" | undefined = body?.parse_mode;
    const disable_web_page_preview: boolean = !!body?.disable_web_page_preview;
    const disable_notification: boolean = !!body?.disable_notification;
    const reply_to_message_id: number | undefined = body?.reply_to_message_id;

    if (!botToken || !chatId || !text) {
      return json(400, {
        ok: false,
        error: "missing_params",
        need: ["botToken", "chatId", "text"],
      });
    }

    // Timeout defensivo para a chamada externa
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
      }
    ).finally(() => clearTimeout(id));

    // pode falhar sem JSON quando há erro de rede
    let data: any = null;
    try {
      data = await resp.json();
    } catch {
      /* ignore */
    }

    if (!resp.ok || !data?.ok) {
      // Não logamos token para evitar vazamento
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
