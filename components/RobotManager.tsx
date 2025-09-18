// components/RobotManager.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { StrategyMessages } from "@/app/(app)/bots/aviator/StrategyMessagesForm";
import { PatternBuilder } from "@/components/PatternBuilder";
import StrategyEditor from "@/components/bots/StrategyEditor";

/* ===================== Tipos ===================== */
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
  blueMin?: number;
  pinkMax?: number;
  messages?: StrategyMessages;
};

type Robot = {
  id: string;
  game: string;
  casa: string;
  name: string;
  startHour: string;
  endHour: string;
  martingale: number;
  botToken?: string | null;
  chatId?: string | null;
  strategies: Strategy[];
  metrics: Metrics;
  enabled?: boolean;
};

type Game = "aviator" | "bacbo";
type CasaSlug = "1win" | "lebull";
type Props = { botId?: string; bot?: Game; casa: CasaSlug };

/* ===================== Helpers ===================== */
async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let j: any = null;
  try {
    j = await r.json();
  } catch {
    // ignore
  }
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP ${r.status}`);
  }
  return j;
}

async function renderMessage(template: string, ctx: any) {
  const res = await fetch("/api/messages/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template, ctx }),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j?.ok === false) throw new Error(j?.error || "render failed");
  return j.text as string;
}

async function sendViaApi(botToken: string, chatId: string, text: string) {
  const resp = await fetch("/api/send/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      botToken,
      chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.ok === false) {
    const reason =
      data?.response?.description || data?.message || `HTTP ${resp.status}`;
    throw new Error(`Falha ao enviar: ${reason}`);
  }
}

/* ---------- Normalizadores ---------- */
type Color = "green" | "gray" | "black" | "white" | "blue" | "pink";
const PALETTE = ["green", "gray", "black", "white", "blue", "pink"] as const;
const isColor = (v: unknown): v is Color =>
  (PALETTE as readonly string[]).includes(v as string);

function normalizeColor(x: unknown): Color {
  if (typeof x !== "string") return "gray";
  const s = x.trim();
  if (isColor(s)) return s as Color;
  const U = s.toUpperCase();
  if (U === "A") return "blue";
  if (U === "W") return "white";
  if (U === "G") return "green";
  if (U === "P") return "pink";
  if (U === "K") return "black";
  if (U === "X") return "gray";
  if (U === "R") return "pink";
  if (U === "B") return "white";
  return "gray";
}

/* ---------- Variáveis/legendas (UI) ---------- */
type LegendItem = { key: string; title: string; desc: string; dotClass: string };
const COLOR_MEANINGS: LegendItem[] = [
  { key: "gray", title: "COR CINZA", desc: "Poderá ser qualquer resultado", dotClass: "bg-gray-400" },
  { key: "green", title: "COR VERDE", desc: "Caso seja uma vela igual ou maior a 2x", dotClass: "bg-green-500" },
  { key: "black", title: "COR PRETA", desc: "Caso caia uma vela menor que 2x", dotClass: "bg-black" },
  { key: "white", title: "COR BRANCA", desc: "Vela em crash instantâneo (1.00x)", dotClass: "bg-white border" },
  { key: "blue", title: "COR AZUL", desc: "Vela maior ou igual ao valor customizado", dotClass: "bg-blue-500" },
  { key: "pink", title: "COR ROSA", desc: "Vela menor ou igual ao valor customizado", dotClass: "bg-pink-500" },
];

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
];

/* ---------- API helpers específicos ---------- */
async function getRobotByIdAPI(id: string): Promise<Robot> {
  const j = await api<{ ok: true; data: any }>(`/api/robots/${id}`);
  const hit = j.data;
  const norm: Robot = {
    id: hit.id,
    game: hit.game,
    casa: hit.casa,
    name: hit.name ?? hit.kind ?? "Robot",
    startHour: hit.startTime ?? hit.templates?.schedule?.start ?? "09:00",
    endHour: hit.endTime ?? hit.templates?.schedule?.end ?? "18:00",
    martingale: 2,
    botToken: hit.botToken ?? hit.telegramToken ?? null,
    chatId: hit.chatId ?? hit.telegramChatId ?? null,
    strategies: Array.isArray(hit.strategies) ? hit.strategies : [],
    metrics: hit.metrics ?? { jogadas: 0, greens: 0, reds: 0 },
    enabled: (hit.isActive ?? hit.active) ?? false,
  };
  return norm;
}

async function createRobotAPI(game: Game, casa: CasaSlug, label: string) {
  const schedule = { start: "09:00", end: "18:00" };
  const body: any = {
    // canônicas
    game,
    casa,
    kind: label,
    isActive: false,
    templates: { schedule },
    botToken: null,
    chatId: null,
    // aliases compat
    name: label,
    gameType: game,
    casinoSite: casa,
    active: false,
    startTime: schedule.start,
    endTime: schedule.end,
    telegramToken: null,
    telegramChatId: null,
  };
  const j = await api<{ ok: true; data: any }>(`/api/robots`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const hit = j.data;
  const created: Robot = {
    id: hit.id,
    game: hit.game,
    casa: hit.casa,
    name: hit.name ?? hit.kind ?? label,
    startHour: hit.startTime ?? hit.templates?.schedule?.start ?? schedule.start,
    endHour: hit.endTime ?? hit.templates?.schedule?.end ?? schedule.end,
    martingale: 2,
    botToken: hit.botToken ?? hit.telegramToken ?? null,
    chatId: hit.chatId ?? hit.telegramChatId ?? null,
    strategies: Array.isArray(hit.strategies) ? hit.strategies : [],
    metrics: hit.metrics ?? { jogadas: 0, greens: 0, reds: 0 },
    enabled: (hit.isActive ?? hit.active) ?? false,
  };
  return created;
}

async function patchRobotAPI(id: string, patch: Partial<Robot>): Promise<Robot> {
  const body: any = { id };

  if (patch.enabled !== undefined) {
    body.isActive = !!patch.enabled;
    body.active = !!patch.enabled; // alias
  }
  if (patch.name !== undefined) {
    body.name = patch.name;
    body.kind = patch.name; // alias
  }
  if (patch.startHour !== undefined) {
    body.startTime = patch.startHour;
    body.templates = {
      ...(body.templates || {}),
      schedule: { ...(body.templates?.schedule || {}), start: patch.startHour },
    };
  }
  if (patch.endHour !== undefined) {
    body.endTime = patch.endHour;
    body.templates = {
      ...(body.templates || {}),
      schedule: { ...(body.templates?.schedule || {}), end: patch.endHour },
    };
  }
  if (patch.botToken !== undefined) {
    const t = String(patch.botToken || "").trim();
    body.botToken = t ? t : null;
    body.telegramToken = body.botToken;
  }
  if (patch.chatId !== undefined) {
    const v = String(patch.chatId || "").trim();
    body.chatId = v ? v : null;
    body.telegramChatId = body.chatId;
  }

  const j = await api<{ ok: true; data: any }>(`/api/robots`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const hit = j.data;
  const norm: Robot = {
    id: hit.id,
    game: hit.game,
    casa: hit.casa,
    name: hit.name ?? hit.kind ?? "Robot",
    startHour: hit.startTime ?? hit.templates?.schedule?.start ?? "09:00",
    endHour: hit.endTime ?? hit.templates?.schedule?.end ?? "18:00",
    martingale: 2,
    botToken: hit.botToken ?? hit.telegramToken ?? null,
    chatId: hit.chatId ?? hit.telegramChatId ?? null,
    strategies: Array.isArray(hit.strategies) ? hit.strategies : [],
    metrics: hit.metrics ?? { jogadas: 0, greens: 0, reds: 0 },
    enabled: (hit.isActive ?? hit.active) ?? false,
  };
  return norm;
}

/* ---------- Strategies API helpers ---------- */
const STRAT_ALLOWED = new Set([
  "robotId",
  "name",
  "startHour",
  "endHour",
  "winAt",
  "mgCount",
  "enabled",
  "pattern",
  "messages",
]);
function cleanPatch(patch: any) {
  const out: any = {};
  Object.keys(patch || {}).forEach((k) => {
    const v = (patch as any)[k];
    if (v === undefined || v === null) return;
    if (STRAT_ALLOWED.has(k)) out[k] = v;
  });
  return out;
}

async function createStrategyAPI(input: Partial<Strategy> & { robotId: string; name: string }) {
  const j = await api<{ ok: true; data: Strategy }>(`/api/strategies`, {
    method: "POST",
    body: JSON.stringify(cleanPatch(input)),
  });
  return j.data;
}

async function patchStrategyAPI(id: string, patch: Partial<Strategy>) {
  const r = await fetch(`/api/strategies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    const err: any = new Error(j?.error || "Falha ao atualizar estratégia");
    err.status = r.status;
    throw err;
  }
  return j.data as Strategy;
}

