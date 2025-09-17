// /app/api/strategies/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET uma estratégia */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: params.id },
    });
    if (!strategy) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: strategy });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "GET error" }, { status: 500 });
  }
}

/** PATCH atualiza campos da estratégia */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await prisma.strategy.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "PATCH error" }, { status: 500 });
  }
}

/** DELETE apaga a estratégia */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.strategy.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "DELETE error" }, { status: 500 });
  }
}
