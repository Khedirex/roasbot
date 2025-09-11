import type { ReactNode } from "react";
import Providers from "./providers";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex">
        <main className="flex-1 bg-gray-100 p-6">{children}</main>
      </div>
    </Providers>
  );
}
