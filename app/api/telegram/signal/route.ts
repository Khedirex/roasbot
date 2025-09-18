import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram, esc } from "@/lib/telegram";

// ===== Config Next =====
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ===== ENVs =====
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const DEFAULT_CHAT = process.env.ALERTS_CHAT_ID?.trim();
const SINGLE_KEY = process.env.SIGNAL_API_KEY?.trim();   // compat
const MULTI_KEYS = process.env.SIGNAL_API_KEYS?.trim();  // "k1,k2,k3"

// ===== Utils =====
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-requested-with",
};

const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });

// Limites Telegram
const MAX_TEXT = 4096;
const MAX_CAPTION = 1024;

type SignalPayload = {
  // Roteamento por DB (opcionais)
  id?: string;
  game?: string;
  casa?: string;
  kind?: string;

  // Overrides diretos (opcionais)
  chatId?: string | number;
  token?: string;

  // Conteúdo
  strategy?: string;
  event?: "OPPORTUNITY" | "WIN" | "RED" | "MARTINGALE" | "MIRROR" | string;
  odds?: string | number;
  mg?: number;
  when?: string;
  note?: string;

  text?: string;       // se presente, sobrescreve template
  imageUrl?: string;   // se presente, usa sendPhoto
  buttonText?: string;
  buttonUrl?: string;

  // Formatação
  parseMode?: "MarkdownV2" | "HTML" | null;  // default: MarkdownV2 no template; null se text fornecido
  escape?: boolean;    // default: true para MarkdownV2 no template
};

