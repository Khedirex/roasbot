// app/api/strategies/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/strategies/:id  (corrige "params must be awaited")
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id ausente" }, { status: 400 });

  const body = await req.json();

  // só deixa passar campos conhecidos
  const allow = ["name","startHour","endHour","mgCount","winAt","blueMin","pinkMax","enabled","pattern","messages"];
  const data: any = {};
  for (const k of allow) if (k in body) data[k] = body[k];

  try {
    const exists = await prisma.strategy.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ ok: false, error: "strategy not found" }, { status: 404 });

    const updated = await prisma.strategy.update({ where: { id }, data });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "erro no update" }, { status: 500 });
  }
}

// DELETE /api/strategies/:id  ← AQUI está o async delete
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id ausente" }, { status: 400 });

  try {
    await prisma.strategy.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Se o registro não existir, o Prisma lança P2025
    if (err?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "strategy not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "erro ao excluir" }, { status: 500 });
  }
}
