// lib/runtimeMatcher.ts
// Runtime matcher do Aviator: histórico por bot + casamento de padrões + buffer de últimos matches.

import { getActiveStrategies, type CasaSlug, type BotId } from "@/lib/strategies";
import { matchStrategies } from "@/lib/matcher";

/** Thresholds (podem ser ajustados por ENV) */
const GREEN_AT = Number(process.env.AVIATOR_GREEN_AT ?? "2");
const WHITE_AT = Number(process.env.AVIATOR_WHITE_AT ?? "1");

/** Tamanho dos buffers em memória */
const MAX_HISTORY = 200;
const MAX_RECENT_MATCHES = 50;

/** Armazenamento em memória por botId */
export type Token = "R" | "G" | "B" | string;

export type RecentMatch = {
  strategyId: string;
  name: string;
  matchedPattern: string[];
  window: string[];
  mgCount: number;
  winAt: number;
  at: number; // epoch ms
};

const histories = new Map<string, Token[]>();           // botId -> tokens
const recentMatches = new Map<string, RecentMatch[]>(); // botId -> últimos matches

/** Util: compõe botId a partir da casa (com tipo correto) */
function botIdFor(casa: CasaSlug): BotId {
  return `aviator-${casa}` as BotId;
}

/** Converte multiplicador em token conforme thresholds atuais */
export function aviatorToToken(mult: number): Token {
  if (Number.isFinite(mult) && mult === WHITE_AT) return "B";
  if (Number.isFinite(mult) && mult >= GREEN_AT) return "G";
  return "R";
}

/** Obtém snapshot do histórico do bot */
export function getBotHistory(botId: string): Token[] {
  return histories.get(botId)?.slice() ?? [];
}

/** Obtém snapshot dos últimos matches do bot */
export function getRecentMatches(botId: string): RecentMatch[] {
  // mais recentes primeiro
  return recentMatches.get(botId)?.slice().reverse() ?? [];
}

/** Limpa histórico e últimos matches do bot (útil para /api/runtime/reset) */
export function resetBotRuntime(botId: string) {
  histories.delete(botId);
  recentMatches.delete(botId);
}

/** Aplica push em buffer com limite fixo */
function pushWithCap<T>(arr: T[], item: T, cap: number) {
  arr.push(item);
  if (arr.length > cap) arr.shift();
}

/** Tick principal: chamado a cada ingest de Aviator */
export function onAviatorTick(
  casa: CasaSlug,
  value: number,
  now: Date = new Date(),
): {
  token: Token;
  history: Token[];
  matches: RecentMatch[];
} {
  const botId = botIdFor(casa);

  // 1) Atualiza histórico
  const token = aviatorToToken(value);
  const h = histories.get(botId) ?? [];
  pushWithCap(h, token, MAX_HISTORY);
  histories.set(botId, h);

  // 2) Estratégias ativas no momento
  const strategies = getActiveStrategies(botId, now);

  // 3) Casamento de padrões (cauda exata)
  //    matchStrategies retorna um ARRAY de matches (não um objeto { matches })
  const matches = matchStrategies({
    history: h,
    strategies,
    historyLimit: MAX_HISTORY,
  });

  // 4) Se houve match, grava no buffer de “recentes”
  if (matches.length) {
    const buf = recentMatches.get(botId) ?? [];
    for (const m of matches) {
      const item: RecentMatch = {
        strategyId: m.strategyId,
        name: m.name,
        matchedPattern: m.matchedPattern,
        window: m.window,
        mgCount: m.mgCount,
        winAt: m.winAt,
        at: now.getTime(),
      };
      pushWithCap(buf, item, MAX_RECENT_MATCHES);
    }
    recentMatches.set(botId, buf);
  }

  // 5) Retorno p/ quem chamou (ingest, debug, etc.)
  return {
    token,
    history: h.slice(),
    matches: (matches as RecentMatch[]).slice(),
  };
}

/** Pequeno helper para diagnostics */
export function getRuntimeDiagnostics(botId: string) {
  return {
    botId,
    greenAt: GREEN_AT,
    whiteAt: WHITE_AT,
    history: getBotHistory(botId),
    recentMatches: getRecentMatches(botId),
  };
}
