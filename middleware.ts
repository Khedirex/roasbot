// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Ingest-Token",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Estáticos/internos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // NextAuth liberado
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/ingest")) {
  return NextResponse.next();
  }

  // >>> INGEST liberado (com OPTIONS e CORS)
  if (pathname.startsWith("/api/ingest")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const res = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  // Páginas públicas
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

// Rodar também em /api/ingest (para setar CORS)
export const config = {
  matcher: [
    "/((?!_next|favicon|icons|images|public|api/auth|login|register|healthz).*)",
  ],
};
