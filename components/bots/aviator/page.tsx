"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// =============================================
// Tipos compartilhados com a Home
// =============================================
type BotGame = "aviator" | "bacbo";

type CasaSlug = string; // manter flexível (stake, 1win, lebull, bet365, etc.)

export type BotMeta = {
  id: string; // ex.: "aviator-1win"
  game: BotGame; // ex.: "aviator"
  casa: CasaSlug; // ex.: "1win"
  label: string; // ex.: "Aviator @ 1Win"
};

type RobotStatus = {
  botId: string;
  active: boolean;
  strategyCount: number;
  winsToday: number;
  redsToday: number;
  lastSignalAt?: string;
  stake?: number;
};

// =============================================
// Helpers
// =============================================
function toLabel(game: BotGame, casa: string) {
  const titleCasa = casa.replace(/^[a-z]/, (c) => c.toUpperCase());
  const gameTitle = game === "aviator" ? "Aviator" : "Bac Bo";
  return `${gameTitle} @ ${titleCasa}`;
}

function makeBotId(game: BotGame, casa: string) {
  return `${game}-${casa}`;
}

function botHref(meta: BotMeta) {
  // mantém compatível com sua tela de gerenciamento que lê os query params
  return `/bots?game=${meta.game}&casa=${meta.casa}`;
}

function timeShort(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// =============================================
// useLocalStorage simples
// =============================================
function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

// =============================================
// Persistência oficial
// =============================================
const BOTS_KEY = "roasbot.bots"; // BotMeta[]
const STATUS_KEY = "roasbot.home.statuses:v2"; // RobotStatus[]

function readBots(): BotMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOTS_KEY);
    return raw ? (JSON.parse(raw) as BotMeta[]) : [];
  } catch {
    return [];
  }
}

function writeBots(list: BotMeta[]) {
  try {
    localStorage.setItem(BOTS_KEY, JSON.stringify(list));
  } catch {}
}

function upsertStatusFor(botId: string, patch: Partial<RobotStatus> = {}) {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const arr: RobotStatus[] = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex((s) => s.botId === botId);
    const base: RobotStatus = {
      botId,
      active: false,
      strategyCount: 0,
      winsToday: 0,
      redsToday: 0,
      lastSignalAt: undefined,
      stake: undefined,
    };
    if (idx >= 0) arr[idx] = { ...arr[idx], ...patch };
    else arr.push({ ...base, ...patch });
    localStorage.setItem(STATUS_KEY, JSON.stringify(arr));
  } catch {}
}

function readStatuses(): RobotStatus[] {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as RobotStatus[]) : [];
  } catch {
    return [];
  }
}

// =============================================
// Componentes auxiliares (chips, empty state, modal)
// =============================================
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border rounded-2xl bg-white p-8 text-center">
      <div className="text-xl font-semibold mb-1">Nenhum bot por aqui… ainda</div>
      <p className="text-gray-600 mb-4">
        Crie seu primeiro bot para começar a acompanhar estratégias e resultados.
      </p>
      <button
        onClick={onCreate}
        className="px-4 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90"
      >
        + Novo bot
      </button>
    </div>
  );
}

