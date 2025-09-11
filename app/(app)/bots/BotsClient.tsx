// app/(app)/bots/BotsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RobotManager from "@/components/RobotManager";

/** IDs fortes suportados pelo RobotManager */
type GameId = "aviator" | "bacbo" | "mines" | "roleta";
type CasaSlug = "1win" | "lebull"; // <-- somente casas suportadas

type Casa = { label: string; slug: CasaSlug };
type Game = { id: GameId; label: string; basePath: string; casas: Casa[] };

const GAMES: Game[] = [
  {
    id: "aviator",
    label: "Aviator",
    basePath: "/bots/aviator",
    casas: [
      { label: "1Win", slug: "1win" },
      { label: "LeBull", slug: "lebull" },
    ],
  },
  {
    id: "bacbo",
    label: "Bac Bo",
    basePath: "/bots/bacbo",
    casas: [
      // Removidos stake/bet365 para evitar conflito de tipos
      { label: "LeBull", slug: "lebull" },
    ],
  },
  {
    id: "mines",
    label: "Mines",
    basePath: "/bots/mines",
    casas: [{ label: "1Win", slug: "1win" }],
  },
  {
    id: "roleta",
    label: "Roleta",
    basePath: "/bots/roleta",
    casas: [{ label: "LeBull", slug: "lebull" }],
  },
];

// type-guards para inicializar com querystring sem quebrar
const isGameId = (v: unknown): v is GameId =>
  v === "aviator" || v === "bacbo" || v === "mines" || v === "roleta";
const isCasaSlug = (v: unknown): v is CasaSlug => v === "1win" || v === "lebull";

export default function BotsClient({
  initialGame,
  initialCasa,
}: {
  initialGame?: string;
  initialCasa?: string;
}) {
  const router = useRouter();

  // estados com unions + null (evita casts no render)
  const [gameId, setGameId] = useState<GameId | null>(
    isGameId(initialGame) ? initialGame : null
  );
  const [casaSlug, setCasaSlug] = useState<CasaSlug | null>(
    isCasaSlug(initialCasa) ? initialCasa : null
  );

  // valida jogo ao mudar
  useEffect(() => {
    if (gameId && !GAMES.some((g) => g.id === gameId)) setGameId(null);
  }, [gameId]);

  const selectedGame = useMemo(
    () => (gameId ? GAMES.find((g) => g.id === gameId) ?? null : null),
    [gameId]
  );

  // valida casa quando o jogo muda
  useEffect(() => {
    if (!selectedGame) {
      setCasaSlug(null);
      return;
    }
    if (casaSlug && !selectedGame.casas.some((c) => c.slug === casaSlug)) {
      setCasaSlug(null);
    }
  }, [selectedGame, casaSlug]);

  // sincroniza URL (?game=...&casa=...)
  useEffect(() => {
    const params = new URLSearchParams();
    if (gameId) params.set("game", gameId);
    if (casaSlug) params.set("casa", casaSlug);
    router.replace(params.toString() ? `/bots?${params}` : "/bots");
  }, [gameId, casaSlug, router]);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Configurar Bots</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Jogo</label>
          <select
            value={gameId ?? ""}
            onChange={(e) => setGameId((e.target.value || null) as GameId | null)}
            className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Selecione um jogo…</option>
            {GAMES.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Casa</label>
          <select
            value={casaSlug ?? ""}
            onChange={(e) => setCasaSlug((e.target.value || null) as CasaSlug | null)}
            disabled={!selectedGame}
            className={`w-full rounded-lg border px-3 py-2 ${
              !selectedGame ? "bg-gray-100 text-gray-400" : ""
            } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}
          >
            <option value="" disabled>
              {selectedGame ? "Selecione a casa…" : "Escolha um jogo primeiro…"}
            </option>
            {selectedGame?.casas.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="mt-8">
        {!selectedGame && (
          <p className="text-gray-500">
            Escolha um <b>jogo</b> para habilitar as opções de casa.
          </p>
        )}
        {selectedGame && !casaSlug && (
          <p className="text-gray-500">
            Agora selecione a <b>casa</b> para ver as configurações.
          </p>
        )}
        {selectedGame && casaSlug && (
          <RobotManager
            key={`${selectedGame.id}-${casaSlug}`}
            botId={selectedGame.id}
            casa={casaSlug} // casa é exatamente "1win" | "lebull"
          />
        )}
      </section>
    </div>
  );
}
