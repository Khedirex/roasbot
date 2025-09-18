import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function POST(req: Request) {
  try {
    const { id, chatId, text, parseMode }: { id?: string; chatId?: string; text?: string; parseMode?: "HTML"|"MarkdownV2" } = await req.json();

    // prioridade: id > chatId > primeiro ativo
    let target: any = null;
    if (id)      target = await prisma.telegramTarget.findUnique({ where: { id: String(id) } });
    if (!target && chatId) target = await prisma.telegramTarget.findFirst({ where: { chatId: String(chatId) } });
    if (!target) target = await prisma.telegramTarget.findFirst({ where: { active: true } });

    if (!target) return json(404, { ok: false, error: "TARGET_NOT_FOUND" });
    if (!target.botToken || !target.chatId) return json(400, { ok: false, error: "MISSING_BOT_OR_CHAT" });

    const res = await sendTelegram(text ?? "ping", target.botToken, target.chatId, {
      parseMode: parseMode ?? null,  // default sem parse_mode
      disableWebPagePreview: true,
      truncateAt: 4096,
    });

    return json(200, { ok: true, result: res?.result ?? res, target: { id: target.id, chatId: target.chatId } });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "PING_FAILED" });
  }
}
