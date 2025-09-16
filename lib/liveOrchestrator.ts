// lib/liveOrchestrator.ts
import {
  listStrategies,
  getActiveStrategiesByHHMM,
  nowHHMM,
  type Strategy,
  type CasaSlug,
} from "@/lib/strategies";
import { dispatchStrategyMessage } from "@/lib/dispatchStrategy";

// ===== Estado em memória =====
// chave = `${botId}:${strategyId}`
type Key = string;
type EntryState = {
  gale: number;       // 0 = sem gale ainda
  mgCount: number;    // máximo de gales permitidos
  lastEventAt: number;
  active: boolean;    // está numa sequência de entrada (até win ou red final)?
};

// pré-entrada (um passo do padrão)
type PreFlag = {
  flaggedAt: number;
  lastRefText: string; // ex.: "2.97x"
};

const entryMap = new Map<Key, EntryState>();
const preMap = new Map<Key, PreFlag>();

// cooldown anti-flood por evento
const COOLDOWN_MS = Math.max(1500, Number(process.env.DISPATCH_COOLDOWN_MS ?? "2500"));

// utils
const fmtX = (v: number) => `${v.toFixed(2)}x`;

function keyOf(botId: string, s: Strategy): Key {
  return `${botId}:${s.id}`;
}

function isCooldown(k: Key): boolean {
  const st = entryMap.get(k);
  if (!st) return false;
  return Date.now() - st.lastEventAt < COOLDOWN_MS;
}

// verifica se o histórico está "a uma vela" de bater o padrão
function isOneAway(pattern: string[], history: string[]): boolean {
  if (!pattern.length) return false;
  if (history.length < pattern.length - 1) return false;
  const need = pattern.slice(0, -1).join("");
  const got = history.slice(- (pattern.length - 1)).join("");
  return need === got;
}

export async function processTick({
  casa,
  value,
  token,
  history,
}: {
  casa: CasaSlug;
  value: number;
  token: "R" | "G" | "B";
  history: string[]; // ex.: ["R","G","R",...]
}) {
  const botId = `aviator-${casa}` as const;
  const hhmm = nowHHMM();

  // Estratégias ativas neste horário
  const actives = getActiveStrategiesByHHMM(botId, hhmm);

  // 1) Pré-entrada (um sinal antes de bater)
  for (const s of actives) {
    const pat = s.pattern as unknown as string[];
    const k = keyOf(botId, s);

    // se já está em sequência de entrada, não manda pre_entry
    const st = entryMap.get(k);
    if (st?.active) continue;

    if (isOneAway(pat, history)) {
      const prev = preMap.get(k);
      // só envia se ainda não sinalizado recentemente
      if (!prev || Date.now() - prev.flaggedAt > COOLDOWN_MS) {
        preMap.set(k, { flaggedAt: Date.now(), lastRefText: fmtX(value) });
        await dispatchStrategyMessage({
          strategyId: s.id,
          event: "pre_entry",
          vars: { VELA_REFERENCIA_TEXTO: fmtX(value), MAX_GALES: s.mgCount },
        });
      }
    } else {
      // Se estava “armado” e perdeu o um-away sem entrar, manda no_opportunity 1x
      if (preMap.has(k) && !st?.active) {
        preMap.delete(k);
        await dispatchStrategyMessage({
          strategyId: s.id,
          event: "no_opportunity",
          vars: { MAX_GALES: s.mgCount },
        });
      }
    }
  }

  // 2) Entrada (padrão bateu no tick atual) — usamos actives + comparação direta
  for (const s of actives) {
    const pat = s.pattern as unknown as string[];
    const k = keyOf(botId, s);
    // match se o final do histórico == padrão completo
    const need = pat.join("");
    const got = history.slice(-pat.length).join("");
    const matched = need === got;

    // estado atual
    const st = entryMap.get(k);

    if (matched) {
      // Se já estamos no meio de uma entrada e acabou de bater de novo, ignore (dedupe)
      if (st?.active && isCooldown(k)) continue;

      // Entrada detectada -> armamos sequência
      entryMap.set(k, { gale: 0, mgCount: s.mgCount, lastEventAt: Date.now(), active: true });

      // limpa “pré” pois virou entrada
      preMap.delete(k);

      await dispatchStrategyMessage({
        strategyId: s.id,
        event: "entry",
        vars: { VELA_REFERENCIA_TEXTO: fmtX(value), MAX_GALES: s.mgCount },
      });
      continue;
    }

    // 3) Se estamos em sequência (após uma entrada), ver resultado do tick atual
    if (st?.active) {
      if (isCooldown(k)) continue; // evita flood

      if (token === "G" || token === "B") {
        // WIN (atingiu alvo)
        await dispatchStrategyMessage({
          strategyId: s.id,
          event: "win",
          vars: { RESULTADO_VELA_TEXTO: fmtX(value) },
        });
        entryMap.delete(k);
        continue;
      }

      // token = "R" (não bateu)
      if (st.gale < st.mgCount) {
        // G1/G2…
        st.gale += 1;
        st.lastEventAt = Date.now();
        entryMap.set(k, st);
        await dispatchStrategyMessage({
          strategyId: s.id,
          event: "gale",
          vars: { GALE_ATUAL: st.gale },
        });
      } else {
        // Sem mais gales -> RED
        await dispatchStrategyMessage({
          strategyId: s.id,
          event: "red",
          vars: {},
        });
        entryMap.delete(k);
      }
    }
  }
}
