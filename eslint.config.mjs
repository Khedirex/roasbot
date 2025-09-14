// eslint.config.js
import next from "eslint-config-next";

/**
 * Flat Config para Next.js + TypeScript
 * - Ignora artefatos gerados e caches
 * - Usa as regras oficiais do Next (inclui TS)
 */
export default [
  // Ignorar pastas/arquivos gerados
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "lib/generated/**", // <- Prisma/wasm gerado
    ],
  },

  // Regras oficiais do Next (core-web-vitals + TS)
  ...next,
];
