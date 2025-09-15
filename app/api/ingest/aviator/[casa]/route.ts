// app/api/ingest/aviator/[casa]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/messageTemplate";

import { dispatchToTargets } from "@/lib/dispatchRouter";
import { formatTickMsg, formatMatchMsg } from "@/lib/formatters";


/* Runtime matcher (histórico + match) */
import { onAviatorTick } from "@/lib/runtimeMatcher";
import type { CasaSlug } from "@/lib/strategies";

/* Auto-dispatch (Telegram com cooldown, opcional) */
import { dispatchMatchSignals } from "@/lib/autoDispatch";
import { makeTplCtx, toHtmlLinks } from "@/lib/placeholders";
import { getStrategyMessages } from "@/lib/strategyMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* Casas permitidas */
const ALLOWED_CASAS = ["1win", "lebull"] as const;
type Casa = (typeof ALLOWED_CASAS)[number];

/* ---- Headers / JSON seguro / CORS ---- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-requested-with",
};
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  ...CORS_HEADERS,
};

function stringifySafe(obj: unknown) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
}
function json(status: number, data: unknown, extraHeaders?: Record<string, string>) {
  return new NextResponse(stringifySafe(data), {
    status,
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) },
  });
}
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* ---- Auth opcional (env: INGEST_TOKEN) ---- */
function checkToken(req: Request) {
  const expected = (process.env.INGEST_TOKEN || "").trim();
  if (!expected) return true;
  const got =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return got === expected;
}

/* ================== LOGS & RATE-LIMIT (leve, em memória) ================== */
function log(event: string, level: "info" | "warn" | "error", data: Record<string, any> = {}) {
  const payload = {
    lvl: level,
    ts: new Date().toISOString(),
    event,
    ...data,
  };
  const safe = JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  (level === "warn" ? console.warn : level === "error" ? console.error : console.info)(safe);
}

const RL_WINDOW_MS = Math.max(200, Number(process.env.INGEST_RL_WINDOW_MS ?? "1000")); // 1s
const RL_MAX_HITS = Math.max(1, Number(process.env.INGEST_RL_MAX_HITS ?? "10"));       // 10 req/s por IP+casa
const rlHits = new Map<string, number[]>(); // key = "<ip>:<casa>" -> timestamps

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const anyReq = req as unknown as { ip?: string };
  return fwd || anyReq?.ip || "0.0.0.0";
}
function allowRate(ip: string, casa: string) {
  const key = `${ip}:${casa}`;
  const now = Date.now();
  const winStart = now - RL_WINDOW_MS;
  const arr = rlHits.get(key)?.filter((t) => t >= winStart) ?? [];
  if (arr.length >= RL_MAX_HITS) {
    const retryAfterSec = Math.max(1, Math.ceil((arr[0] + RL_WINDOW_MS - now) / 1000));
    rlHits.set(key, arr);
    return { ok: false as const, retryAfterSec };
  }
  arr.push(now);
  rlHits.set(key, arr);
  return { ok: true as const };
}

/* ---- Normalizadores ---- */
function parseMultiplier(body: any): number | null {
  // aceita: mult, multiplier, m, value, crash (inclui "2.10x" ou "2,10x")
  const raw =
    body?.mult ?? body?.multiplier ?? body?.m ?? body?.value ?? body?.crash;
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/x$/i, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseTs(body: any): number {
  // aceita ts/at; se vier em segundos, converte pra ms
  let ts = Number(body?.at ?? body?.ts ?? Date.now());
  if (!Number.isFinite(ts)) ts = Date.now();
  if (ts < 1e12) ts = Math.round(ts * 1000); // segundos -> ms
  return ts;
}

/* ================= Helpers para preview (não envia) ================= */
type EventKind = "win" | "loss" | "entry";

const DEFAULT_TPL: Record<EventKind, string> = {
  win:
    "✅ WIN! Hoje: [DATA_HOJE] às [HORA_AGORA]\n" +
    "Wins: [WINS] • Sem gale: [SG]\n" +
    "Estratégia: [NOME_ESTRATEGIA] [TIPO_GREEN_MINUSCULO]",
  loss:
    "❌ LOSS em [DATA_HOJE] [HORA_AGORA]\n" +
    "Wins: [WINS] | Reds: [LOSSES] • Gale atual: [GALE_ATUAL]",
  entry:
    "🎯 Entrada confirmada — [NOME_ESTRATEGIA]\n" +
    "Agora: [HORA_AGORA] • Máx gales: [MAX_GALES]",
};

async function sendTelegramDirect(botToken: string, chatId: string, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: !!data?.ok, data };
}

function joinColors(xs: string[]) {
  return xs.join("-");
}

