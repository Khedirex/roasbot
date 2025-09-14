// app/hooks/usePersistedState.ts
"use client";

import { useEffect, useState } from "react";

export default function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // se o localStorage não estiver disponível ou der erro, ignoramos
    }
  }, [key, state]);

  return [state, setState] as const;
}
