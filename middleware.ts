// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// rotas/paths SEM proteção
const PUBLIC_PATHS = new Set<string>([
  "/", "/login", "/register", "/healthz",
]);

// prefixos SEM proteção (assets/infra)
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/icons", "/images", "/api/auth", "/api/ingest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) libera rotas públicas exatas
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // 2) libera prefixos públicos (assets e APIs liberadas)
  for (const p of PUBLIC_PREFIXES) {
    if (pathname.startsWith(p)) return NextResponse.next();
  }

  // 3) protege o restante
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 3a) APIs protegidas → 401 JSON
  if (!token && pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3b) páginas protegidas → redirect para /login com callbackUrl
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 4) ok
  return NextResponse.next();
}

// Evita rodar em tudo que já está liberado
export const config = {
  matcher: [
    // aplica em qualquer rota que NÃO comece pelos prefixos abaixo
    "/((?!_next|favicon|icons|images|api/auth|api/ingest).*)",
  ],
};
