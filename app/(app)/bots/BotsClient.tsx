// roasbot/app/bots/BotsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RobotManager from "@/components/RobotManager";

/** IDs fortes suportados pelo RobotManager */
type GameId = "aviator" | "bacbo" | "mines" | "roleta";
type CasaSlug = "1win" | "lebull";

type Casa = { label: string; slug: CasaSlug };
type Game = { id: GameId; label: string; basePath: string; casas: Casa[] };

const GAMES = [
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
    casas: [{ label: "LeBull", slug: "lebull" }],
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
] as const satisfies ReadonlyArray<Game>;

// ===== Type-guards
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

  // estados com unions + null (evita string solta)
  const [gameId, setGameId] = useState<GameId | null>(
    isGameId(initialGame) ? initialGame : null
  );
  const [casaSlug, setCasaSlug] = useState<CasaSlug | null>(
    isCasaSlug(initialCasa) ? initialCasa : null
  );

  const selectedGame = useMemo(
    () => (gameId ? GAMES.find((g) => g.id === gameId) ?? null : null),
    [gameId]
  );

  // Se o jogo mudar, zera/valida casa
  useEffect(() => {
    if (!selectedGame) {
      setCasaSlug(null);
      return;
    }
    if (casaSlug && !selectedGame.casas.some((c) => c.slug === casaSlug)) {
      setCasaSlug(null);
    }
  }, [selectedGame, casaSlug]);

  // Sincroniza URL (?game=...&casa=...)
  useEffect(() => {
    const params = new URLSearchParams();
    if (gameId) params.set("game", gameId);
    if (casaSlug) params.set("casa", casaSlug);
    router.replace(params.toString() ? `/bots?${params}` : "/bots");
  }, [gameId, casaSlug, router]);

  // ===== Handlers tipados (sem casts nos handlers)
  const handleChangeGame = (value: string) => {
    if (isGameId(value)) setGameId(value);
    else setGameId(null);
  };

  const handleChangeCasa = (value: string) => {
    if (isCasaSlug(value) && selectedGame?.casas.some((c) => c.slug === value)) {
      setCasaSlug(value);
    } else {
      setCasaSlug(null);
    }
  };

  // Valor garantido para o RobotManager (resolve o erro da linha 109)
  const casaForManager: CasaSlug | null =
    selectedGame && isCasaSlug(casaSlug) ? (casaSlug as CasaSlug) : null;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Configurar Bots</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Jogo</label>
          <select
            value={gameId ?? ""}
            onChange={(e) => handleChangeGame(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Selecione um jogo…
            </option>
            {GAMES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Casa</label>
          <select
            value={casaSlug ?? ""}
            onChange={(e) => handleChangeCasa(e.target.value)}
            disabled={!selectedGame}
            className={`w-full rounded-lg border px-3 py-2 ${
              !selectedGame ? "bg-gray-100 text-gray-400" : ""
            } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}
          >
            <option value="" disabled>
              {selectedGame ? "Selecione a casa…" : "Escolha um jogo primeiro…"}
            </option>
            {selectedGame?.casas.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
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
        {selectedGame && !casaForManager && (
          <p className="text-gray-500">
            Agora selecione a <b>casa</b> para ver as configurações.
          </p>
        )}
        {selectedGame && casaForManager && (
          <RobotManager
            key={`${selectedGame.id}-${casaForManager}`}
            botId={selectedGame.id}
            casa={casaForManager}
          />
        )}
      </section>
    </div>
  );
}
