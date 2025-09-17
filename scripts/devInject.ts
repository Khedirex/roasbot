// scripts/devInject.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const robot = await prisma.robot.findFirst({ where: { enabled: true } });
  if (!robot) { console.error("Nenhum Robot enabled encontrado"); process.exit(1); }

  const GAME = robot.game;
  const CASA = robot.casa;
  console.log("Injetando para", { GAME, CASA, robotId: robot.id });

  const now = Date.now();
  const seq = [3.20, 1.80, 1.65, 1.55]; // breaker + 3 baixas

  for (let i = 0; i < seq.length; i++) {
    const ts = BigInt(now + i * 1000);
    await prisma.ingestEvent.create({
      data: { game: GAME, casa: CASA, value: seq[i], ts, ip: null, userAgent: null }
    });
    console.log(`Inserido: ${seq[i]} (ts=${ts})`);
  }
}
main().finally(() => prisma.$disconnect());
