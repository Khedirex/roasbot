// app/(public)/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { status } = useSession();

  // aceita ?callbackUrl=/bots, mas só se for caminho interno
  const callbackUrl = useMemo(() => {
    const raw = sp.get("callbackUrl") || "/";
    try {
      // apenas caminhos internos (começando com /)
      return raw.startsWith("/") ? raw : "/";
    } catch {
      return "/";
    }
  }, [sp]);

  const [email, setEmail] = useState("marcelinow7@gmail.com");
  const [password, setPassword] = useState("Willian12@");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // se já está logado, manda para o destino
  if (status === "authenticated") {
    router.replace(callbackUrl);
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    setLoading(false);

    if (!res) {
      setErr("Falha inesperada.");
      return;
    }
    if (res.error) {
      setErr("Credenciais inválidas.");
      return;
    }
    // sucesso
    router.replace(res.url ?? callbackUrl);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">Entrar</h1>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {err}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2 outline-none focus:ring"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">Senha</span>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2 outline-none focus:ring"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black text-white py-2 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-xs text-gray-500">
          Você será redirecionado para: <code>{callbackUrl}</code>
        </p>
      </form>
    </div>
  );
}
