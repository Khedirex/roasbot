// app/api/strategies/[id]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Aceita string, JSON string, array, objeto... e devolve sempre string[] */
function normalizePattern(raw: any): string[] {
  if (Array.isArray(raw)) return raw;

  if (raw == null) return [];

  if (typeof raw === "string") {
    // pode vir "low-mults" ou '["low-mults","pink"]'
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return [v];
      // objeto -> coletar strings
      return Object.values(v)
        .flat()
        .filter((x) => typeof x === "string") as string[];
    } catch {
      return [raw];
    }
  }

  if (typeof raw === "object") {
    if (Array.isArray((raw as any)["pattern-list"])) return (raw as any)["pattern-list"];
    if (Array.isArray((raw as any).colors)) return (raw as any).colors;
    return Object.values(raw)
      .flat()
      .filter((x) => typeof x === "string") as string[];
  }

  return [];
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id ausente" }, { status: 400 });
    }

    const body = await req.json();
    const patch: any = body ?? {};

    // normaliza pattern se vier
    if ("pattern" in patch) {
      patch.pattern = normalizePattern(patch.pattern);
    }

    // garante objeto para messages
    if ("messages" in patch && (patch.messages == null || typeof patch.messages !== "object")) {
      patch.messages = {};
    }

    // se quiser, bloqueie campos que não podem ser editados aqui
    // delete patch.robotId;

    const updated = await prisma.strategy.update({
      where: { id },
      data: patch,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
