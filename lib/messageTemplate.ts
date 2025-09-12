// lib/messageTemplate.ts
export type GameKind = "double" | "crash" | "branco" | "wingo" | "aviator";

export type StrategyMessages = {
  onOpportunity: string;
  onNoOpportunity: string;
  onMirror: string;
  onWin: string;
  onRed: string;
  onMartingale: string;
};

export type DailyStats = {
  wins: number;
  losses: number;
  sg: number; // wins sem gale (total do dia)
  galeAtual: number;     // GALE_ATUAL
  maxGales: number;      // MAX_GALES
  ganhosConsecutivos: number;
  ganhosConsecutivosGale: number;
  ganhosConsecutivosSemGale: number;
  gWinsByLevel?: Record<number, number>; // {1: WINS no G1, 2: no G2, ...}
  // opcionais por robô/jogo:
  whites?: number;
  horarioUltimoBranco?: Date | string;
  winsMaiores2x?: number;
  horarioUltimoMaior2x?: Date | string;
  purples?: number;
  horarioUltimoRoxo?: Date | string;
  cp?: number; // greens com proteção (WinGo)
};

export type CurrentSignal = {
  strategyName?: string; // [NOME_ESTRATEGIA]
  // DOUBLE
  coresApostaEmoji?: string[];   // ["🟥","🟩"]
  coresApostaTexto?: string[];   // ["VERMELHO","VERDE"]
  resultadoCorEmoji?: string | string[];
  resultadoCorTexto?: string | string[];
  numReferenciaTexto?: string;       // "5"
  numReferenciaEmoji?: string;       // "5️⃣"
  numReferenciaGiro?: string;        // "Giro 123"
  // CRASH
  velaApostaTexto?: string;      // "1.80x"
  resultadoVelaTexto?: string;   // "1.97x"
  velaReferenciaTexto?: string;  // "1.21x"
  // WINGO
  protecaoEmoji?: string;
  protecaoEmojiBola?: string;
  protecaoTexto?: string;        // "VERDE" / "GRANDE"
  resultadoTamanhoTexto?: string;// "PEQUENO" | "GRANDE"
  resultadoNumero?: number;      // 0..9
  isWinDuplo?: boolean;
  isWinProtecao?: boolean;
  // contexto comum
  galeDaEntrada?: number;        // 0 = de primeira; >0 = COM X GALES
  horarioAtual?: Date;
};

export type MessageContext = {
  game: GameKind;
  stats: DailyStats;
  current?: CurrentSignal;
  now?: Date;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDateBR = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTimeBR = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function percentAssertividade(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) return "0%";
  return `${Math.round((wins / total) * 100)}%`;
}

/** [TAG] -> valor simples */
function replaceSimple(template: string, dict: Record<string, string | number | undefined>) {
  return template.replace(/\[([A-Z0-9_]+)\]/g, (m, key) => {
    const v = dict[key];
    return (v ?? m).toString();
  });
}

/** [G1]..[G20] */
function replaceGLevels(template: string, gWinsByLevel?: Record<number, number>) {
  if (!gWinsByLevel) return template;
  return template.replace(/\[G([1-9]|1[0-9]|20)\]/g, (_m, gstr) => {
    const g = Number(gstr);
    const v = gWinsByLevel[g] ?? 0;
    return String(v);
  });
}

/** [N]bold[/N] -> **bold** (texto simples; sem parse_mode) */
function replaceBold(template: string) {
  return template.replace(/\[N\]([\s\S]*?)\[\/N\]/g, (_m, inner) => `**${inner}**`);
}

/** [url=...]Texto[/url] -> Texto (url)  */
function replaceUrl(template: string) {
  return template.replace(/\[url=(.+?)\](.+?)\[\/url\]/g, (_m, href, text) => `${text} (${href})`);
}

/** [TIPO_GREEN_*] */
function replaceTipoGreen(template: string, galeAtual?: number) {
  const txtMin = galeAtual && galeAtual > 0 ? `com ${galeAtual} gales` : "de primeira";
  const txtMai = galeAtual && galeAtual > 0 ? `COM ${galeAtual} GALES` : "DE PRIMEIRA";
  return template
    .replace(/\[TIPO_GREEN_MINUSCULO\]/g, txtMin)
    .replace(/\[TIPO_GREEN_MAIUSCULO\]/g, txtMai);
}

