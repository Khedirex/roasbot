import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* CORS/JSON */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS };
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status, headers: JSON_HEADERS,
  });
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }); }

/* Delegate correto */
const TT = (prisma as any).telegramTarget as any;

/* Helpers */
const trimOrNull = (v: unknown) => (v === null || v === undefined ? null : (String(v).trim() || null));

type Body = {
  id?: string | number;
  // aliases & campos reais
  name?: string | null;     // alias de kind
  kind?: string | null;

  game?: string | null;
  gameType?: string | null; // alias de game

  casa?: string | null;
  casinoSite?: string | null; // alias de casa

  botToken?: string | null;
  telegramToken?: string | null; // alias de botToken

  chatId?: string | number | null;
  telegramChatId?: string | number | null; // alias de chatId

  active?: boolean | null;
  isActive?: boolean | null; // alias de active

  templates?: any | null;
};

function mapPayload(b: Body) {
  const id = b.id != null ? String(b.id) : undefined;
  const kind = trimOrNull(b.kind ?? b.name);
  const game = trimOrNull(b.game ?? b.gameType);
  const casa = trimOrNull(b.casa ?? b.casinoSite);
  const botToken = trimOrNull(b.botToken ?? b.telegramToken);
  const chatId = trimOrNull(b.chatId ?? b.telegramChatId);
  const active = typeof (b.active ?? b.isActive) === "boolean" ? (b.active ?? b.isActive)! : undefined;
  const templates = b.templates === undefined ? undefined : b.templates;
  return { id, kind, game, casa, botToken, chatId, active, templates };
}

/* GET */
export async function GET() {
  try {
    if (!TT) throw new Error("Delegate telegramTarget não encontrado no Prisma Client.");
    const data = await TT.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        game: true,
        casa: true,
        kind: true,
        botToken: true,
        chatId: true,
        active: true,
        templates: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return json(200, { ok: true, data });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "GET_FAILED" });
  }
}

/* POST/PUT — upsert sem apagar chatId quando ausente */
export async function POST(req: Request) {
  try {
    if (!TT) throw new Error("Delegate telegramTarget não encontrado no Prisma Client.");
    const raw = (await req.json()) as Body;
    const { id, kind, game, casa, botToken, chatId, active, templates } = mapPayload(raw);

    if (!id && !(game && casa && kind) && !chatId) {
      return json(400, { ok: false, error: "Informe: id OU (game+casa+kind) OU chatId para identificar/criar." });
    }

    // localizar atual por prioridade: id > (game,casa,kind) > chatId
    let current = null as any;
    if (id) current = await TT.findUnique({ where: { id } }).catch(() => null);
    if (!current && game && casa && kind) current = await TT.findFirst({ where: { game, casa, kind } });
    if (!current && chatId) current = await TT.findFirst({ where: { chatId } });

    if (current) {
      const dataToUpdate: any = {};
      if (kind !== null && kind !== undefined) dataToUpdate.kind = kind;
      if (game !== null && game !== undefined) dataToUpdate.game = game;
      if (casa !== null && casa !== undefined) dataToUpdate.casa = casa;
      if (botToken !== null && botToken !== undefined) dataToUpdate.botToken = botToken;
      if (chatId !== null && chatId !== undefined) dataToUpdate.chatId = chatId; // NÃO zera se ausente
      if (active !== undefined) dataToUpdate.active = active;
      if (templates !== undefined) dataToUpdate.templates = templates;

      const updated = await TT.update({
        where: { id: current.id },
        data: dataToUpdate,
        select: {
          id: true, game: true, casa: true, kind: true,
          botToken: true, chatId: true, active: true, templates: true,
          createdAt: true, updatedAt: true,
        },
      });
      return json(200, { ok: true, data: updated, mode: "updated" });
    }

    // CREATE: precisa de (game,casa,kind) ou chatId
    const dataToCreate: any = {
      kind: kind ?? "default",
      game: game ?? "aviator",
      casa: casa ?? "1win",
      botToken: botToken ?? null,
      chatId: chatId ?? null,
      active: active ?? true,
    };
    if (templates !== undefined) dataToCreate.templates = templates;
    if (id) dataToCreate.id = id;

    const created = await TT.create({
      data: dataToCreate,
      select: {
        id: true, game: true, casa: true, kind: true,
        botToken: true, chatId: true, active: true, templates: true,
        createdAt: true, updatedAt: true,
      },
    });
    return json(201, { ok: true, data: created, mode: "created" });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "UPSERT_FAILED" });
  }
}

export const PUT = POST;
