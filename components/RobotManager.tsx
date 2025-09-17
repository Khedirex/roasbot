// components/RobotManager.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  StrategiesPanel,
  type Strategy as PanelStrategy,
  type Color,
} from "@/app/(app)/bots/aviator/StrategiesPanel";
import type { StrategyMessages } from "@/app/(app)/bots/aviator/StrategyMessagesForm";
import { PatternBuilder } from "@/components/PatternBuilder";

/** ===== Tipos ===== */
type Metrics = { jogadas: number; greens: number; reds: number };

type Strategy = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  mgCount: number;
  enabled: boolean;
  pattern: string[];
  winAt: number;
  messages?: StrategyMessages;
};

type Robot = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  martingale: number;
  botToken: string;
  chatId: string;
  strategies: Strategy[];
  metrics: Metrics;
  enabled?: boolean;
};

// --- Rascunho / Draft de nova estratégia ---
type DraftStrategy = {
  robotId: string;
  name: string;
  startHour: string;
  endHour: string;
  winAt: number;
  mgCount: number;
  pattern: string[];
  messages: Record<string, string>;
  enabled: boolean;
};

function makeEmptyDraft(robotId: string): DraftStrategy {
  return {
    robotId,
    name: "",
    startHour: "00:00",
    endHour: "23:59",
    winAt: 3,
    mgCount: 0,
    pattern: [],
    messages: {},
    enabled: true,
  };
}

type Game = "aviator" | "bacbo";
type CasaSlug = "1win" | "lebull";

/** Aceita botId (preferível) ou bot+casa */
type Props = { botId?: string; bot?: Game; casa: CasaSlug };

/* ===== Registro global ===== */
type BotMeta = { id: string; game: Game; casa: CasaSlug; label: string };
const BOTS_KEY = "roasbot.bots";
function labelOf(game: Game, casa: CasaSlug) {
  return `${game === "aviator" ? "Aviator" : "Bac Bo"} @ ${casa === "1win" ? "1Win" : "LeBull"}`;
}
function upsertBotInRegistry(game: Game, casa: CasaSlug) {
  const id = `${game}-${casa}`;
  const label = labelOf(game, casa);
  try {
    const raw = localStorage.getItem(BOTS_KEY);
    const arr: BotMeta[] = raw ? JSON.parse(raw) : [];
    const i = arr.findIndex((b) => b.id === id);
    if (i >= 0) arr[i] = { id, game, casa, label };
    else arr.push({ id, game, casa, label });
    localStorage.setItem(BOTS_KEY, JSON.stringify(arr));
  } catch {}
}
function removeBotFromRegistry(botId: string) {
  try {
    const raw = localStorage.getItem(BOTS_KEY);
    const arr: BotMeta[] = raw ? JSON.parse(raw) : [];
    const next = arr.filter((b) => b.id !== botId);
    localStorage.setItem(BOTS_KEY, JSON.stringify(next));
  } catch {}
}

/* ===== Storage ===== */
const LIST_PREFIX = "roasbot:robots";

/** ===== Helpers p/ renderização & envio ===== */
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

// normaliza qualquer formato de pattern (array/string/objeto) -> string[]
function normalizePattern(p: any): string[] {
  if (Array.isArray(p)) return p;
  if (p == null) return [];
  if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return [parsed];
    } catch {
      return [p];
    }
  }
  if (typeof p === "object") {
    if (Array.isArray((p as any)["pattern-list"])) return (p as any)["pattern-list"];
    if (Array.isArray((p as any).colors)) return (p as any).colors;
    return Object.values(p).flat().filter((x) => typeof x === "string") as string[];
  }
  return [];
}

// envia via seu endpoint (sem CORS)
async function sendViaApi(botToken: string, chatId: string, text: string) {
  const resp = await fetch("/api/send/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botToken, chatId, text, disable_web_page_preview: true }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.ok === false) {
    const reason = data?.response?.description || data?.message || `HTTP ${resp.status}`;
    throw new Error(`Falha ao enviar: ${reason}`);
  }
}

