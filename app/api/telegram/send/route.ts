// app/api/telegram/send/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============ CORS / JSON ============ */
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

/* ============ Auth por token (mesma lógica do /targets) ============ */
function getAllowedTokens(): string[] {
  const raw =
    (process.env.INGEST_TOKENS ?? process.env.INGEST_TOKEN ?? "")
      .replace(/["'`]/g, ""); // tolera aspas acidentais
  const tokens = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
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
  if (process.env.INGEST_ALLOW_ANY === "true") return true;
  const allowed = getAllowedTokens();
  if (allowed.length === 0) return true; // dev-friendly se nada configurado
  const got = extractIncomingToken(req);
  return !!got && allowed.includes(got);
}

/* ============ Utils ============ */
async function checkTarget(casa: string, kind: string) {
  const target = await prisma.telegramTarget.findUnique({
    where: { casa_kind: { casa, kind } },
  });
  if (!target || !target.active) {
    const name = !target ? "target_missing" : "target_inactive";
    const err = new Error(name);
    (err as any).code = name;
    throw err;
  }
  return target;
}

async function sendTelegram(opts: {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disablePreview?: boolean;
  timeoutMs?: number;
}) {
  const { botToken, chatId, text, parseMode = "HTML", disablePreview = true, timeoutMs = 10000 } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: disablePreview,
      }),
      signal: controller.signal,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      const reason = data?.description ?? resp.statusText ?? "unknown_error";
      const err = new Error(`telegram_error:${reason}`);
      (err as any).telegram = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

/* ============ POST /send ============ */
export async function POST(req: Request) {
  // Leia o body UMA vez (evita problema de stream consumida no catch)
  const body = await req.json().catch(() => ({} as any));

  try {
    // Auth
    if (!checkToken(req)) return json(401, { error: "Unauthorized" });

    const casa = String(body?.casa || "").trim().toLowerCase();
    const kind = String(body?.kind || "").trim().toLowerCase();
    const text = String(body?.text || "").trim();
    const parseMode = (body?.parseMode as "HTML" | "Markdown" | "MarkdownV2" | undefined) ?? "HTML";
    const disablePreview = body?.disablePreview !== false; // default true
    const dry = body?.dry === true || body?.dry === 1; // dry-run opcional

    if (!casa || !kind || !text) {
      return json(400, { ok: false, error: "missing_params", need: "casa, kind, text" });
    }

    const target = await checkTarget(casa, kind);

    if (dry) {
      // Apenas simula (útil para testes)
      return json(200, {
        ok: true,
        dry: true,
        target: { chatId: target.chatId, casa: target.casa, kind: target.kind },
        payload: { text, parseMode, disablePreview },
      });
    }

    const result = await sendTelegram({
      botToken: target.botToken,
      chatId: target.chatId,
      text,
      parseMode,
      disablePreview,
    });

    // log de sucesso (ignora falha de log)
    try {
      await prisma.telegramLog.create({
        data: {
          casa,
          kind,
          chatId: target.chatId,
          ok: true,
          payload: { text, parseMode, disablePreview },
          response: result,
        },
      });
    } catch {}

    return json(200, { ok: true, result });
  } catch (e: any) {
    // log de erro (ignora falha de log)
    try {
      await prisma.telegramLog.create({
        data: {
          casa: String(body?.casa || ""),
          kind: String(body?.kind || ""),
          chatId: "",
          ok: false,
          payload: body,
          response: { error: String(e?.message ?? e), code: (e as any)?.code, telegram: (e as any)?.telegram },
        },
      });
    } catch {}

    // Mapeia erros conhecidos
    const msg = String(e?.message ?? e);
    if (msg.startsWith("telegram_error:")) {
      return json(502, { ok: false, error: "upstream_telegram", message: msg.replace("telegram_error:", "") });
    }
    if ((e as any)?.code === "target_missing") {
      return json(404, { ok: false, error: "target_missing", message: "Target (casa/kind) não encontrado." });
    }
    if ((e as any)?.code === "target_inactive") {
      return json(409, { ok: false, error: "target_inactive", message: "Target inativo." });
    }

    return json(500, { ok: false, error: "server_error", message: msg });
  }
}
