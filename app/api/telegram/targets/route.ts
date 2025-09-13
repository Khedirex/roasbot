// app/api/telegram/targets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ================== CORS / JSON ================== */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-ingest-token,x-requested-with",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};
const json = (status: number, data: unknown) =>
  new NextResponse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    { status, headers: JSON_HEADERS },
  );

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ================== Auth via token ==================
   - Usa INGEST_TOKENS (lista) e/ou INGEST_TOKEN (único)
   - Aceita: Authorization: Bearer | x-api-key | x-ingest-token | ?token=
   - Se nenhum token estiver definido, endpoint fica aberto (dev-friendly)
   - INGEST_ALLOW_ANY=true ignora tudo (apenas para testes)
===================================================== */
function getAllowedTokens(): string[] {
  const raw = (process.env.INGEST_TOKENS ?? process.env.INGEST_TOKEN ?? "");
  const tokens = raw
    .replace(/["'`]/g, "")         // remove aspas soltas
    .split(/[,\s]+/)               // vírgula, espaço, quebras, tabs
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));

}

function extractIncomingToken(req: Request): string | null {
  const hAuth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (hAuth && /^bearer\s+/i.test(hAuth)) {
    return hAuth.replace(/^bearer\s+/i, "").trim();
  }
  const hApiKey =
    req.headers.get("x-api-key") ||
    req.headers.get("x-ingest-token") ||
    req.headers.get("X-API-Key") ||
    req.headers.get("X-Ingest-Token");
  if (hApiKey) return hApiKey.trim();

  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  return q ? q.trim() : null;
}

function checkToken(req: Request): boolean {
  // “modo livre” para debug
  if (process.env.INGEST_ALLOW_ANY === "true") return true;

  const allowed = getAllowedTokens();

  // sem tokens configurados => aberto (como o comentário prometia)
  if (allowed.length === 0) return true;

  const got = extractIncomingToken(req);
  if (!got) return false;

  // logs seguros em dev
  if (process.env.NODE_ENV !== "production") {
    const mask = (s: string) => (s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s);
    console.log("[targets/auth] allowed:", allowed.map(mask).join(", "));
    console.log("[targets/auth] got    :", mask(got));
  }
  return allowed.includes(got);
}

/* ================== Utils ================== */
function toLowerOrUndef(v: string | null) {
  const s = (v || "").trim();
  return s ? s.toLowerCase() : undefined;
}
function parseBool(v: string | null): boolean | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return undefined;
}

/** GET: lista (filtra por casa/kind/active via query) */
export async function GET(req: Request) {
  try {
    if (!checkToken(req)) return json(401, { error: "Unauthorized" });

    const url = new URL(req.url);
    const casaQ = toLowerOrUndef(url.searchParams.get("casa"));
    const kindQ = toLowerOrUndef(url.searchParams.get("kind"));
    const activeQ = parseBool(url.searchParams.get("active"));

    const where: any = {};
    if (casaQ) where.casa = casaQ;
    if (kindQ) where.kind = kindQ;
    if (activeQ !== undefined) where.active = activeQ;

    const items = await prisma.telegramTarget.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return json(200, { ok: true, items });
  } catch (e: any) {
    console.error("GET /telegram/targets error:", e);
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    });
  }
}

/** POST: upsert por (casa, kind) */
export async function POST(req: Request) {
  try {
    if (!checkToken(req)) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const casa = String(body?.casa || "").trim().toLowerCase();
    const kind = String(body?.kind || "").trim().toLowerCase();
    const botToken = String(body?.botToken || "").trim();
    const chatId = String(body?.chatId || "").trim();
    const active = body?.active !== false; // default: true

    if (!casa || !kind || !botToken || !chatId) {
      return json(400, {
        ok: false,
        error: "missing_params",
        need: "casa, kind, botToken, chatId",
      });
    }

    // dica útil para grupos/canais
    const groupHint =
      /^-?\d+$/.test(chatId) && !chatId.startsWith("-")
        ? "Para grupos/canais, o chatId costuma começar com '-'."
        : undefined;

    const item = await prisma.telegramTarget.upsert({
      where: { casa_kind: { casa, kind } }, // exige @@unique([casa, kind]) no schema
      update: { botToken, chatId, active },
      create: { casa, kind, botToken, chatId, active },
    });

    return json(200, { ok: true, item, ...(groupHint ? { hint: groupHint } : {}) });
  } catch (e: any) {
    console.error("POST /telegram/targets error:", e);
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    });
  }
}
