// app/api/strategies/[botId]/route.ts
import { NextResponse } from "next/server";
import {
  listStrategies,
  setStrategies,
  upsertStrategy,
  removeStrategy,
  getActiveStrategies,
  type Strategy,
  type BotId,
  type Game,
  type CasaSlug,
} from "@/lib/strategies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---- CORS / JSON ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS };

function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown) {
  return new NextResponse(stringifySafe(data), { status, headers: JSON_HEADERS });
}
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ---- Token opcional ---- */
function checkToken(req: Request) {
  const expected =
    (process.env.STRATEGIES_TOKEN || process.env.STRAT_TOKEN || process.env.INGEST_TOKEN || "").trim();
  if (!expected) return true;
  const got =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return got === expected;
}

/* ---- Valida botId ---- */
const ALLOWED_GAMES: readonly Game[] = ["aviator", "bacbo"] as const;
const ALLOWED_CASAS: readonly CasaSlug[] = ["1win", "lebull"] as const;

function parseBotId(raw: string | undefined): BotId | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z0-9_-]+)-([a-z0-9_-]+)$/i);
  if (!m) return null;
  const game = m[1].toLowerCase() as Game;
  const casa = m[2].toLowerCase() as CasaSlug;
  if (!ALLOWED_GAMES.includes(game)) return null;
  if (!ALLOWED_CASAS.includes(casa)) return null;
  return `${game}-${casa}` as BotId;
}

/* ================= GET =================
   /api/strategies/{botId}?active=1  -> somente ativas no horário atual
========================================= */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    const url = new URL(req.url);
    const onlyActive = url.searchParams.get("active") === "1";

    const list = onlyActive ? getActiveStrategies(botId) : listStrategies(botId);
    return json(200, { ok: true, botId, activeOnly: !!onlyActive, count: list.length, strategies: list });
  } catch (e: any) {
    console.error("STRATEGIES GET ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}

/* ================= PUT =================
Body: { strategies: Strategy[] }
Protegido por STRATEGIES_TOKEN (ou STRAT_TOKEN/INGEST_TOKEN).
========================================= */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "invalid_json" });
    }

    const strategies: Strategy[] = Array.isArray(body?.strategies) ? body.strategies : [];
    if (!Array.isArray(strategies)) {
      return json(400, { ok: false, error: "invalid_payload", details: "strategies must be an array" });
    }

    setStrategies(botId, strategies);
    const saved = listStrategies(botId);

    return json(200, { ok: true, botId, count: saved.length, strategies: saved });
  } catch (e: any) {
    console.error("STRATEGIES PUT ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}

/* ================= POST =================
Body: Strategy (upsert de uma estratégia)
Protegido por token.
========================================= */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { ok: false, error: "invalid_body", expect: "Strategy" });
    }

    const saved = upsertStrategy(botId, body as Strategy);
    return json(200, { ok: true, botId, strategy: saved });
  } catch (e: any) {
    console.error("STRATEGIES POST ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}

/* ================= DELETE ==============
Query: ?id=xxxx
Protegido por token.
========================================= */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    if (!id) return json(400, { ok: false, error: "missing_id" });

    const removed = removeStrategy(botId, id);
    const list = listStrategies(botId);
    return json(200, { ok: true, botId, removed, count: list.length, strategies: list });
  } catch (e: any) {
    console.error("STRATEGIES DELETE ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}
