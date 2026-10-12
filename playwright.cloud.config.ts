import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results-cloud",
  testDir: "./tests/cloud-e2e",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3200",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "CALLFLOW_CLOUD_TEST_SERVER=1 npm run dev -- --port 3200",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
