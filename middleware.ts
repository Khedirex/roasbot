// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Páginas públicas exatas */
const PUBLIC_PATHS = new Set<string>(["/", "/login", "/register", "/healthz"]);

/** Prefixos públicos (estáticos) */
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
];

function isPublicPrefix(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const origin = url.origin;

  // normaliza pathname (sem trailing slash, exceto raiz)
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);

  if (process.env.NODE_ENV !== "production") {
    console.log("[MW]", pathname);
  }

  // 1) Liberar arquivos estáticos
  if (isPublicPrefix(pathname)) {
    return NextResponse.next();
  }

  // 2) Liberar páginas públicas exatas
  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login") {
      // se já logado, redireciona para home
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token) return NextResponse.redirect(new URL("/", origin));
    }
    return NextResponse.next();
  }

  // 3) Proteger o restante (somente páginas; /api/** não passa aqui pelo matcher)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const returnTo = url.pathname + (url.search || "") + (url.hash || "");
    const login = new URL("/login", origin);
    login.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

/** Matcher exclui /api/** e estáticos */
export const config = {
  matcher: ["/((?!api|_next|static|.*\\..*|favicon.ico).*)"],
};
