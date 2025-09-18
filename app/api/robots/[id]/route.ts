// app/api/robots/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---------- utils ---------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Banco -> Front */
function toOut(t: any) {
  const base = (t?.templates ?? {}) as any;     // <- tipagem solta só aqui
  const sch  = (base?.schedule ?? {}) as any;
  return {
    id: t.id,
    game: t.game,
    casa: t.casa,
    name: t.kind,
    botToken: t.botToken ?? "",
    chatId: t.chatId ?? "",
    isActive: !!t.active,
    startTime: sch.start ?? null,
    endTime: sch.end ?? null,
    updatedAt: t.updatedAt,
  };
}

/* ---------- GET /api/robots/[id] ---------- */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const t = await prisma.telegramTarget.findUnique({ where: { id: ctx.params.id } });
    if (!t) return json(404, { ok: false, error: "robot not found" });
    return json(200, { ok: true, data: toOut(t) });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_ID_GET_FAILED" });
  }
}

/* ---------- PATCH /api/robots/[id] ---------- */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const b = await req.json();

    // botToken: undefined=não altera | null/""=limpa | string
    const rawToken = (b as any).botToken;
    let token: string | null | undefined;
    if (rawToken === undefined) token = undefined;
    else if (rawToken === null) token = null;
    else if (typeof rawToken === "string") token = rawToken.trim() === "" ? null : rawToken.trim();
    else token = undefined;

    // chatId: undefined=não altera | null/""=limpa | string/number
    const chatIdStr =
      b.chatId === undefined || b.chatId === null ? undefined : String(b.chatId).trim();
    const chatId = chatIdStr === undefined ? undefined : chatIdStr === "" ? null : chatIdStr;

    const data: any = {};
    if (typeof b.game === "string") data.game = b.game.trim();
    if (typeof b.casa === "string") data.casa = b.casa.trim();
    if (typeof b.name === "string") data.kind = b.name.trim();
    if (typeof b.isActive === "boolean") data.active = b.isActive;
    if (token !== undefined) data.botToken = token;
    if (chatId !== undefined) data.chatId = chatId;

    // Merge seguro do schedule quando vier startTime/endTime
    if ("startTime" in b || "endTime" in b) {
      const curr = await prisma.telegramTarget.findUnique({ where: { id: ctx.params.id } });
      if (!curr) return json(404, { ok: false, error: "robot not found" });

      const base = (curr.templates ?? {}) as any;      // <- força objeto
      const prev = (base.schedule ?? {}) as any;

      const schedule = {
        start: b.startTime !== undefined ? b.startTime : prev.start ?? null,
        end:   b.endTime   !== undefined ? b.endTime   : prev.end   ?? null,
      };

      data.templates = { ...base, schedule };
    }

    const up = await prisma.telegramTarget.update({ where: { id: ctx.params.id }, data });
    return json(200, { ok: true, data: toOut(up) });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_ID_PATCH_FAILED" });
  }
}

/* ---------- DELETE /api/robots/[id] ---------- */
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    await prisma.telegramTarget.delete({ where: { id: ctx.params.id } });
    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_ID_DELETE_FAILED" });
  }
}
