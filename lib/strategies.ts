// lib/strategies.ts
import type { Strategy as PrismaStrategy } from "@prisma/client";

/** Reexporta o tipo Strategy do Prisma para uso na Web/UI */
export type Strategy = PrismaStrategy;

/** Utilitário só para não quebrar import antigo */
export function _debugSnapshot() {
  return { ts: Date.now() };
}
