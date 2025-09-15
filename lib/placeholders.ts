// lib/placeholders.ts

/** Formata dd/mm/aaaa e HH:MM:SS no fuso local do servidor */
function fmtData(date = new Date()) {
  const d = date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function fmtHora(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", { hour12: false });
}

/** Transforma [url=https://site]{TEXTO}[/url] em <a href="...">TEXTO</a> (útil com parse_mode=HTML) */
export function toHtmlLinks(text: string) {
  return text.replace(
    /\[url=(https?:\/\/[^\]\s]+)\](.*?)\[\/url\]/gi,
    (_m, href, label) => `<a href="${href}">${label || href}</a>`,
  );
}

/** Constrói o contexto de template com seus placeholders da UI */
export function makeTplCtx(params: {
  casa: string;             // "1win" | "lebull" ...
  value?: number | null;    // crash/mult atual
  ts?: number;              // epoch ms
  strategy?: {
    id?: string;
    name?: string;
    matchedPattern?: string[];
    window?: string[];
    mgCount?: number;
    winAt?: number;
  } | null;
  stats?: Partial<{
    wins: number;
    losses: number;
    sg: number;
    galeAtual: number;
    maxGales: number;
    ganhosConsecutivos: number;
    ganhosConsecutivosGale: number;
    gWinsByLevel: Record<number, number>; // {1: x, 2: y}
  }>;
  extras?: Record<string, any>; // qualquer outra coisa que queira injetar
}) {
  const now = new Date(params.ts ?? Date.now());
  const casa = (params.casa || "").toUpperCase();
  const value = params.value ?? null;

  const s = params.strategy || {};
  const stats = params.stats || {};

  // Derivados úteis
  const tipoGreenMinusculo =
    s && typeof s.mgCount === "number" && s.mgCount > 0
      ? `com ${s.mgCount} gales`
      : "de primeira";
  const tipoGreenMaiusculo =
    s && typeof s.mgCount === "number" && s.mgCount > 0
      ? `COM ${s.mgCount} GALES`
      : "DE PRIMEIRA";

  // Placeholders globais
  const base: Record<string, any> = {
    DATA_HOJE: fmtData(now),
    HORA_AGORA: fmtHora(now),
    WINS: stats.wins ?? 0,
    LOSSES: stats.losses ?? 0,
    PERCENTUAL_ASSERTIVIDADE:
      (() => {
        const w = Number(stats.wins ?? 0);
        const l = Number(stats.losses ?? 0);
        const t = w + l;
        return t > 0 ? Math.round((w / t) * 100) : 0;
      })(),
    MAX_GALES: stats.maxGales ?? 0,
    GANHOS_CONSECUTIVOS: stats.ganhosConsecutivos ?? 0,
    GANHOS_CONSECUTIVOS_GALE: stats.ganhosConsecutivosGale ?? 0,
    SG: stats.sg ?? 0,
    GALE_ATUAL: stats.galeAtual ?? 0,
    // “G1..G20” se quiser referenciar vitórias por nível de gale
    ...(() => {
      const out: Record<string, number> = {};
      const by = stats.gWinsByLevel || {};
      for (let i = 1; i <= 20; i++) out[`G${i}`] = Number(by[i] ?? 0);
      return out;
    })(),
    // Texto livre
    INSE_TEXTO_AQUI: "",

    // Estratégia
    TIPO_GREEN_MINUSCULO: tipoGreenMinusculo,  // “de primeira” | “com X gales”
    TIPO_GREEN_MAIUSCULO: tipoGreenMaiusculo,  // “DE PRIMEIRA” | “COM X GALES”
    NOME_ESTRATEGIA: s.name ?? "",

    // Crash (robô “Crash”)
    VELA_APOSTA_TEXTO: value != null ? `${value.toFixed(2)}x` : "",
    WINS_MAIORES_2X: (stats as any)?.winsMaior2x ?? 0, // se você mantiver isso no estado
    VELA_REFERENCIA_TEXTO: (params.extras as any)?.velaRef ?? "",

    // Campos gerais que também ajudam
    CASA: casa,
    VALUE: value != null ? value.toFixed(2) : "",
    TS_ISO: now.toLocaleString("pt-BR", { hour12: false }),

    // Estratégia — padrão / janela / mg / winAt
    PATTERN: (s.matchedPattern || []).join("-"),
    WINDOW: (s.window || []).join("-"),
    MG: s.mgCount ?? 0,
    WIN_AT: s.winAt ?? 0,
  };

  // Mescla extras
  return { ...base, ...(params.extras || {}) };
}
