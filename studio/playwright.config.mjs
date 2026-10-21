import {defineConfig} from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {timeout: 8_000},
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", {open: "never", outputFolder: "playwright-report"}]]
    : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {name: "desktop-chromium", use: {browserName: "chromium", viewport: {width: 1366, height: 900}}},
    {name: "mobile-chromium", use: {
      browserName: "chromium", viewport: {width: 390, height: 844},
      isMobile: true, hasTouch: true, deviceScaleFactor: 1
    }}
  ],
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory dist",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
