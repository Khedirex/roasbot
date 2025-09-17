// lib/prisma.ts
import { PrismaClient, type Prisma } from "@prisma/client";

const prismaLogLevels: Prisma.LogLevel[] =
  process.env.PRISMA_LOG_QUERIES === "1"
    ? ["query", "info", "warn", "error"]
    : ["warn", "error"];

// evita múltiplas instâncias em dev/hmr
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels,
    // ✅ use somente UM dos dois. Aqui, datasourceUrl:
    datasourceUrl: process.env.DATABASE_URL,
    // ❌ NÃO use "datasources" junto
    // datasources: { db: { url: process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function ensureDb() {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error("Prisma connect error:", (err as any)?.message || err);
  }
  return prisma;
}
