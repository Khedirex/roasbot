// app/api/strategies/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePattern(p: any): any[] {
  if (Array.isArray(p)) return p;
  if (p == null) return [];
  if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return [parsed];
    } catch {
      return [p];
    }
  }
  if (typeof p === "object") {
    if (Array.isArray((p as any)["pattern-list"])) return (p as any)["pattern-list"];
    if (Array.isArray((p as any).colors)) return (p as any).colors;
    return Object.values(p).flat().filter((x) => typeof x === "string");
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      robotId,
      name,
      startHour = "00:00",
      endHour = "23:59",
      winAt = 3,
      mgCount = 0,
      pattern = [],
      messages = {},
      enabled = true,
    } = body ?? {};

    if (!robotId || !name) {
      return NextResponse.json({ ok: false, error: "robotId e name são obrigatórios" }, { status: 400 });
    }

    const created = await prisma.strategy.create({
      data: {
        robotId,
        name,
        startHour,
        endHour,
        winAt: Number(winAt),
        mgCount: Number(mgCount),
        enabled: Boolean(enabled),
        // salva como JSON
        pattern: normalizePattern(pattern) as unknown as Prisma.InputJsonValue,
        messages: messages as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        robotId: true,
        name: true,
        startHour: true,
        endHour: true,
        winAt: true,
        mgCount: true,
        enabled: true,
        pattern: true,
        messages: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "erro ao criar estratégia" }, { status: 500 });
  }
}
