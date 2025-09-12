// app/api/ingest/aviator/[casa]/events/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CASAS = ["1win"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];
const ALLOWED_SET = new Set<Casa>(ALLOWED_CASAS);

/** ---------- CORS + JSON safe ---------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Token, Authorization",
  Vary: "Origin",
} as const;

function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown, extra?: HeadersInit) {
  return new NextResponse(stringifySafe(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...(extra || {}) },
  });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
/** -------------------------------------- */

export async function POST(
  req: Request,
  ctx: { params: Promise<{ casa: string }> } // Next 15: params é Promise
) {
  try {
    const { casa } = await ctx.params;
    const casaLc = (casa || "").toLowerCase() as Casa;
    if (!ALLOWED_SET.has(casaLc)) return json(400, { ok: false, error: "invalid_casa" });

    const body = (await req.json().catch(() => ({}))) as { ts?: number | string; value?: number | string };
    const tsNum = Number(body?.ts);
    const valueNum = Number(body?.value);
    if (!Number.isFinite(tsNum) || !Number.isFinite(valueNum)) {
      return json(400, { ok: false, error: "bad_payload" });
    }

    // Se seu schema usa Int em vez de BigInt, troque BigInt(tsNum) por ts: tsNum
    const created = await prisma.ingestEvent.create({
      data: { game: "aviator", casa: casaLc, ts: BigInt(tsNum), value: valueNum },
      select: { id: true, ts: true, value: true, createdAt: true },
    });

    return json(
      201,
      {
        ok: true,
        event: {
          id: created.id,
          ts: Number(created.ts as any),
          value: Number(created.value),
          createdAt: created.createdAt.toISOString(),
        },
      },
      { "X-From": "ingest-events-POST-201" }
    );
  } catch (e: any) {
    console.error("INGEST EVENTS POST ERROR:", e?.stack || e?.message || e);
    return json(500, { ok: false, error: "db_error", message: String(e?.message ?? e) });
  }
}
