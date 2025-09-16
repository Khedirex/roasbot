// uiTokens.ts
export type UIToken = "A" | "W" | "G" | "P" | "K" | "X"; // Azul, Branco, Verde, Rosa, Preto, Cinza
export type RGB = "R" | "G" | "B";

// UI -> runtime (matcher)
export const UI_TO_RGB: Record<UIToken, RGB> = {
  A: "G", // Azul conta como Verde (>= blueAt)
  W: "B", // Branco é Branco (= whiteAt)
  G: "G", // Verde
  P: "R", // Rosa (<= pinkAt) vira Red
  K: "R", // Preto (< greenAt e não Rosa) vira Red
  X: "R", // Cinza (coringa/qualquer) trate como Red no matcher
};

// opção para exibir (quando carregar do backend um pattern RGB):
export const RGB_TO_UI_DEFAULT: Record<RGB, UIToken> = {
  R: "K", // ao abrir, mostre R como Preto (melhor leitura visual)
  G: "G",
  B: "W",
};
