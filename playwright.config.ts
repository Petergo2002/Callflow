import { defineConfig } from "@playwright/test";
const external = process.env.CALLFLOW_TEST_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: external || "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command:
          "NEXT_PUBLIC_CALLFLOW_STORAGE_MODE=local CALLFLOW_TEST_SERVER=1 npm run dev -- --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
