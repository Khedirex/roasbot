// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN";
  }

  interface Session extends DefaultSession {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "USER" | "ADMIN";
    };
    userId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string;
    role?: "USER" | "ADMIN";
  }
}
