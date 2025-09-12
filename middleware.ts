// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Rotas públicas exatas */
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
  "/api/auth",
  "/api/ingest",     // ingest liberado
  "/api/messages",   // render de mensagens liberado
  "/api/send",       // ✅ envia para Telegram liberado (ex.: /api/send/telegram)
];

/** CORS (padrão liberado) para APIs abertas */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-api-key,x-requested-with",
  Vary: "Origin",
};

function isPublicPrefix(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search, hash, origin } = req.nextUrl;

  // 0) Pré-flight/CORS das APIs abertas
  if (req.method === "OPTIONS" && isPublicPrefix(pathname)) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1) Libera rotas públicas exatas
  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login") {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token) return NextResponse.redirect(new URL("/", origin));
    }
    return NextResponse.next();
  }

  // 2) Libera tudo que bate nos prefixos públicos
  if (isPublicPrefix(pathname)) {
    // Para APIs abertas, acrescenta CORS também nas respostas normais (GET/POST)
    if (
      pathname.startsWith("/api/ingest") ||
      pathname.startsWith("/api/messages") ||
      pathname.startsWith("/api/send")
    ) {
      const res = NextResponse.next();
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    return NextResponse.next();
  }

  // 3) Protege o restante
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

/** Aplica o middleware em tudo, exceto o que já é público */
export const config = {
  matcher: [
    // Qualquer rota que NÃO comece com os prefixos abaixo
    "/((?!_next|favicon|icons|images|public|robots\\.txt|sitemap\\.xml|manifest\\.json|apple-touch-icon|api/auth|api/ingest|api/messages|api/send).*)",
  ],
};
