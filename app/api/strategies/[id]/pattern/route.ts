import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

// PUT /api/strategies/:id/pattern
// body: { pattern: ["X","K","P",... ] }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const arr: string[] = Array.isArray(body?.pattern) ? body.pattern : [];
    const st = await prisma.strategy.update({
      where: { id: params.id },
      data: { pattern: arr },
    });
    return json(200, { ok: true, data: st.pattern });
  } catch (e: any) {
    return json(400, { ok: false, error: e?.message || "bad_request" });
  }
}
