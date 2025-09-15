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

/* ===== Utils ===== */

/** Tiny timeout helper para promessas que não suportam AbortController */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, r) =>
      setTimeout(() => r(new Error(`${label}: timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/** Deep DB check (rápido, sem tocar em tabelas) */
async function checkDb(timeoutMs = 3000) {
  // SELECT 1 é universal e evita lock/tabelas inexistentes
  await withTimeout(prisma.$queryRawUnsafe("SELECT 1"), timeoutMs, "db");
  return "ok" as const;
}

/** Tenta pegar alvo no Prisma; se não houver modelo/tabela, cai no fallback via ENV */
async function resolveTelegramTargetFromPrisma(opts?: { casa?: string; kind?: string }) {
  const where: any = { active: true };
  if (opts?.casa) where.casa = String(opts.casa).trim().toLowerCase();
  if (opts?.kind) where.kind = String(opts.kind).trim().toLowerCase();

  try {
    // se existir índice composto casa_kind no schema, privilegia a busca direta
    if (opts?.casa && opts?.kind && (prisma as any).telegramTarget?.findUnique) {
      const t = await (prisma as any).telegramTarget.findUnique({
        where: { casa_kind: { casa: where.casa, kind: where.kind } },
      });
      if (t?.active) return { botToken: t.botToken as string, chatId: t.chatId as string | number };
    }
    if ((prisma as any).telegramTarget?.findFirst) {
      const t = await (prisma as any).telegramTarget.findFirst({ where });
      if (t?.active) return { botToken: t.botToken as string, chatId: t.chatId as string | number };
    }
  } catch {
    // modelo/tabela pode não existir ainda — ignora e usa ENV
  }
  return null;
}

/** Deep Telegram check: usa registro ativo do Prisma ou cai pro ENV (TELEGRAM_BOT_TOKEN/ALERTS_CHAT_ID) */
async function checkTelegram(opts?: {
  casa?: string;
  kind?: string;
  timeoutMs?: number;
  directEnv?: boolean; // força usar ENV direto
}) {
  const { casa, kind, timeoutMs = 7000, directEnv = false } = opts || {};
  let cred:
    | { botToken: string; chatId?: string | number }
    | null = null;

  if (!directEnv) {
    cred = await resolveTelegramTargetFromPrisma({ casa, kind });
  }
  if (!cred) {
    // fallback via ENV
    const envToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const envChat = (process.env.ALERTS_CHAT_ID || "").trim();
    cred = { botToken: envToken, chatId: envChat || undefined };
  }

  if (!cred.botToken) {
    return { status: "no_credentials" as const };
  }

  // valida o bot com getMe (não exige chatId)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.telegram.org/bot${cred.botToken}/getMe`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return { status: "error" as const, data, httpStatus: r.status };
    }
    return {
      status: "ok" as const,
      bot: data.result?.username ?? null,
      hasChatId: !!cred.chatId,
      chatId: cred.chatId ?? null,
    };
  } catch (e: any) {
    return { status: "error" as const, message: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/* ===== Handler ===== */

/**
 * GET /api/healthz
 * - shallow (default): sempre 200 com info básica
 * - deep=db|1: checa DB; 503 se falhar
 * - deep=telegram: checa Telegram (getMe) usando alvo ativo do Prisma; 503 se falhar
 *   - ?direct=1 força usar ENV (TELEGRAM_BOT_TOKEN/ALERTS_CHAT_ID) em vez do Prisma
 *   - ?casa=...&kind=... filtra o alvo do Prisma
 * - deep=all: DB + Telegram; 503 se algum falhar
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
      ingestAllowAny: (process.env.INGEST_ALLOW_ANY ?? "").toString() === "true" ? "true" : "false",
      ingestTokensConfigured:
        ((process.env.INGEST_TOKENS ?? process.env.INGEST_TOKEN ?? "").trim().length > 0),
      telegramEnv: {
        hasBotToken: !!(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
        hasAlertsChatId: !!(process.env.ALERTS_CHAT_ID || "").trim(),
      },
    },
    versions: {
      node: process.version,
      // Nota: NEXT_RUNTIME indica runtime do handler, mas não é a versão do Next.
      nextRuntime: process.env.NEXT_RUNTIME ?? "nodejs",
    },
  };

  // shallow
  if (!deep || deep === "0") return json(200, base);

  // deep: switches
  const wantDb = deep === "1" || deep === "db" || deep === "all";
  const wantTg = deep === "telegram" || deep === "all";

  const casa = url.searchParams.get("casa") || undefined;
  const kind = url.searchParams.get("kind") || undefined;
  const directEnv = (url.searchParams.get("direct") || "") === "1";

  const deepRes: Record<string, unknown> = {};
  let statusCode = 200;

  if (wantDb) {
    try {
      await checkDb(3000);
      deepRes.db = "ok";
    } catch (e: any) {
      deepRes.db = { status: "error", message: String(e?.message ?? e) };
      statusCode = 503;
    }
  }

  if (wantTg) {
    const tg = await checkTelegram({ casa, kind, directEnv });
    deepRes.telegram = tg;
    if (tg.status !== "ok") statusCode = 503;
  }

  return json(statusCode, { ...base, ok: statusCode === 200, deep: deepRes });
}
