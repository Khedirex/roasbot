// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Rotas públicas exatas (páginas) */
const PUBLIC_PATHS = new Set<string>(["/", "/login", "/register", "/healthz"]);

/** Prefixos públicos (estáticos + APIs abertas) */
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/favicon.ico",
  "/icons",
  "/images",
  "/public",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/apple-touch-icon",

  // Auth
  "/api/auth",

  // APIs abertas do projeto
  "/api/ingest",
  "/api/messages",

  // ✅ Telegram (mantidos)
  "/api/telegram/send",
  "/api/telegram/targets",
  "/api/ping",
];

/** CORS (padrão liberado) para APIs abertas */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type,authorization,x-api-key,x-ingest-token,x-requested-with",
  Vary: "Origin",
};

function isPublicPrefix(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search, hash, origin } = req.nextUrl;

  // Log apenas em dev
  if (process.env.NODE_ENV !== "production") {
    console.log("[MW] passou", pathname);
  }

  // 0) Pré-flight/CORS das APIs abertas
  if (req.method === "OPTIONS" && isPublicPrefix(pathname)) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1) Libera rotas públicas exatas (páginas)
  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login") {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token) return NextResponse.redirect(new URL("/", origin));
    }
    return NextResponse.next();
  }

  // 2) Libera tudo que bate nos prefixos públicos (estáticos + APIs abertas)
  if (isPublicPrefix(pathname)) {
    // Para APIs abertas, acrescenta CORS também nas respostas normais (GET/POST)
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.next();
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    return NextResponse.next();
  }

  // 3) Protege o restante (páginas e APIs que NÃO são públicas)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 3a) APIs protegidas → 401 JSON
  if (!token && pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3b) Páginas protegidas → redirect para /login com callbackUrl completo
  if (!token) {
    const returnTo = `${pathname}${search || ""}${hash || ""}`;
    const url = new URL("/login", origin);
    url.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(url);
  }

  // 4) OK
  return NextResponse.next();
}

/**
 * ⚠️ MUITO IMPORTANTE:
 * - O matcher abaixo faz o middleware rodar APENAS em páginas.
 * - NÃO intercepta /api/** nem estáticos, então suas APIs (incluindo /api/telegram/send)
 *   não passam mais pelo middleware e usam somente a auth por token do próprio endpoint.
 */
export const config = {
  matcher: ["/((?!api|_next|static|.*\\..*|favicon.ico|icons|images|public).*)"],
};
