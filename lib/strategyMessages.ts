// lib/strategyMessages.ts
import { prisma } from "@/lib/prisma";

export type StrategyMsgPack = {
  entry?: string;          // possibilidade de entrada
  mirror?: string;         // espelhar
  win?: string;            // WIN
  loss?: string;           // RED
  noop?: string;           // não houve oportunidade
  martingale?: string;     // usar martingale
  parseMode?: "HTML" | "MarkdownV2";
  tags?: string[];         // roteamento (ex.: ["vip"])
};

// Util: pega texto de múltiplas chaves possíveis
function pickFirst(obj: any, keys: string[], def = ""): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return def;
}

// Util: normaliza tags em array
function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  const str = String(raw);
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
  } catch {}
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Util: tenta extrair um pack de um objeto genérico (strategy ou row de outra tabela)
function extractPackFromAny(s: any): Partial<StrategyMsgPack> {
  if (!s) return {};
  // candidatos de container JSON onde você pode ter salvo
  const jsonContainer =
    s.messages ?? s.msgs ?? s.templates ?? s.texts ?? s.payload ?? s.config ?? null;

  const fromRoot = {
    entry:       pickFirst(s, ["msgEntry", "entry", "onOpportunity"]),
    mirror:      pickFirst(s, ["msgMirror", "mirror"]),
    win:         pickFirst(s, ["msgWin", "win", "onWin"]),
    loss:        pickFirst(s, ["msgLoss", "loss", "red", "onRed"]),
    noop:        pickFirst(s, ["msgNoop", "noop", "onNoOpportunity"]),
    martingale:  pickFirst(s, ["msgMartingale", "martingale"]),
    parseMode:   (s.parseMode as any) || undefined,
    tags:        normalizeTags(s.tags),
  };

  const fromJson = jsonContainer
    ? {
        entry:       pickFirst(jsonContainer, ["msgEntry", "entry", "onOpportunity"]),
        mirror:      pickFirst(jsonContainer, ["msgMirror", "mirror"]),
        win:         pickFirst(jsonContainer, ["msgWin", "win", "onWin"]),
        loss:        pickFirst(jsonContainer, ["msgLoss", "loss", "red", "onRed"]),
        noop:        pickFirst(jsonContainer, ["msgNoop", "noop", "onNoOpportunity"]),
        martingale:  pickFirst(jsonContainer, ["msgMartingale", "martingale"]),
        parseMode:   (jsonContainer.parseMode as any) || undefined,
        tags:        normalizeTags(jsonContainer.tags),
      }
    : {};

  // prioridade: valores do JSON > valores “soltos” na raiz
  return {
    entry:       fromJson.entry       || fromRoot.entry,
    mirror:      fromJson.mirror      || fromRoot.mirror,
    win:         fromJson.win         || fromRoot.win,
    loss:        fromJson.loss        || fromRoot.loss,
    noop:        fromJson.noop        || fromRoot.noop,
    martingale:  fromJson.martingale  || fromRoot.martingale,
    parseMode:   fromJson.parseMode   || fromRoot.parseMode,
    tags:        (fromJson.tags?.length ? fromJson.tags : fromRoot.tags) || [],
  };
}

export async function getStrategyMessages(strategyId: string): Promise<StrategyMsgPack> {
  // 1) tenta direto na tabela strategy (sem select tipado, para não quebrar o TS)
  const s: any = await prisma.strategy.findUnique({
    where: { id: strategyId },
  });

  let merged: Partial<StrategyMsgPack> = extractPackFromAny(s);

  // 2) se existir uma tabela separada "strategyMessage" (ou algo parecido), tenta complementar
  //    -> ajuste o nome abaixo se sua tabela tiver outro nome
  if ((prisma as any).strategyMessage?.findFirst) {
    try {
      const sm: any = await (prisma as any).strategyMessage.findFirst({
        where: { strategyId },
      });
      const fromSm = extractPackFromAny(sm);
      merged = { ...merged, ...Object.fromEntries(Object.entries(fromSm).filter(([_, v]) => v)) };
    } catch {}
  }

  // 3) defaults e normalização final
  const pack: StrategyMsgPack = {
    entry:       merged.entry       ?? "",
    mirror:      merged.mirror      ?? "",
    win:         merged.win         ?? "",
    loss:        merged.loss        ?? "",
    noop:        merged.noop        ?? "",
    martingale:  merged.martingale  ?? "",
    parseMode:   (merged.parseMode as any) || "HTML",
    tags:        Array.isArray(merged.tags) ? merged.tags : [],
  };

  return pack;
}
