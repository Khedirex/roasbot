// components/PatternBuilder.tsx
"use client";

import React, { MouseEvent } from "react";
import type { UIToken, RGB } from "@/lib/uiTokens";
import { UI_TO_RGB } from "@/lib/uiTokens";

// Ordem de rotação ao clicar (X → K → P → W → G → A → X...)
const ORDER: UIToken[] = ["X", "K", "P", "W", "G", "A"];

// Dica visual: mais antigo ←  ...  mais recente →
const HINT = "Mais antigo à esquerda • Mais recente à direita";

function nextToken(t: UIToken): UIToken {
  const i = ORDER.indexOf(t);
  return ORDER[(i + 1) % ORDER.length];
}
function prevToken(t: UIToken): UIToken {
  const i = ORDER.indexOf(t);
  return ORDER[(i - 1 + ORDER.length) % ORDER.length];
}

/* ==================== Normalização de entrada ==================== */
/** Aceita UI tokens (A/W/G/P/K/X), runtime letters (R/G/B) e cores (rgb/hex). */
type AnyToken = UIToken | string;

/** Mapa canônico runtime->UI para exibição */
const RUNTIME_TO_UI: Record<string, UIToken> = {
  G: "G", // green
  B: "W", // white
  R: "P", // pink como padrão visual p/ "R"
};

/** Tentativa leve de interpretar "rgb(...)" | "r,g,b" | "#rrggbb" */
function parseColorToRGBKey(s: string): string | null {
  const str = s.trim();

  // #rrggbb
  if (/^#?[0-9a-f]{6}$/i.test(str)) {
    const h = str.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }

  // rgb(r,g,b) ou "r, g, b"
  const m = str.match(/(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/);
  if (m) {
    const r = Math.min(255, +m[1]);
    const g = Math.min(255, +m[2]);
    const b = Math.min(255, +m[3]);
    return `${r},${g},${b}`;
  }

  return null;
}

/** Mapa reverso a partir do que você já definiu em UI_TO_RGB (se existir como array/string) */
const RGB_TO_UI: Record<string, UIToken> = (() => {
  const map: Record<string, UIToken> = {};
  (Object.keys(UI_TO_RGB) as UIToken[]).forEach((t) => {
    const v = UI_TO_RGB[t] as any;
    if (Array.isArray(v)) {
      map[`${v[0]},${v[1]},${v[2]}`] = t;
    } else if (typeof v === "string") {
      const key = parseColorToRGBKey(v);
      if (key) map[key] = t;
    }
  });
  return map;
})();

/** Converte qualquer entrada para um UIToken válido */
function toUIToken(x: AnyToken): UIToken {
  // já é um dos tokens UI?
  if (ORDER.includes(x as UIToken)) return x as UIToken;

  const s = String(x).trim().toUpperCase();

  // runtime letters R/G/B
  if (s === "R" || s === "G" || s === "B") {
    return RUNTIME_TO_UI[s] ?? "X";
  }

  // tenta cores (hex/rgb/r,g,b)
  const key = parseColorToRGBKey(s);
  if (key && RGB_TO_UI[key]) return RGB_TO_UI[key];

  // fallback
  return "X";
}

/* ==================== Componente ==================== */
type Props = {
  value: AnyToken[]; // 👈 agora tolera UI, R/G/B e cores
  onChange: (next: UIToken[]) => void;
  size?: number; // número de slots (default 8)
  showHint?: boolean; // mostra a dica esquerda→direita
  showIndex?: boolean; // mostra índice nos quadrados
};

export function PatternBuilder({
  value,
  onChange,
  size = 8,
  showHint = true,
  showIndex = false,
}: Props) {
  // normaliza para UI e garante exatamente `size` slots
  const v: UIToken[] = Array.from({ length: size }, (_, i) =>
    toUIToken(value?.[i] ?? "X"),
  );

  // grid responsivo sem depender de classes col-*
  const colCount = Math.min(Math.max(size, 1), 12); // 1..12
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: 8,
    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
  };

  function handleClick(e: MouseEvent, index: number) {
    e.preventDefault();
    const isShift = (e as any).shiftKey;
    const isRightClick = e.type === "contextmenu";

    const copy = v.slice();
    if (isRightClick) {
      // botão direito: limpa para X
      copy[index] = "X";
    } else if (isShift) {
      // SHIFT + clique: volta no ciclo
      copy[index] = prevToken(copy[index]);
    } else {
      // clique normal: avança no ciclo
      copy[index] = nextToken(copy[index]);
    }
    onChange(copy);
  }

  return (
    <div className="space-y-2">
      {showHint && (
        <div className="text-xs text-gray-500 select-none">{HINT}</div>
      )}

      <div style={gridStyle}>
        {v.map((t, i) => (
          <button
            key={i}
            onClick={(e) => handleClick(e, i)}
            onContextMenu={(e) => handleClick(e, i)}
            type="button"
            aria-label={`Posição ${i + 1}: ${t}`}
            className="h-8 rounded-md border flex items-center justify-center text-[10px] font-medium"
            title={`${t} (clique: próxima • Shift+clique: anterior • botão direito: limpar)`}
            style={{
              background:
                t === "A" ? "#3b82f6" : // azul
                t === "W" ? "#ffffff" : // branco
                t === "G" ? "#22c55e" : // verde
                t === "P" ? "#ec4899" : // rosa
                t === "K" ? "#111827" : // preto
                "#9ca3af", // cinza (X)
              color: t === "W" ? "#111827" : "#ffffff",
              borderColor: t === "W" ? "#e5e7eb" : "transparent",
            }}
          >
            {showIndex ? i + 1 : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========= Conversão UI (A/W/G/P/K/X) -> runtime RGB (R/G/B) =========
   Regra (coerente com teu matcher):
   - A (azul)   → "G"  (multiplicador alto é green no matcher)
   - W (branco) → "B"  (white == 1.00 mapeia pro 'B' do runtime)
   - G (verde)  → "G"
   - P (rosa)   → "R"  (baixa)
   - K (preto)  → "R"  (baixa <2x e não rosa)
   - X (cinza)  → "R"  (coringa neutro vira R para match)
*/
const FALLBACK_UI_TO_RGB: Record<UIToken, RGB> = {
  A: "G",
  W: "B",
  G: "G",
  P: "R",
  K: "R",
  X: "R",
};

// Util: converter a UI (6 cores) para o pattern runtime (RGB) na hora de SALVAR:
export function uiToRuntimePattern(ui: UIToken[]): RGB[] {
  return ui.map((t) => (UI_TO_RGB?.[t] as RGB | undefined) ?? FALLBACK_UI_TO_RGB[t]);
}
