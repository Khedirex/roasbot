// app/api/strategies/[id]/route.ts
import { NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PATCH /api/strategies/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id ausente" }, { status: 400 });
    }

    const body = await req.json();
    const data: any = {};

    if (typeof body.name === "string")      data.name = body.name;
    if (typeof body.startHour === "string") data.startHour = body.startHour;
    if (typeof body.endHour === "string")   data.endHour = body.endHour;
    if (typeof body.winAt !== "undefined")  data.winAt = Number(body.winAt);
    if (typeof body.mgCount !== "undefined")data.mgCount = Number(body.mgCount);
    if (typeof body.active === "boolean")   data.active = body.active;               // <—
    if (typeof body.pattern !== "undefined")
      data.pattern = body.pattern as Prisma.InputJsonValue;
    if (typeof body.messages !== "undefined")
      data.messages = body.messages as Prisma.InputJsonValue;

    const s = await prisma.strategy.update({ where: { id }, data });
    return NextResponse.json({ ok: true, data: s });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "erro ao atualizar estratégia" }, { status: 500 });
  }
}
