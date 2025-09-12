// lib/http.ts (ou reaproveite o seu)
import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Token, Authorization",
  Vary: "Origin",
} as const;

export function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}

export function json(status: number, data: unknown, extra?: HeadersInit) {
  return new NextResponse(stringifySafe(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...(extra || {}),
    },
  });
}

export function options204() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
