// components/bots/StrategyEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PatternBuilder } from "@/components/PatternBuilder";
import { updateStrategy, savePattern } from "@/lib/strategies";
import type { UIToken } from "@/lib/uiTokens";

type StrategyEditorProps = {
  strategy: any; // se tiver um tipo, troque aqui
  size?: number; // nº de slots do pattern (padrão 15)
};

const DEFAULT_SIZE = 15;

function isUIToken(x: unknown): x is UIToken {
  return x === "X" || x === "K" || x === "P" || x === "W" || x === "G" || x === "A";
}

function normalizePattern(p: unknown, size: number): UIToken[] {
  const raw = Array.isArray(p) ? p : [];
  const arr = raw.map((x) => (isUIToken(x) ? x : "X")) as UIToken[];
  if (arr.length >= size) return arr.slice(0, size);
  return [...arr, ...Array.from({ length: size - arr.length }, () => "X" as UIToken)];
}

export default function StrategyEditor({ strategy, size = DEFAULT_SIZE }: StrategyEditorProps) {
  // Campos do formulário (ajuste conforme sua UI atual)
  const [name, setName] = useState<string>(strategy?.name ?? "");
  const [startHour, setStartHour] = useState<string>(strategy?.startHour ?? "00:00");
  const [endHour, setEndHour] = useState<string>(strategy?.endHour ?? "23:59");
  const [winAt, setWinAt] = useState<number>(strategy?.winAt ?? 1);
  const [mgCount, setMgCount] = useState<number>(strategy?.mgCount ?? 0);
  const [blueThreshold, setBlue] = useState<number | null>(strategy?.blueThreshold ?? null);
  const [pinkThreshold, setPink] = useState<number | null>(strategy?.pinkThreshold ?? null);
  const [active, setActive] = useState<boolean>(!!strategy?.active);

  // Pattern em memória
  const initialTokens = useMemo(() => normalizePattern(strategy?.pattern, size), [strategy?.pattern, size]);
  const [tokens, setTokens] = useState<UIToken[]>(initialTokens);

  // Debounce simples para autosave do pattern
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!strategy?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void savePattern(strategy.id, tokens).catch((e) => console.error("savePattern error:", e));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [strategy?.id, tokens]);

  async function onSaveForm() {
    await updateStrategy(strategy.id, {
      name,
      startHour,
      endHour,
      winAt,
      mgCount,
      blueThreshold,
      pinkThreshold,
      active,
    });
    // opcional: toast de sucesso
  }

  return (
    <div className="space-y-4">
      {/* Exemplos mínimos de inputs — use os seus controles atuais */}
      <div className="grid grid-cols-2 gap-3"> </div>

      {/* Builder controlado — só emite onChange; o autosave está acima */}
      <PatternBuilder value={tokens} onChange={setTokens} size={size} /> 
    </div>
  );
}
