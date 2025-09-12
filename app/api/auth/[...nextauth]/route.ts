import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
// se existir, usamos seu helper; se não, caímos no bcrypt
import { verifyPassword as verifyPasswordHelper } from "@/lib/password";

const ADMINS = new Set(["suporte@roasbot.online", "marcelinow7@gmail.com"]);

async function verifyPassword(plain: string, hash: string) {
  try {
    if (typeof verifyPasswordHelper === "function") {
      return await verifyPasswordHelper(plain, hash);
    }
  } catch {}
  return compare(plain, hash);
}

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
        if (!creds?.email || !creds?.password) return null;

        const email = creds.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await verifyPassword(creds.password, user.password);
        if (!ok) return null;

        return { id: user.id, name: user.name ?? "", email: user.email };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        (token as any).userId = (user as any).id;
      }
      const email = (user?.email ?? token.email ?? "").toLowerCase().trim();
      (token as any).role = ADMINS.has(email) ? "ADMIN" : "USER";
      return token;
    },

    async session({ session, token }) {
      const uid = (token as any).userId ?? token.sub;
      if (uid) (session as any).userId = uid;
      if (session.user) (session.user as any).role = (token as any).role ?? "USER";
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export const runtime = "nodejs";