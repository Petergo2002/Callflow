import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results-auth",
  testDir: "./tests/auth-e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3400" },
  webServer: {
    command:
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_CALLFLOW_STORAGE_MODE=local CALLFLOW_AUTH_TEST_SERVER=1 npm run build && CALLFLOW_AUTH_TEST_SERVER=1 npm run start -- --port 3400",
    url: "http://127.0.0.1:3400",
    timeout: 120000,
  },
});