async function createStrategyAPI(input: {
  robotId: string;
  name: string;
  startHour?: string;
  endHour?: string;
  winAt?: number;
  mgCount?: number;
  pattern?: any[];
  messages?: Record<string, string>;
  active?: boolean;
}) {
  const res = await fetch("/api/strategies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j?.error || "Falha ao criar estratégia");
  return j.data;
}

async function patchStrategyAPI(id: string, patch: any) {
  const res = await fetch(`/api/strategies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j?.error || "Falha ao atualizar estratégia");
  return j.data;
}

async function patchRobotAPI(id: string, patch: any) {
  const res = await fetch(`/api/robots/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j?.error || "Falha ao atualizar robot");
  return j.data;
}

/** ===== Legenda descritiva das cores ===== */
type LegendItem = { key: string; title: string; desc: string; dotClass: string };
const COLOR_MEANINGS: LegendItem[] = [
  { key: "gray", title: "COR CINZA", desc: "Poderá ser qualquer resultado", dotClass: "bg-gray-400" },
  { key: "green", title: "COR VERDE", desc: "Caso seja uma vela igual ou maior a 2x", dotClass: "bg-green-500" },
  { key: "black", title: "COR PRETA", desc: "Caso caia uma vela menor que 2x", dotClass: "bg-black" },
  { key: "white", title: "COR BRANCA", desc: "Vela em crash instantâneo (1.00x)", dotClass: "bg-white border" },
  { key: "blue", title: "COR AZUL", desc: "Vela maior ou igual ao valor customizado", dotClass: "bg-blue-500" },
  { key: "pink", title: "COR ROSA", desc: "Vela menor ou igual ao valor customizado", dotClass: "bg-pink-500" },
];
function LegendRow({ item }: { item: LegendItem }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-white p-3">
      <span className={`mt-1 inline-block h-3.5 w-3.5 rounded-full ${item.dotClass}`} />
      <div className="text-sm leading-5">
        <div className="font-semibold">{item.title}</div>
        <div className="text-gray-600">{item.desc}</div>
      </div>
    </div>
  );
}

/** ===== Variáveis de template (chips copiáveis com descrição) ===== */
type VarItem = { code: string; desc: string };
type VarGroup = { title: string; items: VarItem[] };

