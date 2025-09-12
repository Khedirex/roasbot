import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_CASAS = ["1win"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];

/* ---------- CORS + JSON ---------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Token, Authorization",
  Vary: "Origin",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
} as const;

// serializa BigInt como number
function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
// helper de resposta JSON sempre safe
function json(status: number, data: unknown, extra?: HeadersInit) {
  return new NextResponse(stringifySafe(data), {
    status,
    headers: { ...JSON_HEADERS, ...(extra || {}) },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ---------- Auth por token ---------- */
function envTokens(): string[] {
  const raw = [
    process.env.INGEST_TOKEN,
    process.env.EXTENSION_INGEST_TOKEN,
    process.env.INVEST_INGEST_TOKEN,
  ]
    .filter(Boolean)
    .join(",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const INGEST_ALLOW_ANY = (process.env.INGEST_ALLOW_ANY || "").toLowerCase() === "true";
const GENERIC_TOKEN = (process.env.INGEST_GENERIC_TOKEN || "").trim();

async function readToken(req: Request) {
  const url = new URL(req.url);
  const h = req.headers;
  const headerToken = h.get("x-ingest-token") || undefined;
  const bearer = h.get("authorization");
  const bearerToken =
    bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : undefined;
  const queryToken = url.searchParams.get("token") || url.searchParams.get("key") || undefined;

  let bodyToken: string | undefined;
  try {
    const clone = req.clone();
    const body = await clone.json().catch(() => null);
    bodyToken = (body && (body.token || body.ingest_token || body.INGEST_TOKEN)) || undefined;
  } catch { /* ignore */ }

  return headerToken || bearerToken || queryToken || bodyToken || "";
}

/* ---------- BigInt opcional ---------- */
const USE_TS_BIGINT = (process.env.INGEST_TS_BIGINT || "").toLowerCase() === "true";

/* -------------------- POST (201) -------------------- */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ casa: string }> }
) {
  try {
    // Auth flexível
    const list = envTokens();
    if (!INGEST_ALLOW_ANY && (list.length > 0 || GENERIC_TOKEN)) {
      const token = await readToken(req);
      const ok = !!token && (list.includes(token) || (GENERIC_TOKEN && token === GENERIC_TOKEN));
      if (!ok) {
        return json(401, { ok: false, error: "unauthorized_ingest" });
      }
    }

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
    const tsNum = Number(body.at ?? body.ts ?? Date.now());
    if (!Number.isFinite(value) || value <= 0) {
      return json(400, { ok: false, error: "invalid_value(multiplier)" });
    }
    if (!Number.isFinite(tsNum)) {
      return json(400, { ok: false, error: "invalid_ts" });
    }

    const created = await prisma.ingestEvent.create({
      data: {
        game: "aviator",
        casa,
        value,
        ts: USE_TS_BIGINT ? (BigInt(tsNum) as unknown as number) : tsNum,
      },
      select: { id: true, value: true, ts: true, createdAt: true },
    });

    // normaliza para JSON seguro (sem BigInt)
    const saved = {
      id: (created as any).id, // stringifySafe lida se for bigint
      value: Number(created.value),
      ts: Number((created as any).ts),
      createdAt: created.createdAt.toISOString(),
    };

    return json(
      201,
      { ok: true, saved },
      {
        "X-From": "ingest-POST-201",
        "X-Status": "201",
        Location: `/api/ingest/aviator/${casa}?id=${saved.id}`,
      }
    );
  } catch (e: any) {
    console.error("INGEST POST ERROR:", e?.message || e);
    return json(500, { ok: false, error: "db_error", message: String(e?.message ?? e) });
  }
}

/* -------------------- GET (200) -------------------- */
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

    const rows = await prisma.ingestEvent.findMany({
      where: { game: "aviator", casa },
      orderBy: { ts: "desc" },
      take: 100,
      select: { value: true, ts: true, createdAt: true },
    });

    const last = rows.map((r) => ({
      value: Number(r.value),
      ts: Number((r as any).ts),
      createdAt: r.createdAt.toISOString(),
    }));

    return json(200, { ok: true, casa, count: last.length, last }, { "X-From": "ingest-GET-200" });
  } catch (e: any) {
    console.error("INGEST GET ERROR:", e?.message || e);
    return json(500, { ok: false, error: "db_error", message: String(e?.message ?? e) });
  }
}
