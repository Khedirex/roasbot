// app/hooks/usePersistedState.ts
"use client";

import { useEffect, useRef, useState } from "react";

function usePersistedStateImpl<T>(key: string, initial: T) {
  const isBrowser = typeof window !== "undefined";
  const mounted = useRef(false);

  const [value, setValue] = useState<T>(() => {
    if (!isBrowser) return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!isBrowser) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [isBrowser, key, value]);

  useEffect(() => {
    if (!isBrowser) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        const next = e.newValue != null ? (JSON.parse(e.newValue) as T) : initial;
        setValue(next);
      } catch {
        setValue(initial);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isBrowser, key, initial]);

  return [value, setValue] as const;
}

// 👇 Exporta default e named para ser compatível com ambos os estilos de import
export default usePersistedStateImpl;
export const usePersistedState = usePersistedStateImpl;