/** Variáveis por jogo */
function replaceByGame(template: string, ctx: MessageContext) {
  const cur = ctx.current ?? {};
  switch (ctx.game) {
    case "double": {
      const listToText = (v?: string | string[]) => (Array.isArray(v) ? v.join(", ") : v ?? "");
      return replaceSimple(template, {
        CORES_APOSTA_EMOJI: (cur.coresApostaEmoji ?? []).join(" "),
        CORES_APOSTA_EMOJI_BOLA: (cur.coresApostaEmoji ?? []).join(" "),
        CORES_APOSTA_TEXTO: (cur.coresApostaTexto ?? []).join(" / "),
        RESULTADO_COR_EMOJI: listToText(cur.resultadoCorEmoji),
        RESULTADO_COR_EMOJI_BOLA: listToText(cur.resultadoCorEmoji),
        RESULTADO_COR_TEXTO: listToText(cur.resultadoCorTexto),
        WHITES: ctx.stats.whites ?? 0,
        HORARIO_ULTIMO_BRANCO: ctx.stats.horarioUltimoBranco ? fmtTimeBR(new Date(ctx.stats.horarioUltimoBranco)) : "",
        NUM_REFERENCIA_TEXTO: cur.numReferenciaTexto ?? "",
        NUM_REFERENCIA_EMOJI: cur.numReferenciaEmoji ?? "",
        NUM_REFERENCIA_GIRO: cur.numReferenciaGiro ?? "",
      });
    }
    case "crash": {
      return replaceSimple(template, {
        VELA_APOSTA_TEXTO: cur.velaApostaTexto ?? "",
        RESULTADO_VELA_TEXTO: cur.resultadoVelaTexto ?? "",
        WINS_MAIORES_2X: ctx.stats.winsMaiores2x ?? 0,
        HORARIO_ULTIMO_MAIOR_2X: ctx.stats.horarioUltimoMaior2x ? fmtTimeBR(new Date(ctx.stats.horarioUltimoMaior2x)) : "",
        VELA_REFERENCIA_TEXTO: cur.velaReferenciaTexto ?? "",
      });
    }
    case "wingo": {
      const protLineEmoji = cur.protecaoEmoji ? `\nProteção: ${cur.protecaoEmoji}` : "";
      const protLineTexto = cur.protecaoTexto ? `\nProteção: ${cur.protecaoTexto}` : "";
      return replaceSimple(template, {
        CORES_APOSTA_PROTECAO_EMOJI: cur.protecaoEmoji ?? "",
        CORES_APOSTA_PROTECAO_EMOJI_BOLA: cur.protecaoEmojiBola ?? cur.protecaoEmoji ?? "",
        CORES_APOSTA_PROTECAO_TEXTO: cur.protecaoTexto ?? "",
        CORES_APOSTA_PROTECAO_EMOJI_BOLA_NOVA_LINHA: protLineEmoji,
        CORES_APOSTA_PROTECAO_TEXTO_NOVA_LINHA: protLineTexto,
        RESULTADO_TAMANHO_TEXTO: cur.resultadoTamanhoTexto ?? "",
        RESULTADO_NUMERO: cur.resultadoNumero ?? "",
        PURPLES: ctx.stats.purples ?? 0,
        HORARIO_ULTIMO_ROXO: ctx.stats.horarioUltimoRoxo ? fmtTimeBR(new Date(ctx.stats.horarioUltimoRoxo)) : "",
        WIN_DUPLO_MINUSCULO: cur.isWinDuplo ? " duplo" : "",
        WIN_DUPLO_MAIUSCULO: cur.isWinDuplo ? " DUPLO" : "",
        WIN_PROTECAO_MINUSCULO: cur.isWinProtecao ? " na proteção" : "",
        WIN_PROTECAO_MAIUSCULO: cur.isWinProtecao ? " NA PROTEÇÃO" : "",
        CP: ctx.stats.cp ?? 0,
      });
    }
    case "branco":
    case "aviator":
    default:
      return template;
  }
}

/** Função principal: aplica todas as variáveis e transformações */
export function renderTemplate(template: string, ctx: MessageContext): string {
  const now = ctx.now ?? ctx.current?.horarioAtual ?? new Date();

  let out = replaceSimple(template, {
    DATA_HOJE: fmtDateBR(now),
    HORA_AGORA: fmtTimeBR(now),
    WINS: ctx.stats.wins ?? 0,
    LOSSES: ctx.stats.losses ?? 0,
    PERCENTUAL_ASSERTIVIDADE: percentAssertividade(ctx.stats.wins ?? 0, ctx.stats.losses ?? 0),
    GALE_ATUAL: ctx.stats.galeAtual ?? 0,
    MAX_GALES: ctx.stats.maxGales ?? 0,
    GANHOS_CONSECUTIVOS: ctx.stats.ganhosConsecutivos ?? 0,
    GANHOS_CONSECUTIVOS_GALE: ctx.stats.ganhosConsecutivosGale ?? 0,
    GANHOS_CONSECUTIVOS_SEMGALE: ctx.stats.ganhosConsecutivosSemGale ?? 0,
    SG: ctx.stats.sg ?? 0,
    NOME_ESTRATEGIA: ctx.current?.strategyName ?? "",
  });

  // ordem importa: primeiro globais, depois níveis G, green-type, formatações e variáveis por jogo
  out = replaceGLevels(out, ctx.stats.gWinsByLevel);
  out = replaceTipoGreen(out, ctx.current?.galeDaEntrada ?? ctx.stats.galeAtual);
  out = replaceBold(out);
  out = replaceUrl(out);
  out = replaceByGame(out, ctx);

  return out;
}
