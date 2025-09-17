// components/StrategyMessagesForm.tsx
"use client";

import { useState } from "react";

type StrategyMsg = { pre?: string; win?: string; red?: string; mg?: string; noop?: string };
type Props = { strategyId: string; initialMessages?: StrategyMsg };

export default function StrategyMessagesForm({ strategyId, initialMessages }: Props) {
  const [pre,  setPre ] = useState(initialMessages?.pre  ?? "");
  const [win,  setWin ] = useState(initialMessages?.win  ?? "");
  const [red,  setRed ] = useState(initialMessages?.red  ?? "");
  const [mg,   setMg  ] = useState(initialMessages?.mg   ?? "");
  const [noop, setNoop] = useState(initialMessages?.noop ?? "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      await fetch(`/api/strategies/${strategyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: { pre, win, red, mg, noop } }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section>
        <label>Mensagem (possibilidade de entrada)</label>
        <textarea value={pre} onChange={e=>setPre(e.target.value)} rows={5} />
      </section>

      <section>
        <label>Mensagem (WIN)</label>
        <textarea value={win} onChange={e=>setWin(e.target.value)} rows={8} />
      </section>

      <section>
        <label>Mensagem (RED)</label>
        <textarea value={red} onChange={e=>setRed(e.target.value)} rows={5} />
      </section>

      <section>
        <label>Mensagem (usar martingale)</label>
        <textarea value={mg} onChange={e=>setMg(e.target.value)} rows={5} />
      </section>

      <section>
        <label>Mensagem (não houve oportunidade)</label>
        <textarea value={noop} onChange={e=>setNoop(e.target.value)} rows={3} />
      </section>

      <button onClick={onSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar mensagens"}
      </button>
    </div>
  );
}
