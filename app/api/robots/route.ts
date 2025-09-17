// app/api/robots/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST /api/robots  -> cria robot
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      game,            // "aviator" | "bacbo"
      casa,            // "1win" | "lebull" | ...
      name,
      botToken = null,
      chatId  = null,
      enabled = true,
    } = body || {};

    if (!game || !casa || !name) {
      return NextResponse.json(
        { ok: false, error: "game, casa e name são obrigatórios" },
        { status: 400 }
      );
    }

    const robot = await prisma.robot.create({
      data: { game, casa, name, botToken, chatId, enabled },
    });

    return NextResponse.json({ ok: true, data: robot });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "erro ao criar robot" },
      { status: 500 }
    );
  }
}

// GET /api/robots -> lista robots + estratégias
export async function GET() {
  try {
    const robots = await prisma.robot.findMany({
      include: { strategies: true },
      orderBy: [{ game: "asc" }, { casa: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ ok: true, data: robots });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "erro ao listar" }, { status: 500 });
  }
}
