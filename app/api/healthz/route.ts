// app/api/healthz/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ====== CORS / JSON ====== */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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

/** Util: deep DB check */
async function checkDb() {
  await prisma.$queryRawUnsafe("SELECT 1");
  return "ok" as const;
}

/** Util: deep Telegram check (opcionalmente por casa/kind) */
async function checkTelegram(opts?: { casa?: string; kind?: string; timeoutMs?: number }) {
  const { casa, kind, timeoutMs = 7000 } = opts || {};
  const where: any = { active: true };
  if (casa) where.casa = String(casa).trim().toLowerCase();
  if (kind) where.kind = String(kind).trim().toLowerCase();

  const target =
    (casa && kind)
      ? await prisma.telegramTarget.findUnique({ where: { casa_kind: { casa: where.casa, kind: where.kind } } })
      : await prisma.telegramTarget.findFirst({ where });

  if (!target || !target.active) {
    return { status: "no_active_target" as const };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.telegram.org/bot${target.botToken}/getMe`, {
      method: "GET",
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return { status: "error" as const, data };
    }
    return { status: "ok" as const, bot: data.result?.username ?? null, chatId: target.chatId };
  } catch (e: any) {
    return { status: "error" as const, message: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/healthz
 * - shallow: sempre 200 com info básica
 * - deep=db|1: checa DB; 503 se falhar
 * - deep=telegram: checa Telegram (getMe) com target ativo (ou casa/kind); 503 se falhar
 * - deep=all: DB + Telegram; 503 se algum falhar
 *   Params opcionais para deep=telegram/all:
 *     ?casa=...&kind=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = (url.searchParams.get("deep") || "").toLowerCase(); // "", "1", "db", "telegram", "all"

  const startedAt = Date.now() - Math.floor(process.uptime() * 1000);
  const base = {
    ok: true,
    name: "roasbot",
    uptimeSec: Math.floor(process.uptime()),
    startedAtIso: new Date(startedAt).toISOString(),
    nowIso: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      ingestAllowAny: process.env.INGEST_ALLOW_ANY === "true" ? "true" : "false",
      ingestTokensConfigured:
        ((process.env.INGEST_TOKENS ?? process.env.INGEST_TOKEN ?? "").trim().length > 0),
    },
    versions: {
      node: process.version,
      next: process.env.NEXT_RUNTIME ?? "nodejs",
    },
  };

  // shallow
  if (!deep || deep === "0") return json(200, base);

  // deep: switches
  const wantDb = deep === "1" || deep === "db" || deep === "all";
  const wantTg = deep === "telegram" || deep === "all";

  const casa = url.searchParams.get("casa") || undefined;
  const kind = url.searchParams.get("kind") || undefined;

  const deepRes: any = {};
  let statusCode = 200;

  if (wantDb) {
    try {
      await checkDb();
      deepRes.db = "ok";
    } catch (e: any) {
      deepRes.db = { status: "error", message: String(e?.message ?? e) };
      statusCode = 503;
    }
  }

  if (wantTg) {
    const tg = await checkTelegram({ casa, kind });
    deepRes.telegram = tg;
    if (tg.status !== "ok") statusCode = 503;
  }

  return json(statusCode, { ...base, ok: statusCode === 200, deep: deepRes });
}
