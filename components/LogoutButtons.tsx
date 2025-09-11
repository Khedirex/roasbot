// components/LogoutButton.tsx
"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50"
    >
      Sair
    </button>
  );
}
