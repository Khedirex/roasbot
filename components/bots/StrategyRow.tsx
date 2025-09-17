// components/bots/StrategyRow.tsx
"use client";

import { useMemo, useState } from "react";
import StrategyEditor from "@/components/bots/StrategyEditor";

type Strategy = {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
  winAt: number;
  mgCount: number;
  blueMin?: number;
  pinkMax?: number;
  enabled: boolean;
  pattern: string[];
};

export default function StrategyRow({
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

  const chips = useMemo(
    () => [
      { label: `Vitória em ${strategy.winAt}`, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
      { label: `GALES ${strategy.mgCount}`, tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
      ...(strategy.blueMin != null ? [{ label: `Azul ≥ ${Number(strategy.blueMin).toFixed(2)}`, tone: "bg-blue-50 text-blue-700 ring-blue-200" }] : []),
      ...(strategy.pinkMax != null ? [{ label: `Rosa ≤ ${Number(strategy.pinkMax).toFixed(2)}`, tone: "bg-pink-50 text-pink-700 ring-pink-200" }] : []),
    ],
    [strategy]
  );

  async function handleSave() {
    const patch: Partial<Strategy> = {
      name: form.name.trim(),
      startHour: form.startHour,
      endHour: form.endHour,
      winAt: Number(form.winAt || 0),
      mgCount: Number(form.mgCount || 0),
      blueMin: form.blueMin === "" ? undefined : Number(form.blueMin),
      pinkMax: form.pinkMax === "" ? undefined : Number(form.pinkMax),
    };
    await onSave(patch);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border bg-white ring-1 ring-gray-100 shadow-sm transition">
      {/* ======= RESUMO (linha minimalista) ======= */}
      {!editing && (
        <div className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                strategy.enabled ? "bg-green-500" : "bg-gray-300"
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="truncate font-semibold">{strategy.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-md bg-gray-100 px-2 py-0.5">⏱ {strategy.startHour}–{strategy.endHour}</span>
                {chips.map((c) => (
                  <span
                    key={c.label}
                    className={`rounded-md px-2 py-0.5 ring-1 ${c.tone}`}
                    title={c.label}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* lock/unlock */}
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

      {/* ======= EDIÇÃO (compacto) ======= */}
      {editing && (
        <div className="p-4 border-t">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Editando:</span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Vitória em {form.winAt || strategy.winAt}
              </span>
            </div>
            <div className="flex items-center gap-2">
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

          {/* Grid bem compacto */}
          <div className="grid items-end gap-3 md:grid-cols-6">
            <MiniField
              label="Nome"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              className="md:col-span-2"
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

            {/* blocos de vitória (destaque) */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Vitória em</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  className="h-9 w-20 rounded-md border px-2 text-sm ring-1 ring-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.winAt}
                  onChange={(e) => setForm((f) => ({ ...f, winAt: e.target.value }))}
                />
                <span className="text-xs text-gray-500">giro(s)</span>
              </div>
            </div>

            <MiniField
              label="GALES (qtd.)"
              type="number"
              value={form.mgCount}
              onChange={(v) => setForm((f) => ({ ...f, mgCount: v }))}
              w="w-20"
            />
            <MiniField
              label="Azul (mín.)"
              type="number"
              step="0.01"
              value={String(form.blueMin)}
              onChange={(v) => setForm((f) => ({ ...f, blueMin: v === "" ? "" : v }))}
              w="w-24"
            />
            <MiniField
              label="Rosa (máx.)"
              type="number"
              step="0.01"
              value={String(form.pinkMax)}
              onChange={(v) => setForm((f) => ({ ...f, pinkMax: v === "" ? "" : v }))}
              w="w-24"
            />
          </div>

          {/* Editor visual (mantido, mas compacto) */}
          <div className="mt-4">
            <StrategyEditor strategy={{ ...strategy, active: strategy.enabled }} size={12} />
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
              Salvar estratégia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pequenos helpers de input ---------- */
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
