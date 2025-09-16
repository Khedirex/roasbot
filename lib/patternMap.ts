// lib/uiColors.ts
// lib/patternMap.ts
export type UIToken = "A" | "W" | "G" | "P" | "K" | "X"; // Azul, Branco, Verde, Rosa, Preto, Cinza
export type RunToken = "R" | "G" | "B";                   // Matcher: Red / Green / White

// Converte os quadradinhos da UI em pattern pro matcher (R/G/B)
export function uiToRuntimePattern(ui: UIToken[]): RunToken[] {
  return ui.map(t => {
    if (t === "W") return "B";              // Branco -> B (white)
    if (t === "A" || t === "G") return "G"; // Azul/Verde -> G
    // Rosa (P), Preto (K) e Cinza (X) contam como “não verde”
    return "R";
  });
}
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
