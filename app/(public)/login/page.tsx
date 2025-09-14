// app/(public)/login/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Coloque aqui seus imports de UI/serviços que já tinha antes,
 * ex.: import { Button, Input } from "@/components/ui";
 * ou qualquer outro componente da tela de login.
 */

function LoginInner() {
  const search = useSearchParams();
  const router = useRouter();

  // Exemplo: ler redirect e outras flags da URL (mantém seu comportamento atual)
  const redirect = search.get("redirect") ?? "/";
  const msg = search.get("msg") ?? "";

  // Se você já tinha estados/efeitos, mantenha aqui:
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  useEffect(() => {
    // qualquer efeito que você já tinha
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... sua lógica de login
    // router.push(redirect) quando logar
  };

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold mb-4">Entrar</h1>

      {msg ? (
        <div className="mb-3 text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded p-2">
          {msg}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">E-mail</label>
          <input
            type="email"
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="w-full rounded bg-blue-600 text-white py-2">
          Entrar
        </button>
      </form>

      {/* Só para mostrar que o redirect continua funcionando */}
      <p className="mt-3 text-xs text-gray-500">Redirecionar para: <code>{redirect}</code></p>
    </main>
  );
}

export default function Page() {
  // ✅ Correção mínima: envolve quem usa useSearchParams em Suspense
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
