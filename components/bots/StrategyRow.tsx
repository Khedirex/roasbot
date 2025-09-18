// components/bots/StrategyRow.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StrategyEditor from "@/components/bots/StrategyEditor";
import { deleteStrategy } from "@/lib/strategies"; // <— novo

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
  onDelete, // será chamado APÓS excluir no banco, para tirar da lista local
}: {
  strategy: Strategy;
  onSave: (patch: Partial<Strategy>) => Promise<void>;
  onToggle: (value: boolean) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!confirm(`Excluir a estratégia "${strategy.name}" PERMANENTEMENTE no banco?`)) return;
    setDeleting(true);
    try {
      await deleteStrategy(strategy.id);   // ← exclui no banco
      onDelete();                          // ← remove da lista local (pai)
      router.refresh();                    // ← se a lista vem de fetch server-side
    } catch (e: any) {
      alert(`Erro ao excluir estratégia: ${e?.message || e}`);
    } finally {
      setDeleting(false);
    }
  }

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
                <span className="rounded-md bg-gray-100 px-2 py-0.5">⏱ {strategy.startHour}–{strategy.endHour}</span>
                {chips.map((c) => (
                  <span key={c.label} className={`rounded-md px-2 py-0.5 ring-1 ${c.tone}`} title={c.label}>
                    {c.label}
                  </span>
                ))}
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
              <span className={`h-5 w-5 rounded-full bg-white shadow absolute left-1 transition-transform ${
                strategy.enabled ? "translate-x-6" : "translate-x-0"
              }`} />
            </button>

            <button onClick={() => setEditing(true)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              Editar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              title="Excluir no banco (ação permanente)"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="p-4 border-t">
          {/* ... seu editor permanece igual ... */}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
              Salvar estratégia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
