import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
};
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

async function tryFetch(name: string, url: string, init?: RequestInit) {
  const startedAt = Date.now();
  try {
    const r = await fetch(url, { ...init });
    const ct = r.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await r.json().catch(() => null) : await r.text().catch(() => null);
    return {
      name, ok: true, status: r.status, ms: Date.now() - startedAt,
      body: typeof body === "string" ? body.slice(0, 400) : body,
    };
  } catch (e: any) {
    return {
      name, ok: false, ms: Date.now() - startedAt,
      error: e?.message,
      cause: {
        code: e?.cause?.code,
        errno: e?.cause?.errno,
        syscall: e?.cause?.syscall,
        address: e?.cause?.address,
        hostname: e?.cause?.hostname,
      },
    };
  }
}

export async function GET() {
  try {
    // Pega um target ativo (pra testar /getMe mais adiante)
    const target = await prisma.telegramTarget.findFirst({ where: { active: true } }).catch(() => null);

    const tests: any[] = [];
    tests.push(await tryFetch("https_google", "https://www.google.com"));
    tests.push(await tryFetch("httpbin_get", "https://httpbin.org/get"));
    tests.push(await tryFetch("tg_root", "https://api.telegram.org"));

    if (target?.botToken) {
      const safeToken = target.botToken.replace(/:.+$/, ":***");
      tests.push(await tryFetch(`tg_getMe_${safeToken}`, `https://api.telegram.org/bot${target.botToken}/getMe`));
    } else {
      tests.push({ name: "tg_getMe_skipped", ok: false, error: "no botToken available" });
    }

    return json(200, { ok: true, target: target ? { id: target.id, chatId: target.chatId } : null, tests });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "NET_DIAG_FAILED" });
  }
}
