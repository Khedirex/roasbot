// app/api/snapshot/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const robots = await prisma.robot.findMany({
      include: {
        strategies: true, // se quiser só ativas, filtre depois
      },
      orderBy: [{ game: "asc" }, { casa: "asc" }, { createdAt: "asc" }],
    });

    const grouped: Record<string, any[]> = {};
    for (const r of robots) {
      const botId = `${r.game}-${r.casa}`;
      const strategies = r.strategies.filter((s) => s.active); // <— usa active
      const metrics = { greens: 0, reds: 0, jogadas: 0 }; // placeholder

      const robotDTO = {
        id: r.id,
        name: r.name,
        startHour: "00:00",
        endHour: "23:59",
        martingale: 0,
        botToken: r.botToken,
        chatId: r.chatId,
        enabled: r.enabled,
        strategies,
        metrics,
      };

      if (!grouped[botId]) grouped[botId] = [];
      grouped[botId].push(robotDTO);
    }

    return NextResponse.json({ ok: true, data: grouped });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "erro no snapshot" }, { status: 500 });
  }
}
