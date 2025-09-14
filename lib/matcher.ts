// lib/matcher.ts
import type { Strategy } from "@/lib/strategies";

/**
 * Normaliza cores/padrões para comparação simples.
 * - 'r' | 'red' | 'vermelho'  -> 'R'
 * - 'g' | 'green' | 'verde'    -> 'G'
 * - 'b' | 'black' | 'branco' | 'white' -> 'B'
 * - qualquer outro valor vira o primeiro char em maiúsculo.
 */
export function normColor(x: string): "R" | "G" | "B" | string {
  const s = String(x).trim().toLowerCase();
  if (s.startsWith("r") || s.startsWith("verme")) return "R";
  if (s.startsWith("g") || s.startsWith("verd")) return "G";
  if (s.startsWith("b") || s.startsWith("wh") || s.startsWith("bran")) return "B";
  return s.charAt(0).toUpperCase();
}

/** Igualdade posicional simples entre duas sequências já normalizadas */
function seqEq(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export type Match = {
  strategyId: string;
  name: string;
  matchedPattern: string[]; // padrão que bateu
  window: string[];         // janela observada (tail do histórico)
  mgCount: number;
  winAt: number;
};

export type MatchInput = {
  /** Histórico do mais antigo -> mais novo */
  history: string[];
  /** Estratégias disponíveis (já validadas) */
  strategies: Strategy[];
  /** Tamanho máximo de histórico considerado (default: 20) */
  historyLimit?: number;
};

/**
 * Verifica quais estratégias casam com a CAUDA do histórico.
 * Ex.: history [..., R, G, R, R] e pattern [G, R, R] => match.
 */
export function matchStrategies(input: MatchInput): Match[] {
  const { strategies, historyLimit = 20 } = input;
  const history = (input.history ?? []).slice(-historyLimit).map(normColor);

  const matches: Match[] = [];

  for (const s of strategies) {
    const pat = (s.pattern ?? []).map(normColor).filter(Boolean);
    if (pat.length === 0) continue;
    if (history.length < pat.length) continue;

    const tail = history.slice(-pat.length);
    if (!seqEq(tail, pat)) continue;

    matches.push({
      strategyId: s.id,
      name: s.name,
      matchedPattern: pat,
      window: tail,
      mgCount: s.mgCount ?? 0,
      winAt: s.winAt ?? 1,
    });
  }

  return matches;
}
