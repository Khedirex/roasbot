// lib/matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchStrategies } from "./matcher";
import type { Strategy } from "./strategies";

/**
 * Estes testes assumem que `matchStrategies`:
 * - recebe { history, strategies, historyLimit }
 * - retorna um ARRAY de matches: { strategyId, name, matchedPattern, window, mgCount, winAt }
 * - faz casamento de cauda exata (final do histórico = pattern)
 * Observação: o matcher NÃO filtra `enabled`; isso é responsabilidade da camada superior.
 */

const S: Strategy = {
  id: "s1",
  name: "RG Tail",
  startHour: "00:00",
  endHour: "23:59",
  mgCount: 2,
  enabled: true,
  winAt: 1,
  pattern: ["R", "G"],
};

describe("matchStrategies (básico)", () => {
  it("casa quando a cauda bate exatamente o pattern", () => {
    const history = ["R", "R", "G", "R", "G"];
    const matches = matchStrategies({
      history,
      strategies: [S],
      historyLimit: 200,
    });

    expect(Array.isArray(matches)).toBe(true);
    expect(matches.length).toBe(1);
    const m = matches[0];
    expect(m.strategyId).toBe("s1");
    expect(m.name).toBe("RG Tail");
    expect(m.matchedPattern).toEqual(["R", "G"]);
    expect(m.window.slice(-2)).toEqual(["R", "G"]);
    expect(m.mgCount).toBe(2);
    expect(m.winAt).toBe(1);
  });

  it("não casa quando o pattern aparece no meio, mas não na cauda", () => {
    const history = ["R", "G", "R", "R"]; // "R,G" existe no começo, mas cauda é "R,R"
    const matches = matchStrategies({
      history,
      strategies: [S],
      historyLimit: 200,
    });
    expect(matches.length).toBe(0);
  });

  it("respeita historyLimit (se o pattern está antes do corte, não deve casar)", () => {
    const long = [
      "R","G","R","G","R","G","R","G","R","G",
      "R","G","R","G","R","G","R","G","R","G",
      "R","R","G" // cauda real que casa
    ];
    // limit corta para os últimos 2 itens: ["R","G"] → ainda deve casar
    const m1 = matchStrategies({ history: long, strategies: [S], historyLimit: 2 });
    expect(m1.length).toBe(1);

    // limit que NÃO inclui a cauda completa (ex.: 1) → não casa
    const m2 = matchStrategies({ history: long, strategies: [S], historyLimit: 1 });
    expect(m2.length).toBe(0);
  });

  it("não explode com lista de estratégias vazia", () => {
    const matches = matchStrategies({
      history: ["R", "G", "R"],
      strategies: [],
      historyLimit: 200,
    });
    expect(matches.length).toBe(0);
  });

  it("documenta o contrato atual: matcher NÃO filtra enabled (portanto casa mesmo se enabled=false)", () => {
    const disabled: Strategy = { ...S, id: "s2", enabled: false };
    const matches = matchStrategies({
      history: ["R", "G"],
      strategies: [disabled],
      historyLimit: 200,
    });
    // contrato atual: se passar pro matcher, ele casa
    expect(matches.length).toBe(1);
  });

  it("exemplo de uso correto: filtrar enabled antes de chamar o matcher → não casa", () => {
    const disabled: Strategy = { ...S, id: "s3", enabled: false };
    const filtered = [disabled].filter((x) => x.enabled); // camada superior faria isso
    const matches = matchStrategies({
      history: ["R", "G"],
      strategies: filtered,
      historyLimit: 200,
    });
    expect(matches.length).toBe(0);
  });
});
