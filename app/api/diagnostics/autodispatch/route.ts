// app/api/diagnostics/autodispatch/route.ts
import { NextResponse } from "next/server";
import { getAutoDispatchSnapshot } from "@/lib/autoDispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ---- CORS / JSON ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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

/**
 * GET /api/diagnostics/autodispatch
 * Snapshot do estado do auto-dispatch (cooldowns em memória, flags, etc).
 * Não expõe credenciais.
 */
export async function GET() {
  try {
    const snap = getAutoDispatchSnapshot();
    const { ok, ...rest } = snap as any;
    return json(200, { ok: true, ...rest });
  } catch (e: any) {
    return json(500, { ok: false, error: "snapshot_failed", detail: String(e?.message ?? e) });
  }
}
