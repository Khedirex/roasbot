// lib/runtimeMatcher.ts
// Adapta o stream (ex.: Aviator) -> tokens de cor -> matcher de estratégias.

import type { CasaSlug, BotId } from "@/lib/strategies";
import { getActiveStrategies } from "@/lib/strategies";
import * as matcher from "@/lib/matcher"; // << importa o módulo inteiro

/** Normalizador simples de cores (mantido local para evitar ciclo de imports) */
function normColor(x: string): "R" | "G" | "B" | string {
  const s = String(x).trim().toLowerCase();
  if (s.startsWith("r")) return "R";                  // red / vermelho
  if (s.startsWith("g")) return "G";                  // green / verde
  if (s.startsWith("b") || s.startsWith("w")) return "B"; // black/white (branco)
  return s.charAt(0).toUpperCase();
}

/** Histórico de tokens por bot em memória */
const MAX_HISTORY = 200;
const history = new Map<BotId, string[]>();

export type AviatorToken = "G" | "R" | "B"; // Green (>=2x), Red (<2x), White (=1.00x)

/** Limiares básicos; podem ser ajustados por env */
const GREEN_AT = Number(process.env.AVIATOR_GREEN_AT ?? "2");
const WHITE_AT = Number(process.env.AVIATOR_WHITE_AT ?? "1"); // 1.00x

/** Classifica o crash em um token simples */
export function aviatorToToken(mult: number): AviatorToken {
  // white primeiro (1.00x)
  if (Math.abs(mult - WHITE_AT) < 1e-9) return "B";
  return mult >= GREEN_AT ? "G" : "R";
}

/** Retorna cópia do histórico atual do bot */
export function getBotHistory(botId: BotId): string[] {
  return [...(history.get(botId) ?? [])];
}

/** Limpa histórico do bot */
export function resetBotHistory(botId: BotId): void {
  history.set(botId, []);
}

/**
 * Alimenta um crash do Aviator, atualiza histórico e tenta casar estratégias ativas.
 * @param casa   "1win" | "lebull"
 * @param mult   multiplicador (ex.: 1.67)
 * @param now    default = new Date()
 * @returns { matches, token, history }
 */
export function onAviatorTick(
  casa: CasaSlug,
  mult: number,
  now: Date = new Date()
): { matches: ReturnType<typeof matcher.matchStrategies>; token: AviatorToken; history: string[] } {
  const botId: BotId = `aviator-${casa}`;
  const token = aviatorToToken(mult);

  // atualiza histórico
  const arr = history.get(botId) ?? [];
  arr.push(token);
  if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY);
  history.set(botId, arr);

  // pega estratégias ativas nesse horário
  const strategies = getActiveStrategies(botId, now);

  // roda o matcher com uma janela razoável
  const matches = matcher.matchStrategies({
    history: arr.map(normColor),
    strategies,
    historyLimit: 60,
  });

  return { matches, token, history: [...arr] };
}
