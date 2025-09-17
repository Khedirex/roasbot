// scripts/diag.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const robots = await prisma.robot.findMany({ where: { enabled: true } });
  console.log("ROBOTS:", robots.map(r => ({ id: r.id, game: r.game, casa: r.casa, enabled: r.enabled })));

  for (const r of robots) {
    const strats = await prisma.strategy.findMany({ where: { robotId: r.id, active: true } });
    console.log(`STRATS do robot ${r.id}:`, strats.map(s => ({
      id: s.id, name: s.name, winAt: s.winAt, startHour: s.startHour, endHour: s.endHour
    })));
    const lastEv = await prisma.ingestEvent.findMany({
      where: { game: r.game, casa: r.casa },
      orderBy: { ts: 'desc' }, take: 5
    });
    console.log(`ULTIMOS IngestEvent para ${r.game}/${r.casa}:`, lastEv.map(e => ({ id: e.id, value: e.value, ts: e.ts })));
    const cur = await prisma.signalCursor.findUnique({ where: { robotId: r.id } });
    console.log(`CURSOR do robot ${r.id}:`, cur);
  }
}
run().finally(()=>process.exit());
