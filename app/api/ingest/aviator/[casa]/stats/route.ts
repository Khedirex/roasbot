// app/api/ingest/aviator/[casa]/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CASAS = ["1win"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];
const ALLOWED_SET = new Set<Casa>(ALLOWED_CASAS);

function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ casa: string }> } // <<< Next 15: params é Promise
) {
  try {
    const url = new URL(req.url);
    const { casa: casaRaw } = await ctx.params; // <<< aguarda params
    const casaLc = (casaRaw || "").toLowerCase() as Casa;

    if (!ALLOWED_SET.has(casaLc)) {
      return json(400, { ok: false, error: "invalid_casa", casa: casaRaw });
    }

    // limite de pontos usados na janela das estatísticas
    const limitRaw = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitRaw || "200", 10) || 200, 1), 1000);

    // pega últimos N por ts desc — mais prático para SQLite
    const rows = await prisma.ingestEvent.findMany({
      where: { game: "aviator", casa: casaLc },
      orderBy: { ts: "desc" },
      take: limit,
      select: { value: true, ts: true, createdAt: true },
    });

    // normaliza e ordena por ts crescente para o gráfico
    const series = rows
      .map((r) => ({ ts: Number(r.ts), value: r.value, createdAt: r.createdAt }))
      .sort((a, b) => a.ts - b.ts);

    const values = series.map((d) => d.value);
    const sorted = [...values].sort((a, b) => a - b);

    const count = values.length;
    const min = count ? sorted[0] : null;
    const max = count ? sorted[sorted.length - 1] : null;
    const avg = count ? Number((values.reduce((s, v) => s + v, 0) / count).toFixed(4)) : null;
    const p50 = count ? Number(percentile(sorted, 50)?.toFixed(4)) : null;
    const p90 = count ? Number(percentile(sorted, 90)?.toFixed(4)) : null;
    const p99 = count ? Number(percentile(sorted, 99)?.toFixed(4)) : null;

    const fromTs = count ? series[0].ts : null;
    const toTs = count ? series[series.length - 1].ts : null;

    return json(200, {
      ok: true,
      casa: casaLc,
      count,
      window: { fromTs, toTs },
      stats: { min, max, avg, p50, p90, p99 },
      series, // [{ ts, value, createdAt }]
    });
  } catch (e: any) {
    console.error("STATS ERROR:", e?.message || e);
    return json(500, { ok: false, error: "internal_error" });
  }
}
