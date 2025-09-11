import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

// Somente esses e-mails são ADMIN
const ADMINS = new Set(["suporte@roasbot.online", "marcelinow7@gmail.com"]);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

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

          const email = creds.email.toLowerCase().trim();
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;

          const ok = await verifyPassword(creds.password, user.password);
          if (!ok) return null;

          return { id: user.id, name: user.name ?? "", email: user.email };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    // ❌ Não tipar os parâmetros aqui — deixe o NextAuth inferir
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        (token as any).userId = (user as any).id;
      }

      // Define role por allowlist
      const email = (user?.email ?? token.email ?? "").toLowerCase().trim();
      (token as any).role = ADMINS.has(email) ? "ADMIN" : "USER";

      return token;
    },

    async session({ session, token }) {
      const uid = (token as any).userId ?? token.sub;
      if (uid) (session as any).userId = uid;

      if (session.user) {
        (session.user as any).role = (token as any).role ?? "USER";
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export const runtime = "nodejs";
