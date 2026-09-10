import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  // This complete two-player flow includes cold Next development compilation.
  timeout: 240000,
  expect: { timeout: 30000 },
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results",
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    viewport: { width: 1280, height: 720 },
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
        : {}),
      args: ["--enable-unsafe-swiftshader"],
    },
  },
});
