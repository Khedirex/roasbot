"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RobotManager from "@/components/RobotManager";

type Casa = { label: string; slug: string };
type Game = { id: string; label: string; basePath: string; casas: Casa[] };

const GAMES: Game[] = [
  { id: "aviator", label: "Aviator", basePath: "/bots/aviator", casas: [
    { label: "1Win", slug: "1win" }, { label: "LeBull", slug: "lebull" }
  ]},
  { id: "bacbo", label: "Bac Bo", basePath: "/bots/bacbo", casas: [
    { label: "Stake", slug: "stake" }, { label: "Bet365", slug: "bet365" }
  ]},
  { id: "mines", label: "Mines", basePath: "/bots/mines", casas: [
    { label: "1Win", slug: "1win" }
  ]},
  { id: "roleta", label: "Roleta", basePath: "/bots/roleta", casas: [
    { label: "LeBull", slug: "lebull" }
  ]},
];

export default function BotsPage() {
  const router = useRouter();
  const search = useSearchParams();

  const [gameId, setGameId] = useState<string>("");
  const [casaSlug, setCasaSlug] = useState<string>("");

  useEffect(() => {
    const g = search.get("game") || "";
    const c = search.get("casa") || "";
    const exists = GAMES.some((x) => x.id === g);
    setGameId(exists ? g : "");
    setCasaSlug(c);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (gameId) params.set("game", gameId);
    if (casaSlug) params.set("casa", casaSlug);
    router.replace(params.toString() ? `/bots?${params}` : "/bots");
  }, [gameId, casaSlug, router]);

  const selectedGame = useMemo(
    () => GAMES.find((g) => g.id === gameId) || null,
    [gameId]
  );

  useEffect(() => {
    if (!selectedGame) { setCasaSlug(""); return; }
    const ok = selectedGame.casas.some((c) => c.slug === casaSlug);
    if (!ok) setCasaSlug("");
  }, [selectedGame, casaSlug]);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Configurar Bots</h1>

      {/* Seletores */}
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Jogo</label>
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Selecione um jogo…</option>
            {GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Casa</label>
          <select
            value={casaSlug}
            onChange={(e) => setCasaSlug(e.target.value)}
            disabled={!selectedGame}
            className={`w-full rounded-lg border px-3 py-2 ${!selectedGame ? "bg-gray-100 text-gray-400" : ""} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}
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

      {/* Conteúdo só após escolher jogo+casa */}
      <section className="mt-8">
        {!selectedGame && <p className="text-gray-500">Escolha um <b>jogo</b> para habilitar as opções de casa.</p>}
        {selectedGame && !casaSlug && <p className="text-gray-500">Agora selecione a <b>casa</b> para ver as configurações.</p>}

        {selectedGame && casaSlug && (
          <RobotManager
            key={`${selectedGame.id}-${casaSlug}`}
            botId={selectedGame.id}
            casa={casaSlug}
          />
        )}
      </section>
    </div>
  );
}