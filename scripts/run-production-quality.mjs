import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const nextCli = path.join(root, "node_modules/next/dist/bin/next");
const playwrightCli = path.join(root, "node_modules/@playwright/test/cli.js");
const withTestEnvironment = path.join(root, "scripts/with-test-env.mjs");

function run(command, arguments_, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: root,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Quality check stopped with signal ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Quality check exited with code ${code}.`));
        return;
      }
      resolve();
    });
  });
}

await run(process.execPath, [
  withTestEnvironment,
  process.execPath,
  nextCli,
  "build",
  "--webpack",
]);
await run(
  process.execPath,
  [
    withTestEnvironment,
    process.execPath,
    playwrightCli,
    "test",
    "e2e/accessibility-seo.spec.ts",
  ],
  { E2E_SERVER_MODE: "production" }
);