function buildPreview(params: {
  game: "aviator";
  casa: Casa;
  botId?: string | null;
  match: {
    strategyId: string;
    name: string;
    matchedPattern: string[];
    window: string[];
    mgCount: number;
    winAt: number;
  };
  nowISO?: string;
}) {
  const { game, casa, botId, match, nowISO = new Date().toISOString() } = params;
  const header = `[${game.toUpperCase()} · ${casa.toUpperCase()}]`;
  const linha1 = `Estratégia: ${match.name} (mg=${match.mgCount}, winAt=${match.winAt})`;
  const linha2 = `Padrão: ${joinColors(match.matchedPattern)} | Janela: ${joinColors(match.window)}`;
  const rodape = botId ? `bot=${botId} • ${nowISO}` : nowISO;
  return `${header}\n${linha1}\n${linha2}\n${rodape}`;
}

/* ======================== POST (INGEST) ======================== */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ casa: string }> } // Next 15: params como Promise
) {
  const startedAt = Date.now();
  const ip = getClientIp(req);

  try {
    if (!checkToken(req)) {
      log("ingest_unauthorized", "warn", { ip });
      return json(401, { ok: false, error: "unauthorized" });
    }

    const { casa: casaRaw } = await ctx.params;
    const casa = (casaRaw || "").toLowerCase() as Casa;

    if (!ALLOWED_CASAS.includes(casa)) {
      log("ingest_invalid_casa", "warn", { ip, casa: casaRaw });
      return json(404, { ok: false, error: "invalid_casa", casa: casaRaw });
    }

    // Rate-limit por IP+casa
    const rl = allowRate(ip, casa);
    if (!rl.ok) {
      log("ingest_rate_limited", "warn", {
        ip,
        casa,
        windowMs: RL_WINDOW_MS,
        maxHits: RL_MAX_HITS,
        retryAfterSec: rl.retryAfterSec,
      });
      return json(
        429,
        {
          ok: false,
          error: "rate_limited",
          windowMs: RL_WINDOW_MS,
          maxHits: RL_MAX_HITS,
          retryAfterSec: rl.retryAfterSec,
        },
        { "Retry-After": String(rl.retryAfterSec) },
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      log("ingest_invalid_json", "warn", { ip, casa });
      return json(400, { ok: false, error: "invalid_json" });
    }

    const value = parseMultiplier(body);
    const ts = parseTs(body);

    if (value == null) {
      log("ingest_invalid_value", "warn", {
        ip,
        casa,
        got: body?.mult ?? body?.multiplier ?? body?.m ?? body?.value ?? body?.crash,
      });
      return json(400, {
        ok: false,
        error: "invalid_value(mult)",
        got: body?.mult ?? body?.multiplier ?? body?.m ?? body?.value ?? body?.crash,
      });
    }

    // 1) Persistência
    const saved = await prisma.ingestEvent.create({
      data: { game: "aviator", casa, value, ts },
      select: { id: true, value: true, ts: true, createdAt: true },
    });

    // 2) Runtime matcher
    const { matches, token, history } = onAviatorTick(
      casa as CasaSlug,
      value,
      new Date(ts),
    );

    const botId = `aviator-${casa}` as const;
    const previews = matches.map((m) =>
      buildPreview({ game: "aviator", casa, botId, match: m }),
    );

    // (A) ENVIO SEMPRE (DISPATCH_ALWAYS=1) — dispara 1 msg de tick por ingest
    let dispatchAlwaysReport: any = null;
    if ((process.env.DISPATCH_ALWAYS ?? "").trim() === "1") {
      try {
        const text = formatTickMsg({ casa, value, ts });
        dispatchAlwaysReport = await dispatchToTargets({
          casa,
          strategyId: null,
          text,
        });
      } catch (e: any) {
        dispatchAlwaysReport = { ok: false, reason: String(e?.message || e) };
      }
    }

    // 3) Disparo AUTOMÁTICO legado (se você já usa)
    let auto:
      | {
          ok: boolean;
          sent: Array<{ kind: "sent"; text: string } & any>;
          skipped: Array<{ kind: "skipped"; reason: string } & any>;
        }
      | { ok: false; reason: string; sent: any[]; skipped: any[] }
      | null = null;

    const flagAuto =
      (process.env.TELEGRAM_AUTO_ON_MATCH ?? "").trim() === "1" ||
      (process.env.AUTO_DISPATCH_ENABLED ?? "1") !== "0";

    if (flagAuto && matches.length) {
      try {
        auto = await dispatchMatchSignals({
          game: "aviator",
          casa: casa as CasaSlug,
          matches,
          botId,
        });
      } catch (err) {
        console.error("auto-dispatch error:", err);
        auto = { ok: false, reason: "dispatch_exception", sent: [], skipped: [] };
      }
    }

    // (B) ENVIO POR MATCH — 1 mensagem para cada match encontrado
// precisa já ter: import { dispatchToTargets } from "@/lib/dispatchRouter";
// e, se for usar os textos da UI, import { getStrategyMessages } from "@/lib/strategyMessages";

// (B) ENVIO POR MATCH usando o texto da UI com seus placeholders
let dispatchMatchReport: any = null;
const flagMatch =
  (process.env.TELEGRAM_AUTO_ON_MATCH ?? "").trim() === "1" ||
  (process.env.AUTO_DISPATCH_ENABLED ?? "1") !== "0";

if (flagMatch && matches.length) {
  const results: any[] = [];

  for (const m of matches) {
    // 1) pega pacote de mensagens dessa estratégia (tela da UI)
    const pack = await getStrategyMessages(m.strategyId);

    // 2) escolhe qual mensagem usar (ex.: prioridade WIN > ENTRY > MIRROR > MARTINGALE > NOOP > LOSS)
    const template =
      pack.win ||
      pack.entry ||
      pack.mirror ||
      pack.martingale ||
      pack.noop ||
      pack.loss ||
      "🎯 [NOME_ESTRATEGIA] · [CASA]\nPadrão: [PATTERN]\nJanela: [WINDOW]\nMG: [MG] · WinAt: [WIN_AT]x\n[TS_ISO]";

    // 3) monta o contexto com SEUS placeholders
    const ctx = makeTplCtx({
      casa,
      value,             // crash atual
      ts,
      strategy: {
        id: m.strategyId,
        name: m.name,
        matchedPattern: m.matchedPattern,
        window: m.window,
        mgCount: m.mgCount,
        winAt: m.winAt,
      },
      stats: body?.stats, // se você já manda stats no body
      extras: body?.ctx,  // qualquer adicional que sua UI precisar
    });

    // 4) renderiza
    let text = renderTemplate(template, ctx);

    // 5) opcional: converte [url=...]... pra <a> se for usar HTML
    if (pack.parseMode === "HTML") {
      text = toHtmlLinks(text);
    }

    // 6) dispara para os alvos (com tags e parse_mode vindos da UI)
    const r = await dispatchToTargets({
      casa,
      strategyId: m.strategyId,
      text,
      tags: pack.tags,
      parse_mode: pack.parseMode as "HTML" | "MarkdownV2" | undefined, // "HTML" recomendado se usar <b>, <code>, <a>
    });

    results.push({ strategyId: m.strategyId, result: r });
  }

  dispatchMatchReport = { ok: true, results };
}



    // 4) Envio MANUAL por template (controle da extensão). NÃO interfere no auto/roteador.
    let sent:
      | { ok: boolean; response?: any; text?: string }
      | undefined;

    const event: EventKind | "" = (body?.event || "")
      .toString()
      .toLowerCase() as EventKind;
    const tg = body?.telegram;
    const wantsSend =
      !!(tg?.botToken && tg?.chatId) &&
      (event === "win" || event === "loss" || event === "entry");

    if (wantsSend) {
      const ctxForTpl = {
        now: new Date(),
        game: "aviator",
        current: {
          strategyName:
            body?.current?.strategyName ??
            body?.strategyName ??
            "Estratégia",
          galeDaEntrada: body?.current?.galeDaEntrada ?? 0,
        },
        stats: {
          wins: body?.stats?.wins ?? 0,
          losses: body?.stats?.losses ?? 0,
          sg: body?.stats?.sg ?? 0,
          galeAtual: body?.stats?.galeAtual ?? 0,
          maxGales: body?.stats?.maxGales ?? 0,
          ganhosConsecutivos: body?.stats?.ganhosConsecutivos ?? 0,
          ganhosConsecutivosGale:
            body?.stats?.ganhosConsecutivosGale ?? 0,
          ganhosConsecutivosSemGale:
            body?.stats?.ganhosConsecutivosSemGale ?? 0,
          gWinsByLevel: body?.stats?.gWinsByLevel ?? { 1: 0, 2: 0 },
        },
        ...body?.ctx,
      };

      const template: string =
        typeof body?.template === "string" && body.template.trim()
          ? body.template
          : DEFAULT_TPL[event];

      const text = renderTemplate(template, ctxForTpl);
      const tgRes = await sendTelegramDirect(tg.botToken, tg.chatId, text);
      sent = { ok: tgRes.ok, response: tgRes.data, text };
    }

    const durationMs = Date.now() - startedAt;
    log("ingest_ok", "info", {
      ip,
      casa,
      value,
      token,
      matches: matches.length,
      durationMs,
    });

    return json(201, {
      ok: true,
      saved,
      token,
      history,            // tokens atuais
      matches,            // matches ativos
      previews,           // apenas visual
      auto,               // relatório legacy (se houver)
      dispatchAlwaysReport,  // <— novo: envio SEMPRE
      dispatchMatchReport,   // <— novo: envio POR MATCH
      ...(sent ? { sent } : {}),
      durationMs,
    });
  } catch (e: any) {
    log("ingest_exception", "error", { msg: String(e?.message ?? e) });
    return json(500, {
      ok: false,
      error: "server_error",
      message: String(e?.message ?? e),
    });
  }
}
