// app/api/runtime/reset/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as runtimeMatcher from "@/lib/runtimeMatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---- CORS / JSON ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
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

/* ---- Auth ---- */
function checkAuth(req: NextRequest): { ok: boolean; reason?: string } {
  const ingest = (process.env.INGEST_TOKEN ?? "").trim();
  const strat = (process.env.STRATEGIES_TOKEN ?? "").trim();
  // Se nenhum token estiver configurado, não exige auth
  if (!ingest && !strat) return { ok: true };

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  if (!token) return { ok: false, reason: "missing bearer token" };
  if (ingest && token === ingest) return { ok: true };
  if (strat && token === strat) return { ok: true };

  return { ok: false, reason: "invalid token" };
}

/* ---- Reset helpers (compat com várias APIs de runtimeMatcher) ---- */
function resetHistory(botId: string) {
  const rm: any = runtimeMatcher as any;

  // Prefer funções explícitas, se existirem
  if (typeof rm.reset === "function") return rm.reset(botId);
  if (typeof rm.resetHistory === "function") return rm.resetHistory(botId);
  if (typeof rm.clearHistory === "function") return rm.clearHistory(botId);
  if (typeof rm.setHistory === "function") return rm.setHistory(botId, []);

  // Fallback: mexe no objeto interno
  if (rm.history && typeof rm.history === "object") {
    rm.history[botId] = [];
    return;
  }
  // Fallback final: se existir getState/setState
  if (typeof rm.getState === "function" && typeof rm.setState === "function") {
    const s = rm.getState(botId) ?? {};
    rm.setState(botId, { ...s, history: [] });
    return;
  }
}

function readHistory(botId: string): string[] {
  const rm: any = runtimeMatcher as any;
  try {
    if (typeof rm.getHistory === "function") return rm.getHistory(botId) ?? [];
    if (typeof rm.getBotHistory === "function") return rm.getBotHistory(botId) ?? [];
    if (typeof rm.getState === "function") return rm.getState(botId)?.history ?? [];
    if (rm.history && typeof rm.history === "object") return rm.history[botId] ?? [];
  } catch {
    // ignore
  }
  return [];
}

/* ---- POST /api/runtime/reset  Body: { botId } ---- */
export async function POST(req: NextRequest) {
  const auth = checkAuth(req);
  if (!auth.ok) return json(401, { ok: false, error: `unauthorized: ${auth.reason}` });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid JSON body" });
  }

  const botId = (body?.botId ?? "").trim();
  if (!botId) return json(400, { ok: false, error: "Missing 'botId' in body" });

  try {
    resetHistory(botId);
  } catch (e: any) {
    return json(500, { ok: false, error: "failed to reset history", detail: String(e?.message ?? e) });
  }

  return json(200, {
    ok: true,
    botId,
    history: readHistory(botId), // deve vir []
  });
}
