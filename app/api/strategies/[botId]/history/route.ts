// app/api/runtime/[botId]/history/route.ts
import { NextResponse } from "next/server";
import type { BotId, Game, CasaSlug } from "@/lib/strategies";
import { getBotHistory, resetBotRuntime } from "@/lib/runtimeMatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---- CORS / JSON ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
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

/* ---- Token opcional pra reset ---- */
function checkToken(req: Request) {
  const expected = (process.env.RUNTIME_TOKEN || process.env.INGEST_TOKEN || "").trim();
  if (!expected) return true;
  const got =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return got === expected;
}

/* ---- Validadores ---- */
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

/* ============ GET: retorna histórico de tokens do bot ============ */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    const history = getBotHistory(botId);
    return json(200, { ok: true, botId, count: history.length, history });
  } catch (e: any) {
    console.error("RUNTIME HISTORY GET ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}

/* ============ DELETE: reseta histórico do bot ============ */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ botId: string }> }
) {
  try {
    if (!checkToken(req)) return json(401, { ok: false, error: "unauthorized" });

    const { botId: raw } = await ctx.params;
    const botId = parseBotId(raw);
    if (!botId) return json(404, { ok: false, error: "invalid_bot_id", got: raw });

    resetBotRuntime(botId);
    const history = getBotHistory(botId);
    return json(200, { ok: true, botId, reset: true, count: history.length, history });
  } catch (e: any) {
    console.error("RUNTIME HISTORY DELETE ERROR:", e?.message || e);
    return json(500, { ok: false, error: "server_error", message: String(e?.message ?? e) });
  }
}
