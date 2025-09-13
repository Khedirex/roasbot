// lib/prisma.ts
import { PrismaClient, type Prisma } from "@prisma/client";

const prismaLogLevels: Prisma.LogLevel[] =
  process.env.PRISMA_LOG_QUERIES === "1"
    ? ["query", "info", "warn", "error"]
    : ["warn", "error"];

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/** Singleton do Prisma */
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: prismaLogLevels,
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/** Opcional: garantir conexão antecipada */
export async function ensureDb() {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error("Prisma connect error:", (err as any)?.message || err);
  }
  return prisma;
}
