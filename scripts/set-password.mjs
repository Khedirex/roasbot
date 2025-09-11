import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function arg(name) {
  const raw = process.argv.find(a => a.startsWith(`--${name}=`));
  return raw ? raw.split('=').slice(1).join('=') : undefined;
}

async function main() {
  const email = (arg('email') || '').toLowerCase().trim();
  const password = arg('password') || '';
  if (!email || !password) {
    console.error('Uso: npm run set:password -- --email=EMAIL --password=NOVA_SENHA');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hash },
  });

  console.log('Senha atualizada para:', email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