const VAR_GROUPS: VarGroup[] = [
  {
    title: "Variáveis globais",
    items: [
      { code: "[DATA_HOJE]", desc: "Data atual no formato 00/00/0000" },
      { code: "[HORA_AGORA]", desc: "Horário atual no formato 00:00:00" },
      { code: "[WINS]", desc: "Quantidade de apostas WIN no dia" },
      { code: "[LOSSES]", desc: "Quantidade de apostas RED no dia" },
      { code: "[PERCENTUAL_ASSERTIVIDADE]", desc: "Assertividade do bot no dia de hoje" },
      { code: "[GALE_ATUAL]", desc: "Quantidade atual de gales" },
      { code: "[MAX_GALES]", desc: "Quantidade máxima de gales" },
      { code: "[GANHOS_CONSECUTIVOS]", desc: "WINs seguidas (reseta após LOSS)" },
      { code: "[GANHOS_CONSECUTIVOS_GALE]", desc: "WINs seguidas COM gale (reseta após LOSS)" },
      { code: "[GANHOS_CONSECUTIVOS_SEMGALE]", desc: "WINs seguidas SEM gale (reseta após LOSS)" },
      { code: "[SG]", desc: "Quantidade de WINs sem gale no dia" },
      { code: "[G1]", desc: "WINS por martingale. Troque o número: [G1]…[G20]" },
      { code: "[N]SEU TEXTO AQUI[/N]", desc: "Deixa um trecho em negrito" },
      { code: "[url=https://google.com]ENTRAR NO GOOGLE[/url]", desc: "Adiciona link clicável no texto" },
      { code: "[TIPO_GREEN_MINUSCULO]", desc: 'Mostra "de primeira" ou "com X gales" (minúsculo)' },
      { code: "[TIPO_GREEN_MAIUSCULO]", desc: 'Mostra "DE PRIMEIRA" ou "COM X GALES" (maiúsculo)' },
      { code: "[NOME_ESTRATEGIA]", desc: "Nome da estratégia usada na entrada" },
    ],
  },
  {
    title: "Variáveis do robô — Double",
    items: [
      { code: "[CORES_APOSTA_EMOJI]", desc: "Cor(es) p/ apostar (emoji quadrado)" },
      { code: "[CORES_APOSTA_EMOJI_BOLA]", desc: "Cor(es) p/ apostar (emoji redondo)" },
      { code: "[CORES_APOSTA_TEXTO]", desc: "Cor(es) p/ apostar (texto)" },
      { code: "[RESULTADO_COR_EMOJI]", desc: "Cor(es) do resultado (emoji quadrado)" },
      { code: "[RESULTADO_COR_EMOJI_BOLA]", desc: "Cor(es) do resultado (emoji redondo)" },
      { code: "[RESULTADO_COR_TEXTO]", desc: "Cor(es) do resultado (texto)" },
      { code: "[WHITES]", desc: "Quantidade de wins no Branco (dia)" },
      { code: "[HORARIO_ULTIMO_BRANCO]", desc: "Horário do último win no Branco" },
      { code: "[NUM_REFERENCIA_TEXTO]", desc: "Casa de referência (texto)" },
      { code: "[NUM_REFERENCIA_EMOJI]", desc: "Casa de referência (emoji)" },
      { code: "[NUM_REFERENCIA_EMOJI_BOLA]", desc: "Casa de referência (emoji redondo)" },
      { code: "[NUM_REFERENCIA_GIRO]", desc: "Giro de referência (texto)" },
    ],
  },
  {
    title: "Variáveis do robô — Crash",
    items: [
      { code: "[VELA_APOSTA_TEXTO]", desc: "Vela (cashout) p/ o usuário, em texto" },
      { code: "[RESULTADO_VELA_TEXTO]", desc: "Vela do resultado da entrada (texto)" },
      { code: "[WINS_MAIORES_2X]", desc: "Quantidade de wins >= 2x no dia" },
      { code: "[HORARIO_ULTIMO_MAIOR_2X]", desc: "Horário do último win >= 2x" },
      { code: "[VELA_REFERENCIA_TEXTO]", desc: "Última vela registrada antes da entrada confirmada" },
    ],
  },
  {
    title: "Variáveis do robô — Robô do Branco",
    items: [
      { code: "[LISTA_HORARIOS_APOSTA_BRANCO]", desc: "Lista de horários configurados" },
      { code: "[HORARIO_1]", desc: "1º horário de aposta" },
      { code: "[HORARIO_2]", desc: "2º horário de aposta" },
      { code: "[HORARIO_3]", desc: "3º horário de aposta" },
      { code: "[HORARIO_4]", desc: "4º horário de aposta" },
    ],
  },
  {
    title: "Variáveis do robô — WinGo (PopBra)",
    items: [
      { code: "[CORES_APOSTA_PROTECAO_EMOJI]", desc: "Emoji da cor de proteção (quadrado). Se for tamanho, mostra texto" },
      { code: "[CORES_APOSTA_PROTECAO_EMOJI_BOLA]", desc: "Emoji da cor de proteção (redondo). Se for tamanho, mostra texto" },
      { code: "[CORES_APOSTA_PROTECAO_TEXTO]", desc: 'Texto "Proteção: VERDE/GRANDE"' },
      { code: "[CORES_APOSTA_PROTECAO_EMOJI_BOLA_NOVA_LINHA]", desc: 'Quebra de linha: "Proteção: X" (emoji redondo p/ cores; texto p/ tamanhos)' },
      { code: "[CORES_APOSTA_PROTECAO_TEXTO_NOVA_LINHA]", desc: 'Quebra de linha: "Proteção: VERDE/GRANDE"' },
      { code: "[RESULTADO_TAMANHO_TEXTO]", desc: "Tamanho do número que saiu (PEQUENO/GRANDE)" },
      { code: "[RESULTADO_NUMERO]", desc: "Número que saiu (0…9)" },
      { code: "[PURPLES]", desc: "Contagem de roxos que saíram" },
      { code: "[HORARIO_ULTIMO_ROXO]", desc: "Último horário que saiu roxo" },
      { code: "[WIN_DUPLO_MINUSCULO]", desc: 'Se green foi duplo — texto minúsculo (ex.: " Duplo")' },
      { code: "[WIN_DUPLO_MAIUSCULO]", desc: 'Se green foi duplo — texto MAIÚSCULO (ex.: " DUPLO")' },
      { code: "[WIN_PROTECAO_MINUSCULO]", desc: 'Se green foi na proteção — minúsculo (ex.: " na proteção")' },
      { code: "[WIN_PROTECAO_MAIUSCULO]", desc: 'Se green foi na proteção — MAIÚSCULO (ex.: " NA PROTEÇÃO")' },
      { code: "[CP]", desc: "Contagem de greens com proteção" },
    ],
  },
];

