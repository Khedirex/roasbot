// app/api/metrics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---- CORS / JSON ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};
function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: JSON_HEADERS,
  });
}
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ---- Configuração simples ---- */
const CASAS = ["1win", "lebull"] as const;
type Casa = (typeof CASAS)[number];
type BotKey = `aviator-${Casa}`;

const GAME = "aviator";
const WINDOW_MINUTES = 60;

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export async function GET() {
  try {
    const now = Date.now();
    const sinceMs = now - WINDOW_MINUTES * 60 * 1000;
    const day0 = startOfLocalDay(new Date(now));

    // 1) Última hora (para média por minuto e lastTs)
    const lastHour = await prisma.ingestEvent.findMany({
      where: {
        game: GAME,
        casa: { in: CASAS as unknown as string[] },
        ts: { gte: sinceMs },
      },
      select: { ts: true, casa: true },
      orderBy: { ts: "desc" },
    });

    // 2) Hoje (para total do dia)
    const today = await prisma.ingestEvent.findMany({
      where: {
        game: GAME,
        casa: { in: CASAS as unknown as string[] },
        ts: { gte: day0 },
      },
      select: { ts: true, casa: true },
    });

    // 3) Agrega
    type Tot = { lastHour: number; perMin: number; today: number; lastTs: number | null };

    const totals = Object.fromEntries(
      CASAS.map((c) => [`aviator-${c}`, { lastHour: 0, perMin: 0, today: 0, lastTs: null }]),
    ) as Record<BotKey, Tot>;

    for (const e of lastHour) {
      const casa = e.casa as Casa;
      const key = `aviator-${casa}` as BotKey;
      const t = totals[key];
      t.lastHour++;
      if (t.lastTs == null || Number(e.ts) > t.lastTs) t.lastTs = Number(e.ts);
    }

    for (const e of today) {
      const casa = e.casa as Casa;
      const key = `aviator-${casa}` as BotKey;
      totals[key].today++;
    }

    // média por minuto na janela (inclui minutos sem evento)
    for (const key of Object.keys(totals) as BotKey[]) {
      totals[key].perMin = +(totals[key].lastHour / WINDOW_MINUTES).toFixed(3);
    }

    return json(200, {
      ok: true,
      game: GAME,
      windowMinutes: WINDOW_MINUTES,
      now,
      totals,
    });
  } catch (e: any) {
    console.error("/api/metrics error:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}