async function deleteStrategyAPI(id: string) {
  const r = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "Falha ao excluir estratégia");
}

/* ===================== Componente ===================== */
export default function RobotManager({ botId, bot, casa }: Props) {
  // Resolve botId real
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

  // Estado principal
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = robots.find((r) => r.id === selectedId) ?? null;

  // Carrega robô inicial do backend (ou lista)
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        // Liste do backend por game/casa para nome sequencial e seleção
        const r = await fetch(
          `/api/robots?game=${encodeURIComponent(gameFromId)}&casa=${encodeURIComponent(casaFromId)}`
        );
        const j = await r.json();
        const list: any[] = r.ok && j?.ok ? j.data : [];
        const normalized: Robot[] = list.map((hit: any) => ({
          id: hit.id,
          game: hit.game,
          casa: hit.casa,
          name: hit.name ?? hit.kind ?? "Robot",
          startHour: hit.startTime ?? hit.templates?.schedule?.start ?? "09:00",
          endHour: hit.endTime ?? hit.templates?.schedule?.end ?? "18:00",
          martingale: 2,
          botToken: hit.botToken ?? hit.telegramToken ?? null,
          chatId: hit.chatId ?? hit.telegramChatId ?? null,
          strategies: Array.isArray(hit.strategies) ? hit.strategies : [],
          metrics: hit.metrics ?? { jogadas: 0, greens: 0, reds: 0 },
          enabled: (hit.isActive ?? hit.active) ?? false,
        }));
        if (!abort) {
          setRobots(normalized);
          if (normalized.length) setSelectedId(normalized[0].id);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      abort = true;
    };
  }, [gameFromId, casaFromId]);

  // Auto-refresh do robô selecionado
  useEffect(() => {
    if (!selected?.id) return;
    let stop = false;
    let t: any;
    const tick = async () => {
      try {
        const fresh = await getRobotByIdAPI(selected.id);
        if (!stop) {
          setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
        }
      } finally {
        if (!stop) t = setTimeout(tick, 4000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [selected?.id]);

  const [activeStrategies, setActiveStrategies] = useState(0);
  useEffect(() => {
    if (!selected) return setActiveStrategies(0);
    setActiveStrategies((selected.strategies ?? []).filter((s) => s.enabled).length);
  }, [selected?.id, selected?.strategies]);

  // Ações: criar/duplicar/excluir/ligar/desligar/editar campos
  async function onClickNovoRobot() {
    try {
      // Buscar lista p/ descobrir próximo número
      const r = await fetch(
        `/api/robots?game=${encodeURIComponent(gameFromId)}&casa=${encodeURIComponent(casaFromId)}`
      );
      const j = await r.json();
      const list: any[] = r.ok && j?.ok ? j.data : [];
      const nextNum =
        Math.max(
          0,
          ...list.map((it) =>
            Number(String((it.name ?? it.kind) || "").match(/^Robot\s+(\d+)$/i)?.[1] || 0)
          )
        ) + 1;

      const created = await createRobotAPI(gameFromId, casaFromId, `Robot ${nextNum}`);
      setRobots((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (e: any) {
      alert(e?.message || "Falha ao criar robot");
    }
  }

  async function onToggleEnabled(next: boolean) {
    if (!selected) return;
    try {
      const updated = await patchRobotAPI(selected.id, { enabled: next });
      setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    } catch (e: any) {
      alert(e?.message || "Falha ao atualizar robot");
    }
  }

  const saveName = async (val: string) => {
    if (!selected) return;
    const updated = await patchRobotAPI(selected.id, { name: val || "Robot" });
    setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };
  const saveStart = async (val: string) => {
    if (!selected) return;
    const updated = await patchRobotAPI(selected.id, { startHour: val });
    setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };
  const saveEnd = async (val: string) => {
    if (!selected) return;
    const updated = await patchRobotAPI(selected.id, { endHour: val });
    setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };
  const saveToken = async (val: string) => {
    if (!selected) return;
    const updated = await patchRobotAPI(selected.id, { botToken: val });
    setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };
  const saveChat = async (val: string) => {
    if (!selected) return;
    const updated = await patchRobotAPI(selected.id, { chatId: val });
    setRobots((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };

  // Estratégias
  const sortByName = (a: Strategy, b: Strategy) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  const [newDraft, setNewDraft] = useState<{
    robotId: string;
    name: string;
    startHour: string;
    endHour: string;
    winAt: number;
    mgCount: number;
    pattern: string[];
    messages: Record<string, string>;
    enabled: boolean;
    blueMin?: number;
    pinkMax?: number;
  } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  async function saveDraft() {
    if (!newDraft || !selected) return;
    if (!newDraft.name.trim()) {
      alert("Dê um nome para a estratégia.");
      return;
    }
    try {
      setSavingDraft(true);
      const created = await createStrategyAPI({
        robotId: newDraft.robotId,
        name: newDraft.name,
        startHour: newDraft.startHour,
        endHour: newDraft.endHour,
        winAt: newDraft.winAt,
        mgCount: newDraft.mgCount,
        enabled: newDraft.enabled,
        pattern: newDraft.pattern,
      });
      setRobots((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, strategies: [...(r.strategies ?? []), created].sort(sortByName) }
            : r
        )
      );
      setNewDraft(null);
      // refresh
      const fresh = await getRobotByIdAPI(selected.id);
      setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
    } catch (e: any) {
      alert(e?.message || "Falha ao salvar estratégia");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleToggleStrategy(id: string, value: boolean) {
    try {
      await patchStrategyAPI(id, { enabled: value });
      setRobots((prev) =>
        prev.map((r) =>
          r.id === selected?.id
            ? {
                ...r,
                strategies: r.strategies
                  .map((s) => (s.id === id ? { ...s, enabled: value } : s))
                  .sort(sortByName),
              }
            : r
        )
      );
      const fresh = await getRobotByIdAPI(selected!.id);
      setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
    } catch (e: any) {
      alert(e?.message || "Falha ao alternar estratégia.");
    }
  }

  async function handleDeleteStrategy(id: string) {
    if (!selected) return;
    if (!confirm("Tem certeza que deseja excluir esta estratégia?")) return;
    try {
      await deleteStrategyAPI(id);
      setRobots((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, strategies: r.strategies.filter((s) => s.id !== id).sort(sortByName) }
            : r
        )
      );
      const fresh = await getRobotByIdAPI(selected.id);
      setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
    } catch (e: any) {
      alert(e?.message || "Falha ao excluir estratégia.");
    }
  }

  // Prévia / Enviar teste
  const [sending, setSending] = useState(false);
  const strategyForTest = useMemo(() => {
    const list = selected?.strategies ?? [];
    return list.find((s) => s.enabled) ?? list[0] ?? null;
  }, [selected?.strategies]);

  async function handlePreviewWin() {
    if (!strategyForTest) return alert("Crie uma estratégia primeiro.");
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
    if (!selected) return alert("Selecione um robô.");
    if (!strategyForTest) return alert("Crie uma estratégia primeiro.");
    if (!selected.botToken || !selected.chatId) {
      return alert("Configure Bot Token e Chat ID do robô.");
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
      await sendViaApi(String(selected.botToken), String(selected.chatId), text);
      alert("Mensagem enviada!");
    } catch (e: any) {
      alert(e?.message || "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  /* ===================== UI ===================== */
  const gameLabel = gameFromId === "aviator" ? "Aviator" : "Bac Bo";
  const casaLabel = casaFromId === "1win" ? "1Win" : "LeBull";

  return (
    <div className="space-y-6">
      {/* Controles superiores */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <div>
            <label className="block text-sm font-semibold mb-1">Jogo</label>
            <select value={gameFromId} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={gameFromId}>{gameLabel}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Casa</label>
            <select value={casaFromId} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={casaFromId}>{casaLabel}</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button
              onClick={onClickNovoRobot}
              className="h-[38px] px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              + Novo Robot
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Robot</label>
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
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Status */}
            <div className="lg:col-span-1">
              <h3 className="font-bold mb-2">Status</h3>
              <div className="rounded-xl border p-4 bg-gradient-to-b from-gray-50 to-white">
                <div className="text-sm text-gray-500">Robô selecionado</div>
                <div className="text-lg font-semibold">{selected.name}</div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Estratégias ativas</div>
                    <div className="font-medium">{activeStrategies}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ID</div>
                    <div className="font-mono text-xs break-all">{selected.id}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-600">Status</span>
                  <button
                    type="button"
                    aria-pressed={!!selected.enabled}
                    onClick={() => onToggleEnabled(!selected.enabled)}
                    className={`relative inline-flex h-8 w-16 items-center justify-center rounded-full transition
                      ${selected.enabled ? "bg-green-500" : "bg-gray-300"}`}
                    title={selected.enabled ? "Desligar" : "Ligar"}
                  >
                    <span
                      className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform
                        ${selected.enabled ? "translate-x-8" : "translate-x-0"}`}
                    />
                    <span className="sr-only">Alternar</span>
                  </button>
                  <span className="text-sm">{selected.enabled ? "Ligado" : "Desligado"}</span>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const base = selected;
                      const copy: Robot = {
                        ...base,
                        id: crypto.randomUUID(),
                        name: `${base.name} (cópia)`,
                      };
                      setRobots((prev) => [copy, ...prev]);
                      setSelectedId(copy.id);
                    }}
                    className="px-3 py-2 rounded-lg border hover:bg-gray-50 whitespace-nowrap"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Excluir robô apenas localmente na UI?")) return;
                      setRobots((prev) => prev.filter((r) => r.id !== selected.id));
                      setSelectedId(null);
                    }}
                    className="px-3 py-2 rounded-lg border text-red-600 hover:bg-red-50 whitespace-nowrap"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>

            {/* Configurações */}
            <div className="lg:col-span-2">
              <h3 className="font-bold mb-2">Configurações do Robô</h3>
              <div className="rounded-xl border p-4 bg-white">
                <div className="grid md:grid-cols-3 gap-4">
                  <Field
                    label="Nome"
                    type="text"
                    value={selected.name}
                    onChange={(v) => setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, name: v } : r)))}
                  />
                  <Field
                    label="Início"
                    type="time"
                    value={selected.startHour}
                    onChange={(v) => setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, startHour: v } : r)))}
                  />
                  <Field
                    label="Fim"
                    type="time"
                    value={selected.endHour}
                    onChange={(v) => setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, endHour: v } : r)))}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Field
                    label="Bot Token"
                    type="text"
                    value={selected.botToken ?? ""}
                    onChange={(v) => setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, botToken: v } : r)))}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Field
                    label="Chat ID"
                    type="text"
                    value={selected.chatId ?? ""}
                    onChange={(v) => setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, chatId: v } : r)))}
                  />
                  <input
                    className="sr-only"
                    onBlur={async () => {
                      try {
                        // salva token/chatId/horários/nome que estão em memória
                        await saveName(selected.name);
                        await saveStart(selected.startHour);
                        await saveEnd(selected.endHour);
                        await saveToken(selected.botToken ?? "");
                        await saveChat(selected.chatId ?? "");
                      } catch {}
                    }}
                  />
                  <div className="hidden md:block" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handlePreviewWin}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
                  >
                    Pré-visualizar mensagem de WIN
                  </button>
                  <button
                    onClick={handleSendWinTest}
                    disabled={sending}
                    className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {sending ? "Enviando..." : "Enviar WIN (teste)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTRATÉGIAS */}
      {selected && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Estratégias</h3>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setNewDraft({
                  robotId: selected.id,
                  name: "",
                  startHour: "00:00",
                  endHour: "23:59",
                  winAt: 3,
                  mgCount: 0,
                  pattern: [],
                  messages: {},
                  enabled: true,
                })}
              >
                + Nova estratégia
              </button>
            </div>
          </div>

          {newDraft ? (
            <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-blue-100">
              <div className="text-lg font-semibold mb-3">Nova estratégia (rascunho)</div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-sm md:col-span-2">
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
                    type="time"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.startHour}
                    onChange={(e) => setNewDraft({ ...newDraft, startHour: e.target.value })}
                    placeholder="00:00"
                  />
                </label>

                <label className="text-sm">
                  Fim
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.endHour}
                    onChange={(e) => setNewDraft({ ...newDraft, endHour: e.target.value })}
                    placeholder="23:59"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <label className="text-sm">
                  Vitória em
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.winAt}
                    onChange={(e) => setNewDraft({ ...newDraft, winAt: Number(e.target.value || 0) })}
                  />
                </label>

                <label className="text-sm">
                  Martingale (qtd.)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={newDraft.mgCount}
                    onChange={(e) => setNewDraft({ ...newDraft, mgCount: Number(e.target.value || 0) })}
                  />
                </label>

                <div className="hidden md:block" />
                <div className="hidden md:block" />
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-medium">Monte sua estratégia (quadradinhos)</div>
                <PatternBuilder
                  value={newDraft.pattern}
                  onChange={(pattern: string[]) => setNewDraft({ ...newDraft, pattern })}
                />
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setNewDraft(null)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  disabled={savingDraft}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveDraft}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={savingDraft}
                >
                  {savingDraft ? "Salvando..." : "Salvar estratégia"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {(selected.strategies ?? [])
              .slice()
              .sort(sortByName)
              .map((s) => (
                <StrategyRow
                  key={s.id}
                  strategy={s}
                  onToggle={(val) => handleToggleStrategy(s.id, val)}
                  onDelete={() => handleDeleteStrategy(s.id)}
                  onSave={async (patch) => {
                    try {
                      await patchStrategyAPI(s.id, patch);
                      setRobots((prev) =>
                        prev.map((r) =>
                          r.id === selected!.id
                            ? {
                                ...r,
                                strategies: r.strategies
                                  .map((it) => (it.id === s.id ? { ...it, ...patch } : it))
                                  .sort(sortByName),
                              }
                            : r
                        )
                      );
                      const fresh = await getRobotByIdAPI(selected!.id);
                      setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
                    } catch (e: any) {
                      if (e?.status === 404 || /not found/i.test(e?.message)) {
                        const created = await createStrategyAPI({
                          robotId: selected!.id,
                          name: patch.name ?? s.name,
                          startHour: patch.startHour ?? s.startHour,
                          endHour: patch.endHour ?? s.endHour,
                          winAt: patch.winAt ?? s.winAt,
                          mgCount: patch.mgCount ?? s.mgCount,
                          pattern: s.pattern,
                          enabled: s.enabled,
                        });
                        setRobots((prev) =>
                          prev.map((r) =>
                            r.id === selected!.id
                              ? {
                                  ...r,
                                  strategies: r.strategies
                                    .map((it) => (it.id === s.id ? created : it))
                                    .sort(sortByName),
                                }
                              : r
                          )
                        );
                        const fresh = await getRobotByIdAPI(selected!.id);
                        setRobots((prev) => prev.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)));
                      } else {
                        alert(e?.message || "Falha ao salvar estratégia.");
                      }
                    }
                  }}
                />
              ))}
            {(selected.strategies ?? []).length === 0 && (
              <div className="text-sm text-gray-500">Nenhuma estratégia criada.</div>
            )}
          </div>

          {/* Ajuda */}
          <details className="mt-6 rounded-xl border bg-white">
            <summary className="cursor-pointer select-none list-none rounded-xl px-4 py-3 text-sm font-semibold hover:bg-gray-50 flex items-center justify-between">
              Ajuda: legendas e variáveis
              <span className="text-xs text-gray-500 ml-3">(clique para abrir/fechar)</span>
            </summary>

            <div className="border-t px-4 py-4 space-y-4">
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

/* ===================== Subcomponentes/UI helpers ===================== */
function Field({
  label,
  value = "",
  onChange,
  type = "text",
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  type?: "text" | "time";
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = "text",
  step,
  w = "w-full",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "time" | "number";
  step?: string;
  w?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 ${w} rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
    </div>
  );
}

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

function StrategyRow({
  strategy,
  onSave,
  onToggle,
  onDelete,
}: {
  strategy: Strategy;
  onSave: (patch: Partial<Strategy>) => Promise<void>;
  onToggle: (value: boolean) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: strategy.name,
    startHour: strategy.startHour,
    endHour: strategy.endHour,
    winAt: String(strategy.winAt),
    mgCount: String(strategy.mgCount),
    blueMin: strategy.blueMin ?? "",
    pinkMax: strategy.pinkMax ?? "",
  });

  async function handleSave() {
    const patch: Partial<Strategy> = {
      name: form.name.trim(),
      startHour: form.startHour,
      endHour: form.endHour,
      winAt: Number(form.winAt || 0),
      mgCount: Number(form.mgCount || 0),
    };
    await onSave(patch);
    setEditing(false);
  }

  const colorClass = (c: string) =>
    ({
      green: "bg-emerald-500",
      gray: "bg-gray-400",
      black: "bg-gray-900",
      white: "bg-white ring-1 ring-gray-300",
      blue: "bg-blue-500",
      pink: "bg-pink-500",
    } as const)[normalizeColor(c)];

  return (
    <div className="rounded-2xl border bg-white ring-1 ring-gray-100 shadow-sm transition">
      {!editing && (
        <div className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${strategy.enabled ? "bg-green-500" : "bg-gray-300"}`}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="truncate font-semibold">{strategy.name}</div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-md bg-gray-100 px-2 py-0.5">
                  ⏱ {strategy.startHour}–{strategy.endHour}
                </span>
                <span className="rounded-md px-2 py-0.5 ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
                  Vitória em {strategy.winAt}
                </span>
                <span className="rounded-md px-2 py-0.5 ring-1 bg-indigo-50 text-indigo-700 ring-indigo-200">
                  MG {strategy.mgCount}
                </span>
                {strategy.blueMin != null && (
                  <span className="rounded-md px-2 py-0.5 ring-1 bg-blue-50 text-blue-700 ring-blue-200">
                    Azul ≥ {Number(strategy.blueMin).toFixed(2)}
                  </span>
                )}
                {strategy.pinkMax != null && (
                  <span className="rounded-md px-2 py-0.5 ring-1 bg-pink-50 text-pink-700 ring-pink-200">
                    Rosa ≤ {Number(strategy.pinkMax).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="mt-2 hidden md:flex items-center gap-1">
                {(strategy.pattern ?? []).slice(0, 28).map((c, i) => (
                  <span key={i} className={`h-3 w-3 rounded ${colorClass(c)}`} />
                ))}
                {strategy.pattern && strategy.pattern.length > 28 && (
                  <span className="text-[10px] text-gray-400">
                    +{strategy.pattern.length - 28}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-pressed={strategy.enabled}
              onClick={() => onToggle(!strategy.enabled)}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                strategy.enabled ? "bg-green-500" : "bg-gray-300"
              }`}
              title={strategy.enabled ? "Desligar estratégia" : "Ligar estratégia"}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow absolute left-1 transition-transform ${
                  strategy.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>

            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="p-4 border-t">
          <div className="grid items-end gap-3 md:grid-cols-6">
            <MiniField
              label="Nome"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              className="md:col-span-3"
            />
            <MiniField
              label="Início"
              type="time"
              value={form.startHour}
              onChange={(v) => setForm((f) => ({ ...f, startHour: v }))}
            />
            <MiniField
              label="Fim"
              type="time"
              value={form.endHour}
              onChange={(v) => setForm((f) => ({ ...f, endHour: v }))}
            />
          </div>

          <div className="md:col-span-8">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="mb-1 block text-xs font-semibold">Vitória em</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    className="h-9 w-20 rounded-md border px-2 text-sm ring-1 ring-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.winAt}
                    onChange={(e) => setForm((f) => ({ ...f, winAt: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Gales</label>
                <input
                  type="number"
                  min={0}
                  className="h-9 w-20 rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.mgCount}
                  onChange={(e) => setForm((f) => ({ ...f, mgCount: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <StrategyEditor strategy={{ ...strategy, active: strategy.enabled }} size={12} />
          </div>

          <div className="mt-4">
            <div className="flex flex-nowrap items-end gap-4">
              <MiniField
                label="Azul (mín.)"
                type="number"
                step="0.01"
                value={String(form.blueMin)}
                onChange={(v) => setForm((f) => ({ ...f, blueMin: v }))}
                w="w-24"
              />
              <MiniField
                label="Rosa (máx.)"
                type="number"
                step="0.01"
                value={String(form.pinkMax)}
                onChange={(v) => setForm((f) => ({ ...f, pinkMax: v }))}
                w="w-24"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
