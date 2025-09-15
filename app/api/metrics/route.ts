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

/* ---- Config ---- */
const CASAS = ["1win", "lebull"] as const;
type Casa = (typeof CASAS)[number];
type BotKey = `aviator-${Casa}`;

const GAME = "aviator";
const WINDOW_MINUTES = 60;

function botKeyFor(casa: Casa): BotKey {
  return `aviator-${casa}`;
}

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

    // 1) Última hora (para média/min e lastTs)
    const lastHour = await prisma.ingestEvent.findMany({
      where: { game: GAME, casa: { in: [...CASAS] }, ts: { gte: sinceMs } },
      select: { ts: true, casa: true },
      orderBy: { ts: "desc" },
    });

    // 2) Hoje (para total do dia)
    const today = await prisma.ingestEvent.findMany({
      where: { game: GAME, casa: { in: [...CASAS] }, ts: { gte: day0 } },
      select: { ts: true, casa: true },
    });

    // 3) Agrega com chaves tipadas
    type Tot = { lastHour: number; perMin: number; today: number; lastTs: number | null };
    const init: Record<BotKey, Tot> = Object.fromEntries(
      CASAS.map((c) => [botKeyFor(c), { lastHour: 0, perMin: 0, today: 0, lastTs: null }]),
    ) as Record<BotKey, Tot>;

    const totals = lastHour.reduce((acc, e) => {
      // garante casa conhecida
      if (CASAS.includes(e.casa as Casa)) {
        const key = botKeyFor(e.casa as Casa);
        acc[key].lastHour++;
        const ts = Number(e.ts);
        if (acc[key].lastTs == null || ts > acc[key].lastTs) acc[key].lastTs = ts;
      }
      return acc;
    }, init);

    for (const e of today) {
      if (CASAS.includes(e.casa as Casa)) {
        const key = botKeyFor(e.casa as Casa);
        totals[key].today++;
      }
    }

    // média por minuto
    (Object.keys(totals) as BotKey[]).forEach((k) => {
      totals[k].perMin = +(totals[k].lastHour / WINDOW_MINUTES).toFixed(3);
    });

    return json(200, { ok: true, game: GAME, windowMinutes: WINDOW_MINUTES, now, totals });
  } catch (e: any) {
    console.error("/api/metrics error:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}
