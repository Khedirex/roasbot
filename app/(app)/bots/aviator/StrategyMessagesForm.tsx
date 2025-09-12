"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type StrategyMessages = {
  onOpportunity: string;
  onNoOpportunity: string;
  onMirror: string;
  onWin: string;
  onRed: string;
  onMartingale: string;
};

export function emptyMessages(): StrategyMessages {
  return {
    onOpportunity: "",
    onNoOpportunity: "",
    onMirror: "",
    onWin: "",
    onRed: "",
    onMartingale: "",
  };
}

type Props = {
  value: StrategyMessages;
  onChange: (next: StrategyMessages) => void;
  /** se true, só leitura (mas sem bloquear foco/clique) */
  readOnly?: boolean;
  /** mostra botões Salvar/Restaurar */
  showActions?: boolean;
  onSave?: (current: StrategyMessages) => void;
  /** se retornar mensagens, usa; se não, zera */
  onReset?: () => StrategyMessages | void;
};

/** Textarea que ignora bloqueios de pointer-events do pai */
function TA({
  value,
  onChange,
  placeholder,
  readOnly = false,
  maxLength = 500,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
}) {
  const len = value?.length ?? 0;
  return (
    <div style={{ pointerEvents: "auto" }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        aria-readonly={readOnly}
        className={[
          "w-full min-h-[84px] rounded-lg border px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          "!pointer-events-auto",
          readOnly ? "bg-gray-50 text-gray-600" : "bg-white",
        ].join(" ")}
      />
      <div className="mt-1 text-xs text-gray-500">{len}/{maxLength}</div>
    </div>
  );
}

/**
 * Formulário de mensagens por estratégia.
 * Resiliente: mantém estado local espelho + propaga onChange.
 */
export default function StrategyMessagesForm({
  value,
  onChange,
  readOnly = false,
  showActions = false,
  onSave,
  onReset,
}: Props) {
  // ---- estado local espelho (mostra digitação mesmo se o pai não atualizar) ----
  const [local, setLocal] = React.useState<StrategyMessages>(value);

  // sincroniza quando o pai mudar (deep compare leve)
  React.useEffect(() => {
    const a = JSON.stringify(local);
    const b = JSON.stringify(value);
    if (a !== b) setLocal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  function patch<K extends keyof StrategyMessages>(key: K, v: StrategyMessages[K]) {
    setLocal((prev) => {
      const next = { ...prev, [key]: v };
      // propaga para o pai; se ele ignorar, o local ainda mantém o que o usuário digitou
      try { onChange(next); } catch {}
      return next;
    });
  }

  function handleReset() {
    const next = onReset ? onReset() || emptyMessages() : emptyMessages();
    setLocal(next);
    onChange(next);
  }

  return (
    <div
      className="space-y-4"
      // força clique/digitação mesmo se um ancestral tiver pointer-events:none
      style={{ pointerEvents: "auto" }}
      // e evita que overlays de grupo “capturem” o evento
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {/* grid 2 colunas em telas médias, 1 coluna no mobile */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Mensagem (possibilidade de entrada)</Label>
          <TA
            value={local.onOpportunity}
            onChange={(v) => patch("onOpportunity", v)}
            placeholder="Ex.: Possível entrada em breve. Aguardando confirmação…"
            readOnly={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (não houve oportunidade)</Label>
          <TA
            value={local.onNoOpportunity}
            onChange={(v) => patch("onNoOpportunity", v)}
            placeholder="Ex.: Não houve oportunidade segura nesta janela."
            readOnly={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (espelhar a estratégia)</Label>
          <TA
            value={local.onMirror}
            onChange={(v) => patch("onMirror", v)}
            placeholder="Ex.: Espelhando a estratégia agora…"
            readOnly={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (WIN)</Label>
          <TA
            value={local.onWin}
            onChange={(v) => patch("onWin", v)}
            placeholder="Ex.: ✅ WIN! Seguimos para a próxima."
            readOnly={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (RED)</Label>
          <TA
            value={local.onRed}
            onChange={(v) => patch("onRed", v)}
            placeholder="Ex.: ❌ RED nessa. Avaliando próxima oportunidade."
            readOnly={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (usar martingale)</Label>
          <TA
            value={local.onMartingale}
            onChange={(v) => patch("onMartingale", v)}
            placeholder="Ex.: Aplicando martingale conforme configuração."
            readOnly={readOnly}
          />
        </div>
      </div>

      {showActions && !readOnly && (
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" className="border" onClick={handleReset}>
            Restaurar padrão
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onSave?.(local)}
          >
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
