"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

function mapError(param: string | null) {
  if (!param) return null;
  const errors: Record<string, string> = {
    CredentialsSignin: "Credenciais inválidas.",
    AccessDenied: "Acesso negado.",
    OAuthAccountNotLinked: "Conta não vinculada.",
    Default: "Não foi possível entrar.",
  };
  return errors[param] ?? "Não foi possível entrar.";
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { status } = useSession();

  // aceita ?callbackUrl=/bots, mas só se for caminho interno
  const callbackUrl = useMemo(() => {
    const raw = sp.get("callbackUrl") ?? "/";
    return raw.startsWith("/") ? raw : "/";
  }, [sp]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(mapError(sp.get("error")));

  // Se já estiver autenticado e abrir /login, manda para callbackUrl (ou /)
  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [status, router, callbackUrl]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);
      const email = String(form.get("email") ?? "").trim().toLowerCase();
      const password = String(form.get("password") ?? "");

      // redirect total garante cookie e navegação estável
      await signIn("credentials", {
        email,
        password,
        callbackUrl,    // "/" por padrão ou o que vier na URL
        redirect: true,
      });
      // em sucesso, o fluxo redireciona e não passa por aqui
    } catch {
      setError("Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Entrar</h1>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm">E-mail</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={loading}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="text-sm">Senha</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={loading}
              className="w-full border rounded-lg p-2"
            />
          </div>
          <button
            disabled={loading}
            className="w-full rounded-xl p-2 font-medium bg-black text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* Se o cadastro público estiver desativado, remova o link abaixo */}
        {/* <a href="/register" className="text-sm text-center block underline">Criar conta</a> */}
      </div>
    </div>
  );
}
