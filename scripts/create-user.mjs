import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function arg(name, fallback = undefined) {
  const raw = process.argv.find(a => a.startsWith(`--${name}=`));
  return raw ? raw.split('=').slice(1).join('=') : fallback;
}

async function main() {
  const email = (arg('email') || '').toLowerCase().trim();
  const password = arg('password') || '';
  const name = arg('name') || '';

  if (!email || !password) {
    console.error('Uso: npm run create:user -- --email=EMAIL --password=SENHA [--name="Nome"]');
    process.exit(1);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.error('Já existe usuário com esse e-mail.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, password: hash, name },
  });

  console.log('Usuário criado:', email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
