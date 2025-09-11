"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminHome() {
  const { data } = useSession();
  const router = useRouter();

  // fallback de segurança no client (middleware já protege)
  if (data?.user?.role !== "ADMIN") {
    if (typeof window !== "undefined") router.replace("/");
    return null;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Painel do Desenvolvedor</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Visão global</h2>
          <p className="text-sm text-gray-600">KPIs de todos os bots/usuários.</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Usuários</h2>
          <p className="text-sm text-gray-600">Cadastrar/ativar/desativar usuários.</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Auditoria</h2>
          <p className="text-sm text-gray-600">Logs de acesso e ações.</p>
        </div>
      </div>
    </section>
  );
}
