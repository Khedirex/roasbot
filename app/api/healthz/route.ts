// app/api/healthz/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ====== CORS / JSON ====== */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-ingest-token,x-requested-with",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};
const json = (status: number, data: unknown) =>
  new NextResponse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { status, headers: JSON_HEADERS },
  );

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/healthz
 * - shallow: sempre 200 com info básica
 * - deep=1: tenta checar DB; se falhar, 503
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  const startedAt = Date.now() - Math.floor(process.uptime() * 1000);
  const base = {
    ok: true,
    name: "roasbot",
    uptimeSec: Math.floor(process.uptime()),
    startedAtIso: new Date(startedAt).toISOString(),
    nowIso: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      ingestAllowAny: process.env.INGEST_ALLOW_ANY === "true" ? "true" : "false",
      ingestTokensConfigured:
        ((process.env.INGEST_TOKENS ?? process.env.INGEST_TOKEN ?? "").trim().length > 0),
    },
    versions: {
      node: process.version,
      next: process.env.NEXT_RUNTIME ?? "nodejs",
    },
  };

  if (!deep) return json(200, base);

  try {
    // deep check: DB “alive?”
    // para SQLite/Prisma, SELECT 1 é suficiente:
    await prisma.$queryRawUnsafe("SELECT 1");
    return json(200, { ...base, deep: { db: "ok" } });
  } catch (e: any) {
    return json(503, {
      ...base,
      ok: false,
      deep: { db: "error", message: String(e?.message ?? e) },
    });
  }
}
