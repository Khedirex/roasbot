// lib/messageTemplate.ts

// ===== Tipos base =====
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

// Contexto genérico, mas com campos conhecidos opcionais
export type MessageContext =
  & Record<string, any>
  & {
      game?: GameKind;
      stats?: Partial<DailyStats>;
      current?: Partial<CurrentSignal>;
      now?: Date | string | number;
    };

// ===== Utils =====
const pad2 = (n: number) => String(n).padStart(2, "0");

const toDate = (v?: Date | string | number) => {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") return new Date(v);
  return new Date();
};

const fmtDateBR = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const fmtTimeBR = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function percentAssertividade(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) return "0%";
  return `${Math.round((wins / total) * 100)}%`;
}

/** Converte [url=https://site]{Texto}[/url] em <a href="...">Texto</a> (para parse_mode=HTML) */
export function toHtmlLinks(text: string) {
  return text.replace(
    /\[url=(https?:\/\/[^\]\s]+)\](.*?)\[\/url\]/gi,
    (_m, href, label) => `<a href="${href}">${label || href}</a>`,
  );
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

/** [url=...]Texto[/url] -> Texto (url)  — fallback (quando não usar HTML) */
function replaceUrlFallback(template: string) {
  return template.replace(/\[url=(.+?)\](.+?)\[\/url\]/g, (_m, href, text) => `${text} (${href})`);
}

/** [TIPO_GREEN_*] — usa galeDaEntrada (se vier) senão GALE_ATUAL */
function replaceTipoGreen(template: string, gale?: number) {
  const txtMin = gale && gale > 0 ? `com ${gale} gales` : "de primeira";
  const txtMai = gale && gale > 0 ? `COM ${gale} GALES` : "DE PRIMEIRA";
  return template
    .replace(/\[TIPO_GREEN_MINUSCULO\]/g, txtMin)
    .replace(/\[TIPO_GREEN_MAIUSCULO\]/g, txtMai);
}

/** Variáveis específicas por jogo */
function replaceByGame(template: string, ctx: MessageContext) {
  const s = ctx.stats ?? {};
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
        WHITES: s.whites ?? 0,
        HORARIO_ULTIMO_BRANCO: s.horarioUltimoBranco ? fmtTimeBR(toDate(s.horarioUltimoBranco)) : "",
        NUM_REFERENCIA_TEXTO: cur.numReferenciaTexto ?? "",
        NUM_REFERENCIA_EMOJI: cur.numReferenciaEmoji ?? "",
        NUM_REFERENCIA_GIRO: cur.numReferenciaGiro ?? "",
      });
    }
    case "crash": {
      return replaceSimple(template, {
        VELA_APOSTA_TEXTO: cur.velaApostaTexto ?? "",
        RESULTADO_VELA_TEXTO: cur.resultadoVelaTexto ?? "",
        WINS_MAIORES_2X: s.winsMaiores2x ?? 0,
        HORARIO_ULTIMO_MAIOR_2X: s.horarioUltimoMaior2x ? fmtTimeBR(toDate(s.horarioUltimoMaior2x)) : "",
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
        PURPLES: s.purples ?? 0,
        HORARIO_ULTIMO_ROXO: s.horarioUltimoRoxo ? fmtTimeBR(toDate(s.horarioUltimoRoxo)) : "",
        WIN_DUPLO_MINUSCULO: cur.isWinDuplo ? " duplo" : "",
        WIN_DUPLO_MAIUSCULO: cur.isWinDuplo ? " DUPLO" : "",
        WIN_PROTECAO_MINUSCULO: cur.isWinProtecao ? " na proteção" : "",
        WIN_PROTECAO_MAIUSCULO: cur.isWinProtecao ? " NA PROTEÇÃO" : "",
        CP: s.cp ?? 0,
      });
    }
    case "branco":
    case "aviator":
    default:
      return template;
  }
}

// ===== Função principal =====
/**
 * Renderiza `template` substituindo:
 * - Globais: [DATA_HOJE], [HORA_AGORA], [WINS], [LOSSES], [PERCENTUAL_ASSERTIVIDADE], [GALE_ATUAL], [MAX_GALES], [GANHOS_CONSECUTIVOS], [GANHOS_CONSECUTIVOS_GALE], [GANHOS_CONSECUTIVOS_SEMGALE], [SG], [NOME_ESTRATEGIA]
 * - Níveis: [G1]..[G20]
 * - Tipo green: [TIPO_GREEN_MINUSCULO] / [TIPO_GREEN_MAIUSCULO]
 * - Formatações: [N]bold[/N], [url=...]Texto[/url] (fallback plain-text)
 * - Por jogo (Double/Crash/Wingo)
 * Obs.: se for usar links HTML no Telegram, após renderizar use `toHtmlLinks()` e `parse_mode="HTML"`.
 */
export function renderTemplate(template: string, ctxRaw: MessageContext): string {
  const ctx: MessageContext = {
    game: ctxRaw.game,
    stats: ctxRaw.stats ?? {},
    current: ctxRaw.current ?? {},
    now: ctxRaw.now,
    ...ctxRaw, // permite extras personalizados
  };

  const now = toDate(ctx.now ?? ctx.current?.horarioAtual);

  let out = replaceSimple(template, {
    DATA_HOJE: fmtDateBR(now),
    HORA_AGORA: fmtTimeBR(now),
    WINS: Number(ctx.stats?.wins ?? 0),
    LOSSES: Number(ctx.stats?.losses ?? 0),
    PERCENTUAL_ASSERTIVIDADE: percentAssertividade(
      Number(ctx.stats?.wins ?? 0),
      Number(ctx.stats?.losses ?? 0),
    ),
    GALE_ATUAL: Number(ctx.stats?.galeAtual ?? 0),
    MAX_GALES: Number(ctx.stats?.maxGales ?? 0),
    GANHOS_CONSECUTIVOS: Number(ctx.stats?.ganhosConsecutivos ?? 0),
    GANHOS_CONSECUTIVOS_GALE: Number(ctx.stats?.ganhosConsecutivosGale ?? 0),
    GANHOS_CONSECUTIVOS_SEMGALE: Number(ctx.stats?.ganhosConsecutivosSemGale ?? 0),
    SG: Number(ctx.stats?.sg ?? 0),
    NOME_ESTRATEGIA: String(ctx.current?.strategyName ?? ""),
  });

  // ordem importa
  out = replaceGLevels(out, ctx.stats?.gWinsByLevel);
  out = replaceTipoGreen(out, ctx.current?.galeDaEntrada ?? ctx.stats?.galeAtual);
  out = replaceBold(out);
  out = replaceUrlFallback(out); // se estiver usando HTML, prefira `toHtmlLinks()` depois
  out = replaceByGame(out, ctx);

  return out;
}
