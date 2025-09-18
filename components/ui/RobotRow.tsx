// components/RobotRow.tsx (ou onde fica seu botão de excluir)
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RobotRow({ robot, onRemoved }: { robot: { id: string; name?: string }, onRemoved?: (id: string)=>void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Excluir o robô "${robot.name ?? robot.id}" PERMANENTEMENTE no banco?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/robots/${robot.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({} as any));

      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error || `HTTP ${res.status} ${res.statusText}`);
      }

      // remove da UI e/ou refaz o fetch da página
      onRemoved?.(robot.id);
      router.refresh(); // caso a lista venha de fetch server-side
    } catch (e: any) {
      alert(`Erro ao excluir no banco: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      title="Excluir no banco (ação permanente)"
    >
      {loading ? "Excluindo..." : "Excluir"}
    </button>
  );
}
