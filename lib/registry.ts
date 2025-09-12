// lib/registry.ts
export const DEFAULT_REGISTRY = [
  { id:"aviator-1win-default",  game:"aviator", casa:"1win",   label:"Aviator • 1Win" },
  { id:"aviator-lebull-default",game:"aviator", casa:"lebull", label:"Aviator • Lebull" },
  { id:"bacbo-1win-default",    game:"bacbo",   casa:"1win",   label:"Bac Bo • 1Win" },
];
const LS = "roasbot:robots:registry";

export function ensureRegistry() {
  if (typeof window === "undefined") return DEFAULT_REGISTRY;
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) {
      localStorage.setItem(LS, JSON.stringify(DEFAULT_REGISTRY));
      return DEFAULT_REGISTRY;
    }
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
    localStorage.setItem(LS, JSON.stringify(DEFAULT_REGISTRY));
    return DEFAULT_REGISTRY;
  } catch {
    localStorage.setItem(LS, JSON.stringify(DEFAULT_REGISTRY));
    return DEFAULT_REGISTRY;
  }
}
