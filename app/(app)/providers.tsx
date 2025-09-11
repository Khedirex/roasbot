"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import type { Session } from "next-auth";

export default function Providers({ children }: { children: ReactNode }) {
  // Se você já tiver ThemeProvider ou QueryClientProvider, pode compor aqui
  return <SessionProvider>{children}</SessionProvider>;
}
