// app/api/robots/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---------- JSON helpers para templates.schedule ---------- */
const asObj = (v: Prisma.JsonValue | null | undefined): Prisma.JsonObject =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Prisma.JsonObject) : ({} as Prisma.JsonObject);

function readSchedule(templates: Prisma.JsonValue | null | undefined) {
  const base = asObj(templates);
  const sch = asObj(base["schedule"] as Prisma.JsonValue);
  const start = typeof sch["start"] === "string" ? (sch["start"] as string) : null;
  const end = typeof sch["end"] === "string" ? (sch["end"] as string) : null;
  return { start, end };
}

function mergeSchedule(
  current: Prisma.JsonValue | null | undefined,
  startIn?: string | null,
  endIn?: string | null
): Prisma.InputJsonValue {
  const base = asObj(current);
  const prev = asObj(base["schedule"] as Prisma.JsonValue);

  const nextSch: Prisma.JsonObject = {
    start: startIn !== undefined ? startIn : (prev["start"] as string | null) ?? null,
    end: endIn !== undefined ? endIn : (prev["end"] as string | null) ?? null,
  };

  return { ...base, schedule: nextSch } as Prisma.InputJsonValue;
}

/* ---------- util HTTP ---------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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

/* ---------- tipos de entrada ---------- */
type RobotIn = {
  id?: string;
  game?: string;
  casa?: string;
  name?: string;                   // -> kind
  botToken?: string | null;        // -> botToken
  chatId?: string | number | null; // -> chatId
  isActive?: boolean;              // -> active
  startTime?: string | null;
  endTime?: string | null;
};

const isObj = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);

/* ---------- map banco -> front ---------- */
function toRobotOut(t: any) {
  const { start, end } = readSchedule(t?.templates);
  return {
    id: t.id,
    game: t.game,
    casa: t.casa,
    name: t.kind,
    botToken: t.botToken ?? "",
    chatId: t.chatId ?? "",
    isActive: !!t.active,
    startTime: start,
    endTime: end,
    updatedAt: t.updatedAt,
  };
}

/** Garante espelho em `Robot` com o MESMO id do TelegramTarget */
async function ensureRobotMirrorByTargetId(id: string) {
  const t = await prisma.telegramTarget.findUnique({ where: { id } });
  if (!t) return;

  const { start, end } = readSchedule(t.templates);

  // Ajuste os campos abaixo conforme o seu modelo `Robot`
  await prisma.robot.upsert({
    where: { id: t.id },
    update: {
      game: t.game,
      casa: t.casa,
      name: t.kind,
      botToken: t.botToken ?? null,
      chatId: t.chatId ?? null,
      isActive: t.active ?? false,
      startTime: start ?? null,
      endTime: end ?? null,
    } as any,
    create: {
      id: t.id,
      game: t.game,
      casa: t.casa,
      name: t.kind,
      botToken: t.botToken ?? null,
      chatId: t.chatId ?? null,
      isActive: t.active ?? false,
      startTime: start ?? null,
      endTime: end ?? null,
    } as any,
  });
}

/* ---------- GET /api/robots ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const game = searchParams.get("game") || undefined;
    const casa = searchParams.get("casa") || undefined;

    const where: any = {};
    if (game) where.game = game;
    if (casa) where.casa = casa;

    const list = await prisma.telegramTarget.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return json(200, { ok: true, data: list.map(toRobotOut) });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_GET_FAILED" });
  }
}

/* ---------- POST /api/robots (cria/atualiza) ---------- */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as RobotIn;

    // Normalização básica
    const id = typeof b.id === "string" ? b.id.trim() : undefined;
    const game = typeof b.game === "string" ? b.game.trim() : undefined;
    const casa = typeof b.casa === "string" ? b.casa.trim() : undefined;
    const kind = typeof b.name === "string" ? b.name.trim() : undefined;

    // botToken: undefined = não mexe | null/"" = limpar | string = valor
    const rawToken = b.botToken as unknown;
    let token: string | null | undefined;
    if (rawToken === undefined) token = undefined;
    else if (rawToken === null) token = null;
    else if (typeof rawToken === "string") token = rawToken.trim() === "" ? null : rawToken.trim();
    else token = undefined;

    // chatId: undefined = não mexe | null/"" = limpar | string/number = valor normalizado
    const chatIdStr =
      b.chatId === undefined || b.chatId === null ? undefined : String(b.chatId).trim();
    const chatId = chatIdStr === undefined ? undefined : chatIdStr === "" ? null : chatIdStr;

    const isActive = typeof b.isActive === "boolean" ? b.isActive : undefined;

    // schedule desejado (apenas se vier)
    const wantStart = b.startTime ?? undefined;
    const wantEnd = b.endTime ?? undefined;

    if (!id && !(game && casa && kind)) {
      return json(400, { ok: false, error: "Informe id OU (game,casa,name)." });
    }

    // Carrega atual (por id ou pela chave composta)
    let current: any = null;
    if (id) current = await prisma.telegramTarget.findUnique({ where: { id } });
    if (!current && game && casa && kind) {
      current = await prisma.telegramTarget.findFirst({ where: { game, casa, kind } });
    }

    // UPDATE
    if (current) {
      const data: any = {
        templates: mergeSchedule(current.templates, wantStart, wantEnd),
      };

      if (token !== undefined) data.botToken = token; // string | null
      if (chatId !== undefined) data.chatId = chatId; // string | null
      if (isActive !== undefined) data.active = isActive;

      if (game) data.game = game;
      if (casa) data.casa = casa;
      if (kind) data.kind = kind;

      const up = await prisma.telegramTarget.update({
        where: { id: current.id },
        data,
      });

      await ensureRobotMirrorByTargetId(current.id);
      return json(200, { ok: true, mode: "updated", data: toRobotOut(up) });
    }

    // CREATE
    if (!(game && casa && kind)) {
      return json(400, { ok: false, error: "Para criar é obrigatório game, casa e name." });
    }

    const created = await prisma.telegramTarget.create({
      data: {
        id: id || undefined,
        game,
        casa,
        kind,
        botToken: token ?? null,
        chatId: chatId ?? null,
        active: isActive ?? false,
        templates: mergeSchedule(null, wantStart ?? null, wantEnd ?? null),
      },
    });

    await ensureRobotMirrorByTargetId(created.id);
    return json(201, { ok: true, mode: "created", data: toRobotOut(created) });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_SAVE_FAILED" });
  }
}

/* ---------- DELETE /api/robots?id=... ---------- */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return json(400, { ok: false, error: "id obrigatório" });

    await prisma.telegramTarget.delete({ where: { id } });
    try {
      await prisma.robot.delete({ where: { id } });
    } catch {}
    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "ROBOTS_DELETE_FAILED" });
  }
}
