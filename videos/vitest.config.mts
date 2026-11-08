import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Vitest: pruebas unitarias (tests/unit) e integración de las Route Handlers
 * contra MongoDB y RustFS reales (tests/integration).
 * Se usan una BD y un bucket propios de test para no tocar los datos reales.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` lanza un error fuera del bundler de Next: lo neutralizamos.
      "server-only": `${root}tests/support/empty.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/support/setup.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // Los ficheros de integración comparten BD: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB: "videovault_test",
      RUSTFS_ENDPOINT: "http://localhost:9001",
      RUSTFS_ACCESS_KEY: "rustfsadmin",
      RUSTFS_SECRET_KEY: "rustfsadmin",
      RUSTFS_BUCKET: "videos-test",
      JWT_SECRET: "test-secret-for-vitest-only",
    },
  },
});
