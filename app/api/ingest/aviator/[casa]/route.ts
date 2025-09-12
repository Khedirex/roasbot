// app/api/ingest/aviator/[casa]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Casas permitidas (adicione aqui se precisar) */
const ALLOWED_CASAS = ["1win", "lebull"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];

/* ---- Headers / JSON seguro / CORS ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};
function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown) {
  return new NextResponse(stringifySafe(data), { status, headers: JSON_HEADERS });
}
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
/* -------------------------------------- */

/* Token opcional (env: INGEST_TOKEN). Se não setar, fica aberto. */
function checkToken(req: Request) {
  const expected = (process.env.INGEST_TOKEN || "").trim();
  if (!expected) return true;
  const got =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return got === expected;
}

/* Normaliza valor do multiplicador (aceita "2.99x", mult, multiplier, m, value, crash) */
function parseMultiplier(body: any): number | null {
  const raw = body?.mult ?? body?.multiplier ?? body?.m ?? body?.value ?? body?.crash;
  if (raw == null) return null;
  const n = Number(String(raw).replace(/x$/i, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Normaliza timestamp (aceita ts/at; se vier em segundos, converte pra ms) */
function parseTs(body: any): number {
  let ts = Number(body?.at ?? body?.ts ?? Date.now());
  if (!Number.isFinite(ts)) ts = Date.now();
  if (ts < 1e12) ts = Math.round(ts * 1000); // segundos -> ms
  return ts;
}

/* ======================= POST (ingest) ======================= */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ casa: string }> } // Next 15: params é Promise
) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

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

    const value = parseMultiplier(body);
    const ts = parseTs(body);

    if (value == null) {
      return json(400, {
        ok: false,
        error: "invalid_value(mult)",
        got: body?.mult ?? body?.multiplier ?? body?.m ?? body?.value ?? body?.crash,
      });
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

/* ======================== GET (debug) ======================== */
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
