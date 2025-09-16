// lib/uiColors.ts
export type Token6 = "A"|"W"|"G"|"P"|"K"|"X";
export function token6ToStyle(t: Token6) {
  switch (t) {
    case "A": return { background: "#3b82f6" };         // Azul
    case "W": return { background: "#ffffff", border: "1px solid #e5e7eb" }; // Branco
    case "G": return { background: "#22c55e" };         // Verde
    case "P": return { background: "#ec4899" };         // Rosa
    case "K": return { background: "#111827" };         // Preto
    default:  return { background: "#9ca3af" };         // Cinza (X)
  }
}
