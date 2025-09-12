// app/api/messages/render/route.ts
import { NextResponse } from "next/server";
import { renderTemplate, type MessageContext } from "@/lib/messageTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template: string = body?.template ?? "";
    const ctx: MessageContext = body?.ctx ?? {};

    if (!template || typeof template !== "string") {
      return new NextResponse(JSON.stringify({ ok: false, error: "invalid_template" }), { status: 400, headers: JSON_HEADERS });
    }

    const text = renderTemplate(template, ctx);
    return new NextResponse(JSON.stringify({ ok: true, text }), { status: 200, headers: JSON_HEADERS });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: "render_error", message: String(e?.message ?? e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
