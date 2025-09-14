// app/api/strategies/route.ts
import { NextRequest } from "next/server";
import {
  listStrategies,
  setStrategies,
  upsertStrategy,
  removeStrategy,
  type Strategy,
  type BotId,
} from "@/lib/strategies";

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isBotId(v: string): v is BotId {
  return /^(aviator|bacbo)-(1win|lebull)$/.test(v);
}

// GET /api/strategies?botId=aviator-1win
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId") || "";
  if (!isBotId(botId)) return json(400, { ok: false, error: "botId inválido" });

  const strategies = listStrategies(botId);
  return json(200, { ok: true, botId, strategies });
}

// PUT /api/strategies  { botId, strategies: Strategy[] }  -> substitui a lista toda
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const botId = (body?.botId as string) || "";
  const strategies = body?.strategies as Strategy[] | undefined;

  if (!isBotId(botId) || !Array.isArray(strategies)) {
    return json(400, { ok: false, error: "payload inválido (botId/strategies)" });
  }

  setStrategies(botId, strategies);
  return json(200, { ok: true, botId, count: listStrategies(botId).length });
}

// POST /api/strategies  { botId, strategy } -> cria/atualiza 1 estratégia
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const botId = (body?.botId as string) || "";
  const strategy = body?.strategy as Strategy | undefined;

  if (!isBotId(botId) || !strategy) {
    return json(400, { ok: false, error: "payload inválido (botId/strategy)" });
  }

  const saved = upsertStrategy(botId, strategy);
  return json(200, { ok: true, botId, strategy: saved });
}

// DELETE /api/strategies?botId=...&id=...  -> remove 1 estratégia
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId") || "";
  const id = searchParams.get("id") || "";

  if (!isBotId(botId) || !id) {
    return json(400, { ok: false, error: "botId/id inválidos" });
  }

  const removed = removeStrategy(botId, id);
  return json(200, { ok: true, botId, removed });
}
