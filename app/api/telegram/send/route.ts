import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

export async function POST(req: NextRequest) {
  const { chatId, text } = await req.json();

  if (!chatId || !text) {
    return NextResponse.json({ ok: false, error: "chatId e text são obrigatórios" }, { status: 400 });
  }

  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = await resp.json();
  return NextResponse.json(data, { status: resp.ok ? 200 : 500 });
}
