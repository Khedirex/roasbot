// app/bots/page.tsx
"use client";

import { Suspense } from "react";
import BotsClient from "./BotsClient";

// Evita qualquer pré-renderização/SSR dessa rota
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function BotsPage() {
  return (
    <Suspense fallback={<div>Carregando bots...</div>}>
      <BotsClient />
    </Suspense>
  );
}
