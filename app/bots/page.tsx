// app/bots/page.tsx
import { Suspense } from "react";
import BotsClient from "./BotsClient";

// Garante que a rota /bots não será pré-renderizada estaticamente.
// Isso evita o erro de "useSearchParams() should be wrapped in a suspense boundary".
export const dynamic = "force-dynamic";

type SearchParams = {
  game?: string;
  casa?: string;
};

export default function BotsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const initialGame =
    typeof searchParams?.game === "string" ? searchParams.game : "";
  const initialCasa =
    typeof searchParams?.casa === "string" ? searchParams.casa : "";

  return (
    <Suspense fallback={<div>Carregando…</div>}>
      <BotsClient initialGame={initialGame} initialCasa={initialCasa} />
    </Suspense>
  );
}
