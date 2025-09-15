// app/api/strategies/[botId]/route.ts
import { NextResponse } from "next/server";
import type { BotId, Strategy } from "@/lib/strategies";
import {
  listStrategiesDB,
  getActiveStrategiesDB,
  setStrategiesDB,
  upsertStrategyDB,
  removeStrategyDB,
} from "@/lib/strategies.db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---------------- CORS / JSON helpers ---------------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-requested-with",
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

/* ---------------- Auth (opcional) ----------------
 * STRATEGIES_TOKEN protege POST/PUT/DELETE
 * Se ausente, cai para INGEST_TOKEN (fallback).
 */
function checkToken(req: Request) {
  const expected =
    (process.env.STRATEGIES_TOKEN || process.env.INGEST_TOKEN || "").trim();
  if (!expected) return true; // aberto se não setado
  const got =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return got === expected;
}

/* ---------------- Routes ---------------- */
type Ctx = { params: Promise<{ botId: string }> };

/** GET /api/strategies/[botId]?active=1 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { botId: raw } = await ctx.params;
    const botId = (raw || "").trim() as BotId;
    if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(botId)) {
      return json(400, { ok: false, error: "invalid_botId", botId: raw });
    }

    const url = new URL(req.url);
    const onlyActive = url.searchParams.get("active") === "1";

    const strategies = onlyActive
      ? await getActiveStrategiesDB(botId)
      : await listStrategiesDB(botId);

    return json(200, { ok: true, botId, active: !!onlyActive, strategies });
  } catch (e: any) {
    console.error("STRATEGIES GET ERROR:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}

/** PUT /api/strategies/[botId]  Body: { strategies: Strategy[] }  (substitui todas) */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = (raw || "").trim() as BotId;
    if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(botId)) {
      return json(400, { ok: false, error: "invalid_botId", botId: raw });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "invalid_json" });
    }
    const list = Array.isArray(body?.strategies) ? (body.strategies as Strategy[]) : null;
    if (!list) {
      return json(400, { ok: false, error: "missing_strategies_array" });
    }

    await setStrategiesDB(botId, list);
    const strategies = await listStrategiesDB(botId);
    return json(200, { ok: true, botId, strategies });
  } catch (e: any) {
    console.error("STRATEGIES PUT ERROR:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}

/** POST /api/strategies/[botId]  Body: Strategy  (upsert de uma) */
export async function POST(req: Request, ctx: Ctx) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = (raw || "").trim() as BotId;
    if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(botId)) {
      return json(400, { ok: false, error: "invalid_botId", botId: raw });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "invalid_json" });
    }

    const saved = await upsertStrategyDB(botId, body as Strategy);
    return json(200, { ok: true, botId, strategy: saved });
  } catch (e: any) {
    console.error("STRATEGIES POST ERROR:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}

/** DELETE /api/strategies/[botId]?id=... */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = (raw || "").trim() as BotId;
    if (!/^[a-z0-9]+-[a-z0-9]+$/i.test(botId)) {
      return json(400, { ok: false, error: "invalid_botId", botId: raw });
    }

    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim();
    if (!id) return json(400, { ok: false, error: "missing_id" });

    const removed = await removeStrategyDB(botId, id);
    const strategies = await listStrategiesDB(botId);
    return json(200, { ok: true, botId, removed, strategies });
  } catch (e: any) {
    console.error("STRATEGIES DELETE ERROR:", e?.message || e);
    return json(500, { ok: false, error: "internal_error", message: String(e?.message ?? e) });
  }
}