function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// =============================================
// Página /bots
// =============================================
export default function BotsPage() {
  const [bots, setBots] = useState<BotMeta[]>([]);
  const [statuses, setStatuses] = useState<RobotStatus[]>([]);

  // UI local
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "on" | "off">("all");
  const [isOpen, setIsOpen] = useState(false);

  // Form
  const [game, setGame] = useState<BotGame>("aviator");
  const [casa, setCasa] = useState("");
  const [stake, setStake] = useState<number | "">("");

  // Load
  useEffect(() => {
    setBots(readBots());
    setStatuses(readStatuses());
  }, []);

  // Derived
  const enriched = useMemo(() => {
    return bots.map((b) => ({
      meta: b,
      status: statuses.find((s) => s.botId === b.id),
    }));
  }, [bots, statuses]);

  const filtered = useMemo(() => {
    let arr = enriched;
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      arr = arr.filter(({ meta }) =>
        meta.label.toLowerCase().includes(k) || meta.casa.toLowerCase().includes(k)
      );
    }
    if (tab !== "all") {
      arr = arr.filter(({ status }) => {
        const on = status?.active === true;
        return tab === "on" ? on : !on;
      });
    }
    return arr;
  }, [enriched, q, tab]);

  const kpis = useMemo(() => {
    const on = enriched.filter((e) => e.status?.active).length;
    const off = enriched.length - on;
    const w = enriched.reduce((acc, e) => acc + (e.status?.winsToday || 0), 0);
    const r = enriched.reduce((acc, e) => acc + (e.status?.redsToday || 0), 0);
    const total = w + r;
    return {
      total: enriched.length,
      on,
      off,
      winRate: total === 0 ? 0 : Math.round((w / total) * 100),
    };
  }, [enriched]);

  // Actions
  function createBot(e: React.FormEvent) {
    e.preventDefault();
    const slug = casa.trim().toLowerCase();
    if (!slug) return;
    const id = makeBotId(game, slug);
    const meta: BotMeta = { id, game, casa: slug, label: toLabel(game, slug) };

    // Atualiza registro
    const nextBots = [...bots.filter((b) => b.id !== id), meta];
    setBots(nextBots);
    writeBots(nextBots);

    // Garante status
    upsertStatusFor(id, { stake: typeof stake === "number" ? stake : undefined });
    setStatuses(readStatuses());

    // reset & fecha
    setGame("aviator");
    setCasa("");
    setStake("");
    setIsOpen(false);
  }

  function removeBot(id: string) {
    const next = bots.filter((b) => b.id !== id);
    setBots(next);
    writeBots(next);
    // (opcional) não apagamos status para manter histórico; se quiser limpar, descomente:
    // const arr = readStatuses().filter(s => s.botId !== id);
    // localStorage.setItem(STATUS_KEY, JSON.stringify(arr));
    setStatuses(readStatuses());
  }

  function toggle(id: string) {
    upsertStatusFor(id, { active: !(statuses.find((s) => s.botId === id)?.active) });
    setStatuses(readStatuses());
  }

  // =============================================
  // Render
  // =============================================
  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bots</h1>
          <p className="text-gray-600">Gerencie seus bots, estratégias e status em um só lugar.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por casa ou nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-10 w-64 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
          />
          <button
            onClick={() => setIsOpen(true)}
            className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white hover:opacity-90"
          >
            + Novo bot
          </button>
        </div>
      </div>

      {/* KPIs topo */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Bots", value: kpis.total },
          { label: "Ativos", value: kpis.on },
          { label: "Desligados", value: kpis.off },
          { label: "Win rate (hoje)", value: `${kpis.winRate}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {([
          ["all", "Todos"],
          ["on", "Ativos"],
          ["off", "Desligados"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === key
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista / Empty */}
      {filtered.length === 0 ? (
        <Empty onCreate={() => setIsOpen(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ meta, status }) => (
            <div key={meta.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{meta.label}</div>
                  <div className="mt-1 flex gap-2">
                    <Chip>game: {meta.game}</Chip>
                    <Chip>casa: {meta.casa}</Chip>
                    <Chip>
                      status: {status?.active ? (
                        <span className="text-green-700">ligado</span>
                      ) : (
                        <span className="text-gray-700">desligado</span>
                      )}
                    </Chip>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Stake: {status?.stake ?? "—"}</div>
                  <div>Estratégias: {status?.strategyCount ?? 0}</div>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-center text-sm">
                <div>
                  <div className="text-xs text-gray-500">Wins</div>
                  <div className="text-base font-semibold">{status?.winsToday ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Reds</div>
                  <div className="text-base font-semibold">{status?.redsToday ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Último sinal</div>
                  <div className="text-base font-semibold">{timeShort(status?.lastSignalAt)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={botHref(meta)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Abrir
                </Link>
                <button
                  onClick={() => toggle(meta.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  {status?.active ? "Desligar" : "Ligar"}
                </button>
                <button
                  onClick={() => removeBot(meta.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação */}
      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Novo bot">
        <form className="space-y-4" onSubmit={createBot}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Jogo</label>
              <div className="flex gap-2">
                {["aviator", "bacbo"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGame(g as BotGame)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      game === g ? "bg-black text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {g === "aviator" ? "Aviator" : "Bac Bo"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Casa</label>
              <input
                value={casa}
                onChange={(e) => setCasa(e.target.value)}
                placeholder="ex.: 1win, lebull, stake, bet365…"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Stake (opcional)</label>
            <input
              type="number"
              step="0.1"
              value={stake as number | undefined}
              onChange={(e) => {
                const v = e.target.value;
                setStake(v === "" ? "" : Number(v));
              }}
              placeholder="ex.: 1, 2, 3…"
              className="w-40 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Criar bot
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
