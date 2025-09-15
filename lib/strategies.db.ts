// lib/strategies.db.ts
// Camada de persistência de estratégias (Prisma) com fallback para memória.
// Próximos passos: fazer os endpoints chamarem estas funções em vez do store em memória.

import { prisma } from "@/lib/prisma";
import {
  type BotId,
  type Strategy,
  listStrategies as memList,
  setStrategies as memSet,
  upsertStrategy as memUpsert,
  removeStrategy as memRemove,
  getActiveStrategies as memGetActive,
  normalizeHistory,
  isWithinWindow,
} from "@/lib/strategies";

/** Converte um registro do Prisma -> Strategy (normalizando tipos) */
function fromDb(row: any): Strategy {
  return {
    id: String(row.id),
    name: String(row.name ?? "Estratégia"),
    startHour: String(row.startHour ?? "00:00"),
    endHour: String(row.endHour ?? "23:59"),
    mgCount: Number(row.mgCount ?? 0),
    enabled: Boolean(row.enabled ?? false),
    winAt: Number(row.winAt ?? 0),
    pattern: normalizeHistory(row.pattern ?? []),
  };
}

/** Converte Strategy -> dados para Prisma */
function toDb(botId: BotId, s: Strategy) {
  return {
    id: String(s.id),
    botId,
    name: s.name,
    startHour: s.startHour,
    endHour: s.endHour,
    mgCount: s.mgCount,
    enabled: s.enabled,
    winAt: s.winAt,
    // pattern em JSON
    pattern: s.pattern,
  };
}

/** Testa rapidamente se o modelo existe no schema (e Prisma está ok). */
async function hasDb(): Promise<boolean> {
  try {
    // usa count barato; se modelo não existir, vai lançar
    await prisma.strategy.count({ take: 1 } as any);
    return true;
  } catch {
    return false;
  }
}

/** Lista estratégias do DB (ou memória) */
export async function listStrategiesDB(botId: BotId): Promise<Strategy[]> {
  if (!(await hasDb())) return memList(botId);

  const rows = await prisma.strategy.findMany({
    where: { botId },
    orderBy: [{ createdAt: "asc" }],
  } as any);
  return rows.map(fromDb);
}

/** Upsert de UMA estratégia no DB (ou memória) */
export async function upsertStrategyDB(botId: BotId, s: Strategy): Promise<Strategy> {
  if (!(await hasDb())) return memUpsert(botId, s);

  const data = toDb(botId, s);
  const saved = await prisma.strategy.upsert({
    where: { id: data.id },
    create: data,
    update: data,
  } as any);
  return fromDb(saved);
}

/** Substitui TODAS as estratégias do bot (DB ou memória) */
export async function setStrategiesDB(botId: BotId, list: Strategy[]): Promise<void> {
  if (!(await hasDb())) {
    memSet(botId, list);
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.strategy.deleteMany({ where: { botId } } as any);
    if (list.length) {
      await tx.strategy.createMany({
        data: list.map((s) => toDb(botId, s)),
      } as any);
    }
  });
}

/** Remove por id (DB ou memória). Retorna true se removeu. */
export async function removeStrategyDB(botId: BotId, strategyId: string): Promise<boolean> {
  if (!(await hasDb())) return memRemove(botId, strategyId);

  const r = await prisma.strategy.deleteMany({
    where: { id: strategyId, botId },
  } as any);
  return (r?.count ?? 0) > 0;
}

/** Estratégias ativas agora (DB ou memória). */
export async function getActiveStrategiesDB(botId: BotId, now: Date = new Date()): Promise<Strategy[]> {
  if (!(await hasDb())) return memGetActive(botId, now);

  const all = await listStrategiesDB(botId);
  return all.filter((s) => s.enabled && isWithinWindow(now, s.startHour, s.endHour));
}

/** Conveniência: salva uma lista se vier vazia no DB (seed inicial). */
export async function ensureStrategiesSeedDB(botId: BotId, seed: Strategy[] = []): Promise<void> {
  if (!(await hasDb())) return; // na memória não precisa
  const count = await prisma.strategy.count({ where: { botId } } as any);
  if (count === 0 && seed.length) {
    await setStrategiesDB(botId, seed);
  }
}
