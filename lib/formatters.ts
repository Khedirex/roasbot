// lib/formatters.ts

export function formatTickMsg(params: { casa: string; value: number; ts: number }) {
  const dt = new Date(params.ts);
  const hh = dt.toLocaleTimeString("pt-BR", { hour12: false });
  const dd = dt.toLocaleDateString("pt-BR");
  return [
    `📡 Tick · ${params.casa.toUpperCase()}`,
    `💥 Crash: ${params.value.toFixed(2)}x`,
    `🕒 ${dd} ${hh}`,
  ].join("\n");
}

export function formatMatchMsg(params: {
  casa: string;
  match: {
    strategyId: string;
    name: string;
    matchedPattern: string[];
    window: string[];
    mgCount: number;
    winAt: number;
  };
  ts: number;
}) {
  const dt = new Date(params.ts);
  const hh = dt.toLocaleTimeString("pt-BR", { hour12: false });
  const dd = dt.toLocaleDateString("pt-BR");
  const m = params.match;

  return [
    `🎯 MATCH · ${params.casa.toUpperCase()} · ${m.name}`,
    `🧩 Padrão: ${m.matchedPattern.join("-")}`,
    `🪟 Janela: ${m.window.join("-")}`,
    `🧮 MG: ${m.mgCount} · WinAt: ${m.winAt}x`,
    `🕒 ${dd} ${hh}`,
  ].join("\n");
}
