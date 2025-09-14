// lib/auth.ts
import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const ADMINS = new Set<string>([
  "suporte@roasbot.online",
  "marcelinow7@gmail.com",
]);

export type AppRole = "ADMIN" | "USER";

export function roleFromEmail(email?: string | null): AppRole {
  const e = (email ?? "").toLowerCase().trim();
  return ADMINS.has(e) ? "ADMIN" : "USER";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        try {
          if (!creds?.email || !creds?.password) return null;

          const email = String(creds.email).toLowerCase().trim();
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;

          const ok = await verifyPassword(String(creds.password), user.password);
          if (!ok) return null;

          return { id: String(user.id), name: user.name ?? email, email: user.email };
        } catch (e) {
          console.error("[auth] authorize error:", e);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) (token as any).userId = (user as any).id;

      const email = (user?.email ?? token.email ?? "")
        .toString()
        .toLowerCase()
        .trim();

      (token as any).role = ADMINS.has(email) ? "ADMIN" : "USER";
      return token;
    },

    async session({ session, token }) {
      const uid = (token as any).userId ?? token.sub ?? null;
      if (uid) (session as any).userId = uid;
      if (session.user) (session.user as any).role = (token as any).role ?? "USER";
      return session;
    },

    // permite redirects relativos e *.github.dev (Codespaces)
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        const b = new URL(baseUrl);
        if (u.hostname.endsWith(".github.dev") && b.hostname.endsWith(".github.dev")) {
          return url;
        }
      } catch {}
      return baseUrl;
    },
  },
};

// helper para Server Components / ações server
export function getServerAuthSession() {
  return getServerSession(authOptions);
}
