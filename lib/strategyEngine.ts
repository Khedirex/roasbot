// lib/strategyEngine.ts
import { PrismaClient, Strategy } from "@prisma/client";
const prisma = new PrismaClient();

export type EventRow = {
  id: string;
  robotId: string;    // Robot.id (cuid string)
  mult: number;
  createdAt: Date;
  ts: bigint;
};

// janela: startHour/endHour são strings "HH:mm" no seu schema
function withinWindow(s: Strategy, now = new Date()): boolean {
  if (!s.startHour && !s.endHour) return true;
  const cur = now.toTimeString().slice(0, 5); // "HH:MM"
  if (s.startHour && cur < s.startHour) return false;
  if (s.endHour && cur > s.endHour) return false;
  return true;
}

// Estado (tail) é por Strategy.id (não por pattern)
async function getTail(strategyId: string) {
  const st = await prisma.strategyState.upsert({
    where: { strategyId },
    update: {},
    create: { strategyId, tail: 0, lastTs: BigInt(0) },
  });
  return st.tail;
}

async function setTail(strategyId: string, tail: number) {
  await prisma.strategyState.update({
    where: { strategyId },
    data: { tail },
  });
}


export async function processEvent(ev: EventRow) {
  // carrega SOMENTE estratégias ativas do robot
  const strategies = await prisma.strategy.findMany({
    where: { robotId: ev.robotId, enabled: true, active: true }
  });

  const stratsAll = await prisma.strategy.findMany({ where: { robotId: ev.robotId } });
  const strats    = stratsAll.filter(s => s.enabled); // <--

  const now = new Date();
  const preToSend: Array<{ s: Strategy; tail: number }> = [];
  const confToSend: Array<{ s: Strategy; tail: number }> = [];

  for (const s of strategies) {
    if (!withinWindow(s, now)) continue;

    // Exemplo de regra: "low-mults" (< 2.0)
    const pattern = Array.isArray(s.pattern) ? "pattern-list" : "low-mults"; // você pode ler do Json se quiser
    // Se você usa "low-mults" mesmo, defina pattern por chave no s.pattern JSON.

    if (pattern === "low-mults") {
      let tail = await getTail(s.id);
      tail = ev.mult < 2.0 ? tail + 1 : 0;
      await setTail(s.id, tail);

      // >>> ATENÇÃO: seu schema usa winAt, não "need"
      const need = Math.max(1, s.winAt ?? 1);

      if (tail === Math.max(1, need - 1)) preToSend.push({ s, tail });
      if (tail === need) confToSend.push({ s, tail }); // dispara só na “cruzada” do alvo
    }

    // TODO: implemente aqui outros padrões lendo de s.pattern (Json)
  }

  return { preToSend, confToSend };
}

export function renderMessage(
  kind: "pre" | "confirm",
  s: Strategy,
  ctx: { mult: number; tail: number },
) {
  // Seu schema tem winAt (não "need")
  const need = Math.max(1, s.winAt ?? 1);

  // Se quiser um texto de ação configurável, pegue de messages (JSON):
  // ex.: { "action": "entry 2.5x" }
  const msgs = (s.messages as any) || {};
  const actionTxt = (typeof msgs.action === "string" ? msgs.action : undefined) ?? "entry";

  // Defaults
  const defPre  =
    `[PRE] ${s.name}: ${ctx.tail} seguidos <2.0. Falta 1 p/ ${need}. Ação: ${actionTxt}`;
  const defConf =
    `[CONFIRMADO] ${s.name}: ${need} seguidos <2.0. Último mult ${ctx.mult.toFixed(2)}x. Ação: ${actionTxt}`;

  // Se você usa templates em messages, por ex.:
  // { "pre": "... {need} ... {mult} ... {tail} ... {action} ... {name} ...",
  //   "confirm": "..." }
  const tplPre  = (typeof msgs.pre === "string" ? msgs.pre : undefined)?.trim();
  const tplConf = (typeof msgs.confirm === "string" ? msgs.confirm : undefined)?.trim();

  const tpl = kind === "pre" ? (tplPre ?? defPre) : (tplConf ?? defConf);
  

  return tpl
    .replace(/{need}/g, String(need))
    .replace(/{mult}/g, `${ctx.mult.toFixed(2)}x`)
    .replace(/{tail}/g, String(ctx.tail))
    .replace(/{action}/g, actionTxt)
    .replace(/{name}/g, s.name);
}

