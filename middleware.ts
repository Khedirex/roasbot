// middleware.ts
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Internos/estáticos sempre liberados
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // LIBERA NextAuth e o endpoint de ingest (passa direto para o handler)
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/ingest")) {
    return NextResponse.next();
  }

  // Rotas públicas (ajuste conforme seu app)
  if (["/login", "/register", "/", "/healthz"].includes(pathname)) {
    return NextResponse.next();
  }

  // Protege o resto
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// IMPORTANTÍSSIMO: não rodar o middleware nas rotas liberadas
export const config = {
  matcher: [
    "/((?!_next|favicon|icons|images|public|api/auth|api/ingest|login|register|healthz).*)",
  ],
};
