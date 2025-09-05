"use client";

import { Home, Bot, BarChart3, Settings } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-6">
      {/* Logo */}
      <div className="text-2xl font-bold mb-10">🚀 ROASBOT</div>

      {/* Navegação */}
      <nav className="space-y-4">
        <Link href="/" className="flex items-center gap-2 hover:text-gray-300">
          <Home size={18} /> Visão Geral
        </Link>

      <Link href="/bots" className="flex items-center gap-2 hover:text-gray-300">
          <Bot size={18} /> Bots
      </Link>



        <Link href="/relatorios" className="flex items-center gap-2 hover:text-gray-300">
          <BarChart3 size={18} /> Relatórios
        </Link>

        <Link href="/configuracoes" className="flex items-center gap-2 hover:text-gray-300">
          <Settings size={18} /> Configurações
        </Link>
      </nav>
    </div>
  );
}
