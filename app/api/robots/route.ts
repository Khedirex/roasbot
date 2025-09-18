// app/api/robots/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* --------- CORS / JSON --------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

/* --------- Helpers --------- */
// garante objeto antes de usar spread; evita erro "spread only on object types"
function asObj<T extends object = Record<string, any>>(v: unknown): T {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T);
}

/** Normaliza o corpo vindo da UI para o schema do Prisma */
function normalize(b: any) {
  const game = typeof b.game === "string" ? b.game.trim() : "aviator";
  const casa = typeof b.casa === "string" ? b.casa.trim() : "1win";
  const kind = typeof b.name === "string" ? b.name.trim() : "Robot";
  const active = typeof b.isActive === "boolean" ? b.isActive : false;

  const botToken =
    typeof b.botToken === "string" ? (b.botToken.trim() || null) : b.botToken ?? null;

  const chatId =
    b.chatId === undefined || b.chatId === null ? null : String(b.chatId).trim() || null;

  // schedule vem como startTime/endTime na UI; guardamos em templates.schedule
  const start = b.startTime ?? null;
  const end = b.endTime ?? null;

  return { game, casa, kind, active, botToken, chatId, start, end };
}

/** Converte DB -> resposta */
function toOut(t: any) {
  const base = asObj(t?.templates);
  const sch = asObj(base?.schedule);
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

/* --------- GET /api/robots  (lista) --------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // aceita ?game=...&casa=... (e tolera ?name=... como alias de game, se vier)
    const game = (url.searchParams.get("game") || url.searchParams.get("name") || "").trim();
    const casa = (url.searchParams.get("casa") || "").trim();

    const where: any = {};
    if (game) where.game = game;
    if (casa) where.casa = casa;

    const rows = await prisma.telegramTarget.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return json(200, { ok: true, data: rows.map(toOut) });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_GET_FAILED" });
  }
}

/* --------- POST /api/robots (create/update) --------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : undefined;
    const { game, casa, kind, active, botToken, chatId, start, end } = normalize(body);

    // se mandou id -> upsert; se não, create
    if (id) {
      const curr = await prisma.telegramTarget.findUnique({ where: { id } });

      // normaliza JSON existente e mergeia schedule
      const base = asObj(curr?.templates);
      const prev = asObj(base.schedule);

      const templates: Prisma.InputJsonValue = {
        ...base,
        schedule: {
          start: start !== undefined ? start : prev.start ?? null,
          end: end !== undefined ? end : prev.end ?? null,
        },
      };

      const up = await prisma.telegramTarget.upsert({
        where: { id },
        create: {
          id,
          game,
          casa,
          kind,
          active,
          botToken,
          chatId,
          templates: { schedule: { start, end } } as Prisma.InputJsonValue,
        },
        update: {
          game,
          casa,
          kind,
          active,
          botToken,
          chatId,
          templates,
        },
      });

      return json(201, { ok: true, data: toOut(up) });
    }

    // sem id => criar
    const created = await prisma.telegramTarget.create({
      data: {
        game,
        casa,
        kind,
        active,
        botToken,
        chatId,
        templates: { schedule: { start, end } } as Prisma.InputJsonValue,
      },
    });

    return json(201, { ok: true, data: toOut(created) });
  } catch (e: any) {
    const msg = e?.message || "ROBOTS_POST_FAILED";
    return json(400, { ok: false, error: msg });
  }
}
