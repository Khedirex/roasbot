import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const robots = await prisma.robot.findMany({ where: { enabled: true } });
  for (const r of robots) {
    const tEntry = await prisma.telegramTarget.findFirst({
      where: { casa: r.casa, kind: 'entry', active: true, OR: [{ game: r.game }, { game: null }] },
      orderBy: [{ game: 'desc' }, { updatedAt: 'desc' }]
    });
    const tWin = await prisma.telegramTarget.findFirst({
      where: { casa: r.casa, kind: 'win', active: true, OR: [{ game: r.game }, { game: null }] },
      orderBy: [{ game: 'desc' }, { updatedAt: 'desc' }]
    });

    const envToken = process.env.TELEGRAM_BOT_TOKEN || process.env.AUTO_TG_BOT_TOKEN || "";
    const envChat  = process.env.TELEGRAM_CHAT_ID   || process.env.AUTO_TG_CHAT_ID   || "";

    console.log(
      `Robot ${r.name} (${r.game}/${r.casa}) -> entry:`,
      tEntry?.chatId || r.chatId || envChat,
      'win:',
      tWin?.chatId   || r.chatId || envChat
    );
  }
}
run().finally(() => process.exit());
