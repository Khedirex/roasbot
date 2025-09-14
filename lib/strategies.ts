// lib/strategies.ts
// Store de estratégias em memória (processo Node).
// Pronto para “futuro DB/KV”, sem quebrar o front.
// Melhorias desta versão:
// - Normalização robusta de horários e pattern (aceita "rgr", "r,g,r", ["R","G","R",...]).
// - Tipos estáveis p/ front (Color inclui "Y" sem interferir no matcher).
// - Sanitização defensiva (mgCount, winAt, ids).
// - Funções utilitárias extras (nowHHMM, getActiveStrategiesByHHMM, normalizeStrategies, multToToken).
// - Métodos continuam síncronos (não quebram chamadas existentes). Pode-se “await” sem problemas.

export type Game = "aviator" | "bacbo";
export type CasaSlug = "1win" | "lebull";
export type BotId = `${Game}-${CasaSlug}`;

/** Paleta de cores aceita nas estratégias de padrão.
 *  Observação: o matcher principal usa "R","G","B";
 *  "Y" é tolerado aqui para UX/experimentos, mas trate no matcher conforme a regra do seu runtime.
 */
export type Color = "R" | "G" | "Y" | "B";

export type Strategy = {
  id: string;
  name: string;
  startHour: string; // "HH:mm"
  endHour: string;   // "HH:mm"
  mgCount: number;   // tentativas de martingale
  enabled: boolean;
  winAt: number;     // em qual gale considera "green" (0 = sem gale, 1 = 1º gale, ...)
  pattern: Color[];  // sequência ("R","G","Y","B")
};

/* ================= Store em memória ================= */
const store = new Map<BotId, Strategy[]>();

/* ================= Helpers básicos ================= */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function clampInt(n: any, min: number, max: number): number {
  n = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, n));
}
function cryptoRandomId(): string {
  const bytes = new Uint8Array(8);
  const c = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function nowHHMM(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizeHHmm(v?: string): string | null {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = clampInt(parseInt(m[1], 10), 0, 23);
  const mm = clampInt(parseInt(m[2], 10), 0, 59);
  return `${pad2(hh)}:${pad2(mm)}`;
}

/** Converte string/array em lista de cores válida (ex.: "r,g,r" | "rgr" | ["R","G","R"]). */
export function normalizeHistory(input: unknown): Color[] {
  const toToken = (x: unknown) => String(x).trim().toUpperCase();
  const isColor = (x: string): x is Color => x === "R" || x === "G" || x === "Y" || x === "B";

  if (Array.isArray(input)) {
    return input.map(toToken).filter(isColor);
  }
  if (typeof input === "string") {
    const s = input.trim();
    const parts = /[,\s]+/.test(s) ? s.split(/[,\s]+/) : s.split("");
    return parts.map(toToken).filter(isColor);
  }
  return [];
}

/** Checa se `now` está dentro da janela diária (tratando faixa que cruza meia-noite). */
export function isWithinWindow(now: Date, startHHmm: string, endHHmm: string): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startHHmm.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = endHHmm.split(":").map((x) => parseInt(x, 10));
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return true;                     // janela 24h
  if (start < end) return cur >= start && cur <= end; // mesma data
  return cur >= start || cur <= end;                  // cruza meia-noite
}

/** Opcional: valida campos essenciais de uma Strategy. */
export function isValidStrategy(s: Partial<Strategy>): s is Strategy {
  return !!(
    s &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    Array.isArray(s.pattern) &&
    s.pattern.length > 0 &&
    Number.isInteger(s.mgCount ?? 0) &&
    (s.mgCount ?? 0) >= 0 &&
    Number.isInteger(s.winAt ?? 0) &&
    (s.winAt ?? 0) >= 0 &&
    typeof s.startHour === "string" &&
    typeof s.endHour === "string"
  );
}

/* ================= Sanitização ================= */
function sanitizeOne(s: Strategy): Strategy {
  const start = normalizeHHmm(s.startHour) ?? "00:00";
  const end = normalizeHHmm(s.endHour) ?? "23:59";
  return {
    ...s,
    id: String(s.id || cryptoRandomId()),
    name: String(s.name || "Estratégia"),
    startHour: start,
    endHour: end,
    mgCount: clampInt(s.mgCount, 0, 10),
    enabled: !!s.enabled,
    // permite 0 = vitória sem gale
    winAt: clampInt(s.winAt ?? 0, 0, 100),
    // garante somente cores válidas
    pattern: normalizeHistory(s.pattern),
  };
}
function sanitize(list: Strategy[]): Strategy[] {
  return (Array.isArray(list) ? list : []).map(sanitizeOne);
}

/* ================= API (memória) ================= */
export function listStrategies(botId: BotId): Strategy[] {
  return store.get(botId) ?? [];
}

export function setStrategies(botId: BotId, strategies: Strategy[]): void {
  store.set(botId, sanitize(strategies));
}

export function upsertStrategy(botId: BotId, strategy: Strategy): Strategy {
  const list = listStrategies(botId);
  const s = sanitizeOne(strategy);
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s;
  else list.push(s);
  store.set(botId, list);
  return s;
}

export function removeStrategy(botId: BotId, strategyId: string): boolean {
  const list = listStrategies(botId);
  const next = list.filter((s) => s.id !== strategyId);
  store.set(botId, next);
  return next.length !== list.length;
}

/** Estratégias ativas no horário atual do servidor. */
export function getActiveStrategies(botId: BotId, now: Date = new Date()): Strategy[] {
  const list = listStrategies(botId);
  return list.filter((s) => s.enabled && isWithinWindow(now, s.startHour, s.endHour));
}

/** Estratégias ativas em um horário específico ("HH:mm"). */
export function getActiveStrategiesByHHMM(botId: BotId, hhmm: string): Strategy[] {
  const list = listStrategies(botId);
  const t = normalizeHHmm(hhmm) ?? nowHHMM();
  const fakeNow = new Date();
  const [H, M] = t.split(":").map((x) => parseInt(x, 10));
  fakeNow.setHours(H, M, 0, 0);
  return list.filter((s) => s.enabled && isWithinWindow(fakeNow, s.startHour, s.endHour));
}

/** Normaliza lista garantindo pattern uppercase e faixas válidas. */
export function normalizeStrategies(list: Strategy[]): Strategy[] {
  return sanitize(list);
}

/** Utilitário opcional: converte multiplicador em token do matcher.
 *  Por padrão: B (white) se mult === whiteAt; G se mult >= greenAt; R caso contrário.
 */
export function multToToken(
  mult: number,
  greenAt = Number(process.env.AVIATOR_GREEN_AT ?? "2"),
  whiteAt = Number(process.env.AVIATOR_WHITE_AT ?? "1"),
): "R" | "G" | "B" {
  if (Number.isFinite(mult) && mult === whiteAt) return "B";
  if (Number.isFinite(mult) && mult >= greenAt) return "G";
  return "R";
}

/* ================= Debug helpers (opcional) ================= */
/** Snapshot leve do store para inspeção local/diagnóstico. */
export function _debugSnapshot() {
  const out: Record<string, Strategy[]> = {};
  for (const [k, v] of store.entries()) out[k] = v;
  return out;
}
