import { defineConfig } from "@playwright/test";

/**
 * Pruebas E2E en un navegador real contra la app compilada, MongoDB y RustFS.
 * Usa una BD (videovault_e2e) y un bucket (videos-e2e) propios, que se
 * vacían antes y después de la ejecución.
 */
const PORT = 3100;

export const e2eEnv = {
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB: "videovault_e2e",
  RUSTFS_ENDPOINT: "http://localhost:9001",
  RUSTFS_ACCESS_KEY: "rustfsadmin",
  RUSTFS_SECRET_KEY: "rustfsadmin",
  RUSTFS_BUCKET: "videos-e2e",
  JWT_SECRET: "e2e-secret-for-playwright-only",
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Usa el Chrome instalado: no hace falta descargar navegadores.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    // Las variables del proceso tienen prioridad sobre .env.local
    env: e2eEnv,
  },
});
