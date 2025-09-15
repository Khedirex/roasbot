"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StrategyMessagesForm, {
  emptyMessages,
  type StrategyMessages,
} from "./StrategyMessagesForm";

/** ---- Tipos expostos para o RobotManager ---- */
export type Color = "green" | "gray" | "black" | "red" | "blue" | "pink";

export type Strategy = {
  id: string;
  name: string;
  startHour: string; // "HH:mm"
  endHour: string;   // "HH:mm"
  mgCount: number;
  enabled: boolean;
  pattern: Color[];
  winAt: number;
  /** NOVO: mensagens configuráveis por estratégia */
  messages?: StrategyMessages;
};

type Props = {
  bot: string;
  casa: string;
  robotId: string;

  /** lista existente */
  strategies: Strategy[];

  /** cria uma nova estratégia (a partir do rascunho) */
  onCreate?: () => void;

  /** altera a lista existente (edições inline nos cards de baixo) */
  onChange: (next: Strategy[]) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, value: boolean) => void;

  /** retorna informações para o status (ex.: contagem de ativas) */
  onSummaryChange?: (summary: { active: number }) => void;

  /** ação externa para limpar o rascunho */
  clearSignal?: number; // sempre que mudar, o rascunho é resetado

  /** controla exibição do editor de criação */
  hideEditor?: boolean;

  /** mostra botão “Fechar criação” entre editor e lista */
  showCloseButton?: boolean;

  /** callback do botão “Fechar criação” */
  onCloseEditor?: () => void;
};

/** paleta usada pelos slots */
const COLORS: Color[] = ["green", "gray", "black", "red", "blue", "pink"];

function swatch(c: Color) {
  switch (c) {
    case "green": return "#22c55e";
    case "gray":  return "#9ca3af";
    case "black": return "#111827";
    case "red":   return "#ef4444";
    case "blue":  return "#3b82f6";
    case "pink":  return "#ec4899";
  }
}

function nextColor(c: Color): Color {
  const idx = COLORS.indexOf(c);
  const next = (idx + 1) % COLORS.length;
  return COLORS[next];
}

function defaultPattern(len = 12): Color[] {
  return Array.from({ length: len }, () => "gray");
}

// Nome padrão agora é "Nova estratégia"
function emptyDraft(nowName = "Nova estratégia"): Strategy {
  return {
    id: crypto.randomUUID(),
    name: nowName,
    startHour: "09:00",
    endHour: "18:00",
    mgCount: 0,
    enabled: true,
    pattern: defaultPattern(),
    winAt: 2,
    // messages não é necessário no rascunho
  };
}

