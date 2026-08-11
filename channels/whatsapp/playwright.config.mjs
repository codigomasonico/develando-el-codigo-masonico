import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node tools/simulador-cartes.mjs",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
