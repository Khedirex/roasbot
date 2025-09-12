"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type StrategyMessages = {
  /** Mensagem que vai ser enviada caso haja a possibilidade de uma entrada */
  onOpportunity: string;
  /** Mensagem que vai ser enviada caso a possibilidade de uma entrada não aconteça */
  onNoOpportunity: string;
  /** Mensagem que vai ser enviada ao espelhar a estratégia */
  onMirror: string;
  /** Mensagem que será enviada ao dar WIN */
  onWin: string;
  /** Mensagem que será enviada ao dar RED */
  onRed: string;
  /** Mensagem que vai ser enviada caso precise usar martingale */
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

  /** opcional: desabilita os campos (somente leitura) */
  readOnly?: boolean;

  /** opcional: mostra botões Salvar/Restaurar */
  showActions?: boolean;

  /** handlers opcionais para os botões (se showActions=true) */
  onSave?: (current: StrategyMessages) => void;
  onReset?: () => StrategyMessages | void; // se retornar mensagens, usamos; senão, zera
};

/** Textarea estilizada sem depender de lib extra */
function TA({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength = 500,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}) {
  const len = value?.length ?? 0;
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className="w-full min-h-[84px] rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <div className="mt-1 text-xs text-gray-500">{len}/{maxLength}</div>
    </div>
  );
}

/**
 * Formulário de mensagens por estratégia.
 * Mantém-se puro/“controlado”: recebe `value` e devolve alterações via `onChange`.
 */
export default function StrategyMessagesForm({
  value,
  onChange,
  readOnly = false,
  showActions = false,
  onSave,
  onReset,
}: Props) {
  function patch<K extends keyof StrategyMessages>(key: K, v: StrategyMessages[K]) {
    onChange({ ...value, [key]: v });
  }

  function handleReset() {
    if (onReset) {
      const maybe = onReset();
      if (maybe) onChange(maybe);
      else onChange(emptyMessages());
    } else {
      onChange(emptyMessages());
    }
  }

  return (
    <div className="space-y-4">
      {/* grid 2 colunas em telas médias, 1 coluna no mobile */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Mensagem (possibilidade de entrada)</Label>
          <TA
            value={value.onOpportunity}
            onChange={(v) => patch("onOpportunity", v)}
            placeholder="Ex.: Possível entrada em breve. Aguardando confirmação…"
            disabled={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (não houve oportunidade)</Label>
          <TA
            value={value.onNoOpportunity}
            onChange={(v) => patch("onNoOpportunity", v)}
            placeholder="Ex.: Não houve oportunidade segura nesta janela."
            disabled={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (espelhar a estratégia)</Label>
          <TA
            value={value.onMirror}
            onChange={(v) => patch("onMirror", v)}
            placeholder="Ex.: Espelhando a estratégia agora…"
            disabled={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (WIN)</Label>
          <TA
            value={value.onWin}
            onChange={(v) => patch("onWin", v)}
            placeholder="Ex.: ✅ WIN! Seguimos para a próxima."
            disabled={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (RED)</Label>
          <TA
            value={value.onRed}
            onChange={(v) => patch("onRed", v)}
            placeholder="Ex.: ❌ RED nessa. Avaliando próxima oportunidade."
            disabled={readOnly}
          />
        </div>

        <div>
          <Label>Mensagem (usar martingale)</Label>
          <TA
            value={value.onMartingale}
            onChange={(v) => patch("onMartingale", v)}
            placeholder="Ex.: Aplicando martingale conforme configuração."
            disabled={readOnly}
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
            onClick={() => onSave?.(value)}
          >
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
