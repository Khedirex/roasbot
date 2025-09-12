// app/api/messages/render/route.ts
import { NextResponse } from "next/server";
import { renderTemplate, type MessageContext } from "@/lib/messageTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key",
} as const;

function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

// Preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET de smoke test (e facilita testes rápidos com ?template=...)
// - /api/messages/render            -> { ok:true, ping:"pong" }
// - /api/messages/render?template=... -> { ok:true, text:"..." }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const template = url.searchParams.get("template");
  if (!template) return json(200, { ok: true, ping: "pong" });

  const ctx: MessageContext = { game: "aviator", stats: { wins: 0, losses: 0, sg: 0, galeAtual: 0, maxGales: 0, ganhosConsecutivos: 0, ganhosConsecutivosGale: 0, ganhosConsecutivosSemGale: 0 } };
  const text = renderTemplate(template, ctx);
  return json(200, { ok: true, text });
}

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "invalid_json" });
    }

    const template: string = body?.template ?? "";
    if (!template || typeof template !== "string") {
      return json(400, { ok: false, error: "invalid_template" });
    }

    // Normalização leve do ctx para evitar crashes
    const rawCtx: any = body?.ctx ?? {};
    const ctx: MessageContext = {
      game: rawCtx?.game ?? "aviator",
      stats: {
        wins: Number(rawCtx?.stats?.wins ?? 0),
        losses: Number(rawCtx?.stats?.losses ?? 0),
        sg: Number(rawCtx?.stats?.sg ?? 0),
        galeAtual: Number(rawCtx?.stats?.galeAtual ?? 0),
        maxGales: Number(rawCtx?.stats?.maxGales ?? 0),
        ganhosConsecutivos: Number(rawCtx?.stats?.ganhosConsecutivos ?? 0),
        ganhosConsecutivosGale: Number(rawCtx?.stats?.ganhosConsecutivosGale ?? 0),
        ganhosConsecutivosSemGale: Number(rawCtx?.stats?.ganhosConsecutivosSemGale ?? 0),
        gWinsByLevel: rawCtx?.stats?.gWinsByLevel ?? undefined,
        whites: rawCtx?.stats?.whites ?? undefined,
        horarioUltimoBranco: rawCtx?.stats?.horarioUltimoBranco ?? undefined,
        winsMaiores2x: rawCtx?.stats?.winsMaiores2x ?? undefined,
        horarioUltimoMaior2x: rawCtx?.stats?.horarioUltimoMaior2x ?? undefined,
        purples: rawCtx?.stats?.purples ?? undefined,
        horarioUltimoRoxo: rawCtx?.stats?.horarioUltimoRoxo ?? undefined,
        cp: rawCtx?.stats?.cp ?? undefined,
      },
      current: rawCtx?.current ?? undefined,
      now: rawCtx?.now ? new Date(rawCtx.now) : new Date(),
    };

    const text = renderTemplate(template, ctx);
    return json(200, { ok: true, text });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "render_error",
      message: String(e?.message ?? e),
    });
  }
}
