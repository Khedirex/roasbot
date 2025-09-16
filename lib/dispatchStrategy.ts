// lib/dispatchStrategy.ts
import { _debugSnapshot, type Strategy } from "@/lib/strategies";
import { renderTemplate } from "@/lib/messageRenderer";
import { sendTelegram, defaultBotToken, defaultChatId } from "@/lib/telegram";

export type StrategyEvent =
  | "pre_entry"
  | "no_opportunity"
  | "entry"
  | "gale"
  | "win"
  | "red";

/** Resolver local: encontra a Strategy pelo id varrendo o store (via _debugSnapshot). */
function findStrategyById(strategyId: string): Strategy | null {
  const snap = _debugSnapshot(); // Record<BotId, Strategy[]>
  for (const arr of Object.values(snap)) {
    const found = (arr || []).find((s) => s.id === strategyId);
    if (found) return found;
  }
  return null;
}

export async function dispatchStrategyMessage({
  strategyId,
  event,
  vars,
  overrideTargets,
}: {
  strategyId: string;
  event: StrategyEvent;
  vars: Record<string, string | number | undefined>;
  overrideTargets?: Array<{ chatId: string | number; botToken?: string }>;
}) {
  // 🔎 pega a strategy do store em memória
  const strategy = findStrategyById(strategyId);
  if (!strategy || !strategy.enabled) {
    throw new Error("Strategy not found or disabled");
  }

  // ✅ Usa mgCount como MAX_GALES; permite sobrescrever via vars.MAX_GALES
  const MAX_GALES = Number((strategy as any).mgCount ?? vars.MAX_GALES ?? 0);
  const GALE_ATUAL = Number(vars.GALE_ATUAL ?? 0);

  // ✅ messages sempre objeto (evita undefined)
  const msg = (strategy as any).messages ?? {};

  // Escolha do template conforme o evento
  const tpl =
    event === "pre_entry"      ? msg.preEntry :
    event === "no_opportunity" ? msg.noOpportunity :
    event === "entry"          ? msg.entry :
    event === "gale"           ? (GALE_ATUAL >= 2 ? msg.galeG2 : msg.galeG1) :
    event === "win"            ? msg.win :
    event === "red"            ? msg.red :
    "";

  // Variáveis padrão (não sobrescreve as recebidas)
  const filledVars = {
    MAX_GALES: MAX_GALES,
    ...vars,
  };

  const { text, parseMode } = renderTemplate(tpl, filledVars);
  if (!text || !text.trim()) {
    return { ok: true, skipped: true, reason: "empty_template" as const };
  }

  // Alvos (override > por estratégia > defaults .env)
  const targets =
    overrideTargets?.length
      ? overrideTargets
      : (strategy as any).targets?.length
        ? (strategy as any).targets
        : [{ chatId: defaultChatId(), botToken: defaultBotToken() }];

  // Envio
  for (const t of targets as Array<{ chatId: string | number; botToken?: string }>) {
    const token = (t.botToken || defaultBotToken()).trim();
    const chat = t.chatId;
    if (!token || chat === undefined || chat === null || chat === "") continue;

    await sendTelegram({
      botToken: token,
      chatId: chat,
      text,
      parseMode,
    });
  }

  return { ok: true };
}
