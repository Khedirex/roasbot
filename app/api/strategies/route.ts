// app/api/strategies/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: JSON_HEADERS,
  });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: JSON_HEADERS });
}

// GET /api/strategies?botId=...  (lista)  |  GET /api/strategies?id=... (1 item)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");
  const id = searchParams.get("id");

  if (id) {
    const one = await prisma.strategy.findUnique({ where: { id } });
    return json(200, { ok: true, data: one });
  }

  if (botId) {
    const list = await prisma.strategy.findMany({
      where: { robotId: botId },
      orderBy: { createdAt: "desc" },
    });
    return json(200, { ok: true, data: list });
  }

  return json(400, { ok: false, error: "Informe ?botId= para listar ou ?id= para buscar 1" });
}

// POST /api/strategies  { robotId, name?, active?, startHour?, endHour?, pattern?, winAt?, mgCount?, ... }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const robotId: string | undefined = body?.robotId;
    if (!robotId) return json(400, { ok: false, error: "robotId ausente" });

    const payload: Prisma.StrategyCreateInput = {
      robot: { connect: { id: robotId } },
      name: typeof body?.name === "string" ? body.name : "Nova estratégia",
      active: typeof body?.active === "boolean" ? body.active : true,
      startHour: typeof body?.startHour === "string" ? body.startHour : "00:00",
      endHour: typeof body?.endHour === "string" ? body.endHour : "23:59",
      pattern: Array.isArray(body?.pattern) ? (body.pattern as Prisma.InputJsonValue) : ([] as unknown as Prisma.InputJsonValue),
      winAt: Number.isFinite(+body?.winAt) ? Number(body.winAt) : 1,
      mgCount: Number.isFinite(+body?.mgCount) ? Number(body.mgCount) : 0,
      blueThreshold: body?.blueThreshold ?? null,
      pinkThreshold: body?.pinkThreshold ?? null,
      messages: (body?.messages ?? {}) as Prisma.InputJsonValue,
    };

    const created = await prisma.strategy.create({ data: payload });
    return json(201, { ok: true, data: created });
  } catch (e: any) {
    return json(400, { ok: false, error: e?.message || "erro ao criar estratégia" });
  }
}