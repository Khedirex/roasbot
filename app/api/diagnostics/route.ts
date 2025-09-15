// app/api/diagnostics/runtime/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as runtimeMatcher from "@/lib/runtimeMatcher";
import { listStrategies, type Strategy } from "@/lib/strategies";

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

function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown) {
  return new NextResponse(stringifySafe(data), { status, headers: JSON_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ---- Helpers ---- */
function nowHHMM(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isActiveAt(strat: Strategy, hhmm: string): boolean {
  if (!strat?.enabled) return false;
  const start = strat.startHour ?? "00:00";
  const end = strat.endHour ?? "23:59";
  // Janela normal
  if (start <= end) return hhmm >= start && hhmm <= end;
  // Janela cruzando meia-noite (ex.: 22:00 → 06:00)
  return hhmm >= start || hhmm <= end;
}

function readHistory(botId: string): string[] {
  // Tenta encontrar a história no runtimeMatcher, independente do nome do helper exposto.
  const rm: any = runtimeMatcher as any;
  try {
    if (typeof rm.getHistory === "function") return rm.getHistory(botId) ?? [];
    if (typeof rm.getBotHistory === "function") return rm.getBotHistory(botId) ?? [];
    if (typeof rm.getState === "function") return rm.getState(botId)?.history ?? [];
    if (rm.history && typeof rm.history === "object") return rm.history[botId] ?? [];
  } catch {
    // ignora e cai no fallback
  }
  return [];
}

/* ---- GET /api/diagnostics/runtime?botId=aviator-lebull ---- */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = (searchParams.get("botId") || "").trim();

  if (!botId) {
    return json(400, { ok: false, error: "Missing 'botId' query param (ex.: aviator-lebull)" });
  }

  const greenAt = Number.parseFloat(process.env.AVIATOR_GREEN_AT ?? "2");
  const whiteAt = Number.parseFloat(process.env.AVIATOR_WHITE_AT ?? "1");

  // Histórico atual em memória
  const history = readHistory(botId);

  // Estratégias ativas "agora"
  let activeStrategies: Strategy[] = [];
  try {
    const all = (await (listStrategies as any)(botId)) as Strategy[] | undefined;
    const hhmm = nowHHMM();
    activeStrategies = (all ?? []).filter((s) => isActiveAt(s, hhmm));
  } catch {
    // Se der erro ao ler a store, retorna lista vazia
    activeStrategies = [];
  }

  return json(200, {
    ok: true,
    botId,
    greenAt,
    whiteAt,
    history,
    activeStrategies,
  });
}
