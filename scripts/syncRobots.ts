import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function envKey(s: string) { return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

async function main() {
  const pairs = await prisma.ingestEvent.groupBy({ by: ['game','casa'] });
  if (!pairs.length) {
    console.log('Nenhum IngestEvent encontrado.');
    return;
  }

  for (const { game, casa } of pairs) {
    const existing = await prisma.robot.findFirst({ where: { game, casa } });

    const BOT_TOKEN = process.env[`TELEGRAM_BOT_TOKEN__${envKey(game)}__${envKey(casa)}`]
      || process.env.TELEGRAM_BOT_TOKEN || null;
    const CHAT_ID   = process.env[`TELEGRAM_CHAT_ID__${envKey(game)}__${envKey(casa)}`]
      || process.env.TELEGRAM_CHAT_ID   || null;

    if (existing) {
      await prisma.robot.update({
        where: { id: existing.id },
        data: { enabled: true, ...(BOT_TOKEN?{botToken:BOT_TOKEN}:{}) , ...(CHAT_ID?{chatId:CHAT_ID}:{}) }
      });
      console.log(`Robot OK: ${existing.name} (${game}/${casa})`);
    } else {
      const created = await prisma.robot.create({
        data: { game, casa, name: `${game}/${casa}`, enabled: true, botToken: BOT_TOKEN, chatId: CHAT_ID }
      });
      console.log(`Robot criado: ${created.name} (${game}/${casa})`);
    }
  }
}
main().finally(()=>prisma.$disconnect());
