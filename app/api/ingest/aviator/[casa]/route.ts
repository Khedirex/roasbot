// app/api/ingest/aviator/[casa]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_CASAS = ["1win"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];

/** ---- JSON seguro (converte BigInt -> Number) ---- */
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown) {
  return new NextResponse(stringifySafe(data), { status, headers: JSON_HEADERS });
}
/** -------------------------------------------------- */

export async function POST(
  req: Request,
  ctx: { params: Promise<{ casa: string }> } // Next 15: params é Promise
) {
  try {
    const { casa: casaRaw } = await ctx.params;
    const casa = (casaRaw || "").toLowerCase() as Casa;

    if (!ALLOWED_CASAS.includes(casa)) {
      return json(404, { ok: false, error: "invalid_casa", casa: casaRaw });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "invalid_json" });
    }

    const value = Number(body.multiplier ?? body.m ?? body.value ?? body.crash);
    const ts = Number(body.at ?? body.ts ?? Date.now());

    if (!Number.isFinite(value) || value <= 0) {
      return json(400, {
        ok: false,
        error: "invalid_value(multiplier)",
        got: body.multiplier ?? body.m ?? body.value ?? body.crash,
      });
    }
    if (!Number.isFinite(ts)) {
      return json(400, { ok: false, error: "invalid_ts", got: body.at ?? body.ts });
    }

    const saved = await prisma.ingestEvent.create({
      data: { game: "aviator", casa, value, ts },
      select: { id: true, value: true, ts: true, createdAt: true },
    });

    return json(201, { ok: true, saved });
  } catch (e: any) {
    console.error("INGEST POST ERROR:", e?.message || e);
    return json(500, { ok: false, error: "db_error", message: String(e?.message ?? e) });
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ casa: string }> }
) {
  try {
    const { casa: casaRaw } = await ctx.params;
    const casa = (casaRaw || "").toLowerCase() as Casa;

    if (!ALLOWED_CASAS.includes(casa)) {
      return json(404, { ok: false, error: "invalid_casa", casa: casaRaw });
    }

    const last = await prisma.ingestEvent.findMany({
      where: { game: "aviator", casa },
      orderBy: { ts: "desc" },
      take: 100,
      select: { value: true, ts: true, createdAt: true },
    });

    return json(200, { ok: true, casa, count: last.length, last });
  } catch (e: any) {
    console.error("INGEST GET ERROR:", e?.message || e);
    return json(500, { ok: false, error: "db_error", message: String(e?.message ?? e) });
  }
}