function VarChip({ item }: { item: VarItem }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard?.writeText(item.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-start gap-3 rounded-lg border bg-white p-3 text-left hover:bg-gray-50"
      title={`Clique para copiar ${item.code}`}
    >
      <code className="font-mono text-xs px-1 py-0.5 rounded bg-gray-100 border">{item.code}</code>
      <span className="text-sm text-gray-700">{item.desc}</span>
      <span className="ml-auto text-[11px] text-gray-400">{copied ? "copiado!" : "copiar"}</span>
    </button>
  );
}

/* ================= COMPONENTE ================= */
export default function RobotManager({ botId, bot, casa }: Props) {
  // Deriva botId
  const realBotId = useMemo(() => {
    if (botId) return botId;
    if (bot && casa) return `${bot}-${casa}`;
    return "";
  }, [botId, bot, casa]);

  if (!realBotId) {
    return (
      <div className="rounded-lg border p-4 text-sm text-red-600">
        Parâmetros inválidos: informe <code>botId</code> ou <code>bot</code>+<code>casa</code>.
      </div>
    );
  }

  const [gameFromId, casaFromId] = useMemo(
    () => realBotId.split("-") as [Game, CasaSlug],
    [realBotId]
  );

  // garante registro
  useEffect(() => {
    upsertBotInRegistry(gameFromId, casaFromId);
  }, [gameFromId, casaFromId]);

  const storageKey = useMemo(() => `${LIST_PREFIX}:${realBotId}:list`, [realBotId]);

  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ⚠️ Paleta correta (sem "red")
  const PALETTE = ["green", "gray", "black", "white", "blue", "pink"] as const;
  const isColor = (v: unknown): v is Color => (PALETTE as readonly string[]).includes(v as string);

  // Normaliza qualquer forma (nome, hex, rgb, tokens UI/RGB) -> Color
  function normalizeColor(x: unknown): Color {
    if (typeof x !== "string") return "gray";
    const s = x.trim();

    // nomes
    if (isColor(s)) return s as Color;

    // tokens UI
    const U = s.toUpperCase();
    if (U === "A") return "blue";
    if (U === "W") return "white";
    if (U === "G") return "green";
    if (U === "P") return "pink";
    if (U === "K") return "black";
    if (U === "X") return "gray";

    // runtime RGB
    if (U === "R") return "pink"; // baixa
    if (U === "B") return "white"; // branco
    if (U === "G") return "green"; // alta

    // hex
    const hex = s.startsWith("#") ? s.toLowerCase() : `#${s.toLowerCase()}`;
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      if (hex === "#22c55e") return "green";
      if (hex === "#9ca3af") return "gray";
      if (hex === "#111827") return "black";
      if (hex === "#ffffff") return "white";
      if (hex === "#3b82f6") return "blue";
      if (hex === "#ec4899") return "pink";
    }

    // rgb(...) ou "r, g, b"
    const m = s.match(/(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/);
    if (m) {
      const key = `${Math.min(255, +m[1])},${Math.min(255, +m[2])},${Math.min(255, +m[3])}`;
      if (key === "34,197,94") return "green";
      if (key === "156,163,175") return "gray";
      if (key === "17,24,39") return "black";
      if (key === "255,255,255") return "white";
      if (key === "59,130,246") return "blue";
      if (key === "236,72,153") return "pink";
    }

    return "gray";
  }

  const enabledKey = useMemo(
    () => (selectedId ? `roasbot:${realBotId}:${selectedId}:enabled` : ""),
    [realBotId, selectedId]
  );
  const [enabled, setEnabled] = useState(false);
  const [activeStrategies, setActiveStrategies] = useState<number>(0);
  const [showStrategyEditor, setShowStrategyEditor] = useState(false);

  /* ====== Ler lista ====== */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Robot[];
        setRobots(parsed);
        setSelectedId((prev) => (prev && parsed.some((r) => r.id === prev) ? prev : parsed[0]?.id ?? null));
      } else {
        setRobots([]);
        setSelectedId(null);
      }
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  /* ====== Persistir lista ====== */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(robots));
    } catch {}
  }, [hydrated, robots, storageKey]);

  /* ====== Flag ligado/desligado ====== */
  useEffect(() => {
    if (!enabledKey) return;
    try {
      const raw = localStorage.getItem(enabledKey);
      setEnabled(raw === "true");
    } catch {}
  }, [enabledKey]);
  useEffect(() => {
    if (!enabledKey) return;
    try {
      localStorage.setItem(enabledKey, String(enabled));
    } catch {}
  }, [enabled, enabledKey]);

  const selected = robots.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setActiveStrategies(0);
      return;
    }
    const count = (selected.strategies ?? []).filter((s) => s.enabled).length;
    setActiveStrategies(count);
  }, [selected?.id, selected?.strategies]);

  // --- Draft de estratégia (AGORA dentro do componente) ---
  const [newDraft, setNewDraft] = useState<DraftStrategy | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  async function saveDraft() {
    if (!newDraft) return;
    if (!newDraft.name.trim()) {
      alert("Dê um nome para a estratégia.");
      return;
    }
    setSavingDraft(true);
    try {
      const r = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || "Erro ao salvar");
      setNewDraft(null);
      location.reload();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSavingDraft(false);
    }
  }

  /** ===== CRUD ===== */
  function addRobot() {
    const newRobot: Robot = {
      id: crypto.randomUUID(),
      name: `Robot ${robots.length + 1}`,
      startHour: "09:00",
      endHour: "18:00",
      martingale: 2,
      botToken: "",
      chatId: "",
      strategies: [],
      metrics: { jogadas: 0, greens: 0, reds: 0 },
    };
    setRobots((prev) => [newRobot, ...prev]);
    setSelectedId(newRobot.id);
    upsertBotInRegistry(gameFromId, casaFromId);
  }
  function updateRobot(patch: Partial<Robot>) {
    if (!selected) return;
    setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
  }
  function removeRobot(id: string) {
    setRobots((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (next.length === 0) removeBotFromRegistry(realBotId);
      return next;
    });
    setSelectedId((prev) => (prev === id ? null : prev));
  }
  function duplicateRobot(id: string) {
    const base = robots.find((r) => r.id === id);
    if (!base) return;
    const copy: Robot = { ...base, id: crypto.randomUUID(), name: `${base.name} (cópia)` };
    setRobots((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
  }

  /** ===== Estratégias ===== */
  function setStrategies(next: PanelStrategy[]) {
    const converted: Strategy[] = next.map((s) => ({
      id: s.id,
      name: s.name,
      startHour: s.startHour,
      endHour: s.endHour,
      mgCount: s.mgCount,
      enabled: s.enabled,
      winAt: s.winAt,
      pattern: (s.pattern as Array<string | Color>).map<Color>((c) => normalizeColor(c)),
      messages: s.messages,
    }));
    updateRobot({ strategies: converted });
  }
  function duplicateStrategy(id: string) {
    if (!selected) return;
    const list = selected.strategies ?? [];
    const base = list.find((s) => s.id === id);
    if (!base) return;
    const copy: Strategy = { ...base, id: crypto.randomUUID(), name: `${base.name} (cópia)` };
    const next = [copy, ...list];
    updateRobot({ strategies: next });
    if (copy.enabled) setActiveStrategies(next.filter((s) => s.enabled).length);
  }
  function deleteStrategy(id: string) {
    if (!selected) return;
    const next = (selected.strategies ?? []).filter((s) => s.id !== id);
    updateRobot({ strategies: next });
    setActiveStrategies(next.filter((s) => s.enabled).length);
  }
  function toggleStrategy(id: string, value: boolean) {
    if (!selected) return;
    const next = (selected.strategies ?? []).map((s) => (s.id === id ? { ...s, enabled: value } : s));
    updateRobot({ strategies: next });
    setActiveStrategies(next.filter((s) => s.enabled).length);
  }

  /** ===== Ações de teste ===== */
  const [sending, setSending] = useState(false);
  const strategyForTest = useMemo(() => {
    const list = selected?.strategies ?? [];
    return list.find((s) => s.enabled) ?? list[0] ?? null;
  }, [selected?.strategies]);

  async function handlePreviewWin() {
    if (!strategyForTest) {
      alert("Crie uma estratégia primeiro.");
      return;
    }
    const template =
      strategyForTest.messages?.onWin ??
      "✅ WIN! Hoje: [DATA_HOJE] às [HORA_AGORA] • Assertividade: [PERCENTUAL_ASSERTIVIDADE]";

    const ctx = {
      game: gameFromId,
      now: new Date(),
      stats: {
        wins: selected?.metrics?.greens ?? 0,
        losses: selected?.metrics?.reds ?? 0,
        sg: 0,
        galeAtual: 0,
        maxGales: strategyForTest.mgCount ?? 0,
        ganhosConsecutivos: 0,
        ganhosConsecutivosGale: 0,
        ganhosConsecutivosSemGale: 0,
        gWinsByLevel: { 1: 0, 2: 0 },
      },
      current: { strategyName: strategyForTest.name, galeDaEntrada: 0 },
    };

    try {
      const text = await renderMessage(template, ctx);
      alert(text);
    } catch {
      alert("Falha ao renderizar.");
    }
  }

  async function handleSendWinTest() {
    if (!selected) {
      alert("Selecione um robô.");
      return;
    }
    if (!strategyForTest) {
      alert("Crie uma estratégia primeiro.");
      return;
    }
    if (!selected.botToken || !selected.chatId) {
      alert("Configure Bot Token e Chat ID do robô.");
      return;
    }

    const template =
      strategyForTest.messages?.onWin ??
      "✅ WIN! Hoje: [DATA_HOJE] às [HORA_AGORA] • Assertividade: [PERCENTUAL_ASSERTIVIDADE]";

    const ctx = {
      game: gameFromId,
      now: new Date(),
      stats: {
        wins: selected.metrics?.greens ?? 0,
        losses: selected.metrics?.reds ?? 0,
        sg: 0,
        galeAtual: 0,
        maxGales: strategyForTest.mgCount ?? 0,
        ganhosConsecutivos: 0,
        ganhosConsecutivosGale: 0,
        ganhosConsecutivosSemGale: 0,
        gWinsByLevel: { 1: 0, 2: 0 },
      },
      current: { strategyName: strategyForTest.name, galeDaEntrada: 0 },
    };

    try {
      setSending(true);
      const text = await renderMessage(template, ctx);
      await sendViaApi(selected.botToken, selected.chatId, text);
      alert("Mensagem enviada!");
    } catch (e: any) {
      alert(e?.message || "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  const gameLabel = gameFromId === "aviator" ? "Aviator" : "Bac Bo";
  const casaLabel = casaFromId === "1win" ? "1Win" : "LeBull";

  return (
    <div className="space-y-6">
      {/* Controles superiores */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Jogo</label>
            <select value={gameFromId} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={gameFromId}>{gameLabel}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Casa</label>
            <select value={casaFromId} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={casaFromId}>{casaLabel}</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button onClick={addRobot} className="h-[38px] px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              + Novo Robot
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Robot</label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {robots.length === 0 && <option value="">Nenhum robô</option>}
              {robots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* STATUS + CONFIGURAÇÕES */}
      {selected && (
        <div className="rounded-xl border bg-white p-4">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Status */}
            <div className="lg:col-span-1">
              <h3 className="font-medium mb-2">Status</h3>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-500">Robô selecionado</div>
                <div className="text-lg font-semibold">{selected.name}</div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Estado</div>
                    <div className="font-medium">{enabled ? "Ligado ✅" : "Desligado ❌"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Estratégias ativas</div>
                    <div className="font-medium">{activeStrategies}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ID</div>
                    <div className="font-mono text-xs break-all">{selected.id}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status</span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selected?.enabled}
                      onChange={async (e) => {
                        try {
                          await patchRobotAPI(selected.id, { enabled: e.target.checked });
                          setRobots((rs) =>
                            rs.map((r) => (r.id === selected.id ? { ...r, enabled: e.target.checked } : r))
                          );
                        } catch (err: any) {
                          alert(err?.message || "Falha ao atualizar robot");
                        }
                      }}
                    />
                    <span className="ml-1">{selected?.enabled ? "Ligado" : "Desligado"}</span>
                  </label>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    onClick={() => duplicateRobot(selected.id)}
                    className="px-3 py-2 rounded-lg border hover:bg-gray-50 whitespace-nowrap"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => removeRobot(selected.id)}
                    className="px-3 py-2 rounded-lg border text-red-600 hover:bg-red-50 whitespace-nowrap"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>

            {/* Configurações */}
            <div className="lg:col-span-2">
              <h3 className="font-medium mb-2">Configurações do Robô</h3>
              <div className="rounded-lg border p-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <Field label="Nome" type="text" value={selected.name} onChange={(v) => updateRobot({ name: v })} />
                  <Field label="Início" type="time" value={selected.startHour} onChange={(v) => updateRobot({ startHour: v })} />
                  <Field label="Fim" type="time" value={selected.endHour} onChange={(v) => updateRobot({ endHour: v })} />
                </div>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Field label="Bot Token" type="text" value={selected.botToken} onChange={(v) => updateRobot({ botToken: v })} />
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Field label="Chat ID" type="text" value={selected.chatId} onChange={(v) => updateRobot({ chatId: v })} />
                  <div className="hidden md:block" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTRATÉGIAS */}
      {selected && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Estratégia</h3>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => {
                  if (!selected?.id) {
                    alert("Selecione um robô primeiro.");
                    return;
                  }
                  setNewDraft(makeEmptyDraft(selected.id)); // abre o editor inline (sem prompt)
                }}
              >
                + Nova estratégia
              </button>
            </div>
          </div>

          {/* Editor inline de NOVA estratégia (AGORA DENTRO do componente) */}
          {newDraft && (
            <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-lg font-semibold mb-3">Nova estratégia (rascunho)</div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  Nome
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.name}
                    onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
                    placeholder="ex.: LowMults 3x"
                  />
                </label>

                <label className="text-sm">
                  Início
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.startHour}
                    onChange={(e) => setNewDraft({ ...newDraft, startHour: e.target.value })}
                    placeholder="00:00"
                  />
                </label>

                <label className="text-sm">
                  Fim
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.endHour}
                    onChange={(e) => setNewDraft({ ...newDraft, endHour: e.target.value })}
                    placeholder="23:59"
                  />
                </label>

                <label className="text-sm">
                  Vitória em
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.winAt}
                    onChange={(e) => setNewDraft({ ...newDraft, winAt: Number(e.target.value || 0) })}
                    min={1}
                  />
                </label>

                <label className="text-sm">
                  Martingale (qtd.)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.mgCount}
                    onChange={(e) => setNewDraft({ ...newDraft, mgCount: Number(e.target.value || 0) })}
                    min={0}
                  />
                </label>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-medium">Monte sua estratégia (quadradinhos)</div>
                <PatternBuilder
                  value={newDraft.pattern}
                  onChange={(pattern: string[]) => setNewDraft({ ...newDraft, pattern })}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setNewDraft(null)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  disabled={savingDraft}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveDraft}
                  className="rounded-lg bg-black px-4 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
                  disabled={savingDraft}
                >
                  {savingDraft ? "Salvando..." : "Salvar estratégia"}
                </button>
              </div>
            </div>
          )}

          <StrategiesPanel
            key={selected.id}
            bot={gameFromId}
            casa={casaFromId}
            robotId={selected.id}
            strategies={(selected.strategies ?? []).map<PanelStrategy>((s) => ({
              id: s.id,
              name: s.name,
              startHour: s.startHour,
              endHour: s.endHour,
              mgCount: s.mgCount,
              enabled: s.enabled,
              winAt: s.winAt,
              pattern: normalizePattern(s.pattern).map<Color>((c) => normalizeColor(c)),
              messages: s.messages,
            }))}
            onChange={(next) => setStrategies(next)}
            onDuplicate={duplicateStrategy}
            onDelete={deleteStrategy}
            onToggle={toggleStrategy}
            onSummaryChange={(s) => setActiveStrategies(s.active)}
            hideEditor={!showStrategyEditor}
            showCloseButton={true}
            onCloseEditor={() => setShowStrategyEditor(false)}
          />

          {/* ===== ABA RECOLHÍVEL: Legendas + Variáveis ===== */}
          <details className="mt-4 rounded-xl border bg-white">
            <summary className="cursor-pointer select-none list-none rounded-xl px-4 py-3 text-sm font-semibold hover:bg-gray-50 flex items-center justify-between">
              Ajuda: legendas e variáveis
              <span className="text-xs text-gray-500 ml-3">(clique para abrir/fechar)</span>
            </summary>

            <div className="border-t px-4 py-4 space-y-4">
              {/* Significado de cada cor */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="mb-2 text-sm font-semibold">Significado de cada cor</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {COLOR_MEANINGS.map((it) => (
                    <LegendRow key={it.key} item={it} />
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Observação: a cor <b>BRANCA</b> é apenas referência (crash 1.00x).
                </div>
              </div>

              {/* Variáveis de template */}
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="mb-2 text-sm font-semibold">Variáveis de template</div>
                <div className="space-y-3">
                  {VAR_GROUPS.map((group) => (
                    <div key={group.title} className="rounded border bg-white p-3">
                      <div className="text-sm font-semibold mb-2">{group.title}</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {group.items.map((it) => (
                          <VarChip key={`${group.title}-${it.code}`} item={it} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-[11px] text-gray-600">
                  Digite sempre com colchetes. Ex.:{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5 border">[DATA_HOJE]</code>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "time";
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
