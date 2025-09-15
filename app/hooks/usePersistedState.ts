// app/hooks/usePersistedState.ts
"use client";

import { useEffect, useRef, useState } from "react";

type Options<T> = {
  /** Storage a usar (default: localStorage) */
  storage?: Storage;
  /** Serializador custom (default: JSON.stringify) */
  serialize?: (v: T) => string;
  /** Parser custom (default: JSON.parse) */
  parse?: (s: string) => T;
  /** Sincroniza entre abas via `storage` event (default: true) */
  sync?: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

/** Lê do storage com try/catch e parser custom */
function safeRead<T>(
  storage: Storage | undefined,
  key: string,
  parse: (s: string) => T,
): T | undefined {
  try {
    const raw = storage?.getItem(key);
    return raw != null ? parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Escreve no storage com try/catch e serializador custom */
function safeWrite<T>(
  storage: Storage | undefined,
  key: string,
  value: T,
  serialize: (v: T) => string,
) {
  try {
    storage?.setItem(key, serialize(value));
  } catch {
    /* ignore */
  }
}

/**
 * Estado persistido em localStorage com SSR-safe.
 * Exporta tanto `default` quanto nomeado: `usePersistedState`.
 */
export function usePersistedState<T>(
  key: string,
  initial: T | (() => T),
  opts: Options<T> = {},
) {
  const storage = opts.storage ?? (isBrowser() ? window.localStorage : undefined);
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  const parse = opts.parse ?? ((s: string) => JSON.parse(s) as T);
  const sync = opts.sync ?? true;

  // Inicialização SSR-safe
  const initialValue =
    isBrowser() ? safeRead<T>(storage, key, parse) ?? (typeof initial === "function" ? (initial as () => T)() : initial)
                : typeof initial === "function" ? (initial as () => T)() : initial;

  const [state, setState] = useState<T>(initialValue);

  // Rehidrata se a CHAVE mudar (e houver valor persistido para a nova chave)
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (!isBrowser()) return;
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      const fromStorage = safeRead<T>(storage, key, parse);
      if (fromStorage !== undefined) {
        setState(fromStorage);
      } else {
        // se não houver nada para a nova chave, persiste o estado atual
        safeWrite(storage, key, state, serialize);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persiste a cada mudança de estado
  useEffect(() => {
    if (!isBrowser()) return;
    safeWrite(storage, key, state, serialize);
  }, [key, state, serialize, storage]);

  // Sincroniza entre abas (opcional)
  useEffect(() => {
    if (!isBrowser() || !sync) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      const next = e.newValue;
      if (next == null) return;
      try {
        const parsed = parse(next);
        setState(parsed);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, parse, sync]);

  return [state, setState] as const;
}

// export default para quem importa como default
export default usePersistedState;
