import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE_URL=', process.env.DATABASE_URL);
  const rows: unknown[] = await prisma.$queryRawUnsafe('PRAGMA database_list;');
  console.log('PRAGMA database_list =>', rows);
  await prisma.$disconnect();
}
main();
