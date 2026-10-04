import { defineConfig } from "@playwright/test"

const basePath = process.env.BASE_PATH ?? "/"
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:4173${basePath}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort", url: `http://127.0.0.1:4173${basePath}`, reuseExistingServer: !process.env.CI },
})
