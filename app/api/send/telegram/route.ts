// app/api/send/telegram/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export async function POST(req: Request) {
  try {
    const { botToken, chatId, text, disable_web_page_preview, disable_notification } = await req.json();

    if (!botToken || !chatId || !text) {
      return new NextResponse(JSON.stringify({ ok: false, error: "missing_params" }), { status: 400, headers: JSON_HEADERS });
    }

    // Envia como texto simples (sem parse_mode) para evitar problemas de escape
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: !!disable_web_page_preview,
        disable_notification: !!disable_notification,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data?.ok) {
      return new NextResponse(JSON.stringify({ ok: false, error: "telegram_error", response: data }), {
        status: 502,
        headers: JSON_HEADERS,
      });
    }

    return new NextResponse(JSON.stringify({ ok: true, result: data.result }), { status: 200, headers: JSON_HEADERS });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: "send_error", message: String(e?.message ?? e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
