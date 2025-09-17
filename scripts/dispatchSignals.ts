// scripts/dispatchSignals.ts
import { PrismaClient, Robot } from "@prisma/client";
import { processEvent, renderMessage } from "../lib/strategyEngine";

const prisma = new PrismaClient();

// ========= TelegramTarget routing =========
type FireKind = "pre" | "confirm";

// mapeia tipo interno -> kind da tabela TelegramTarget
function ttKind(kind: FireKind) {
  // ajuste se seus valores forem diferentes
  return kind === "pre" ? "entry" : "win";
}

/**
 * Resolve a "box" (TelegramTarget) para este robot e tipo de sinal.
 * Preferência: (game+casa) ativa mais recente → (casa genérica) ativa → fallback robot → fallback .env
 */
async function resolveChannel(robot: Robot, kind: FireKind) {
  const wanted = ttKind(kind);
  const target = await prisma.telegramTarget.findFirst({
    where: {
      casa: robot.casa,
      kind: wanted as any, // ajuste o tipo se seu schema enumar
      active: true,
      OR: [{ game: robot.game }, { game: null }],
    },
    orderBy: [{ game: "desc" }, { updatedAt: "desc" }],
  });

  const token =
    target?.botToken ||
    robot.botToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.AUTO_TG_BOT_TOKEN ||
    "";
  const chat =
    target?.chatId ||
    robot.chatId ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.AUTO_TG_CHAT_ID ||
    "";

  const can = !!token && !!chat;
  return { token, chat, can, target };
}

// Fallbacks globais (avisamos se faltar)
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.AUTO_TG_BOT_TOKEN || "";
const TG_CHATID = process.env.TELEGRAM_CHAT_ID || process.env.AUTO_TG_CHAT_ID || "";
if (!TG_TOKEN || !TG_CHATID) {
  console.warn("Aviso: faltam TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no .env; vou tentar usar os do Robot.");
}

async function sendTelegram(text: string, token: string, chatId: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!r.ok) {
    console.error("Falha Telegram:", await r.text());
  }
}

function parseMult(raw: any): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return parseFloat(raw.replace(",", "."));
  return 0;
}

/** Lê eventos novos do IngestEvent para UM robot específico (game + casa) */
async function getNextEventsForRobot(robot: Robot, limit = 200) {
  // Cursor é por robotId (string)
  const cursor = await prisma.signalCursor.upsert({
    where: { robotId: robot.id },
    update: {},
    create: { robotId: robot.id, lastTs: BigInt(0), lastId: null },
  });

  const rows = await prisma.ingestEvent.findMany({
    where: { game: robot.game, casa: robot.casa, ts: { gt: cursor.lastTs } },
    orderBy: { ts: "asc" },
    take: limit,
  });

  // Mapeia para EventRow do engine
  return rows.map((r) => ({
    id: r.id,
    robotId: robot.id,
    mult: parseMult(r.value),
    createdAt: r.createdAt,
    ts: r.ts, // BigInt
  }));
}

async function updateCursor(robotId: string, lastTs: bigint, lastId: string) {
  await prisma.signalCursor.update({ where: { robotId }, data: { lastTs, lastId } });
}

async function alreadySent(dedupeKey: string) {
  const x = await prisma.signalDispatch.findUnique({ where: { dedupeKey } });
  return !!x;
}

async function logSent(d: {
  robotId: string;
  strategyId: string;
  kind: "pre" | "confirm";
  tail: number;
  eventId: string;
}) {
  const dedupeKey = `${d.eventId}:${d.strategyId}:${d.kind}:${d.tail}`;
  await prisma.signalDispatch.create({ data: { ...d, dedupeKey } });
}

async function mainLoop() {
  console.log("Worker de sinais iniciado…");

  while (true) {
    try {
      // 1) pega todos os robots habilitados
      const robots = await prisma.robot.findMany({ where: { enabled: true } });

      for (const robot of robots) {
        const events = await getNextEventsForRobot(robot);
        if (events.length === 0) continue;

        // checagem de fallback por robot/.env (mensagem 1x por robot)
        const canDefaults = !!(robot.botToken || TG_TOKEN) && !!(robot.chatId || TG_CHATID);
        if (!canDefaults) {
          console.warn(
            `Sem token/chat para robot ${robot.id} (${robot.game}/${robot.casa}). ` +
              `Pulando envios até configurar botToken/chatId ou TELEGRAM_* no .env.`
          );
        }

        for (const ev of events) {
          // 2) processa conforme estratégias ATIVAS desse robot
          const { preToSend, confToSend } = await processEvent(ev);

          // 3) envia PRE
          for (const item of preToSend) {
            const dedupeKey = `${ev.id}:${item.s.id}:pre:${item.tail}`;
            if (await alreadySent(dedupeKey)) continue;

            const msg = renderMessage("pre", item.s, { mult: ev.mult, tail: item.tail });

            const ch = await resolveChannel(robot, "pre"); // usa TelegramTarget(kind='entry') se existir
            if (ch.can) {
              await sendTelegram(msg, ch.token!, String(ch.chat!));
            } else {
              console.warn(`PRE sem canal resolvido para robot ${robot.id}`);
            }

            await logSent({
              robotId: robot.id,
              strategyId: item.s.id,
              kind: "pre",
              tail: item.tail,
              eventId: ev.id,
            });
          }

          // 4) envia CONFIRM
          for (const item of confToSend) {
            const dedupeKey = `${ev.id}:${item.s.id}:confirm:${item.tail}`;
            if (await alreadySent(dedupeKey)) continue;

            const msg = renderMessage("confirm", item.s, { mult: ev.mult, tail: item.tail });

            const ch = await resolveChannel(robot, "confirm"); // usa TelegramTarget(kind='win') se existir
            if (ch.can) {
              await sendTelegram(msg, ch.token!, String(ch.chat!));
            } else {
              console.warn(`CONFIRM sem canal resolvido para robot ${robot.id}`);
            }

            await logSent({
              robotId: robot.id,
              strategyId: item.s.id,
              kind: "confirm",
              tail: item.tail,
              eventId: ev.id,
            });
          }

          // 5) move cursor desse robot
          await updateCursor(robot.id, ev.ts as bigint, ev.id);
        }
      }
    } catch (e) {
      console.error("Loop error:", e);
    }

    // ~1Hz
    await new Promise((r) => setTimeout(r, 800));
  }
}

mainLoop();