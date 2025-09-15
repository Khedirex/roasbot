"use client";

import { useEffect, useMemo, useState } from "react";
import {
  StrategiesPanel,
  type Strategy as PanelStrategy,
  type Color,
} from "@/app/(app)/bots/aviator/StrategiesPanel";
import type { StrategyMessages } from "@/app/(app)/bots/aviator/StrategyMessagesForm";

/** ===== Tipos locais ===== */
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
  /** NOVO: mensagens configuráveis por estratégia (persistidas no storage) */
  messages?: StrategyMessages;
};

type Robot = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  martingale: number; // mantido p/ compat
  botToken: string;
  chatId: string;
  strategies: Strategy[];
  metrics: Metrics;
};

type Props = { botId: string; casa: string };

const STORAGE_PREFIX = "roasbot:robots";

export default function RobotManager({ botId, casa }: Props) {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${botId}:${casa}`, [botId, casa]);

  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const PALETTE = ["green", "gray", "black", "red", "blue", "pink"] as const;
  type PaletteColor = (typeof PALETTE)[number];
  const isColor = (v: unknown): v is Color =>
    (PALETTE as readonly string[]).includes(v as string);

  const enabledKey = useMemo(
    () => (selectedId ? `roasbot:${botId}:${casa}:${selectedId}:enabled` : ""),
    [botId, casa, selectedId]
  );
  const [enabled, setEnabled] = useState(false);
  const [activeStrategies, setActiveStrategies] = useState<number>(0);

  // controla visibilidade da caixa de criação de estratégia
  const [showStrategyEditor, setShowStrategyEditor] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Robot[];
      setRobots(parsed);
      setSelectedId((prev) =>
        prev && parsed.some((r) => r.id === prev) ? prev : parsed[0]?.id ?? null
      );
    } else {
      setRobots([]);
      setSelectedId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(robots));
  }, [robots, storageKey]);

  useEffect(() => {
    if (!enabledKey) return;
    const raw = localStorage.getItem(enabledKey);
    setEnabled(raw === "true");
  }, [enabledKey]);

  useEffect(() => {
    if (!enabledKey) return;
    localStorage.setItem(enabledKey, String(enabled));
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

  /** ===== CRUD de robô ===== */
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
  }

  function updateRobot(patch: Partial<Robot>) {
    if (!selected) return;
    setRobots((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
  }

  function removeRobot(id: string) {
    setRobots((prev) => prev.filter((r) => r.id !== id));
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
      pattern: (s.pattern as string[]) ?? [],
      // NOVO: traz de volta as mensagens do painel (se houver)
      messages: s.messages,
    }));
    updateRobot({ strategies: converted });
  }

  function duplicateStrategy(id: string) {
    if (!selected) return;
    const list = selected.strategies ?? [];
    const base = list.find((s) => s.id === id);
    if (!base) return;
    const copy: Strategy = {
      ...base,
      id: crypto.randomUUID(),
      name: `${base.name} (cópia)`,
    };
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
    const next = (selected.strategies ?? []).map((s) =>
      s.id === id ? { ...s, enabled: value } : s
    );
    updateRobot({ strategies: next });
    setActiveStrategies(next.filter((s) => s.enabled).length);
  }

  return (
    <div className="space-y-6">
      {/* PRIMEIRA PARTE: controles superiores */}
      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          {/* Jogo */}
          <div>
            <label className="block text-sm font-medium mb-1">Jogo</label>
            <select value={botId} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={botId}>Aviator</option>
            </select>
          </div>

          {/* Casa */}
          <div>
            <label className="block text-sm font-medium mb-1">Casa</label>
            <select value={casa} disabled className="w-full rounded-lg border px-3 py-2 bg-gray-50">
              <option value={casa}>{casa}</option>
            </select>
          </div>

          {/* Botão central alinhado às caixas */}
          <div className="flex justify-center">
            <button
              onClick={addRobot}
              className="h-[38px] px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              + Novo Robot
            </button>
          </div>

          {/* Select do Robot */}
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
                  <label className="text-sm text-gray-600">Status</label>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <div className="h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition" />
                    <span className="ml-2 text-sm">{enabled ? "Ligado ✅" : "Desligado ❌"}</span>
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
                  <Field label="Nome" value={selected.name} onChange={(v) => updateRobot({ name: v })} />
                  <Field label="Início" type="time" value={selected.startHour} onChange={(v) => updateRobot({ startHour: v })} />
                  <Field label="Fim" type="time" value={selected.endHour} onChange={(v) => updateRobot({ endHour: v })} />
                </div>

                {/* Bot Token largura total */}
                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Field
                    label="Bot Token"
                    value={selected.botToken}
                    onChange={(v) => updateRobot({ botToken: v })}
                  />
                </div>

                {/* Chat ID meia largura abaixo */}
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Field
                    label="Chat ID"
                    value={selected.chatId}
                    onChange={(v) => updateRobot({ chatId: v })}
                  />
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

            {/* Botão que abre a caixa de criação; some quando aberto */}
            {!showStrategyEditor && (
              <button
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setShowStrategyEditor(true)}
              >
                + Nova estratégia
              </button>
            )}
          </div>

          <StrategiesPanel
            bot={botId}
            casa={casa}
            robotId={selected.id}
            strategies={(selected.strategies ?? []).map<PanelStrategy>((s) => ({
              id: s.id,
              name: s.name,
              startHour: s.startHour,
              endHour: s.endHour,
              mgCount: s.mgCount,
              enabled: s.enabled,
              winAt: s.winAt,
              messages: s.messages, // passa mensagens para o painel
              pattern: (s.pattern as Array<string | Color>).map<Color>((c) =>
                isColor(c) ? c : ("gray" as Color)
              ),
            }))}

            onChange={(next) => {
              setStrategies(next); // já converte e persiste (inclui messages)
              // se quiser fechar automaticamente após criar, descomente:
              // setShowStrategyEditor(false);
            }}
            onDuplicate={duplicateStrategy}
            onDelete={deleteStrategy}
            onToggle={toggleStrategy}
            onSummaryChange={(s) => setActiveStrategies(s.active)}
            hideEditor={!showStrategyEditor}
            showCloseButton={showStrategyEditor}
            onCloseEditor={() => setShowStrategyEditor(false)}
          />
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
