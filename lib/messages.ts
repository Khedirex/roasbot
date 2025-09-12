async function renderMessage(template: string, ctx: any) {
  const res = await fetch("/api/messages/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template, ctx }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`render failed: ${res.status}`);
  const json = await res.json();
  return json.text as string;
}

// exemplo de uso:
const text = await renderMessage(
  "Hoje: [DATA_HOJE] às [HORA_AGORA] • Wins: [WINS] • Assertividade: [PERCENTUAL_ASSERTIVIDADE]",
  {
    game: "aviator",
    now: new Date(),
    stats: {
      wins: 5, losses: 2, sg: 3,
      galeAtual: 0, maxGales: 2,
      ganhosConsecutivos: 2,
      ganhosConsecutivosGale: 0,
      ganhosConsecutivosSemGale: 2,
      gWinsByLevel: { 1: 3, 2: 1 }
    },
    current: { strategyName: "Estratégia X", galeDaEntrada: 0 }
  }
);

export {};
