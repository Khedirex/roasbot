// scripts/makeStrategy.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // usa o primeiro robot enabled (ou passe ROBOT_ID no env)
  const ROBOT_ID = process.env.ROBOT_ID || null;
  const robot = ROBOT_ID
    ? await prisma.robot.findUnique({ where: { id: ROBOT_ID } })
    : await prisma.robot.findFirst({ where: { enabled: true } });

  if (!robot) {
    console.error('Nenhum Robot enabled encontrado.');
    process.exit(1);
  }
  console.log('Criando estratégia para robot:', { id: robot.id, game: robot.game, casa: robot.casa });

  const strat = await prisma.strategy.create({
    data: {
      robotId: robot.id,
      name: 'LowMults 3x',
      active: true,
      startHour: '00:00',
      endHour: '23:59',
      // você guarda pattern em JSON; aqui deixamos um marcador simples
      pattern: { mode: 'low-mults' },
      winAt: 3,
      mgCount: 0,
      messages: {
        action: 'entry 2.5x',
        pre: '[PRE] {name}: {tail} seguidas <2.0. Falta 1 p/ {need}. Ação: {action}',
        confirm: '[CONFIRMADO] {name}: {need} seguidas <2.0. Último mult {mult}. Ação: {action}'
      }
    }
  });

  console.log('Estratégia criada:', { id: strat.id, name: strat.name, winAt: strat.winAt });
}

main().finally(() => prisma.$disconnect());
