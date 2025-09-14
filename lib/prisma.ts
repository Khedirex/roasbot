// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma__ ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

/** Opcional: chame isso no boot para validar a conexão */
export async function ensurePrisma() {
  try {
    await prisma.$connect();
  } catch (err: unknown) {
    console.error("Prisma connect error:", getErrorMessage(err), err);
  }
  return prisma;
}
