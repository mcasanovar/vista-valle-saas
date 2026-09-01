import { defineConfig, devices } from "@playwright/test";
import type { ReporterDescription } from "playwright/test";

const runningInCi = Boolean(process.env.CI);
const productionServer = process.env.E2E_SERVER_MODE === "production";
const defaultPort = productionServer ? 3001 : 3000;
const configuredPort = Number(process.env.E2E_PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0
  ? configuredPort
  : defaultPort;
const nextCli = "node_modules/next/dist/bin/next";
const withTestEnvironment = "scripts/with-test-env.mjs";
const webServerCommand = productionServer
  ? `${process.execPath} ${withTestEnvironment} ${process.execPath} ${nextCli} start --hostname 127.0.0.1 --port ${port}`
  : `${process.execPath} ${withTestEnvironment} ${process.execPath} ${nextCli} dev --hostname 127.0.0.1 --port ${port}`;
const productionReporter: ReporterDescription[] = [
  ["list"],
  ["json", { outputFile: "test-results/production-quality-report.json" }],
];
const reporter: ReporterDescription[] | "list" = productionServer
  ? productionReporter
  : "list";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: "test-results",
  reporter,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: webServerCommand,
    reuseExistingServer:
      Boolean(process.env.E2E_REUSE_SERVER) ||
      (!runningInCi && !productionServer && port === defaultPort),
    url: `http://127.0.0.1:${port}`,
  },
});