// === Keys ===
function allowedKeys(): Set<string> {
  const list = [
    ...(MULTI_KEYS ? MULTI_KEYS.split(",") : []),
    ...(SINGLE_KEY ? [SINGLE_KEY] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

function readHeaderKey(req: NextRequest): string | null {
  const x = req.headers.get("x-api-key")?.trim();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return x || bearer || null;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return json(405, { ok: false, error: "method not allowed" });
}

/** SendPhoto (caption) com fallback simples */
async function sendPhoto(
  token: string,
  chatId: string,
  photoUrl: string,
  caption: string,
  parseMode: "MarkdownV2" | "HTML" | null | undefined,
  replyMarkup?: any,
  timeoutMs = 8000
) {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const startedAt = Date.now();
  const body: Record<string, any> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
  };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok || data?.ok === false) {
    const detail = data ?? (await res.text().catch(() => res.statusText));
    throw new Error(`sendPhoto failed: ${res.status} ${JSON.stringify(detail).slice(0, 400)}`);
  }
  return { ok: true, ms: Date.now() - startedAt, result: data?.result ?? true };
}

function buildTemplate(p: SignalPayload) {
  const parts: string[] = [];
  const title = p.event ? `*${esc(String(p.event))}*` : "*Sinal*";
  parts.push(`${title}${p.strategy ? ` — ${esc(p.strategy)}` : ""}`);

  const line: string[] = [];
  if (p.odds !== undefined) line.push(`🎯 *Odds:* ${esc(String(p.odds))}`);
  if (p.mg !== undefined) line.push(`🎲 *MG:* ${esc(String(p.mg))}`);
  if (p.when) line.push(`⏱️ *Hora:* ${esc(p.when)}`);
  const SEP = " \\| ";
  if (line.length) parts.push(line.join(SEP));

  if (p.note) parts.push(`📝 ${esc(p.note)}`);
  return parts.join("\n");
}

async function resolveTarget(p: SignalPayload) {
  const overrideToken = p.token?.toString().trim();
  const overrideChat = p.chatId != null ? String(p.chatId).trim() : undefined;

  // 1) id → ignora active
  if (p.id) {
    const t = await prisma.telegramTarget.findUnique({ where: { id: String(p.id) } }).catch(() => null);
    if (t?.botToken && t?.chatId) return { token: overrideToken ?? t.botToken, chatId: overrideChat ?? String(t.chatId), source: "db-id" as const };
  }

  // 2) chatId → ignora active
  if (p.chatId) {
    const t = await prisma.telegramTarget.findFirst({ where: { chatId: String(p.chatId) } }).catch(() => null);
    if (t?.botToken && t?.chatId) return { token: overrideToken ?? t.botToken, chatId: overrideChat ?? String(t.chatId), source: "db-chat" as const };
  }

  // 3) (game,casa,kind) → tenta ativo, depois qualquer
  if (p.game || p.casa || p.kind) {
    const whereBase: any = {
      ...(p.game ? { game: String(p.game) } : {}),
      ...(p.casa ? { casa: String(p.casa) } : {}),
      ...(p.kind ? { kind: String(p.kind) } : {}),
    };
    let t = await prisma.telegramTarget.findFirst({ where: { ...whereBase, active: true } }).catch(() => null);
    if (!t) t = await prisma.telegramTarget.findFirst({ where: whereBase }).catch(() => null);
    if (t?.botToken && t?.chatId) return { token: overrideToken ?? t.botToken, chatId: overrideChat ?? String(t.chatId), source: t.active ? "db-active" as const : "db-inactive" as const };
  }

  // 4) ENVs (fallback)
  if ((overrideToken || TOKEN) && (overrideChat || DEFAULT_CHAT)) {
    return { token: (overrideToken ?? TOKEN)!, chatId: (overrideChat ?? DEFAULT_CHAT)!, source: "env" as const };
  }

  throw new Error("missing token/chatId (db/env)");
}


export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // === Env sanity ===
  const keys = allowedKeys();
  if (keys.size === 0) {
    return json(500, { ok: false, error: "Server misconfig: SIGNAL_API_KEYS/KEY ausente" });
  }

  // === Auth ===
  const headerKey = readHeaderKey(req);
  if (!headerKey || !keys.has(headerKey)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  // === Body ===
  let payload: SignalPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid json" });
  }

  // === Resolve destino (DB → ENV), com overrides se vierem
  let target;
  try {
    target = await resolveTarget(payload);
  } catch (e: any) {
    return json(400, { ok: false, error: e?.message || "resolve target failed" });
  }

  // === Monta texto
  let text: string;
  let parseMode: "MarkdownV2" | "HTML" | null | undefined = payload.parseMode;

  if (payload.text && payload.text.trim()) {
    text = payload.text;
    // Se o user não especificou parseMode, não forçamos (usa null para evitar erros com caracteres)
    if (parseMode === undefined) parseMode = null;
  } else {
    text = buildTemplate(payload);
    // Template padrão em MarkdownV2 + escape
    if (parseMode === undefined) parseMode = "MarkdownV2";
    if (parseMode === "MarkdownV2" && payload.escape !== false) {
      // já escapamos dentro de buildTemplate; aqui só por segurança se texto externo entrar
      text = esc(text);
    }
  }

  // Trunca para evitar 400 do Telegram por tamanho
  const isPhoto = !!payload.imageUrl;
  if (isPhoto && text.length > MAX_CAPTION) text = text.slice(0, MAX_CAPTION - 1) + "…";
  if (!isPhoto && text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 1) + "…";

  // === Dry-run ===
  const { searchParams } = new URL(req.url);
  if (searchParams.get("dry") === "1") {
    return json(200, {
      ok: true,
      debug: {
        source: target.source,
        chatId: target.chatId,
        hasPhoto: isPhoto,
        hasButton: !!(payload.buttonText && payload.buttonUrl),
        preview: text,
        parseMode: parseMode ?? null,
      },
    });
  }

  // === Botão opcional ===
  let reply_markup: any | undefined;
  if (payload.buttonText && payload.buttonUrl) {
    reply_markup = {
      inline_keyboard: [[{ text: payload.buttonText, url: payload.buttonUrl }]],
    };
  }

  // === Envio
  try {
    if (isPhoto && payload.imageUrl) {
      const res = await sendPhoto(
        target.token,
        target.chatId,
        payload.imageUrl,
        text,
        parseMode,
        reply_markup
      );
      return json(200, { ok: true, via: "photo", ms: res.ms, result: res.result, target });
    } else {
      const res = await sendTelegram(text, target.token, target.chatId, {
        parseMode: parseMode ?? null,
        escape: parseMode === "MarkdownV2",          // já escapado, mas mantemos true p/ segurança
        disableWebPagePreview: true,
        truncateAt: MAX_TEXT,
      });
      return json(200, { ok: true, via: "message", result: res?.result ?? res, elapsedMs: Date.now() - startedAt, target });
    }
  } catch (e: any) {
    return json(502, { ok: false, error: e?.message || "telegram send failed", elapsedMs: Date.now() - startedAt, target });
  }
}