/** ============================== */
export function StrategiesPanel({
  bot,
  casa,
  robotId,
  strategies,
  onCreate,
  onChange,
  onDuplicate,
  onDelete,
  onToggle,
  onSummaryChange,
  clearSignal,
  hideEditor,
  showCloseButton,
  onCloseEditor,
}: Props) {
  /** RASCUNHO local (não salvo até clicar em “Criar”) */
  const [draft, setDraft] = useState<Strategy>(() => emptyDraft("Nova estratégia"));

  /** controla abrir/fechar a área de mensagens por estratégia */
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set());

  // limpa rascunho quando clearSignal muda (vindo do pai)
  useEffect(() => {
    setDraft(emptyDraft("Nova estratégia"));
  }, [clearSignal]);

  const enabledCount = useMemo(
    () => strategies.filter((s) => s.enabled).length,
    [strategies]
  );

  useEffect(() => {
    onSummaryChange?.({ active: enabledCount });
  }, [enabledCount, onSummaryChange]);

  function setPatternSlot(idx: number, color: Color) {
    const pattern = [...draft.pattern];
    pattern[idx] = color;
    setDraft({ ...draft, pattern });
  }

  function cycleSlot(idx: number) {
    const next = nextColor(draft.pattern[idx]);
    setPatternSlot(idx, next);
  }

  // Botão "Limpar" -> zera o formulário e DEIXA O NOME EM BRANCO
  function handleClear() {
    setDraft(emptyDraft(""));     // nome vazio
    onCreate?.();                 // opcional: notifica o pai
  }

  // "Criar" -> adiciona o draft na lista e depois limpa (nome em branco)
  function createFromDraft() {
    if (!draft.name?.trim()) {
      alert("Dê um nome para a estratégia.");
      return;
    }
    const toCreate: Strategy = { ...draft, id: crypto.randomUUID() };
    const nextList = [...strategies, toCreate];
    onChange(nextList);          // pai persiste
    setDraft(emptyDraft(""));    // nome vazio após criar
  }

  function toggleOpenMessages(id: string) {
    setOpenMessages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** helper para atualizar um item específico da lista */
  function patchStrategy(id: string, patch: Partial<Strategy>) {
    onChange(
      strategies.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== Editor (RASCUNHO) — aparece somente se hideEditor !== true ===== */}
      {!hideEditor && (
        <Card className="border-2">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              Adicionar nova estratégia
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="bg-orange-400 hover:bg-orange-500 text-white"
                onClick={handleClear}
              >
                Limpar
              </Button>

              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={createFromDraft}
              >
                Criar
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Nova estratégia"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={draft.startHour}
                  onChange={(e) =>
                    setDraft({ ...draft, startHour: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={draft.endHour}
                  onChange={(e) =>
                    setDraft({ ...draft, endHour: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Ativa</span>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                />
              </div>
            </div>

            {/* Padrão */}
            <div className="space-y-2">
              <Label>Monte sua estratégia (clique nos slots para alternar a cor)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.pattern.map((c, i) => (
                  <button
                    key={i}
                    className="h-7 w-7 rounded border"
                    style={{ background: swatch(c) }}
                    onClick={() => cycleSlot(i)}
                  />
                ))}
              </div>
            </div>

            {/* Vitória & Martingale lado a lado */}
            <div className="grid grid-cols-2 gap-4 w-full md:w-96">
              <div>
                <Label>Vitória em</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.5}
                  value={draft.winAt}
                  onChange={(e) =>
                    setDraft({ ...draft, winAt: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Martingale (qtd.)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.mgCount}
                  onChange={(e) =>
                    setDraft({ ...draft, mgCount: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Estratégias ativas: <b>{enabledCount}</b>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão “Fechar criação” imediatamente ANTES da lista */}
      {!hideEditor && showCloseButton && (
        <div className="flex justify-end -mt-4">
          <button
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            onClick={onCloseEditor}
          >
            Fechar criação
          </button>
        </div>
      )}

      {/* ===== Lista existente (uma abaixo da outra) ===== */}
      <div className="space-y-4">
        {strategies.map((s) => {
          const isOpen = openMessages.has(s.id);

          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">{s.name}</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Ativa</span>
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(v) => onToggle(s.id, v)}
                  />
                  <Button variant="secondary" onClick={() => onDuplicate(s.id)}>
                    Duplicar
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete(s.id)}>
                    Excluir
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {/* Ações de mensagens — logo abaixo de duplicar/excluir */}
                <div className="mb-1">
                  <Button
                    variant="secondary"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700"
                    onClick={() => toggleOpenMessages(s.id)}
                  >
                    {isOpen ? "Ocultar mensagens" : "Adicionar mensagens"}
                  </Button>
                </div>

                {isOpen && (
                  <div className="rounded-lg border p-3 bg-gray-50">
                    <StrategyMessagesForm
                      value={s.messages ?? emptyMessages()}
                      onChange={(msgs) => patchStrategy(s.id, { messages: msgs })}
                    />
                  </div>
                )}

                {/* Linha 1: Nome / Início / Fim */}
                <div className="grid md:grid-cols-4 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={s.name}
                      onChange={(e) => patchStrategy(s.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={s.startHour}
                      onChange={(e) => patchStrategy(s.id, { startHour: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input
                      type="time"
                      value={s.endHour}
                      onChange={(e) => patchStrategy(s.id, { endHour: e.target.value })}
                    />
                  </div>
                </div>

                {/* Padrão */}
                <div>
                  <Label>Monte sua estratégia (clique nos slots para alternar a cor)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.pattern.map((c, i) => (
                      <button
                        key={i}
                        className="h-6 w-6 rounded border"
                        style={{ background: swatch(c) }}
                        onClick={() => {
                          const pattern = [...s.pattern];
                          pattern[i] = nextColor(c);
                          patchStrategy(s.id, { pattern });
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Vitória & Martingale lado a lado */}
                <div className="grid grid-cols-2 gap-4 w-full md:w-96">
                  <div>
                    <Label>Vitória em</Label>
                    <Input
                      type="number"
                      min={1}
                      step={0.5}
                      value={s.winAt}
                      onChange={(e) =>
                        patchStrategy(s.id, { winAt: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Martingale (qtd.)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={s.mgCount}
                      onChange={(e) =>
                        patchStrategy(s.id, { mgCount: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
