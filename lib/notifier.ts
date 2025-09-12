// lib/notifier.ts
"use client";

import type { StrategyMessages, MessageContext } from "@/lib/messageTemplate";

/** Decide qual template usar a partir do tipo */
export type MessageKind = "opportunity" | "noopportunity" | "mirror" | "win" | "red" | "martingale";

export function pickTemplate(msgs: StrategyMessages, kind: MessageKind) {
  switch (kind) {
    case "opportunity":   return msgs.onOpportunity || "Oportunidade detectada.";
    case "noopportunity": return msgs.onNoOpportunity || "Não houve oportunidade.";
    case "mirror":        return msgs.onMirror || "Espelhando a estratégia.";
    case "win":           return msgs.onWin || "✅ WIN [TIPO_GREEN_MAIUSCULO] — [NOME_ESTRATEGIA]";
    case "red":           return msgs.onRed || "❌ RED — [NOME_ESTRATEGIA]";
    case "martingale":    return msgs.onMartingale || "Aplicando martingale.";
  }
}

/** Renderiza no servidor e retorna texto final */
export async function renderServer(template: string, ctx: MessageContext): Promise<string> {
  const r = await fetch("/api/messages/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template, ctx }),
  });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "render_failed");
  return j.text as string;
}

/** Envia para o Telegram via rota do servidor */
export async function sendTelegram(botToken: string, chatId: string, text: string) {
  const r = await fetch("/api/send/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ botToken, chatId, text }),
  });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "send_failed");
  return j.result;
}

/** Fluxo completo: escolhe template, renderiza e envia */
export async function notify(kind: MessageKind, params: {
  msgs: StrategyMessages;
  ctx: MessageContext;
  botToken: string;
  chatId: string;
}) {
  const template = pickTemplate(params.msgs, kind);
  const text = await renderServer(template, params.ctx);
  return await sendTelegram(params.botToken, params.chatId, text);
}
