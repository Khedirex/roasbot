// app/api/strategy/[id]/pattern/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

type P = Promise<{ id: string }>;

export async function PUT(req: Request, { params }: { params: P }) {
  try {
    const { id } = await params;
    const { pattern } = await req.json();

    if (!Array.isArray(pattern)) {
      return json(400, { ok: false, error: "pattern must be an array" });
    }

    const up = await prisma.strategy.update({
      where: { id },
      data: { pattern: pattern as Prisma.InputJsonValue },
    });

    return json(200, { ok: true, data: up.pattern });
  } catch (e: any) {
    if (e?.code === "P2025") return json(404, { ok: false, error: "strategy not found" });
    return json(500, { ok: false, error: e?.message || "PATTERN_PUT_FAILED" });
  }
}
