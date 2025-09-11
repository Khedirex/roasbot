"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);

      const res = await fetch("/actions/register", {
        method: "POST",
        body: form,
      });

      // pode acontecer do middleware redirecionar e voltar HTML
      const ctype = res.headers.get("content-type") || "";
      let data: any = null;

      if (ctype.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Sem permissão para registrar."
            : `Resposta inesperada do servidor (${res.status}).`
        );
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Erro ao registrar");
      }

      setMsg("Conta criada com sucesso! Redirecionando para o login…");
      // opcional: limpa formulário
      (e.currentTarget as HTMLFormElement).reset();
      setTimeout(() => router.push("/login"), 1200);
    } catch (err: any) {
      setMsg(err?.message || "Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Criar conta</h1>

        {msg ? (
          <p
            className={`text-sm ${
              msg.toLowerCase().includes("sucesso") ? "text-green-600" : "text-red-600"
            }`}
          >
            {msg}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm">Nome</label>
            <input name="name" className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-sm">E-mail</label>
            <input name="email" type="email" required className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="text-sm">Senha</label>
            <input name="password" type="password" required className="w-full border rounded-lg p-2" />
          </div>
          <button
            disabled={loading}
            className="w-full rounded-xl p-2 font-medium bg-black text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <a href="/login" className="text-sm text-center block underline">
          Já tenho conta
        </a>
      </div>
    </div>
  );
}
