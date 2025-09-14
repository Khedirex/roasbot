import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

// Healthcheck opcional
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // 1) Valida o secret enviado pelo Telegram
  const recvSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!SECRET || recvSecret !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Lê o update
  const update = await req.json();
  const message =
    update.message ||
    update.edited_message ||
    update.callback_query?.message;

  const text: string | undefined = message?.text;
  const chatId: number | undefined = message?.chat?.id;

  // 3) Trate /start (com ou sem parâmetro)
  if (chatId && text?.startsWith("/start")) {
    const parts = text.split(" ");
    const param = parts[1]; // se houver t.me/bot?start=PARAM
    if (param) {
      // TODO: salvar { uid: param, chatId } no seu DB
      await sendTelegram(chatId, `Conta vinculada ✅ (uid=${param})`);
    } else {
      await sendTelegram(
        chatId,
        "Bot conectado ✅. Seu site vai te enviar alertas por aqui."
      );
    }
  }

  // Dica: log leve (cuidado em prod!)
  // console.log("update", JSON.stringify(update));

  // 4) SEMPRE responda rápido (<= 5s) com 200
  return NextResponse.json({ ok: true });
}

async function sendTelegram(chatId: number | string, text: string) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error("sendMessage fail:", resp.status, body);
  }
}
