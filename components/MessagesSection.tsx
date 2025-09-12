"use client";

import { useEffect, useMemo, useState } from "react";
import StrategyMessagesForm, {
  type StrategyMessages,
  emptyMessages,
} from "@/app/(app)/bots/aviator/StrategyMessagesForm";
import { Button } from "@/components/ui/button";

function keyFor(botId: string, strategyId: string) {
  return `roasbot:strategy:msgs:${botId}:${strategyId}`;
}

function loadMsgs(botId: string, strategyId: string): StrategyMessages | null {
  try {
    const raw = localStorage.getItem(keyFor(botId, strategyId));
    return raw ? (JSON.parse(raw) as StrategyMessages) : null;
  } catch {
    return null;
  }
}

function saveMsgs(botId: string, strategyId: string, msgs: StrategyMessages) {
  try {
    localStorage.setItem(keyFor(botId, strategyId), JSON.stringify(msgs));
  } catch {}
}

export default function MessagesSection({
  botId,
  strategyId,
  initial = emptyMessages(),
  readOnly = false,
}: {
  botId: string;
  strategyId: string;
  initial?: StrategyMessages;   // vindo do DB, se tiver
  readOnly?: boolean;
}) {
  // carrega do storage 1x (senão cai no initial)
  const initialMsgs = useMemo(() => {
    return loadMsgs(botId, strategyId) ?? initial ?? emptyMessages();
  }, [botId, strategyId, initial]);

  const [msgs, setMsgs] = useState<StrategyMessages>(initialMsgs);
  const [show, setShow] = useState(true); // controla visibilidade sem desmontar

  // autosave com debounce
  useEffect(() => {
    const t = setTimeout(() => saveMsgs(botId, strategyId, msgs), 400);
    return () => clearTimeout(t);
  }, [botId, strategyId, msgs]);

  // se mudar de robô/estratégia, sincroniza
  useEffect(() => {
    setMsgs(loadMsgs(botId, strategyId) ?? initial ?? emptyMessages());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, strategyId]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Mensagens</h3>
        <div className="flex gap-2">
          <Button variant="secondary" className="border" onClick={() => setShow((s) => !s)}>
            {show ? "Ocultar mensagens" : "Mostrar mensagens"}
          </Button>
        </div>
      </div>

      {/* ⚠️ Não use `show && <Form/>` — isso desmonta. */}
      <div className={show ? "" : "hidden"}>
        <StrategyMessagesForm
          value={msgs}
          onChange={setMsgs}     // mantém espelho local + propaga
          readOnly={readOnly}
          showActions={false}    // autosave já garante persistência
        />
      </div>
    </section>
  );
}
