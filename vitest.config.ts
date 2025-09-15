// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // como estamos testando funções puras (sem DOM), use "node"
    environment: "node",
    // procure testes só onde interessa (evita varrer .next, node_modules, etc.)
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    exclude: [
      "node_modules",
      ".next",
      "dist",
      "build",
      "**/__tests__/helpers/**",
    ],
    // habilita TS paths caso você use "@" em futuros testes
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
    // transpila TS/TSX com esbuild
    deps: {
      inline: [/^@?vitest/],
    },
  },
});
